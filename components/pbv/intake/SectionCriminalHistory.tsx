'use client';

/**
 * components/pbv/intake/SectionCriminalHistory.tsx
 * Section 8 — Criminal History (per-adult)
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import AdultWizard from '@/components/pbv/intake/AdultWizard';
import type { PreferredLanguage } from '@/types/compliance';
import type {
  IntakeData,
  IntakeCriminalHistory,
  IntakeMemberCriminal,
  SectionSlug,
} from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    question: 'Has this person been convicted of, or pled guilty or no contest to, a felony in the past 5 years?',
    yes: 'Yes',
    no: 'No',
    details_label: 'Please provide details (offense, date, disposition)',
    details_hint: 'Include the nature of the offense, date, and outcome.',
  },
  es: {
    question: '¿Esta persona ha sido condenada o ha declarado culpable o no contest por un delito grave en los últimos 5 años?',
    yes: 'Sí',
    no: 'No',
    details_label: 'Por favor, proporcione detalles (delito, fecha, resolución)',
    details_hint: 'Incluya la naturaleza del delito, fecha y resultado.',
  },
  pt: {
    // PT: tentative — review
    question: 'Esta pessoa foi condenada ou declarou-se culpada ou sem contestação por um crime nos últimos 5 anos?',
    yes: 'Sim',
    no: 'Não',
    details_label: 'Forneça detalhes (infração, data, disposição)',
    details_hint: 'Inclua a natureza da infração, data e resultado.',
  },
};

export default function SectionCriminalHistory({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const household = intakeData.household;
  const adults = (household?.members ?? []).filter((m) => !m.is_minor);

  const existing = intakeData.criminal_history;

  const [byMember, setByMember] = useState<IntakeMemberCriminal[]>(() =>
    adults.map((adult) => {
      const ex = existing?.by_member?.find((m) => m.member_slot === adult.slot);
      return ex ?? { member_slot: adult.slot, member_name: adult.name, has_criminal_history: false };
    })
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  const emit = (updated: IntakeMemberCriminal[]) => {
    const payload: IntakeCriminalHistory = { by_member: updated };
    onChange('criminal_history', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(byMember); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (slot: number, patch: Partial<IntakeMemberCriminal>) => {
    const updated = byMember.map((m) => m.member_slot === slot ? { ...m, ...patch } : m);
    setByMember(updated);
    emit(updated);
  };

  const current = byMember[currentIndex];
  if (!current) return null;

  return (
    <AdultWizard
      adults={adults.map((a) => ({ name: a.name, slot: a.slot }))}
      currentIndex={currentIndex}
      onPrev={() => setCurrentIndex((i) => Math.max(0, i - 1))}
      onNext={() => setCurrentIndex((i) => Math.min(adults.length - 1, i + 1))}
      language={language}
    >
      <FormSection background>
        <p className="text-sm text-[var(--body)]">{c.question}</p>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input type="radio" name={`criminal_${current.member_slot}`}
              checked={current.has_criminal_history === true}
              onChange={() => update(current.member_slot, { has_criminal_history: true })}
              className="w-4 h-4" />
            {c.yes}
          </label>
          <label className="flex items-center gap-2 text-sm min-h-[44px]">
            <input type="radio" name={`criminal_${current.member_slot}`}
              checked={current.has_criminal_history === false}
              onChange={() => update(current.member_slot, { has_criminal_history: false })}
              className="w-4 h-4" />
            {c.no}
          </label>
        </div>

        {current.has_criminal_history && (
          <FormField label={c.details_label} required htmlFor={`criminal_details_${current.member_slot}`}>
            <textarea
              id={`criminal_details_${current.member_slot}`}
              value={current.details ?? ''}
              onChange={(e) => update(current.member_slot, { details: e.target.value })}
              rows={4}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none resize-none"
              placeholder={c.details_hint}
            />
          </FormField>
        )}
      </FormSection>
    </AdultWizard>
  );
}
