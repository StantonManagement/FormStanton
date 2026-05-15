'use client';

/**
 * app/pbv-full-app/[token]/sign/forms/page.tsx
 *
 * PR-5: Step gate - requires summary signed before accessing form signing
 */

import { use, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import { useFormStack } from '@/lib/pbv/hooks/useFormStack';
import FormsStack from '@/components/pbv/sign/FormsStack';

interface Props {
  params: Promise<{ token: string }>;
}

export default function FormsSignPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const { state: dashState } = useDashboardState(token);
  const { state: formsState, reload: reloadForms } = useFormStack(token);

  // PR-5: Step gate - redirect if summary not signed
  useEffect(() => {
    if (dashState.status === 'ready' && !dashState.data.summary_signed) {
      router.push(`/pbv-full-app/${token}/sign/summary`);
    }
  }, [dashState, token, router]);

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

  // Defensive: if no forms, redirect to dashboard
  if (dashState.data.forms.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <div className="text-center">
          <p className="text-sm text-[var(--error)] mb-4">No forms available.</p>
          <a href={`/pbv-full-app/${token}`} className="text-sm underline text-[var(--accent)]">
            Back to dashboard
          </a>
        </div>
      </div>
    );
  }

  const { data } = dashState;
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
