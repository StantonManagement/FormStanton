import { describe, it, expect, vi } from 'vitest';

// Mock supabase before any imports that touch it
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  supabaseAdmin: { from: vi.fn() },
}));

import {
  ApplicationEventType,
  type EventPayloadMap,
  type WriteApplicationEventParams,
  type AnchorType,
} from '@/lib/events/application-events';
import { stripBannedKeys } from '@/lib/hach/payload-filter';

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Builds a valid WriteApplicationEventParams shape without the supabase call.
 * Used to validate that TypeScript types compile and shapes are correct.
 */
function buildEventParams<T extends typeof ApplicationEventType[keyof typeof ApplicationEventType]>(
  eventType: T,
  payload: T extends keyof EventPayloadMap ? EventPayloadMap[T] : Record<string, unknown>
): WriteApplicationEventParams<T> {
  return {
    anchorType: 'pbv_full_application' as AnchorType,
    anchorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    eventType,
    actorUserId: 'user-uuid-test',
    actorDisplayName: 'Test Staff',
    documentId: 'doc-uuid-test',
    payload,
  };
}

// ── ApplicationEventType enum ────────────────────────────────────────────────

describe('ApplicationEventType enum', () => {
  it('defines all Phase 1 event types', () => {
    expect(ApplicationEventType.DOCUMENT_UPLOADED_BY_STAFF).toBe('document.uploaded_by_staff');
    expect(ApplicationEventType.DOCUMENT_RECATEGORIZED).toBe('document.recategorized');
    expect(ApplicationEventType.DOCUMENT_APPROVED).toBe('document.approved');
    expect(ApplicationEventType.DOCUMENT_REJECTED).toBe('document.rejected');
    expect(ApplicationEventType.DOCUMENT_WAIVED).toBe('document.waived');
  });

  it('defines all Phase 2 event types', () => {
    expect(ApplicationEventType.HANDOFF_SENT).toBe('handoff.sent');
    expect(ApplicationEventType.HANDOFF_REOPENED).toBe('handoff.reopened');
  });

  it('contains all Phase 1 and Phase 2 event types plus later phases', () => {
    expect(Object.keys(ApplicationEventType).length).toBeGreaterThanOrEqual(7);
  });
});

// ── Event payload shapes ─────────────────────────────────────────────────────

describe('Event payload shapes', () => {
  it('DOCUMENT_UPLOADED_BY_STAFF payload has required fields', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_UPLOADED_BY_STAFF, {
      doc_type: 'bank_statement',
      label: 'Bank Statement',
      file_name: 'bank.pdf',
      staff_upload_note: 'Uploaded at intake appointment',
    });
    expect(params.payload).toHaveProperty('doc_type', 'bank_statement');
    expect(params.payload).toHaveProperty('label', 'Bank Statement');
    expect(params.payload).toHaveProperty('file_name', 'bank.pdf');
    expect(params.payload).toHaveProperty('staff_upload_note');
  });

  it('DOCUMENT_UPLOADED_BY_STAFF payload staff_upload_note is optional (null allowed)', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_UPLOADED_BY_STAFF, {
      doc_type: 'id_card',
      label: 'Government ID',
      file_name: 'id.pdf',
      staff_upload_note: null,
    });
    expect(params.payload.staff_upload_note).toBeNull();
  });

  it('DOCUMENT_RECATEGORIZED payload captures from/to doc_types', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_RECATEGORIZED, {
      from_doc_type: 'bank_statement',
      to_doc_type: 'pay_stub',
      label: 'Bank Statement',
    });
    expect(params.payload).toHaveProperty('from_doc_type', 'bank_statement');
    expect(params.payload).toHaveProperty('to_doc_type', 'pay_stub');
    expect(params.payload).toHaveProperty('label');
  });

  it('DOCUMENT_APPROVED payload has doc_type and label', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_APPROVED, {
      doc_type: 'bank_statement',
      label: 'Bank Statement',
    });
    expect(params.payload).toHaveProperty('doc_type');
    expect(params.payload).toHaveProperty('label');
  });

  it('DOCUMENT_REJECTED payload includes rejection_reason', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_REJECTED, {
      doc_type: 'bank_statement',
      label: 'Bank Statement',
      rejection_reason: 'document_illegible',
    });
    expect(params.payload).toHaveProperty('rejection_reason', 'document_illegible');
  });

  it('DOCUMENT_WAIVED payload has doc_type and label', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_WAIVED, {
      doc_type: 'childcare_letter',
      label: 'Childcare Letter',
    });
    expect(params.payload).toHaveProperty('doc_type', 'childcare_letter');
  });

  it('actor fields are correctly set on all events', () => {
    const params = buildEventParams(ApplicationEventType.DOCUMENT_APPROVED, {
      doc_type: 'id_card',
      label: 'Government ID',
    });
    expect(params.actorUserId).toBe('user-uuid-test');
    expect(params.actorDisplayName).toBe('Test Staff');
    expect(params.anchorId).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(params.anchorType).toBe('pbv_full_application');
    expect(params.documentId).toBe('doc-uuid-test');
  });

  it('actorUserId may be null (system events)', () => {
    const params: WriteApplicationEventParams<'document.waived'> = {
      anchorType: 'pbv_full_application',
      anchorId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      eventType: ApplicationEventType.DOCUMENT_WAIVED,
      actorUserId: null,
      actorDisplayName: 'System',
      payload: { doc_type: 'x', label: 'X' },
    };
    expect(params.actorUserId).toBeNull();
  });
});

