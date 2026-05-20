/**
 * Safe error message mapping for tenant-facing surfaces.
 * Prevents raw server errors (DB stack traces, etc.) from leaking to the UI.
 */

export type KnownErrorCode =
  | 'not_generated'
  | 'intake_not_complete'
  | 'summary_not_signed'
  | 'submitted_locked'
  | 'rate_limited'
  | 'no_phone'
  | 'signer_not_required'
  | 'pdf_not_ready'
  | 'form_not_found'
  | 'invalid_token'
  | 'already_signed'
  | 'network_error'
  | 'server_error';

const SAFE_MESSAGES: Record<KnownErrorCode, string> = {
  not_generated: 'Your application summary is being prepared.',
  intake_not_complete: 'Please complete the intake before continuing.',
  summary_not_signed: 'Please sign the application summary first.',
  submitted_locked: 'This application has already been submitted.',
  rate_limited: 'Please wait a moment before trying again.',
  no_phone: 'No phone number on file. Please contact your property manager.',
  signer_not_required: 'You are not required to sign this form.',
  pdf_not_ready: 'This document is being prepared.',
  form_not_found: 'Form not found.',
  invalid_token: 'Your session has expired. Please use your magic link to continue.',
  already_signed: 'This document has already been signed.',
  network_error: 'Connection issue. Please check your internet and try again.',
  server_error: 'Something went wrong. Please try again.',
};

const FALLBACK_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Maps errors to safe, user-facing messages.
 * Never returns raw Error.message to prevent information leakage.
 */
export function safeTenantErrorMessage(
  err: unknown,
  fallback = FALLBACK_MESSAGE
): string {
  // Handle null/undefined
  if (!err) return fallback;

  // Check for known error codes on error objects
  if (typeof err === 'object') {
    const errObj = err as Record<string, unknown>;

    // Check for explicit code property
    if ('code' in errObj && typeof errObj.code === 'string') {
      const code = errObj.code as KnownErrorCode;
      if (code in SAFE_MESSAGES) {
        return SAFE_MESSAGES[code];
      }
    }

    // Check for HTTP status-based codes
    if ('status' in errObj && typeof errObj.status === 'number') {
      const status = errObj.status;
      if (status === 401 || status === 403) return SAFE_MESSAGES.invalid_token;
      if (status === 404) return SAFE_MESSAGES.form_not_found;
      if (status === 409) return SAFE_MESSAGES.already_signed;
      if (status === 429) return SAFE_MESSAGES.rate_limited;
      if (status >= 500) return SAFE_MESSAGES.server_error;
    }
  }

  // Network errors (TypeError from fetch)
  if (err instanceof TypeError) {
    return SAFE_MESSAGES.network_error;
  }

  // For any other error, return fallback (never leak raw message)
  return fallback;
}

/**
 * Type guard to check if an error has a known code.
 */
export function hasErrorCode(err: unknown, code: KnownErrorCode): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>).code === code
  );
}
