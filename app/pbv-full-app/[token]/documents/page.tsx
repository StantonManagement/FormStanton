'use client';

/**
 * app/pbv-full-app/[token]/documents/page.tsx
 *
 * Tenant document upload page (F3).
 * Resolves language from bootstrap, then mounts TenantDocumentUpload.
 */

import { use } from 'react';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';
import TenantDocumentUpload from '@/components/pbv/TenantDocumentUpload';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  params: Promise<{ token: string }>;
}

export default function DocumentsPage({ params }: Props) {
  const { token } = use(params);
  const { state } = useIntakeBootstrap(token);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center px-4">
        <p className="text-sm text-[var(--error)]">{state.message}</p>
      </div>
    );
  }

  const language = (state.data.preferred_language ?? 'en') as PreferredLanguage;

  const backLabel: Record<PreferredLanguage, string> = {
    en: '← Back to dashboard',
    es: '← Volver al panel',
    pt: '← Voltar ao painel', // PT: tentative — review
  };

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        <a
          href={`/pbv-full-app/${token}/dashboard`}
          className="text-sm text-[var(--primary)] underline underline-offset-2 hover:opacity-75"
        >
          {backLabel[language]}
        </a>

        <TenantDocumentUpload
          token={token}
          language={language}
          initialDocuments={[]}
          packetLocked={false}
        />
      </div>
    </div>
  );
}
