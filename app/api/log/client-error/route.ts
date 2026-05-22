/**
 * POST /api/log/client-error
 *
 * Best-effort client-side error reporter. Public (unauth'd) — error reporters
 * cannot depend on auth. Validates shape, length-caps each string to keep
 * abuse small, and just console.errors so Vercel function logs capture it.
 *
 * Intentionally no DB / Sentry / external calls — cheap and reliable.
 *
 * PRP-018:
 *   - G2: payload runs through `redact()` before logging so any
 *     tenant_access_token in `url` (or other sensitive key) is stripped.
 *   - D5: client IP derived via `clientIpFromHeaders()` (prefers
 *     x-vercel-forwarded-for, then leftmost non-private x-forwarded-for)
 *     instead of trusting the raw x-forwarded-for header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { clientIpFromHeaders, redact } from '@/lib/log/redact';

const MAX_STR = 4096;

function clip(v: unknown): string {
  if (typeof v !== 'string') return '';
  return v.length > MAX_STR ? v.slice(0, MAX_STR) + '…[truncated]' : v;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const payload = redact({
      message: clip((body as any).message),
      stack: clip((body as any).stack),
      digest: clip((body as any).digest),
      userAgent: clip((body as any).userAgent),
      url: clip((body as any).url),
      when: clip((body as any).when),
      ip: clientIpFromHeaders(request.headers),
      ts: new Date().toISOString(),
    });

    // Vercel captures stderr from console.error in the Functions log.
    console.error('[client-error]', JSON.stringify(payload));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[client-error] handler failure:', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
