'use client';

/**
 * components/pbv/IntakeDataDisplay.tsx
 * Shared component for rendering intake data sections.
 * Used by SectionReview (review mode) and print view (print mode).
 */

import type { ReactNode } from 'react';
import type { PreferredLanguage } from '@/types/compliance';
import type { IntakeData, SectionSlug } from '@/lib/pbv/intake-schema';
import { useSectionVisibility } from '@/lib/pbv/hooks/useSectionVisibility';
import {
  RACE_LABELS,
  ETHNICITY_LABELS,
  MARITAL_STATUS_LABELS,
  INCOME_TYPE_LABELS,
  RELATIONSHIP_LABELS,
  CITIZENSHIP_LABELS,
  formatPhone,
  formatEnumLabel,
} from '@/lib/pbv/format';

interface Props {
  intakeData: IntakeData;
  language: PreferredLanguage;
  mode?: 'review' | 'print';
  visibleSlugs?: SectionSlug[]; // Optional override for visible sections
}

const copy: Record<PreferredLanguage, Record<string, string>> = {
  en: {
    not_answered: 'Not answered',
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
    yes: 'Yes',
    no: 'No',
    per_year: '/yr',
    per_month: '/mo',
    member: 'Member',
    hoh: 'Head of Household',
    no_income: 'No income',
    has_pets: 'Has pets',
    has_vehicle: 'Has vehicle',
  },
  es: {
    not_answered: 'Sin responder',
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
    yes: 'Si',
    no: 'No',
    per_year: '/ano',
    per_month: '/mes',
    member: 'Miembro',
    hoh: 'Jefe de hogar',
    no_income: 'Sin ingresos',
    has_pets: 'Tiene mascotas',
    has_vehicle: 'Tiene vehículo',
  },
  pt: {
    // PT: tentative -- review
    not_answered: 'Nao respondido',
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
    yes: 'Sim',
    no: 'Nao',
    per_year: '/ano',
    per_month: '/mes',
    member: 'Membro',
    hoh: 'Chefe de familia',
    no_income: 'Sem renda',
    has_pets: 'Tem animais de estimacao', // PT: tentative — review
    has_vehicle: 'Tem veiculo', // PT: tentative — review
  },
};

