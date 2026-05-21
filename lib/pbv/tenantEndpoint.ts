import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withIdempotency } from '@/lib/idempotency';

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

  // F5: Use custom idempotency key if provided (e.g., ceremony_id + form_document_id)
  const effectiveKey = idempotencyKey ?? endpoint;
  return withIdempotency(request, app.id, effectiveKey, () => handler(app));
}
