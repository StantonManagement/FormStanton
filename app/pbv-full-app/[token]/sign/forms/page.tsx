'use client';

/**
 * app/pbv-full-app/[token]/sign/forms/page.tsx
 */

import { use } from 'react';
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
