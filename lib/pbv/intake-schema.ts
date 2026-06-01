/**
 * lib/pbv/intake-schema.ts
 *
 * Canonical schema for intake_data JSONB. Consumed by:
 *   - PRD-25 section components (UI)
 *   - PRD-24 intake/[section] POST (API validation)
 *
 * One interface per section slug. The top-level IntakeData type matches
 * the shape stored in pbv_full_applications.intake_data.
 */

// ── Section slugs ──────────────────────────────────────────────────────────────

export const SECTION_SLUGS = [
  'household',
  'contact',
  'income',
  'zero_income_decl',
  'assets',
  'childcare_disability',
  'medical',
  'criminal_history',
  'dv_homeless_ra',
  'household_expenses',
  'review',
] as const;

export type SectionSlug = (typeof SECTION_SLUGS)[number];

// Always-rendered sections (never conditional)
export const ALWAYS_SECTIONS: SectionSlug[] = [
  'household',
  'contact',
  'income',
  'assets',
  'childcare_disability',
  'criminal_history',
  'dv_homeless_ra',
];

// Conditional sections — shown by useSectionVisibility
export const CONDITIONAL_SECTIONS: SectionSlug[] = [
  'zero_income_decl',
  'medical',
  'household_expenses',
];

// ── Section 1 — household ──────────────────────────────────────────────────────

export interface IntakeMember {
  slot: number;
  name: string;
  dob: string;
  relationship: string;
  ssn_last_four?: string;
  disability: boolean;
  student: boolean;
  citizenship_status: string;
  is_minor: boolean;
}

export interface IntakeHousehold {
  hoh_name: string;
  hoh_dob: string;
  hoh_ssn_last_four?: string;
  race?: string;
  ethnicity?: string;
  marital_status?: string;
  members: IntakeMember[];
}

// ── Section 2 — contact ────────────────────────────────────────────────────────

export interface IntakeContact {
  phone_home?: string;
  phone_work?: string;
  phone_cell?: string;
  email?: string;
  alt_contact_name?: string;
  alt_contact_phone?: string;
  // Current address city/state/zip (the street lives on the application row). Fills
  // main_application + criminal_background_release current-address fields. (WS-D #2)
  city?: string;
  state?: string;
  zip?: string;
  // Previous address — criminal_background_release. (WS-D #2)
  prev_street?: string;
  prev_apt?: string;
  prev_city?: string;
  prev_state?: string;
  prev_zip?: string;
  // Emergency / additional contact extras — hud_92006 (name/phone already above). (WS-D #6)
  alt_contact_address?: string;
  alt_contact_email?: string;
  alt_contact_relationship?: string;
}

// ── Section 3 — income ─────────────────────────────────────────────────────────

export interface IntakeIncomeSource {
  type: string;
  has_income: boolean;
  member_name?: string;
  amount_monthly?: number;
  /** Employer / payer / institution name — the main_application income table's
   *  "Source" column. Optional; never gates section completion. (WS-D) */
  source?: string;
}

export interface IntakeMemberIncome {
  member_slot: number;
  member_name: string;
  income_sources: IntakeIncomeSource[];
  has_any_income: boolean;
  annual_income: number; // Derived from monthly amounts (× 12)
}

export interface IntakeIncome {
  by_member: IntakeMemberIncome[];
  has_zero_income_adult: boolean;
}

// ── Section 4 — zero_income_decl ──────────────────────────────────────────────

export interface IntakeZeroIncomeAdult {
  member_slot: number;
  member_name: string;
  support_explanation: string;
  outside_contributions: string;
}

export interface IntakeZeroIncomeDecl {
  adults: IntakeZeroIncomeAdult[];
}

// ── Section 5 — assets ─────────────────────────────────────────────────────────

export interface IntakeAssets {
  has_real_estate: boolean;
  has_savings: boolean;
  has_checking: boolean;
  has_stocks: boolean;
  has_cd: boolean;
  has_trust: boolean;
  has_bonds: boolean;
  has_life_insurance: boolean;
  has_insurance_settlement: boolean;
  disposed_asset_last_2yr: boolean;
  disposed_asset_value?: number;
  total_asset_value?: number;
}

// ── Section 6 — childcare_disability ──────────────────────────────────────────

