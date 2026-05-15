'use client';

/**
 * app/pbv-full-app/signer/[member_token]/page.tsx
 *
 * Entry point for magic-link recipients.
 * Loads bootstrap, checks expiry, then enters MagicLinkSigningFlow.
 */

import { use, useState, useEffect } from 'react';
import { useSignerBootstrap } from '@/lib/pbv/hooks/useSignerBootstrap';
import ExpiredLinkScreen from '@/components/pbv/sign/ExpiredLinkScreen';
import MagicLinkSigningFlow from '@/components/pbv/sign/MagicLinkSigningFlow';
import type { FormDoc } from '@/lib/pbv/hooks/useFormStack';

interface Props {
  params: Promise<{ member_token: string }>;
}

export default function SignerEntryPage({ params }: Props) {
  const { member_token } = use(params);
  const bootstrapState = useSignerBootstrap(member_token);
  const [forms, setForms] = useState<FormDoc[]>([]);
  const [formsLoaded, setFormsLoaded] = useState(false);

  useEffect(() => {
    if (bootstrapState.status !== 'ready') return;
    fetch(`/api/pbv-full-app/signer/${member_token}/forms`)
      .then((r) => r.json())
      .then((json) => { setForms(json.data?.forms ?? []); setFormsLoaded(true); })
      .catch(() => setFormsLoaded(true));
  }, [bootstrapState.status, member_token]);

  if (bootstrapState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading&hellip;</p>
      </div>
    );
  }

  if (bootstrapState.status === 'expired') {
    return <ExpiredLinkScreen />;
  }

  if (bootstrapState.status === 'not_found') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <p className="text-sm text-[var(--error)] text-center">This link was not found.</p>
      </div>
    );
  }

  if (bootstrapState.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)] px-4">
        <p className="text-sm text-[var(--error)] text-center">{bootstrapState.message}</p>
      </div>
    );
  }

  if (!formsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
        <p className="text-sm text-[var(--muted)]">Loading forms&hellip;</p>
      </div>
    );
  }

  const { data } = bootstrapState;
  const lang = (data.preferred_language ?? 'en') as 'en' | 'es' | 'pt';

  return (
    <MagicLinkSigningFlow
      memberToken={member_token}
      memberId={data.member_id}
      memberName={data.member_name}
      hohName={data.hoh_name}
      language={lang}
      forms={forms}
      onFormsUpdated={() => {
        fetch(`/api/pbv-full-app/signer/${member_token}/forms`)
          .then((r) => r.json())
          .then((json) => setForms(json.data?.forms ?? []))
          .catch(() => null);
      }}
    />
  );
}
