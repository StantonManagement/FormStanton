'use client';

import { useState, useEffect } from 'react';
import TenantPortal from '@/components/TenantPortal';
import SubmissionStatusPortal from '@/components/SubmissionStatusPortal';

type RouteState =
  | { status: 'detecting' }
  | { status: 'submission' }
  | { status: 'compliance' };

export default function TokenRouter({ token }: { token: string }) {
  const [route, setRoute] = useState<RouteState>({ status: 'detecting' });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/t/${token}/status`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setRoute({ status: 'submission' });
        } else {
          setRoute({ status: 'compliance' });
        }
      })
      .catch(() => {
        if (!cancelled) setRoute({ status: 'compliance' });
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (route.status === 'detecting') {
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
