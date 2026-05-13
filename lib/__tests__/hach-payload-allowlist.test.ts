import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  HACH_PAYLOAD_BANNED_KEYS,
  assertNoBannedKeys,
  stripBannedKeys,
  safeHachJson,
} from '@/lib/hach/payload-filter';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Asserts no banned keys appear in the payload using stripBannedKeys, which correctly
 * applies the document-scoping rule for notes/reviewer/reviewed_at.
 * Serialises both the original and stripped payloads and compares them.
 * If any key was stripped, the test fails with the removed keys listed.
 */
function assertNoLeaks(payload: unknown): void {
  const cleaned = stripBannedKeys(payload);
  const originalJson = JSON.stringify(payload);
  const cleanedJson = JSON.stringify(cleaned);
  if (originalJson !== cleanedJson) {
    // Find which keys were removed by comparing all keys in both
    const removedKeys: string[] = [];
    function findRemovedKeys(orig: unknown, clean: unknown): void {
      if (Array.isArray(orig) && Array.isArray(clean)) {
        orig.forEach((item, i) => findRemovedKeys(item, clean[i]));
      } else if (orig !== null && typeof orig === 'object' && clean !== null && typeof clean === 'object') {
        const origObj = orig as Record<string, unknown>;
        const cleanObj = clean as Record<string, unknown>;
        for (const key of Object.keys(origObj)) {
          if (!(key in cleanObj)) {
            removedKeys.push(key);
          } else {
            findRemovedKeys(origObj[key], cleanObj[key]);
          }
        }
      }
    }
    findRemovedKeys(payload, cleaned);
    throw new Error(`Banned key(s) found in payload: ${removedKeys.join(', ')}`);
  }
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STANTON_INTERNAL_APP = {
  id: 'app-uuid-1',
  head_of_household_name: 'Maria Santos',
  building_address: '43 Frank St',
  unit_number: '1E',
  household_size: 3,
  bedroom_count: 2,
  created_at: '2026-04-01T00:00:00Z',
  updated_at: '2026-04-10T00:00:00Z',
  hach_review_status: 'pending_hach',
  stanton_review_status: 'approved',
  stanton_review_notes: 'INTERNAL: This is Stanton\'s deliberation. Do not share.',
  form_submission_id: 'sub-uuid-1',
  dv_status: null,
  claiming_medical_deduction: false,
  has_childcare_expense: false,
};

const STANTON_INTERNAL_DOC = {
  id: 'doc-uuid-1',
  doc_type: 'bank_statement',
  label: 'Bank Statement',
  status: 'submitted',
  file_name: 'bank.pdf',
  storage_path: 'submissions/bank.pdf',
  display_order: 1,
  person_slot: null,
  required: true,
  revision: 1,
  rejection_reason: null,
  notes: 'Stanton thinks this is suspicious',
  reviewer: 'Tess',
  reviewed_at: '2026-04-15T10:00:00Z',
};

const CLEAN_DOC = {
  id: 'doc-uuid-1',
  doc_type: 'bank_statement',
  label: 'Bank Statement',
  status: 'submitted',
  file_name: 'bank.pdf',
  storage_path: 'submissions/bank.pdf',
  display_order: 1,
  person_slot: null,
  required: true,
  revision: 1,
  rejection_reason: null,
};

const HACH_ACTION = {
  id: 'dra-uuid-1',
  document_id: 'doc-uuid-1',
  reviewer_name: 'John HACH',
  action: 'approved',
  rejection_reason: null,
  created_at: '2026-04-20T00:00:00Z',
  source: 'hach',
};

const STANTON_ACTION = {
  id: 'dra-uuid-2',
  document_id: 'doc-uuid-1',
  reviewer_name: 'Tess Stanton',
  action: 'approved',
  rejection_reason: null,
  created_at: '2026-04-19T00:00:00Z',
  source: 'stanton',
};

const MEMBER = {
  id: 'member-uuid-1',
  slot: 1,
  name: 'Maria Santos',
  relationship: 'head',
  date_of_birth: '1985-06-15',
  age: 40,
  annual_income: 28000,
  income_sources: ['employment'],
  employed: true,
  has_ssi: false,
  has_ss: false,
  has_pension: false,
  has_tanf: false,
  has_child_support: false,
  has_unemployment: false,
  has_self_employment: false,
  has_other_income: false,
  disability: false,
  citizenship_status: 'citizen',
};

// ── Unit tests: payload-filter.ts ─────────────────────────────────────────────

describe('HACH_PAYLOAD_BANNED_KEYS', () => {
  it('contains all unconditionally banned keys', () => {
    expect(HACH_PAYLOAD_BANNED_KEYS.has('stanton_review_notes')).toBe(true);
    expect(HACH_PAYLOAD_BANNED_KEYS.has('stanton_reviewer')).toBe(true);
    expect(HACH_PAYLOAD_BANNED_KEYS.has('stanton_review_date')).toBe(true);
    expect(HACH_PAYLOAD_BANNED_KEYS.has('internal_notes')).toBe(true);
  });

  it('contains document-scoped banned keys', () => {
    expect(HACH_PAYLOAD_BANNED_KEYS.has('notes')).toBe(true);
    expect(HACH_PAYLOAD_BANNED_KEYS.has('reviewer')).toBe(true);
    expect(HACH_PAYLOAD_BANNED_KEYS.has('reviewed_at')).toBe(true);
  });
});

describe('assertNoBannedKeys()', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('throws when stanton_review_notes is present at root', () => {
    expect(() =>
      assertNoBannedKeys({ stanton_review_notes: 'secret', id: 'x' })
    ).toThrow(/stanton_review_notes/);
  });

  it('throws when notes is present inside a document object (has doc_type)', () => {
    expect(() =>
      assertNoBannedKeys({ documents: [STANTON_INTERNAL_DOC] })
    ).toThrow(/notes/);
  });

  it('throws when reviewer is present inside a document object', () => {
    const docWithReviewer = { doc_type: 'id', reviewer: 'Tess' };
    expect(() => assertNoBannedKeys({ documents: [docWithReviewer] })).toThrow(/reviewer/);
  });

  it('throws when reviewed_at is present inside a document object (has doc_type)', () => {
    const docWithReviewedAt = { doc_type: 'passport', reviewed_at: '2026-01-01' };
    expect(() => assertNoBannedKeys({ documents: [docWithReviewedAt] })).toThrow(/reviewed_at/);
  });

  it('does NOT throw when reviewed_at appears on a non-document object (no doc_type)', () => {
    const actionResponse = { document_id: 'x', reviewed_at: '2026-01-01', effective_status: 'approved' };
    expect(() => assertNoBannedKeys({ data: actionResponse })).not.toThrow();
  });

  it('does NOT throw when notes appears on a non-document object', () => {
    const payload = { application: { id: 'x' }, notes: 'safe top-level note' };
    // notes at root level (no doc_type/document_id on parent) — should NOT throw
    // because the parent object does not have doc_type or document_id
    expect(() => assertNoBannedKeys(payload)).not.toThrow();
  });

  it('passes for a clean document payload', () => {
    expect(() =>
      assertNoBannedKeys({
        application: { id: 'x', stanton_review_status: 'approved' },
        documents: [CLEAN_DOC],
        members: [MEMBER],
        review_action_log: [HACH_ACTION],
      })
    ).not.toThrow();
  });

  it('reports the correct path in the error message', () => {
    expect(() =>
      assertNoBannedKeys({ data: { documents: [STANTON_INTERNAL_DOC] } })
    ).toThrow(/root\.data\.documents\[0\]\.notes/);
  });

  it('is a no-op in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() =>
      assertNoBannedKeys({ stanton_review_notes: 'secret' })
    ).not.toThrow();
    vi.unstubAllEnvs();
  });
});

