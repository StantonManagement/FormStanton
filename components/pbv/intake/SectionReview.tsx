'use client';

/**
 * components/pbv/intake/SectionReview.tsx
 * Section 11 — Review Your Answers
 *
 * Read-only summary grouped by section, with Edit links.
 * "Submit my answers" → POST intake/complete → triggers form generation.
 */

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { tenantFetch } from '@/lib/tenantFetch';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, SectionSlug } from '@/lib/pbv/intake-schema';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';

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
    submitting: 'Submitting...',
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
    yes: 'Yes',
    no: 'No',
    per_year: '/yr',
    per_month: '/mo',
    member: 'Member',
    hoh: 'Head of Household',
    no_income: 'No income',
  },
  es: {
    edit: 'Editar',
    not_answered: 'Sin responder',
    submit_btn: 'Enviar mis respuestas',
    submitting: 'Enviando...',
    error_prefix: 'No se pudo enviar: ',
    section_1: 'Sobre su hogar',
    section_2: 'Informacion de contacto',
    section_3: 'Ingresos',
    section_4: 'Declaracion de cero ingresos',
    section_5: 'Activos',
    section_6: 'Cuidado infantil y discapacidad',
    section_7: 'Gastos medicos',
    section_8: 'Historial criminal',
    section_9: 'Circunstancias especiales',
    section_10: 'Gastos del hogar',
    review_intro: 'Revise sus respuestas antes de enviar. Use los enlaces Editar para hacer correcciones.',
    yes: 'Si',
    no: 'No',
    per_year: '/ano',
    per_month: '/mes',
    member: 'Miembro',
    hoh: 'Jefe de hogar',
    no_income: 'Sin ingresos',
  },
  pt: {
    // PT: tentative -- review
    edit: 'Editar',
    not_answered: 'Nao respondido',
    submit_btn: 'Enviar minhas respostas',
    submitting: 'Enviando...',
    error_prefix: 'Nao foi possivel enviar: ',
    section_1: 'Sobre sua familia',
    section_2: 'Informacoes de contato',
    section_3: 'Renda',
    section_4: 'Declaracao de renda zero',
    section_5: 'Bens',
    section_6: 'Creche e deficiencia',
    section_7: 'Despesas medicas',
    section_8: 'Historico criminal',
    section_9: 'Circunstancias especiais',
    section_10: 'Despesas domesticas',
    review_intro: 'Revise suas respostas antes de enviar. Use os links Editar para fazer correcoes.',
    yes: 'Sim',
    no: 'Nao',
    per_year: '/ano',
    per_month: '/mes',
    member: 'Membro',
    hoh: 'Chefe de familia',
    no_income: 'Sem renda',
  },
};

interface ReviewBlock {
  slug: SectionSlug;
  titleKey: string;
  content: ReactNode;
}

function fmtMoney(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '--';
  return '$' + amount.toLocaleString();
}

function yesNo(val: boolean | undefined, c: Record<string, string>): string {
  if (val === undefined || val === null) return '--';
  return val ? c.yes : c.no;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[var(--muted)] min-w-[140px] shrink-0">{label}</span>
      <span className="text-[var(--body)] break-words">{value || '--'}</span>
    </div>
  );
}

