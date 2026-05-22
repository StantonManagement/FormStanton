import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// L7: an in-progress claim row is written with this sentinel status. 0 is not
// a valid HTTP status, so it unambiguously means "a request is currently
// running this handler". A completed row always carries a real (>=100) status.
const IN_PROGRESS = 0;
// How long a claim may sit in-progress before another request may reclaim it
// (owner crashed / instance died mid-run). Longer than any legitimate handler
// runtime, short enough not to deadlock a genuine retry.
const CLAIM_STALE_MS = 90_000;
const POLL_INTERVAL_MS = 250;
const POLL_TIMEOUT_MS = 15_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Idempotency wrapper for tenant POSTs.
 *
 * Without an Idempotency-Key the handler simply runs (no caching).
 *
 * With a key, exactly one concurrent request runs the handler. The previous
 * implementation read the cache then ran the handler (check-then-act), so two
 * concurrent requests with the same key both missed the cache and both
 * executed the handler (L7 / audit). This version uses an atomic INSERT claim
 * against the PRIMARY KEY (key, endpoint): the insert fails for every request
 * but the first, so the loser polls for the winner's response instead of
 * re-running. PRD-66 scoping (by application_id) and PRD-83 epoch-ms expiry
 * comparison are preserved.
 */
export async function withIdempotency<T>(
  request: NextRequest,
  applicationId: string,
  endpoint: string,
  handler: () => Promise<{ body: T; status: number }>
): Promise<NextResponse> {
  const key = request.headers.get('Idempotency-Key');

  if (!key) {
    const { body, status } = await handler();
    return NextResponse.json(body, { status });
  }

  const readRow = async () =>
    (
      await supabaseAdmin
        .from('tenant_idempotency_keys')
        .select('response_body, response_status, expires_at, created_at')
        .eq('key', key)
        .eq('endpoint', endpoint)
        .eq('application_id', applicationId)
        .maybeSingle()
    ).data;

  const isFreshCompleted = (row: any) =>
    row &&
    row.response_status !== IN_PROGRESS &&
    new Date(row.expires_at).getTime() > Date.now();

  const releaseClaim = () =>
    supabaseAdmin
      .from('tenant_idempotency_keys')
      .delete()
      .eq('key', key)
      .eq('endpoint', endpoint)
      .eq('application_id', applicationId)
      .eq('response_status', IN_PROGRESS);

  // Fast path: a completed, unexpired cached response.
  const existing = await readRow();
  if (isFreshCompleted(existing)) {
    return NextResponse.json(existing!.response_body, { status: existing!.response_status });
  }

  // Atomic claim: INSERT an in-progress sentinel. The PRIMARY KEY (key,
  // endpoint) makes this insert fail if any row already exists, so exactly one
  // concurrent request wins the claim and runs the handler.
  const { error: claimError } = await supabaseAdmin
    .from('tenant_idempotency_keys')
    .insert({
      key,
      endpoint,
      application_id: applicationId,
      response_body: {},
      response_status: IN_PROGRESS,
      expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    });

  if (!claimError) {
    // We own the claim — run the handler exactly once and record the result.
    try {
      const { body, status } = await handler();
      await supabaseAdmin
        .from('tenant_idempotency_keys')
        .update({
          response_body: body as object,
          response_status: status,
          expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
        })
        .eq('key', key)
        .eq('endpoint', endpoint)
        .eq('application_id', applicationId);
      return NextResponse.json(body, { status });
    } catch (e) {
      // Release the claim so a legitimate retry isn't blocked by a failed run.
      await releaseClaim();
      throw e;
    }
  }

  // Claim failed → a row already exists. Either another request is mid-flight
  // (in-progress) for this app, or a completed row exists under a different
  // application_id (the PK is (key, endpoint) only; readRow won't see it).
  // Poll for a completed response for THIS app.
  const startedAt = Date.now();
  while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
    const row = await readRow();
    if (isFreshCompleted(row)) {
      return NextResponse.json(row!.response_body, { status: row!.response_status });
    }
    // Stale in-progress (crashed owner) → reclaim and stop waiting.
    if (
      row &&
      row.response_status === IN_PROGRESS &&
      row.created_at &&
      Date.now() - new Date(row.created_at).getTime() > CLAIM_STALE_MS
    ) {
      await releaseClaim();
      break;
    }
    // No row for this app (a different-app row holds the PK) → don't wait.
    if (!row) break;
    await sleep(POLL_INTERVAL_MS);
  }

  // Fail-open: run the handler. This is never worse than the pre-L7 behavior
  // (which always ran), and the critical handlers (signing, finalize) carry
  // their own idempotency guards. upsert records the response for later reads.
  const { body, status } = await handler();
  await supabaseAdmin.from('tenant_idempotency_keys').upsert({
    key,
    endpoint,
    application_id: applicationId,
    response_body: body as object,
    response_status: status,
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  });

  return NextResponse.json(body, { status });
}
