'use client';

/**
 * app/pbv-full-app/[token]/sign/summary/page.tsx
 */

import { use } from 'react';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import SummaryDocReviewSign from '@/components/pbv/sign/SummaryDocReviewSign';

interface Props {
  params: Promise<{ token: string }>;
}

export default function SummarySignPage({ params }: Props) {
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

  return (
    <SummaryDocReviewSign
      token={token}
      language={data.preferred_language}
      hohName={data.head_of_household_name}
      hohMemberId={data.hoh_member_id ?? ''}
      summaryPdfUrl={`/api/t/${token}/pbv-full-app/summary-pdf`}
    />
  );
}
