'use client';

/**
 * app/pbv-full-app/[token]/documents/page.tsx
 *
 * Tenant document upload page (PRD-42 + PRD-44).
 * Replaced directory view with card stack for mobile-first linear flow.
 * PRD-44: Mid-flow re-entry, review screen, and signing handoff.
 */

import { use } from 'react';
import { useState, useCallback, useEffect } from 'react';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import DocumentCardStack, { type DocumentCardData } from '@/components/pbv/cards/DocumentCardStack';
import AlmostDoneReview from '@/components/pbv/cards/AlmostDoneReview';
import ReEntryToast from '@/components/pbv/cards/ReEntryToast';
import { useCardAnalytics } from '@/lib/pbv/cards/useCardAnalytics';
import {
  classifyReEntry,
  findNextMissingCardIndex,
  findCardIndexById,
  type ReEntryState,
} from '@/lib/pbv/cards/classifyReEntry';
import type { PreferredLanguage } from '@/types/compliance';
import type { ScannerMetadata } from '@/components/DocumentScanner/DocumentScanner';

type PageView =
  | { kind: 'loading' }
  | { kind: 'card_stack'; initialIndex: number; showToast: ReEntryState['kind'] | null }
  | { kind: 'review' }
  | { kind: 'submitted' }
  | { kind: 'error'; message: string };

interface Props {
  params: Promise<{ token: string }>;
}

