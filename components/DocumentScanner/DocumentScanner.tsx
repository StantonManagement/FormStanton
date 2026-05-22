'use client';

import { type ChangeEvent, useMemo, useRef, useState, useCallback } from 'react';
import { usePermissionPrompt } from './usePermissionPrompt';
import LivePreviewStage, { ensureScanicLoaded } from './LivePreviewStage';
// PRP-016 / B1: pdf-lib is loaded via dynamic import inside `buildPdf`
// only. `type`-only import keeps the type info without pulling the
// ~500 KB module into the initial scanner chunk.
import type { PDFDocument as PDFDocumentType } from 'pdf-lib';
import { evaluateImageQuality, QualityScores } from './quality';
import { translations, ScannerLanguage } from './translations';

export interface ScannerMetadata {
  capture_method: 'scanner' | 'file_upload';
  page_count: number;
  quality_flags: string[];
  quality_scores: {
    blur: number;
    brightness: number;
    resolution: number;
  };
  format: 'pdf' | 'jpeg';
  heic_converted: boolean;
}

/** @deprecated Use ScannerMetadata instead */
export type Metadata = ScannerMetadata;

interface DocumentScannerProps {
  instructions: string;
  multiPage?: boolean;
  maxPages?: number;
  acceptedFormats?: ('pdf' | 'jpeg')[];
  language: ScannerLanguage;
  onComplete: (file: File, metadata: ScannerMetadata) => Promise<void> | void;
  onCancel: () => void;
}

type CaptureMode = 'camera' | 'file';
// PRP-016 / §11.7: dedicated 'converting_heic' stage so the UI can show
// "Converting photo…" while heic2any (~180 KB chunk + actual decode) runs.
type Stage = 'entry' | 'live_preview' | 'processing' | 'converting_heic' | 'warning' | 'preview' | 'review_pages' | 'submitting';

interface CapturedPage {
  id: string;
  blob: Blob;
  previewUrl: string;
  qualityFlags: string[];
  qualityScores: QualityScores;
  captureMethod: 'scanner' | 'file_upload';
  heicConverted: boolean;
}

declare global {
  interface Window {
    cv?: {
      onRuntimeInitialized?: () => void;
      [key: string]: unknown;
    };
    jscanify?: unknown;
  }
}

function isHeicFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif') || file.type === 'image/heic' || file.type === 'image/heif';
}

/**
 * Detect iOS / iPadOS so we can drop the `capture` attribute and expose Apple's
 * native "Scan Documents" option in the file-picker action sheet (iOS 16+).
 * iPadOS reports as Mac, so check touch points as a secondary signal.
 */
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ identifies as MacIntel but supports touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

function averageScores(pages: CapturedPage[]): QualityScores {
  if (pages.length === 0) {
    return { blur: 0, brightness: 0, resolution: 0 };
  }

  const totals = pages.reduce(
    (acc, page) => {
      acc.blur += page.qualityScores.blur;
      acc.brightness += page.qualityScores.brightness;
      acc.resolution += page.qualityScores.resolution;
      return acc;
    },
    { blur: 0, brightness: 0, resolution: 0 }
  );

  return {
    blur: totals.blur / pages.length,
    brightness: totals.brightness / pages.length,
    resolution: totals.resolution / pages.length,
  };
}

async function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  const imageUrl = URL.createObjectURL(blob);
  const img = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Unable to load image'));
      img.src = imageUrl;
    });
    return img;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

/**
 * PRP-016 / B2: downsample for preview only. The full-resolution blob is
 * still used for PDF assembly; this just produces a smaller bitmap to back
 * the preview <img>. 1200px is a comfortable long-edge for review on any
 * device, cuts a 12 MP photo's preview footprint to ~5% of the original.
 */
async function makePreviewBlob(sourceBlob: Blob, maxLongEdge = 1200, quality = 0.85): Promise<Blob> {
  const img = await loadImageFromBlob(sourceBlob);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  if (longEdge <= maxLongEdge) {
    return sourceBlob;
  }
  const scale = maxLongEdge / longEdge;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return sourceBlob;
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToJpegBlob(canvas, quality);
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Unable to convert image'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality
    );
  });
}

