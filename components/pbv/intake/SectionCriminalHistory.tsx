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

type MemberCriminalWithNeutral = Omit<IntakeMemberCriminal, 'has_criminal_history'> & {
  has_criminal_history: boolean | null;
};

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
    confidentiality: 'This information helps us assess eligibility and priority. Your answer is kept confidential per Stanton policy and will not be shared without your consent.',
  },
  es: {
    question: '¿Esta persona ha sido condenada o ha declarado culpable o no contest por un delito grave en los últimos 5 años?',
    yes: 'Sí',
    no: 'No',
    details_label: 'Por favor, proporcione detalles (delito, fecha, resolución)',
    details_hint: 'Incluya la naturaleza del delito, fecha y resultado.',
    confidentiality: 'Esta información nos ayuda a evaluar la elegibilidad y prioridad. Su respuesta se mantiene confidencial según la política de Stanton y no se compartirá sin su consentimiento.',
  },
  pt: {
    // PT: tentative — review
    question: 'Esta pessoa foi condenada ou declarou-se culpada ou sem contestação por um crime nos últimos 5 anos?',
    yes: 'Sim',
    no: 'Não',
    details_label: 'Forneça detalhes (infração, data, disposição)',
    details_hint: 'Inclua a natureza da infração, data e resultado.',
    confidentiality: 'Esta informação nos ajuda a avaliar elegibilidade e prioridade. Sua resposta é mantida confidencial conforme a política da Stanton e não será compartilhada sem seu consentimento.', // PT: tentative — review
  },
};

export default function SectionCriminalHistory({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const household = intakeData.household;
  const adults = (household?.members ?? []).filter((m) => !m.is_minor);

  const existing = intakeData.criminal_history;

  const [byMember, setByMember] = useState<MemberCriminalWithNeutral[]>(() =>
    adults.map((adult) => {
      const ex = existing?.by_member?.find((m) => m.member_slot === adult.slot);
      return ex ? { ...ex, has_criminal_history: ex.has_criminal_history } : { member_slot: adult.slot, member_name: adult.name, has_criminal_history: null };
    })
  );

  const [currentIndex, setCurrentIndex] = useState(0);

  const emit = (updated: MemberCriminalWithNeutral[]) => {
    const payload: IntakeCriminalHistory = { by_member: updated as IntakeMemberCriminal[] };
    onChange('criminal_history', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(byMember); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = (slot: number, patch: Partial<MemberCriminalWithNeutral>) => {
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
        <p className="text-xs text-[var(--muted)] mt-1">{c.confidentiality}</p>

        <div className="flex gap-4 mt-3" role="radiogroup" aria-required="true">
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
