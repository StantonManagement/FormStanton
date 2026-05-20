'use client';

/**
 * app/pbv-full-app/[token]/sign/summary/page.tsx
 *
 * PR-2 Fix: Auto-triggers generate-forms if not ready.
 * Prevents raw JSON in iframe by ensuring PDF exists before mounting.
 */

import { use, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import SummaryDocReviewSign from '@/components/pbv/sign/SummaryDocReviewSign';

interface Props {
  params: Promise<{ token: string }>;
}

interface GenerateFormsResponse {
  generated: Array<{ form_id: string; form_document_id: string; status: string; language: string }>;
  skipped: string[];
  total_generated: number;
  language: string;
  summary: {
    generated: boolean;
    language: string;
    template_version: string;
    error: string | null;
  };
}

export default function SummarySignPage({ params }: Props) {
  const { token } = use(params);
  const { state, reload } = useDashboardState(token);
  const router = useRouter();

  // Generation state
  const [genState, setGenState] = useState<
    | { status: 'idle' }
    | { status: 'generating' }
    | { status: 'error'; message: string }
    | { status: 'empty' } // Terminal state: generation attempted but zero forms
  >({ status: 'idle' });

  // One-shot guard: prevent multiple generation attempts per mount
  const generationAttemptedRef = useRef(false);

  // Auto-trigger generate-forms if forms not ready (one-shot)
  const maybeGenerateForms = useCallback(async () => {
    if (state.status !== 'ready') return;

    // One-shot guard: already attempted this mount
    if (generationAttemptedRef.current) return;

    const { data } = state;

    // If we already have forms, no need to generate
    if (data.forms.length > 0) return;

    // If intake not complete, can't generate forms yet
    if (data.intake_status !== 'complete') {
      router.push(`/pbv-full-app/${token}/dashboard`);
      return;
    }

    // Forms don't exist but intake is complete — auto-trigger generation
    generationAttemptedRef.current = true;
    setGenState({ status: 'generating' });

    try {
      const res = await fetch(`/api/t/${token}/pbv-full-app/generate-forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Failed to generate forms');
      }

      const result = (await res.json()) as { data: GenerateFormsResponse };

      // Check if summary was generated
      if (!result.data.summary.generated) {
        console.warn('[SummarySignPage] Summary generation failed:', result.data.summary.error);
      }

      // Refetch dashboard state to get updated forms list
      await reload();
      setGenState({ status: 'idle' });
    } catch (err: any) {
      console.error('[SummarySignPage] generate-forms failed:', err);
      setGenState({ status: 'error', message: err?.message || 'Failed to prepare forms' });
    }
  }, [state, token, router, reload]);

  // Drive effect off loading->ready transition to reduce churn
  useEffect(() => {
    if (state.status === 'ready') {
      maybeGenerateForms();
    }
  }, [state.status, maybeGenerateForms]);

  // Loading states
  if (state.status === 'loading' || genState.status === 'generating') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <div className="text-center">
          <p className="text-sm text-[var(--muted)] mb-2">Preparing your application summary...</p>
          <div className="w-8 h-8 border-2 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="text-center">
          <p className="text-sm text-[var(--error)] mb-4">{state.message}</p>
          <button
            onClick={() => reload()}
            className="text-sm underline text-[var(--accent)]"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (genState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="text-center max-w-md">
          <p className="text-sm text-[var(--error)] mb-4">
            We couldn't prepare your forms — please try again, or contact the office.
          </p>
          <p className="text-xs text-[var(--muted)] mb-4">{genState.message}</p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                generationAttemptedRef.current = false;
                setGenState({ status: 'idle' });
                maybeGenerateForms();
              }}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <a
              href={`/pbv-full-app/${token}`}
              className="px-4 py-2 border border-[var(--border)] text-sm text-[var(--body)] hover:bg-[var(--paper-hover)] transition-colors"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  const { data } = state;

  // Terminal state: generation attempted but still no forms
  if (data.forms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="text-center max-w-md">
          <p className="text-sm text-[var(--body)] mb-4">
            We couldn't prepare your forms — please try again, or contact the office.
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => {
                generationAttemptedRef.current = false;
                setGenState({ status: 'idle' });
                maybeGenerateForms();
              }}
              className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Try again
            </button>
            <a
              href={`/pbv-full-app/${token}`}
              className="px-4 py-2 border border-[var(--border)] text-sm text-[var(--body)] hover:bg-[var(--paper-hover)] transition-colors"
            >
              Back to dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SummaryDocReviewSign
      token={token}
      language={data.preferred_language}
      hohName={data.head_of_household_name}
      hohMemberId={data.hoh_member_id ?? ''}
      summaryPdfUrl={`/api/t/${token}/pbv-full-app/summary-pdf`}
      summaryReady={data.forms.length > 0}
    />
  );
}
