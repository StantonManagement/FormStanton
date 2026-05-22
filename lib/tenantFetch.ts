/**
 * Tenant-side fetch wrapper.
 *
 * PRP-011 (C2 + E3):
 *   - Exponential backoff (1s / 2s / 4s, max 3 attempts) on transient
 *     errors (network/TypeError, AbortError-from-timeout, retryable 5xx
 *     responses).
 *   - Retries are gated on whether the request carries an Idempotency-Key
 *     header so the server can collapse duplicates. GET/HEAD/OPTIONS are
 *     always idempotent. Other methods get a key by default (so dedup
 *     works) and retry; pass `idempotent: false` to suppress the key AND
 *     the retry — for endpoints that are not safe to repeat.
 *   - A caller-supplied `idempotencyKey` is honored verbatim and reused
 *     across retries (previously the wrapper generated a fresh key per
 *     attempt, defeating server-side dedup for composed callers).
 *   - 4xx responses are NEVER retried.
 */

export const TENANT_FETCH_TIMEOUT_DEFAULT = 15_000;
export const TENANT_FETCH_TIMEOUT_UPLOAD = 55_000;

export interface TenantFetchOptions {
  method?: string;
  body?: unknown;
  timeout?: number;
  /** Send an Idempotency-Key header and enable retry on transient errors.
   *  Default: true for non-GET methods. Set to `false` for endpoints that
   *  are not safe to repeat (and must not be deduped server-side). */
  idempotent?: boolean;
  /** Caller-supplied idempotency key — honored verbatim and reused on
   *  every retry so server-side dedup collapses the duplicates. */
  idempotencyKey?: string;
  signal?: AbortSignal;
  assistedByUserId?: string | null;
}

const RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function isUpload(opts: TenantFetchOptions): boolean {
  return opts.body instanceof FormData;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function tenantFetch(
  url: string,
  opts: TenantFetchOptions = {}
): Promise<Response> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const timeout =
    opts.timeout ?? (isUpload(opts) ? TENANT_FETCH_TIMEOUT_UPLOAD : TENANT_FETCH_TIMEOUT_DEFAULT);

  const isIdempotentMethod = IDEMPOTENT_METHODS.has(method);
  // useIdempotency drives BOTH the header presence and the retry budget,
  // because the only thing that makes a POST safe to retry is server-side
  // dedup on the Idempotency-Key.
  const useIdempotency = opts.idempotent ?? !isIdempotentMethod;

  // GETs don't get a header; other methods do iff useIdempotency.
  const sendIdempotencyHeader = !isIdempotentMethod && useIdempotency;
  const idempotencyKey = sendIdempotencyHeader
    ? opts.idempotencyKey ?? crypto.randomUUID()
    : undefined;

  // Retries fire when (a) the request is inherently idempotent (GET) OR
  // (b) the server can dedup via the Idempotency-Key header.
  const eligibleForRetry = isIdempotentMethod || sendIdempotencyHeader;

  const baseHeaders: Record<string, string> = {};
  if (idempotencyKey) baseHeaders['Idempotency-Key'] = idempotencyKey;
  if (opts.body && !(opts.body instanceof FormData)) {
    baseHeaders['Content-Type'] = 'application/json';
  }
  if (opts.assistedByUserId) baseHeaders['X-Assisted-By'] = opts.assistedByUserId;

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        method,
        headers: baseHeaders,
        body:
          opts.body instanceof FormData
            ? opts.body
            : opts.body !== undefined
            ? JSON.stringify(opts.body)
            : undefined,
        signal: opts.signal ?? controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const maxAttempts = eligibleForRetry ? RETRY_DELAYS_MS.length + 1 : 1;

  let lastError: unknown;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await attempt();
      if (eligibleForRetry && RETRYABLE_STATUS.has(res.status) && i < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[i], opts.signal);
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      // External caller aborts (opts.signal aborted) are not transient.
      const isAbortFromCaller =
        err instanceof DOMException && err.name === 'AbortError' && opts.signal?.aborted === true;
      const isTransient =
        !isAbortFromCaller &&
        (err instanceof TypeError ||
          (err instanceof DOMException && err.name === 'AbortError'));
      if (eligibleForRetry && isTransient && i < maxAttempts - 1) {
        await sleep(RETRY_DELAYS_MS[i], opts.signal);
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('tenantFetch exhausted retries without a response');
}
