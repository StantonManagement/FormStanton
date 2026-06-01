/**
 * seedAssertion.ts
 *
 * PRD-85 Phase 2 — seed-presence assertion (application-side mirror).
 *
 * The authoritative assertion runs in SQL at migration time
 * (supabase/migrations/20260531120000_prd85_notification_template_seed_assertion.sql):
 * it fails the migration if any active=true notification type lacks a row for a
 * supported language. This module mirrors that logic in TypeScript so the rule
 * is unit-testable (the SQL cannot be run inside vitest) and reusable by any
 * runtime presence check.
 *
 * Keep this function and the plpgsql block in lockstep.
 */

export const SUPPORTED_LANGUAGES = ['en', 'es', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export interface TemplateRow {
  notification_type: string;
  language: string;
  active: boolean;
}

export interface TemplateLanguageGap {
  notification_type: string;
  missing: string[];
}

/**
 * Find every active notification type that is missing an active template row for
 * one or more supported languages. An empty result means the assertion passes.
 *
 * Only active types are considered (a type with no active row at all is not a
 * live trigger and is intentionally ignored — same as the SQL `WHERE active`).
 */
export function findActiveTemplateLanguageGaps(
  rows: TemplateRow[],
  supportedLangs: readonly string[] = SUPPORTED_LANGUAGES
): TemplateLanguageGap[] {
  const activeLangsByType = new Map<string, Set<string>>();

  for (const row of rows) {
    if (!row.active) continue;
    let langs = activeLangsByType.get(row.notification_type);
    if (!langs) {
      langs = new Set<string>();
      activeLangsByType.set(row.notification_type, langs);
    }
    langs.add(row.language);
  }

  const gaps: TemplateLanguageGap[] = [];
  for (const [notification_type, langs] of activeLangsByType) {
    const missing = supportedLangs.filter((lang) => !langs.has(lang));
    if (missing.length > 0) {
      gaps.push({ notification_type, missing });
    }
  }

  return gaps;
}

/**
 * Throwing variant — mirrors the migration's `RAISE EXCEPTION`. Use at runtime
 * where a hard failure on a missing template language is desired.
 */
export function assertTemplateLanguagesPresent(
  rows: TemplateRow[],
  supportedLangs: readonly string[] = SUPPORTED_LANGUAGES
): void {
  const gaps = findActiveTemplateLanguageGaps(rows, supportedLangs);
  if (gaps.length === 0) return;
  const detail = gaps
    .map((g) => `  ${g.notification_type} missing: ${g.missing.join(',')}`)
    .join('\n');
  throw new Error(
    `Seed-presence assertion failed — active notification types missing language rows:\n${detail}`
  );
}
