/**
 * lib/pbv/form-generation/field-mapping.ts
 *
 * Resolves the intake_data + household member roster into a flat field_data
 * object ready to pass to stampForm(). One resolver per form_id.
 *
 * prefill_source conventions (from pbv-field-inventory.md):
 *   intake.applicant.*          → intake_data.applicant.*
 *   intake.household.member_list → derived from members array
 *   intake.income.*             → intake_data.income.*
 *   intake.citizenship.*        → intake_data.citizenship.*
 *   fresh_input                 → not pre-filled (left blank)
 *
 * Returns a Record<string, unknown> compatible with StamperInput.data.
 * Row-pattern arrays (adults, minors, income_rows, asset_rows, etc.) are
 * included as arrays under their data_key.
 */

import type { IntakeData as IntakeSnapshot } from '@/lib/pbv/intake-schema';

export interface HouseholdMember {
  id?: string;
  slot: number;
  name: string;
  date_of_birth?: string;
  age?: number | null;
  relationship: string;
  ssn_last_four?: string | null;
  annual_income?: number;
  income_sources?: string[];
  employed?: boolean;
  has_ssi?: boolean;
  has_ss?: boolean;
  has_pension?: boolean;
  has_tanf?: boolean;
  has_child_support?: boolean;
  has_unemployment?: boolean;
  has_self_employment?: boolean;
  has_other_income?: boolean;
  disability?: boolean;
  student?: boolean;
  citizenship_status?: string;
  documented_income?: number | null;
}

// The canonical intake snapshot shape lives in intake-schema.ts. Resolvers read it
// directly. The OLD local IntakeData here (applicant.*, income.rows, assets.rows)
// NEVER matched what intake actually stores (contact, income.by_member, assets.has_*)
// — that mismatch is exactly why every intake-sourced field shipped BLANK. See
// docs/pbv-forms/field-audit_2026-05-31.md. We re-export the real type under the
// historical name so the generate-forms route's cast stays correct.
export type IntakeData = IntakeSnapshot;

