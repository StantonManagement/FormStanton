'use client';

/**
 * components/pbv/sign/ConsentText.tsx
 *
 * Renders the per-form consent text at the correct version and language.
 * Import source of truth: lib/pbv/consent-text.ts
 */

import { getFormConsent, CONSENT_TEXT_VERSION } from '@/lib/pbv/consent-text';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  language: PreferredLanguage;
}

export default function ConsentText({ language }: Props) {
  const lang = language === 'pt' ? 'pt' : language === 'es' ? 'es' : 'en';
  return (
    <div className="bg-[var(--paper)] border border-[var(--border)] p-4">
      <p className="text-xs text-[var(--muted)] mb-1">
        Version: {CONSENT_TEXT_VERSION}
      </p>
      <p className="text-xs text-[var(--body)] leading-relaxed">
        {getFormConsent(lang)}
      </p>
    </div>
  );
}
