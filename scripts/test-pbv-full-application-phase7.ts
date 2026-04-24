/**
 * Integration test script for PBV Full Application admin flow.
 *
 * Run against a local dev server:
 *   npx ts-node scripts/test-pbv-full-application-phase7.ts
 *
 * Prerequisites:
 *   1. Dev server running at http://localhost:3000
 *   2. Valid admin session cookie in ADMIN_COOKIE
 *   3. PBV_APP_ID set to an existing pbv_full_applications.id
 *   4. HHA_TEMPLATE_FILE points to a local .docx file (defaults to ./no_pets_template.docx)
 */

import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE ?? '';
const PBV_APP_ID = process.env.PBV_APP_ID ?? '';
const HHA_TEMPLATE_FILE = process.env.HHA_TEMPLATE_FILE ?? 'no_pets_template.docx';

type JsonRecord = Record<string, unknown>;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}${detail ? `: ${detail}` : ''}`);
    process.exitCode = 1;
  }
}

function adminHeaders(extra: Record<string, string> = {}) {
  return {
    Cookie: ADMIN_COOKIE,
    ...extra,
  };
}

async function adminGet(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: adminHeaders(),
  });

  return res;
}

async function adminPostJson(path: string, body: JsonRecord) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  return res;
}

async function adminPatch(path: string, body: JsonRecord) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: adminHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  return res;
}

async function uploadTemplate(applicationId: string) {
  const bytes = await readFile(HHA_TEMPLATE_FILE);
  const form = new FormData();
  form.append(
    'template',
    new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }),
    HHA_TEMPLATE_FILE.split(/[/\\]/).pop() || 'hha-template.docx'
  );

  return fetch(`${BASE}/api/admin/pbv/full-applications/${applicationId}/hha?action=upload-template`, {
    method: 'POST',
    headers: adminHeaders(),
    body: form,
  });
}

async function run() {
  console.log('\n=== PBV Full Application — Phase 7 Flow Test ===\n');

  assert('ADMIN_COOKIE is set', !!ADMIN_COOKIE, 'Set ADMIN_COOKIE env var');
  assert('PBV_APP_ID is set', !!PBV_APP_ID, 'Set PBV_APP_ID env var');

  if (!ADMIN_COOKIE || !PBV_APP_ID) {
    process.exit(1);
  }

  console.log('T1: Load PBV application detail');
  const detailRes = await adminGet(`/api/admin/pbv/full-applications/${PBV_APP_ID}`);
  const detailJson = (await detailRes.json()) as JsonRecord;

  assert('detail returns 200', detailRes.status === 200, JSON.stringify(detailJson));
  assert('detail success=true', detailJson.success === true, JSON.stringify(detailJson));

  const detailData = (detailJson.data as JsonRecord | undefined) ?? {};
  const formSubmissionId = String(detailData.form_submission_id ?? '');
  assert('detail includes form_submission_id', !!formSubmissionId, JSON.stringify(detailData));

  if (!formSubmissionId) {
    process.exit(1);
  }

  console.log('\nT2: Upload HHA template');
  const uploadRes = await uploadTemplate(PBV_APP_ID);
  const uploadJson = (await uploadRes.json()) as JsonRecord;

  assert('upload returns 200', uploadRes.status === 200, JSON.stringify(uploadJson));
  assert('upload success=true', uploadJson.success === true, JSON.stringify(uploadJson));

  console.log('\nT3: Normalize document statuses for generation gate');
  const docsRes = await adminGet(`/api/admin/submissions/${formSubmissionId}/documents`);
  const docsJson = (await docsRes.json()) as JsonRecord;
  const docsPayload = (docsJson.data as JsonRecord | undefined) ?? {};
  const docs = ((docsPayload.documents as unknown[]) ?? []) as Array<{
    id: string;
    status: string;
  }>;

  assert('documents endpoint returns 200', docsRes.status === 200, JSON.stringify(docsJson));
  assert('documents array found', Array.isArray(docs), JSON.stringify(docsPayload));

  for (const doc of docs) {
    if (doc.status === 'approved' || doc.status === 'waived') continue;

    const action = doc.status === 'missing' ? 'waive' : 'approve';
    const reviewRes = await adminPostJson(
      `/api/admin/submissions/${formSubmissionId}/documents/${doc.id}/review`,
      action === 'waive'
        ? { action: 'waive', notes: 'Phase 7 integration test waiver' }
        : { action: 'approve' }
    );

    const reviewJson = (await reviewRes.json()) as JsonRecord;
    assert(
      `document ${doc.id.slice(0, 8)} reviewed`,
      reviewRes.status === 200,
      JSON.stringify(reviewJson)
    );
  }

  console.log('\nT4: Set Stanton review status to approved');
  const patchRes = await adminPatch(`/api/admin/pbv/full-applications/${PBV_APP_ID}`, {
    stanton_review_status: 'approved',
    stanton_reviewer: 'Phase7 Test',
    stanton_review_notes: 'Automated flow check',
  });
  const patchJson = (await patchRes.json()) as JsonRecord;

  assert('patch returns 200', patchRes.status === 200, JSON.stringify(patchJson));
  assert('patch success=true', patchJson.success === true, JSON.stringify(patchJson));

  console.log('\nT5: Generate HHA document');
  const generateRes = await fetch(`${BASE}/api/admin/pbv/full-applications/${PBV_APP_ID}/hha`, {
    method: 'POST',
    headers: adminHeaders(),
  });

  const generationContentType = generateRes.headers.get('content-type') || '';
  assert('generation returns 200', generateRes.status === 200, String(generateRes.status));
  assert(
    'generation returns docx content-type',
    generationContentType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    generationContentType
  );

  console.log('\nT6: Export HACH ZIP and verify HHA included');
  const exportRes = await adminGet(`/api/admin/pbv/full-applications/${PBV_APP_ID}/export`);
  assert('export returns 200', exportRes.status === 200, String(exportRes.status));
  assert('export content-type is zip', (exportRes.headers.get('content-type') || '').includes('application/zip'));

  const zipBuffer = await exportRes.arrayBuffer();
  const zip = await JSZip.loadAsync(zipBuffer);
  const zipEntries = Object.keys(zip.files);

  const hasHhaEntry = zipEntries.some((name) => name.startsWith('hha/') && name.toLowerCase().endsWith('.docx'));
  assert('export contains HHA docx in hha/ folder', hasHhaEntry, zipEntries.join(', '));

  console.log('\n=== Done ===\n');
}

run().catch((error) => {
  console.error('Unhandled test error:', error);
  process.exit(1);
});
