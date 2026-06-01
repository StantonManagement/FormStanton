import { describe, it, expect } from 'vitest';
import { resolveFieldData } from '../form-generation/field-mapping';
import type { HouseholdMember, AppRow } from '../form-generation/field-mapping';
import type { IntakeData } from '../intake-schema';

// ─────────────────────────────────────────────────────────────────────────────
// These fixtures mirror the REAL stored shapes (pbv_household_members rows +
// pbv_full_applications.intake_snapshot + app row), captured from production
// applicants Mia Lozada and Santha Degross on 2026-05-31.
//
// The previous version of this test fed a FICTIONAL `{ applicant: {...} }` shape
// that intake never produces — which is why it stayed green while every
// intake-sourced field shipped blank. See docs/pbv-forms/field-audit_2026-05-31.md.
// Do NOT reintroduce an `applicant` key here.
// ─────────────────────────────────────────────────────────────────────────────

// Mia — single adult, employed.
const miaMembers: HouseholdMember[] = [
  {
    slot: 1,
    name: 'Mia Enid Lozada',
    relationship: 'head',
    age: 31,
    date_of_birth: '1994-05-28',
    ssn_last_four: '7407',
    annual_income: 32400,
    employed: true,
    disability: false,
    student: false,
    citizenship_status: 'citizen',
  },
];
const miaIntake: IntakeData = {
  contact: {
    email: 'mialozada94@gmail.com',
    phone_cell: '8608347644',
    phone_home: '',
    phone_work: '',
    alt_contact_name: '',
    alt_contact_phone: '',
  },
  household: {
    hoh_name: 'Mia Enid Lozada',
    hoh_dob: '1994-05-28',
    race: 'other',
    ethnicity: 'hispanic',
    marital_status: 'single',
    members: [],
  },
  income: {
    by_member: [
      {
        member_slot: 1,
        member_name: 'Mia Enid Lozada',
        has_any_income: true,
        annual_income: 32400,
        income_sources: [{ type: 'employment', has_income: true, amount_monthly: 2700 }],
      },
    ],
    has_zero_income_adult: false,
  },
};
const miaApp: AppRow = { building_address: '31-33 Park St', unit_number: 'Retail 1', phone: '8608347644' };

// Santha — 2 members incl. a 16-yo minor.
const santhaMembers: HouseholdMember[] = [
  { slot: 1, name: 'Santha Lee Degross', relationship: 'head', age: 31, date_of_birth: '1994-11-25', ssn_last_four: '6444', citizenship_status: 'citizen' },
  { slot: 2, name: 'Angelisse Milagros Carrillo', relationship: 'child', age: 16, date_of_birth: '2009-12-25', ssn_last_four: '4454', student: true, citizenship_status: 'citizen' },
];
const santhaApp: AppRow = { building_address: '10 Example Ave', unit_number: '2B', phone: '8605551212' };
const santhaIntake: IntakeData = { contact: { email: 's@example.com', phone_cell: '8605551212' }, household: { hoh_name: 'Santha Lee Degross', hoh_dob: '1994-11-25', members: [] } };