export interface IntakeChildcareDisability {
  has_care4kids: boolean;
  paid_to_relative: boolean;
  disability_care_expenses: boolean;
  childcare_monthly_amount?: number;
  disability_monthly_amount?: number;
}

// ── Section 7 — medical ────────────────────────────────────────────────────────

export interface IntakeMedical {
  has_medical_insurance: boolean;
  monthly_insurance_cost?: number;
  monthly_doctor_visits?: number;
  monthly_prescriptions?: number;
  monthly_other_medical?: number;
}

// ── Section 8 — criminal_history ──────────────────────────────────────────────

export interface IntakeMemberCriminal {
  member_slot: number;
  member_name: string;
  has_criminal_history: boolean;
  details?: string;
}

export interface IntakeCriminalHistory {
  by_member: IntakeMemberCriminal[];
}

// ── Section 9 — dv_homeless_ra ────────────────────────────────────────────────

export interface IntakeDvHomelessRa {
  dv_status: boolean;
  homeless_at_admission: boolean;
  reasonable_accommodation_requested: boolean;
  ra_description?: string;
}

// ── Section 10 — household_expenses ───────────────────────────────────────────

export interface IntakeHouseholdExpenses {
  monthly_rent?: number;
  monthly_utilities?: number;
  monthly_food?: number;
  monthly_transportation?: number;
  monthly_other?: number;
  expense_explanation?: string;
}

// ── Section 11 — pets (PRD-55 cross-dependency) ──────────────────────────────────

export interface IntakePets {
  has_pets: boolean;
}

// ── Section 12 — vehicle (PRD-55 cross-dependency) ───────────────────────────────

export interface IntakeVehicle {
  has_vehicle: boolean;
}

// ── Top-level IntakeData ───────────────────────────────────────────────────────

export interface IntakeData {
  household?: IntakeHousehold;
  contact?: IntakeContact;
  income?: IntakeIncome;
  zero_income_decl?: IntakeZeroIncomeDecl;
  assets?: IntakeAssets;
  childcare_disability?: IntakeChildcareDisability;
  medical?: IntakeMedical;
  criminal_history?: IntakeCriminalHistory;
  dv_homeless_ra?: IntakeDvHomelessRa;
  household_expenses?: IntakeHouseholdExpenses;
  pets?: IntakePets; // PRD-55 cross-dependency
  vehicle?: IntakeVehicle; // PRD-55 cross-dependency
  _last_saved_at?: string;
}

// ── Section required-field validators ─────────────────────────────────────────

/** Returns true if the section has minimum required data to proceed. */
export function isSectionComplete(slug: SectionSlug, intakeData: IntakeData): boolean {
  switch (slug) {
    case 'household': {
      const h = intakeData.household;
      return !!(h?.hoh_name?.trim() && h?.hoh_dob && h?.members && h.members.length >= 1);
    }
    case 'contact': {
      const c = intakeData.contact;
      return !!(c?.phone_home || c?.phone_cell || c?.phone_work);
    }
    case 'income': {
      const inc = intakeData.income;
      return !!(inc?.by_member && inc.by_member.length > 0);
    }
    case 'zero_income_decl': {
      const z = intakeData.zero_income_decl;
      return !!(z?.adults && z.adults.every((a) => a.support_explanation?.trim()));
    }
    case 'assets': {
      return !!intakeData.assets;
    }
    case 'childcare_disability': {
      return !!intakeData.childcare_disability;
    }
    case 'medical': {
      return !!intakeData.medical;
    }
    case 'criminal_history': {
      const ch = intakeData.criminal_history;
      return !!(ch?.by_member && ch.by_member.length > 0 && ch.by_member.every((m) => typeof m.has_criminal_history === 'boolean' && m.has_criminal_history !== null));
    }
    case 'dv_homeless_ra': {
      const dv = intakeData.dv_homeless_ra;
      return (
        typeof dv?.dv_status === 'boolean' && dv.dv_status !== null &&
        typeof dv?.homeless_at_admission === 'boolean' && dv.homeless_at_admission !== null &&
        typeof dv?.reasonable_accommodation_requested === 'boolean' && dv.reasonable_accommodation_requested !== null
      );
    }
    case 'household_expenses': {
      return !!intakeData.household_expenses;
    }
    case 'review':
      return false;
    default:
      return false;
  }
}
