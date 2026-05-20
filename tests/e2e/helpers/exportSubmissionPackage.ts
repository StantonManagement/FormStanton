/**
 * tests/e2e/helpers/exportSubmissionPackage.ts
 *
 * Exports the final submission package for an application:
 *   - Fetches all pbv_form_documents (signed PDFs)
 *   - Fetches the pbv_summary_documents row
 *   - Fetches all pbv_signature_events (audit trail)
 *   - Writes files to tests/snapshots/pbv-form-execution-maria-package/ (gitignored)
 *   - Returns a stable hash of the package shape for snapshot assertion
 *
 * The hash is based on:
 *   - form_ids present (sorted)
 *   - signer counts per form
 *   - device_owner distribution
 *   - language flag on summary doc
 *   - presence/absence of source-pending forms
 *
 * Full PDFs are NOT committed. The hash IS committed in the spec file.
 */

import { supabaseTestClient } from './supabaseTestClient';
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const SNAPSHOT_DIR = join(process.cwd(), 'tests', 'snapshots', 'pbv-form-execution-maria-package');

export interface SubmissionPackage {
  applicationId: string;
  formDocuments: FormDocSummary[];
  summaryDocument: SummaryDocSummary | null;
  signatureEvents: SignatureEventSummary[];
  packageHash: string;
}

export interface FormDocSummary {
  id: string;
  form_id: string;
  language: string;
  status: string;
  signed_pdf_path: string | null;
  signer_count: number;
}

export interface SummaryDocSummary {
  id: string;
  language: string;
  signed_at: string | null;
  template_version: string;
}

export interface SignatureEventSummary {
  id: string;
  form_document_id: string;
  signer_member_id: string;
  device_owner: string;
  ceremony_id: string;
  document_hash: string;
  assisted_by_staff_user_id: string | null;
}

export async function exportSubmissionPackage(applicationId: string): Promise<SubmissionPackage> {
  const [formDocsRes, summaryDocsRes, sigEventsRes] = await Promise.all([
    supabaseTestClient
      .from('pbv_form_documents')
      .select('id, form_id, language, status, signed_pdf_path, required_signer_member_ids')
      .eq('full_application_id', applicationId),

    supabaseTestClient
      .from('pbv_summary_documents')
      .select('id, language, signed_at, template_version')
      .eq('full_application_id', applicationId)
      .maybeSingle(),

    supabaseTestClient
      .from('pbv_signature_events')
      .select('id, form_document_id, signer_member_id, device_owner, ceremony_id, document_hash, assisted_by_staff_user_id')
      .in(
        'form_document_id',
        // Will be overridden below after form docs are fetched
        ['00000000-0000-0000-0000-000000000000']
      ),
  ]);

  const formDocs = (formDocsRes.data ?? []) as any[];
  const summaryDoc = summaryDocsRes.data as any;

  // Re-fetch signature events with the actual form_document_ids
  const formDocIds = formDocs.map((d) => d.id);
  let signatureEvents: any[] = [];
  if (formDocIds.length > 0) {
    const { data: evts } = await supabaseTestClient
      .from('pbv_signature_events')
      .select('id, form_document_id, signer_member_id, device_owner, ceremony_id, document_hash, assisted_by_staff_user_id')
      .in('form_document_id', formDocIds);
    signatureEvents = evts ?? [];
  }

  // Build signer_count per form doc
  const sigCountByDoc: Record<string, number> = {};
  for (const evt of signatureEvents) {
    sigCountByDoc[evt.form_document_id] = (sigCountByDoc[evt.form_document_id] ?? 0) + 1;
  }

  const formDocSummaries: FormDocSummary[] = formDocs.map((d) => ({
    id: d.id,
    form_id: d.form_id,
    language: d.language,
    status: d.status,
    signed_pdf_path: d.signed_pdf_path ?? null,
    signer_count: sigCountByDoc[d.id] ?? 0,
  }));

  const summaryDocSummary: SummaryDocSummary | null = summaryDoc
    ? {
        id: summaryDoc.id,
        language: summaryDoc.language,
        signed_at: summaryDoc.signed_at,
        template_version: summaryDoc.template_version,
      }
    : null;

  const sigEventSummaries: SignatureEventSummary[] = signatureEvents.map((e) => ({
    id: e.id,
    form_document_id: e.form_document_id,
    signer_member_id: e.signer_member_id,
    device_owner: e.device_owner,
    ceremony_id: e.ceremony_id,
    document_hash: e.document_hash,
    assisted_by_staff_user_id: e.assisted_by_staff_user_id ?? null,
  }));

  // Compute stable hash
  const hashInput = {
    form_ids: [...formDocSummaries.map((d) => d.form_id)].sort(),
    form_count: formDocSummaries.length,
    signature_event_count: sigEventSummaries.length,
    summary_language: summaryDocSummary?.language ?? null,
    summary_signed: !!summaryDocSummary?.signed_at,
    device_owner_distribution: Object.fromEntries(
      (['self', 'hoh_device', 'staff_assisted'] as const).map((owner) => [
        owner,
        sigEventSummaries.filter((e) => e.device_owner === owner).length,
      ])
    ),
  };

  const packageHash = createHash('sha256')
    .update(JSON.stringify(hashInput))
    .digest('hex')
    .slice(0, 16);

  // Write snapshot files (gitignored directory)
  try {
    mkdirSync(SNAPSHOT_DIR, { recursive: true });
    writeFileSync(
      join(SNAPSHOT_DIR, 'audit-trail.json'),
      JSON.stringify({ formDocSummaries, summaryDocSummary, sigEventSummaries, packageHash }, null, 2)
    );
    writeFileSync(join(SNAPSHOT_DIR, 'package-hash.txt'), packageHash);
  } catch {
    // Non-fatal — snapshot write failures don't fail the test
  }

  return {
    applicationId,
    formDocuments: formDocSummaries,
    summaryDocument: summaryDocSummary,
    signatureEvents: sigEventSummaries,
    packageHash,
  };
}
