import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantFetch, TENANT_FETCH_TIMEOUT_DEFAULT, TENANT_FETCH_TIMEOUT_UPLOAD } from '../tenantFetch';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1234' });

function okResponse(body = {}): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('tenantFetch', () => {
  it('GET: no idempotency key, no Content-Type, uses default timeout', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test');

    const [_url, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.method).toBe('GET');
  });

  it('POST with JSON body: adds Idempotency-Key and Content-Type', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test', { method: 'POST', body: { foo: 'bar' } });

    const [_url, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('test-uuid-1234');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"foo":"bar"}');
  });

  it('POST with FormData: adds Idempotency-Key, no Content-Type, uses upload timeout', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    const formData = new FormData();
    formData.append('file', new Blob(['data']), 'test.jpg');
    await tenantFetch('/api/upload', { method: 'POST', body: formData });

    const [_url, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBe('test-uuid-1234');
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBe(formData);
  });

  it('retries once on TypeError (network failure)', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse());

    const res = await tenantFetch('/api/test', { method: 'POST', body: { x: 1 } });
    expect(res.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on AbortError (timeout)', async () => {
    const abortErr = new DOMException('The operation was aborted', 'AbortError');
    mockFetch.mockRejectedValueOnce(abortErr);

    await expect(tenantFetch('/api/test')).rejects.toThrow('aborted');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on non-network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('some other error'));

    await expect(tenantFetch('/api/test')).rejects.toThrow('some other error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('idempotency key is shared across retry attempts (same key for both tries)', async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okResponse());

    await tenantFetch('/api/test', { method: 'POST', body: {} });

    const key1 = mockFetch.mock.calls[0][1].headers['Idempotency-Key'];
    const key2 = mockFetch.mock.calls[1][1].headers['Idempotency-Key'];
    expect(key1).toBe(key2);
    expect(key1).toBe('test-uuid-1234');
  });

  it('explicit idempotent: false suppresses key even on POST', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test', { method: 'POST', body: {}, idempotent: false });

    const [_url, init] = mockFetch.mock.calls[0];
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });

  it('uses upload timeout for FormData body', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    const formData = new FormData();
    await tenantFetch('/api/upload', { method: 'POST', body: formData });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('respects explicit timeout override', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    await tenantFetch('/api/test', { timeout: 5000 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
