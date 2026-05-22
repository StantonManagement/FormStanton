// @vitest-environment jsdom
/**
 * PRP-011 / C3 — useDashboardState renders partial data when a slice
 * (forms / upload-summary / additional-signers) fails.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/tenantFetch', () => ({
  tenantFetch: vi.fn(),
}));

vi.mock('@/lib/pbv/safeErrorMessage', () => ({
  safeTenantErrorMessage: (err: any, fallback: string) =>
    err?.message ?? fallback,
}));

import { tenantFetch } from '@/lib/tenantFetch';
import { useDashboardState } from '@/lib/pbv/hooks/useDashboardState';

const bootstrapPayload = {
  data: {
    preferred_language: 'en',
    submission_language: 'en',
    signing_status: 'not_started',
    head_of_household_name: 'Jane',
    hoh_member_id: 'm-1',
    intake_status: 'complete',
    submitted_at: null,
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useDashboardState — partial-failure tolerance (C3)', () => {
  it('all four slices succeed → status ready, slices all ok', async () => {
    (tenantFetch as any)
      .mockResolvedValueOnce(jsonResponse(bootstrapPayload))
      .mockResolvedValueOnce(jsonResponse({ data: { forms: [{ id: 'f1', form_id: 'a', display_name: 'A', status: 'generated', signatures_complete: false }] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { total: 3, complete: 1, optional_complete: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { pending_count: 0 } }));
    const { result } = renderHook(() => useDashboardState('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') throw new Error('expected ready');
    expect(result.current.state.slices).toEqual({ forms: 'ok', upload: 'ok', signers: 'ok' });
    expect(result.current.state.data.forms_total).toBe(1);
    expect(result.current.state.data.upload_total).toBe(3);
  });

  it('forms slice rejected → still ready; slices.forms = "failed"; empty forms list', async () => {
    (tenantFetch as any)
      .mockResolvedValueOnce(jsonResponse(bootstrapPayload))
      .mockRejectedValueOnce(new TypeError('forms network down'))
      .mockResolvedValueOnce(jsonResponse({ data: { total: 3, complete: 1, optional_complete: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { pending_count: 0 } }));
    const { result } = renderHook(() => useDashboardState('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') throw new Error('expected ready');
    expect(result.current.state.slices.forms).toBe('failed');
    expect(result.current.state.data.forms_total).toBe(0);
    // Other slices still ok
    expect(result.current.state.slices.upload).toBe('ok');
    expect(result.current.state.slices.signers).toBe('ok');
  });

  it('upload-summary 500 → slices.upload = "failed", falls back to bootstrap document_summary', async () => {
    const bootstrapWithDocSummary = {
      data: {
        ...bootstrapPayload.data,
        document_summary: { total: 5, complete: 2 },
      },
    };
    (tenantFetch as any)
      .mockResolvedValueOnce(jsonResponse(bootstrapWithDocSummary))
      .mockResolvedValueOnce(jsonResponse({ data: { forms: [] } }))
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse({ data: { pending_count: 0 } }));
    const { result } = renderHook(() => useDashboardState('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') throw new Error('expected ready');
    expect(result.current.state.slices.upload).toBe('failed');
    expect(result.current.state.data.upload_total).toBe(5);
    expect(result.current.state.data.upload_complete).toBe(2);
  });

  it('bootstrap rejected → status error (bootstrap is load-bearing)', async () => {
    (tenantFetch as any)
      .mockRejectedValueOnce(new TypeError('bootstrap down'))
      .mockResolvedValueOnce(jsonResponse({ data: { forms: [] } }))
      .mockResolvedValueOnce(jsonResponse({ data: { total: 0, complete: 0 } }))
      .mockResolvedValueOnce(jsonResponse({ data: { pending_count: 0 } }));
    const { result } = renderHook(() => useDashboardState('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });
});