export default function DocumentsPage({ params }: Props) {
  const { token } = use(params);
  const { state } = useIntakeBootstrap(token);
  const [documents, setDocuments] = useState<DocumentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packetLocked, setPacketLocked] = useState(false);
  const [pageView, setPageView] = useState<PageView>({ kind: 'loading' });
  const [retakeDocId, setRetakeDocId] = useState<string | null>(null);

  // Fetch documents from API
  const fetchDocuments = useCallback(async (lang: PreferredLanguage = 'en') => {
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/t/${token}/pbv-full-app/documents?language=${lang}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Documents not found');
        }
        if (response.status === 403) {
          throw new Error('Access expired. Please contact the office.');
        }
        throw new Error('Failed to load documents');
      }

      const result = await response.json();

      if (result.success && result.data?.documents) {
        setDocuments(result.data.documents);
        setPacketLocked(result.data?.packet_locked ?? false);
      } else {
        throw new Error(result.message || 'Failed to load documents');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load documents';
      setError(message);
      console.error('[DocumentsPage] Error fetching documents:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch - wait for bootstrap to resolve language
  useEffect(() => {
    if (state.status === 'ready') {
      const lang = (state.data.preferred_language ?? 'en') as PreferredLanguage;
      fetchDocuments(lang);
    }
  }, [state.status, state.data?.preferred_language]);

  // Handle upload
  const handleUpload = useCallback(
    async (docId: string, file: File, _metadata?: ScannerMetadata) => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/t/${token}/pbv-full-app/documents/${docId}/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Upload failed');
      }

      // Refresh documents to get updated state
      const lang = (state.data?.preferred_language ?? 'en') as PreferredLanguage;
      await fetchDocuments(lang);
    },
    [token, fetchDocuments, state.data?.preferred_language]
  );

  // Navigate to dashboard
  const handleComplete = useCallback(() => {
    window.location.href = `/pbv-full-app/${token}/dashboard`;
  }, [token]);

  // Navigate to signing flow (PRD-44 F2 handoff)
  const handleProceedToSign = useCallback(() => {
    // Navigate to the signing flow
    // The signer page is at /pbv-full-app/signer/[member_token]
    // We need to fetch the member token for the head of household
    window.location.href = `/pbv-full-app/${token}/sign`;
  }, [token]);

  // Navigate to review screen
  const handleGoToReview = useCallback(() => {
    setPageView({ kind: 'review' });
  }, []);

  // Handle retake from review screen
  const handleRetakeFromReview = useCallback((docId: string) => {
    setRetakeDocId(docId);
    setPageView({ kind: 'card_stack', initialIndex: findCardIndexById(documents, docId), showToast: null });
  }, [documents]);

  // Handle back to cards from review
  const handleBackToCards = useCallback(() => {
    // Go back to card stack at the last card or first missing
    const lastIndex = documents.length - 1;
    setPageView({ kind: 'card_stack', initialIndex: lastIndex, showToast: null });
  }, [documents.length]);

  const language: PreferredLanguage = (state.data?.preferred_language ?? 'en') as PreferredLanguage;
  const firstName = state.data?.first_name ?? 'there';
  const applicationId = state.data?.application_id ?? '';

  // Determine page view based on re-entry classification (PRD-44 F1)
  useEffect(() => {
    if (state.status !== 'ready' || loading || documents.length === 0) return;

    const isSubmitted = !!state.data?.submitted_at;

    const reEntryState = classifyReEntry({
      documents,
      isSubmitted,
    });

    switch (reEntryState.kind) {
      case 'first_visit':
        setPageView({ kind: 'card_stack', initialIndex: 0, showToast: null });
        break;

      case 'mid_flow':
        setPageView({
          kind: 'card_stack',
          initialIndex: findNextMissingCardIndex(documents),
          showToast: 'mid_flow',
        });
        break;

      case 'rejection_pending':
        setPageView({
          kind: 'card_stack',
          initialIndex: findCardIndexById(documents, reEntryState.rejectedDocId),
          showToast: 'rejection_pending',
        });
        break;

      case 'all_complete_pending_submit':
        setPageView({ kind: 'review' });
        break;

      case 'submitted':
        // PRD-20 territory - tenant already submitted
        // Fall through to dashboard or show submitted state
        setPageView({ kind: 'submitted' });
        break;
    }
  }, [state.status, state.data?.submitted_at, documents, loading]);

  // Create analytics hook factory
  const useAnalytics = () => useCardAnalytics({ token, applicationId });

  // Render loading state
  if (state.status === 'loading' || loading || pageView.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  // Render error state
  if (state.status === 'error' || error || pageView.kind === 'error') {
    const message =
      state.status === 'error' ? state.message : error ?? pageView.kind === 'error' ? pageView.message : 'Something went wrong';
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <p className="text-sm text-[var(--error)]">{message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Render submitted state (PRD-20 territory)
  if (pageView.kind === 'submitted') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl">✓</div>
          <h1
            className="text-2xl font-normal text-[var(--primary)]"
            style={{ fontFamily: 'Libre Baskerville, serif' }}
          >
            {language === 'es'
              ? '¡Solicitud enviada!'
              : language === 'pt'
              ? 'Inscrição enviada!'
              : 'Application submitted!'}
          </h1>
          <p className="text-sm text-[var(--body)]">
            {language === 'es'
              ? 'Su solicitud ha sido recibida. Nos pondremos en contacto con usted pronto.'
              : language === 'pt'
              ? 'Sua inscrição foi recebida. Entraremos em contato em breve.'
              : 'Your application has been received. We will contact you soon.'}
          </p>
          <button
            onClick={handleComplete}
            className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            {language === 'es'
              ? 'Ir al panel'
              : language === 'pt'
              ? 'Ir ao painel'
              : 'Go to dashboard'}
          </button>
        </div>
      </div>
    );
  }

  // Render review screen
  if (pageView.kind === 'review') {
    return (
      <AlmostDoneReview
        token={token}
        firstName={firstName}
        documents={documents}
        language={language}
        onProceedToSign={handleProceedToSign}
        onRetake={handleRetakeFromReview}
        onBackToCards={handleBackToCards}
      />
    );
  }

  // Render card stack (default)
  return (
    <>
      {/* Re-entry toast for mid-flow and rejection re-entry */}
      {pageView.kind === 'card_stack' && pageView.showToast && (
        <ReEntryToast
          variant={pageView.showToast === 'rejection_pending' ? 'rejection_pending' : 'mid_flow'}
          language={language}
        />
      )}

      <DocumentCardStack
        token={token}
        firstName={firstName}
        initialDocuments={documents}
        language={language}
        packetLocked={packetLocked}
        onUpload={handleUpload}
        onRefresh={fetchDocuments}
        onComplete={handleComplete}
        onProceedToSign={handleProceedToSign}
        onGoToReview={handleGoToReview}
        initialCardIndex={pageView.kind === 'card_stack' ? pageView.initialIndex : 0}
        skipLanding={pageView.kind === 'card_stack' && pageView.initialIndex > 0}
        useAnalytics={useAnalytics}
      />
    </>
  );
}