describe('resolveFieldData — real intake shape (regression guard for blank forms)', () => {
  describe('main_application', () => {
    const r = resolveFieldData('main_application', miaIntake, miaMembers, 'en', 1, miaApp);
    it('fills contact block from intake_snapshot.contact (was blank — bug A)', () => {
      expect(r.applicant_full_name).toBe('Mia Enid Lozada');
      expect(r.applicant_email).toBe('mialozada94@gmail.com');
      expect(r.phone_cell).toBe('8608347644');
    });
    it('fills address from the application row (was blank — bug A)', () => {
      expect(r.address_street).toBe('31-33 Park St, Retail 1');
    });
    it('still builds the adults/minors composition rows', () => {
      expect((r.adults as any[])[0].first).toBe('Mia');
      expect((r.adults as any[])[0].last).toBe('Lozada');
      expect(Array.isArray(r.minors)).toBe(true);
    });
    it('fills Disabled/Student/Citizen Yes/No columns (was no map column — bug C)', () => {
      const a = (r.adults as any[])[0];
      expect(a.disabled).toBe('No');
      expect(a.student).toBe('No');
      expect(a.citizen).toBe('Yes'); // citizenship_status === 'citizen'
    });
    it('normalizes race/ethnicity/marital to a single form-box value (was unhandled — bug A/C)', () => {
      expect(r.race_box).toBe('other'); // intake 'other'
      expect(r.ethnicity_box).toBe('yes'); // hispanic → Yes box
      expect(r.marital_box).toBe('single');
    });
  });

  describe('demographics + status normalization edge cases', () => {
    it('folds multi-racial into the Other box and blanks not_reported', () => {
      const mk = (race: string): IntakeData => ({ ...miaIntake, household: { ...miaIntake.household!, race } });
      expect(resolveFieldData('main_application', mk('multi'), miaMembers, 'en', 1, miaApp).race_box).toBe('other');
      expect(resolveFieldData('main_application', mk('not_reported'), miaMembers, 'en', 1, miaApp).race_box).toBe('');
    });
    it('answers the DV and sold-assets Yes/No questions, blank when unrecorded', () => {
      // Mia's real shape: dv recorded false, assets has no disposed flag.
      const recorded: IntakeData = {
        ...miaIntake,
        dv_homeless_ra: { dv_status: false, homeless_at_admission: false, reasonable_accommodation_requested: false },
        assets: { vehicle: { has_vehicle: false } } as any,
      };
      const r = resolveFieldData('main_application', recorded, miaMembers, 'en', 1, miaApp);
      expect(r.q_dv).toBe('no');
      expect(r.q_sold_assets).toBe(''); // disposed flag absent → blank, not "no"

      const affirmative: IntakeData = {
        ...miaIntake,
        dv_homeless_ra: { dv_status: true, homeless_at_admission: false, reasonable_accommodation_requested: false },
        assets: { has_real_estate: false, has_savings: false, has_checking: false, has_stocks: false, has_cd: false, has_trust: false, has_bonds: false, has_life_insurance: false, has_insurance_settlement: false, disposed_asset_last_2yr: true },
      };
      const r2 = resolveFieldData('main_application', affirmative, miaMembers, 'en', 1, miaApp);
      expect(r2.q_dv).toBe('yes');
      expect(r2.q_sold_assets).toBe('yes');
    });

    it('marks a minor student Yes and leaves an unrecorded boolean blank', () => {
      const r = resolveFieldData('main_application', santhaIntake, santhaMembers, 'en', 1, santhaApp);
      const minor = (r.minors as any[])[0];
      expect(minor.student).toBe('Yes');
      expect(minor.citizen).toBe('Yes');
      // Santha (slot 1) has no `disability` recorded in the roster → blank, not "No".
      expect((r.adults as any[])[0].disabled).toBe('');
    });
  });

  describe('hach_release (was 100% blank — bug B key mismatch)', () => {
    const r = resolveFieldData('hach_release', miaIntake, miaMembers, 'en', 1, miaApp);
    it('emits applicant_name + applicant_address matching the map field names', () => {
      expect(r.applicant_name).toBe('Mia Enid Lozada');
      expect(r.applicant_address).toBe('31-33 Park St, Retail 1');
    });
  });

  describe('obligations_of_family (was blank — bug B)', () => {
    const r = resolveFieldData('obligations_of_family', miaIntake, miaMembers, 'en', 1, miaApp);
    it('emits hoh_name/hoh_phone/hoh_address matching map field names', () => {
      expect(r.hoh_name).toBe('Mia Enid Lozada');
      expect(r.hoh_phone).toBe('8608347644');
      expect(r.hoh_address).toBe('31-33 Park St, Retail 1');
    });
  });

  describe('hud_9886a (was blank — bug B ssn key)', () => {
    it('emits hoh_ssn (the map field name), masked', () => {
      const r = resolveFieldData('hud_9886a', miaIntake, miaMembers, 'en', 1, miaApp);
      expect(r.hoh_ssn).toBe('XXX-XX-7407');
    });
  });

  describe('hud_92006', () => {
    it('emits mailing_address + telephone (were blank — bug A/B)', () => {
      const r = resolveFieldData('hud_92006', miaIntake, miaMembers, 'en', 1, miaApp);
      expect(r.applicant_name).toBe('Mia Enid Lozada');
      expect(r.mailing_address).toBe('31-33 Park St, Retail 1');
      expect(r.telephone).toBe('8608347644');
    });
  });

  describe('criminal_background_release', () => {
    it('fills current address from the app row; name from members', () => {
      const r = resolveFieldData('criminal_background_release', miaIntake, miaMembers, 'en', 1, miaApp);
      expect(r.first_name).toBe('Mia');
      expect(r.last_name).toBe('Lozada');
      expect(r.current_address_street).toBe('31-33 Park St');
      // DOB must be the calendar date, not shifted a day by UTC parsing (TZ bug).
      expect(r.dob).toBe('5/28/1994');
    });
  });

  describe('no_child_support_affidavit (was blank — bug B/E)', () => {
    it('emits affiant_name; children_names empty when no minors (Mia)', () => {
      const r = resolveFieldData('no_child_support_affidavit', miaIntake, miaMembers, 'en', 1, miaApp);
      expect(r.affiant_name).toBe('Mia Enid Lozada');
      expect(r.children_names).toBe('');
    });
    it('lists household minors for a family with children (Santha)', () => {
      const r = resolveFieldData('no_child_support_affidavit', santhaIntake, santhaMembers, 'en', 1, santhaApp);
      expect(r.affiant_name).toBe('Santha Lee Degross');
      expect(r.children_names).toBe('Angelisse Milagros Carrillo');
    });
  });

  describe('citizenship_declaration (already correct)', () => {
    it('includes all members with name + dob + status', () => {
      const r = resolveFieldData('citizenship_declaration', santhaIntake, santhaMembers, 'en', 1, santhaApp);
      expect((r.members as any[]).length).toBe(2);
      expect((r.members as any[])[0].name).toBe('Santha Lee Degross');
    });
  });

  describe('income table is placed by fixed income TYPE (not sequentially)', () => {
    it('groups each source under its form-row data_key with member + monthly amount + Yes', () => {
      const r = resolveFieldData('main_application', miaIntake, miaMembers, 'en', 1, miaApp);
      // Mia: employment $2,700/mo → the Employed row group, not a generic list.
      expect(r.income_employment).toEqual([
        { member: 'Mia Enid Lozada', source: '', amount: '2700.00', yes: 'X' },
      ]);
      // The old sequential-fill key is gone (that was the mislabeling hazard).
      expect(r.income_rows).toBeUndefined();
    });
    it('routes other-typed income to the Other row, not Employed', () => {
      const intake: IntakeData = {
        ...santhaIntake,
        income: {
          by_member: [
            { member_slot: 1, member_name: 'Santha Lee Degross', has_any_income: true, annual_income: 6000, income_sources: [{ type: 'other', has_income: true, amount_monthly: 500 }] },
          ],
          has_zero_income_adult: false,
        },
      };
      const r = resolveFieldData('main_application', intake, santhaMembers, 'en', 1, santhaApp);
      expect(r.income_other).toEqual([{ member: 'Santha Lee Degross', source: '', amount: '500.00', yes: 'X' }]);
      expect(r.income_employment).toBeUndefined();
    });
  });
});
