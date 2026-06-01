import { describe, it, expect, vi } from 'vitest';

// preSendReview.ts and auth.ts initialize the Supabase client / session secret at
// import time; stub those so the pure helpers under test load without env vars.
vi.mock('@/lib/supabase', () => ({ supabase: {}, supabaseAdmin: { from: vi.fn() } }));
vi.mock('@/lib/server-env', () => ({ getSessionSecret: () => 'x'.repeat(32) }));

import {
  computePackageRevision,
  approvalReleasesPackage,
  type ReviewApproval,
} from '@/lib/pbv/preSendReview';
import { canApprovePreSendReview } from '@/lib/auth';
import type { SessionUser } from '@/lib/auth';

function approval(over: Partial<ReviewApproval>): ReviewApproval {
  return {
    id: 'a1',
    application_id: 'app1',
    package_revision: 'rev',
    status: 'approved',
    approved_by: 'u1',
    approved_by_name: 'Tess',
    approved_at: '2026-05-31T12:00:00Z',
    note: null,
    ...over,
  };
}

describe('computePackageRevision', () => {
  const docs = [
    { form_id: 'main_application', unsigned_pdf_hash: 'aaa' },
    { form_id: 'hud_9886a', unsigned_pdf_hash: 'bbb' },
  ];

  it('is deterministic and order-independent', () => {
    const r1 = computePackageRevision(docs);
    const r2 = computePackageRevision([...docs].reverse());
    expect(r1).toBe(r2);
    expect(r1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when any unsigned_pdf_hash changes (regeneration)', () => {
    const before = computePackageRevision(docs);
    const after = computePackageRevision([
      { form_id: 'main_application', unsigned_pdf_hash: 'aaa' },
      { form_id: 'hud_9886a', unsigned_pdf_hash: 'CHANGED' },
    ]);
    expect(after).not.toBe(before);
  });

  it('returns empty string for a package with no generated docs', () => {
    expect(computePackageRevision([])).toBe('');
    expect(computePackageRevision([{ form_id: 'x', unsigned_pdf_hash: null }])).toBe('');
  });
});

describe('approvalReleasesPackage', () => {
  it('releases when an approved decision matches the current revision', () => {
    expect(approvalReleasesPackage(approval({ package_revision: 'rev1' }), 'rev1')).toBe(true);
  });

  it('does NOT release when the revision differs (post-regeneration)', () => {
    expect(approvalReleasesPackage(approval({ package_revision: 'old' }), 'new')).toBe(false);
  });

  it('does NOT release a held decision', () => {
    expect(approvalReleasesPackage(approval({ status: 'held', package_revision: 'rev1' }), 'rev1')).toBe(false);
  });

  it('does NOT release when there is no approval', () => {
    expect(approvalReleasesPackage(null, 'rev1')).toBe(false);
  });

  it('does NOT release an empty (ungenerated) package even if a row exists', () => {
    expect(approvalReleasesPackage(approval({ package_revision: '' }), '')).toBe(false);
  });
});

describe('canApprovePreSendReview', () => {
  function user(over: Partial<SessionUser>): SessionUser {
    return {
      userId: 'u1',
      username: 'tess',
      displayName: 'Tess',
      departmentId: null,
      departmentCode: null,
      permissions: [],
      isSuperAdmin: false,
      user_type: 'stanton_staff',
      ...over,
    };
  }

  it('allows Stanton staff', () => {
    expect(canApprovePreSendReview(user({ user_type: 'stanton_staff' }))).toBe(true);
  });

  it('allows super admins regardless of type', () => {
    expect(canApprovePreSendReview(user({ isSuperAdmin: true, user_type: 'hach_admin' }))).toBe(true);
  });

  it('denies HACH users', () => {
    expect(canApprovePreSendReview(user({ user_type: 'hach_admin' }))).toBe(false);
    expect(canApprovePreSendReview(user({ user_type: 'hach_reviewer' }))).toBe(false);
  });
});