describe('stripBannedKeys()', () => {
  it('removes stanton_review_notes from application', () => {
    const cleaned = stripBannedKeys(STANTON_INTERNAL_APP);
    expect(cleaned).not.toHaveProperty('stanton_review_notes');
  });

  it('preserves stanton_review_status (allowed field)', () => {
    const cleaned = stripBannedKeys(STANTON_INTERNAL_APP);
    expect(cleaned).toHaveProperty('stanton_review_status', 'approved');
  });

  it('removes notes/reviewer/reviewed_at from document objects', () => {
    const payload = { documents: [STANTON_INTERNAL_DOC] };
    const cleaned = stripBannedKeys(payload);
    const doc = (cleaned as any).documents[0];
    expect(doc).not.toHaveProperty('notes');
    expect(doc).not.toHaveProperty('reviewer');
    expect(doc).not.toHaveProperty('reviewed_at');
  });

  it('preserves clean document fields', () => {
    const payload = { documents: [STANTON_INTERNAL_DOC] };
    const cleaned = stripBannedKeys(payload);
    const doc = (cleaned as any).documents[0];
    expect(doc).toHaveProperty('id', 'doc-uuid-1');
    expect(doc).toHaveProperty('label', 'Bank Statement');
    expect(doc).toHaveProperty('status', 'submitted');
    expect(doc).toHaveProperty('rejection_reason', null);
  });

  it('does not mutate the original object', () => {
    const original = { ...STANTON_INTERNAL_APP };
    stripBannedKeys(original);
    expect(original).toHaveProperty('stanton_review_notes');
  });

  it('handles nested arrays recursively', () => {
    const payload = {
      data: {
        documents: [STANTON_INTERNAL_DOC, CLEAN_DOC],
      },
    };
    const cleaned = stripBannedKeys(payload) as any;
    expect(cleaned.data.documents[0]).not.toHaveProperty('notes');
    expect(cleaned.data.documents[0]).not.toHaveProperty('reviewer');
    expect(cleaned.data.documents[1]).toHaveProperty('label', 'Bank Statement');
  });

  it('handles null and primitive values without throwing', () => {
    expect(stripBannedKeys(null)).toBe(null);
    expect(stripBannedKeys(42)).toBe(42);
    expect(stripBannedKeys('hello')).toBe('hello');
  });
});

