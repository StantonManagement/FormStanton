import { NextRequest, NextResponse } from 'next/server';

/**
 * Fail-closed cron authorization.
 *
 * Returns a 401 response if either:
 *   - CRON_SECRET is unset (treated as a misconfiguration — the cron must
 *     never run open), or
 *   - The Authorization header does not match `Bearer <CRON_SECRET>`.
 *
 * Returns null when the caller is authorized.
 *
 * Operational note: CRON_SECRET must be set in prod AND preview envs, and
 * the Vercel cron invocation must send `Authorization: Bearer <CRON_SECRET>`.
 */
export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      JSON.stringify({
        event: 'cron_secret_unset',
        path: request.nextUrl.pathname,
      })
    );
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
