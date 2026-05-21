'use client';

/**
 * DocumentCard.tsx
 *
 * F2 — One document per full-viewport card.
 * F3 — Post-upload state with multi-file bundling.
 *
 * Mobile-first: one viewport on iPhone SE (375x667), no scroll.
 * Primary action: DocumentScanner (camera). Secondary: file upload.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { getDocContent, getDocTitle, getDocDescription, isMultiFileDoc, getMaxFiles, type SupportedLanguage } from '@/lib/pbv/cards/docContent';
import type { ScannerMetadata } from '@/components/DocumentScanner/DocumentScanner';

const DocumentScanner = dynamic(
  () => import('@/components/DocumentScanner/DocumentScanner'),
  { ssr: false }
);

export interface DocumentCardData {
  id: string;
  doc_type: string;
  label: string;
  required: boolean;
  person_slot: number;
  status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
  rejection_reason: string | null;
  rejection_reason_display: string | null;
  current_revision: number;
  file_url: string | null;
  /** Person name from household data (F8) */
  person_name?: string | null;
  /** Whether this doc is deferred */
  is_deferred?: boolean;
  /** Display order for sorting */
  display_order?: number | null;
  /** PRD-58: DB category for document grouping */
  category?: string | null;
}

interface DocumentCardProps {
  /** Document data */
  document: DocumentCardData;
  /** Card position (1-based) */
  cardIndex: number;
  /** Total cards in stack */
  totalCards: number;
  /** Preferred language */
  language: SupportedLanguage;
  /** Application token for uploads */
  token: string;
  /** Upload handler */
  onUpload: (docId: string, file: File, metadata?: ScannerMetadata) => Promise<void>;
  /** Advance to next card */
  onNext: () => void;
  /** Go back to previous card */
  onBack: () => void;
  /** Defer this card */
  onDefer: (docId: string) => void;
  /** Deactivate ("doesn't apply") this card */
  onDeactivate?: (docId: string) => void;
  /** Analytics event emitter */
  onAnalytics?: (eventType: string, payload: Record<string, unknown>) => void;
}

type CardStage = 'upload' | 'scanner' | 'success' | 'rejected';

const translations = {
  en: {
    takePhoto: 'Take photo',
    uploadFile: 'Upload file',
    illGetThisLater: "I'll get this later",
    doesntApply: "Doesn't apply to me",
    forPerson: (name: string) => `For ${name}`,
    forPersonSlot: (slot: number) => `Person ${slot}`,
    uploaded: 'Uploaded',
    addAnother: 'Add another',
    retake: 'Retake',
    next: 'Next →',
    needsRedo: 'This one needs a redo.',
    tryAgain: 'Try again.',
    uploading: 'Uploading...',
    viewFile: 'View file',
    replace: 'Replace',
  },
  es: {
    takePhoto: 'Tomar foto',
    uploadFile: 'Subir archivo',
    illGetThisLater: 'Lo conseguiré más tarde',
    doesntApply: 'No aplica para mí',
    forPerson: (name: string) => `Para ${name}`,
    forPersonSlot: (slot: number) => `Persona ${slot}`,
    uploaded: 'Subido',
    addAnother: 'Agregar otro',
    retake: 'Volver a tomar',
    next: 'Siguiente →',
    needsRedo: 'Este necesita volver a hacerse.',
    tryAgain: 'Intente de nuevo.',
    uploading: 'Subiendo...',
    viewFile: 'Ver archivo',
    replace: 'Reemplazar',
  },
  pt: {
    takePhoto: 'Tirar foto',
    uploadFile: 'Enviar arquivo',
    illGetThisLater: 'Vou pegar isso depois',
    doesntApply: 'Não se aplica a mim',
    forPerson: (name: string) => `Para ${name}`,
    forPersonSlot: (slot: number) => `Pessoa ${slot}`,
    uploaded: 'Enviado',
    addAnother: 'Adicionar outro',
    retake: 'Tirar novamente',
    next: 'Próximo →',
    needsRedo: 'Este precisa ser refeito.',
    tryAgain: 'Tente novamente.',
    uploading: 'Enviando...',
    viewFile: 'Ver arquivo',
    replace: 'Substituir',
  },
} as const;

