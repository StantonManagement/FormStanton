/**
 * lib/pbv/conditional-rules.ts
 *
 * Predicate functions for per-form and per-section conditional rules.
 * Used by:
 *   - generate-forms endpoint (which forms to generate)
 *   - PRD-25 intake UI (which sections to show)
 *   - PRD-26 review-and-sign UI (which forms to sign)
 *
 * Rule keys match pbv_form_templates.conditional_rule values.
 * All rules return boolean.
 *
 * PRD-63 (fail-closed): unknown conditional_rule values resolve to `false`
 * (do NOT generate the form), and log an error. This is the inverse of the
 * pre-PRD-63 behavior (which defaulted to true, silently over-generating any
 * form gated on a typo'd or newly-added rule). Callers that need to
 * distinguish "unknown rule" from "known rule, evaluated false" should consult
 * `isKnownConditionalRule(rule)` before invoking `shouldGenerateForm`.
 */

import type { IntakeData, HouseholdMember } from './form-generation/field-mapping';

// ─── Per-form rule predicates ─────────────────────────────────────────────────

/** Returns true if the DV disclosure was made (VAWA certification required). */
export function q8DvYes(intakeData: IntakeData): boolean {
  return (intakeData as any)?.applicant?.dv_status === true
    || (intakeData as any)?.dv_status === true;
}

/** Returns true if reasonable accommodation was requested. */
export function q10ReasonableAccommodationYes(intakeData: IntakeData): boolean {
  return (intakeData as any)?.applicant?.reasonable_accommodation_requested === true
    || (intakeData as any)?.reasonable_accommodation_requested === true;
}

/** Returns true if any household member has zero income (self-certification required). */
export function sectionIiiZeroIncomeAnyAdult(
  intakeData: IntakeData,
  members: HouseholdMember[]
): boolean {
  const adults = members.filter((m) => (m.age ?? 0) >= 18);
  return adults.some((m) => (m.annual_income ?? 0) === 0);
}

/** Returns true if any member has child_support income (child support affidavit required). */
export function householdHasChildSupport(members: HouseholdMember[]): boolean {
  return members.some((m) => m.has_child_support === true);
}

/** Returns true when NO member has child_support income (no-child-support affidavit required). */
export function householdNoChildSupport(members: HouseholdMember[]): boolean {
  return !householdHasChildSupport(members);
}

/** Returns true if any member has self-employment income. */
export function householdHasSelfEmployment(members: HouseholdMember[]): boolean {
  return members.some((m) => m.has_self_employment === true);
}

/** Returns true if household has pets (pet addendum required). */
export function intakeHasPets(intakeData: IntakeData): boolean {
  return (intakeData as any)?.pets?.has_pets === true;
}

/** Returns true if household has a vehicle (vehicle addendum required). */
export function intakeHasVehicle(intakeData: IntakeData): boolean {
  return (intakeData as any)?.vehicle?.has_vehicle === true;
}

// ─── Per-section predicates (used by intake UI render logic) ─────────────────

/** Section VI medical: show if any adult is 62+ or disabled. */
export function shouldRenderSectionVIMedical(members: HouseholdMember[]): boolean {
  return members.some(
    (m) => m.disability === true || (m.age != null && m.age >= 62)
  );
}

/** Section VIII household expenses: show if intake_data indicates zero-income adults. */
export function shouldRenderSectionVIIIExpenses(
  intakeData: IntakeData,
  members: HouseholdMember[]
): boolean {
  return sectionIiiZeroIncomeAnyAdult(intakeData, members);
}

// ─── Known-rules registry (PRD-63) ───────────────────────────────────────────
//
// Canonical list of every rule string `shouldGenerateForm` recognises. Kept
// next to the switch so adding a new case here and not in the switch (or vice
// versa) is one-line obvious. Used by callers to differentiate "rule unknown"
// from "rule known, evaluated false".

export const KNOWN_CONDITIONAL_RULES = [
  'q8_dv_yes',
  'q10_reasonable_accommodation_yes',
  'section_iii_zero_income_any_adult',
  'household_has_child_support',
  'household_no_child_support',
  'household_has_self_employment',
  'intake_has_pets',
  'intake_has_vehicle',
] as const;

export type KnownConditionalRule = (typeof KNOWN_CONDITIONAL_RULES)[number];

/**
 * Returns true if `rule` is one of the known conditional-rule keys (or null,
 * which `shouldGenerateForm` treats as "always generate"). False means the rule
 * string is unrecognized — `shouldGenerateForm` will fail closed.
 */
export function isKnownConditionalRule(rule: string | null): boolean {
  if (rule === null) return true;
  return (KNOWN_CONDITIONAL_RULES as readonly string[]).includes(rule);
}

// ─── Main dispatcher ─────────────────────────────────────────────────────────

/**
 * Evaluate whether a form should be generated, given its conditional_rule string.
 * Returns true if the form should be generated for this application.
 *
 * @param conditionalRule - value from pbv_form_templates.conditional_rule (null = always generate)
 * @param intakeData      - intake_data JSONB from pbv_full_applications
 * @param members         - household members from pbv_household_members
 */
export function shouldGenerateForm(
  conditionalRule: string | null,
  intakeData: IntakeData,
  members: HouseholdMember[]
): boolean {
  if (!conditionalRule) return true;

  switch (conditionalRule) {
    case 'q8_dv_yes':
      return q8DvYes(intakeData);
    case 'q10_reasonable_accommodation_yes':
      return q10ReasonableAccommodationYes(intakeData);
    case 'section_iii_zero_income_any_adult':
      return sectionIiiZeroIncomeAnyAdult(intakeData, members);
    case 'household_has_child_support':
      return householdHasChildSupport(members);
    case 'household_no_child_support':
      return householdNoChildSupport(members);
    case 'household_has_self_employment':
      return householdHasSelfEmployment(members);
    case 'intake_has_pets':
      return intakeHasPets(intakeData);
    case 'intake_has_vehicle':
      return intakeHasVehicle(intakeData);
    default:
      // PRD-63 (audit #7): fail closed on unknown rule. A typo or newly-added
      // template rule should NOT cause the gated form to silently generate.
      console.error(`[conditional-rules] Unknown conditional_rule: "${conditionalRule}" — failing closed (return false)`);
      return false;
  }
}

/**
 * Evaluate whether a UI section should be rendered.
 *
 * @param sectionKey - e.g. 'section_vi_medical', 'section_viii_expenses'
 * @param intakeData - intake_data JSONB
 * @param members    - household members
 */
export function shouldRenderSection(
  sectionKey: string,
  intakeData: IntakeData,
  members: HouseholdMember[]
): boolean {
  switch (sectionKey) {
    case 'section_vi_medical':
      return shouldRenderSectionVIMedical(members);
    case 'section_viii_expenses':
      return shouldRenderSectionVIIIExpenses(intakeData, members);
    default:
      return true;
  }
}

/**
 * Returns true if formA and formB are mutually exclusive (only one should be generated).
 * Currently: child_support_affidavit and no_child_support_affidavit.
 */
export function isMutuallyExclusivePair(formA: string, formB: string): boolean {
  const pairs = [
    new Set(['child_support_affidavit', 'no_child_support_affidavit']),
  ];
  return pairs.some((pair) => pair.has(formA) && pair.has(formB));
}