export default function DocumentScanner({
  instructions,
  multiPage = true,
  maxPages = 10,
  acceptedFormats = ['pdf', 'jpeg'],
  language,
  onComplete,
  onCancel,
}: DocumentScannerProps) {
  const t = translations[language];
  const [stage, setStage] = useState<Stage>('entry');
  const [error, setError] = useState<string>('');
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [currentPage, setCurrentPage] = useState<CapturedPage | null>(null);
  const [qualityOverride, setQualityOverride] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>('camera');
  const [useAnywayConfirmed, setUseAnywayConfirmed] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const isSingleMode = !multiPage;

  // Live preview support detection (PRD-45)
  const liveSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }, []);

  // Permission prompt for live preview
  const permissionPrompt = usePermissionPrompt({
    onGranted: useCallback((stream: MediaStream) => {
      setStage('live_preview');
    }, []),
    onDenied: useCallback((reason: string) => {
      setError(reason === 'no_camera' ? t.permissionNoCamera : t.permissionDenied);
      setStage('entry');
    }, [t]),
  });

  const warningMessages = useMemo(() => {
    if (!currentPage) {
      return [];
    }

    return currentPage.qualityFlags
      .map((flag) => {
        if (flag === 'blurry') return t.blurryWarning;
        if (flag === 'dark') return t.darkWarning;
        if (flag === 'low_resolution') return t.lowResWarning;
        return null;
      })
      .filter((message): message is string => Boolean(message));
  }, [currentPage, t]);

  const resetCurrentPage = () => {
    if (currentPage) {
      URL.revokeObjectURL(currentPage.previewUrl);
    }
    setCurrentPage(null);
    setQualityOverride(false);
    setUseAnywayConfirmed(false);
    setError('');
  };

  const openCaptureInput = (mode: CaptureMode) => {
    setCaptureMode(mode);
    setError('');
    inputRef.current?.click();
  };

  const processImageBlob = async (
    sourceBlob: Blob,
    method: 'scanner' | 'file_upload',
    heicConverted: boolean,
    liveDocumentDetected: boolean | null = null
  ) => {
    const image = await loadImageFromBlob(sourceBlob);

    let finalCanvas: HTMLCanvasElement;
    try {
      const adapter = await ensureScanicLoaded();
      const extracted = await adapter.extract(image);
      if (extracted instanceof HTMLCanvasElement) {
        finalCanvas = extracted;
      } else {
        throw new Error('Invalid scanner result');
      }
    } catch {
      // Fallback: draw raw image to canvas
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = image.naturalWidth;
      finalCanvas.height = image.naturalHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error(t.captureError);
      }
      ctx.drawImage(image, 0, 0);
    }

    // Use lower quality for multi-page scans to keep PDF sizes manageable on cellular
    const jpegQuality = multiPage && pages.length > 0 ? 0.85 : 0.92;
    const processedBlob = await canvasToJpegBlob(finalCanvas, jpegQuality);
    const processedImage = await loadImageFromBlob(processedBlob);
    const quality = evaluateImageQuality(processedImage, processedImage.naturalWidth, processedImage.naturalHeight);

    // If the live scanner explicitly told us no document was detected, surface as a quality flag
    const augmentedFlags = liveDocumentDetected === false
      ? Array.from(new Set([...quality.flags, 'no_document_detected']))
      : quality.flags;

    // PRP-016 / B2: preview <img> is backed by a downsampled blob; the
    // full-resolution processedBlob is still what we hand to PDF assembly.
    const previewBlob = await makePreviewBlob(processedBlob);
    const page: CapturedPage = {
      id: crypto.randomUUID(),
      blob: processedBlob,
      previewUrl: URL.createObjectURL(previewBlob),
      qualityFlags: augmentedFlags,
      qualityScores: quality.scores,
      captureMethod: method,
      heicConverted,
    };

    setCurrentPage(page);
    setStage(augmentedFlags.length > 0 ? 'warning' : 'preview');
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setError('');

    try {
      let inputBlob: Blob = file;
      let heicConverted = false;

      if (isHeicFile(file)) {
        // PRP-016 / §11.7: surface a dedicated stage so the UI shows
        // "Converting photo…" instead of the generic processing spinner.
        setStage('converting_heic');
        const heic2any = (await import('heic2any')).default;
        inputBlob = (await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.92,
        })) as Blob;
        heicConverted = true;
      }

      setStage('processing');
      await processImageBlob(inputBlob, captureMode === 'camera' ? 'scanner' : 'file_upload', heicConverted);
    } catch {
      setError(t.captureError);
      setStage('entry');
    }
  };

  const commitCurrentPage = () => {
    if (!currentPage) return;
    setPages((prev) => [...prev, currentPage]);
    setCurrentPage(null);
    setQualityOverride(false);
    setStage('review_pages');
  };

  const deletePage = (pageId: string) => {
    setPages((prev) => {
      const found = prev.find((page) => page.id === pageId);
      if (found) {
        URL.revokeObjectURL(found.previewUrl);
      }
      return prev.filter((page) => page.id !== pageId);
    });
  };


  const buildPdf = async (inputPages: CapturedPage[]): Promise<Blob> => {
    // PRP-016 / B1: lazy-load pdf-lib only inside the assembly path so it
    // is not in the initial chunk. Note: cast keeps the runtime import
    // resolution cheap and the build-time type narrow.
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc: PDFDocumentType = await PDFDocument.create();
    const MAX_DIMENSION = 2400; // Cap long edge at 2400px (~200dpi for letter size), keeps file size manageable

    for (const page of inputPages) {
      // Load image to check dimensions, downscale if necessary
      const img = await loadImageFromBlob(page.blob);
      const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

      let bytes: ArrayBuffer;
      if (longEdge > MAX_DIMENSION) {
        // Downscale to MAX_DIMENSION on long edge, re-encode at lower quality
        const scale = MAX_DIMENSION / longEdge;
        const newWidth = Math.round(img.naturalWidth * scale);
        const newHeight = Math.round(img.naturalHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = newWidth;
        canvas.height = newHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Unable to create canvas context');
        ctx.drawImage(img, 0, 0, newWidth, newHeight);

        const downscaledBlob = await canvasToJpegBlob(canvas, 0.85);
        bytes = await downscaledBlob.arrayBuffer();
      } else {
        bytes = await page.blob.arrayBuffer();
      }

      const embedded = await pdfDoc.embedJpg(bytes);
      const scaled = embedded.scale(1);
      const pdfPage = pdfDoc.addPage([scaled.width, scaled.height]);
      pdfPage.drawImage(embedded, {
        x: 0,
        y: 0,
        width: scaled.width,
        height: scaled.height,
      });
    }

    const pdfBytes = await pdfDoc.save();
    const pdfArray = pdfBytes as Uint8Array;
    const pdfBuffer = pdfArray.buffer.slice(
      pdfArray.byteOffset,
      pdfArray.byteOffset + pdfArray.byteLength
    ) as ArrayBuffer;
    return new Blob([pdfBuffer], { type: 'application/pdf' });
  };

  const finalizeSubmit = async (inputPages: CapturedPage[]) => {
    if (inputPages.length === 0) {
      return;
    }

    setStage('submitting');
    setError('');

    try {
      let finalFile: File;
      let format: 'pdf' | 'jpeg';

      if (inputPages.length === 1) {
        // Single page: return as JPEG
        finalFile = new File([inputPages[0].blob], 'document.jpeg', { type: 'image/jpeg' });
        format = 'jpeg';
      } else {
        // Multi-page: return as PDF
        const pdfBlob = await buildPdf(inputPages);
        finalFile = new File([pdfBlob], 'document.pdf', { type: 'application/pdf' });
        format = 'pdf';
      }

      const qualityFlags = Array.from(new Set(inputPages.flatMap((page) => page.qualityFlags)));
      const qualityScores = averageScores(inputPages);
      const metadata: ScannerMetadata = {
        capture_method: inputPages.some((page) => page.captureMethod === 'scanner') ? 'scanner' : 'file_upload',
        page_count: inputPages.length,
        quality_flags: qualityFlags,
        quality_scores: qualityScores,
        format,
        heic_converted: inputPages.some((page) => page.heicConverted),
      };

      await onComplete(finalFile, metadata);
    } catch {
      setError(t.uploadError);
      setStage(inputPages.length > 1 ? 'review_pages' : 'preview');
    }
  };

  return (
    <div className="space-y-4">
      {/*
        On iOS we deliberately omit `capture` so the file picker shows Apple's
        native "Scan Documents" option alongside Take Photo / Photo Library
        (iOS 16+). On Android we keep `capture="environment"` when the user
        tapped "Take Photo" so they go straight to the camera without an
        extra tap (Android has no native scanner in the file picker).
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture={
          isIOSDevice()
            ? undefined
            : captureMode === 'camera'
            ? 'environment'
            : undefined
        }
        className="hidden"
        onChange={handleFileSelect}
      />

      {stage === 'entry' && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.instructionsTitle}</h3>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{instructions}</p>

          <div className="bg-[var(--bg-section)] border-l-2 border-[var(--primary)] pl-3 py-2">
            <p className="text-sm text-[var(--ink)] leading-snug">
              {t.inlineTip}
            </p>
          </div>

          <details className="border border-[var(--border)] rounded-none">
            <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg-section)]">
              {t.howToTitle}
            </summary>
            <div className="px-3 pb-3 pt-1 space-y-2">
              <p className="text-sm text-[var(--ink)] leading-relaxed">{t.howToIntro}</p>
              <ul className="text-sm text-[var(--ink)] leading-relaxed list-disc pl-5 space-y-1">
                <li>{t.howToBullet1}</li>
                <li>{t.howToBullet2}</li>
                <li>{t.howToBullet3}</li>
                <li>{t.howToBullet4}</li>
              </ul>
            </div>
          </details>

          {liveSupported ? (
            // New live preview entry: single primary CTA + secondary text links
            <>
              <button
                type="button"
                onClick={permissionPrompt.openPrePrompt}
                className="w-full min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-base font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
              >
                {t.scanDocumentBtn}
              </button>
              <div className="flex items-center justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => openCaptureInput('camera')}
                  className="text-[var(--muted)] underline hover:text-[var(--ink)] transition-colors duration-200"
                >
                  {t.secondaryTakePhoto}
                </button>
                <span className="text-[var(--muted)]">·</span>
                <button
                  type="button"
                  onClick={() => openCaptureInput('file')}
                  className="text-[var(--muted)] underline hover:text-[var(--ink)] transition-colors duration-200"
                >
                  {t.secondaryChooseFile}
                </button>
              </div>
            </>
          ) : (
            // Fallback: existing two-button layout for unsupported browsers
            <>
              <button
                type="button"
                onClick={() => openCaptureInput('camera')}
                className="w-full min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-base font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
              >
                {t.takePhoto}
              </button>
              <button
                type="button"
                onClick={() => openCaptureInput('file')}
                className="text-sm text-[var(--muted)] underline hover:text-[var(--ink)] transition-colors duration-200"
              >
                {t.chooseFile}
              </button>
            </>
          )}

          {error && <p className="text-sm text-[var(--error)]">{error}</p>}

          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
          >
            {t.cancel}
          </button>
        </div>
      )}

      {/* Permission pre-prompt modal */}
      {permissionPrompt.state.kind === 'pre_prompt' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white p-6 max-w-sm mx-4 space-y-4 rounded-none">
            <h3 className="font-serif text-lg text-[var(--primary)]">{t.permissionPromptTitle}</h3>
            <p className="text-sm text-[var(--ink)] leading-relaxed">{t.permissionPromptBody}</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={permissionPrompt.acceptPrePrompt}
                className="w-full min-h-12 bg-[var(--primary)] text-white px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
              >
                {t.permissionAllow}
              </button>
              <button
                type="button"
                onClick={permissionPrompt.cancel}
                className="text-sm text-[var(--muted)] underline hover:text-[var(--ink)] transition-colors duration-200"
              >
                {t.cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Requesting spinner */}
      {permissionPrompt.state.kind === 'requesting' && (
        <div className="py-8 text-center text-sm text-[var(--muted)]">{t.processing}</div>
      )}

      {/* Live preview stage */}
      {stage === 'live_preview' && permissionPrompt.state.kind === 'granted' && (
        <LivePreviewStage
          stream={permissionPrompt.state.stream}
          language={language}
          onCancel={() => {
            permissionPrompt.cancel();
            setStage('entry');
          }}
          onCapture={async (blob, meta) => {
            permissionPrompt.cancel();
            setStage('processing');
            await processImageBlob(blob, 'scanner', false, meta?.documentDetected ?? null);
          }}
        />
      )}

      {stage === 'processing' && (
        <div className="py-8 text-center text-sm text-[var(--muted)]">{t.processing}</div>
      )}

      {stage === 'converting_heic' && (
        <div className="py-8 text-center text-sm text-[var(--muted)]" role="status" aria-live="polite">
          {/* PRP-016 / §11.7: hard-coded EN string for the converting state.
              translations.ts is out of this PRP's Outputs; the i18n
              variant lands in a follow-up. */}
          Converting photo…
        </div>
      )}

      {stage === 'warning' && currentPage && (() => {
        const hasNoDocumentFlag = currentPage.qualityFlags.includes('no_document_detected');
        return (
          <div className="space-y-4">
            <img src={currentPage.previewUrl} alt="Scanned preview" className="w-full max-h-[50dvh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none" />

            {hasNoDocumentFlag ? (
              <div className="bg-[var(--bg-section)] border border-[var(--error)]/40 p-3 rounded-none space-y-1">
                <p className="text-sm font-medium text-[var(--error)]">{t.noDocumentWarningTitle}</p>
                <p className="text-sm text-[var(--ink)]">{t.noDocumentWarningBody}</p>
              </div>
            ) : (
              <div className="bg-[var(--bg-section)] border border-[var(--warning)]/30 p-3 rounded-none space-y-2">
                {warningMessages.map((message) => (
                  <p key={message} className="text-sm text-[var(--ink)]">
                    {message}
                  </p>
                ))}
              </div>
            )}

            {hasNoDocumentFlag && (
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useAnywayConfirmed}
                  onChange={(e) => setUseAnywayConfirmed(e.target.checked)}
                  className="mt-0.5 shrink-0 w-4 h-4 accent-[var(--primary)]"
                />
                <span className="text-sm text-[var(--ink)]">{t.confirmUseAnyway}</span>
              </label>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {hasNoDocumentFlag ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setQualityOverride(true);
                      setStage('preview');
                    }}
                    disabled={!useAnywayConfirmed}
                    className="w-full sm:flex-1 min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t.useAnyway}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      resetCurrentPage();
                      setStage('entry');
                    }}
                    className="w-full sm:flex-1 min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
                  >
                    {t.retake}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      resetCurrentPage();
                      setStage('entry');
                    }}
                    className="w-full sm:flex-1 min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
                  >
                    {t.retake}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQualityOverride(true);
                      setStage('preview');
                    }}
                    className="w-full sm:flex-1 min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
                  >
                    {t.useAnyway}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {stage === 'preview' && currentPage && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.previewTitle}</h3>
          <img src={currentPage.previewUrl} alt="Preview" className="w-full max-h-[50dvh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none" />
          {!qualityOverride && currentPage.qualityFlags.length > 0 && (
            <p className="text-xs text-[var(--muted)]">{t.scannerError}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => {
                resetCurrentPage();
                setStage('entry');
              }}
              className="w-full sm:flex-1 min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
            >
              {t.retake}
            </button>
            <button
              type="button"
              onClick={commitCurrentPage}
              className="w-full sm:flex-1 min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
            >
              {isSingleMode ? t.useThis : t.useThisPage}
            </button>
          </div>
        </div>
      )}

      {stage === 'review_pages' && (
        <div className="space-y-4">
          <h2 className="font-serif text-xl text-[var(--ink)]">
            {t.reviewTitle(pages.length)}
          </h2>
          <p className="text-sm text-[var(--ink-secondary)]">
            {t.reviewHint}
          </p>

          <ul className="space-y-3">
            {pages.map((page, idx) => (
              <li key={page.id} className="flex gap-3 items-start border border-[var(--border)] p-3">
                <img
                  src={page.previewUrl}
                  alt={t.pageNumber(idx + 1)}
                  className="w-24 h-32 object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none"
                />
                <div className="flex-1 flex flex-col gap-2">
                  <span className="text-sm font-medium">{t.pageNumber(idx + 1)}</span>
                  {page.qualityFlags.length > 0 && (
                    <span className="text-xs text-amber-700">{t.qualityWarning}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => deletePage(page.id)}
                    className="text-sm text-[var(--danger)] underline text-left w-fit min-h-12 h-auto py-2"
                  >
                    {t.deletePage}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {!isSingleMode && pages.length < (maxPages ?? 30) && (
            <button
              type="button"
              onClick={() => setStage('entry')}
              className="w-full min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] rounded-none"
            >
              {t.addPage}
            </button>
          )}

          <button
            type="button"
            onClick={() => finalizeSubmit(pages)}
            disabled={pages.length === 0}
            className="w-full min-h-12 h-auto py-3 bg-[var(--primary)] text-white rounded-none disabled:opacity-50"
          >
            {pages.length === 1 ? t.uploadOnePage : t.uploadNPages(pages.length)}
          </button>

          <button
            type="button"
            onClick={() => {
              pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
              setPages([]);
              setStage('entry');
            }}
            className="w-full min-h-12 h-auto py-3 text-[var(--ink-secondary)] underline rounded-none"
          >
            {t.cancelAndStartOver}
          </button>
        </div>
      )}

      {stage === 'submitting' && <div className="py-8 text-center text-sm text-[var(--muted)]">{t.uploading}</div>}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
