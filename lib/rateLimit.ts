/**
 * PRP-002 — Rate limiting & brute-force resistance.
 *
 * Store-agnostic fixed-window counter. The interface is the contract; the
 * adapter is chosen by `createRateLimitAdapter()` based on env (Upstash >
 * Vercel KV > in-memory). The in-memory adapter is intentionally a
 * **single-instance** counter — see WARNING below — and exists only so the
 * limiter wiring can be exercised in dev/test until a shared store is
 * provisioned. Production must point at Upstash/KV.
 *
 * Findings: Angle-2 D2, D3.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
  remaining: number;
  /** True iff the limiter could not reach its backing store. The caller
   *  decides fail-open vs fail-closed based on route sensitivity. */
  storeUnreachable?: boolean;
}

export interface RateLimitInput {
  /** Composite key: typically `${route}:${token-or-ip}` */
  key: string;
  /** Max requests permitted in the window. */
  limit: number;
  /** Window size in seconds. */
  windowSec: number;
}

export interface RateLimitAdapter {
  /** Atomically increment the counter for `key` and report the post-increment count + TTL. */
  incr(key: string, windowSec: number): Promise<{ count: number; ttlSec: number; storeUnreachable?: boolean }>;
  /** Read the current count + TTL without mutating. Returns `count: 0` if no entry exists. */
  peek(key: string): Promise<{ count: number; ttlSec: number; storeUnreachable?: boolean }>;
}

// ---------------------------------------------------------------------------
// In-memory adapter — single-instance only.
// WARNING: this does NOT limit a distributed attacker. Vercel can route
// successive requests to different serverless instances; each holds its own
// Map. Treat this adapter as a smoke-test stand-in until Upstash/KV is wired.
// ---------------------------------------------------------------------------
type MemoryEntry = { count: number; resetAt: number };
const memoryStore = new Map<string, MemoryEntry>();

function memoryAdapter(): RateLimitAdapter {
  return {
    async incr(key, windowSec) {
      const now = Date.now();
      const existing = memoryStore.get(key);
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowSec * 1000;
        memoryStore.set(key, { count: 1, resetAt });
        return { count: 1, ttlSec: windowSec };
      }
      existing.count += 1;
      const ttlSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { count: existing.count, ttlSec };
    },
    async peek(key) {
      const now = Date.now();
      const existing = memoryStore.get(key);
      if (!existing || existing.resetAt <= now) {
        return { count: 0, ttlSec: 0 };
      }
      const ttlSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      return { count: existing.count, ttlSec };
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter selection — swap to Upstash/KV by branching here once provisioned.
// Intentionally lazy so the chosen adapter is logged once at first use.
// ---------------------------------------------------------------------------
let cachedAdapter: RateLimitAdapter | null = null;
let cachedAdapterLabel: 'memory' | 'upstash' | 'kv' | 'noop' = 'memory';

export function createRateLimitAdapter(): RateLimitAdapter {
  if (cachedAdapter) return cachedAdapter;

  // Provisioning detection — add real branches here once a shared store exists.
  // e.g.
  //   if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  //     cachedAdapterLabel = 'upstash';
  //     cachedAdapter = upstashAdapter();
  //     return cachedAdapter;
  //   }
  cachedAdapterLabel = 'memory';
  cachedAdapter = memoryAdapter();
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[rateLimit] using in-memory adapter — single-instance only, NOT distributed-attacker safe. Provision Upstash/KV before prod.'
    );
  }
  return cachedAdapter;
}

export function getRateLimitAdapterLabel(): typeof cachedAdapterLabel {
  return cachedAdapterLabel;
}

/** Test-only: swap the adapter (e.g. to inject a failing store). */
export function __setRateLimitAdapter(adapter: RateLimitAdapter | null, label: typeof cachedAdapterLabel = 'memory') {
  cachedAdapter = adapter;
  cachedAdapterLabel = label;
}

