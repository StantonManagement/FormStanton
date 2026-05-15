export const TENANT_FETCH_TIMEOUT_DEFAULT = 15_000;
export const TENANT_FETCH_TIMEOUT_UPLOAD = 55_000;

export interface TenantFetchOptions {
  method?: string;
  body?: unknown;
  timeout?: number;
  idempotent?: boolean;
  signal?: AbortSignal;
  assistedByUserId?: string | null;
}

function isUpload(opts: TenantFetchOptions): boolean {
  return opts.body instanceof FormData;
}

export async function tenantFetch(
  url: string,
  opts: TenantFetchOptions = {}
): Promise<Response> {
  const method = opts.method ?? 'GET';
  const timeout = opts.timeout ?? (isUpload(opts) ? TENANT_FETCH_TIMEOUT_UPLOAD : TENANT_FETCH_TIMEOUT_DEFAULT);
  const useIdempotency = opts.idempotent ?? method !== 'GET';
  const idempotencyKey = useIdempotency ? crypto.randomUUID() : null;

  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (opts.body && !(opts.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (opts.assistedByUserId) headers['X-Assisted-By'] = opts.assistedByUserId;

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(url, {
        method,
        headers,
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

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof TypeError) {
      return await attempt();
    }
    throw err;
  }
}