describe('safeHachJson()', () => {
  it('in development: throws on banned keys (assertNoBannedKeys)', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(() =>
      safeHachJson({ stanton_review_notes: 'secret' })
    ).toThrow(/stanton_review_notes/);
    vi.unstubAllEnvs();
  });

  it('in production: strips banned keys silently', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const result = safeHachJson({ id: 'x', stanton_review_notes: 'secret', stanton_review_status: 'approved' });
    expect(result).not.toHaveProperty('stanton_review_notes');
    expect(result).toHaveProperty('stanton_review_status', 'approved');
    vi.unstubAllEnvs();
  });
});

// ── Integration-style: simulated /api/hach/applications/[id] response ─────────

describe('/api/hach/applications/[id] response shape', () => {
  const simulatedApiResponse = {
    application: {
      id: 'app-uuid-1',
      head_of_household_name: 'Maria Santos',
      building_address: '43 Frank St',
      unit_number: '1E',
      household_size: 3,
      bedroom_count: 2,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-10T00:00:00Z',
      hach_review_status: 'pending_hach',
      stanton_review_status: 'approved',
      form_submission_id: 'sub-uuid-1',
      dv_status: null,
      claiming_medical_deduction: false,
      has_childcare_expense: false,
    },
    members: [MEMBER],
    documents: [
      {
        ...CLEAN_DOC,
        latest_action: HACH_ACTION,
        file_name: 'bank.pdf',
      },
    ],
    review_action_log: [HACH_ACTION],
    last_viewed_at: null,
    new_since_last_view: 0,
  };

  it('has no banned keys in the simulated response', () => {
    assertNoLeaks(simulatedApiResponse);
  });

  it('preserves required UI fields: application keys', () => {
    const { application } = simulatedApiResponse;
    expect(application).toHaveProperty('head_of_household_name');
    expect(application).toHaveProperty('building_address');
    expect(application).toHaveProperty('unit_number');
    expect(application).toHaveProperty('household_size');
    expect(application).toHaveProperty('hach_review_status');
    expect(application).toHaveProperty('stanton_review_status');
  });

  it('preserves required UI fields: documents', () => {
    expect(simulatedApiResponse.documents).toHaveLength(1);
    const doc = simulatedApiResponse.documents[0];
    expect(doc).toHaveProperty('id');
    expect(doc).toHaveProperty('label');
    expect(doc).toHaveProperty('status');
    expect(doc).toHaveProperty('doc_type');
    expect(doc).toHaveProperty('file_name');
    expect(doc).toHaveProperty('storage_path');
    expect(doc).toHaveProperty('latest_action');
  });

  it('preserves required UI fields: members', () => {
    const m = simulatedApiResponse.members[0];
    expect(m).toHaveProperty('name');
    expect(m).toHaveProperty('relationship');
    expect(m).toHaveProperty('date_of_birth');
    expect(m).toHaveProperty('annual_income');
    expect(m).toHaveProperty('income_sources');
  });

  it('strips stanton_review_notes if present (production simulation)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const leakyResponse = {
      ...simulatedApiResponse,
      application: { ...simulatedApiResponse.application, stanton_review_notes: 'SECRET' },
    };
    const cleaned = safeHachJson(leakyResponse);
    assertNoLeaks(cleaned);
    expect((cleaned as any).application).not.toHaveProperty('stanton_review_notes');
    vi.unstubAllEnvs();
  });

  it('strips internal doc fields if present (production simulation)', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const leakyResponse = {
      ...simulatedApiResponse,
      documents: [{ ...STANTON_INTERNAL_DOC, latest_action: HACH_ACTION }],
    };
    const cleaned = safeHachJson(leakyResponse) as any;
    assertNoLeaks(cleaned);
    expect(cleaned.documents[0]).not.toHaveProperty('notes');
    expect(cleaned.documents[0]).not.toHaveProperty('reviewer');
    expect(cleaned.documents[0]).not.toHaveProperty('reviewed_at');
    vi.unstubAllEnvs();
  });

  it('review_action_log only contains hach-sourced actions (source filter simulated)', () => {
    const filteredLog = [HACH_ACTION].filter((a) => a.source === 'hach');
    expect(filteredLog).toHaveLength(1);
    expect(filteredLog.every((a) => a.source === 'hach')).toBe(true);

    const withStanton = [HACH_ACTION, STANTON_ACTION].filter((a) => a.source === 'hach');
    expect(withStanton).toHaveLength(1);
    expect(withStanton[0].id).toBe('dra-uuid-1');
  });
});

