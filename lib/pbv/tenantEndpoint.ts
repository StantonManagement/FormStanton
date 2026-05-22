import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { withIdempotency } from '@/lib/idempotency';
import {
  checkRateLimit,
  ipKeyFromHeaders,
  rateLimitedResponse,
  resolveTenantLimit,
} from '@/lib/rateLimit';

/**
 * PRP-020 / D7 — CSRF defense-in-depth (Phase 1: WARN mode).
 *
 * Token shape: `${expEpochSec}.${base64url(hmac(appId|expEpochSec))}`,
 * signed with SESSION_SECRET (already a required env). 15-minute TTL.
 *
 * Phase 1 (this PRP): bootstrap GET responses get `_csrf` injected into
 * their JSON body; mutating POSTs that send an X-CSRF-Token header have
 * it verified; missing/invalid currently LOGS a warning but does not 403,
 * so the client wiring can land in a follow-up without breaking the live
 * flow. Phase 2 flips to strict 403 once tenantFetch sends the header
 * on every mutating call.
 */
const CSRF_TTL_SECONDS = 15 * 60;

function csrfSecret(): string {
  return process.env.SESSION_SECRET ?? 'pbv-csrf-dev-secret-only-for-test';
}

export function issueCsrfToken(appId: string, nowMs = Date.now()): string {
  const exp = Math.floor(nowMs / 1000) + CSRF_TTL_SECONDS;
  const payload = `${appId}|${exp}`;
  const sig = createHmac('sha256', csrfSecret()).update(payload).digest('base64url');
  return `${exp}.${sig}`;
}

