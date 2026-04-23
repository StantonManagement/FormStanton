/**
 * Utilities for evaluating form_document_templates.applies_to / member_filter
 * against form_data.household_members at submission seeding time.
 */

export type HouseholdMember = Record<string, unknown>;

type FilterOp = 'eq' | 'ne' | 'gte' | 'gt' | 'lte' | 'lt' | 'in';

type FilterCriterion = {
  field: string;
  value: unknown;
  op?: FilterOp;
};

/**
 * Returns true if the member satisfies all criteria (ANDed).
 * Supports single criterion object or array of criteria.
 */
export function matchesMemberFilter(
  member: HouseholdMember,
  filter: FilterCriterion | FilterCriterion[]
): boolean {
  const criteria = Array.isArray(filter) ? filter : [filter];
  return criteria.every(({ field, value, op = 'eq' }) => {
    const v = member[field];
    switch (op) {
      case 'eq':  return v === value;
      case 'ne':  return v !== value;
      case 'gte': return Number(v) >= Number(value);
      case 'gt':  return Number(v) >  Number(value);
      case 'lte': return Number(v) <= Number(value);
      case 'lt':  return Number(v) <  Number(value);
      case 'in':  return Array.isArray(value) && value.includes(v);
      default:    return false;
    }
  });
}

/**
 * Returns the household members (with their 1-based slot index) that should
 * receive a document slot given a template's applies_to + member_filter.
 *
 * Returns [] for 'submission' (caller handles person_slot = 0 separately).
 */
export function getApplicableMembers(
  householdMembers: HouseholdMember[],
  appliesTo: string,
  memberFilter: unknown
): Array<{ member: HouseholdMember; slot: number }> {
  const result: Array<{ member: HouseholdMember; slot: number }> = [];

  householdMembers.forEach((member, idx) => {
    const slot = idx + 1; // 1-based to match person_slot semantics

    switch (appliesTo) {
      case 'each_member':
        result.push({ member, slot });
        break;

      case 'each_adult':
        if (Number(member.age) >= 18) result.push({ member, slot });
        break;

      case 'each_member_matching_rule':
        if (
          memberFilter &&
          matchesMemberFilter(
            member,
            memberFilter as FilterCriterion | FilterCriterion[]
          )
        ) {
          result.push({ member, slot });
        }
        break;

      case 'submission':
      default:
        break;
    }
  });

  return result;
}
