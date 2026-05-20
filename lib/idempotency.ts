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

  const { data: existing } = await supabaseAdmin
    .from('tenant_idempotency_keys')
    .select('response_body, response_status, expires_at')
    .eq('key', key)
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (existing && new Date(existing.expires_at) > new Date()) {
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
