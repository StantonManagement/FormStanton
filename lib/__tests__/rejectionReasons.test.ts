import { describe, it, expect } from 'vitest';
import {
  resolveRejectionReason,
  getTemplateField,
  isValidLanguage,
  RejectionTemplate,
  Language,
} from '../rejectionReasons';

const mockTemplate: RejectionTemplate = {
  key: 'generic:illegible',
  doc_type: null,
  reason_en: 'The document is too blurry.',
  reason_es: 'El documento está muy borroso.',
  reason_pt: 'O documento está muito embaçado.',
};

describe('resolveRejectionReason', () => {
  // ═════════════════════════════════════════════════════════════════════════════
  // Level 1: Template provided (highest priority)
  // ═════════════════════════════════════════════════════════════════════════════

  it('returns localized template string when template is provided (en)', () => {
    const result = resolveRejectionReason({
      key: 'generic:illegible',
      freeText: null,
      language: 'en',
      template: mockTemplate,
    });
    expect(result).toBe('The document is too blurry.');
  });

  it('returns localized template string when template is provided (es)', () => {
    const result = resolveRejectionReason({
      key: 'generic:illegible',
      freeText: null,
      language: 'es',
      template: mockTemplate,
    });
    expect(result).toBe('El documento está muy borroso.');
  });

  it('returns localized template string when template is provided (pt)', () => {
    const result = resolveRejectionReason({
      key: 'generic:illegible',
      freeText: null,
      language: 'pt',
      template: mockTemplate,
    });
    expect(result).toBe('O documento está muito embaçado.');
  });

  // Template takes priority over free-text
  it('prefers template over free-text when both provided', () => {
    const result = resolveRejectionReason({
      key: 'generic:illegible',
      freeText: 'Admin custom note',
      language: 'en',
      template: mockTemplate,
    });
    expect(result).toBe('The document is too blurry.');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Level 2: Free-text fallback
  // ═════════════════════════════════════════════════════════════════════════════

  it('returns free-text when no template provided (en)', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: 'Custom rejection reason from admin',
      language: 'en',
    });
    expect(result).toBe('Custom rejection reason from admin');
  });

  it('returns free-text when no template provided (es)', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: 'Razón personalizada del administrador',
      language: 'es',
    });
    expect(result).toBe('Razón personalizada del administrador');
  });

  it('returns free-text when no template provided (pt)', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: 'Razão personalizada do administrador',
      language: 'pt',
    });
    expect(result).toBe('Razão personalizada do administrador');
  });

  // Free-text trimming
  it('trims whitespace from free-text', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: '  Surrounding spaces  ',
      language: 'en',
    });
    expect(result).toBe('Surrounding spaces');
  });

  // Empty free-text falls through to generic
  it('falls back to generic when free-text is empty string', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: '',
      language: 'en',
    });
    expect(result).toBe('Please contact the office for details on why this document was rejected.');
  });

  // Whitespace-only free-text falls through to generic
  it('falls back to generic when free-text is whitespace only', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: '   ',
      language: 'en',
    });
    expect(result).toBe('Please contact the office for details on why this document was rejected.');
  });

  // ═════════════════════════════════════════════════════════════════════════════
  // Level 3: Generic fallback
  // ═════════════════════════════════════════════════════════════════════════════

  it('returns English generic fallback when nothing else provided', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: null,
      language: 'en',
    });
    expect(result).toBe('Please contact the office for details on why this document was rejected.');
  });

  it('returns Spanish generic fallback when nothing else provided', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: null,
      language: 'es',
    });
    expect(result).toBe('Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.');
  });

  it('returns Portuguese generic fallback when nothing else provided', () => {
    const result = resolveRejectionReason({
      key: null,
      freeText: null,
      language: 'pt',
    });
    expect(result).toBe('Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.');
  });

  // Undefined values
  it('returns generic fallback when both key and freeText are undefined', () => {
    const result = resolveRejectionReason({
      key: undefined,
      freeText: undefined,
      language: 'en',
    });
    expect(result).toBe('Please contact the office for details on why this document was rejected.');
  });

  // Key provided but no template (orphaned key) - falls through to free-text then generic
  it('falls through to generic when key provided but no template and no free-text', () => {
    const result = resolveRejectionReason({
      key: 'orphaned:key',
      freeText: null,
      language: 'en',
    });
    expect(result).toBe('Please contact the office for details on why this document was rejected.');
  });

  // Key provided but no template, free-text exists - uses free-text
  it('uses free-text when key provided but no template', () => {
    const result = resolveRejectionReason({
      key: 'orphaned:key',
      freeText: 'Fallback free-text',
      language: 'en',
    });
    expect(result).toBe('Fallback free-text');
  });
});

describe('getTemplateField', () => {
  it('returns correct field for en', () => {
    expect(getTemplateField('en')).toBe('reason_en');
  });

  it('returns correct field for es', () => {
    expect(getTemplateField('es')).toBe('reason_es');
  });

  it('returns correct field for pt', () => {
    expect(getTemplateField('pt')).toBe('reason_pt');
  });
});

describe('isValidLanguage', () => {
  it('returns true for en', () => {
    expect(isValidLanguage('en')).toBe(true);
  });

  it('returns true for es', () => {
    expect(isValidLanguage('es')).toBe(true);
  });

  it('returns true for pt', () => {
    expect(isValidLanguage('pt')).toBe(true);
  });

  it('returns false for invalid languages', () => {
    expect(isValidLanguage('fr')).toBe(false);
    expect(isValidLanguage('de')).toBe(false);
    expect(isValidLanguage('')).toBe(false);
    expect(isValidLanguage(null)).toBe(false);
    expect(isValidLanguage(undefined)).toBe(false);
    expect(isValidLanguage(123)).toBe(false);
  });
});
