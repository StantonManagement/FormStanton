'use client';

import { type ChangeEvent, useMemo, useRef, useState, useCallback } from 'react';
import { usePermissionPrompt } from './usePermissionPrompt';
import LivePreviewStage from './LivePreviewStage';
import { PDFDocument } from 'pdf-lib';
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
type Stage = 'entry' | 'live_preview' | 'processing' | 'warning' | 'preview' | 'review_pages' | 'submitting';

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

async function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
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
      0.92
    );
  });
}

async function ensureOpenCvLoaded(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.cv) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-opencv="true"]') as HTMLScriptElement | null;
    if (existing && window.cv) {
      resolve();
      return;
    }

    const script = existing ?? document.createElement('script');
    script.async = true;
    script.defer = true;
    script.setAttribute('data-opencv', 'true');
    script.src = 'https://docs.opencv.org/4.x/opencv.js';

    script.onload = () => {
      if (window.cv?.onRuntimeInitialized) {
        const original = window.cv.onRuntimeInitialized;
        window.cv.onRuntimeInitialized = () => {
          original();
          resolve();
        };
        return;
      }
      resolve();
    };

    script.onerror = () => reject(new Error('OpenCV failed to load'));

    if (!existing) {
      document.body.appendChild(script);
    }
  });
}

async function ensureJscanifyLoaded(): Promise<any> {
  if (typeof window !== 'undefined' && window.jscanify) {
    return window.jscanify;
  }

  const mod = await import('jscanify/client');
  const Jscanify = (mod as any).default ?? mod;
  window.jscanify = Jscanify;
  return Jscanify;
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

  const inputRef = useRef<HTMLInputElement>(null);

  const isSingleMode = !multiPage;
  const canAddMorePages = pages.length < maxPages;

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
    heicConverted: boolean
  ) => {
    const image = await loadImageFromBlob(sourceBlob);

    let finalCanvas: HTMLCanvasElement;
    try {
      await ensureOpenCvLoaded();
      const Jscanify = await ensureJscanifyLoaded();
      const scanner = new Jscanify();
      const extracted = scanner.extractPaper(image, image.naturalWidth, image.naturalHeight);
      if (extracted instanceof HTMLCanvasElement) {
        finalCanvas = extracted;
      } else {
        throw new Error('Invalid scanner result');
      }
    } catch {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = image.naturalWidth;
      finalCanvas.height = image.naturalHeight;
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) {
        throw new Error(t.captureError);
      }
      ctx.drawImage(image, 0, 0);
    }

    const processedBlob = await canvasToJpegBlob(finalCanvas);
    const processedImage = await loadImageFromBlob(processedBlob);
    const quality = evaluateImageQuality(processedImage, processedImage.naturalWidth, processedImage.naturalHeight);

    const page: CapturedPage = {
      id: crypto.randomUUID(),
      blob: processedBlob,
      previewUrl: URL.createObjectURL(processedBlob),
      qualityFlags: quality.flags,
      qualityScores: quality.scores,
      captureMethod: method,
      heicConverted,
    };

    setCurrentPage(page);
    setStage(quality.flags.length > 0 ? 'warning' : 'preview');
  };

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setStage('processing');
    setError('');

    try {
      let inputBlob: Blob = file;
      let heicConverted = false;

      if (isHeicFile(file)) {
        const heic2any = (await import('heic2any')).default;
        inputBlob = (await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.92,
        })) as Blob;
        heicConverted = true;
      }

      await processImageBlob(inputBlob, captureMode === 'camera' ? 'scanner' : 'file_upload', heicConverted);
    } catch {
      setError(t.captureError);
      setStage('entry');
    }
  };

  const commitCurrentPage = async () => {
    if (!currentPage) return;

    setPages((prev) => [...prev, currentPage]);
    setCurrentPage(null);
    setQualityOverride(false);

    if (isSingleMode) {
      await finalizeSubmit([...pages, currentPage]);
      return;
    }

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
    const pdfDoc = await PDFDocument.create();

    for (const page of inputPages) {
      const bytes = await page.blob.arrayBuffer();
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
          onCapture={async (blob) => {
            permissionPrompt.cancel();
            setStage('processing');
            await processImageBlob(blob, 'scanner', false);
          }}
        />
      )}

      {stage === 'processing' && (
        <div className="py-8 text-center text-sm text-[var(--muted)]">{t.processing}</div>
      )}

      {stage === 'warning' && currentPage && (
        <div className="space-y-4">
          <img src={currentPage.previewUrl} alt="Scanned preview" className="w-full max-h-[50vh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none" />
          <div className="bg-[var(--bg-section)] border border-[var(--warning)]/30 p-3 rounded-none space-y-2">
            {warningMessages.map((message) => (
              <p key={message} className="text-sm text-[var(--ink)]">
                {message}
              </p>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
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
          </div>
        </div>
      )}

      {stage === 'preview' && currentPage && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.previewTitle}</h3>
          <img src={currentPage.previewUrl} alt="Preview" className="w-full max-h-[50vh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none" />
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
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.pagesCaptured}</h3>
          <div className="grid grid-cols-2 gap-3">
            {pages.map((page, index) => (
              <div key={page.id} className="relative border border-[var(--border)] rounded-none p-1">
                <img src={page.previewUrl} alt={t.pageCount(index + 1)} className="w-full h-32 object-cover" />
                <p className="text-xs text-[var(--muted)] mt-1">{t.pageCount(index + 1)}</p>
                <button
                  type="button"
                  onClick={() => deletePage(page.id)}
                  className="absolute top-1 right-1 bg-white border border-[var(--border)] w-7 h-7 text-xs rounded-none"
                  aria-label={t.deletePage}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            {canAddMorePages && (
              <button
                type="button"
                onClick={() => {
                  // Reset current page and go to entry (which shows Scan document when liveSupported)
                  resetCurrentPage();
                  setStage('entry');
                }}
                className="w-full min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
              >
                {t.addPage}
              </button>
            )}
            <button
              type="button"
              onClick={() => finalizeSubmit(pages)}
              disabled={pages.length === 0}
              className="w-full min-h-12 h-auto py-3 bg-[var(--primary)] text-white px-4 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
            >
              {t.submit}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] px-4 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {stage === 'submitting' && <div className="py-8 text-center text-sm text-[var(--muted)]">{t.uploading}</div>}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
