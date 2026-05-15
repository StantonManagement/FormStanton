/**
 * lib/pbv/summary-doc/__tests__/content.test.ts
 *
 * Ensures all three language variants have all required keys defined.
 * Guards against missing translations being silently undefined.
 */

import { describe, it, expect } from 'vitest';
import { SUMMARY_CONTENT, SUMMARY_TEMPLATE_VERSION } from '../content';
import { FORM_DESCRIPTIONS, UPLOAD_DESCRIPTIONS } from '../descriptions';

const LANGUAGES = ['en', 'es', 'pt'] as const;

const REQUIRED_CONTENT_KEYS: (keyof typeof SUMMARY_CONTENT['en'])[] = [
  'doc_title',
  'for_label',
  'section_what_applying_for_title',
  'section_what_applying_for_body',
  'section_package_title',
  'section_uploads_title',
  'section_uploads_none',
  'section_language_note_title',
  'section_language_note_body',
  'section_contact_title',
  'section_contact_body',
  'section_acknowledgement_title',
  'section_acknowledgement_body',
  'signature_line_label',
  'date_label',
];

describe('SUMMARY_CONTENT — key completeness', () => {
  for (const lang of LANGUAGES) {
    it(`${lang}: all required keys defined`, () => {
      const c = SUMMARY_CONTENT[lang];
      for (const key of REQUIRED_CONTENT_KEYS) {
        expect(c[key], `${lang}.${key} should be defined`).toBeDefined();
        if (typeof c[key] === 'string') {
          expect((c[key] as string).length, `${lang}.${key} should not be empty`).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('SUMMARY_CONTENT — callable functions', () => {
  for (const lang of LANGUAGES) {
    it(`${lang}.section_language_note_body is callable`, () => {
      const fn = SUMMARY_CONTENT[lang].section_language_note_body;
      expect(typeof fn).toBe('function');
      const result = fn('es', lang);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it(`${lang}.section_contact_body is callable`, () => {
      const fn = SUMMARY_CONTENT[lang].section_contact_body;
      expect(typeof fn).toBe('function');
      const result = fn(lang);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  }
});

describe('SUMMARY_TEMPLATE_VERSION', () => {
  it('is semver-shaped string', () => {
    expect(SUMMARY_TEMPLATE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('FORM_DESCRIPTIONS — all languages have all EN keys', () => {
  const enKeys = Object.keys(FORM_DESCRIPTIONS.en);
  for (const lang of (['es', 'pt'] as const)) {
    it(`${lang}: all EN form description keys present`, () => {
      for (const key of enKeys) {
        expect(FORM_DESCRIPTIONS[lang][key], `${lang}.${key}`).toBeDefined();
        expect(FORM_DESCRIPTIONS[lang][key].length).toBeGreaterThan(0);
      }
    });
  }
});

describe('UPLOAD_DESCRIPTIONS — all languages have all EN keys', () => {
  const enKeys = Object.keys(UPLOAD_DESCRIPTIONS.en);
  for (const lang of (['es', 'pt'] as const)) {
    it(`${lang}: all EN upload description keys present`, () => {
      for (const key of enKeys) {
        expect(UPLOAD_DESCRIPTIONS[lang][key], `${lang}.${key}`).toBeDefined();
        expect(UPLOAD_DESCRIPTIONS[lang][key].length).toBeGreaterThan(0);
      }
    });
  }
});
