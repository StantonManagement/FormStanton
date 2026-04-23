/**
 * Integration test script for Foundation Review Layer API.
 * Run against a local dev server: npx ts-node scripts/test-foundation-review.ts
 *
 * Prerequisites:
 *   1. Dev server running at http://localhost:3000
 *   2. At least one form_document_templates seed in the DB (see SEED section below)
 *   3. Valid admin session cookie — set ADMIN_COOKIE env var
 *
 * Coverage:
 *   T1 — Submission creation: happy path, per-person slots seeded correctly
 *   T2 — Multi-adult household: same doc_type seeded into multiple slots
 *   T3 — Tenant upload: missing → submitted
 *   T4 — Staff review: submitted → approved
 *   T5 — Staff review: submitted → rejected with reason
 *   T6 — Resubmit cycle: rejected → tenant uploads → submitted again
 *   T7 — Waiver: staff waives a missing document
 *   T8 — Parent status derivation: all approved/waived → parent = approved
 *   T9 — RLS boundary: token from submission A cannot access documents from submission B
 *   T10 — Guard: PATCH /form-submissions/[id] with status rejected for per_document submission
 */

const BASE = 'http://localhost:3000';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE ?? '';

const FORM_ID = 'test-foundation-review';

async function adminPost(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: ADMIN_COOKIE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function adminGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: ADMIN_COOKIE },
  });
  return { status: res.status, body: await res.json() };
}

async function adminPatch(path: string, body: object) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: ADMIN_COOKIE },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

async function tenantGet(path: string) {
  const res = await fetch(`${BASE}${path}`);
  return { status: res.status, body: await res.json() };
}

async function tenantUpload(path: string, filename: string, content: string) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), filename);
  const res = await fetch(`${BASE}${path}`, { method: 'POST', body: form });
  return { status: res.status, body: await res.json() };
}

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    process.exitCode = 1;
  }
}

