'use client';

/**
 * app/pbv-full-app/[token]/sign/additional-signers/page.tsx
 *
 * PR-5: Step gate - requires summary signed and forms complete
 */

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { state } = useDashboardState(token);

  // PR-5: Step gate - redirect if preconditions not met
  useEffect(() => {
    if (state.status !== 'ready') return;

    const { data } = state;

    if (!data.summary_signed) {
      router.push(`/pbv-full-app/${token}/sign/summary`);
      return;
    }

    if (!areFormsComplete(data.forms)) {
      router.push(`/pbv-full-app/${token}/sign/forms`);
      return;
    }
  }, [state, token, router]);

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

  return (
    <AdditionalSignersPanel
      token={token}
      language={data.preferred_language}
      hohName={data.head_of_household_name}
      hohMemberId={data.hoh_member_id ?? ''}
    />
  );
}
