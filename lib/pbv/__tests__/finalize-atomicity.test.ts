/**
 * PRD-64 (audit #10): /finalize calls finalize_pbv_application via RPC, which
 * sets submitted_at AND inserts the application.submitted event in one
 * transaction. RPC failure -> 500 and the application stays unsubmitted.
 *
 * We test the route handler with a mocked supabaseAdmin:
 *  - validateReadyToFinalize is mocked to return `ready: true` directly.
 *  - supabaseAdmin.rpc('finalize_pbv_application', ...) is the single point
 *    of mutation; we toggle it between success and failure to assert Gate 4.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ───────────────────────────────────────────────────────────────────

const rpcCalls: Array<{ fn: string; args: any }> = [];
let rpcResponse: { data: any; error: any } = { data: null, error: null };
let appRow: { id: string; submitted_at: string | null } | null = {
  id: 'app-1',
  submitted_at: null,
};

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (_table: string) => {
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        not: () => builder,
        maybeSingle: () => Promise.resolve({ data: appRow, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
        then: (fn: any) => Promise.resolve({ data: [], error: null }).then(fn),
      };
      return builder;
    },
    rpc: (fn: string, args: any) => {
      rpcCalls.push({ fn, args });
      return Promise.resolve(rpcResponse);
    },
  },
}));

vi.mock('@/lib/pbv/finalizeValidation', () => ({
  validateReadyToFinalize: vi.fn(async () => ({
    ready: true,
    missing: { documents: [], signatures: [] },
  })),
}));

import { POST } from '../../../app/api/t/[token]/pbv-full-app/finalize/route';

// ── Tests ───────────────────────────────────────────────────────────────────

function makeRequest(): NextRequest {
  // withIdempotency only acts when an Idempotency-Key header is present, so
  // omitting it routes straight through to the handler.
  return new NextRequest('http://test.local/api/t/tok/pbv-full-app/finalize', {
    method: 'POST',
  });
}

describe('POST /finalize — PRD-64 atomic finalize via RPC', () => {
  beforeEach(() => {
    rpcCalls.length = 0;
    rpcResponse = { data: null, error: null };
    appRow = { id: 'app-1', submitted_at: null };
  });

  it('Gate 4a: on RPC success, returns 200 with submitted_at; invokes finalize_pbv_application once', async () => {
    const res = await POST(makeRequest(), {
      params: Promise.resolve({ token: 'tok' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true });
    expect(body.data.submitted_at).toBeTruthy();
    expect(body.data.already_submitted).toBe(false);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe('finalize_pbv_application');
    expect(rpcCalls[0].args).toMatchObject({
      p_app_id: 'app-1',
      p_actor_display_name: 'Tenant',
    });
    expect(rpcCalls[0].args.p_submitted_at).toBeTruthy();
  });

  it('Gate 4b: on RPC error, returns 500 with finalize_atomic_failed; submitted_at not set (RPC rollback)', async () => {
    rpcResponse = { data: null, error: { message: 'simulated event insert failure' } as any };

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ token: 'tok' }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({
      success: false,
      code: 'finalize_atomic_failed',
    });
    // The RPC is the single mutation site — on error the route does NOT make
    // any additional update calls to set submitted_at. The DB-level rollback
    // is the actual atomicity guarantee; we assert here that the route
    // surfaces the failure rather than swallowing it.
    expect(rpcCalls).toHaveLength(1);
  });

  it('replay-safe: if the app is already submitted, withTenantContext short-circuits with 409 before any RPC call', async () => {
    appRow = { id: 'app-1', submitted_at: '2026-05-21T00:00:00Z' };

    const res = await POST(makeRequest(), {
      params: Promise.resolve({ token: 'tok' }),
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toMatchObject({ code: 'submitted_locked' });
    expect(rpcCalls).toHaveLength(0);
  });
});
