/**
 * tests/e2e/helpers/signForm.ts
 *
 * API-level helper to sign a specific form document for a specific signer.
 * Used to drive the signing flow without browser interaction for non-HOH signers
 * and for API-level assertions in the package integrity spec.
 */

import { supabaseTestClient } from './supabaseTestClient';
import { readFileSync } from 'fs';
import { join } from 'path';

const SAMPLE_SIG_PATH = join(process.cwd(), 'tests', 'fixtures', 'sample-id.jpg');

export interface SignFormOptions {
  baseUrl: string;
  token: string;
  applicationId: string;
  formDocumentId: string;
  signerMemberId: string;
  signerName: string;
  ceremonyId: string;
  deviceOwner?: 'self' | 'hoh_device' | 'staff_assisted';
}

export async function signForm(opts: SignFormOptions): Promise<{ eventId: string }> {
  const sigBytes = readFileSync(SAMPLE_SIG_PATH);
  const sigPath = `pbv/${opts.applicationId}/test-sig-${opts.formDocumentId}-${opts.signerMemberId}-${Date.now()}.jpg`;

  const { error: uploadErr } = await supabaseTestClient.storage
    .from('pbv-signatures')
    .upload(sigPath, sigBytes, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    throw new Error(`signForm: sig upload failed: ${uploadErr.message}`);
  }

  const res = await fetch(`${opts.baseUrl}/api/t/${opts.token}/pbv-full-app/sign-form`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      form_document_id: opts.formDocumentId,
      signer_member_id: opts.signerMemberId,
      typed_name: opts.signerName,
      signature_image_path: sigPath,
      ceremony_id: opts.ceremonyId,
      consent_text_version: '2026-05-15-v1',
      device_owner: opts.deviceOwner ?? 'self',
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`signForm(${opts.formDocumentId}) failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  return { eventId: json.data?.event_id ?? json.data?.id ?? '' };
}

/**
 * Signs all forms for a given member in a single ceremony.
 * Returns the count of signed events.
 */
export async function signAllFormsForMember(
  baseUrl: string,
  token: string,
  applicationId: string,
  memberId: string,
  memberName: string,
  formDocumentIds: string[],
  deviceOwner: 'self' | 'hoh_device' = 'self'
): Promise<number> {
  const ceremonyId = crypto.randomUUID();
  let count = 0;
  for (const formDocumentId of formDocumentIds) {
    await signForm({
      baseUrl,
      token,
      applicationId,
      formDocumentId,
      signerMemberId: memberId,
      signerName: memberName,
      ceremonyId,
      deviceOwner,
    });
    count++;
  }
  return count;
}