/** Test-only: clear the in-memory store between tests. */
export function __clearRateLimitMemory() {
  memoryStore.clear();
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Increment the counter and decide allowed/denied.
 * Returns `allowed=true` with the post-increment `remaining` count, or
 * `allowed=false` with a `retryAfterSec` matching the current window TTL.
 * If the store is unreachable, `storeUnreachable=true` and the caller picks
 * fail-open vs fail-closed.
 */
export async function checkRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const adapter = createRateLimitAdapter();
  try {
    const { count, ttlSec, storeUnreachable } = await adapter.incr(input.key, input.windowSec);
    if (storeUnreachable) {
      return { allowed: true, retryAfterSec: 0, remaining: input.limit, storeUnreachable: true };
    }
    const allowed = count <= input.limit;
    return {
      allowed,
      retryAfterSec: allowed ? 0 : ttlSec,
      remaining: Math.max(0, input.limit - count),
    };
  } catch (err) {
    // Treat thrown errors as store-unreachable.
    if (process.env.NODE_ENV !== 'test') {
      console.error('[rateLimit] adapter threw — treating as store-unreachable', err);
    }
    return { allowed: true, retryAfterSec: 0, remaining: input.limit, storeUnreachable: true };
  }
}

/**
 * Read-only counter check. Used by lockout gates that want to deny based on
 * past failures without themselves incrementing.
 */
export async function peekRateLimit(input: RateLimitInput): Promise<RateLimitResult> {
  const adapter = createRateLimitAdapter();
  try {
    const { count, ttlSec, storeUnreachable } = await adapter.peek(input.key);
    if (storeUnreachable) {
      return { allowed: true, retryAfterSec: 0, remaining: input.limit, storeUnreachable: true };
    }
    const allowed = count < input.limit;
    return {
      allowed,
      retryAfterSec: allowed ? 0 : ttlSec,
      remaining: Math.max(0, input.limit - count),
    };
  } catch {
    return { allowed: true, retryAfterSec: 0, remaining: input.limit, storeUnreachable: true };
  }
}

/**
 * Record a failed attempt against `key` (used by lockout counters). Returns
 * true iff the post-increment count puts the IP over the limit (so the
 * caller can phrase the response as a lockout vs a normal failure).
 */
export async function registerFailedAttempt(key: string, limit: number, windowSec: number): Promise<boolean> {
  const r = await checkRateLimit({ key, limit, windowSec });
  return !r.allowed;
}

/** Standard 429 payload + headers. */
export function rateLimitedResponse(retryAfterSec: number) {
  return {
    body: { success: false, message: 'Too many requests', code: 'rate_limited' as const },
    status: 429,
    headers: {
      'Retry-After': String(Math.max(1, retryAfterSec)),
    } satisfies Record<string, string>,
  };
}

/**
 * Per-route default ceilings. Tenant default is the catch-all; the named
 * routes have tighter overrides per PRP-002.
 */
export const TENANT_RATE_LIMITS = {
  default: { limit: 60, windowSec: 60 },
  'generate-forms': { limit: 10, windowSec: 60 },
  finalize: { limit: 10, windowSec: 60 },
  'sign-form': { limit: 20, windowSec: 60 },
  'sign-summary': { limit: 20, windowSec: 60 },
  'signature/capture': { limit: 20, windowSec: 60 },
} as const;

export type TenantRateLimitRoute = keyof typeof TENANT_RATE_LIMITS;

export function resolveTenantLimit(endpoint: string): { limit: number; windowSec: number } {
  // Try suffix match against the named routes; fall back to default.
  for (const key of Object.keys(TENANT_RATE_LIMITS) as TenantRateLimitRoute[]) {
    if (key === 'default') continue;
    if (endpoint === key || endpoint.endsWith(`/${key}`) || endpoint.includes(key)) {
      return TENANT_RATE_LIMITS[key];
    }
  }
  return TENANT_RATE_LIMITS.default;
}

/**
 * Extract a stable IP key from request headers. Vercel sets `x-vercel-ip*`;
 * `x-forwarded-for` is the fallback. Returns 'unknown' if neither is set.
 * Used by the signer routes and as a backstop for the tenant limiter.
 */
export function ipKeyFromHeaders(h: { get(name: string): string | null }): string {
  const v =
    h.get('x-vercel-forwarded-for') ??
    h.get('x-forwarded-for') ??
    h.get('x-real-ip') ??
    'unknown';
  // x-forwarded-for can be a comma-list; first entry is the client.
  return v.split(',')[0].trim() || 'unknown';
}

/** Signer-route lockout policy. */
export const SIGNER_FAILED_ATTEMPTS_LIMIT = 10;
export const SIGNER_LOCKOUT_WINDOW_SEC = 600; // 10 minutes
export const SIGNER_PER_IP_LIMIT = { limit: 30, windowSec: 60 };
