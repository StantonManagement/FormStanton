/**
 * tests/e2e/helpers/signSummary.ts
 *
 * API-level helper to sign the summary document for a given application.
 * Uploads a test signature image to storage then calls sign-summary.
 */

import { supabaseTestClient } from './supabaseTestClient';
import { readFileSync } from 'fs';
import { join } from 'path';

const SAMPLE_SIG_PATH = join(process.cwd(), 'tests', 'fixtures', 'sample-id.jpg');

export async function signSummary(
  baseUrl: string,
  token: string,
  applicationId: string,
  signerName: string,
  language: 'en' | 'es' | 'pt' = 'pt'
): Promise<{ summaryDocumentId: string; signedAt: string }> {
  // Upload signature image to pbv-signatures bucket
  const sigBytes = readFileSync(SAMPLE_SIG_PATH);
  const sigPath = `pbv/${applicationId}/test-sig-summary-${Date.now()}.jpg`;

  const { error: uploadErr } = await supabaseTestClient.storage
    .from('pbv-signatures')
    .upload(sigPath, sigBytes, { contentType: 'image/jpeg', upsert: true });

  if (uploadErr) {
    throw new Error(`signSummary: signature upload failed: ${uploadErr.message}`);
  }

  const ceremonyId = crypto.randomUUID();

  const res = await fetch(`${baseUrl}/api/t/${token}/pbv-full-app/sign-summary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      typed_name: signerName,
      signature_image_path: sigPath,
      ceremony_id: ceremonyId,
      consent_text_version: '2026-05-15-v1',
      template_version: '1.0.0',
      language,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`signSummary failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  return {
    summaryDocumentId: json.data?.summary_document_id ?? '',
    signedAt: json.data?.signed_at ?? '',
  };
}
