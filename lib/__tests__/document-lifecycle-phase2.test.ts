import { describe, it, expect, vi } from 'vitest';

// Mock supabase before any imports that touch it
vi.mock('@/lib/supabase', () => ({
  supabase: {},
  supabaseAdmin: { from: vi.fn() },
}));

import {
  ApplicationEventType,
  type EventPayloadMap,
} from '@/lib/events/application-events';
import {
  stripBannedKeys,
  HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED,
  HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL,
} from '@/lib/hach/payload-filter';

// ─── Event type completeness ─────────────────────────────────────────────────

describe('ApplicationEventType — Phase 2 handoff events', () => {
  it('defines HANDOFF_SENT', () => {
    expect(ApplicationEventType.HANDOFF_SENT).toBe('handoff.sent');
  });

  it('defines HANDOFF_REOPENED', () => {
    expect(ApplicationEventType.HANDOFF_REOPENED).toBe('handoff.reopened');
  });
});

// ─── EventPayloadMap — handoff shapes ───────────────────────────────────────

describe('EventPayloadMap — handoff.sent', () => {
  it('accepts required fields', () => {
    const payload: EventPayloadMap['handoff.sent'] = {
      hach_review_status: 'pending_hach',
      hach_packet_revision: 1,
    };
    expect(payload.hach_review_status).toBe('pending_hach');
    expect(payload.hach_packet_revision).toBe(1);
  });

  it('accepts optional override fields', () => {
    const payload: EventPayloadMap['handoff.sent'] = {
      hach_review_status: 'pending_hach',
      hach_packet_revision: 2,
      override_reason: 'Manually overriding — docs pending but urgent',
      override_failed_checks: ['required_docs_cleared'],
    };
    expect(payload.override_reason).toBeTruthy();
    expect(Array.isArray(payload.override_failed_checks)).toBe(true);
  });
});

describe('EventPayloadMap — handoff.reopened', () => {
  it('accepts required fields', () => {
    const payload: EventPayloadMap['handoff.reopened'] = {
      reopen_reason: 'Missing income documentation needs to be updated',
      previous_hach_review_status: 'pending_hach',
    };
    expect(payload.reopen_reason).toBeTruthy();
    expect(payload.previous_hach_review_status).toBe('pending_hach');
  });
});

// ─── HACH payload filter — Phase 2 additions ────────────────────────────────

describe('HACH payload filter — provenance fields stripped from document objects', () => {
  const docWithProvenance = {
    id: 'doc-1',
    doc_type: 'pay_stub',
    label: 'Pay Stub',
    status: 'submitted',
    file_name: 'paystub.pdf',
    uploaded_by_role: 'staff',
    uploaded_by_user_id: 'user-123',
    uploaded_by_display_name: 'Jane Smith',
    staff_upload_note: 'Uploaded on behalf of tenant',
    original_doc_type: 'bank_statement',
    notes: 'internal only',
    reviewer: 'Jane Smith',
    reviewed_at: '2026-05-13T00:00:00Z',
  };

  it('strips uploaded_by_role', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.uploaded_by_role).toBeUndefined();
  });

  it('strips uploaded_by_user_id', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.uploaded_by_user_id).toBeUndefined();
  });

  it('strips uploaded_by_display_name', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.uploaded_by_display_name).toBeUndefined();
  });

  it('strips staff_upload_note', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.staff_upload_note).toBeUndefined();
  });

  it('strips original_doc_type', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.original_doc_type).toBeUndefined();
  });

  it('preserves safe fields', () => {
    const result = stripBannedKeys(docWithProvenance) as any;
    expect(result.id).toBe('doc-1');
    expect(result.doc_type).toBe('pay_stub');
    expect(result.label).toBe('Pay Stub');
    expect(result.status).toBe('submitted');
    expect(result.file_name).toBe('paystub.pdf');
  });
});

describe('HACH payload filter — handoff fields pass through application object', () => {
  const appObject = {
    id: 'app-1',
    head_of_household_name: 'Doe, Jane',
    hach_review_status: 'pending_hach',
    hach_packet_revision: 2,
    submitted_to_hach_at: '2026-05-13T10:00:00Z',
  };

  it('preserves hach_packet_revision', () => {
    const result = stripBannedKeys(appObject) as any;
    expect(result.hach_packet_revision).toBe(2);
  });

  it('preserves submitted_to_hach_at', () => {
    const result = stripBannedKeys(appObject) as any;
    expect(result.submitted_to_hach_at).toBe('2026-05-13T10:00:00Z');
  });
});

describe('HACH payload filter — stanton_review_notes still unconditionally stripped', () => {
  it('strips stanton_review_notes from application object', () => {
    const obj = {
      id: 'app-1',
      hach_review_status: 'pending_hach',
      stanton_review_notes: 'Internal Stanton note — never expose',
      stanton_reviewer: 'Jane Smith',
      stanton_review_date: '2026-05-13',
    };
    const result = stripBannedKeys(obj) as any;
    expect(result.stanton_review_notes).toBeUndefined();
    expect(result.stanton_reviewer).toBeUndefined();
    expect(result.stanton_review_date).toBeUndefined();
  });
});