// ── Integration-style: queue list (/api/hach/applications) ───────────────────

describe('/api/hach/applications queue response', () => {
  const queueItem = {
    id: 'app-uuid-1',
    head_of_household_name: 'Maria Santos',
    building_address: '43 Frank St',
    unit_number: '1E',
    household_size: 3,
    created_at: '2026-04-01T00:00:00Z',
    hach_review_status: 'pending_hach',
    doc_summary: { total: 5, approved: 2, rejected: 0, missing: 1, submitted: 2 },
    has_review_actions: false,
    last_viewed_at: null,
    documents_uploaded_since_last_view: 0,
  };

  it('has no banned keys in queue list response', () => {
    const payload = {
      needs_first_review: [queueItem],
      awaiting_response: [],
      approved: [],
    };
    assertNoLeaks(payload);
  });

  it('does not include stanton_review_notes or stanton_review_status in queue items', () => {
    expect(queueItem).not.toHaveProperty('stanton_review_notes');
    expect(queueItem).not.toHaveProperty('stanton_review_status');
  });
});

// ── Integration-style: approve/reject response shapes ────────────────────────

describe('/api/hach/documents/[id]/approve response', () => {
  const approveResponse = {
    document_id: 'doc-uuid-1',
    effective_status: 'approved',
    reviewer_name: 'John HACH',
    reviewed_at: '2026-04-20T00:00:00Z',
    progress: { approved: 1, pending: 4, rejected: 0, waived: 0, missing: 0, total: 5 },
  };

  it('has no banned keys', () => {
    assertNoLeaks(approveResponse);
  });

  it('preserves document_id, effective_status, reviewer_name, reviewed_at, progress', () => {
    expect(approveResponse).toHaveProperty('document_id');
    expect(approveResponse).toHaveProperty('effective_status', 'approved');
    expect(approveResponse).toHaveProperty('reviewer_name');
    expect(approveResponse).toHaveProperty('reviewed_at');
    expect(approveResponse).toHaveProperty('progress');
  });
});

describe('/api/hach/documents/[id]/reject response', () => {
  const rejectResponse = {
    document_id: 'doc-uuid-1',
    effective_status: 'rejected',
    reviewer_name: 'John HACH',
    reviewed_at: '2026-04-20T00:00:00Z',
    reason_code: 'document_illegible',
    reason_label: 'Document is illegible',
    reason_text: null,
    notification: {
      status: 'sent',
      notification_id: 'notif-1',
      twilio_sid: 'SM123',
      reason: null,
      error: null,
    },
    progress: { approved: 0, pending: 3, rejected: 1, waived: 0, missing: 1, total: 5 },
  };

  it('has no banned keys', () => {
    assertNoLeaks(rejectResponse);
  });

  it('preserves document_id, effective_status, reason_code, notification, progress', () => {
    expect(rejectResponse).toHaveProperty('document_id');
    expect(rejectResponse).toHaveProperty('effective_status', 'rejected');
    expect(rejectResponse).toHaveProperty('reason_code');
    expect(rejectResponse).toHaveProperty('notification');
    expect(rejectResponse).toHaveProperty('progress');
  });
});

// ── Audit log response ────────────────────────────────────────────────────────

describe('/api/hach/admin/audit-log response', () => {
  const auditEntry = {
    id: 'audit-1',
    user_id: 'hach-user-1',
    username: 'jsmith@hach.gov',
    action: 'hach.document.approve',
    entity_type: 'form_submission_documents',
    entity_id: 'doc-uuid-1',
    details: { application_id: 'app-uuid-1' },
    ip_address: '10.0.0.1',
    created_at: '2026-04-20T00:00:00Z',
    user_type: 'hach_reviewer',
    user_agent: 'Mozilla/5.0',
  };

  it('has no banned keys in audit log entries', () => {
    const payload = {
      entries: [auditEntry],
      total: 1,
      page: 0,
      has_more: false,
      actions: ['hach.document.approve'],
      hach_users: [{ id: 'hach-user-1', name: 'John Smith' }],
    };
    assertNoLeaks(payload);
  });

  it('audit entries are authored by HACH users only (user_type check)', () => {
    expect(['hach_admin', 'hach_reviewer']).toContain(auditEntry.user_type);
  });
});