interface DisplayBlock {
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

function Row({ label, value, mode }: { label: string; value: ReactNode; mode: 'review' | 'print' }) {
  if (mode === 'print') {
    return (
      <div className="flex gap-4 text-sm leading-relaxed">
        <span className="text-gray-600 min-w-[160px] shrink-0">{label}</span>
        <span className="text-gray-900 break-words">{value || '--'}</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-[var(--muted)] min-w-[140px] shrink-0">{label}</span>
      <span className="text-[var(--body)] break-words">{value || '--'}</span>
    </div>
  );
}

function SectionHeader({ title, mode }: { title: string; mode: 'review' | 'print' }) {
  if (mode === 'print') {
    return <h3 className="text-base font-semibold text-gray-900 border-b border-gray-300 pb-2 mb-3">{title}</h3>;
  }
  return <p className="text-sm font-medium text-[var(--body)]">{title}</p>;
}

function buildBlocks(
  intakeData: IntakeData,
  visibleSlugs: SectionSlug[],
  c: Record<string, string>,
  mode: 'review' | 'print'
): DisplayBlock[] {
  const blocks: DisplayBlock[] = [];
  const visible = new Set(visibleSlugs);

  if (visible.has('household')) {
    const h = intakeData.household;
    blocks.push({
      slug: 'household',
      titleKey: 'section_1',
      content: h ? (
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          <Row label={c.hoh} value={h.hoh_name || '--'} mode={mode} />
          <Row label="DOB" value={h.hoh_dob || '--'} mode={mode} />
          {h.hoh_ssn_last_four && <Row label="SSN (last 4)" value={'***-**-' + h.hoh_ssn_last_four} mode={mode} />}
          {h.race && <Row label="Race" value={formatEnumLabel(h.race, RACE_LABELS)} mode={mode} />}
          {h.ethnicity && <Row label="Ethnicity" value={formatEnumLabel(h.ethnicity, ETHNICITY_LABELS)} mode={mode} />}
          {h.marital_status && <Row label="Marital status" value={formatEnumLabel(h.marital_status, MARITAL_STATUS_LABELS)} mode={mode} />}
          {(h.members ?? []).filter((m) => m.slot !== 1).map((m) => (
            <div key={m.slot} className={mode === 'print' ? 'pt-2 mt-2 border-t border-gray-200 space-y-2' : 'pt-1 mt-1 border-t border-[var(--border)] space-y-1'}>
              <Row label={c.member + ' ' + m.slot} value={m.name} mode={mode} />
              <Row label="DOB" value={m.dob || '--'} mode={mode} />
              <Row label="Relationship" value={formatEnumLabel(m.relationship, RELATIONSHIP_LABELS)} mode={mode} />
              {m.ssn_last_four && <Row label="SSN (last 4)" value={'***-**-' + m.ssn_last_four} mode={mode} />}
              <Row label="Disability" value={yesNo(m.disability, c)} mode={mode} />
              <Row label="Student" value={yesNo(m.student, c)} mode={mode} />
              <Row label="Citizenship" value={formatEnumLabel(m.citizenship_status, CITIZENSHIP_LABELS)} mode={mode} />
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          {contact.phone_cell && <Row label="Cell" value={formatPhone(contact.phone_cell)} mode={mode} />}
          {contact.phone_home && <Row label="Home" value={formatPhone(contact.phone_home)} mode={mode} />}
          {contact.phone_work && <Row label="Work" value={formatPhone(contact.phone_work)} mode={mode} />}
          {contact.email && <Row label="Email" value={contact.email} mode={mode} />}
          {contact.alt_contact_name && <Row label="Alt contact" value={contact.alt_contact_name} mode={mode} />}
          {contact.alt_contact_phone && <Row label="Alt phone" value={formatPhone(contact.alt_contact_phone)} mode={mode} />}
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
        <div className={mode === 'print' ? 'space-y-4' : 'space-y-2'}>
          {inc.by_member.map((m) => (
            <div key={m.member_slot} className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
              <p className={mode === 'print' ? 'text-sm font-medium text-gray-900' : 'text-xs font-medium text-[var(--body)]'}>{m.member_name}</p>
              {m.has_any_income ? (
                <>
                  {m.income_sources.filter((s) => s.has_income).map((s) => (
                    <Row
                      key={s.type}
                      label={formatEnumLabel(s.type, INCOME_TYPE_LABELS)}
                      value={s.amount_monthly !== undefined ? fmtMoney(s.amount_monthly) + '/mo' : c.yes}
                      mode={mode}
                    />
                  ))}
                  {/* Compute annual from monthly amounts (intake stores monthly, display shows annual) */}
                  {(() => {
                    const annualTotal = m.income_sources
                      .filter((s) => s.has_income && typeof s.amount_monthly === 'number')
                      .reduce((sum, s) => sum + ((s.amount_monthly as number) * 12), 0);
                    return <Row label="Annual total" value={fmtMoney(annualTotal) + c.per_year} mode={mode} />;
                  })()}
                </>
              ) : (
                <p className={mode === 'print' ? 'text-sm text-gray-600' : 'text-xs text-[var(--muted)]'}>{c.no_income}</p>
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
        <div className={mode === 'print' ? 'space-y-4' : 'space-y-2'}>
          {zid.adults.map((a) => (
            <div key={a.member_slot} className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
              <p className={mode === 'print' ? 'text-sm font-medium text-gray-900' : 'text-xs font-medium text-[var(--body)]'}>{a.member_name}</p>
              {a.support_explanation && <Row label="Support explanation" value={a.support_explanation} mode={mode} />}
              {a.outside_contributions && <Row label="Outside contributions" value={a.outside_contributions} mode={mode} />}
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          <Row label="Real estate" value={yesNo(a.has_real_estate, c)} mode={mode} />
          <Row label="Savings account" value={yesNo(a.has_savings, c)} mode={mode} />
          <Row label="Checking account" value={yesNo(a.has_checking, c)} mode={mode} />
          <Row label="Stocks" value={yesNo(a.has_stocks, c)} mode={mode} />
          <Row label="CDs" value={yesNo(a.has_cd, c)} mode={mode} />
          <Row label="Trust" value={yesNo(a.has_trust, c)} mode={mode} />
          <Row label="Bonds" value={yesNo(a.has_bonds, c)} mode={mode} />
          <Row label="Life insurance (cash value)" value={yesNo(a.has_life_insurance, c)} mode={mode} />
          <Row label="Insurance settlement" value={yesNo(a.has_insurance_settlement, c)} mode={mode} />
          <Row label="Disposed asset (last 2yr)" value={yesNo(a.disposed_asset_last_2yr, c)} mode={mode} />
          {a.disposed_asset_last_2yr && a.disposed_asset_value !== undefined && (
            <Row label="Disposed value" value={fmtMoney(a.disposed_asset_value)} mode={mode} />
          )}
          <Row label="Total asset value" value={fmtMoney(a.total_asset_value)} mode={mode} />
          {/* Phase 6: Pets/vehicle on review (PRD-55 cross-dependency) */}
          {intakeData.pets !== undefined && (
            <Row label={c.has_pets} value={yesNo(intakeData.pets?.has_pets, c)} mode={mode} />
          )}
          {intakeData.vehicle !== undefined && (
            <Row label={c.has_vehicle} value={yesNo(intakeData.vehicle?.has_vehicle, c)} mode={mode} />
          )}
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          <Row label="Care 4 Kids" value={yesNo(cd.has_care4kids, c)} mode={mode} />
          <Row label="Paid to relative" value={yesNo(cd.paid_to_relative, c)} mode={mode} />
          <Row label="Disability care expenses" value={yesNo(cd.disability_care_expenses, c)} mode={mode} />
          {cd.childcare_monthly_amount !== undefined && (
            <Row label="Childcare monthly" value={fmtMoney(cd.childcare_monthly_amount) + c.per_month} mode={mode} />
          )}
          {cd.disability_monthly_amount !== undefined && (
            <Row label="Disability care monthly" value={fmtMoney(cd.disability_monthly_amount) + c.per_month} mode={mode} />
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          <Row label="Has medical insurance" value={yesNo(med.has_medical_insurance, c)} mode={mode} />
          {med.monthly_insurance_cost !== undefined && (
            <Row label="Insurance cost" value={fmtMoney(med.monthly_insurance_cost) + c.per_month} mode={mode} />
          )}
          {med.monthly_doctor_visits !== undefined && (
            <Row label="Doctor visits" value={fmtMoney(med.monthly_doctor_visits) + c.per_month} mode={mode} />
          )}
          {med.monthly_prescriptions !== undefined && (
            <Row label="Prescriptions" value={fmtMoney(med.monthly_prescriptions) + c.per_month} mode={mode} />
          )}
          {med.monthly_other_medical !== undefined && (
            <Row label="Other medical" value={fmtMoney(med.monthly_other_medical) + c.per_month} mode={mode} />
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
        <div className={mode === 'print' ? 'space-y-4' : 'space-y-2'}>
          {ch.by_member.map((m) => (
            <div key={m.member_slot} className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
              <p className={mode === 'print' ? 'text-sm font-medium text-gray-900' : 'text-xs font-medium text-[var(--body)]'}>{m.member_name}</p>
              <Row label="Has criminal history" value={yesNo(m.has_criminal_history, c)} mode={mode} />
              {m.has_criminal_history && m.details && (
                <Row label="Details" value={m.details} mode={mode} />
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          <Row label="Domestic violence" value={yesNo(dv.dv_status, c)} mode={mode} />
          <Row label="Homeless at admission" value={yesNo(dv.homeless_at_admission, c)} mode={mode} />
          <Row label="Reasonable accommodation" value={yesNo(dv.reasonable_accommodation_requested, c)} mode={mode} />
          {dv.reasonable_accommodation_requested && dv.ra_description && (
            <Row label="RA description" value={dv.ra_description} mode={mode} />
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
        <div className={mode === 'print' ? 'space-y-2' : 'space-y-1'}>
          {he.monthly_rent !== undefined && <Row label="Rent" value={fmtMoney(he.monthly_rent) + c.per_month} mode={mode} />}
          {he.monthly_utilities !== undefined && <Row label="Utilities" value={fmtMoney(he.monthly_utilities) + c.per_month} mode={mode} />}
          {he.monthly_food !== undefined && <Row label="Food" value={fmtMoney(he.monthly_food) + c.per_month} mode={mode} />}
          {he.monthly_transportation !== undefined && <Row label="Transportation" value={fmtMoney(he.monthly_transportation) + c.per_month} mode={mode} />}
          {he.monthly_other !== undefined && <Row label="Other" value={fmtMoney(he.monthly_other) + c.per_month} mode={mode} />}
          {he.expense_explanation && <Row label="Explanation" value={he.expense_explanation} mode={mode} />}
        </div>
      ),
    });
  }

  return blocks;
}

export default function IntakeDataDisplay({ intakeData, language, mode = 'review', visibleSlugs }: Props) {
  const c = copy[language] ?? copy.en;
  const derivedVisibleSlugs = useSectionVisibility(intakeData);
  const effectiveVisibleSlugs = visibleSlugs ?? derivedVisibleSlugs;
  const blocks = buildBlocks(intakeData, effectiveVisibleSlugs, c, mode);

  if (mode === 'print') {
    return (
      <div className="space-y-6">
        {blocks.map((block) => (
          <section key={block.slug} className="break-inside-avoid">
            <SectionHeader title={c[block.titleKey]} mode={mode} />
            <div className="text-sm text-gray-900">{block.content}</div>
          </section>
        ))}
      </div>
    );
  }

  // Review mode: compact blocks without section wrappers
  return (
    <div className="space-y-6">
      {blocks.map((block) => (
        <div key={block.slug} className="border border-[var(--border)] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[var(--body)]">{c[block.titleKey]}</p>
          </div>
          <div className="text-xs text-[var(--muted)]">{block.content}</div>
        </div>
      ))}
    </div>
  );
}
