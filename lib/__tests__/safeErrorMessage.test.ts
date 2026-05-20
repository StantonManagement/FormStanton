import { describe, it, expect } from 'vitest';
import { safeTenantErrorMessage, hasErrorCode, KnownErrorCode } from '@/lib/pbv/safeErrorMessage';

describe('safeTenantErrorMessage', () => {
  it('returns fallback for null/undefined', () => {
    expect(safeTenantErrorMessage(null)).toBe('Something went wrong. Please try again.');
    expect(safeTenantErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });

  it('returns fallback for unknown errors', () => {
    expect(safeTenantErrorMessage(new Error('Database connection failed'))).toBe(
      'Something went wrong. Please try again.'
    );
    expect(safeTenantErrorMessage({ random: 'object' })).toBe(
      'Something went wrong. Please try again.'
    );
  });

  it('maps known error codes to safe messages', () => {
    const testCases: { code: KnownErrorCode; expected: string }[] = [
      { code: 'not_generated', expected: 'Your application summary is being prepared.' },
      { code: 'intake_not_complete', expected: 'Please complete the intake before continuing.' },
      { code: 'summary_not_signed', expected: 'Please sign the application summary first.' },
      { code: 'submitted_locked', expected: 'This application has already been submitted.' },
      { code: 'rate_limited', expected: 'Please wait a moment before trying again.' },
      { code: 'no_phone', expected: 'No phone number on file. Please contact your property manager.' },
      { code: 'signer_not_required', expected: 'You are not required to sign this form.' },
      { code: 'pdf_not_ready', expected: 'This document is being prepared.' },
      { code: 'form_not_found', expected: 'Form not found.' },
      { code: 'invalid_token', expected: 'Your session has expired. Please use your magic link to continue.' },
      { code: 'already_signed', expected: 'This document has already been signed.' },
      { code: 'network_error', expected: 'Connection issue. Please check your internet and try again.' },
      { code: 'server_error', expected: 'Something went wrong. Please try again.' },
    ];

    for (const { code, expected } of testCases) {
      expect(safeTenantErrorMessage({ code })).toBe(expected);
    }
  });

  it('maps HTTP status codes to safe messages', () => {
    expect(safeTenantErrorMessage({ status: 401 })).toBe(
      'Your session has expired. Please use your magic link to continue.'
    );
    expect(safeTenantErrorMessage({ status: 403 })).toBe(
      'Your session has expired. Please use your magic link to continue.'
    );
    expect(safeTenantErrorMessage({ status: 404 })).toBe('Form not found.');
    expect(safeTenantErrorMessage({ status: 409 })).toBe('This document has already been signed.');
    expect(safeTenantErrorMessage({ status: 429 })).toBe('Please wait a moment before trying again.');
    expect(safeTenantErrorMessage({ status: 500 })).toBe('Something went wrong. Please try again.');
    expect(safeTenantErrorMessage({ status: 503 })).toBe('Something went wrong. Please try again.');
  });

  it('maps TypeError to network_error', () => {
    const typeError = new TypeError('Failed to fetch');
    expect(safeTenantErrorMessage(typeError)).toBe(
      'Connection issue. Please check your internet and try again.'
    );
  });

  it('uses custom fallback when provided', () => {
    expect(safeTenantErrorMessage(new Error('Unknown'), 'Custom error')).toBe('Custom error');
  });

  it('never leaks raw error messages', () => {
    const dangerousErrors = [
      { message: 'relation pbv_full_applications does not exist' },
      { message: 'connect ECONNREFUSED 127.0.0.1:5432' },
      { message: 'Unexpected token <' },
      new Error('pg_query failed: syntax error at or near FROM'),
    ];

    for (const err of dangerousErrors) {
      const result = safeTenantErrorMessage(err);
      expect(result).not.toContain('pg');
      expect(result).not.toContain('ECONNREFUSED');
      expect(result).not.toContain('syntax error');
      expect(result).not.toContain('relation');
      expect(result).toBe('Something went wrong. Please try again.');
    }
  });
});

describe('hasErrorCode', () => {
  it('returns true for matching code', () => {
    expect(hasErrorCode({ code: 'not_generated' }, 'not_generated')).toBe(true);
  });

  it('returns false for non-matching code', () => {
    expect(hasErrorCode({ code: 'not_generated' }, 'server_error')).toBe(false);
  });

  it('returns false for non-object errors', () => {
    expect(hasErrorCode('string', 'not_generated')).toBe(false);
    expect(hasErrorCode(null, 'not_generated')).toBe(false);
    expect(hasErrorCode(123, 'not_generated')).toBe(false);
  });
});