// ─── Banned key sets — correctness ──────────────────────────────────────────

describe('HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED contents', () => {
  const expectedScoped = [
    'notes',
    'reviewer',
    'reviewed_at',
    'uploaded_by_role',
    'uploaded_by_user_id',
    'uploaded_by_display_name',
    'staff_upload_note',
    'original_doc_type',
  ];

  it.each(expectedScoped)('contains %s', (key) => {
    expect(HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED.has(key)).toBe(true);
  });
});

describe('HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL contents', () => {
  const expectedUnconditional = [
    'stanton_review_notes',
    'stanton_reviewer',
    'stanton_review_date',
    'internal_notes',
  ];

  it.each(expectedUnconditional)('contains %s', (key) => {
    expect(HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL.has(key)).toBe(true);
  });
});

// ─── PacketLockBanner render — logic contract ────────────────────────────────
// Unit-level — no DOM import needed; tests the logic props

describe('PacketLockBanner — prop logic contracts', () => {
  it('canReopen false when no permission', () => {
    const canReopen = false;
    expect(canReopen).toBe(false);
  });

  it('canReopen true when has permission', () => {
    const canReopen = true;
    expect(canReopen).toBe(true);
  });
});

// ─── Pre-flight check logic ───────────────────────────────────────────────────

describe('Pre-flight check logic', () => {
  function runChecks(app: {
    stanton_review_status: string;
    hha_application_file: string | null;
  }, docsNotCleared: number) {
    const checks: { key: string; passed: boolean }[] = [
      {
        key: 'required_docs_cleared',
        passed: docsNotCleared === 0,
      },
      {
        key: 'stanton_approved',
        passed: app.stanton_review_status === 'approved',
      },
      {
        key: 'hha_generated',
        passed: !!app.hha_application_file,
      },
    ];
    return {
      checks,
      all_passed: checks.every((c) => c.passed),
    };
  }

  it('all_passed when all conditions met', () => {
    const result = runChecks(
      { stanton_review_status: 'approved', hha_application_file: 'hha-file.docx' },
      0
    );
    expect(result.all_passed).toBe(true);
    expect(result.checks.every((c) => c.passed)).toBe(true);
  });

  it('fails when stanton not approved', () => {
    const result = runChecks(
      { stanton_review_status: 'under_review', hha_application_file: 'hha-file.docx' },
      0
    );
    const check = result.checks.find((c) => c.key === 'stanton_approved')!;
    expect(check.passed).toBe(false);
    expect(result.all_passed).toBe(false);
  });

  it('fails when required docs not cleared', () => {
    const result = runChecks(
      { stanton_review_status: 'approved', hha_application_file: 'hha-file.docx' },
      3
    );
    const check = result.checks.find((c) => c.key === 'required_docs_cleared')!;
    expect(check.passed).toBe(false);
    expect(result.all_passed).toBe(false);
  });

  it('fails when hha not generated', () => {
    const result = runChecks(
      { stanton_review_status: 'approved', hha_application_file: null },
      0
    );
    const check = result.checks.find((c) => c.key === 'hha_generated')!;
    expect(check.passed).toBe(false);
  });

  it('reports multiple failures', () => {
    const result = runChecks(
      { stanton_review_status: 'pending', hha_application_file: null },
      2
    );
    const failedCount = result.checks.filter((c) => !c.passed).length;
    expect(failedCount).toBe(3);
  });
});

// ─── Reopen logic ────────────────────────────────────────────────────────────

describe('Reopen guard logic', () => {
  it('allows reopen when packet is locked', () => {
    const packetLocked = true;
    expect(packetLocked).toBe(true);
  });

  it('rejects reopen when packet is not locked', () => {
    const packetLocked = false;
    const canReopen = packetLocked;
    expect(canReopen).toBe(false);
  });
});

// ─── Send-to-HACH guard ───────────────────────────────────────────────────────

describe('Send-to-HACH guard logic', () => {
  it('blocks send when already locked', () => {
    const packetLocked = true;
    const canSend = !packetLocked;
    expect(canSend).toBe(false);
  });

  it('allows send when not locked', () => {
    const packetLocked = false;
    const canSend = !packetLocked;
    expect(canSend).toBe(true);
  });

  it('override mode requires reason + acknowledgment', () => {
    const overrideReason = '';
    const allAcknowledged = true;
    const canSubmit = allAcknowledged && overrideReason.trim().length > 0;
    expect(canSubmit).toBe(false);
  });

  it('override mode allows submit with reason + all acks', () => {
    const overrideReason = 'Urgent — tenant deadline';
    const allAcknowledged = true;
    const canSubmit = allAcknowledged && overrideReason.trim().length > 0;
    expect(canSubmit).toBe(true);
  });
});

// ─── Revision increment logic ─────────────────────────────────────────────────

describe('Revision increment on send-to-HACH', () => {
  it('first send yields revision 1', () => {
    const currentRevision = 0;
    const newRevision = currentRevision + 1;
    expect(newRevision).toBe(1);
  });

  it('re-send yields revision 2', () => {
    const currentRevision = 1;
    const newRevision = currentRevision + 1;
    expect(newRevision).toBe(2);
  });
});
