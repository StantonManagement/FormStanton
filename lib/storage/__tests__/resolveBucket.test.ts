import { describe, it, expect } from 'vitest';
import { resolveBucket } from '../resolveBucket';

describe('resolveBucket', () => {
  describe('explicit storage_bucket column wins', () => {
    it('returns the explicit column value when set', () => {
      expect(resolveBucket({ doc_type: 'pay_stub', storage_bucket: 'form-submissions' })).toBe('form-submissions');
    });

    it('returns an override bucket when explicitly set (future-proofing)', () => {
      expect(resolveBucket({ doc_type: 'pay_stub', storage_bucket: 'submissions' })).toBe('submissions');
    });
  });

  describe('all known application_documents doc_types resolve to form-submissions', () => {
    const knownDocTypes = [
      // Income
      'pay_stub',
      'employer_letter',
      'social_security_award',
      'pension_letter',
      'unemployment_letter',
      'self_employment',
      'rental_income',
      'child_support',
      'other_income',
      // Assets
      'bank_statement',
      'investment_statement',
      'real_estate_deed',
      // Medical / Childcare
      'medical_expense',
      'childcare_receipt',
      'disability_verification',
      // Immigration / Citizenship
      'birth_certificate',
      'passport',
      'green_card',
      'naturalization_certificate',
      'immigration_document',
      // Signed forms
      'signed_form',
      'briefing_cert',
      // Custom (catch-all from packet intake)
      'custom',
    ];

    for (const doc_type of knownDocTypes) {
      it(`doc_type "${doc_type}" resolves to form-submissions`, () => {
        expect(resolveBucket({ doc_type })).toBe('form-submissions');
      });
    }
  });

  describe('default fallback', () => {
    it('unknown doc_type defaults to form-submissions', () => {
      expect(resolveBucket({ doc_type: 'some_future_doc_type' })).toBe('form-submissions');
    });

    it('empty doc_type defaults to form-submissions', () => {
      expect(resolveBucket({ doc_type: '' })).toBe('form-submissions');
    });

    it('null storage_bucket treated as unset', () => {
      expect(resolveBucket({ doc_type: 'pay_stub', storage_bucket: null })).toBe('form-submissions');
    });

    it('undefined storage_bucket treated as unset', () => {
      expect(resolveBucket({ doc_type: 'pay_stub', storage_bucket: undefined })).toBe('form-submissions');
    });
  });

  describe('category field is accepted but does not change resolution', () => {
    it('income category still resolves to form-submissions', () => {
      expect(resolveBucket({ doc_type: 'pay_stub', category: 'income' })).toBe('form-submissions');
    });

    it('assets category still resolves to form-submissions', () => {
      expect(resolveBucket({ doc_type: 'bank_statement', category: 'assets' })).toBe('form-submissions');
    });
  });
});
