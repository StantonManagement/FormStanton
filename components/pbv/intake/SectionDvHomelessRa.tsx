'use client';

/**
 * components/pbv/intake/SectionDvHomelessRa.tsx
 * Section 9 — DV / Homeless / Reasonable Accommodation
 */

import { useState, useEffect } from 'react';
import FormField from '@/components/form/FormField';
import FormSection from '@/components/form/FormSection';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, IntakeDvHomelessRa, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  onChange: (slug: SectionSlug, data: Record<string, unknown>) => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    dv_label: 'Is any household member a victim of domestic violence, dating violence, sexual assault, or stalking?',
    homeless_label: 'Is any household member currently homeless or at risk of homelessness?',
    ra_label: 'Does any household member need a reasonable accommodation due to a disability?',
    ra_description: 'Describe the requested accommodation',
    ra_hint: 'E.g., ground-floor unit, accessible parking, etc.',
    yes: 'Yes',
    no: 'No',
  },
  es: {
    dv_label: '¿Algún miembro del hogar es víctima de violencia doméstica, violencia en el noviazgo, agresión sexual o acecho?',
    homeless_label: '¿Algún miembro del hogar está actualmente sin hogar o en riesgo de quedarse sin hogar?',
    ra_label: '¿Algún miembro del hogar necesita un ajuste razonable debido a una discapacidad?',
    ra_description: 'Describa el ajuste solicitado',
    ra_hint: 'Ej. unidad en planta baja, estacionamiento accesible, etc.',
    yes: 'Sí',
    no: 'No',
  },
  pt: {
    // PT: tentative — review
    dv_label: 'Algum membro da família é vítima de violência doméstica, violência no namoro, agressão sexual ou perseguição?',
    homeless_label: 'Algum membro da família está atualmente sem moradia ou em risco de ficar sem moradia?',
    ra_label: 'Algum membro da família precisa de acomodação razoável devido a uma deficiência?',
    ra_description: 'Descreva a acomodação solicitada',
    ra_hint: 'Ex.: unidade no térreo, estacionamento acessível, etc.',
    yes: 'Sim',
    no: 'Não',
  },
};

function YesNo({ name, value, onChange, yesLabel, noLabel }: {
  name: string; value: boolean; onChange: (v: boolean) => void;
  yesLabel: string; noLabel: string;
}) {
  return (
    <div className="flex gap-4 mt-2">
      <label className="flex items-center gap-2 text-sm min-h-[44px]">
        <input type="radio" name={name} checked={value === true}
          onChange={() => onChange(true)} className="w-4 h-4" />
        {yesLabel}
      </label>
      <label className="flex items-center gap-2 text-sm min-h-[44px]">
        <input type="radio" name={name} checked={value === false}
          onChange={() => onChange(false)} className="w-4 h-4" />
        {noLabel}
      </label>
    </div>
  );
}

export default function SectionDvHomelessRa({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const existing = intakeData.dv_homeless_ra;

  const [data, setData] = useState<IntakeDvHomelessRa>(existing ?? {
    dv_status: false,
    homeless_at_admission: false,
    reasonable_accommodation_requested: false,
  });

  const emit = (updated: IntakeDvHomelessRa) => {
    onChange('dv_homeless_ra', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeDvHomelessRa>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  return (
    <div className="space-y-6">
      <FormSection background>
        <p className="text-sm">{c.dv_label}</p>
        <YesNo name="dv_status" value={data.dv_status}
          onChange={(v) => set({ dv_status: v })}
          yesLabel={c.yes} noLabel={c.no} />
      </FormSection>

      <FormSection background>
        <p className="text-sm">{c.homeless_label}</p>
        <YesNo name="homeless_at_admission" value={data.homeless_at_admission}
          onChange={(v) => set({ homeless_at_admission: v })}
          yesLabel={c.yes} noLabel={c.no} />
      </FormSection>

      <FormSection background>
        <p className="text-sm">{c.ra_label}</p>
        <YesNo name="ra_requested" value={data.reasonable_accommodation_requested}
          onChange={(v) => set({ reasonable_accommodation_requested: v })}
          yesLabel={c.yes} noLabel={c.no} />

        {data.reasonable_accommodation_requested && (
          <FormField label={c.ra_description} htmlFor="ra_description">
            <textarea
              id="ra_description"
              value={data.ra_description ?? ''}
              onChange={(e) => set({ ra_description: e.target.value })}
              rows={3}
              className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white focus:outline-none focus:border-[var(--primary)] rounded-none resize-none"
              placeholder={c.ra_hint}
            />
          </FormField>
        )}
      </FormSection>
    </div>
  );
}