// ─── SEED: insert test templates ────────────────────────────────────────────
// Run this SQL before executing tests:
//
// INSERT INTO form_document_templates (form_id, doc_type, label, required, display_order, per_person, applies_to)
// VALUES
//   ('test-foundation-review', 'proof-of-id',   'Proof of Identity',        true, 1, false, 'submission'),
//   ('test-foundation-review', 'paystubs',       'Paystubs',                 true, 2, true,  'each_member_matching_rule'),
//   ('test-foundation-review', 'hud-9886a',      'HUD-9886-A Authorization', true, 3, true,  'each_adult')
// ON CONFLICT DO NOTHING;
//
// And for T2 (multi-adult), use a household_members array with 2 adults in form_data.
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  console.log('\n=== Foundation Review Layer — Integration Tests ===\n');

  // ── T1: Happy path submission creation ──────────────────────────────────
  console.log('T1: Submission creation — happy path');
  const t1 = await fetch(`${BASE}/api/forms/${FORM_ID}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_name: 'Maria Garcia',
      building_address: '15 Whitney Avenue',
      unit_number: '1E',
      language: 'en',
      form_data: {
        asset_id: 'S0006',
        household_members: [
          { name: 'Maria Garcia', age: 35, employed: true },
        ],
      },
    }),
  });
  const t1Body = await t1.json();
  assert('returns 201', t1.status === 201, JSON.stringify(t1Body));
  assert('has submission_id', !!t1Body.data?.submission_id);
  assert('has tenant_access_token', !!t1Body.data?.tenant_access_token);
  assert('document_slots_created >= 1', (t1Body.data?.document_slots_created ?? 0) >= 1);

  const { submission_id, tenant_access_token } = t1Body.data ?? {};

  // ── T2: Multi-adult — same doc_type in multiple slots ───────────────────
  console.log('\nT2: Multi-adult household — same doc_type in multiple slots');
  const t2 = await fetch(`${BASE}/api/forms/${FORM_ID}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_name: 'Juan Rodriguez',
      building_address: '15 Whitney Avenue',
      unit_number: '2A',
      language: 'en',
      form_data: {
        asset_id: 'S0006',
        household_members: [
          { name: 'Juan Rodriguez', age: 42, employed: true },
          { name: 'Ana Rodriguez', age: 38, employed: true },
          { name: 'Carlos Rodriguez', age: 16, employed: false },
        ],
      },
    }),
  });
  const t2Body = await t2.json();
  assert('returns 201', t2.status === 201, JSON.stringify(t2Body));
  // hud-9886a applies to each_adult (ages 42 and 38) → 2 slots
  // paystubs applies to each_member_matching_rule (employed=true: ages 42 and 38) → 2 slots
  // proof-of-id → 1 slot
  // Total = 5 slots
  assert('5 document slots seeded for 3-person household', t2Body.data?.document_slots_created === 5,
    `got ${t2Body.data?.document_slots_created}`);

  // ── T3: Tenant status endpoint ───────────────────────────────────────────
  console.log('\nT3: Tenant status endpoint');
  const t3 = await tenantGet(`/api/t/${tenant_access_token}/status`);
  assert('returns 200', t3.status === 200, JSON.stringify(t3.body));
  assert('has documents array', Array.isArray(t3.body.data?.documents));
  assert('all documents start as missing', t3.body.data?.documents?.every((d: any) => d.status === 'missing'));

  // ── T3b: Tenant upload ───────────────────────────────────────────────────
  console.log('\nT3b: Tenant uploads a document');
  const documents = t3.body.data?.documents ?? [];
  const firstDoc = documents.find((d: any) => d.doc_type === 'proof-of-id' && d.person_slot === 0);
  assert('found proof-of-id slot', !!firstDoc, JSON.stringify(documents[0]));

  const t3b = await tenantUpload(
    `/api/t/${tenant_access_token}/documents/${firstDoc?.id}`,
    'proof-of-id.pdf',
    '%PDF-1.4 fake content for test'
  );
  assert('upload returns 201', t3b.status === 201, JSON.stringify(t3b.body));
  assert('has revision = 1', t3b.body.data?.revision === 1);

  // ── T3c: Status is now submitted ─────────────────────────────────────────
  const t3c = await tenantGet(`/api/t/${tenant_access_token}/status`);
  const updatedDoc = t3c.body.data?.documents?.find((d: any) => d.id === firstDoc?.id);
  assert('document status is submitted', updatedDoc?.status === 'submitted', updatedDoc?.status);

  // ── T4: Staff approves the document ─────────────────────────────────────
  console.log('\nT4: Staff approves document');
  const t4 = await adminPost(
    `/api/admin/submissions/${submission_id}/documents/${firstDoc?.id}/review`,
    { action: 'approve' }
  );
  assert('returns 200', t4.status === 200, JSON.stringify(t4.body));
  assert('status is approved', t4.body.data?.status === 'approved');

  // ── T5: Staff rejects another document ──────────────────────────────────
  console.log('\nT5: Staff rejects a document');
  const firstPaystubsDoc = documents.find((d: any) => d.doc_type === 'paystubs' && d.person_slot === 1);
  // paystubs slot may still be missing — upload first, then reject
  if (firstPaystubsDoc) {
    await tenantUpload(
      `/api/t/${tenant_access_token}/documents/${firstPaystubsDoc.id}`,
      'paystubs.pdf',
      '%PDF fake paystubs'
    );
    const t5 = await adminPost(
      `/api/admin/submissions/${submission_id}/documents/${firstPaystubsDoc.id}/review`,
      { action: 'reject', rejection_reason: 'Document is more than 60 days old' }
    );
    assert('returns 200', t5.status === 200, JSON.stringify(t5.body));
    assert('status is rejected', t5.body.data?.status === 'rejected');

    // ── T6: Resubmit cycle ───────────────────────────────────────────────
    console.log('\nT6: Resubmit cycle — rejected → tenant uploads → submitted');
    const t6 = await tenantUpload(
      `/api/t/${tenant_access_token}/documents/${firstPaystubsDoc.id}`,
      'paystubs-v2.pdf',
      '%PDF fake paystubs v2'
    );
    assert('upload returns 201', t6.status === 201, JSON.stringify(t6.body));
    assert('revision is now 2', t6.body.data?.revision === 2);
    const t6Status = await tenantGet(`/api/t/${tenant_access_token}/status`);
    const resubDoc = t6Status.body.data?.documents?.find((d: any) => d.id === firstPaystubsDoc.id);
    assert('status back to submitted after resubmit', resubDoc?.status === 'submitted');
  } else {
    console.log('  (skipped — no paystubs slot found, check template seed)');
  }

  // ── T7: Staff waives a missing document ─────────────────────────────────
  console.log('\nT7: Staff waives a missing document');
  const missingDoc = (await adminGet(`/api/admin/submissions/${submission_id}/documents`))
    .body.data?.documents?.find((d: any) => d.status === 'missing');
  if (missingDoc) {
    const t7 = await adminPost(
      `/api/admin/submissions/${submission_id}/documents/${missingDoc.id}/review`,
      { action: 'waive', notes: 'Not applicable for this tenant' }
    );
    assert('returns 200', t7.status === 200, JSON.stringify(t7.body));
    assert('status is waived', t7.body.data?.status === 'waived');
  } else {
    console.log('  (skipped — no missing documents remaining)');
  }

  // ── T8: Parent status derivation ────────────────────────────────────────
  console.log('\nT8: Parent status derived from children');
  const t8 = await adminGet(`/api/admin/form-submissions/${submission_id}`);
  console.log(`  parent status: ${t8.body.data?.status}`);
  // (manual inspection — derived status depends on how many docs are approved/rejected/missing)

  // ── T9: RLS boundary — token from A cannot access documents from B ───────
  console.log('\nT9: RLS boundary — wrong token cannot access documents');
  const t9Submission = await fetch(`${BASE}/api/forms/${FORM_ID}/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tenant_name: 'Other Tenant',
      building_address: '15 Whitney Avenue',
      unit_number: '3B',
      language: 'en',
      form_data: { asset_id: 'S0006', household_members: [] },
    }),
  });
  const t9Body = await t9Submission.json();
  const otherToken = t9Body.data?.tenant_access_token;
  if (otherToken && firstDoc) {
    // firstDoc belongs to submission A; otherToken belongs to submission B
    // Uploading to firstDoc.id using otherToken should return 404
    const t9Upload = await tenantUpload(
      `/api/t/${otherToken}/documents/${firstDoc.id}`,
      'bad.pdf',
      '%PDF fake'
    );
    assert('upload with wrong token returns 404', t9Upload.status === 404, String(t9Upload.status));
  }

  // ── T10: Guard — direct status write rejected for per_document ───────────
  console.log('\nT10: PATCH guard — direct status write rejected');
  const t10 = await adminPatch(`/api/admin/form-submissions/${submission_id}`, {
    status: 'approved',
  });
  assert('returns 400', t10.status === 400, JSON.stringify(t10.body));
  assert('error message mentions per_document', t10.body.message?.includes('per_document'));

  console.log('\n=== Done ===\n');
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
