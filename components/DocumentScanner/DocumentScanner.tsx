'use client';

import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { supabase } from '@/lib/supabase';
import { evaluateImageQuality, QualityScores } from './quality';
import { translations, ScannerLanguage } from './translations';

export interface Metadata {
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

interface DocumentScannerProps {
  taskId: string;
  projectUnitId: string;
  instructions: string;
  multiPage?: boolean;
  maxPages?: number;
  language: ScannerLanguage;
  onComplete: (evidenceUrl: string, metadata: Metadata) => void;
  onCancel: () => void;
}

type CaptureMode = 'camera' | 'file';
type Stage = 'entry' | 'processing' | 'warning' | 'preview' | 'review_pages' | 'uploading';

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

  const mod = await import('jscanify');
  const Jscanify = (mod as any).default ?? mod;
  window.jscanify = Jscanify;
  return Jscanify;
}

export default function DocumentScanner({
  taskId,
  projectUnitId,
  instructions,
  multiPage = true,
  maxPages = 10,
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
      await finalizeUpload([...pages, currentPage]);
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

  const uploadBlob = async (path: string, blob: Blob, contentType: string): Promise<string> => {
    const { error: uploadError } = await supabase.storage.from('project-evidence').upload(path, blob, {
      contentType,
      upsert: false,
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('project-evidence').getPublicUrl(path);
    return data.publicUrl;
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

  const finalizeUpload = async (inputPages: CapturedPage[]) => {
    if (inputPages.length === 0) {
      return;
    }

    setStage('uploading');
    setError('');

    const timestamp = Date.now();
    const basePath = `uploads/${projectUnitId}/${taskId}`;

    try {
      await Promise.all(
        inputPages.map((page, index) =>
          uploadBlob(`${basePath}/${timestamp}_page_${index + 1}.jpeg`, page.blob, 'image/jpeg')
        )
      );

      let finalUrl = '';
      let format: 'pdf' | 'jpeg' = 'jpeg';

      if (inputPages.length === 1) {
        finalUrl = await uploadBlob(`${basePath}/${timestamp}_combined.jpeg`, inputPages[0].blob, 'image/jpeg');
      } else {
        const pdfBlob = await buildPdf(inputPages);
        finalUrl = await uploadBlob(`${basePath}/${timestamp}_combined.pdf`, pdfBlob, 'application/pdf');
        format = 'pdf';
      }

      const qualityFlags = Array.from(new Set(inputPages.flatMap((page) => page.qualityFlags)));
      const qualityScores = averageScores(inputPages);
      const metadata: Metadata = {
        capture_method: inputPages.some((page) => page.captureMethod === 'scanner') ? 'scanner' : 'file_upload',
        page_count: inputPages.length,
        quality_flags: qualityFlags,
        quality_scores: qualityScores,
        format,
        heic_converted: inputPages.some((page) => page.heicConverted),
      };

      const { error: completionError } = await supabase
        .from('task_completions')
        .update({
          status: 'complete',
          evidence_url: finalUrl,
          completed_by: 'tenant',
          completed_at: new Date().toISOString(),
          evidence_metadata: metadata,
        })
        .eq('project_unit_id', projectUnitId)
        .eq('project_task_id', taskId);

      if (completionError) {
        throw completionError;
      }

      onComplete(finalUrl, metadata);
    } catch {
      setError(t.uploadError);
      setStage(inputPages.length > 1 ? 'review_pages' : 'preview');
    }
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        capture={captureMode === 'camera' ? 'environment' : undefined}
        className="hidden"
        onChange={handleFileSelect}
      />

      {stage === 'entry' && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.instructionsTitle}</h3>
          <p className="text-sm text-[var(--ink)] leading-relaxed">{instructions}</p>
          <button
            type="button"
            onClick={() => openCaptureInput('camera')}
            className="w-full min-h-12 bg-[var(--primary)] text-white px-4 py-4 rounded-none text-base font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
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
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
          >
            {t.cancel}
          </button>
        </div>
      )}

      {stage === 'processing' && (
        <div className="py-8 text-center text-sm text-[var(--muted)]">{t.processing}</div>
      )}

      {stage === 'warning' && currentPage && (
        <div className="space-y-4">
          <img src={currentPage.previewUrl} alt="Scanned preview" className="w-full border border-[var(--border)] rounded-none" />
          <div className="bg-[var(--bg-section)] border border-[var(--warning)]/30 p-3 rounded-none space-y-2">
            {warningMessages.map((message) => (
              <p key={message} className="text-sm text-[var(--ink)]">
                {message}
              </p>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetCurrentPage();
                setStage('entry');
              }}
              className="flex-1 min-h-12 bg-[var(--primary)] text-white px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
            >
              {t.retake}
            </button>
            <button
              type="button"
              onClick={() => {
                setQualityOverride(true);
                setStage('preview');
              }}
              className="flex-1 min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
            >
              {t.useAnyway}
            </button>
          </div>
        </div>
      )}

      {stage === 'preview' && currentPage && (
        <div className="space-y-4">
          <h3 className="font-serif text-lg text-[var(--primary)]">{t.previewTitle}</h3>
          <img src={currentPage.previewUrl} alt="Preview" className="w-full border border-[var(--border)] rounded-none" />
          {!qualityOverride && currentPage.qualityFlags.length > 0 && (
            <p className="text-xs text-[var(--muted)]">{t.scannerError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                resetCurrentPage();
                setStage('entry');
              }}
              className="flex-1 min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
            >
              {t.retake}
            </button>
            <button
              type="button"
              onClick={commitCurrentPage}
              className="flex-1 min-h-12 bg-[var(--primary)] text-white px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200"
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
                onClick={() => setStage('entry')}
                className="w-full min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
              >
                {t.addPage}
              </button>
            )}
            <button
              type="button"
              onClick={() => finalizeUpload(pages)}
              disabled={pages.length === 0}
              className="w-full min-h-12 bg-[var(--primary)] text-white px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--primary-light)] transition-colors duration-200 disabled:opacity-50"
            >
              {t.submit}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="w-full min-h-12 border border-[var(--border)] text-[var(--ink)] px-4 py-3 rounded-none text-sm font-medium hover:bg-[var(--bg-section)] transition-colors duration-200"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {stage === 'uploading' && <div className="py-8 text-center text-sm text-[var(--muted)]">{t.uploading}</div>}

      {error && <p className="text-sm text-[var(--error)]">{error}</p>}
    </div>
  );
}