export function verifyCsrfToken(appId: string, token: string | null | undefined, nowMs = Date.now()): boolean {
  if (!token || typeof token !== 'string') return false;
  const [expStr, sig] = token.split('.', 2);
  if (!expStr || !sig) return false;
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(exp)) return false;
  if (exp < Math.floor(nowMs / 1000)) return false;
  const expected = createHmac('sha256', csrfSecret()).update(`${appId}|${exp}`).digest('base64url');
  // Length-mismatch is a fast reject; timing-safe compare otherwise.
  if (sig.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

const CSRF_METHODS_TO_VERIFY = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface TenantApp {
  id: string;
  submitted_at: string | null;
  packet_locked?: boolean | null;
  [key: string]: unknown;
}

/**
 * PRD-77 #5: `packet_locked` must always be fetched so the gate cannot be
 * bypassed by a caller whose `select` string omits the column. We append
 * `packet_locked` to whatever the caller passed (de-duplicating if already
 * present) so existing callers keep their selects unchanged.
 */
function ensurePacketLockedSelected(select: string): string {
  // Tokenize on commas, trim, then re-join. Avoids fragile regex over
  // PostgREST select syntax (which can contain nested ()/() embeds, but
  // none of the tenant routes use them — confirmed 2026-05-21).
  const cols = select
    .split(',')
    .map(c => c.trim())
    .filter(Boolean);
  if (!cols.includes('packet_locked')) cols.push('packet_locked');
  return cols.join(', ');
}

async function resolveTokenToApp(
  token: string,
  select = 'id, submitted_at'
): Promise<TenantApp | null> {
  const effectiveSelect = ensurePacketLockedSelected(select);
  const { data, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select(effectiveSelect)
    .eq('tenant_access_token', token)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as TenantApp;
}

export async function withTenantContext(
  request: NextRequest,
  token: string,
  endpoint: string,
  handler: (app: TenantApp) => Promise<{ body: unknown; status: number }>,
  select?: string,
  idempotencyKey?: string // F5: optional custom key for fine-grained idempotency
): Promise<NextResponse> {
  // PRP-002 / D2: limiter runs BEFORE the DB lookup so token brute-force and
  // compute floods (generate-forms, finalize) are throttled at the wrapper.
  // Two checks: per-token+route and per-IP backstop. Either denial → 429.
  const ipKey = ipKeyFromHeaders(request.headers);
  const { limit, windowSec } = resolveTenantLimit(endpoint);

  const tokenCheck = await checkRateLimit({
    key: `tenant:${endpoint}:${token}`,
    limit,
    windowSec,
  });
  if (!tokenCheck.allowed) {
    const r = rateLimitedResponse(tokenCheck.retryAfterSec);
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  // Per-IP backstop. Larger window/limit so legitimate multi-tab users aren't
  // hurt, but a single host hammering tokens across the space is still capped.
  const ipCheck = await checkRateLimit({
    key: `tenant-ip:${ipKey}`,
    limit: 240,
    windowSec: 60,
  });
  if (!ipCheck.allowed) {
    const r = rateLimitedResponse(ipCheck.retryAfterSec);
    return NextResponse.json(r.body, { status: r.status, headers: r.headers });
  }

  const app = await resolveTokenToApp(token, select);

  if (!app) {
    return NextResponse.json(
      { success: false, message: 'Not found' },
      { status: 404 }
    );
  }

  if (app.submitted_at) {
    return NextResponse.json(
      { success: false, message: 'Application already submitted', code: 'submitted_locked' },
      { status: 409 }
    );
  }

  // PRD-77 #5: centralized packet_locked gate. Covers sign-form, generate-forms,
  // finalize, and intake/complete (all flow through withTenantContext). The
  // upload route's local check (upload/route.ts:40) is now redundant but is
  // intentionally left in place (belt-and-suspenders); PRD-77 does not edit
  // that file (PRD-76 owns it).
  if (app.packet_locked) {
    return NextResponse.json(
      {
        success: false,
        message: 'This packet is currently under review. Please contact the Stanton office.',
        code: 'packet_locked',
      },
      { status: 409 }
    );
  }

  // PRP-020 / D7 — CSRF verification (Phase 1: WARN mode).
  // On mutating methods, check the X-CSRF-Token header against the
  // HMAC over the application id. Missing/invalid currently logs a
  // warning so we can see how often clients call without the header
  // before flipping to strict 403 in Phase 2.
  if (CSRF_METHODS_TO_VERIFY.has(request.method.toUpperCase())) {
    const token = request.headers.get('x-csrf-token');
    if (!verifyCsrfToken(app.id, token)) {
      console.warn(
        '[csrf] missing or invalid token',
        JSON.stringify({ endpoint, method: request.method, app_id: app.id, has_token: !!token })
      );
      // Phase 1: do NOT 403. Phase 2 follow-up will return 403 here.
    }
  }

  // F5: Use custom idempotency key if provided (e.g., ceremony_id + form_document_id)
  const effectiveKey = idempotencyKey ?? endpoint;
  let response: NextResponse;
  try {
    response = await withIdempotency(request, app.id, effectiveKey, () => handler(app));
  } catch (err: any) {
    // A handler that throws would otherwise propagate to Next.js and surface as
    // an opaque empty-body 500 (observed on generate-forms 2026-05-22, where the
    // tenant just saw "Failed to generate forms" with nothing logged). Log
    // structured detail and return a diagnosable body. Centralized here so it
    // covers every tenant route (generate-forms, finalize, sign-form,
    // intake/complete, ...) rather than per-route try/catch.
    console.error(
      '[withTenantContext] handler threw',
      JSON.stringify({
        endpoint,
        method: request.method,
        app_id: app.id,
        message: err?.message ?? String(err),
      }),
      err?.stack ?? ''
    );
    return NextResponse.json(
      { success: false, message: 'Internal server error', code: 'server_error', endpoint },
      { status: 500 }
    );
  }

  // PRP-020 / D7: issue a fresh CSRF token on every GET response so the
  // client always has a valid (short-TTL) token for its next mutating
  // call. We rewrap the JSON body to inject `_csrf`. Non-JSON responses
  // and non-2xx responses are passed through unchanged.
  if (request.method.toUpperCase() === 'GET' && response.status >= 200 && response.status < 300) {
    try {
      const cloned = response.clone();
      const body = await cloned.json();
      if (body && typeof body === 'object') {
        const augmented = { ...body, _csrf: issueCsrfToken(app.id) };
        return NextResponse.json(augmented, { status: response.status, headers: response.headers });
      }
    } catch {
      // body wasn't JSON; pass through.
    }
  }
  return response;
}
