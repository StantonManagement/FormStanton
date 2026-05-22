// @vitest-environment jsdom
/**
 * PRP-022 / J6 — useIntakeBootstrap offline / retry / error-branch tests.
 *
 * Covers:
 *   - success → ready, with `data` shape mirroring the bootstrap response
 *   - 404 → error with the "link invalid or expired" copy
 *   - 500 → error with the generic technical-issue copy
 *   - network error (TypeError) → error
 *   - reload re-triggers the fetch + status flips loading → ready
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('@/lib/tenantFetch', () => ({
  tenantFetch: vi.fn(),
}));

import { tenantFetch } from '@/lib/tenantFetch';
import { useIntakeBootstrap } from '@/lib/pbv/hooks/useIntakeBootstrap';

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useIntakeBootstrap', () => {
  it('200 → ready, derives defaults for missing fields', async () => {
    (tenantFetch as any).mockResolvedValue(
      jsonRes(200, {
        data: {
          intake_status: 'in_progress',
          preferred_language: 'es',
          building_address: '95 Main St',
          unit_number: '5A',
        },
      })
    );
    const { result } = renderHook(() => useIntakeBootstrap('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    if (result.current.state.status !== 'ready') throw new Error('expected ready');
    expect(result.current.state.data.intake_status).toBe('in_progress');
    expect(result.current.state.data.preferred_language).toBe('es');
    expect(result.current.state.data.building_address).toBe('95 Main St');
    expect(result.current.state.data.signing_status).toBe('not_started');
  });

  it('404 → error with link-expired copy', async () => {
    (tenantFetch as any).mockResolvedValue(new Response('', { status: 404 }));
    const { result } = renderHook(() => useIntakeBootstrap('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status !== 'error') throw new Error('expected error');
    expect(result.current.state.message).toMatch(/invalid or has expired/i);
  });

  it('500 → error with technical-issue copy', async () => {
    (tenantFetch as any).mockResolvedValue(new Response('', { status: 500 }));
    const { result } = renderHook(() => useIntakeBootstrap('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    if (result.current.state.status !== 'error') throw new Error('expected error');
    expect(result.current.state.message).toMatch(/technical issue|try again/i);
  });

  it('network TypeError → error', async () => {
    (tenantFetch as any).mockRejectedValue(new TypeError('net down'));
    const { result } = renderHook(() => useIntakeBootstrap('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
  });

  it('reload() re-triggers the fetch and re-enters the ready state', async () => {
    (tenantFetch as any)
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(jsonRes(200, { data: { intake_status: 'complete' } }));
    const { result } = renderHook(() => useIntakeBootstrap('tok'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    await act(async () => {
      await result.current.reload();
    });
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
  });
});
