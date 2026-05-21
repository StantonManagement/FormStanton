'use client';

/**
 * app/pbv-full-app/[token]/documents/page.tsx
 *
 * Tenant document upload page (PRD-42 + PRD-44, with PRD-67 navigation +
 * view-all subview).
 *
 * URL search params (PRD-67 Gate 5 / U10):
 *   - ?view=all       — open the view-all-documents subview directly (from
 *                       the dashboard "View my documents" link).
 *   - ?filter=rejected — deep-link from the dashboard's rejected-doc banner
 *                       to the first rejected card.
 *
 * Navigation: router.push (not window.location.href) everywhere except the
 * full-page error fallback, so browser back works across subviews.
 */

import { use } from 'react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useIntakeBootstrap, type BootstrapData } from '@/lib/pbv/hooks/useIntakeBootstrap';
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
import { tenantFetch } from '@/lib/tenantFetch';

type PageView =
  | { kind: 'loading' }
  | { kind: 'card_stack'; initialIndex: number; showToast: ReEntryState['kind'] | null }
  | { kind: 'review' }
  | { kind: 'view_all' }
  | { kind: 'submitted' }
  | { kind: 'error'; message: string };

interface Props {
  params: Promise<{ token: string }>;
}

export default function DocumentsPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get('view');
  const filterParam = searchParams.get('filter');

  const { state } = useIntakeBootstrap(token);
  const [documents, setDocuments] = useState<DocumentCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [packetLocked, setPacketLocked] = useState(false);
  const [pageView, setPageView] = useState<PageView>({ kind: 'loading' });
  const [retakeDocId, setRetakeDocId] = useState<string | null>(null);

  const readyData: BootstrapData | null = state.status === 'ready' ? state.data : null;
  const preferredLanguage = readyData?.preferred_language ?? null;
  const submittedAt = readyData?.submitted_at ?? null;

  const fetchDocuments = useCallback(async (lang: PreferredLanguage = 'en') => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/t/${token}/pbv-full-app/documents?language=${lang}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('Documents not found');
        if (response.status === 403) throw new Error('Access expired. Please contact the office.');
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

  useEffect(() => {
    if (preferredLanguage) {
      fetchDocuments(preferredLanguage as PreferredLanguage);
    }
  }, [preferredLanguage, fetchDocuments]);

  const handleUpload = useCallback(
    async (docId: string, file: File, _metadata?: ScannerMetadata) => {
      const formData = new FormData();
      formData.append('file', file);

      let response: Response;
      try {
        response = await tenantFetch(
          `/api/t/${token}/pbv-full-app/documents/${docId}/upload`,
          { method: 'POST', body: formData }
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          throw new Error('Upload timed out. Check your connection and try again.');
        }
        if (err instanceof TypeError) {
          throw new Error('Connection issue uploading. Please try again.');
        }
        throw err;
      }

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.message || 'Upload failed');
      }
      const lang = (preferredLanguage ?? 'en') as PreferredLanguage;
      await fetchDocuments(lang);
    },
    [token, fetchDocuments, preferredLanguage]
  );

  // PRD-67 navigation: router.push instead of window.location.href so browser
  // back is well-behaved across the tenant flow.
  const handleComplete = useCallback(() => {
    router.push(`/pbv-full-app/${token}/dashboard`);
  }, [router, token]);

  const handleProceedToSign = useCallback(() => {
    router.push(`/pbv-full-app/${token}/sign/summary`);
  }, [router, token]);

  const handleGoToReview = useCallback(() => {
    setPageView({ kind: 'review' });
  }, []);

  const handleGoToViewAll = useCallback(() => {
    setPageView({ kind: 'view_all' });
  }, []);

  const handleRetakeFromReview = useCallback((docId: string) => {
    setRetakeDocId(docId);
    setPageView({ kind: 'card_stack', initialIndex: findCardIndexById(documents, docId), showToast: null });
  }, [documents]);

  const handleBackToCards = useCallback(() => {
    const lastIndex = documents.length - 1;
    setPageView({ kind: 'card_stack', initialIndex: lastIndex, showToast: null });
  }, [documents.length]);

  // PRD-67 U10: honor ?filter=rejected — deep-link to the first rejected card.
  const firstRejectedIndex = useMemo(() => {
    if (filterParam !== 'rejected') return -1;
    return documents.findIndex((d) => d.status === 'rejected');
  }, [documents, filterParam]);

  useEffect(() => {
    if (!readyData || loading || documents.length === 0) return;
    const isSubmitted = !!submittedAt;

    // PRD-67 Step 1: ?view=all wins over the re-entry classifier so the
    // dashboard's "View my documents" link always lands on the view-all
    // subview, even mid-flow.
    if (viewParam === 'all') {
      setPageView({ kind: 'view_all' });
      return;
    }

    // PRD-67 U10: ?filter=rejected jumps to the first rejected card.
    if (filterParam === 'rejected' && firstRejectedIndex >= 0) {
      setPageView({
        kind: 'card_stack',
        initialIndex: firstRejectedIndex,
        showToast: 'rejection_pending',
      });
      return;
    }

    const reEntryState = classifyReEntry({ documents, isSubmitted });
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
        setPageView({ kind: 'submitted' });
        break;
    }
  }, [readyData, submittedAt, documents, loading, viewParam, filterParam, firstRejectedIndex]);

  const language: PreferredLanguage = (preferredLanguage ?? 'en') as PreferredLanguage;
  const firstName = readyData?.head_of_household_name?.split(' ')[0] ?? 'there';
  const applicationId = readyData?.head_of_household_name ?? '';

  const useAnalytics = () => useCardAnalytics({ token, applicationId });

  if (state.status === 'loading' || loading || pageView.kind === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (state.status === 'error' || error || pageView.kind === 'error') {
    const errorMessage = state.status === 'error' ? state.message : null;
    const pageViewMessage = pageView.kind === 'error' ? pageView.message : null;
    const message = errorMessage ?? error ?? pageViewMessage ?? 'Something went wrong';
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

  if (pageView.kind === 'submitted') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <div className="text-5xl">?</div>
          <h1 className="text-2xl font-normal text-[var(--primary)]" style={{ fontFamily: 'Libre Baskerville, serif' }}>
            {language === 'es' ? '¡Solicitud enviada!' : language === 'pt' ? 'Inscrição enviada!' : 'Application submitted!'}
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
            {language === 'es' ? 'Ir al panel' : language === 'pt' ? 'Ir ao painel' : 'Go to dashboard'}
          </button>
        </div>
      </div>
    );
  }

  // PRD-67 Step 1: view-all subview. Reuses AlmostDoneReview's grouped
  // listing. Pre-submission this surface lets the tenant retake any uploaded
  // doc; post-submission AlmostDoneReview is read-only (it filters to
  // uploaded docs and the parent gates the back button to the dashboard).
  if (pageView.kind === 'view_all') {
    return (
      <AlmostDoneReview
        token={token}
        firstName={firstName}
        documents={documents}
        language={language}
        onProceedToSign={handleProceedToSign}
        onRetake={handleRetakeFromReview}
        onBackToCards={handleComplete}
      />
    );
  }

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

  return (
    <>
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
        onGoToViewAll={handleGoToViewAll}
        initialCardIndex={pageView.kind === 'card_stack' ? pageView.initialIndex : 0}
        skipLanding={pageView.kind === 'card_stack' && pageView.initialIndex > 0}
        useAnalytics={useAnalytics}
      />
    </>
  );
}
