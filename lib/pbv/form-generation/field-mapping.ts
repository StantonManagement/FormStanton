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

export interface IntakeApplicant {
  full_name?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city_state_zip?: string;
  race?: string;
  ethnicity?: string;
  marital_status?: string;
}

export interface IntakeData {
  applicant?: IntakeApplicant;
  household?: {
    member_list?: HouseholdMember[];
  };
  income?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  criminal?: Record<string, unknown>;
  medical?: Record<string, unknown>;
  childcare?: Record<string, unknown>;
  pets?: { has_pets?: boolean };
  vehicle?: { has_vehicle?: boolean };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDob(dob: string | undefined): string {
  if (!dob) return '';
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

// ─── Per-form resolvers ───────────────────────────────────────────────────────

function resolveMainApplication(
  intakeData: IntakeData,
  members: HouseholdMember[],
  language: 'en' | 'es'
): Record<string, unknown> {
  const app = intakeData.applicant ?? {};
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

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
    };
  });

  const incomeRows = (intakeData.income as any)?.rows ?? [];
  const assetRows = (intakeData.assets as any)?.rows ?? [];
  const medicalRows = (intakeData.medical as any)?.rows ?? [];

  const hohMember = members.find((m) => m.slot === 1);
  const hohParts = hohMember ? nameParts(hohMember.name) : { last: '', first: '', mi: '' };

  return {
    applicant_full_name: app.full_name ?? hohMember?.name ?? '',
    applicant_email: app.email ?? '',
    phone_home: app.phone ?? '',
    phone_cell: app.phone ?? '',
    address_street: app.address_street ?? '',
    address_city_state_zip: app.address_city_state_zip ?? '',
    hoh_last: hohParts.last,
    hoh_first: hohParts.first,
    date: dateStr,
    adults: adultRows,
    minors: minorRows,
    income_rows: incomeRows,
    asset_rows: assetRows,
    medical_rows: medicalRows,
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
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const app = intakeData.applicant ?? {};
  return {
    hoh_name: member?.name ?? app.full_name ?? '',
    address: `${app.address_street ?? ''} ${app.address_city_state_zip ?? ''}`.trim(),
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
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const app = intakeData.applicant ?? {};
  return {
    printed_name: member?.name ?? '',
    address: `${app.address_street ?? ''} ${app.address_city_state_zip ?? ''}`.trim(),
    date: dateStr,
    signature_date: dateStr,
  };
}

function resolveHud92006(
  intakeData: IntakeData,
  members: HouseholdMember[]
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const app = intakeData.applicant ?? {};
  const hoh = members.find((m) => m.slot === 1);
  return {
    applicant_name: hoh?.name ?? app.full_name ?? '',
    address: `${app.address_street ?? ''} ${app.address_city_state_zip ?? ''}`.trim(),
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
  members: HouseholdMember[]
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const app = intakeData.applicant ?? {};
  const hoh = members.find((m) => m.slot === 1);
  return {
    hoh_printed_name: hoh?.name ?? '',
    address: `${app.address_street ?? ''} ${app.address_city_state_zip ?? ''}`.trim(),
    phone: app.phone ?? '',
    date: dateStr,
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
  signerSlot: number
): Record<string, unknown> {
  const today = new Date();
  const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;
  const member = members.find((m) => m.slot === signerSlot) ?? members[0];
  const parts = member ? nameParts(member.name) : { last: '', first: '', mi: '' };
  const app = intakeData.applicant ?? {};

  // address_city_state_zip is a single string ("City, ST 12345") in intake; best-effort split.
  const csz = app.address_city_state_zip ?? '';
  const cszMatch = csz.match(/^\s*(.+?),\s*([A-Z]{2})\s+([0-9]{5}(?:-[0-9]{4})?)\s*$/i);
  const city = cszMatch?.[1] ?? '';
  const state = cszMatch?.[2] ?? '';
  const zip = cszMatch?.[3] ?? '';

  return {
    first_name: parts.first,
    middle_initial: parts.mi,
    last_name: parts.last,
    dob: formatDob(member?.date_of_birth),
    ssn: ssnDisplay(member?.ssn_last_four),
    current_address_street: app.address_street ?? '',
    current_address_apt: '',
    current_address_city: city,
    current_address_state: state,
    current_address_zip: zip,
    // Previous address not captured in intake — leave blank for in-person fill.
    previous_address_street: '',
    previous_address_apt: '',
    previous_address_city: '',
    previous_address_state: '',
    previous_address_zip: '',
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
  signerSlot = 1
): Record<string, unknown> {
  switch (formId) {
    case 'main_application':
      return resolveMainApplication(intakeData, members, language);
    case 'hud_9886a':
      return resolveHud9886a(intakeData, members, signerSlot);
    case 'hach_release':
      return resolveHachRelease(intakeData, members, signerSlot);
    case 'hud_92006':
      return resolveHud92006(intakeData, members);
    case 'citizenship_declaration':
      return resolveCitizenshipDeclaration(members);
    case 'obligations_of_family':
      return resolveObligationsOfFamily(intakeData, members);
    case 'child_support_affidavit':
    case 'no_child_support_affidavit':
    case 'pet_addendum':
    case 'vehicle_addendum':
    case 'self_employment_worksheet':
    case 'debts_owed_phas':
      return resolveSimpleAffidavit(members, signerSlot);
    case 'briefing_cert':
      return resolveBriefingCert(members);
    case 'criminal_background_release':
      return resolveCriminalBackgroundRelease(intakeData, members, signerSlot);
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