function buildBlocks(
  intakeData: IntakeData,
  visibleSlugs: SectionSlug[],
  c: Record<string, string>
): ReviewBlock[] {
  const blocks: ReviewBlock[] = [];
  const visible = new Set(visibleSlugs);

  if (visible.has('household')) {
    const h = intakeData.household;
    blocks.push({
      slug: 'household',
      titleKey: 'section_1',
      content: h ? (
        <div className="space-y-1">
          <Row label={c.hoh} value={h.hoh_name || '--'} />
          <Row label="DOB" value={h.hoh_dob || '--'} />
          {h.hoh_ssn_last_four && <Row label="SSN (last 4)" value={'***-**-' + h.hoh_ssn_last_four} />}
          {h.race && <Row label="Race" value={h.race} />}
          {h.ethnicity && <Row label="Ethnicity" value={h.ethnicity} />}
          {h.marital_status && <Row label="Marital status" value={h.marital_status} />}
          {(h.members ?? []).filter((m) => m.slot !== 1).map((m) => (
            <div key={m.slot} className="pt-1 mt-1 border-t border-[var(--border)] space-y-1">
              <Row label={c.member + ' ' + m.slot} value={m.name} />
              <Row label="DOB" value={m.dob || '--'} />
              <Row label="Relationship" value={m.relationship} />
              {m.ssn_last_four && <Row label="SSN (last 4)" value={'***-**-' + m.ssn_last_four} />}
              <Row label="Disability" value={yesNo(m.disability, c)} />
              <Row label="Student" value={yesNo(m.student, c)} />
              <Row label="Citizenship" value={m.citizenship_status || '--'} />
            </div>
          ))}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('contact')) {
    const contact = intakeData.contact;
    blocks.push({
      slug: 'contact',
      titleKey: 'section_2',
      content: contact ? (
        <div className="space-y-1">
          {contact.phone_cell && <Row label="Cell" value={contact.phone_cell} />}
          {contact.phone_home && <Row label="Home" value={contact.phone_home} />}
          {contact.phone_work && <Row label="Work" value={contact.phone_work} />}
          {contact.email && <Row label="Email" value={contact.email} />}
          {contact.alt_contact_name && <Row label="Alt contact" value={contact.alt_contact_name} />}
          {contact.alt_contact_phone && <Row label="Alt phone" value={contact.alt_contact_phone} />}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('income')) {
    const inc = intakeData.income;
    blocks.push({
      slug: 'income',
      titleKey: 'section_3',
      content: inc ? (
        <div className="space-y-2">
          {inc.by_member.map((m) => (
            <div key={m.member_slot} className="space-y-1">
              <p className="text-xs font-medium text-[var(--body)]">{m.member_name}</p>
              {m.has_any_income ? (
                <>
                  {m.income_sources.filter((s) => s.has_income).map((s) => (
                    <Row
                      key={s.type}
                      label={s.type.replace(/_/g, ' ')}
                      value={s.amount_monthly !== undefined ? fmtMoney(s.amount_monthly) + '/mo' : c.yes}
                    />
                  ))}
                  <Row label="Annual total" value={fmtMoney(m.annual_income) + c.per_year} />
                </>
              ) : (
                <p className="text-xs text-[var(--muted)]">{c.no_income}</p>
              )}
            </div>
          ))}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('zero_income_decl') && intakeData.zero_income_decl) {
    const zid = intakeData.zero_income_decl;
    blocks.push({
      slug: 'zero_income_decl',
      titleKey: 'section_4',
      content: (
        <div className="space-y-2">
          {zid.adults.map((a) => (
            <div key={a.member_slot} className="space-y-1">
              <p className="text-xs font-medium text-[var(--body)]">{a.member_name}</p>
              {a.support_explanation && <Row label="Support explanation" value={a.support_explanation} />}
              {a.outside_contributions && <Row label="Outside contributions" value={a.outside_contributions} />}
            </div>
          ))}
        </div>
      ),
    });
  }

  if (visible.has('assets')) {
    const a = intakeData.assets;
    blocks.push({
      slug: 'assets',
      titleKey: 'section_5',
      content: a ? (
        <div className="space-y-1">
          <Row label="Real estate" value={yesNo(a.has_real_estate, c)} />
          <Row label="Savings account" value={yesNo(a.has_savings, c)} />
          <Row label="Checking account" value={yesNo(a.has_checking, c)} />
          <Row label="Stocks" value={yesNo(a.has_stocks, c)} />
          <Row label="CDs" value={yesNo(a.has_cd, c)} />
          <Row label="Trust" value={yesNo(a.has_trust, c)} />
          <Row label="Bonds" value={yesNo(a.has_bonds, c)} />
          <Row label="Life insurance (cash value)" value={yesNo(a.has_life_insurance, c)} />
          <Row label="Insurance settlement" value={yesNo(a.has_insurance_settlement, c)} />
          <Row label="Disposed asset (last 2yr)" value={yesNo(a.disposed_asset_last_2yr, c)} />
          {a.disposed_asset_last_2yr && a.disposed_asset_value !== undefined && (
            <Row label="Disposed value" value={fmtMoney(a.disposed_asset_value)} />
          )}
          <Row label="Total asset value" value={fmtMoney(a.total_asset_value)} />
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('childcare_disability')) {
    const cd = intakeData.childcare_disability;
    blocks.push({
      slug: 'childcare_disability',
      titleKey: 'section_6',
      content: cd ? (
        <div className="space-y-1">
          <Row label="Care 4 Kids" value={yesNo(cd.has_care4kids, c)} />
          <Row label="Paid to relative" value={yesNo(cd.paid_to_relative, c)} />
          <Row label="Disability care expenses" value={yesNo(cd.disability_care_expenses, c)} />
          {cd.childcare_monthly_amount !== undefined && (
            <Row label="Childcare monthly" value={fmtMoney(cd.childcare_monthly_amount) + c.per_month} />
          )}
          {cd.disability_monthly_amount !== undefined && (
            <Row label="Disability care monthly" value={fmtMoney(cd.disability_monthly_amount) + c.per_month} />
          )}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('medical') && intakeData.medical) {
    const med = intakeData.medical;
    blocks.push({
      slug: 'medical',
      titleKey: 'section_7',
      content: (
        <div className="space-y-1">
          <Row label="Has medical insurance" value={yesNo(med.has_medical_insurance, c)} />
          {med.monthly_insurance_cost !== undefined && (
            <Row label="Insurance cost" value={fmtMoney(med.monthly_insurance_cost) + c.per_month} />
          )}
          {med.monthly_doctor_visits !== undefined && (
            <Row label="Doctor visits" value={fmtMoney(med.monthly_doctor_visits) + c.per_month} />
          )}
          {med.monthly_prescriptions !== undefined && (
            <Row label="Prescriptions" value={fmtMoney(med.monthly_prescriptions) + c.per_month} />
          )}
          {med.monthly_other_medical !== undefined && (
            <Row label="Other medical" value={fmtMoney(med.monthly_other_medical) + c.per_month} />
          )}
        </div>
      ),
    });
  }

  if (visible.has('criminal_history')) {
    const ch = intakeData.criminal_history;
    blocks.push({
      slug: 'criminal_history',
      titleKey: 'section_8',
      content: ch ? (
        <div className="space-y-2">
          {ch.by_member.map((m) => (
            <div key={m.member_slot} className="space-y-1">
              <p className="text-xs font-medium text-[var(--body)]">{m.member_name}</p>
              <Row label="Has criminal history" value={yesNo(m.has_criminal_history, c)} />
              {m.has_criminal_history && m.details && (
                <Row label="Details" value={m.details} />
              )}
            </div>
          ))}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('dv_homeless_ra')) {
    const dv = intakeData.dv_homeless_ra;
    blocks.push({
      slug: 'dv_homeless_ra',
      titleKey: 'section_9',
      content: dv ? (
        <div className="space-y-1">
          <Row label="Domestic violence" value={yesNo(dv.dv_status, c)} />
          <Row label="Homeless at admission" value={yesNo(dv.homeless_at_admission, c)} />
          <Row label="Reasonable accommodation" value={yesNo(dv.reasonable_accommodation_requested, c)} />
          {dv.reasonable_accommodation_requested && dv.ra_description && (
            <Row label="RA description" value={dv.ra_description} />
          )}
        </div>
      ) : c.not_answered,
    });
  }

  if (visible.has('household_expenses') && intakeData.household_expenses) {
    const he = intakeData.household_expenses;
    blocks.push({
      slug: 'household_expenses',
      titleKey: 'section_10',
      content: (
        <div className="space-y-1">
          {he.monthly_rent !== undefined && <Row label="Rent" value={fmtMoney(he.monthly_rent) + c.per_month} />}
          {he.monthly_utilities !== undefined && <Row label="Utilities" value={fmtMoney(he.monthly_utilities) + c.per_month} />}
          {he.monthly_food !== undefined && <Row label="Food" value={fmtMoney(he.monthly_food) + c.per_month} />}
          {he.monthly_transportation !== undefined && <Row label="Transportation" value={fmtMoney(he.monthly_transportation) + c.per_month} />}
          {he.monthly_other !== undefined && <Row label="Other" value={fmtMoney(he.monthly_other) + c.per_month} />}
          {he.expense_explanation && <Row label="Explanation" value={he.expense_explanation} />}
        </div>
      ),
    });
  }

  return blocks;
}

export default function SectionReview({ language, intakeData, token, onNavigateTo, onSubmitted }: Props) {
  const c = copy[language] ?? copy.en;
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const visibleSlugs = useSectionVisibility(intakeData);
  const blocks = buildBlocks(intakeData, visibleSlugs, c);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await tenantFetch(`/api/t/${token}/pbv-full-app/intake/complete`, {
        method: 'POST',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Submit failed (' + res.status + ')');
      }
      onSubmitted();
      router.push('/pbv-full-app/' + token + '/dashboard');
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
          <div className="text-xs text-[var(--muted)]">{block.content}</div>
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
