/**
 * GET /api/cron/cleanup-idempotency-keys
 *
 * Vercel cron endpoint (daily at 02:00 UTC). Deletes expired rows from
 * tenant_idempotency_keys. Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertCronAuthorized } from '@/lib/cron/auth';
import { claimCronRun } from '@/lib/cron/runLock';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  // PRD-74 Phase 3: cleanup is idempotent (a delete by expires_at), so a
  // double-run is harmless. Lock for consistency with the other cron routes;
  // a missed lease (skipped run) is also fine — the next scheduled run picks
  // up the expired rows.
  const acquired = await claimCronRun('cleanup-idempotency-keys', 120);
  if (!acquired) {
    console.log(
      JSON.stringify({ event: 'cron_skipped_locked', job: 'cleanup-idempotency-keys' })
    );
    return NextResponse.json({ success: true, skipped: true });
  }

  const { error, count } = await supabaseAdmin
    .from('tenant_idempotency_keys')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('[cleanup-idempotency-keys] Delete failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  console.log(`[cleanup-idempotency-keys] Deleted ${count ?? 0} expired rows`);
  return NextResponse.json({ success: true, deleted: count ?? 0 });
}
