'use client';

/**
 * components/pbv/intake/SectionZeroIncomeDecl.tsx
 * Section 4 — Zero Income Declaration
 * One declaration block per zero-income adult.
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type {
  IntakeData,
  IntakeZeroIncomeDecl,
  IntakeZeroIncomeAdult,
  SectionSlug,
} from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    support_label: 'How are you currently supporting yourself?',
    contributions_label: 'Are there outside contributions (family, friends, gifts)?',
    support_hint: 'Describe in detail.',
    contributions_hint: 'Describe any financial support received from others.',
  },
  es: {
    support_label: '¿Cómo se está manteniendo actualmente?',
    contributions_label: '¿Hay contribuciones externas (familia, amigos, donaciones)?',
    support_hint: 'Describa en detalle.',
    contributions_hint: 'Describa cualquier apoyo financiero recibido de otros.',
  },
  pt: {
    // PT: tentative — review
    support_label: 'Como você está se sustentando atualmente?',
    contributions_label: 'Há contribuições externas (família, amigos, presentes)?',
    support_hint: 'Descreva em detalhes.',
    contributions_hint: 'Descreva qualquer apoio financeiro recebido de outros.',
  },
};

export default function SectionZeroIncomeDecl({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;

  const zeroAdults = (intakeData.income?.by_member ?? []).filter((m) => !m.has_any_income);

  const existing = intakeData.zero_income_decl;

  const [adults, setAdults] = useState<IntakeZeroIncomeAdult[]>(() =>
    zeroAdults.map((m) => {
      const ex = existing?.adults?.find((a) => a.member_slot === m.member_slot);
      return ex ?? { member_slot: m.member_slot, member_name: m.member_name, support_explanation: '', outside_contributions: '' };
    })
  );

  const emit = (updated: IntakeZeroIncomeAdult[]) => {
    const payload: IntakeZeroIncomeDecl = { adults: updated };
    onChange('zero_income_decl', payload as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(adults); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const updateAdult = (slot: number, patch: Partial<IntakeZeroIncomeAdult>) => {
    const updated = adults.map((a) => (a.member_slot === slot ? { ...a, ...patch } : a));
    setAdults(updated);
    emit(updated);
  };

  if (adults.length === 0) return null;

  return (
    <div className="space-y-6">
      {adults.map((adult) => (
        <FormSection key={adult.member_slot} background>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {adult.member_name}
          </p>

          <FormField label={c.support_label} required htmlFor={`support_${adult.member_slot}`}>
            <textarea
              id={`support_${adult.member_slot}`}
              value={adult.support_explanation}
              onChange={(e) => updateAdult(adult.member_slot, { support_explanation: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none resize-none"
              placeholder={c.support_hint}
            />
          </FormField>

          <FormField label={c.contributions_label} htmlFor={`contrib_${adult.member_slot}`}>
            <textarea
              id={`contrib_${adult.member_slot}`}
              value={adult.outside_contributions}
              onChange={(e) => updateAdult(adult.member_slot, { outside_contributions: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none resize-none"
              placeholder={c.contributions_hint}
            />
          </FormField>
        </FormSection>
      ))}
    </div>
  );
}
