/**
 * lib/pbv/documentTriggers.ts
 *
 * Single source of truth for which intake responses trigger each doc_type.
 *
 * Each entry has:
 *   - doc_type: matches application_documents.doc_type
 *   - isTriggered: predicate receiving IntakeData → boolean
 *   - perMember: if true, the doc is expected once per adult member slot
 *                (the trigger checks whether ANY member triggers it)
 *
 * "Always required" docs (signed_forms, citizenship_declaration) have
 * isTriggered = () => true.
 *
 * Docs whose trigger returns false are set to 'no_longer_required'.
 * Docs not present in this config are left untouched (legacy / custom).
 */

import type { IntakeData } from './intake-schema';

export interface DocTrigger {
  doc_type: string;
  isTriggered: (intake: IntakeData) => boolean;
}

function anyMemberHasIncome(intake: IntakeData, type: string): boolean {
  return (
    intake.income?.by_member?.some((m) =>
      m.income_sources?.some((s) => s.type === type && s.has_income)
    ) ?? false
  );
}

function anyNonCitizenMember(intake: IntakeData): boolean {
  const members = intake.household?.members ?? [];
  return members.some((m) => m.citizenship_status && m.citizenship_status !== 'citizen');
}

function anyNonCitizenOver62(intake: IntakeData): boolean {
  const members = intake.household?.members ?? [];
  return members.some((m) => {
    if (!m.dob || m.citizenship_status === 'citizen') return false;
    const age = (Date.now() - new Date(m.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 62;
  });
}

export const DOCUMENT_TRIGGERS: DocTrigger[] = [
  // ── Identity docs (PRD-65, always required, sort first) ──────────────────
  {
    doc_type: 'government_id',
    isTriggered: () => true,
  },

  // ── Income docs ────────────────────────────────────────────────────────────
  {
    doc_type: 'paystubs',
    isTriggered: (d) => anyMemberHasIncome(d, 'employment'),
  },
  {
    doc_type: 'ssi_award_letter',
    isTriggered: (d) => anyMemberHasIncome(d, 'ssi'),
  },
  {
    doc_type: 'ss_award_letter',
    isTriggered: (d) => anyMemberHasIncome(d, 'ss') || anyMemberHasIncome(d, 'social_security'),
  },
  {
    doc_type: 'pension_letter',
    isTriggered: (d) => anyMemberHasIncome(d, 'pension'),
  },
  {
    doc_type: 'child_support_docs',
    isTriggered: (d) => anyMemberHasIncome(d, 'child_support'),
  },
  {
    doc_type: 'tanf_letter',
    isTriggered: (d) => anyMemberHasIncome(d, 'tanf'),
  },
  {
    doc_type: 'unemployment_letter',
    isTriggered: (d) =>
      anyMemberHasIncome(d, 'unemployment') || anyMemberHasIncome(d, 'workers_comp'),
  },
  {
    doc_type: 'self_employment_docs',
    isTriggered: (d) => anyMemberHasIncome(d, 'self_employment'),
  },
  {
    doc_type: 'digital_payment_statements',
    isTriggered: (d) => anyMemberHasIncome(d, 'digital_wallet'),
  },
  {
    doc_type: 'training_letter',
    isTriggered: () => true, // always optional — always show
  },

  // ── Asset docs ─────────────────────────────────────────────────────────────
  {
    doc_type: 'bank_statement_checking',
    isTriggered: (d) => d.assets?.has_checking === true,
  },
  {
    doc_type: 'bank_statement_savings',
    isTriggered: (d) => d.assets?.has_savings === true,
  },
  {
    doc_type: 'insurance_settlement',
    isTriggered: (d) => d.assets?.has_insurance_settlement === true,
  },
  {
    doc_type: 'cd_trust_bond',
    isTriggered: (d) =>
      d.assets?.has_cd === true || d.assets?.has_trust === true || d.assets?.has_bonds === true,
  },
  {
    doc_type: 'life_insurance_policy',
    isTriggered: (d) => d.assets?.has_life_insurance === true,
  },

  // ── Medical / childcare docs (always optional — show when section visible) ─
  {
    doc_type: 'medical_bills',
    isTriggered: (d) =>
      d.medical?.has_medical_insurance === true ||
      (d.medical?.monthly_doctor_visits ?? 0) > 0 ||
      (d.medical?.monthly_other_medical ?? 0) > 0,
  },
  {
    doc_type: 'pharmacy_statements',
    isTriggered: (d) => (d.medical?.monthly_prescriptions ?? 0) > 0,
  },
  {
    doc_type: 'care4kids_certificate',
    isTriggered: (d) =>
      d.childcare_disability?.has_care4kids === true ||
      (d.childcare_disability?.childcare_monthly_amount ?? 0) > 0,
  },

  // ── Immigration docs ───────────────────────────────────────────────────────
  {
    doc_type: 'immigration_docs',
    isTriggered: anyNonCitizenMember,
  },
  {
    doc_type: 'proof_of_age_noncitizen',
    isTriggered: anyNonCitizenOver62,
  },

  // ── Signed forms — always required ────────────────────────────────────────
  {
    doc_type: 'main_application',
    isTriggered: () => true,
  },
  {
    doc_type: 'citizenship_declaration',
    isTriggered: () => true,
  },
  {
    doc_type: 'criminal_background_release',
    isTriggered: () => true,
  },
  {
    doc_type: 'hud_9886a',
    isTriggered: () => true,
  },
  {
    doc_type: 'hud_92006',
    isTriggered: () => true,
  },
  {
    doc_type: 'debts_owed_phas',
    isTriggered: () => true,
  },
  {
    doc_type: 'eiv_guide_receipt',
    isTriggered: () => true,
  },
  {
    doc_type: 'briefing_docs_certification',
    isTriggered: () => true,
  },
  {
    doc_type: 'obligations_of_family',
    isTriggered: () => true,
  },
  {
    doc_type: 'hach_release',
    isTriggered: () => true,
  },
  {
    doc_type: 'child_support_affidavit',
    isTriggered: () => true,
  },
  {
    doc_type: 'no_child_support_affidavit',
    isTriggered: () => true,
  },

  // ── Custom / legacy docs — not gated ─────────────────────────────────────
  // bank_statement, birth_certificate, pay_stub, tax_return are legacy rows
  // from pre-F4. Leave them ungated (not in this list).
  // (government_id is now first-class — see Identity docs block above.)
];

/** Build a lookup map by doc_type for O(1) access */
export const TRIGGER_MAP: Map<string, DocTrigger> = new Map(
  DOCUMENT_TRIGGERS.map((t) => [t.doc_type, t])
);
