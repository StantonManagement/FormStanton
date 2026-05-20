'use client';

/**
 * app/pbv-full-app/[token]/dashboard/page.tsx
 *
 * Post-intake tenant dashboard (PRD-26).
 * Renders TenantDashboard once useDashboardState is ready.
 */

import { use } from 'react';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';
import TenantDashboard from '@/components/pbv/sign/TenantDashboard';

interface Props {
  params: Promise<{ token: string }>;
}

export default function DashboardPage({ params }: Props) {
  const { token } = use(params);
  const { state, reload } = useDashboardState(token);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading\u2026</p>
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

  return (
    <TenantDashboard
      token={token}
      data={state.data}
      onReload={reload}
    />
  );
}
