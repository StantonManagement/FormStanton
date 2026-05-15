/**
 * tests/e2e/helpers/triggerGenerateForms.ts
 *
 * Triggers the generate-forms API endpoint and waits until all
 * pbv_form_documents for the application reach status != 'pending_generation'.
 *
 * Returns the set of generated form documents.
 */

import { supabaseTestClient } from './supabaseTestClient';

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30_000;

export interface GeneratedFormDoc {
  id: string;
  form_id: string;
  language: string;
  status: string;
  unsigned_pdf_path: string | null;
  required_signer_member_ids: string[];
}

export async function triggerGenerateForms(
  baseUrl: string,
  token: string
): Promise<GeneratedFormDoc[]> {
  const res = await fetch(`${baseUrl}/api/t/${token}/pbv-full-app/generate-forms`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`triggerGenerateForms failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const applicationId: string = json.data?.application_id ?? json.application_id;
  if (!applicationId) {
    throw new Error('triggerGenerateForms: no application_id in response');
  }

  // Poll until all docs are out of pending_generation
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { data: docs } = await supabaseTestClient
      .from('pbv_form_documents')
      .select('id, form_id, language, status, unsigned_pdf_path, required_signer_member_ids')
      .eq('full_application_id', applicationId);

    const allDone = (docs ?? []).every((d) => d.status !== 'pending_generation');
    if (allDone && (docs ?? []).length > 0) {
      return docs as GeneratedFormDoc[];
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`triggerGenerateForms: timed out waiting for form generation`);
}
