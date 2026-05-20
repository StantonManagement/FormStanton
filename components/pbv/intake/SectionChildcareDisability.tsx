'use client';

/**
 * components/pbv/intake/SectionChildcareDisability.tsx
 * Section 6 — Childcare / Disability Expenses
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeChildcareDisability, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    care4kids: 'Do you have a Care 4 Kids certificate?',
    paid_relative: 'Do you pay a relative for childcare?',
    disability_care: 'Do you have disability-related care expenses?',
    childcare_amount: 'Monthly childcare amount ($)',
    disability_amount: 'Monthly disability care amount ($)',
  },
  es: {
    care4kids: '¿Tiene un certificado de Care 4 Kids?',
    paid_relative: '¿Paga a un familiar por cuidado infantil?',
    disability_care: '¿Tiene gastos de cuidado relacionados con una discapacidad?',
    childcare_amount: 'Monto mensual de cuidado infantil ($)',
    disability_amount: 'Monto mensual de cuidado por discapacidad ($)',
  },
  pt: {
    // PT: tentative — review
    care4kids: 'Você tem um certificado Care 4 Kids?',
    paid_relative: 'Você paga um parente pelo cuidado de crianças?',
    disability_care: 'Você tem despesas de cuidado relacionadas à deficiência?',
    childcare_amount: 'Valor mensal de creche ($)',
    disability_amount: 'Valor mensal de cuidado por deficiência ($)',
  },
};

function empty(): IntakeChildcareDisability {
  return { has_care4kids: false, paid_to_relative: false, disability_care_expenses: false };
}

export default function SectionChildcareDisability({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const [data, setData] = useState<IntakeChildcareDisability>(intakeData.childcare_disability ?? empty());

  const emit = (updated: IntakeChildcareDisability) => {
    onChange('childcare_disability', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeChildcareDisability>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  return (
    <FormSection background>
      <label className="flex items-start gap-3 min-h-[44px] py-1">
        <input type="checkbox" checked={data.has_care4kids}
          onChange={(e) => set({ has_care4kids: e.target.checked })}
          className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="text-sm">{c.care4kids}</span>
      </label>

      <label className="flex items-start gap-3 min-h-[44px] py-1">
        <input type="checkbox" checked={data.paid_to_relative}
          onChange={(e) => set({ paid_to_relative: e.target.checked })}
          className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="text-sm">{c.paid_relative}</span>
      </label>

      {(data.has_care4kids || data.paid_to_relative) && (
        <FormField label={c.childcare_amount} htmlFor="childcare_amount">
          <input id="childcare_amount" type="number" inputMode="decimal" min={0}
            value={data.childcare_monthly_amount ?? ''}
            onChange={(e) => set({ childcare_monthly_amount: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>
      )}

      <label className="flex items-start gap-3 min-h-[44px] py-1">
        <input type="checkbox" checked={data.disability_care_expenses}
          onChange={(e) => set({ disability_care_expenses: e.target.checked })}
          className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <span className="text-sm">{c.disability_care}</span>
      </label>

      {data.disability_care_expenses && (
        <FormField label={c.disability_amount} htmlFor="disability_amount">
          <input id="disability_amount" type="number" inputMode="decimal" min={0}
            value={data.disability_monthly_amount ?? ''}
            onChange={(e) => set({ disability_monthly_amount: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>
      )}
    </FormSection>
  );
}
