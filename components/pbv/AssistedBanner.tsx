'use client';

/**
 * components/pbv/AssistedBanner.tsx
 *
 * Always-visible top banner shown throughout the tenant UI when a staff member
 * has started an assisted session for this application.
 *
 * Displayed when:
 *   - session.assistedMode is active for this application token
 *   - AssistedModeContext.active === true
 *
 * Shows:
 *   "[Will Esposito] is helping you fill this out. The tenant signs for themselves."
 *   [End session] button → calls DELETE /api/admin/pbv/full-applications/[id]/assisted-session
 */

import { useAssistedMode } from '@/lib/pbv/hooks/useAssistedMode';

interface Props {
  token: string;
}

export default function AssistedBanner({ token }: Props) {
  const { assisted, ending, endSession } = useAssistedMode(token);

  if (!assisted) return null;

  return (
    <div
      role="banner"
      aria-label="Staff-assisted session active"
      style={{
        background: 'var(--color-amber-50, #fffbeb)',
        borderBottom: '1px solid var(--color-amber-300, #fcd34d)',
        color: 'var(--color-amber-900, #78350f)',
      }}
      className="w-full flex items-center justify-between px-4 py-2 text-sm"
    >
      <span>
        <strong>{assisted.staffDisplayName}</strong> is helping complete this application.
        The tenant will sign for themselves.
      </span>
      <button
        type="button"
        onClick={endSession}
        disabled={ending}
        className="ml-4 text-xs underline whitespace-nowrap disabled:opacity-50"
        style={{ color: 'var(--color-amber-900, #78350f)' }}
      >
        {ending ? 'Ending…' : 'End session'}
      </button>
    </div>
  );
}
