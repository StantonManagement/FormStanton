/**
 * lib/pbv/format.ts
 *
 * Single-source-of-truth label maps for intake enum values.
 * Used by IntakeDataDisplay (review + print), and any future dropdown
 * that needs the same labels.
 *
 * Add new values here first, then the dropdowns pick them up automatically.
 */

export const RACE_LABELS: Record<string, string> = {
  white:                        'White',
  black:                        'Black / African American',
  asian:                        'Asian',
  american_indian:              'American Indian / Alaska Native',
  pacific_islander:             'Native Hawaiian / Pacific Islander',
  two_or_more:                  'Two or More Races',
  other:                        'Other',
  prefer_not_to_say:            'Prefer not to say',
};

export const ETHNICITY_LABELS: Record<string, string> = {
  hispanic:                     'Hispanic or Latino',
  not_hispanic:                 'Not Hispanic or Latino',
  prefer_not_to_say:            'Prefer not to say',
};

export const MARITAL_STATUS_LABELS: Record<string, string> = {
  single:                       'Single',
  married:                      'Married',
  separated:                    'Separated',
  divorced:                     'Divorced',
  widowed:                      'Widowed',
  domestic_partner:             'Domestic Partner',
};

export const INCOME_TYPE_LABELS: Record<string, string> = {
  employment:                   'Wages / Salary',
  self_employment:              'Self-Employment',
  ssi:                          'SSI',
  ss:                           'Social Security',
  pension:                      'Pension / Retirement',
  tanf:                         'TANF',
  child_support:                'Child Support',
  unemployment:                 'Unemployment',
  alimony:                      'Alimony',
  rental_income:                'Rental Income',
  investments:                  'Investment Income',
  digital_wallet:               'Digital Wallet / Crypto',
  snap:                         'SNAP / Food Stamps',
  other:                        'Other Income',
  none:                         'No income',
};

export const RELATIONSHIP_LABELS: Record<string, string> = {
  head:                         'Head of Household',
  spouse:                       'Spouse',
  partner:                      'Domestic Partner',
  child:                        'Child',
  parent:                       'Parent',
  sibling:                      'Sibling',
  grandchild:                   'Grandchild',
  other:                        'Other',
};

export const CITIZENSHIP_LABELS: Record<string, string> = {
  citizen:                      'U.S. Citizen',
  eligible_non_citizen:         'Eligible Non-Citizen',
  ineligible:                   'Ineligible Non-Citizen',
  not_reported:                 'Not Reported',
};

/**
 * Format a 10-digit phone number string as (xxx) xxx-xxxx.
 * Accepts digits-only or already-formatted strings.
 * Returns the original string unchanged if it can't be formatted.
 */
export function formatPhone(raw: string | undefined | null): string {
  if (!raw) return '--';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

/**
 * Look up a human-readable label for an enum value.
 * Falls back to the raw value with underscores replaced by spaces.
 */
export function formatEnumLabel(value: string | undefined | null, map: Record<string, string>): string {
  if (!value) return '--';
  return map[value] ?? value.replace(/_/g, ' ');
}
