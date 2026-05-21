import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withIdempotency } from '@/lib/idempotency';

export interface TenantApp {
  id: string;
  submitted_at: string | null;
  [key: string]: unknown;
}

async function resolveTokenToApp(
  token: string,
  select = 'id, submitted_at'
): Promise<TenantApp | null> {
  const { data, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select(select)
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

  // F5: Use custom idempotency key if provided (e.g., ceremony_id + form_document_id)
  const effectiveKey = idempotencyKey ?? endpoint;
  return withIdempotency(request, app.id, effectiveKey, () => handler(app));
}
