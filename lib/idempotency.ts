import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

  // PRD-66 (audit #9): scope the lookup by application_id too. The upsert
  // below has always written application_id, but the WHERE was previously
  // (key, endpoint) only — so a guessed/reused Idempotency-Key from one
  // tenant could replay another tenant's cached response. Pre-existing rows
  // without a matching application_id simply miss the cache and the
  // idempotent handler re-runs.
  const { data: existing } = await supabaseAdmin
    .from('tenant_idempotency_keys')
    .select('response_body, response_status, expires_at')
    .eq('key', key)
    .eq('endpoint', endpoint)
    .eq('application_id', applicationId)
    .maybeSingle();

  // PRD-83 #A7: epoch-ms comparison is the UTC-safe form. Pre-PRD-83 the
  // comparison was `new Date(existing.expires_at) > new Date()` — fine when
  // expires_at round-trips as a UTC instant (it does today, the column is
  // stored ISO), but ambiguous on a host with naive-timestamp drift. The
  // explicit `.getTime() > Date.now()` removes the ambiguity. A null or
  // unparseable expires_at evaluates to NaN, which is not greater than
  // Date.now() — so the cache is skipped fail-safe and the handler re-runs.
  if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
    return NextResponse.json(existing.response_body, { status: existing.response_status });
  }

  const { body, status } = await handler();

  await supabaseAdmin.from('tenant_idempotency_keys').upsert({
    key,
    endpoint,
    application_id: applicationId,
    response_body: body as object,
    response_status: status,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  return NextResponse.json(body, { status });
}
