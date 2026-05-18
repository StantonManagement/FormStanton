'use client';

/**
 * DocumentCardStack.tsx
 *
 * Orchestrates the document card sequence (PRD-42).
 * Manages landing → card sequence → end screen flow.
 *
 * Features:
 * - Landing screen (F1)
 * - Card sequence with navigation (F2, F3)
 * - Deferred document reordering (F4)
 * - End screen (F9 - simplified for Phase 1)
 * - Sidesheet placeholder (F6 - Phase 3)
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import DocumentCardStackLanding from './DocumentCardStackLanding';
import DocumentCard, { type DocumentCardData } from './DocumentCard';
export type { DocumentCardData } from './DocumentCard';
import type { SupportedLanguage } from '@/lib/pbv/cards/docContent';
import type { ScannerMetadata } from '@/components/DocumentScanner/DocumentScanner';

type StackStage = 'landing' | 'card' | 'end' | 'review';

export interface DocumentStackItem extends DocumentCardData {
  /** Deferred docs are moved to end of queue */
  is_deferred: boolean;
  /** Order in the current queue (changes as docs are deferred) */
  queue_position: number;
  /** Display order for sorting */
  display_order?: number | null;
}

interface DocumentCardStackProps {
  /** Application token */
  token: string;
  /** Tenant's first name */
  firstName: string;
  /** Documents from API */
  initialDocuments: DocumentCardData[];
  /** Preferred language */
  language: SupportedLanguage;
  /** Whether packet is locked for review */
  packetLocked: boolean;
  /** Upload handler */
  onUpload: (docId: string, file: File, metadata?: ScannerMetadata) => Promise<void>;
  /** Refresh documents from server */
  onRefresh: () => Promise<void>;
  /** Navigate to dashboard */
  onComplete: () => void;
  /** Optional analytics hook */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useAnalytics?: () => { emit: (eventType: any, payload: Record<string, unknown>) => void };
  /** Start at specific card index (for re-entry) */
  initialCardIndex?: number;
  /** Skip landing screen and go straight to cards */
  skipLanding?: boolean;
  /** Show re-entry toast on mount */
  reEntryToast?: 'mid_flow' | 'rejection_pending' | null;
  /** Navigate to signing flow (for review screen handoff) */
  onProceedToSign?: () => void;
  /** Navigate to review screen */
  onGoToReview?: () => void;
}

const translations = {
  en: {
    allDoneTitle: (name: string) => `Great work, ${name}.`,
    allDoneSubtitle: 'You uploaded all your documents.',
    nextStep: 'Next: review and submit.',
    someDeferredTitle: (name: string) => `Great work, ${name}.`,
    someDeferredSubtitle: (uploaded: number, total: number) =>
      `You uploaded ${uploaded} of ${total} documents.`,
    stillNeeded: 'Still needed:',
    reminderNote: "We'll text you in 3 days. Your link works anytime until you're done.",
    ctaDone: 'Got it, done',
    ctaDashboard: 'Go to dashboard →',
    callHelp: 'Need help? Call',
    processing: 'Processing...',
  },
  es: {
    allDoneTitle: (name: string) => `Excelente trabajo, ${name}.`,
    allDoneSubtitle: 'Subió todos sus documentos.',
    nextStep: 'Siguiente: revisar y enviar.',
    someDeferredTitle: (name: string) => `Excelente trabajo, ${name}.`,
    someDeferredSubtitle: (uploaded: number, total: number) =>
      `Subió ${uploaded} de ${total} documentos.`,
    stillNeeded: 'Todavía necesario:',
    reminderNote: 'Le enviaremos un mensaje en 3 días. Su enlace funciona en cualquier momento hasta que termine.',
    ctaDone: 'Entendido, listo',
    ctaDashboard: 'Ir al panel →',
    callHelp: '¿Necesita ayuda? Llame al',
    processing: 'Procesando...',
  },
  pt: {
    allDoneTitle: (name: string) => `Ótimo trabalho, ${name}.`,
    allDoneSubtitle: 'Você enviou todos os seus documentos.',
    nextStep: 'Próximo: revisar e enviar.',
    someDeferredTitle: (name: string) => `Ótimo trabalho, ${name}.`,
    someDeferredSubtitle: (uploaded: number, total: number) =>
      `Você enviou ${uploaded} de ${total} documentos.`,
    stillNeeded: 'Ainda necessário:',
    reminderNote: 'Enviaremos uma mensagem em 3 dias. Seu link funciona a qualquer momento até terminar.',
    ctaDone: 'Entendido, concluído',
    ctaDashboard: 'Ir ao painel →',
    callHelp: 'Precisa de ajuda? Ligue para',
    processing: 'Processando...',
  },
} as const;

