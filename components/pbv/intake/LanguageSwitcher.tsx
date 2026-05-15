'use client';

/**
 * components/pbv/intake/LanguageSwitcher.tsx
 *
 * Compact EN / ES / PT toggle. Only renders if the current language
 * is not the only available language.
 */

import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  current: PreferredLanguage;
  onChange: (lang: PreferredLanguage) => void;
}

const LANGS: Array<{ code: PreferredLanguage; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
];

export default function LanguageSwitcher({ current, onChange }: Props) {
  return (
    <div className="flex gap-1" aria-label="Language switcher">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => onChange(l.code)}
          className={`min-h-[32px] px-2 text-xs font-medium transition-colors border ${
            l.code === current
              ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
              : 'bg-white text-[var(--muted)] border-[var(--border)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
          }`}
          aria-pressed={l.code === current}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
