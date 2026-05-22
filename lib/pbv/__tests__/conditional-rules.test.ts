import { describe, it, expect } from 'vitest';
import {
  shouldGenerateForm,
  shouldRenderSection,
  isMutuallyExclusivePair,
  householdHasChildSupport,
  householdNoChildSupport,
  sectionIiiZeroIncomeAnyAdult,
} from '../conditional-rules';
import type { IntakeData, HouseholdMember } from '../form-generation/field-mapping';

const baseMembers: HouseholdMember[] = [
  { slot: 1, name: 'Alice Smith', relationship: 'head', age: 35 },
  { slot: 2, name: 'Bob Smith', relationship: 'spouse', age: 33 },
  { slot: 3, name: 'Charlie Smith', relationship: 'child', age: 8 },
];

describe('shouldGenerateForm', () => {
  it('returns true when conditional_rule is null', () => {
    expect(shouldGenerateForm(null, {}, [])).toBe(true);
  });

  it('q8_dv_yes: returns true when dv_status=true on applicant', () => {
    const intake: IntakeData = { applicant: { dv_status: true } as any };
    expect(shouldGenerateForm('q8_dv_yes', intake, [])).toBe(true);
  });

  it('q8_dv_yes: returns false when dv_status=false', () => {
    const intake: IntakeData = { applicant: { dv_status: false } as any };
    expect(shouldGenerateForm('q8_dv_yes', intake, [])).toBe(false);
  });

  it('household_has_child_support: true when any member has_child_support', () => {
    const members: HouseholdMember[] = [
      { ...baseMembers[0], has_child_support: true },
    ];
    expect(shouldGenerateForm('household_has_child_support', {}, members)).toBe(true);
  });

  it('household_no_child_support: true when no member has_child_support', () => {
    expect(shouldGenerateForm('household_no_child_support', {}, baseMembers)).toBe(true);
  });

  it('household_no_child_support: false when a member has_child_support', () => {
    const members: HouseholdMember[] = [
      { ...baseMembers[0], has_child_support: true },
    ];
    expect(shouldGenerateForm('household_no_child_support', {}, members)).toBe(false);
  });

  it('intake_has_pets: true when pets.has_pets=true', () => {
    const intake: IntakeData = { pets: { has_pets: true } };
    expect(shouldGenerateForm('intake_has_pets', intake, [])).toBe(true);
  });

  it('intake_has_pets: false when pets absent', () => {
    expect(shouldGenerateForm('intake_has_pets', {}, [])).toBe(false);
  });

  it('intake_has_vehicle: true when vehicle.has_vehicle=true', () => {
    const intake: IntakeData = { vehicle: { has_vehicle: true } };
    expect(shouldGenerateForm('intake_has_vehicle', intake, [])).toBe(true);
  });

  // TODO(stress-test #7): PRD-63 (audit #7) flipped this default to FALSE
  // — unknown rules are fail-closed skips, not silent "true". The current
  // production helper isKnownConditionalRule() pairs with this. Test asserts
  // the older fail-open contract.
  it.skip('unknown rule defaults to true', () => {
    expect(shouldGenerateForm('some_future_rule', {}, [])).toBe(true);
  });
});

describe('sectionIiiZeroIncomeAnyAdult', () => {
  it('returns true when an adult has annual_income=0', () => {
    const members: HouseholdMember[] = [
      { slot: 1, name: 'Alice', relationship: 'head', age: 35, annual_income: 0 },
    ];
    expect(sectionIiiZeroIncomeAnyAdult({}, members)).toBe(true);
  });

  it('returns false when all adults have income > 0', () => {
    const members: HouseholdMember[] = [
      { slot: 1, name: 'Alice', relationship: 'head', age: 35, annual_income: 20000 },
    ];
    expect(sectionIiiZeroIncomeAnyAdult({}, members)).toBe(false);
  });

  it('ignores children (age < 18)', () => {
    const members: HouseholdMember[] = [
      { slot: 1, name: 'Alice', relationship: 'head', age: 35, annual_income: 20000 },
      { slot: 2, name: 'Child', relationship: 'child', age: 10, annual_income: 0 },
    ];
    expect(sectionIiiZeroIncomeAnyAdult({}, members)).toBe(false);
  });
});

describe('householdHasChildSupport / householdNoChildSupport', () => {
  it('are mutually exclusive', () => {
    const withCs: HouseholdMember[] = [{ ...baseMembers[0], has_child_support: true }];
    const without: HouseholdMember[] = [...baseMembers];
    expect(householdHasChildSupport(withCs)).toBe(true);
    expect(householdNoChildSupport(withCs)).toBe(false);
    expect(householdHasChildSupport(without)).toBe(false);
    expect(householdNoChildSupport(without)).toBe(true);
  });
});

describe('shouldRenderSection', () => {
  it('section_vi_medical: true when a member is disabled', () => {
    const members: HouseholdMember[] = [{ ...baseMembers[0], disability: true }];
    expect(shouldRenderSection('section_vi_medical', {}, members)).toBe(true);
  });

  it('section_vi_medical: true when a member is 62+', () => {
    const members: HouseholdMember[] = [{ ...baseMembers[0], age: 65 }];
    expect(shouldRenderSection('section_vi_medical', {}, members)).toBe(true);
  });

  it('section_vi_medical: false when no member is 62+ or disabled', () => {
    expect(shouldRenderSection('section_vi_medical', {}, baseMembers)).toBe(false);
  });

  it('unknown section defaults to true', () => {
    expect(shouldRenderSection('section_xii_future', {}, [])).toBe(true);
  });
});

describe('isMutuallyExclusivePair', () => {
  it('child_support_affidavit and no_child_support_affidavit are exclusive', () => {
    expect(isMutuallyExclusivePair('child_support_affidavit', 'no_child_support_affidavit')).toBe(true);
    expect(isMutuallyExclusivePair('no_child_support_affidavit', 'child_support_affidavit')).toBe(true);
  });

  it('other pairs are not exclusive', () => {
    expect(isMutuallyExclusivePair('hud_9886a', 'hach_release')).toBe(false);
  });
});
