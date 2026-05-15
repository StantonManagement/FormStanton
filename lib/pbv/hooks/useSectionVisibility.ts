'use client';

/**
 * lib/pbv/hooks/useSectionVisibility.ts
 *
 * Returns the ordered list of visible section slugs based on current
 * intake_data and household member roster.
 *
 * Conditional rules are imported from lib/pbv/conditional-rules.ts
 * so this hook and the server-side generate-forms endpoint use
 * identical predicates.
 */

import { useMemo } from 'react';
import {
  ALWAYS_SECTIONS,
  type SectionSlug,
  type IntakeData,
} from '@/lib/pbv/intake-schema';
import {
  sectionIiiZeroIncomeAnyAdult,
  shouldRenderSectionVIMedical,
  shouldRenderSectionVIIIExpenses,
} from '@/lib/pbv/conditional-rules';
import type { HouseholdMember } from '@/lib/pbv/form-generation/field-mapping';

/**
 * Derives a lightweight HouseholdMember array from the intake household section.
 * The full pbv_household_members rows are not available client-side during intake,
 * so we derive what we need from intake_data.household.
 */
function deriveMembers(intakeData: IntakeData): HouseholdMember[] {
  const members = intakeData.household?.members ?? [];
  return members.map((m) => ({
    slot: m.slot,
    name: m.name,
    relationship: m.relationship,
    age: m.is_minor ? 10 : 30,
    date_of_birth: m.dob,
    disability: m.disability,
    student: m.student,
    annual_income:
      intakeData.income?.by_member?.find((b) => b.member_slot === m.slot)?.annual_income ?? undefined,
    has_child_support:
      intakeData.income?.by_member
        ?.find((b) => b.member_slot === m.slot)
        ?.income_sources?.some((s) => s.type === 'child_support' && s.has_income) ?? false,
    has_self_employment:
      intakeData.income?.by_member
        ?.find((b) => b.member_slot === m.slot)
        ?.income_sources?.some((s) => s.type === 'self_employment' && s.has_income) ?? false,
  }));
}

export function useSectionVisibility(intakeData: IntakeData): SectionSlug[] {
  return useMemo(() => {
    const members = deriveMembers(intakeData);

    // Build ordered list: insert conditional sections at their correct positions
    const visible: SectionSlug[] = [
      'household',
      'contact',
      'income',
    ];

    // Section 4: zero_income_decl — any adult with no income
    if (sectionIiiZeroIncomeAnyAdult(intakeData as any, members)) {
      visible.push('zero_income_decl');
    }

    visible.push('assets');
    visible.push('childcare_disability');

    // Section 7: medical — HOH/spouse disabled OR 62+
    if (shouldRenderSectionVIMedical(members)) {
      visible.push('medical');
    }

    visible.push('criminal_history');
    visible.push('dv_homeless_ra');

    // Section 10: household_expenses — all adults zero income
    if (shouldRenderSectionVIIIExpenses(intakeData as any, members)) {
      visible.push('household_expenses');
    }

    visible.push('review');

    return visible;
  }, [intakeData]);
}

/** Returns the 1-based display number for a section within the visible list. */
export function useSectionNumber(
  sections: SectionSlug[],
  slug: SectionSlug
): { current: number; total: number } {
  const current = sections.indexOf(slug) + 1;
  const total = sections.filter((s) => s !== 'review').length;
  return { current, total };
}
