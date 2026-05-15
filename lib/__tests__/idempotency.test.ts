import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockMaybeSingle, mockUpsert, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockUpsert = vi.fn().mockResolvedValue({ error: null });
  const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
  const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect, upsert: mockUpsert });
  return { mockMaybeSingle, mockUpsert, mockFrom };
});

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: mockFrom },
}));

import { withIdempotency } from '../idempotency';

function makeRequest(idempotencyKey?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  return new NextRequest('http://localhost/api/test', { headers });
}

const APP_ID = '00000000-0000-0000-0000-000000000001';
const ENDPOINT = 'intake';
const HANDLER_BODY = { success: true, data: { id: '123' } };
const HANDLER_STATUS = 200;

const handler = vi.fn().mockResolvedValue({ body: HANDLER_BODY, status: HANDLER_STATUS });

beforeEach(() => {
  vi.clearAllMocks();
  handler.mockResolvedValue({ body: HANDLER_BODY, status: HANDLER_STATUS });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockUpsert.mockResolvedValue({ error: null });
});

describe('withIdempotency', () => {
  it('no-key passthrough: runs handler, does not store, returns handler response', async () => {
    const req = makeRequest();
    const res = await withIdempotency(req, APP_ID, ENDPOINT, handler);
    const json = await res.json();

    expect(handler).toHaveBeenCalledOnce();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(json).toEqual(HANDLER_BODY);
    expect(res.status).toBe(HANDLER_STATUS);
  });

  it('first write: runs handler and stores the result', async () => {
    const req = makeRequest('key-abc-123');
    const res = await withIdempotency(req, APP_ID, ENDPOINT, handler);
    const json = await res.json();

    expect(handler).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(json).toEqual(HANDLER_BODY);
    expect(res.status).toBe(HANDLER_STATUS);
  });

  it('replay: returns stored response without running handler', async () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockMaybeSingle.mockResolvedValue({
      data: {
        response_body: { success: true, data: { id: 'cached' } },
        response_status: 200,
        expires_at: futureExpiry,
      },
      error: null,
    });

    const req = makeRequest('key-abc-123');
    const res = await withIdempotency(req, APP_ID, ENDPOINT, handler);
    const json = await res.json();

    expect(handler).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(json).toEqual({ success: true, data: { id: 'cached' } });
    expect(res.status).toBe(200);
  });

  it('expired key: runs handler fresh and upserts new result', async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    mockMaybeSingle.mockResolvedValue({
      data: {
        response_body: { success: true, data: { id: 'stale' } },
        response_status: 200,
        expires_at: pastExpiry,
      },
      error: null,
    });

    const req = makeRequest('key-expired');
    const res = await withIdempotency(req, APP_ID, ENDPOINT, handler);
    const json = await res.json();

    expect(handler).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(json).toEqual(HANDLER_BODY);
  });
});