export default function DocumentCard({
  document,
  cardIndex,
  totalCards,
  language,
  token,
  onUpload,
  onNext,
  onBack,
  onDefer,
  onDeactivate,
  onAnalytics,
}: DocumentCardProps) {
  const t = translations[language];
  const [stage, setStage] = useState<CardStage>(() => {
    if (document.status === 'rejected') return 'rejected';
    if (document.status === 'submitted' || document.status === 'approved') return 'success';
    return 'upload';
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUploaded, setJustUploaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoAdvanceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const content = getDocContent(document.doc_type, language);
  const title = content?.title[language] ?? document.label;
  const description = content?.description[language] ?? '';
  const fallback = content?.fallback[language] ?? '';
  const supportsMultiFile = isMultiFileDoc(document.doc_type);

  // Person attribution
  const personAttribution = document.person_name
    ? t.forPerson(document.person_name)
    : document.person_slot > 0
    ? t.forPersonSlot(document.person_slot)
    : null;

  // Track card view analytics
  useEffect(() => {
    onAnalytics?.('DOCUMENT_CARD_VIEWED', {
      doc_type: document.doc_type,
      card_index: cardIndex,
      total_cards: totalCards,
      status: document.status,
    });

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [document.doc_type, cardIndex, totalCards, document.status, onAnalytics]);

  // Handle auto-advance after upload (1.5s delay for single-file docs)
  useEffect(() => {
    if (justUploaded && stage === 'success' && !supportsMultiFile) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        onNext();
      }, 1500);
    }

    return () => {
      if (autoAdvanceTimerRef.current) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [justUploaded, stage, supportsMultiFile, onNext]);

  const handleScannerComplete = useCallback(
    async (file: File, metadata: ScannerMetadata) => {
      setIsUploading(true);
      setError(null);
      onAnalytics?.('DOCUMENT_SCANNER_RETAKE', {
        doc_type: document.doc_type,
        page_count: metadata.page_count,
      });

      try {
        await onUpload(document.id, file, metadata);
        setStage('success');
        setJustUploaded(true);
        onAnalytics?.('DOCUMENT_UPLOAD_SUCCESS', {
          doc_type: document.doc_type,
          upload_method: 'scanner',
          page_count: metadata.page_count,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        onAnalytics?.('DOCUMENT_UPLOAD_FAILED', {
          doc_type: document.doc_type,
          upload_method: 'scanner',
          error: err instanceof Error ? err.message : 'unknown',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [document.id, document.doc_type, onUpload, onAnalytics]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Reset input so same file can be selected again
      event.target.value = '';

      // Validate file size (25MB)
      if (file.size > 25 * 1024 * 1024) {
        setError(language === 'en' ? 'File too large (max 25MB)' : language === 'es' ? 'Archivo demasiado grande (máx 25MB)' : 'Arquivo muito grande (máx 25MB)');
        return;
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/heic', 'image/heif'];
      if (!allowedTypes.includes(file.type) && !file.name.toLowerCase().endsWith('.heic') && !file.name.toLowerCase().endsWith('.heif')) {
        setError(language === 'en' ? 'Invalid file type' : language === 'es' ? 'Tipo de archivo inválido' : 'Tipo de arquivo inválido');
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        await onUpload(document.id, file);
        setStage('success');
        setJustUploaded(true);
        onAnalytics?.('DOCUMENT_UPLOAD_SUCCESS', {
          doc_type: document.doc_type,
          upload_method: 'file_upload',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        onAnalytics?.('DOCUMENT_UPLOAD_FAILED', {
          doc_type: document.doc_type,
          upload_method: 'file_upload',
          error: err instanceof Error ? err.message : 'unknown',
        });
      } finally {
        setIsUploading(false);
      }
    },
    [document.id, document.doc_type, language, onUpload, onAnalytics]
  );

  const handleDefer = useCallback(() => {
    onAnalytics?.('DOCUMENT_CARD_DEFERRED', {
      doc_type: document.doc_type,
      card_index: cardIndex,
    });
    onDefer(document.id);
  }, [document.id, document.doc_type, cardIndex, onDefer, onAnalytics]);

  const handleDeactivate = useCallback(() => {
    if (confirm(language === 'en' ? 'Are you sure? You can change this back from "See full list".' : language === 'es' ? '¿Está seguro? Puede cambiar esto desde "Ver lista completa".' : 'Tem certeza? Você pode alterar isso em "Ver lista completa".')) {
      onDeactivate?.(document.id);
    }
  }, [document.id, language, onDeactivate]);

  const handleAddAnother = useCallback(() => {
    setStage('scanner');
    onAnalytics?.('DOCUMENT_SCANNER_OPENED', {
      doc_type: document.doc_type,
      mode: 'append',
    });
  }, [document.doc_type, onAnalytics]);

  const handleRetake = useCallback(() => {
    setStage('scanner');
    setJustUploaded(false);
    onAnalytics?.('DOCUMENT_SCANNER_OPENED', {
      doc_type: document.doc_type,
      mode: 'retake',
    });
  }, [document.doc_type, onAnalytics]);

  const progressPercent = Math.round((cardIndex / totalCards) * 100);

  // Scanner overlay
  if (stage === 'scanner') {
    return (
      <div className="fixed inset-0 z-50 bg-white">
        <DocumentScanner
          instructions={title}
          multiPage={supportsMultiFile}
          maxPages={getMaxFiles(document.doc_type)}
          language={language}
          onComplete={handleScannerComplete}
          onCancel={() => {
            // Return to appropriate stage based on current state
            if (document.status === 'submitted' || document.status === 'approved') {
              setStage('success');
            } else if (document.status === 'rejected') {
              setStage('rejected');
            } else {
              setStage('upload');
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[var(--paper)] flex flex-col"
      style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header: back, progress, counter */}
      <header className="bg-white border-b border-[var(--border)] px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            disabled={cardIndex <= 1}
            className="
              text-sm text-[var(--primary)] font-medium
              disabled:text-[var(--muted)] disabled:cursor-not-allowed
              hover:opacity-80 transition-opacity duration-200
              min-h-[44px] px-2 -ml-2 flex items-center
            "
            style={{ touchAction: 'manipulation' }}
          >
            ← {language === 'en' ? 'Back' : language === 'es' ? 'Atrás' : 'Voltar'}
          </button>

          {/* Progress bar and counter */}
          <div className="flex-1 mx-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--muted)]">
                {cardIndex} {language === 'en' ? 'of' : language === 'es' ? 'de' : 'de'} {totalCards}
              </span>
              <span className="text-xs text-[var(--muted)]">{progressPercent}%</span>
            </div>
            <div className="h-1 bg-[var(--border)] w-full">
              <div
                className="h-full bg-[var(--primary)] transition-all duration-300 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Spacer to balance layout */}
          <div className="w-16" />
        </div>
      </header>

      {/* Main card content */}
      <main className="flex-1 flex flex-col justify-center px-4 py-4">
        <div className="max-w-lg mx-auto w-full space-y-5">
          {/* Document title */}
          <div className="space-y-1">
            <h2
              className="text-xl font-normal text-[var(--ink)] leading-tight"
              style={{ fontFamily: 'Libre Baskerville, serif' }}
            >
              {title}
            </h2>
            {personAttribution && (
              <p className="text-sm text-[var(--muted)]">{personAttribution}</p>
            )}
          </div>

          {/* Rejection banner (F10) */}
          {stage === 'rejected' && document.rejection_reason_display && (
            <div className="bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700 font-medium">{t.needsRedo}</p>
              <p className="text-sm text-red-600 mt-1">{document.rejection_reason_display}</p>
              <p className="text-sm text-red-600">{t.tryAgain}</p>
            </div>
          )}

          {/* Description */}
          <p className="text-base text-[var(--ink)] leading-relaxed">{description}</p>

          {/* Fallback guidance */}
          <p className="text-sm text-[var(--muted)] italic leading-relaxed">{fallback}</p>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Upload/Success state */}
          {stage === 'upload' && (
            <div className="space-y-3 pt-2">
              {/* Primary: Take photo */}
              <button
                type="button"
                onClick={() => {
                  setStage('scanner');
                  onAnalytics?.('DOCUMENT_SCANNER_OPENED', {
                    doc_type: document.doc_type,
                    mode: 'initial',
                  });
                }}
                disabled={isUploading}
                className="
                  w-full min-h-[48px] px-4 py-3
                  bg-[var(--primary)] text-white
                  text-base font-medium
                  rounded-none
                  hover:opacity-90
                  transition-opacity duration-200 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
                "
                style={{ touchAction: 'manipulation' }}
              >
                {isUploading ? t.uploading : `📷 ${t.takePhoto}`}
              </button>

              {/* Secondary: Upload file */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="
                  w-full min-h-[48px] px-4 py-3
                  bg-white text-[var(--primary)]
                  text-base font-medium
                  rounded-none border-2 border-[var(--primary)]
                  hover:bg-[var(--bg-section)]
                  transition-colors duration-200 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2
                "
                style={{ touchAction: 'manipulation' }}
              >
                {isUploading ? t.uploading : `📎 ${t.uploadFile}`}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,.heic,.heif"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* Tertiary affordances */}
              <div className="flex flex-col items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDefer}
                  className="
                    text-sm text-[var(--muted)]
                    hover:text-[var(--primary)]
                    transition-colors duration-200
                    min-h-[44px] px-2
                  "
                  style={{ touchAction: 'manipulation' }}
                >
                  {t.illGetThisLater}
                </button>

                {onDeactivate && (
                  <button
                    type="button"
                    onClick={handleDeactivate}
                    className="
                      text-sm text-[var(--muted)]
                      hover:text-[var(--primary)]
                      transition-colors duration-200
                      min-h-[44px] px-2
                    "
                    style={{ touchAction: 'manipulation' }}
                  >
                    {t.doesntApply}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Success state (F3) */}
          {stage === 'success' && (
            <div className="space-y-4 pt-2">
              {/* Affirmation */}
              <div className="bg-green-50 border border-green-200 p-4">
                <p className="text-base text-green-800 font-medium">
                  ✓ {t.uploaded}
                </p>
                {document.file_url && (
                  <a
                    href={document.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-green-700 underline mt-1 inline-block hover:opacity-80"
                  >
                    {t.viewFile}
                  </a>
                )}
              </div>

              {/* Multi-file: Add another */}
              {supportsMultiFile && (
                <button
                  type="button"
                  onClick={handleAddAnother}
                  className="
                    w-full min-h-[44px] px-4 py-2
                    bg-white text-[var(--ink)]
                    text-sm font-medium
                    rounded-none border border-[var(--border)]
                    hover:bg-[var(--bg-section)]
                    transition-colors duration-200 ease-out
                  "
                  style={{ touchAction: 'manipulation' }}
                >
                  {t.addAnother}
                </button>
              )}

              {/* Retake option */}
              <button
                type="button"
                onClick={handleRetake}
                className="
                  w-full min-h-[44px] px-4 py-2
                  bg-white text-[var(--muted)]
                  text-sm font-medium
                  rounded-none border border-[var(--border)]
                  hover:bg-[var(--bg-section)]
                  transition-colors duration-200 ease-out
                "
                style={{ touchAction: 'manipulation' }}
              >
                {t.retake}
              </button>

              {/* Next button (for multi-file, or if auto-advance is interrupted) */}
              <button
                type="button"
                onClick={onNext}
                className="
                  w-full min-h-[48px] px-4 py-3
                  bg-[var(--primary)] text-white
                  text-base font-medium
                  rounded-none
                  hover:opacity-90
                  transition-opacity duration-200 ease-out
                "
                style={{ touchAction: 'manipulation' }}
              >
                {t.next}
              </button>
            </div>
          )}

          {/* Rejected state - show upload options again */}
          {stage === 'rejected' && (
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setStage('scanner');
                  onAnalytics?.('DOCUMENT_SCANNER_OPENED', {
                    doc_type: document.doc_type,
                    mode: 'reupload_after_rejection',
                  });
                }}
                className="
                  w-full min-h-[48px] px-4 py-3
                  bg-[var(--primary)] text-white
                  text-base font-medium
                  rounded-none
                  hover:opacity-90
                  transition-opacity duration-200 ease-out
                "
                style={{ touchAction: 'manipulation' }}
              >
                📷 {t.takePhoto}
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="
                  w-full min-h-[48px] px-4 py-3
                  bg-white text-[var(--primary)]
                  text-base font-medium
                  rounded-none border-2 border-[var(--primary)]
                  hover:bg-[var(--bg-section)]
                  transition-colors duration-200 ease-out
                "
                style={{ touchAction: 'manipulation' }}
              >
                📎 {t.uploadFile}
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/*,.heic,.heif"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
