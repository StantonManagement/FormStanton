/**
 * PRP-004 — Runtime env assertion tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { __resetRuntimeEnvCheck, assertRuntimeEnv, REQUIRED_RUNTIME_ENV } from '@/lib/env/runtimeCheck';

const goodEnv: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a'.repeat(150),
  SUPABASE_SERVICE_ROLE_KEY: 's'.repeat(150),
  SESSION_SECRET: 's'.repeat(32),
  CRON_SECRET: 'c'.repeat(16),
};

beforeEach(() => {
  __resetRuntimeEnvCheck();
});

describe('assertRuntimeEnv', () => {
  it('passes when all required vars present and well-formed', () => {
    const r = assertRuntimeEnv(goodEnv as unknown as NodeJS.ProcessEnv);
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.invalid).toEqual([]);
  });

  it('flags missing CRON_SECRET specifically', () => {
    const env = { ...goodEnv };
    delete env.CRON_SECRET;
    const r = assertRuntimeEnv(env as unknown as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('CRON_SECRET');
  });

  it('flags too-short CRON_SECRET as invalid (not missing)', () => {
    const env = { ...goodEnv, CRON_SECRET: 'too-short' };
    const r = assertRuntimeEnv(env as unknown as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    expect(r.invalid).toContain('CRON_SECRET');
    expect(r.missing).not.toContain('CRON_SECRET');
  });

  it('flags every missing var, not just the first', () => {
    const r = assertRuntimeEnv({} as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    expect(r.missing.length).toBe(REQUIRED_RUNTIME_ENV.length);
  });

  it('memoizes — second call returns the same object', () => {
    const r1 = assertRuntimeEnv(goodEnv as unknown as NodeJS.ProcessEnv);
    const r2 = assertRuntimeEnv({} as NodeJS.ProcessEnv);
    expect(r2).toBe(r1);
    expect(r2.ok).toBe(true); // memoized — second env is ignored
  });

  it('treats empty-string env as missing', () => {
    const env = { ...goodEnv, SESSION_SECRET: '' };
    const r = assertRuntimeEnv(env as unknown as NodeJS.ProcessEnv);
    expect(r.ok).toBe(false);
    expect(r.missing).toContain('SESSION_SECRET');
  });
});
