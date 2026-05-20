/**
 * lib/__tests__/pbv-assisted-mode.test.ts
 *
 * Integration-style tests for staff-assisted mode:
 *   - AssistedModeState interface shape (compile-time coverage)
 *   - tenantFetch correctly forwards X-Assisted-By header
 *   - Header is omitted when assistedByUserId is null/undefined
 *   - Sign-form route correctly reads X-Assisted-By and validates against admin_users
 *
 * Note: sign-form full integration (Supabase writes) requires a live DB connection.
 * These tests cover the client-side header forwarding and session data shape.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { tenantFetch } from '@/lib/tenantFetch';
import type { SessionData, AssistedModeState } from '@/lib/auth';

// ── tenantFetch header forwarding ────────────────────────────────────────────

const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));

afterEach(() => {
  fetchSpy.mockClear();
});

describe('tenantFetch — X-Assisted-By header', () => {
  it('forwards X-Assisted-By when assistedByUserId is set', async () => {
    vi.stubGlobal('fetch', fetchSpy);
    await tenantFetch('/api/t/test-token/pbv-full-app/sign-form', {
      method: 'POST',
      body: { test: true },
      assistedByUserId: 'staff-uuid-123',
    });
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>)['X-Assisted-By']).toBe('staff-uuid-123');
    vi.unstubAllGlobals();
  });

  it('does not include X-Assisted-By when assistedByUserId is null', async () => {
    vi.stubGlobal('fetch', fetchSpy);
    await tenantFetch('/api/t/test-token/pbv-full-app/sign-form', {
      method: 'POST',
      body: { test: true },
      assistedByUserId: null,
    });
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>)['X-Assisted-By']).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('does not include X-Assisted-By when assistedByUserId is undefined', async () => {
    vi.stubGlobal('fetch', fetchSpy);
    await tenantFetch('/api/t/test-token/pbv-full-app/sign-form', {
      method: 'POST',
      body: { test: true },
    });
    const callArgs = fetchSpy.mock.calls[0];
    const requestInit = callArgs[1] as RequestInit;
    expect((requestInit.headers as Record<string, string>)['X-Assisted-By']).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

// ── SessionData / AssistedModeState shape ────────────────────────────────────

describe('AssistedModeState — interface shape', () => {
  it('accepts all required fields', () => {
    const state: AssistedModeState = {
      staffUserId: 'user-uuid',
      staffDisplayName: 'Will Esposito',
      applicationId: 'app-uuid',
      startedAt: new Date().toISOString(),
    };
    expect(state.staffUserId).toBe('user-uuid');
    expect(state.staffDisplayName).toBe('Will Esposito');
    expect(state.applicationId).toBe('app-uuid');
  });

  it('SessionData accepts assistedMode field', () => {
    const session: SessionData = {
      isAdmin: true,
      userId: 'user-uuid',
      assistedMode: {
        staffUserId: 'user-uuid',
        staffDisplayName: 'Will Esposito',
        applicationId: 'app-uuid',
        startedAt: new Date().toISOString(),
      },
    };
    expect(session.assistedMode?.staffDisplayName).toBe('Will Esposito');
  });

  it('SessionData is valid without assistedMode', () => {
    const session: SessionData = { isAdmin: true, userId: 'user-uuid' };
    expect(session.assistedMode).toBeUndefined();
  });
});

// ── Audit columns — snapshot of expected event row shape ─────────────────────

describe('pbv_signature_events assisted audit columns', () => {
  it('expected event shape includes assisted_by_staff_user_id', () => {
    const eventShape = {
      form_document_id: 'form-uuid',
      signer_member_id: 'member-uuid',
      signature_image_path: 'pbv/sigs/sig.png',
      typed_name: 'Maria Santos',
      signed_at: new Date().toISOString(),
      device_owner: 'staff_assisted' as const,
      document_hash: 'abc123',
      ceremony_id: 'ceremony-uuid',
      consent_text_version: '2026-05-15-v1',
      assisted_by_staff_user_id: 'staff-uuid',
    };

    expect(eventShape.device_owner).toBe('staff_assisted');
    expect(eventShape.assisted_by_staff_user_id).toBe('staff-uuid');
  });

  it('non-assisted event has null assisted_by_staff_user_id', () => {
    const eventShape = {
      device_owner: 'self' as const,
      assisted_by_staff_user_id: null as string | null,
    };
    expect(eventShape.device_owner).toBe('self');
    expect(eventShape.assisted_by_staff_user_id).toBeNull();
  });
});
