/**
 * tenantFetch tests — PRP-011 covers retry/backoff/idempotency-key handling
 * on top of the original PRD-19 contract (header presence, timeout selection).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tenantFetch } from '../tenantFetch';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

function okResponse(body = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Header presence + body shape (PRD-19 contract, preserved). ──────────────
describe('tenantFetch — header / body contract', () => {
  it('GET: no idempotency key, no Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test');
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.method).toBe('GET');
  });

  it('POST with JSON body: adds Idempotency-Key and Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test', { method: 'POST', body: { foo: 'bar' } });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('test-uuid-1234');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"foo":"bar"}');
  });

  it('POST with FormData: adds Idempotency-Key, no Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    const formData = new FormData();
    formData.append('file', new Blob(['data']), 'test.jpg');
    await tenantFetch('/api/upload', { method: 'POST', body: formData });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('test-uuid-1234');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(formData);
  });

  it('explicit idempotent:false suppresses key on POST', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test', { method: 'POST', body: {}, idempotent: false });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });
});

// ── PRP-011 / E3: caller-supplied idempotencyKey honored verbatim. ──────────
describe('tenantFetch — idempotencyKey (E3)', () => {
  it('passes caller-supplied idempotencyKey verbatim on POST', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/x', { method: 'POST', body: { a: 1 }, idempotencyKey: 'caller-key-123' });
    expect(mockFetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('caller-key-123');
  });

  it('reuses the supplied key across retry attempts (server-side dedup intact)', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('net'))
      .mockResolvedValueOnce(okResponse());
    const p = tenantFetch('/x', { method: 'POST', body: {}, idempotencyKey: 'k1' });
    await vi.advanceTimersByTimeAsync(1_000);
    await p;
    expect(mockFetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('k1');
    expect(mockFetch.mock.calls[1][1].headers['Idempotency-Key']).toBe('k1');
  });

  it('generates a key for POST when none supplied (preserves dedup default)', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/x', { method: 'POST', body: {} });
    expect(mockFetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('test-uuid-1234');
  });
});

// ── PRP-011 / C2: backoff on transient errors, only when idempotent. ────────
describe('tenantFetch — exponential backoff (C2)', () => {
  it('GET retries on TypeError up to 4 attempts then succeeds', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('net'))
      .mockRejectedValueOnce(new TypeError('net'))
      .mockResolvedValueOnce(okResponse());
    const p = tenantFetch('/x');
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('GET retries on retryable 5xx (503 -> 502 -> 504 -> 200)', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 502 }))
      .mockResolvedValueOnce(new Response('', { status: 504 }))
      .mockResolvedValueOnce(okResponse());
    const p = tenantFetch('/x');
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('does NOT retry a 4xx (returns the 404 immediately)', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    const res = await tenantFetch('/x');
    expect(res.status).toBe(404);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a POST when idempotent:false (key suppressed)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('net'));
    await expect(
      tenantFetch('/x', { method: 'POST', body: { a: 1 }, idempotent: false })
    ).rejects.toThrow(/net/);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('DOES retry a default POST (auto-key enables server dedup)', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('net'))
      .mockResolvedValueOnce(okResponse());
    const p = tenantFetch('/x', { method: 'POST', body: { a: 1 } });
    await vi.advanceTimersByTimeAsync(1_000);
    await p;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('treats internal timeout (AbortError) as transient and retries', async () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortErr).mockResolvedValueOnce(okResponse());
    const p = tenantFetch('/x');
    await vi.advanceTimersByTimeAsync(1_000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry a non-network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('some other error'));
    await expect(tenantFetch('/x')).rejects.toThrow('some other error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget and throws the last error', async () => {
    mockFetch.mockImplementation(async () => {
      throw new TypeError('net');
    });
    const p = tenantFetch('/x').catch(e => e);
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.advanceTimersByTimeAsync(4_000);
    const err = await p;
    expect(err).toBeInstanceOf(TypeError);
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});
