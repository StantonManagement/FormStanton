/**
 * GET /api/cron/cleanup-idempotency-keys
 *
 * Vercel cron endpoint (daily at 02:00 UTC). Deletes expired rows from
 * tenant_idempotency_keys. Protected by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
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
