// @vitest-environment jsdom
/**
 * PRP-012 / C6 + E2 — useSigningCeremony sessionStorage recovery + composed
 * idempotency-key passthrough.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/tenantFetch', () => ({
  tenantFetch: vi.fn(),
}));

import { tenantFetch } from '@/lib/tenantFetch';
import { useSigningCeremony } from '@/lib/pbv/hooks/useSigningCeremony';

const TOKEN = 'tok';
const HOH = 'm-hoh';

let uuidCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  uuidCounter = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `uuid-${++uuidCounter}` });
});

function jsonOk(body: any) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe('useSigningCeremony — sessionStorage rehydration (C6)', () => {
  it('writes ceremonyId to sessionStorage on first mount', () => {
    renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    const raw = window.sessionStorage.getItem(`pbv_ceremony_${TOKEN}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.ceremonyId).toBe('uuid-1');
    expect(parsed.signatureImagePath).toBeNull();
  });

  it('rehydrates the same ceremonyId on a remount (refresh simulation)', () => {
    const { unmount } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    unmount();
    const { result } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    expect(result.current.ceremonyId).toBe('uuid-1');
  });

  it('rehydrates a previously captured signatureImagePath into hasSignature', () => {
    window.sessionStorage.setItem(
      `pbv_ceremony_${TOKEN}`,
      JSON.stringify({ ceremonyId: 'uuid-prior', signatureImagePath: 'sigs/abc.png' })
    );
    const { result } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    expect(result.current.ceremonyId).toBe('uuid-prior');
    // Effect runs sync in jsdom; hasSignature should flip true after mount.
    expect(result.current.hasSignature).toBe(true);
  });
});

describe('useSigningCeremony — composed idempotencyKey passthrough (E2)', () => {
  it('captureAndSign sends ${ceremonyId}-capture and ${ceremonyId}-${formId} keys', async () => {
    (tenantFetch as any)
      .mockResolvedValueOnce(jsonOk({ data: { signature_image_path: 'sigs/x.png' } }))
      .mockResolvedValueOnce(jsonOk({ success: true }));
    const { result } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    const ceremonyId = result.current.ceremonyId;
    await act(async () => {
      const ok = await result.current.captureAndSign('form-A', 'data:image/png;base64,xxx', 'Jane Doe');
      expect(ok).toBe(true);
    });
    expect((tenantFetch as any).mock.calls.length).toBe(2);
    const captureCallOpts = (tenantFetch as any).mock.calls[0][1];
    const signCallOpts = (tenantFetch as any).mock.calls[1][1];
    expect(captureCallOpts.idempotencyKey).toBe(`${ceremonyId}-capture`);
    expect(signCallOpts.idempotencyKey).toBe(`${ceremonyId}-form-A`);
  });

  it('signWithExisting also passes ${ceremonyId}-${formId}', async () => {
    window.sessionStorage.setItem(
      `pbv_ceremony_${TOKEN}`,
      JSON.stringify({ ceremonyId: 'uuid-prior', signatureImagePath: 'sigs/abc.png' })
    );
    (tenantFetch as any).mockResolvedValueOnce(jsonOk({ success: true }));
    const { result } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    await act(async () => {
      await result.current.signWithExisting('form-B', 'Jane Doe');
    });
    const opts = (tenantFetch as any).mock.calls[0][1];
    expect(opts.idempotencyKey).toBe(`uuid-prior-form-B`);
  });
});

describe('useSigningCeremony — completeCeremony resets state (C6)', () => {
  it('clears sessionStorage and starts a fresh ceremony', () => {
    const { result } = renderHook(() => useSigningCeremony(TOKEN, HOH, 'en'));
    const first = result.current.ceremonyId;
    act(() => result.current.completeCeremony());
    // A new ceremony id is generated; sessionStorage now holds it.
    const raw = window.sessionStorage.getItem(`pbv_ceremony_${TOKEN}`);
    const parsed = JSON.parse(raw!);
    expect(parsed.ceremonyId).not.toBe(first);
    expect(parsed.signatureImagePath).toBeNull();
  });
});
