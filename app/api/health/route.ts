/**
 * GET /api/health
 *
 * Unauthenticated liveness/readiness probe. No body fields contain secrets
 * or PII; only the missing/failing check NAMES are surfaced.
 *
 * 200 → all checks ok.
 * 503 → any failing check (env or Supabase ping); body names the failure.
 *
 * PRP-004 / I2.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { assertRuntimeEnv } from '@/lib/env/runtimeCheck';

export const dynamic = 'force-dynamic';

const SUPABASE_PING_TIMEOUT_MS = 2500;

async function pingSupabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    // Tiny head query — no rows transferred, just metadata. Bounded by a
    // short timeout so a degraded DB doesn't keep the probe open.
    const result = await Promise.race([
      supabaseAdmin
        .from('pbv_full_applications')
        .select('id', { count: 'exact', head: true })
        .limit(1),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('supabase_ping_timeout')), SUPABASE_PING_TIMEOUT_MS)
      ),
    ]);
    const latencyMs = Date.now() - t0;
    // PostgrestResponse exposes `error`; we don't unwrap counts/data.
    if ((result as { error?: { message?: string } | null }).error) {
      return { ok: false, latencyMs, error: 'supabase_query_error' };
    }
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - t0;
    const error =
      err instanceof Error && err.message === 'supabase_ping_timeout'
        ? 'supabase_ping_timeout'
        : 'supabase_ping_failed';
    return { ok: false, latencyMs, error };
  }
}

export async function GET() {
  const envCheck = assertRuntimeEnv();
  const checks: Record<string, { ok: boolean; [k: string]: unknown }> = {
    env: { ok: envCheck.ok, missing: envCheck.missing, invalid: envCheck.invalid },
  };

  // Only ping Supabase if env is sane — a missing service-role key would
  // make the ping fail in a confusing way.
  if (envCheck.ok) {
    checks.supabase = await pingSupabase();
  } else {
    checks.supabase = { ok: false, error: 'env_check_failed' };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks },
    { status: allOk ? 200 : 503 }
  );
}
