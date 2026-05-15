'use client';

/**
 * components/pbv/intake/SectionMedical.tsx
 * Section 7 — Medical Expenses
 * Conditional: only shown if HOH/spouse disabled OR 62+
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeMedical, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    has_insurance: 'Do you have medical insurance?',
    insurance_cost: 'Monthly insurance premium ($)',
    doctor_visits: 'Monthly doctor visit costs ($)',
    prescriptions: 'Monthly prescription costs ($)',
    other_medical: 'Other monthly medical costs ($)',
  },
  es: {
    has_insurance: '¿Tiene seguro médico?',
    insurance_cost: 'Prima mensual del seguro ($)',
    doctor_visits: 'Costos mensuales de visitas al médico ($)',
    prescriptions: 'Costos mensuales de medicamentos ($)',
    other_medical: 'Otros costos médicos mensuales ($)',
  },
  pt: {
    // PT: tentative — review
    has_insurance: 'Você tem plano de saúde?',
    insurance_cost: 'Prêmio mensal do seguro ($)',
    doctor_visits: 'Custos mensais de consultas médicas ($)',
    prescriptions: 'Custos mensais de medicamentos ($)',
    other_medical: 'Outros custos médicos mensais ($)',
  },
};

export default function SectionMedical({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const existing = intakeData.medical;

  const [data, setData] = useState<IntakeMedical>(existing ?? { has_medical_insurance: false });

  const emit = (updated: IntakeMedical) => {
    onChange('medical', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeMedical>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  return (
    <FormSection background>
      <label className="flex items-center gap-3 min-h-[44px]">
        <input type="checkbox" checked={data.has_medical_insurance}
          onChange={(e) => set({ has_medical_insurance: e.target.checked })}
          className="w-4 h-4 flex-shrink-0" />
        <span className="text-sm">{c.has_insurance}</span>
      </label>

      {data.has_medical_insurance && (
        <FormField label={c.insurance_cost} htmlFor="ins_cost">
          <input id="ins_cost" type="number" inputMode="decimal" min={0}
            value={data.monthly_insurance_cost ?? ''}
            onChange={(e) => set({ monthly_insurance_cost: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
        </FormField>
      )}

      <FormField label={c.doctor_visits} htmlFor="doctor_visits">
        <input id="doctor_visits" type="number" inputMode="decimal" min={0}
          value={data.monthly_doctor_visits ?? ''}
          onChange={(e) => set({ monthly_doctor_visits: parseFloat(e.target.value) || 0 })}
          className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
      </FormField>

      <FormField label={c.prescriptions} htmlFor="prescriptions">
        <input id="prescriptions" type="number" inputMode="decimal" min={0}
          value={data.monthly_prescriptions ?? ''}
          onChange={(e) => set({ monthly_prescriptions: parseFloat(e.target.value) || 0 })}
          className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
      </FormField>

      <FormField label={c.other_medical} htmlFor="other_medical">
        <input id="other_medical" type="number" inputMode="decimal" min={0}
          value={data.monthly_other_medical ?? ''}
          onChange={(e) => set({ monthly_other_medical: parseFloat(e.target.value) || 0 })}
          className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none" />
      </FormField>
    </FormSection>
  );
}
