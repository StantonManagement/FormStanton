'use client';

/**
 * app/pbv-full-app/[token]/sign/forms/page.tsx
 *
 * F11 (PRD-40): Step gate - requires summary signed before accessing form signing.
 * Shows an explainer screen instead of a silent redirect.
 */

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import { useFormStack } from '@/lib/pbv/hooks/useFormStack';
import FormsStack from '@/components/pbv/sign/FormsStack';

interface Props {
  params: Promise<{ token: string }>;
}

export default function FormsSignPage({ params }: Props) {
  const { token } = use(params);
  const { state: dashState } = useDashboardState(token);
  const { state: formsState, reload: reloadForms } = useFormStack(token);

  // PRP-010 / C1: warn before close while a signature submit is in flight.
  // FormsStack (and its useSigningCeremony hook) own the live `submitting`
  // state, so the page listens to a window-level `pbv:signing-in-flight`
  // boolean event the child dispatches from its submit/finally blocks.
  // The event channel is established here; the dispatcher is wired in a
  // follow-up since this PRP cannot edit FormsStack/useSigningCeremony.
  const [signingInFlight, setSigningInFlight] = useState(false);
  useEffect(() => {
    const onFlight = (e: Event) => {
      const detail = (e as CustomEvent<{ inFlight: boolean }>).detail;
      if (detail && typeof detail.inFlight === 'boolean') setSigningInFlight(detail.inFlight);
    };
    window.addEventListener('pbv:signing-in-flight', onFlight as EventListener);
    return () => window.removeEventListener('pbv:signing-in-flight', onFlight as EventListener);
  }, []);

  useEffect(() => {
    if (!signingInFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [signingInFlight]);

  if (dashState.status === 'loading' || formsState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading&hellip;</p>
      </div>
    );
  }

  if (dashState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <p className="text-sm text-[var(--error)] text-center">{dashState.message}</p>
      </div>
    );
  }

  const { data } = dashState;

  // F11: Step gate — explainer instead of silent redirect
  if (!data.summary_signed) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-[var(--border)] p-8 space-y-4">
          <h1 className="text-xl font-serif font-bold text-[var(--primary)]">
            Sign your summary first
          </h1>
          <p className="text-sm text-[var(--body)]">
            Sign your application summary first, then we&apos;ll prepare your forms.
          </p>
          <Link
            href={`/pbv-full-app/${token}/sign/summary`}
            className="block w-full text-center min-h-[44px] leading-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to summary
          </Link>
        </div>
      </div>
    );
  }

  // Defensive: no forms available
  if (data.forms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="text-center">
          <p className="text-sm text-[var(--error)] mb-4">No forms available.</p>
          <Link href={`/pbv-full-app/${token}/dashboard`} className="text-sm underline text-[var(--accent)]">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const forms = formsState.status === 'ready' ? formsState.forms : [];

  return (
    <FormsStack
      token={token}
      language={data.preferred_language}
      forms={forms}
      hohName={data.head_of_household_name}
      hohMemberId={data.hoh_member_id ?? ''}
      summarySigningComplete={data.summary_signed}
      onFormsUpdated={reloadForms}
    />
  );
}
