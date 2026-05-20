'use client';

/**
 * app/pbv-full-app/[token]/sign/additional-signers/page.tsx
 *
 * F11 (PRD-40): Step gate - requires summary signed and forms complete.
 * Shows an explainer screen instead of a silent redirect.
 */

import { use } from 'react';
import Link from 'next/link';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import AdditionalSignersPanel from '@/components/pbv/sign/AdditionalSignersPanel';

interface Props {
  params: Promise<{ token: string }>;
}

function areFormsComplete(forms: Array<{ status: string; signatures_complete?: boolean }>): boolean {
  if (forms.length === 0) return false;
  return forms.every(
    (f) => f.status === 'signed' || f.status === 'finalized' || f.signatures_complete
  );
}

export default function AdditionalSignersPage({ params }: Props) {
  const { token } = use(params);
  const { state } = useDashboardState(token);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading&hellip;</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <p className="text-sm text-[var(--error)] text-center">{state.message}</p>
      </div>
    );
  }

  const { data } = state;

  // F11: Gate 1 — summary must be signed first
  if (!data.summary_signed) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-[var(--border)] p-8 space-y-4">
          <h1 className="text-xl font-serif font-bold text-[var(--primary)]">
            Sign your summary first
          </h1>
          <p className="text-sm text-[var(--body)]">
            Finish signing your application summary first, then we&apos;ll prepare the household signers step.
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

  // F11: Gate 2 — all forms must be signed first
  if (!areFormsComplete(data.forms)) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white border border-[var(--border)] p-8 space-y-4">
          <h1 className="text-xl font-serif font-bold text-[var(--primary)]">
            Sign your forms first
          </h1>
          <p className="text-sm text-[var(--body)]">
            Sign your application forms first, then we&apos;ll collect signatures from other household members.
          </p>
          <Link
            href={`/pbv-full-app/${token}/sign/forms`}
            className="block w-full text-center min-h-[44px] leading-[44px] bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Go to forms
          </Link>
        </div>
      </div>
    );
  }

  return (
    <AdditionalSignersPanel
      token={token}
      language={data.preferred_language}
      hohName={data.head_of_household_name}
      hohMemberId={data.hoh_member_id ?? ''}
    />
  );
}
