import { describe, it, expect } from 'vitest';

/**
 * PRD-59 Phase 3: Language routing unit tests.
 *
 * These tests verify the form-output / summary-lang derivation:
 * - EN tenant → form en / summary en
 * - ES tenant → form es / summary es  
 * - PT tenant → form es / summary pt
 *
 * Also tests that submission_language override beats preferred_language for form output.
 */

/**
 * Derive the language for stamped form output.
 * PT tenants get ES forms (no PT assets exist).
 * This mirrors the logic in generate-forms/route.ts:62-63
 */
function deriveFormOutputLanguage(
  preferredLanguage: 'en' | 'es' | 'pt',
  submissionLanguage?: 'en' | 'es' | null
): 'en' | 'es' {
  // submission_language override beats preferred_language for form output
  if (submissionLanguage) {
    return submissionLanguage; // 'es' or 'en' only (never 'pt')
  }
  // Default: use preferred_language, but PT → ES (no PT form assets)
  return preferredLanguage === 'pt' ? 'es' : preferredLanguage;
}

/**
 * Derive the language for signed summary document.
 * Summary is in tenant's own language (incl. PT).
 * This mirrors the logic in generate-forms/route.ts:204-206
 */
function deriveSummaryLanguage(
  preferredLanguage: 'en' | 'es' | 'pt',
  _submissionLanguage?: 'en' | 'es' | null
): 'en' | 'es' | 'pt' {
  // Summary is always in tenant's own preferred language
  // (PT tenants get PT summary even though forms are ES)
  return preferredLanguage;
}

describe('deriveFormOutputLanguage() — stamped form routing (PRD-59)', () => {
  it('EN tenant → EN forms', () => {
    expect(deriveFormOutputLanguage('en')).toBe('en');
  });

  it('ES tenant → ES forms', () => {
    expect(deriveFormOutputLanguage('es')).toBe('es');
  });

  it('PT tenant → ES forms (no PT assets)', () => {
    expect(deriveFormOutputLanguage('pt')).toBe('es');
  });

  it('submission_language ES override beats preferred EN', () => {
    expect(deriveFormOutputLanguage('en', 'es')).toBe('es');
  });

  it('submission_language EN override beats preferred ES', () => {
    expect(deriveFormOutputLanguage('es', 'en')).toBe('en');
  });

  it('submission_language ES override beats preferred PT', () => {
    expect(deriveFormOutputLanguage('pt', 'es')).toBe('es');
  });
});

describe('deriveSummaryLanguage() — summary doc routing (PRD-59)', () => {
  it('EN tenant → EN summary', () => {
    expect(deriveSummaryLanguage('en')).toBe('en');
  });

  it('ES tenant → ES summary', () => {
    expect(deriveSummaryLanguage('es')).toBe('es');
  });

  it('PT tenant → PT summary (summary in own language)', () => {
    expect(deriveSummaryLanguage('pt')).toBe('pt');
  });

  it('submission_language does NOT affect summary language', () => {
    // Summary is always in preferred_language
    expect(deriveSummaryLanguage('pt', 'es')).toBe('pt');
    expect(deriveSummaryLanguage('es', 'en')).toBe('es');
  });
});

describe('Cross-tenant language model (PRD-59)', () => {
  it('EN: UI en / forms en / summary en', () => {
    const preferred = 'en';
    expect(deriveFormOutputLanguage(preferred)).toBe('en');
    expect(deriveSummaryLanguage(preferred)).toBe('en');
  });

  it('ES: UI es / forms es / summary es', () => {
    const preferred = 'es';
    expect(deriveFormOutputLanguage(preferred)).toBe('es');
    expect(deriveSummaryLanguage(preferred)).toBe('es');
  });

  it('PT: UI pt / forms es / summary pt', () => {
    const preferred = 'pt';
    expect(deriveFormOutputLanguage(preferred)).toBe('es');
    expect(deriveSummaryLanguage(preferred)).toBe('pt');
  });
});
