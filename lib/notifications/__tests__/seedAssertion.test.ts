import { describe, it, expect } from 'vitest';
import {
  findActiveTemplateLanguageGaps,
  assertTemplateLanguagesPresent,
  type TemplateRow,
} from '@/lib/notifications/seedAssertion';

function seeded(types: string[]): TemplateRow[] {
  const rows: TemplateRow[] = [];
  for (const t of types) {
    for (const language of ['en', 'es', 'pt']) {
      rows.push({ notification_type: t, language, active: true });
    }
  }
  return rows;
}

describe('findActiveTemplateLanguageGaps', () => {
  it('passes (no gaps) when every active type has en/es/pt', () => {
    const rows = seeded(['pbv_preflight_checklist', 'docs_upload_reminder']);
    expect(findActiveTemplateLanguageGaps(rows)).toEqual([]);
  });

  it('passes for the pbv_complete_application reopen-intake template when fully seeded', () => {
    const rows = seeded(['pbv_complete_application']);
    expect(findActiveTemplateLanguageGaps(rows)).toEqual([]);
  });

  it('fails when an active type is missing a language', () => {
    const rows = seeded(['docs_upload_reminder']);
    // pbv_preflight_checklist seeded for en/pt only — es is missing
    rows.push({ notification_type: 'pbv_preflight_checklist', language: 'en', active: true });
    rows.push({ notification_type: 'pbv_preflight_checklist', language: 'pt', active: true });

    const gaps = findActiveTemplateLanguageGaps(rows);
    expect(gaps).toEqual([{ notification_type: 'pbv_preflight_checklist', missing: ['es'] }]);
  });

  it('treats an inactive row as not satisfying the requirement', () => {
    const rows: TemplateRow[] = [
      { notification_type: 'pbv_preflight_checklist', language: 'en', active: true },
      { notification_type: 'pbv_preflight_checklist', language: 'es', active: true },
      // pt exists but is inactive → still a gap
      { notification_type: 'pbv_preflight_checklist', language: 'pt', active: false },
    ];
    expect(findActiveTemplateLanguageGaps(rows)).toEqual([
      { notification_type: 'pbv_preflight_checklist', missing: ['pt'] },
    ]);
  });

  it('ignores types that have no active rows at all (not a live trigger)', () => {
    const rows: TemplateRow[] = [
      { notification_type: 'retired_type', language: 'en', active: false },
      { notification_type: 'retired_type', language: 'es', active: false },
    ];
    expect(findActiveTemplateLanguageGaps(rows)).toEqual([]);
  });
});

describe('assertTemplateLanguagesPresent', () => {
  it('does not throw when fully seeded', () => {
    expect(() =>
      assertTemplateLanguagesPresent(seeded(['pbv_preflight_checklist']))
    ).not.toThrow();
  });

  it('throws naming the type and the missing language', () => {
    const rows = [
      { notification_type: 'pbv_preflight_checklist', language: 'en', active: true },
      { notification_type: 'pbv_preflight_checklist', language: 'es', active: true },
    ];
    expect(() => assertTemplateLanguagesPresent(rows)).toThrowError(/pbv_preflight_checklist missing: pt/);
  });
});
