'use client';

import type { SaveStatus } from '@/lib/pbv/hooks/useSectionAutoSave';
import type { PreferredLanguage } from '@/types/compliance';

interface Props {
  status: SaveStatus;
  lastSavedAt: Date | null;
  language?: PreferredLanguage;
}

const labels: Record<PreferredLanguage, Record<SaveStatus, string> & { at: string }> = {
  en: { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved', at: 'at' },
  es: { idle: '', saving: 'Guardando…', saved: 'Guardado', error: 'No guardado', at: 'a las' },
  pt: { idle: '', saving: 'Salvando…', saved: 'Salvo', error: 'Não salvo', at: 'às' }, // PT: tentative — review
};

function fmtTime(d: Date | null): string {
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SaveStatusIndicator({ status, lastSavedAt, language = 'en' }: Props) {
  const l = labels[language] ?? labels.en;

  if (status === 'idle') return null;

  return (
    <span
      className={`text-xs transition-colors duration-200 ${
        status === 'error'
          ? 'text-[var(--error)]'
          : status === 'saving'
          ? 'text-[var(--muted)]'
          : 'text-[var(--muted)]'
      }`}
      aria-live="polite"
    >
      {status === 'saved' && lastSavedAt
        ? `${l.saved} ${l.at} ${fmtTime(lastSavedAt)}`
        : l[status]}
    </span>
  );
}