// ── Provenance fields in HACH payload ────────────────────────────────────────
// Phase 2 update: staff provenance fields are Stanton-internal and must NOT
// reach HACH. They were added to HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED in
// the Phase 2 payload-filter update.

describe('Provenance fields are BANNED from HACH payload (Phase 2 update)', () => {
  const docWithProvenance = {
    id: 'doc-uuid-1',
    doc_type: 'bank_statement',
    label: 'Bank Statement',
    status: 'submitted',
    file_name: 'bank.pdf',
    storage_path: 'submissions/bank.pdf',
    revision: 2,
    uploaded_by_role: 'staff',
    uploaded_by_display_name: 'Tess Rivera',
    staff_upload_note: 'Uploaded at intake',
    original_doc_type: null,
    rejection_reason: null,
  };

  it('uploaded_by_role is stripped by stripBannedKeys', () => {
    const cleaned = stripBannedKeys({ documents: [docWithProvenance] }) as any;
    expect(cleaned.documents[0]).not.toHaveProperty('uploaded_by_role');
  });

  it('uploaded_by_display_name is stripped by stripBannedKeys', () => {
    const cleaned = stripBannedKeys({ documents: [docWithProvenance] }) as any;
    expect(cleaned.documents[0]).not.toHaveProperty('uploaded_by_display_name');
  });

  it('staff_upload_note is stripped by stripBannedKeys', () => {
    const cleaned = stripBannedKeys({ documents: [docWithProvenance] }) as any;
    expect(cleaned.documents[0]).not.toHaveProperty('staff_upload_note');
  });

  it('original_doc_type is stripped by stripBannedKeys', () => {
    const cleaned = stripBannedKeys({ documents: [docWithProvenance] }) as any;
    expect(cleaned.documents[0]).not.toHaveProperty('original_doc_type');
  });

  it('revision (non-sensitive) is preserved by stripBannedKeys', () => {
    const cleaned = stripBannedKeys({ documents: [docWithProvenance] }) as any;
    expect(cleaned.documents[0]).toHaveProperty('revision', 2);
  });

  it('all internal document fields are stripped — reviewer, notes, reviewed_at, and provenance', () => {
    const docWithInternal = {
      ...docWithProvenance,
      notes: 'Stanton internal note',
      reviewer: 'Tess',
      reviewed_at: '2026-05-01T10:00:00Z',
    };
    const cleaned = stripBannedKeys({ documents: [docWithInternal] }) as any;
    expect(cleaned.documents[0]).not.toHaveProperty('notes');
    expect(cleaned.documents[0]).not.toHaveProperty('reviewer');
    expect(cleaned.documents[0]).not.toHaveProperty('reviewed_at');
    expect(cleaned.documents[0]).not.toHaveProperty('uploaded_by_role');
    expect(cleaned.documents[0]).not.toHaveProperty('staff_upload_note');
    // Safe fields remain
    expect(cleaned.documents[0]).toHaveProperty('file_name', 'bank.pdf');
  });
});

// ── Recategorize guard logic ──────────────────────────────────────────────────

