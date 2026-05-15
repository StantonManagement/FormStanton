/**
 * Typed wrapper around tenantFetch that handles HTTP status checks
 * and returns safe, typed responses.
 */

import { tenantFetch, TenantFetchOptions } from '@/lib/tenantFetch';
import { safeTenantErrorMessage } from './safeErrorMessage';

export class TenantApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly data?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; data?: unknown; cause?: unknown }
  ) {
    super(message);
    this.name = 'TenantApiError';
    this.status = status;
    this.code = options?.code;
    this.data = options?.data;

    // Preserve cause for debugging
    if (options?.cause) {
      (this as Record<string, unknown>).cause = options.cause;
    }
  }
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  code?: string;
  [key: string]: unknown;
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Make a typed API call with automatic status checking and error handling.
 *
 * Features:
 * - Checks res.ok before parsing JSON
 * - Throws TenantApiError with safe message on failure
 * - Returns typed data on success
 * - Never leaks raw server errors to caller.message
 */
export async function tenantApiCall<T>(
  url: string,
  options?: TenantFetchOptions
): Promise<T> {
  let response: Response;

  try {
    response = await tenantFetch(url, options);
  } catch (err) {
    // Network-level errors (TypeError from fetch)
    const safeMessage = safeTenantErrorMessage(err);
    throw new TenantApiError(safeMessage, 0, { code: 'network_error', cause: err });
  }

  // Handle non-OK HTTP status before parsing body
  if (!response.ok) {
    let errorBody: ApiErrorResponse | null = null;

    try {
      errorBody = (await response.json()) as ApiErrorResponse;
    } catch {
      // Failed to parse error JSON — use status-based fallback
    }

    const status = response.status;
    const code = errorBody?.code;
    const safeMessage = safeTenantErrorMessage({ status, code, message: errorBody?.message });

    throw new TenantApiError(safeMessage, status, {
      code: code || String(status),
      data: errorBody,
    });
  }

  // Parse successful response
  let body: ApiResponse<T>;
  try {
    body = (await response.json()) as ApiResponse<T>;
  } catch (err) {
    throw new TenantApiError(
      'Invalid response from server. Please try again.',
      response.status,
      { code: 'parse_error', cause: err }
    );
  }

  // Check application-level success flag
  if (!body.success) {
    const message = 'message' in body ? String(body.message) : 'Request failed';
    const code = 'code' in body ? String(body.code) : undefined;
    const safeMessage = safeTenantErrorMessage({ code, message });

    throw new TenantApiError(safeMessage, response.status, {
      code,
      data: body,
    });
  }

  return body.data;
}

/**
 * POST helper with JSON body.
 * Note: tenantFetch automatically sets Content-Type: application/json for non-FormData bodies.
 */
export async function tenantApiPost<T>(
  url: string,
  body: unknown,
  options?: Omit<TenantFetchOptions, 'body' | 'method'>
): Promise<T> {
  return tenantApiCall<T>(url, {
    ...options,
    method: 'POST',
    body,
  });
}
