'use client';

/**
 * components/pbv/intake/SectionReview.tsx
 * Section 11 — Review Your Answers
 *
 * Read-only summary grouped by section, with Edit links.
 * "Submit my answers" → POST intake/complete → triggers form generation.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { tenantFetch } from '@/lib/tenantFetch';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, SectionSlug } from '@/lib/pbv/intake-schema';

interface Props {
  language: PreferredLanguage;
  intakeData: IntakeData;
  token: string;
  onNavigateTo: (slug: SectionSlug) => void;
  onSubmitted: () => void;
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    edit: 'Edit',
    not_answered: 'Not answered',
    submit_btn: 'Submit my answers',
    submitting: 'Submitting…',
    error_prefix: 'Could not submit: ',
    section_1: 'About Your Household',
    section_2: 'Contact Information',
    section_3: 'Income',
    section_4: 'Zero Income Declaration',
    section_5: 'Assets',
    section_6: 'Childcare & Disability',
    section_7: 'Medical Expenses',
    section_8: 'Criminal History',
    section_9: 'Special Circumstances',
    section_10: 'Household Expenses',
    review_intro: 'Please review your answers before submitting. Use the Edit links to make corrections.',
  },
  es: {
    edit: 'Editar',
    not_answered: 'Sin responder',
    submit_btn: 'Enviar mis respuestas',
    submitting: 'Enviando…',
    error_prefix: 'No se pudo enviar: ',
    section_1: 'Sobre su hogar',
    section_2: 'Información de contacto',
    section_3: 'Ingresos',
    section_4: 'Declaración de cero ingresos',
    section_5: 'Activos',
    section_6: 'Cuidado infantil y discapacidad',
    section_7: 'Gastos médicos',
    section_8: 'Historial criminal',
    section_9: 'Circunstancias especiales',
    section_10: 'Gastos del hogar',
    review_intro: 'Revise sus respuestas antes de enviar. Use los enlaces Editar para hacer correcciones.',
  },
  pt: {
    // PT: tentative — review
    edit: 'Editar',
    not_answered: 'Não respondido',
    submit_btn: 'Enviar minhas respostas',
    submitting: 'Enviando…',
    error_prefix: 'Não foi possível enviar: ',
    section_1: 'Sobre sua família',
    section_2: 'Informações de contato',
    section_3: 'Renda',
    section_4: 'Declaração de renda zero',
    section_5: 'Bens',
    section_6: 'Creche e deficiência',
    section_7: 'Despesas médicas',
    section_8: 'Histórico criminal',
    section_9: 'Circunstâncias especiais',
    section_10: 'Despesas domésticas',
    review_intro: 'Revise suas respostas antes de enviar. Use os links Editar para fazer correções.',
  },
};

interface ReviewBlock {
  slug: SectionSlug;
  titleKey: string;
  summary: string;
}

function buildSummary(intakeData: IntakeData): ReviewBlock[] {
  const blocks: ReviewBlock[] = [];

  const h = intakeData.household;
  blocks.push({
    slug: 'household',
    titleKey: 'section_1',
    summary: h
      ? `${h.hoh_name || '—'}, DOB ${h.hoh_dob || '—'} · ${h.members?.length ?? 1} member(s)`
      : '—',
  });

  const c = intakeData.contact;
  blocks.push({
    slug: 'contact',
    titleKey: 'section_2',
    summary: c
      ? [c.phone_cell, c.phone_home, c.phone_work].filter(Boolean).join(', ') || '—'
      : '—',
  });

  const inc = intakeData.income;
  blocks.push({
    slug: 'income',
    titleKey: 'section_3',
    summary: inc
      ? inc.by_member.map((m) => `${m.member_name}: ${m.has_any_income ? `$${m.annual_income.toLocaleString()}/yr` : 'No income'}`).join(' · ')
      : '—',
  });

  if (intakeData.zero_income_decl) {
    blocks.push({
      slug: 'zero_income_decl',
      titleKey: 'section_4',
      summary: `${intakeData.zero_income_decl.adults.length} declaration(s)`,
    });
  }

  const a = intakeData.assets;
  blocks.push({
    slug: 'assets',
    titleKey: 'section_5',
    summary: a
      ? `Total: $${(a.total_asset_value ?? 0).toLocaleString()}`
      : '—',
  });

  const cd = intakeData.childcare_disability;
  blocks.push({
    slug: 'childcare_disability',
    titleKey: 'section_6',
    summary: cd
      ? [
          cd.has_care4kids && 'Care 4 Kids',
          cd.paid_to_relative && 'Paid relative',
          cd.disability_care_expenses && 'Disability care',
        ].filter(Boolean).join(', ') || 'None'
      : '—',
  });

  if (intakeData.medical) {
    blocks.push({
      slug: 'medical',
      titleKey: 'section_7',
      summary: `Insurance: ${intakeData.medical.has_medical_insurance ? 'Yes' : 'No'}`,
    });
  }

  const ch = intakeData.criminal_history;
  blocks.push({
    slug: 'criminal_history',
    titleKey: 'section_8',
    summary: ch
      ? ch.by_member.map((m) => `${m.member_name}: ${m.has_criminal_history ? 'Yes' : 'No'}`).join(' · ')
      : '—',
  });

  const dv = intakeData.dv_homeless_ra;
  blocks.push({
    slug: 'dv_homeless_ra',
    titleKey: 'section_9',
    summary: dv
      ? [
          dv.dv_status && 'DV',
          dv.homeless_at_admission && 'Homeless',
          dv.reasonable_accommodation_requested && 'RA requested',
        ].filter(Boolean).join(', ') || 'None'
      : '—',
  });

  if (intakeData.household_expenses) {
    const he = intakeData.household_expenses;
    const total = (he.monthly_rent ?? 0) + (he.monthly_utilities ?? 0) + (he.monthly_food ?? 0);
    blocks.push({
      slug: 'household_expenses',
      titleKey: 'section_10',
      summary: `Total monthly: $${total.toLocaleString()}`,
    });
  }

  return blocks;
}

export default function SectionReview({ language, intakeData, token, onNavigateTo, onSubmitted }: Props) {
  const c = copy[language] ?? copy.en;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const blocks = buildSummary(intakeData);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/intake/complete`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || `Submit failed (${res.status})`);
      }
      onSubmitted();
      router.push(`/pbv-full-app/${token}/dashboard`);
    } catch (err: any) {
      setError(err.message || 'Submit failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--body)]">{c.review_intro}</p>

      {blocks.map((block) => (
        <div key={block.slug} className="border border-[var(--border)] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--body)]">{c[block.titleKey]}</p>
            <button
              type="button"
              onClick={() => onNavigateTo(block.slug)}
              className="text-xs text-[var(--primary)] underline underline-offset-2 hover:opacity-75 min-h-[44px] px-2"
            >
              {c.edit}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">{block.summary || c.not_answered}</p>
        </div>
      ))}

      {error && (
        <p className="text-sm text-[var(--error)]">{c.error_prefix}{error}</p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full min-h-[44px] bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-opacity"
      >
        {submitting ? c.submitting : c.submit_btn}
      </button>
    </div>
  );
}
