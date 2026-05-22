/**
 * PRD-74 Phase 1 — cron auth helper fail-closed behavior.
 *
 * Gates covered:
 *  - Gate 1: CRON_SECRET unset → 401, error log emitted.
 *  - Gate 2: CRON_SECRET set + wrong/missing Bearer → 401.
 *  - Gate 3: CRON_SECRET set + correct Bearer → null (authorized).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assertCronAuthorized } from '../auth';

function makeRequest(authHeader?: string): NextRequest {
  const headers = new Headers();
  if (authHeader) headers.set('authorization', authHeader);
  return new NextRequest(new URL('http://example.test/api/cron/test'), {
    headers,
  });
}

describe('assertCronAuthorized', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('Gate 1: returns 401 when CRON_SECRET is unset and logs cron_secret_unset', async () => {
    delete process.env.CRON_SECRET;
    const res = assertCronAuthorized(makeRequest('Bearer anything'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    const logged = consoleErrorSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(logged);
    expect(parsed.event).toBe('cron_secret_unset');
    expect(parsed.path).toBe('/api/cron/test');
  });

  it('Gate 2a: returns 401 when CRON_SECRET is set and no Authorization header is sent', () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = assertCronAuthorized(makeRequest());
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('Gate 2b: returns 401 when CRON_SECRET is set and the Bearer value mismatches', () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = assertCronAuthorized(makeRequest('Bearer wrong'));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('Gate 3: returns null (authorized) when CRON_SECRET matches the Bearer header', () => {
    process.env.CRON_SECRET = 'real-secret';
    const res = assertCronAuthorized(makeRequest('Bearer real-secret'));
    expect(res).toBeNull();
  });
});
