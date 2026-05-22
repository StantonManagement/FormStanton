/**
 * PRD-62: completeFormSigning tests.
 *
 * Targets:
 *  - Gate 2 (typed_name): inserted typed_name === options.typedName, NOT member.name
 *  - Gate 3 (per-signer signing_device on first tap): when allSigned === false,
 *    the household member's signing_device is still updated for that signer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Per-table queued mock ────────────────────────────────────────────────────
//
// Each table can have an ordered queue of select responses (consumed FIFO),
// plus a single default insert/update response. Distinct queues mean we can
// stub the first `select.maybeSingle` (single row) differently from a later
// `select.eq.then` (array) on the same table.

type QueuedResponse = { data: any; error?: any };

let _selectQueues: Record<string, QueuedResponse[]> = {};
let _insertResults: Record<string, QueuedResponse> = {};
let _updateResults: Record<string, QueuedResponse> = {};
let _calls: {
  table: string;
  op: 'select' | 'insert' | 'update';
  payload?: any;
  eqs?: Array<{ col: string; val: any }>;
}[] = [];

function nextSelect(tableName: string): QueuedResponse {
  const q = _selectQueues[tableName];
  if (q && q.length) return q.shift()!;
  return { data: null, error: null };
}

function makeBuilder(tableName: string) {
  const eqs: Array<{ col: string; val: any }> = [];
  let currentOp: 'select' | 'insert' | 'update' = 'select';

  const builder: any = {
    select: (..._args: any[]) => {
      currentOp = 'select';
      return builder;
    },
    insert: (payload: any) => {
      currentOp = 'insert';
      _calls.push({ table: tableName, op: 'insert', payload });
      return Promise.resolve(_insertResults[tableName] ?? { data: null, error: null });
    },
    update: (payload: any) => {
      currentOp = 'update';
      const updateBuilder: any = {
        eq: (col: string, val: any) => {
          updateBuilder._eqs ??= [];
          updateBuilder._eqs.push({ col, val });
          return updateBuilder;
        },
        in: (_col: string, _vals: any[]) => updateBuilder,
        then: (fn: any) => {
          _calls.push({ table: tableName, op: 'update', payload, eqs: updateBuilder._eqs });
          return Promise.resolve(_updateResults[tableName] ?? { data: null, error: null }).then(fn);
        },
      };
      return updateBuilder;
    },
    eq: (col: string, val: any) => {
      eqs.push({ col, val });
      return builder;
    },
    in: (_col: string, _vals: any[]) => builder,
    not: (..._args: any[]) => builder,
    order: (..._args: any[]) => builder,
    maybeSingle: () => {
      _calls.push({ table: tableName, op: currentOp, eqs });
      return Promise.resolve(nextSelect(tableName));
    },
    then: (fn: any) => {
      _calls.push({ table: tableName, op: currentOp, eqs });
      const r = nextSelect(tableName);
      // Default to [] for list-shaped reads if nothing was queued.
      const data = r.data ?? [];
      return Promise.resolve({ data, error: r.error ?? null }).then(fn);
    },
  };

  return builder;
}

const mockFrom = vi.fn((tableName: string) => makeBuilder(tableName));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: (tableName: string) => mockFrom(tableName),
    storage: {
      from: (_bucket: string) => ({
        download: async (_path: string) => ({
          data: { arrayBuffer: async () => new ArrayBuffer(8) },
          error: null,
        }),
        upload: async (_path: string, _data: any, _opts: any) => ({ data: { path: _path }, error: null }),
      }),
    },
  },
}));

// We don't exercise the all-signed branch in these tests, so the stamper +
// field-map loader are never invoked. Stub them defensively in case the harness
// pulls them transitively.
vi.mock('@/lib/pbv/form-generation/stamper', () => ({
  stampForm: async () => Buffer.from('stamped'),
}));

import { completeFormSigning } from '../signing/completeForm';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('completeFormSigning() — PRD-62', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    _selectQueues = {};
    _insertResults = {};
    _updateResults = {};
    _calls = [];
  });

  it('Gate 2: inserts typed_name from options.typedName, not member.name', async () => {
    _selectQueues = {
      pbv_form_documents: [
        { // 1st select — the single form doc
          data: {
            id: 'fd-1',
            full_application_id: 'app-1',
            form_id: 'hach_release',
            language: 'en',
            status: 'generated',
            unsigned_pdf_path: 'pbv/app-1/forms/hach_release-en-unsigned.pdf',
            required_signer_member_ids: ['m1', 'm2'], // multi-signer — first signer only
            collected_signer_member_ids: [],
            signed_pdf_path: null,
          },
        },
        // 2nd select (in updateApplicationSigningStatus) — list of docs
        { data: [{ status: 'generated' }] },
      ],
      pbv_household_members: [{ data: { id: 'm1', name: 'DB Name (do not use)', slot: 1 } }],
    };
    _insertResults = { pbv_signature_events: { data: null, error: null } };
    _updateResults = {
      pbv_form_documents: { data: null, error: null },
      pbv_household_members: { data: null, error: null },
      pbv_full_applications: { data: null, error: null },
    };

    const result = await completeFormSigning({
      formDocId: 'fd-1',
      appId: 'app-1',
      signerMemberId: 'm1',
      deviceOwner: 'self',
      signatureImagePath: 'sigs/m1.png',
      ceremonyId: 'cer-1',
      consentTextVersion: '2026-05-15-v1',
      typedName: 'Alice Typed-On-Tablet',
      assistedByStaffUserId: null,
      ipAddress: '1.2.3.4',
      userAgent: 'test-ua',
    });

    expect(result.success).toBe(true);
    expect(result.allSigned).toBe(false);

    const insert = _calls.find((c) => c.table === 'pbv_signature_events' && c.op === 'insert');
    expect(insert).toBeDefined();
    expect(insert?.payload).toMatchObject({
      typed_name: 'Alice Typed-On-Tablet',
      signer_member_id: 'm1',
      ip_address: '1.2.3.4',
      user_agent: 'test-ua',
      device_owner: 'self',
    });
    expect(insert?.payload.typed_name).not.toBe('DB Name (do not use)');
  });

  it('Gate 3: writes signing_device to the signer on the first tap (allSigned=false)', async () => {
    _selectQueues = {
      pbv_form_documents: [
        {
          data: {
            id: 'fd-1',
            full_application_id: 'app-1',
            form_id: 'hach_release',
            language: 'en',
            status: 'generated',
            unsigned_pdf_path: 'pbv/app-1/forms/hach_release-en-unsigned.pdf',
            required_signer_member_ids: ['m1', 'm2'],
            collected_signer_member_ids: [],
            signed_pdf_path: null,
          },
        },
        { data: [{ status: 'generated' }] },
      ],
      pbv_household_members: [{ data: { id: 'm1', name: 'Alice', slot: 1 } }],
    };
    _insertResults = { pbv_signature_events: { data: null, error: null } };
    _updateResults = {
      pbv_form_documents: { data: null, error: null },
      pbv_household_members: { data: null, error: null },
      pbv_full_applications: { data: null, error: null },
    };

    await completeFormSigning({
      formDocId: 'fd-1',
      appId: 'app-1',
      signerMemberId: 'm1',
      deviceOwner: 'hoh_device',
      signatureImagePath: 'sigs/m1.png',
      ceremonyId: 'cer-1',
      consentTextVersion: '2026-05-15-v1',
      typedName: 'Alice',
      assistedByStaffUserId: null,
      ipAddress: null,
      userAgent: null,
    });

    // The member-update should fire even though only 1 of 2 signers has signed.
    const memberUpdate = _calls.find(
      (c) =>
        c.table === 'pbv_household_members' &&
        c.op === 'update' &&
        c.payload?.signing_device === 'hoh_device' &&
        c.eqs?.some((e) => e.col === 'id' && e.val === 'm1')
    );
    expect(memberUpdate).toBeDefined();
  });

  it('PRD-66 (#11): signed-PDF path is suffixed with ceremony_id and uploads with upsert:false', () => {
    // Structural assertion — the all-signed branch is wrapped in heavy
    // storage / sigImageMap / stamper mocking, so a focused source check is
    // the durable shape for this invariant. A future refactor that drops
    // the ceremony suffix or flips upsert back to true fails this test.
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const src = readFileSync(
      join(process.cwd(), 'lib', 'pbv', 'signing', 'completeForm.ts'),
      'utf8'
    );
    // The signed path literal includes ceremonyId.
    expect(src).toMatch(/`pbv\/\$\{appId\}\/forms\/\$\{formDoc\.form_id\}-\$\{formDoc\.language\}-\$\{ceremonyId\}-signed\.pdf`/);
    // The signed-PDF upload (.upload(signedPdfPath, signedPdfBuffer, {...}))
    // uses upsert:false — find that exact call and check the options object.
    const uploadMatch = src.match(/\.upload\(\s*signedPdfPath\s*,\s*signedPdfBuffer\s*,\s*\{([\s\S]*?)\}\s*\)/);
    expect(uploadMatch, 'expected to find .upload(signedPdfPath, signedPdfBuffer, {...})').not.toBeNull();
    expect(uploadMatch![1]).toMatch(/upsert:\s*false/);
    // A benign same-ceremony replay (409 / "exists" / "duplicate") is
    // caught and treated as already-written rather than throwing.
    expect(src).toMatch(/benignReplay/);
    expect(src).toMatch(/statusCode/);
  });

  it('does not read from a Request — options carry ipAddress/userAgent directly', async () => {
    // Compile-time guard: the function signature should no longer require a Request.
    // If a future refactor reintroduces request: Request, the following call
    // (with no `request` key) would stop compiling. The test here exercises the
    // happy path at runtime to anchor that contract.
    _selectQueues = {
      pbv_form_documents: [
        {
          data: {
            id: 'fd-1',
            full_application_id: 'app-1',
            form_id: 'hach_release',
            language: 'en',
            status: 'generated',
            unsigned_pdf_path: 'p.pdf',
            required_signer_member_ids: ['m1', 'm2'],
            collected_signer_member_ids: [],
            signed_pdf_path: null,
          },
        },
        { data: [{ status: 'generated' }] },
      ],
      pbv_household_members: [{ data: { id: 'm1', name: 'Alice', slot: 1 } }],
    };
    _insertResults = { pbv_signature_events: { data: null, error: null } };
    _updateResults = {
      pbv_form_documents: { data: null, error: null },
      pbv_household_members: { data: null, error: null },
      pbv_full_applications: { data: null, error: null },
    };

    const result = await completeFormSigning({
      formDocId: 'fd-1',
      appId: 'app-1',
      signerMemberId: 'm1',
      deviceOwner: 'self',
      signatureImagePath: 'sigs/m1.png',
      ceremonyId: 'cer-1',
      consentTextVersion: '2026-05-15-v1',
      typedName: 'Alice',
      ipAddress: null,
      userAgent: null,
    });

    expect(result.success).toBe(true);
  });

  // PRP-023: completeFormSigning must dual-write to application_documents so
  // finalize's Check 4 (application_documents) can agree with Check 3
  // (pbv_form_documents). These are source-shape assertions because the
  // mock-builder above doesn't model `.in(col, vals)` chains the way the
  // real client does, so we lock the behavior at the source level.
  describe('PRP-023: application_documents dual-write', () => {
    it('exports formIdToDocTypes with the briefing_cert alias', async () => {
      const { formIdToDocTypes } = await import('../signing/completeForm');
      expect(formIdToDocTypes('hach_release')).toEqual(['hach_release']);
      // PRD-55 renamed briefing_docs_certification → briefing_cert in
      // pbv_form_templates only. The alias maps the new form_id back to the
      // legacy doc_type so application_documents still gets marked submitted.
      expect(formIdToDocTypes('briefing_cert').sort()).toEqual(
        ['briefing_cert', 'briefing_docs_certification'].sort()
      );
    });

    it('source: HOH-scope branch only writes when allSigned, and clears status=missing on signed_forms rows', () => {
      const { readFileSync } = require('fs');
      const { join } = require('path');
      const src = readFileSync(
        join(process.cwd(), 'lib', 'pbv', 'signing', 'completeForm.ts'),
        'utf8'
      );

      // Isolate syncApplicationDocumentsForSignedForm so the branch-level
      // assertions can't accidentally pick up matches from elsewhere in the file.
      const fnStart = src.indexOf('async function syncApplicationDocumentsForSignedForm');
      expect(fnStart).toBeGreaterThan(-1);
      const fnAfter = src.indexOf('\n// PRP-005', fnStart); // next sentinel after the function
      expect(fnAfter).toBeGreaterThan(fnStart);
      const fnBody = src.slice(fnStart, fnAfter);

      // HOH branch — must guard on allSigned and update application_documents
      // with status='submitted' / category='signed_forms'.
      const hohBranchMatch = fnBody.match(
        /scope === 'submission_level' \|\| scope === 'head_of_household_only'[\s\S]+?return;\s*\}/
      );
      expect(hohBranchMatch, 'expected HOH-scope branch in syncApplicationDocumentsForSignedForm').not.toBeNull();
      const hohBranch = hohBranchMatch![0];
      expect(hohBranch).toMatch(/if \(!allSigned\) return;/);
      expect(hohBranch).toMatch(/status: 'submitted'/);
      expect(hohBranch).toMatch(/category[^\n]*signed_forms/);
      expect(hohBranch).toMatch(/status[^\n]*missing/);

      // Per-person branch — must NOT gate on allSigned; matches on person_slot.
      const perPersonMatch = fnBody.match(
        /scope === 'each_adult' \|\| scope === 'individual' \|\| scope === 'each_member'[\s\S]+?return;\s*\}/
      );
      expect(perPersonMatch, 'expected per-person scope branch').not.toBeNull();
      const perPersonBranch = perPersonMatch![0];
      expect(perPersonBranch).toMatch(/person_slot/);
      expect(perPersonBranch).toMatch(/signerSlot/);
      expect(perPersonBranch).not.toMatch(/if \(!allSigned\) return;/);
    });
  });
});
