'use client';

/**
 * components/pbv/intake/SectionHouseholdExpenses.tsx
 * Section 10 — Household Expenses
 * Conditional: only shown if ALL adults have zero income
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeHouseholdExpenses, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    rent: 'Monthly rent ($)',
    utilities: 'Monthly utilities ($)',
    food: 'Monthly food / groceries ($)',
    transportation: 'Monthly transportation ($)',
    other: 'Other monthly expenses ($)',
    explanation: 'How are you meeting these expenses?',
    explanation_hint: 'Describe how you pay for these costs with no income.',
  },
  es: {
    rent: 'Alquiler mensual ($)',
    utilities: 'Servicios mensuales ($)',
    food: 'Comida mensual ($)',
    transportation: 'Transporte mensual ($)',
    other: 'Otros gastos mensuales ($)',
    explanation: '¿Cómo está cubriendo estos gastos?',
    explanation_hint: 'Explique cómo paga estos costos sin ingresos.',
  },
  pt: {
    // PT: tentative — review
    rent: 'Aluguel mensal ($)',
    utilities: 'Serviços mensais ($)',
    food: 'Alimentação mensal ($)',
    transportation: 'Transporte mensal ($)',
    other: 'Outras despesas mensais ($)',
    explanation: 'Como você está pagando essas despesas?',
    explanation_hint: 'Explique como paga esses custos sem renda.',
  },
};

export default function SectionHouseholdExpenses({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const existing = intakeData.household_expenses;

  const [data, setData] = useState<IntakeHouseholdExpenses>(existing ?? {});

  const emit = (updated: IntakeHouseholdExpenses) => {
    onChange('household_expenses', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeHouseholdExpenses>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  const numField = (label: string, id: string, key: keyof IntakeHouseholdExpenses) => (
    <FormField label={label} htmlFor={id}>
      <input id={id} type="number" inputMode="decimal" min={0}
        value={(data[key] as number | undefined) ?? ''}
        onChange={(e) => set({ [key]: parseFloat(e.target.value) || 0 })}
        className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
    </FormField>
  );

  return (
    <FormSection background>
      {numField(c.rent, 'exp_rent', 'monthly_rent')}
      {numField(c.utilities, 'exp_utilities', 'monthly_utilities')}
      {numField(c.food, 'exp_food', 'monthly_food')}
      {numField(c.transportation, 'exp_trans', 'monthly_transportation')}
      {numField(c.other, 'exp_other', 'monthly_other')}

      <FormField label={c.explanation} required htmlFor="exp_explanation">
        <textarea id="exp_explanation"
          value={data.expense_explanation ?? ''}
          onChange={(e) => set({ expense_explanation: e.target.value })}
          rows={3}
          className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none resize-none"
          placeholder={c.explanation_hint} />
      </FormField>
    </FormSection>
  );
}
