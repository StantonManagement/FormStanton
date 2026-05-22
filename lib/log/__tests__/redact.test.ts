/**
 * PRP-018 / G2 — redact + clientIpFromHeaders tests.
 */

import { describe, it, expect } from 'vitest';
import { clientIpFromHeaders, redact, redactUrlString } from '@/lib/log/redact';

describe('redactUrlString', () => {
  it('redacts tenant_access_token in absolute URL', () => {
    const r = redactUrlString('https://app.example.com/pbv-full-app/abc?tenant_access_token=secret123&view=all');
    expect(r).toContain('tenant_access_token=%5BREDACTED%5D');
    expect(r).not.toContain('secret123');
    expect(r).toContain('view=all');
  });

  it('redacts token query-param in a relative URL', () => {
    const r = redactUrlString('/api/t/x/pbv-full-app?token=abc&y=1');
    expect(r).toContain('token=');
    expect(r).not.toContain('abc');
    expect(r).toContain('y=1');
  });

  it('leaves non-URL strings unchanged', () => {
    expect(redactUrlString('hello world')).toBe('hello world');
    expect(redactUrlString('')).toBe('');
  });
});

describe('redact (object/array deep walk)', () => {
  it('replaces top-level sensitive keys with [REDACTED]', () => {
    const out = redact({
      message: 'oops',
      tenant_access_token: 'aaa',
      magic_link_token: 'bbb',
      password: 'p',
      email: 'a@b.com',
      ssn: '123',
    } as any);
    expect(out.message).toBe('oops');
    expect(out.tenant_access_token).toBe('[REDACTED]');
    expect(out.magic_link_token).toBe('[REDACTED]');
    expect(out.password).toBe('[REDACTED]');
    expect(out.email).toBe('[REDACTED]');
    expect(out.ssn).toBe('[REDACTED]');
  });

  it('redacts within nested objects + arrays', () => {
    const out = redact({
      headers: { authorization: 'Bearer xyz', 'x-other': 'ok' },
      events: [{ message: 'hi', token: 'leak-me' }],
    } as any);
    expect((out.headers as any).authorization).toBe('[REDACTED]');
    expect((out.headers as any)['x-other']).toBe('ok');
    expect((out.events as any[])[0].token).toBe('[REDACTED]');
    expect((out.events as any[])[0].message).toBe('hi');
  });

  it('redacts tokens inside URL values nested in objects', () => {
    const out = redact({
      url: 'https://app.example.com/pbv-full-app/abc?tenant_access_token=secret',
    } as any);
    expect(out.url).not.toContain('secret');
  });

  it('handles primitives and null', () => {
    expect(redact(null as any)).toBeNull();
    expect(redact(42 as any)).toBe(42);
    expect(redact('plain' as any)).toBe('plain');
  });

  it('protects against pathological nesting depth', () => {
    let nested: any = { token: 'deep' };
    for (let i = 0; i < 50; i++) nested = { child: nested };
    expect(() => redact(nested)).not.toThrow();
  });
});

describe('clientIpFromHeaders', () => {
  function h(map: Record<string, string>) {
    return { get(name: string) { return map[name.toLowerCase()] ?? null; } };
  }
  it('prefers x-vercel-forwarded-for first entry', () => {
    expect(clientIpFromHeaders(h({ 'x-vercel-forwarded-for': '1.2.3.4, 9.9.9.9', 'x-forwarded-for': '8.8.8.8' }))).toBe('1.2.3.4');
  });
  it('falls back to leftmost non-private x-forwarded-for', () => {
    expect(clientIpFromHeaders(h({ 'x-forwarded-for': '10.0.0.1, 8.8.8.8, 9.9.9.9' }))).toBe('8.8.8.8');
  });
  it('skips RFC1918 ranges and ::1/localhost', () => {
    expect(clientIpFromHeaders(h({ 'x-forwarded-for': '192.168.1.1, 172.16.0.1, 5.5.5.5' }))).toBe('5.5.5.5');
    expect(clientIpFromHeaders(h({ 'x-forwarded-for': '::1' }))).toBe('::1'); // falls back to first since all private
  });
  it('returns null when no headers present', () => {
    expect(clientIpFromHeaders(h({}))).toBeNull();
  });
  it('falls back to x-real-ip when only it is set', () => {
    expect(clientIpFromHeaders(h({ 'x-real-ip': '7.7.7.7' }))).toBe('7.7.7.7');
  });
});
