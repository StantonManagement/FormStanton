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
    dv_confidentiality: 'This information is used to assess priority and connect you with support resources. It is kept strictly confidential per Stanton policy.',
    homeless_label: 'Is any household member currently homeless or at risk of homelessness?',
    homeless_confidentiality: 'This information helps determine priority for housing assistance. It is kept confidential and will not affect your eligibility.',
    ra_label: 'Does any household member need a reasonable accommodation due to a disability?',
    ra_confidentiality: 'Requesting an accommodation is voluntary and confidential. It will not affect your housing eligibility.',
    ra_description: 'Describe the requested accommodation',
    ra_hint: 'E.g., ground-floor unit, accessible parking, etc.',
    yes: 'Yes',
    no: 'No',
  },
  es: {
    dv_label: '¿Algún miembro del hogar es víctima de violencia doméstica, violencia en el noviazgo, agresión sexual o acecho?',
    dv_confidentiality: 'Esta información se utiliza para evaluar la prioridad y conectarle con recursos de apoyo. Se mantiene estrictamente confidencial según la política de Stanton.',
    homeless_label: '¿Algún miembro del hogar está actualmente sin hogar o en riesgo de quedarse sin hogar?',
    homeless_confidentiality: 'Esta información ayuda a determinar la prioridad para la asistencia de vivienda. Es confidencial y no afectará su elegibilidad.',
    ra_label: '¿Algún miembro del hogar necesita un ajuste razonable debido a una discapacidad?',
    ra_confidentiality: 'Solicitar un ajuste es voluntario y confidencial. No afectará su elegibilidad para vivienda.',
    ra_description: 'Describa el ajuste solicitado',
    ra_hint: 'Ej. unidad en planta baja, estacionamiento accesible, etc.',
    yes: 'Sí',
    no: 'No',
  },
  pt: {
    // PT: tentative — review
    dv_label: 'Algum membro da família é vítima de violência doméstica, violência no namoro, agressão sexual ou perseguição?',
    dv_confidentiality: 'Esta informação é usada para avaliar prioridade e conectar você a recursos de apoio. É mantida estritamente confidencial conforme a política da Stanton.', // PT: tentative — review
    homeless_label: 'Algum membro da família está atualmente sem moradia ou em risco de ficar sem moradia?',
    homeless_confidentiality: 'Esta informação ajuda a determinar prioridade para assistência habitacional. É confidencial e não afetará sua elegibilidade.', // PT: tentative — review
    ra_label: 'Algum membro da família precisa de acomodação razoável devido a uma deficiência?',
    ra_confidentiality: 'Solicitar uma acomodação é voluntário e confidencial. Não afetará sua elegibilidade para moradia.', // PT: tentative — review
    ra_description: 'Descreva a acomodação solicitada',
    ra_hint: 'Ex.: unidade no térreo, estacionamento acessível, etc.',
    yes: 'Sim',
    no: 'Não',
  },
};

function YesNo({ name, value, onChange, yesLabel, noLabel }: {
  name: string; value: boolean | null; onChange: (v: boolean) => void;
  yesLabel: string; noLabel: string;
}) {
  return (
    <div className="flex gap-4 mt-2" role="radiogroup" aria-required="true">
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

type IntakeDvHomelessRaWithNeutral = Omit<IntakeDvHomelessRa, 'dv_status' | 'homeless_at_admission' | 'reasonable_accommodation_requested'> & {
  dv_status: boolean | null;
  homeless_at_admission: boolean | null;
  reasonable_accommodation_requested: boolean | null;
};

export default function SectionDvHomelessRa({ language, intakeData, onChange }: Props) {
  const c = copy[language] ?? copy.en;
  const existing = intakeData.dv_homeless_ra;

  const [data, setData] = useState<IntakeDvHomelessRaWithNeutral>(existing
    ? { ...existing }
    : {
        dv_status: null,
        homeless_at_admission: null,
        reasonable_accommodation_requested: null,
      }
  );

  const emit = (updated: IntakeDvHomelessRaWithNeutral) => {
    onChange('dv_homeless_ra', updated as unknown as Record<string, unknown>);
  };

  useEffect(() => { emit(data); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (patch: Partial<IntakeDvHomelessRaWithNeutral>) => {
    const updated = { ...data, ...patch };
    setData(updated);
    emit(updated);
  };

  return (
    <div className="space-y-6">
      <FormSection background>
        <p className="text-sm">{c.dv_label}</p>
        <p className="text-xs text-[var(--muted)] mt-1">{c.dv_confidentiality}</p>
        <YesNo name="dv_status" value={data.dv_status}
          onChange={(v) => set({ dv_status: v })}
          yesLabel={c.yes} noLabel={c.no} />
      </FormSection>

      <FormSection background>
        <p className="text-sm">{c.homeless_label}</p>
        <p className="text-xs text-[var(--muted)] mt-1">{c.homeless_confidentiality}</p>
        <YesNo name="homeless_at_admission" value={data.homeless_at_admission}
          onChange={(v) => set({ homeless_at_admission: v })}
          yesLabel={c.yes} noLabel={c.no} />
      </FormSection>

      <FormSection background>
        <p className="text-sm">{c.ra_label}</p>
        <p className="text-xs text-[var(--muted)] mt-1">{c.ra_confidentiality}</p>
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
