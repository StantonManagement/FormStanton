'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TenantPortal from '@/components/TenantPortal';
import SubmissionStatusPortal from '@/components/SubmissionStatusPortal';

type RouteState =
  | { status: 'detecting' }
  | { status: 'pbv_redirect' }
  | { status: 'submission' }
  | { status: 'compliance' };

/**
 * TokenRouter
 *
 * Routes tenant tokens to the appropriate portal.
 *
 * PRD-03: If the token resolves to a PBV full application,
 * redirect to the new PBV tenant portal at /pbv-full-app/[token].
 * Otherwise, use the legacy routing (SubmissionStatusPortal or TenantPortal).
 */
export default function TokenRouter({ token }: { token: string }) {
  const router = useRouter();
  const [route, setRoute] = useState<RouteState>({ status: 'detecting' });

  useEffect(() => {
    let cancelled = false;

    // PRD-03: First check if this is a PBV token
    fetch(`/api/t/${token}/pbv-full-app`)
      .then((res) => {
        if (cancelled) return;

        if (res.ok) {
          // PBV token detected — redirect to new PBV portal
          router.replace(`/pbv-full-app/${token}`);
          setRoute({ status: 'pbv_redirect' });
          return;
        }

        // Not a PBV token — use legacy routing
        return fetch(`/api/t/${token}/status`)
          .then((statusRes) => {
            if (cancelled) return;
            if (statusRes.ok) {
              setRoute({ status: 'submission' });
            } else {
              setRoute({ status: 'compliance' });
            }
          });
      })
      .catch(() => {
        if (!cancelled) setRoute({ status: 'compliance' });
      });

    return () => {
      cancelled = true;
    };
  }, [token, router]);

  if (route.status === 'detecting' || route.status === 'pbv_redirect') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-[var(--muted)] text-sm">Loading...</p>
      </div>
    );
  }

  if (route.status === 'submission') {
    return <SubmissionStatusPortal token={token} />;
  }

  return <TenantPortal token={token} />;
}