export default function DocumentCardStack({
  token,
  firstName,
  initialDocuments,
  language,
  packetLocked,
  onUpload,
  onRefresh,
  onComplete,
  useAnalytics,
  initialCardIndex = 0,
  skipLanding = false,
  onProceedToSign,
  onGoToReview,
}: DocumentCardStackProps) {
  const t = translations[language];
  const { emit: emitAnalytics } = useAnalytics?.() ?? { emit: () => {} };

  const [stage, setStage] = useState<StackStage>(skipLanding ? 'card' : 'landing');
  const [currentCardIndex, setCurrentCardIndex] = useState(initialCardIndex);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Check for reduced motion preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Build initial queue with deferred docs at end
  const [documentQueue, setDocumentQueue] = useState<DocumentStackItem[]>(() => {
    const withQueueData: DocumentStackItem[] = initialDocuments.map((doc, index) => ({
      ...doc,
      is_deferred: doc.is_deferred ?? false,
      queue_position: index,
      display_order: doc.display_order,
    }));

    // Sort: missing first, then deferred, then completed
    return withQueueData.sort((a, b) => {
      // Rejected docs come first (they need re-upload)
      if (a.status === 'rejected' && b.status !== 'rejected') return -1;
      if (b.status === 'rejected' && a.status !== 'rejected') return 1;

      // Then missing (not deferred)
      if (!a.is_deferred && a.status === 'missing' && (b.is_deferred || b.status !== 'missing')) return -1;
      if (!b.is_deferred && b.status === 'missing' && (a.is_deferred || a.status !== 'missing')) return 1;

      // Then deferred
      if (a.is_deferred && !b.is_deferred) return 1;
      if (b.is_deferred && !a.is_deferred) return -1;

      // Then by display_order if available
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    });
  });

  // Update queue if initialDocuments change (e.g., after refresh)
  useEffect(() => {
    setDocumentQueue((prev) => {
      // Preserve deferred state from previous queue
      const deferredIds = new Set(prev.filter((d) => d.is_deferred).map((d) => d.id));

      const updated: DocumentStackItem[] = initialDocuments.map((doc, index) => ({
        ...doc,
        is_deferred: deferredIds.has(doc.id) || doc.is_deferred || false,
        queue_position: index,
        display_order: doc.display_order,
      }));

      // Re-sort
      return updated.sort((a, b) => {
        if (a.status === 'rejected' && b.status !== 'rejected') return -1;
        if (b.status === 'rejected' && a.status !== 'rejected') return 1;
        if (!a.is_deferred && a.status === 'missing' && (b.is_deferred || b.status !== 'missing')) return -1;
        if (!b.is_deferred && b.status === 'missing' && (a.is_deferred || a.status !== 'missing')) return 1;
        if (a.is_deferred && !b.is_deferred) return 1;
        if (b.is_deferred && !a.is_deferred) return -1;
        return (a.display_order ?? 0) - (b.display_order ?? 0);
      });
    });
  }, [initialDocuments]);

  // Stats
  const stats = useMemo(() => {
    const total = documentQueue.length;
    const uploaded = documentQueue.filter(
      (d) => d.status === 'submitted' || d.status === 'approved'
    ).length;
    const deferred = documentQueue.filter((d) => d.is_deferred).length;
    const missing = documentQueue.filter((d) => d.status === 'missing').length;
    const rejected = documentQueue.filter((d) => d.status === 'rejected').length;
    return { total, uploaded, deferred, missing, rejected };
  }, [documentQueue]);

  // Current document
  const currentDoc = documentQueue[currentCardIndex];

  // Remaining missing docs (for end screen)
  const remainingDocs = useMemo(
    () => documentQueue.filter((d) => d.status === 'missing' || d.status === 'rejected'),
    [documentQueue]
  );

  // Handlers
  const handleStart = useCallback(() => {
    emitAnalytics('DOCUMENT_STACK_STARTED', {
      total_docs: stats.total,
      deferred_docs: stats.deferred,
    });
    setStage('card');
  }, [stats, emitAnalytics]);

  const handleSeeFullList = useCallback(() => {
    // F6: Sidesheet - Phase 3
    // For now, just emit analytics and show alert
    emitAnalytics('DOCUMENT_SIDESHEET_OPENED', {
      from_stage: stage,
    });
    alert('Sidesheet coming in Phase 3 (F6)');
  }, [emitAnalytics, stage]);

  const handleNext = useCallback(() => {
    if (currentCardIndex < documentQueue.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
    } else {
      // All cards complete - check if we should go to review screen (PRD-44)
      if (onGoToReview && remainingDocs.length === 0) {
        // Show celebration state briefly before transitioning
        setShowCelebration(true);
        emitAnalytics('DOCUMENT_UPLOADS_COMPLETE', {
          total_docs: stats.total,
          uploaded_docs: stats.uploaded,
        });

        // Transition to review after brief celebration (1s)
        setTimeout(() => {
          setShowCelebration(false);
          onGoToReview();
        }, reducedMotion ? 0 : 1000);
      } else {
        setStage('end');
      }
    }
  }, [
    currentCardIndex,
    documentQueue.length,
    onGoToReview,
    remainingDocs.length,
    emitAnalytics,
    stats.total,
    stats.uploaded,
    reducedMotion,
  ]);

  const handleBack = useCallback(() => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex((prev) => prev - 1);
    }
  }, [currentCardIndex]);

  const handleDefer = useCallback(
    async (docId: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Call defer endpoint (F4 - Phase 3)
        const response = await fetch(
          `/api/t/${token}/pbv-full-app/documents/${docId}/defer`,
          { method: 'POST' }
        );

        if (!response.ok) {
          // If endpoint doesn't exist yet (PRD-43 not shipped), just client-side defer
          if (response.status === 404) {
            // Client-side defer only
            setDocumentQueue((prev) => {
              const updated: DocumentStackItem[] = prev.map((d) =>
                d.id === docId ? { ...d, is_deferred: true, display_order: d.display_order } : d
              );
              // Re-sort: move deferred to end
              return updated.sort((a, b) => {
                if (a.status === 'rejected' && b.status !== 'rejected') return -1;
                if (b.status === 'rejected' && a.status !== 'rejected') return 1;
                if (!a.is_deferred && a.status === 'missing' && (b.is_deferred || b.status !== 'missing'))
                  return -1;
                if (!b.is_deferred && b.status === 'missing' && (a.is_deferred || a.status !== 'missing'))
                  return 1;
                if (a.is_deferred && !b.is_deferred) return 1;
                if (b.is_deferred && !a.is_deferred) return -1;
                return (a.display_order ?? 0) - (b.display_order ?? 0);
              });
            });

            emitAnalytics('DOCUMENT_CARD_DEFERRED', {
              doc_id: docId,
              client_only: true,
            });

            // Advance to next card
            handleNext();
            return;
          }
          throw new Error('Failed to defer document');
        }

        // Server defer successful
        await onRefresh();
        handleNext();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to defer');
        // Still client-side defer as fallback
        setDocumentQueue((prev) =>
          prev.map((d) => (d.id === docId ? { ...d, is_deferred: true } : d))
        );
        handleNext();
      } finally {
        setIsProcessing(false);
      }
    },
    [token, emitAnalytics, handleNext, onRefresh]
  );

  const handleDeactivate = useCallback(
    async (docId: string) => {
      setIsProcessing(true);
      setError(null);

      try {
        // Call deactivate endpoint (F5)
        const response = await fetch(
          `/api/t/${token}/pbv-full-app/documents/${docId}/deactivate`,
          { method: 'POST' }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // Client-side only - remove from queue
            setDocumentQueue((prev) => prev.filter((d) => d.id !== docId));
            emitAnalytics('DOCUMENT_CARD_DEACTIVATED', {
              doc_id: docId,
              client_only: true,
            });
            return;
          }
          throw new Error('Failed to deactivate document');
        }

        await onRefresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate');
        // Client-side fallback
        setDocumentQueue((prev) => prev.filter((d) => d.id !== docId));
      } finally {
        setIsProcessing(false);
      }
    },
    [token, emitAnalytics, onRefresh]
  );

  const handleUploadWithRefresh = useCallback(
    async (docId: string, file: File, metadata?: ScannerMetadata) => {
      await onUpload(docId, file, metadata);
      // Update local state to reflect upload
      setDocumentQueue((prev) =>
        prev.map((d) =>
          d.id === docId
            ? {
                ...d,
                status: 'submitted' as const,
                current_revision: d.current_revision + 1,
              }
            : d
        )
      );
    },
    [onUpload]
  );

  // Celebration overlay (PRD-44 F3)
  if (showCelebration) {
    return (
      <div
        className="
          min-h-screen bg-[var(--paper)]
          flex flex-col items-center justify-center
          px-4
        "
      >
        <div className="text-center space-y-4">
          <div
            className="text-6xl mb-4"
            style={{
              animation: reducedMotion ? 'none' : 'celebrationBounce 500ms ease-out',
            }}
          >
            ✓
          </div>
          <h2
            className="text-2xl font-normal text-[var(--primary)]"
            style={{ fontFamily: 'Libre Baskerville, serif' }}
          >
            {language === 'es'
              ? '¡Documentos completos!'
              : language === 'pt'
              ? 'Documentos completos!'
              : 'Documents complete!'}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {language === 'es'
              ? 'Preparando revisión...'
              : language === 'pt'
              ? 'Preparando revisão...'
              : 'Preparing review...'}
          </p>
        </div>

      </div>
    );
  }

  // Render landing
  if (stage === 'landing') {
    return (
      <DocumentCardStackLanding
        firstName={firstName}
        documentCount={stats.total}
        uploadedCount={stats.uploaded}
        deferredCount={stats.deferred}
        language={language}
        onStart={handleStart}
        onSeeFullList={handleSeeFullList}
      />
    );
  }

  // Render end screen (F9 - simplified for Phase 1)
  if (stage === 'end') {
    const allUploaded = remainingDocs.length === 0;

    return (
      <div
        className="min-h-screen bg-[var(--paper)] flex flex-col justify-center px-4 py-6"
        style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
      >
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="space-y-2">
            <h1
              className="text-2xl font-normal text-[var(--ink)] leading-tight"
              style={{ fontFamily: 'Libre Baskerville, serif' }}
            >
              {allUploaded
                ? t.allDoneTitle(firstName)
                : t.someDeferredTitle(firstName)}
            </h1>
            <p className="text-lg text-[var(--ink)] leading-snug">
              {allUploaded
                ? t.allDoneSubtitle
                : t.someDeferredSubtitle(stats.uploaded, stats.total)}
            </p>
          </div>

          {allUploaded ? (
            <p className="text-base text-[var(--muted)]">{t.nextStep}</p>
          ) : (
            <>
              <div className="bg-[var(--bg-section)] border border-[var(--border)] p-4">
                <p className="text-sm font-medium text-[var(--ink)] mb-2">{t.stillNeeded}</p>
                <ul className="space-y-1">
                  {remainingDocs.slice(0, 5).map((doc) => (
                    <li key={doc.id} className="text-sm text-[var(--muted)]">
                      • {doc.label}
                      {doc.person_name ? ` (${doc.person_name})` : ''}
                    </li>
                  ))}
                  {remainingDocs.length > 5 && (
                    <li className="text-sm text-[var(--muted)] italic">
                      ...and {remainingDocs.length - 5} more
                    </li>
                  )}
                </ul>
              </div>
              <p className="text-sm text-[var(--muted)] italic">{t.reminderNote}</p>
            </>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <button
              type="button"
              onClick={onComplete}
              disabled={isProcessing}
              className="
                w-full min-h-[48px] px-4 py-3
                bg-[var(--primary)] text-white
                text-base font-medium
                rounded-none
                hover:opacity-90
                transition-opacity duration-200 ease-out
                disabled:opacity-50
              "
              style={{ touchAction: 'manipulation' }}
            >
              {isProcessing ? t.processing : t.ctaDashboard}
            </button>

            {!allUploaded && (
              <button
                type="button"
                onClick={() => {
                  setStage('card');
                  setCurrentCardIndex(0);
                }}
                className="
                  w-full min-h-[44px] px-4 py-2
                  bg-transparent text-[var(--primary)]
                  text-sm font-medium
                  rounded-none
                  hover:bg-[var(--bg-section)]
                  transition-colors duration-200
                "
                style={{ touchAction: 'manipulation' }}
              >
                {t.ctaDone}
              </button>
            )}
          </div>

          {/* Help phone number */}
          <p className="text-sm text-[var(--muted)] text-center pt-4">
            {t.callHelp}{' '}
            <a href="tel:+12035551234" className="text-[var(--primary)] underline">
              (203) 555-1234
            </a>
          </p>

          {/* PRD-44: Review screen CTA when all docs uploaded */}
          {allUploaded && onGoToReview && (
            <button
              type="button"
              onClick={onGoToReview}
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
              {language === 'es'
                ? 'Revisar y firmar →'
                : language === 'pt'
                ? 'Revisar e assinar →'
                : 'Review and sign →'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Render card
  if (!currentDoc) {
    // Shouldn't happen, but handle gracefully
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)]">No documents remaining.</p>
      </div>
    );
  }

  return (
    <DocumentCard
      document={currentDoc}
      cardIndex={currentCardIndex + 1}
      totalCards={documentQueue.length}
      language={language}
      token={token}
      onUpload={handleUploadWithRefresh}
      onNext={handleNext}
      onBack={handleBack}
      onDefer={handleDefer}
      onDeactivate={handleDeactivate}
      onAnalytics={emitAnalytics}
    />
  );
}