// Address + phone live on the pbv_full_applications ROW, not in the intake snapshot.
// The route passes them through so resolvers can stamp the applicant's address.
export interface AppRow {
  building_address?: string | null;
  unit_number?: string | null;
  phone?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDob(dob: string | undefined): string {
  if (!dob) return '';
  // Parse a plain YYYY-MM-DD as a CALENDAR date — `new Date('1994-05-28')` parses as
  // UTC midnight and then getDate() shifts a day backward in any TZ behind UTC
  // (stamped DOBs were rendering one day early off-UTC). Handle the common case
  // directly; fall back to Date for other formats.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob);
  if (ymd) return `${Number(ymd[2])}/${Number(ymd[3])}/${ymd[1]}`;
  try {
    const d = new Date(dob);
    if (isNaN(d.getTime())) return dob;
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  } catch {
    return dob;
  }
}

function nameParts(fullName: string): { last: string; first: string; mi: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { last: parts[0], first: '', mi: '' };
  if (parts.length === 2) return { last: parts[1], first: parts[0], mi: '' };
  return { last: parts[parts.length - 1], first: parts[0], mi: parts[1][0] ?? '' };
}

function ssnDisplay(lastFour: string | null | undefined): string {
  if (!lastFour) return '';
  return `XXX-XX-${lastFour}`;
}

// Contact block lives at intake_snapshot.contact (NOT the old fictional `applicant`).
function contactOf(intake: IntakeData): {
  email: string;
  phone_home: string;
  phone_work: string;
  phone_cell: string;
  phone_any: string;
  alt_contact_name: string;
  alt_contact_phone: string;
} {
  const c = intake?.contact ?? {};
  const phone_cell = c.phone_cell ?? '';
  const phone_home = c.phone_home ?? '';
  const phone_work = c.phone_work ?? '';
  return {
    email: c.email ?? '',
    phone_home,
    phone_work,
    phone_cell,
    phone_any: phone_cell || phone_home || phone_work || '',
    alt_contact_name: c.alt_contact_name ?? '',
    alt_contact_phone: c.alt_contact_phone ?? '',
  };
}

// The applicant's street address lives on the pbv_full_applications row
// (building_address + unit_number) — never in the intake snapshot. City/State/Zip
// are not stored separately yet (gap — see field audit), so csz is returned blank.
function addressOf(app: AppRow | undefined): { street: string; city_state_zip: string } {
  const street = (app?.building_address ?? '').trim();
  const unit = (app?.unit_number ?? '').trim();
  return {
    street: street ? (unit ? `${street}, ${unit}` : street) : '',
    city_state_zip: '',
  };
}

// A single phone for the applicant: prefer the intake contact cell, fall back to
// the application-row phone.
function applicantPhone(intake: IntakeData, app: AppRow | undefined): string {
  return contactOf(intake).phone_any || (app?.phone ?? '') || '';
}

// "City, ST Zip" assembled from the intake contact block (street is on the app row).
// Blank components are dropped so we never stamp stray commas. (WS-D #2)
function cityStateZip(intake: IntakeData): string {
  const c = intake?.contact ?? {};
  const cityState = [c.city, c.state].map((s) => (s ?? '').trim()).filter(Boolean).join(', ');
  return [cityState, (c.zip ?? '').trim()].filter(Boolean).join(' ').trim();
}

// Intake income `type` → the main_application income table's per-row-group data_key.
// The paper form has FIXED income-type rows (Employed / SSI / Social Security / …),
// so each intake type stamps onto its own labeled row(s) — NOT sequentially (that
// mislabeled income type). Types with no labeled row on the form (none today) are
// dropped. Form rows with no intake type (Railroad Retirement, Paid Training,
// Grants/Scholarships) stay blank. See docs/pbv-forms/field-audit_2026-05-31.md.
const INCOME_TYPE_TO_KEY: Record<string, string> = {
  employment: 'income_employment',
  pension: 'income_pension',
  ssi: 'income_ssi',
  ss: 'income_ss',
  child_support: 'income_child_support',
  tanf: 'income_tanf',
  snap: 'income_snap',
  self_employment: 'income_self_employment',
  unemployment: 'income_unemployment',
  workers_comp: 'income_workers_comp',
  rental: 'income_rental',
  gifts: 'income_gifts',
  digital_wallet: 'income_digital_wallet',
  other: 'income_other',
};

interface IncomeRow {
  member: string;
  source: string;
  amount: string;
  yes: string;
}

function formatMonthly(amount: number | null | undefined): string {
  if (amount == null || isNaN(amount)) return '';
  return amount.toFixed(2);
}

// A member's per-column Yes/No answer for the Disabled / Student / U.S. Citizen
// columns. Blank (not "No") when the underlying value was never recorded, so we
// never assert a negative we don't have.
function yesNoBlank(v: boolean | null | undefined): string {
  return v === true ? 'Yes' : v === false ? 'No' : '';
}

// Intake `household.race` → the main_application form's race checkbox value. The
// form has 6 race boxes; intake's `multi` has no box → folded into Other, and
// `not_reported` → blank. ethnicity/marital normalize the same way (the form has
// no Widowed box, so widowed stamps nothing). The map's per-option checkbox fields
// read these single values and stamp the one whose check_value matches.
const RACE_BOX: Record<string, string> = {
  white: 'white',
  black: 'black',
  asian: 'asian',
  pacific_islander: 'pacific_islander',
  native: 'native',
  multi: 'other',
  other: 'other',
};
function raceBox(h: IntakeData['household']): string {
  return RACE_BOX[h?.race ?? ''] ?? '';
}
function ethnicityBox(h: IntakeData['household']): string {
  const e = h?.ethnicity;
  return e === 'hispanic' ? 'yes' : e === 'not_hispanic' ? 'no' : '';
}
function maritalBox(h: IntakeData['household']): string {
  const m = h?.marital_status ?? '';
  return ['single', 'married', 'separated', 'divorced', 'widowed'].includes(m) ? m : '';
}

// Group every affirmative income source under its form-row data_key. Each entry is
// a {member, source, amount, yes} row the map's per-type row_pattern stamps. The
// `source` (employer / institution name) is uncollected today (WS-D) → blank.
function buildIncomeRows(intake: IntakeData): Record<string, IncomeRow[]> {
  const out: Record<string, IncomeRow[]> = {};
  for (const m of intake?.income?.by_member ?? []) {
    for (const src of m.income_sources ?? []) {
      if (!src.has_income) continue;
      const key = INCOME_TYPE_TO_KEY[src.type];
      if (!key) continue;
      (out[key] ??= []).push({
        member: m.member_name || src.member_name || '',
        source: src.source ?? '', // employer/payer — WS-D collected; blank if not given
        amount: formatMonthly(src.amount_monthly),
        yes: 'X',
      });
    }
  }
  return out;
}

// Per-asset detail → the main_application asset table (free rows: member / source /
// value). Only assets with any detail are emitted. (WS-D #3)
function buildAssetRows(intake: IntakeData): Array<{ member: string; source: string; value: string }> {
  const details = intake?.assets?.asset_details ?? [];
  return details
    .filter((d) => (d.institution ?? '').trim() || d.value != null || (d.owner ?? '').trim())
    .map((d) => ({
      member: (d.owner ?? '').trim(),
      source: (d.institution ?? '').trim(),
      value: formatMonthly(d.value),
    }));
}

// ─── Per-form resolvers ───────────────────────────────────────────────────────

function resolveMainApplication(
  intakeData: IntakeData,
  members: HouseholdMember[],
  _language: 'en' | 'es',
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const contact = contactOf(intakeData);
  const addr = addressOf(appRow);

  const adults = members.filter((m) => (m.age ?? 0) >= 18);
  const minors = members.filter((m) => (m.age ?? 99) < 18);

  const adultRows = adults.map((m) => {
    const parts = nameParts(m.name);
    return {
      last: parts.last,
      first: parts.first,
      mi: parts.mi,
      dob: formatDob(m.date_of_birth),
      ssn: ssnDisplay(m.ssn_last_four),
      // Slot 1 (HOH) relationship is PRE-PRINTED on the source form ("SELF" en / "YO" es)
      // in the first adults-table relationship cell. Emit blank so we don't stamp a
      // duplicate over it. Non-HOH adults stamp their actual relationship.
      relationship: m.slot === 1 ? '' : m.relationship,
      age: m.age != null ? String(m.age) : '',
      disabled: yesNoBlank(m.disability),
      student: yesNoBlank(m.student),
      citizen: m.citizenship_status ? (m.citizenship_status === 'citizen' ? 'Yes' : 'No') : '',
    };
  });

  const minorRows = minors.map((m) => {
    const parts = nameParts(m.name);
    return {
      last: parts.last,
      first: parts.first,
      mi: parts.mi,
      dob: formatDob(m.date_of_birth),
      ssn: ssnDisplay(m.ssn_last_four),
      relationship: m.relationship,
      age: m.age != null ? String(m.age) : '',
      disabled: yesNoBlank(m.disability),
      student: yesNoBlank(m.student),
      citizen: m.citizenship_status ? (m.citizenship_status === 'citizen' ? 'Yes' : 'No') : '',
    };
  });

  const hohMember = members.find((m) => m.slot === 1);
  const hohParts = hohMember ? nameParts(hohMember.name) : { last: '', first: '', mi: '' };

  return {
    applicant_full_name: hohMember?.name ?? '',
    applicant_email: contact.email,
    phone_home: contact.phone_home,
    phone_work: contact.phone_work,
    phone_cell: contact.phone_cell,
    address_street: addr.street,
    address_city_state_zip: cityStateZip(intakeData),
    alternate_contact_name: contact.alt_contact_name,
    alternate_contact_phone: contact.alt_contact_phone,
    hoh_last: hohParts.last,
    hoh_first: hohParts.first,
    date: dateStr,
    // Race / ethnicity / marital — normalized to a single form-box value each; the
    // map's per-option checkbox fields stamp the box whose check_value matches.
    race_box: raceBox(intakeData?.household),
    ethnicity_box: ethnicityBox(intakeData?.household),
    marital_box: maritalBox(intakeData?.household),
    // Single Yes/No questions answerable from intake. q_dv = "victim of domestic
    // violence?" (Q8); q_sold_assets = "sold/given away assets in last 2 years?"
    // (Q3). 'yes'/'no'/'' — blank when never recorded. (The criminal-history Q7 is
    // a per-crime-type table, not a single Yes/No, and intake holds only a per-member
    // boolean, so it is intentionally not stamped here.)
    q_dv: intakeData?.dv_homeless_ra?.dv_status === true ? 'yes'
      : intakeData?.dv_homeless_ra?.dv_status === false ? 'no' : '',
    q_sold_assets: intakeData?.assets?.disposed_asset_last_2yr === true ? 'yes'
      : intakeData?.assets?.disposed_asset_last_2yr === false ? 'no' : '',
    adults: adultRows,
    minors: minorRows,
    // Income table: each intake income type stamps onto its own FIXED labeled row
    // group (income_employment / income_ssi / …) via per-type row_patterns in the
    // map — never sequentially (that mislabeled income type). See buildIncomeRows.
    ...buildIncomeRows(intakeData),
    // Asset table now fills from per-asset detail collected in intake (WS-D #3).
    asset_rows: buildAssetRows(intakeData),
    // Medical-expense table still needs per-line detail intake doesn't collect.
    medical_rows: [],
  };
}

function resolveSingleSignature(
  members: HouseholdMember[],
  signerSlot: number,
  dateStr: string
): Record<string, unknown> {
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const parts = member ? nameParts(member.name) : { last: '', first: '', mi: '' };
  return {
    printed_name: member?.name ?? '',
    last_name: parts.last,
    first_name: parts.first,
    dob: formatDob(member?.date_of_birth),
    date: dateStr,
    signature_date: dateStr,
  };
}

function resolveHud9886a(
  intakeData: IntakeData,
  members: HouseholdMember[],
  signerSlot: number,
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const addr = addressOf(appRow);
  return {
    hoh_name: member?.name ?? '',
    address: addr.street,
    // Map field is `hoh_ssn` (was emitted as `ssn` → never matched → blank).
    hoh_ssn: ssnDisplay(member?.ssn_last_four),
    ssn: ssnDisplay(member?.ssn_last_four),
    dob: formatDob(member?.date_of_birth),
    date: dateStr,
    ...resolveSingleSignature(members, signerSlot, dateStr),
    signature_rows: members
      .filter((m) => (m.age ?? 0) >= 18)
      .map((m) => ({
        name: m.name,
        ssn: ssnDisplay(m.ssn_last_four),
        dob: formatDob(m.date_of_birth),
        date: dateStr,
      })),
  };
}

function resolveHachRelease(
  intakeData: IntakeData,
  members: HouseholdMember[],
  signerSlot: number,
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const addr = addressOf(appRow);
  // Map fields are `applicant_name` / `applicant_address` (were emitted as
  // `printed_name` / `address` → never matched → entire form blank).
  return {
    applicant_name: member?.name ?? '',
    applicant_address: addr.street,
    printed_name: member?.name ?? '',
    address: addr.street,
    date: dateStr,
    signature_date: dateStr,
  };
}

function resolveHud92006(
  intakeData: IntakeData,
  members: HouseholdMember[],
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const contact = contactOf(intakeData);
  const addr = addressOf(appRow);
  const hoh = members.find((m) => m.slot === 1);
  // Map fields: applicant_name (matched), mailing_address (was `address`),
  // telephone, additional_contact_* (the optional emergency contact).
  const csz = cityStateZip(intakeData);
  const cc = intakeData?.contact ?? {};
  return {
    applicant_name: hoh?.name ?? '',
    mailing_address: csz ? `${addr.street}, ${csz}` : addr.street,
    telephone: applicantPhone(intakeData, appRow),
    additional_contact_name: contact.alt_contact_name,
    additional_contact_phone: contact.alt_contact_phone,
    // Emergency-contact extras — collected in intake (WS-D #6).
    additional_contact_address: (cc.alt_contact_address ?? '').trim(),
    additional_contact_email: (cc.alt_contact_email ?? '').trim(),
    additional_contact_relationship: (cc.alt_contact_relationship ?? '').trim(),
    address: addr.street,
    date: dateStr,
    signature_date: dateStr,
  };
}

function resolveCitizenshipDeclaration(
  members: HouseholdMember[]
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const rows = members.map((m) => ({
    name: m.name,
    dob: formatDob(m.date_of_birth),
    citizenship_status: m.citizenship_status ?? 'not_reported',
    date: dateStr,
  }));
  return {
    hoh_name: members.find((m) => m.slot === 1)?.name ?? '',
    date: dateStr,
    hoh_signature_date: dateStr,
    members: rows,
  };
}

function resolveObligationsOfFamily(
  intakeData: IntakeData,
  members: HouseholdMember[],
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const addr = addressOf(appRow);
  const hoh = members.find((m) => m.slot === 1);
  // Map fields are `hoh_name` / `hoh_address` / `hoh_phone` (were emitted as
  // `hoh_printed_name` / `address` / `phone` → never matched → blank).
  return {
    hoh_name: hoh?.name ?? '',
    hoh_address: addr.street,
    hoh_phone: applicantPhone(intakeData, appRow),
    hoh_printed_name: hoh?.name ?? '',
    date: dateStr,
    hoh_signature_date: dateStr,
    signature_date: dateStr,
  };
}

function resolveSimpleAffidavit(
  members: HouseholdMember[],
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  return resolveSingleSignature(members, signerSlot, dateStr);
}

// Child-support / no-child-support affidavits. Maps expect `affiant_name`,
// `affiant_address`, `affiant_zip`, `children_names` — none of which the generic
// signature resolver emits (→ blank). The affiant is the HOH; children_names are the
// household minors. Support amounts are uncollected → blank.
function resolveChildSupportAffidavit(
  members: HouseholdMember[],
  appRow: AppRow,
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const affiant = members.find((m) => m.slot === signerSlot) ?? members.find((m) => m.slot === 1) ?? members[0];
  const minors = members.filter((m) => (m.age ?? 99) < 18);
  return {
    affiant_name: affiant?.name ?? '',
    affiant_address: (appRow?.building_address ?? '').trim(),
    affiant_zip: '',
    children_names: minors.map((m) => m.name).join(', '),
    amount_weekly: '',
    amount_monthly: '',
    ...resolveSingleSignature(members, signerSlot, dateStr),
  };
}

function resolveBriefingCert(
  members: HouseholdMember[]
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const hoh = members.find((m) => m.slot === 1);
  return {
    hoh_printed_name: hoh?.name ?? '',
    date: dateStr,
    signature_date: dateStr,
  };
}

function resolveCriminalBackgroundRelease(
  intakeData: IntakeData,
  members: HouseholdMember[],
  signerSlot: number,
  appRow: AppRow
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const parts = member ? nameParts(member.name) : { last: '', first: '', mi: '' };

  // Current address street comes from the application row (building_address + unit);
  // city/state/zip and the previous address are collected in intake.contact (WS-D #2).
  const contact = intakeData?.contact ?? {};
  return {
    first_name: parts.first,
    middle_initial: parts.mi,
    last_name: parts.last,
    dob: formatDob(member?.date_of_birth),
    ssn: ssnDisplay(member?.ssn_last_four),
    current_address_street: (appRow?.building_address ?? '').trim(),
    current_address_apt: (appRow?.unit_number ?? '').trim(),
    current_address_city: (contact.city ?? '').trim(),
    current_address_state: (contact.state ?? '').trim(),
    current_address_zip: (contact.zip ?? '').trim(),
    previous_address_street: (contact.prev_street ?? '').trim(),
    previous_address_apt: (contact.prev_apt ?? '').trim(),
    previous_address_city: (contact.prev_city ?? '').trim(),
    previous_address_state: (contact.prev_state ?? '').trim(),
    previous_address_zip: (contact.prev_zip ?? '').trim(),
    signature_date: dateStr,
    witness_signature_date: dateStr,
    date: dateStr,
  };
}

function resolveEivGuideReceipt(
  members: HouseholdMember[],
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  return resolveSingleSignature(members, signerSlot, dateStr);
}

// ─── Public resolver ──────────────────────────────────────────────────────────

// ─── Generation guardrail (WS-E) ────────────────────────────────────────────────
//
// Per-form REQUIRED_FIELDS is the IDENTITY FLOOR: keys whose blankness means the
// form resolved into essentially-empty — the exact silent failure that shipped whole
// forms blank (the hach/hud_9886a/obligations key-mismatch bugs). Situational fields
// (income, address, demographics — legitimately blank for some applicants) are
// intentionally NOT listed, so the check never false-blocks a valid sparse form.
// generate-forms calls findBlankRequiredFields() and skips (with a surfaced reason)
// rather than stamping a form missing its non-negotiable fields.
const REQUIRED_FIELDS: Record<string, string[]> = {
  main_application: ['applicant_full_name'],
  criminal_background_release: ['first_name', 'last_name'],
  hach_release: ['applicant_name'],
  hud_92006: ['applicant_name'],
  obligations_of_family: ['hoh_name'],
  citizenship_declaration: ['members'],
  briefing_cert: ['hoh_printed_name'],
  debts_owed_phas: ['printed_name'],
  no_child_support_affidavit: ['affiant_name'],
  child_support_affidavit: ['affiant_name'],
  eiv_guide_receipt: ['printed_name'],
};

function isBlankValue(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

/**
 * Returns the required field keys that resolved blank for this form (empty = OK).
 * The generation route fails loud on a non-empty result instead of silently
 * shipping a blank form. Forms with no entry have no floor (signature-only forms).
 */
export function findBlankRequiredFields(
  formId: string,
  data: Record<string, unknown>
): string[] {
  const req = REQUIRED_FIELDS[formId] ?? [];
  return req.filter((k) => isBlankValue(data[k]));
}

/**
 * Resolve field data for a given form_id.
 * signerSlot: the household member slot (1-based) for per-adult forms.
 * For submission-level forms, pass signerSlot=1 (HOH).
 */
export function resolveFieldData(
  formId: string,
  intakeData: IntakeData,
  members: HouseholdMember[],
  language: 'en' | 'es',
  signerSlot = 1,
  appRow: AppRow = {}
): Record<string, unknown> {
  switch (formId) {
    case 'main_application':
      return resolveMainApplication(intakeData, members, language, appRow);
    case 'hud_9886a':
      return resolveHud9886a(intakeData, members, signerSlot, appRow);
    case 'hach_release':
      return resolveHachRelease(intakeData, members, signerSlot, appRow);
    case 'hud_92006':
      return resolveHud92006(intakeData, members, appRow);
    case 'citizenship_declaration':
      return resolveCitizenshipDeclaration(members);
    case 'obligations_of_family':
      return resolveObligationsOfFamily(intakeData, members, appRow);
    case 'child_support_affidavit':
    case 'no_child_support_affidavit':
      return resolveChildSupportAffidavit(members, appRow, signerSlot);
    case 'pet_addendum':
    case 'vehicle_addendum':
    case 'self_employment_worksheet':
    case 'debts_owed_phas':
      return resolveSimpleAffidavit(members, signerSlot);
    case 'briefing_cert':
      return resolveBriefingCert(members);
    case 'criminal_background_release':
      return resolveCriminalBackgroundRelease(intakeData, members, signerSlot, appRow);
    case 'eiv_guide_receipt':
      return resolveEivGuideReceipt(members, signerSlot);
    default:
      // PRD-63 (audit #14): fail closed on an unknown form_id. The old
      // fall-through to resolveSingleSignature silently stamped a generic
      // name+date resolver onto any unrecognised template, producing a
      // half-mapped PDF nobody had validated. Throwing a `resolver_missing:`
      // error lets the route in generate-forms catch it, push a
      // `resolver_missing` skip-reason, and continue with the rest of the
      // packet — without ever stamping the unknown form.
      throw new Error(`resolver_missing:${formId}`);
  }
}