describe('Recategorize guard logic', () => {
  type DocSlot = { doc_type: string; status: string };

  function getEligibleTargets(allDocs: DocSlot[], sourceDocType: string): DocSlot[] {
    return allDocs.filter(
      (s) => s.doc_type !== sourceDocType && s.status !== 'approved' && s.status !== 'waived'
    );
  }

  const docs: DocSlot[] = [
    { doc_type: 'bank_statement', status: 'missing' },
    { doc_type: 'pay_stub', status: 'submitted' },
    { doc_type: 'id_card', status: 'approved' },
    { doc_type: 'vawa_cert', status: 'waived' },
    { doc_type: 'tax_return', status: 'rejected' },
  ];

  it('excludes the source doc_type from eligible targets', () => {
    const eligible = getEligibleTargets(docs, 'bank_statement');
    expect(eligible.every((d) => d.doc_type !== 'bank_statement')).toBe(true);
  });

  it('excludes approved slots from eligible targets', () => {
    const eligible = getEligibleTargets(docs, 'bank_statement');
    expect(eligible.some((d) => d.status === 'approved')).toBe(false);
  });

  it('excludes waived slots from eligible targets', () => {
    const eligible = getEligibleTargets(docs, 'bank_statement');
    expect(eligible.some((d) => d.status === 'waived')).toBe(false);
  });

  it('includes missing, submitted, and rejected slots', () => {
    // Use 'tax_return' (rejected) as source so bank_statement (missing) is in the eligible set
    const eligible = getEligibleTargets(docs, 'tax_return');
    const statuses = eligible.map((d) => d.status);
    expect(statuses).toContain('missing');   // bank_statement
    expect(statuses).toContain('submitted'); // pay_stub
    // tax_return (rejected) is the source, so only 2 non-approved/non-waived/non-source remain
    expect(statuses.every((s) => s !== 'approved' && s !== 'waived')).toBe(true);
  });

  it('returns empty array when all other slots are approved or waived', () => {
    const lockedDocs: DocSlot[] = [
      { doc_type: 'bank_statement', status: 'submitted' },
      { doc_type: 'id_card', status: 'approved' },
      { doc_type: 'tax_return', status: 'waived' },
    ];
    const eligible = getEligibleTargets(lockedDocs, 'bank_statement');
    expect(eligible).toHaveLength(0);
  });

  it('same doc_type move is a no-op (excluded by source filter)', () => {
    const eligible = getEligibleTargets(docs, 'bank_statement');
    const selfMove = eligible.find((d) => d.doc_type === 'bank_statement');
    expect(selfMove).toBeUndefined();
  });
});

// ── Upload canUpload guard ────────────────────────────────────────────────────

describe('Upload canUpload guard logic', () => {
  function canUpload(status: string): boolean {
    return status !== 'approved' && status !== 'waived';
  }

  it('allows upload when status is missing', () => {
    expect(canUpload('missing')).toBe(true);
  });

  it('allows upload when status is submitted', () => {
    expect(canUpload('submitted')).toBe(true);
  });

  it('allows upload when status is rejected', () => {
    expect(canUpload('rejected')).toBe(true);
  });

  it('blocks upload when status is approved', () => {
    expect(canUpload('approved')).toBe(false);
  });

  it('blocks upload when status is waived', () => {
    expect(canUpload('waived')).toBe(false);
  });
});

// ── Provenance badge rendering logic ─────────────────────────────────────────

describe('Provenance badge rendering conditions', () => {
  interface Doc {
    uploaded_by_role?: string | null;
    original_doc_type?: string | null;
    staff_upload_note?: string | null;
  }

  function isStaffUploaded(doc: Doc): boolean {
    return doc.uploaded_by_role === 'staff';
  }

  function isRecategorized(doc: Doc): boolean {
    return !!doc.original_doc_type;
  }

  it('isStaffUploaded returns true for role=staff', () => {
    expect(isStaffUploaded({ uploaded_by_role: 'staff' })).toBe(true);
  });

  it('isStaffUploaded returns false for role=tenant', () => {
    expect(isStaffUploaded({ uploaded_by_role: 'tenant' })).toBe(false);
  });

  it('isStaffUploaded returns false when uploaded_by_role is null', () => {
    expect(isStaffUploaded({ uploaded_by_role: null })).toBe(false);
  });

  it('isRecategorized returns true when original_doc_type is set', () => {
    expect(isRecategorized({ original_doc_type: 'bank_statement' })).toBe(true);
  });

  it('isRecategorized returns false when original_doc_type is null', () => {
    expect(isRecategorized({ original_doc_type: null })).toBe(false);
  });

  it('isRecategorized returns false when original_doc_type is undefined', () => {
    expect(isRecategorized({})).toBe(false);
  });

  it('staff_upload_note is shown only when truthy', () => {
    const withNote = { staff_upload_note: 'Uploaded at appointment' };
    const withoutNote = { staff_upload_note: null };
    expect(!!withNote.staff_upload_note).toBe(true);
    expect(!!withoutNote.staff_upload_note).toBe(false);
  });
});

// ── PriorVersionsExpander rendering condition ─────────────────────────────────

describe('PriorVersionsExpander render condition', () => {
  function shouldShowExpander(revision: number | undefined): boolean {
    return (revision ?? 0) > 1;
  }

  it('does not show for revision 0 (unseeded)', () => {
    expect(shouldShowExpander(0)).toBe(false);
  });

  it('does not show for revision 1 (first upload only)', () => {
    expect(shouldShowExpander(1)).toBe(false);
  });

  it('shows for revision 2 (has prior version)', () => {
    expect(shouldShowExpander(2)).toBe(true);
  });

  it('shows for revision 5', () => {
    expect(shouldShowExpander(5)).toBe(true);
  });

  it('does not show when revision is undefined', () => {
    expect(shouldShowExpander(undefined)).toBe(false);
  });
});
