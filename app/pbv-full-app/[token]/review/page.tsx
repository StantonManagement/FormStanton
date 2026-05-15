'use client';

/**
 * app/pbv-full-app/[token]/review/page.tsx
 *
 * PRD-26 stub — Review and Sign.
 * Placeholder rendered when intake is complete and signing has not begun.
 * This page will be replaced by the full PRD-26 implementation.
 */

import { useParams } from 'next/navigation';

export default function ReviewStubPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? '';

  return (
    <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
      <div className="max-w-md w-full border border-[var(--border)] bg-white p-8 space-y-4">
        <h1 className="text-xl font-serif font-bold text-[var(--primary)]">
          Intake Complete
        </h1>
        <p className="text-sm text-[var(--body)]">
          Your answers have been received. The review and signing step is coming soon.
        </p>
        <p className="text-xs text-[var(--muted)]">Token: {token}</p>
      </div>
    </div>
  );
}
