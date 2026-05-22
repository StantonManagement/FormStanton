/**
 * PRP-002 — Rate limiter unit tests.
 *
 * Exercises: window allow/deny/reset, peek semantics, store-unreachable
 * fail-open, IP key extraction, tenant-route limit resolution.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  __clearRateLimitMemory,
  __setRateLimitAdapter,
  checkRateLimit,
  ipKeyFromHeaders,
  peekRateLimit,
  rateLimitedResponse,
  registerFailedAttempt,
  resolveTenantLimit,
  type RateLimitAdapter,
} from '@/lib/rateLimit';

beforeEach(() => {
  __setRateLimitAdapter(null);
  __clearRateLimitMemory();
});

describe('checkRateLimit (memory adapter)', () => {
  it('allows up to the limit then denies with Retry-After', async () => {
    const limit = 3;
    const windowSec = 60;
    const key = 'test:basic';

    for (let i = 0; i < limit; i++) {
      const r = await checkRateLimit({ key, limit, windowSec });
      expect(r.allowed).toBe(true);
      expect(r.remaining).toBe(limit - (i + 1));
    }

    const denied = await checkRateLimit({ key, limit, windowSec });
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(windowSec);
  });

  it('re-allows after window expires', async () => {
    vi.useFakeTimers();
    try {
      const key = 'test:reset';
      const limit = 2;
      const windowSec = 5;

      await checkRateLimit({ key, limit, windowSec });
      await checkRateLimit({ key, limit, windowSec });
      const denied = await checkRateLimit({ key, limit, windowSec });
      expect(denied.allowed).toBe(false);

      vi.advanceTimersByTime((windowSec + 1) * 1000);

      const reallowed = await checkRateLimit({ key, limit, windowSec });
      expect(reallowed.allowed).toBe(true);
      expect(reallowed.remaining).toBe(limit - 1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('peekRateLimit', () => {
  it('does not increment the counter', async () => {
    const key = 'test:peek';
    await checkRateLimit({ key, limit: 5, windowSec: 60 });
    await checkRateLimit({ key, limit: 5, windowSec: 60 });

    const peek1 = await peekRateLimit({ key, limit: 5, windowSec: 60 });
    const peek2 = await peekRateLimit({ key, limit: 5, windowSec: 60 });
    expect(peek1.remaining).toBe(3);
    expect(peek2.remaining).toBe(3);
  });

  it('reports denial when count >= limit without mutating', async () => {
    const key = 'test:peek-denied';
    for (let i = 0; i < 5; i++) await checkRateLimit({ key, limit: 5, windowSec: 60 });
    const peek = await peekRateLimit({ key, limit: 5, windowSec: 60 });
    expect(peek.allowed).toBe(false);
  });

  it('returns allowed when no entry exists', async () => {
    const peek = await peekRateLimit({ key: 'test:never-seen', limit: 5, windowSec: 60 });
    expect(peek.allowed).toBe(true);
    expect(peek.remaining).toBe(5);
  });
});

describe('store-unreachable behavior', () => {
  it('fail-open on storeUnreachable flag', async () => {
    const flakyAdapter: RateLimitAdapter = {
      async incr() {
        return { count: 0, ttlSec: 0, storeUnreachable: true };
      },
      async peek() {
        return { count: 0, ttlSec: 0, storeUnreachable: true };
      },
    };
    __setRateLimitAdapter(flakyAdapter);
    const r = await checkRateLimit({ key: 'whatever', limit: 1, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.storeUnreachable).toBe(true);
  });

  it('fail-open when adapter throws', async () => {
    const throwingAdapter: RateLimitAdapter = {
      async incr() {
        throw new Error('store down');
      },
      async peek() {
        throw new Error('store down');
      },
    };
    __setRateLimitAdapter(throwingAdapter);
    const r = await checkRateLimit({ key: 'whatever', limit: 1, windowSec: 60 });
    expect(r.allowed).toBe(true);
    expect(r.storeUnreachable).toBe(true);
  });
});

describe('registerFailedAttempt', () => {
  it('returns true once the threshold is crossed', async () => {
    const key = 'test:lockout';
    for (let i = 0; i < 9; i++) {
      const overLimit = await registerFailedAttempt(key, 10, 600);
      expect(overLimit).toBe(false);
    }
    const overLimit = await registerFailedAttempt(key, 10, 600);
    expect(overLimit).toBe(false); // post-increment count is exactly 10 = limit, still allowed
    const next = await registerFailedAttempt(key, 10, 600);
    expect(next).toBe(true);
  });
});

describe('ipKeyFromHeaders', () => {
  function fakeHeaders(map: Record<string, string>) {
    return {
      get(name: string) {
        return map[name.toLowerCase()] ?? null;
      },
    };
  }

  it('prefers x-vercel-forwarded-for', async () => {
    expect(
      ipKeyFromHeaders(
        fakeHeaders({ 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': '5.6.7.8' })
      )
    ).toBe('1.2.3.4');
  });

  it('falls back to x-forwarded-for first entry', () => {
    expect(
      ipKeyFromHeaders(fakeHeaders({ 'x-forwarded-for': '1.2.3.4, 9.9.9.9' }))
    ).toBe('1.2.3.4');
  });

  it('returns "unknown" when no headers present', () => {
    expect(ipKeyFromHeaders(fakeHeaders({}))).toBe('unknown');
  });
});

describe('resolveTenantLimit', () => {
  it('returns named overrides for generate-forms/finalize/sign-form/sign-summary/signature/capture', () => {
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/generate-forms').limit).toBe(10);
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/finalize').limit).toBe(10);
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/sign-form').limit).toBe(20);
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/sign-summary').limit).toBe(20);
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/signature/capture').limit).toBe(20);
  });

  it('falls back to default (60/min) for unnamed endpoints', () => {
    expect(resolveTenantLimit('/api/t/abc/pbv-full-app/dashboard').limit).toBe(60);
  });
});

describe('rateLimitedResponse', () => {
  it('returns 429 + Retry-After + rate_limited code', () => {
    const r = rateLimitedResponse(42);
    expect(r.status).toBe(429);
    expect(r.headers['Retry-After']).toBe('42');
    expect(r.body.code).toBe('rate_limited');
  });

  it('clamps Retry-After to >= 1', () => {
    const r = rateLimitedResponse(0);
    expect(r.headers['Retry-After']).toBe('1');
  });
});
