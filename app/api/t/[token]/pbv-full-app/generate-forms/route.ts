/**
 * POST /api/t/[token]/pbv-full-app/generate-forms
 *
 * Idempotent form generation endpoint.
 * 1. Reads intake_data + household members.
 * 2. Evaluates pbv_form_templates (generation_enabled=TRUE).
 * 3. Applies conditional rules to decide which forms to generate.
 * 4. For each form, resolves field data → stamps PDF → uploads to Supabase Storage.
 * 5. Upserts pbv_form_documents rows.
 * 6. Returns list of generated forms.
 *
 * Safe to call multiple times — same intake_data → same stamped content.
 * Re-generation on data change: deletes existing unsigned PDF, re-stamps.
 *
 * Requires intake_status = 'complete' before generating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { getEnabledFormTemplates } from '@/lib/pbv/form-templates';
import { shouldGenerateForm, isKnownConditionalRule } from '@/lib/pbv/conditional-rules';
import { resolveFieldData } from '@/lib/pbv/form-generation/field-mapping';
import { stampForm } from '@/lib/pbv/form-generation/stamper';
import { getSourcePdf, sha256Hex } from '@/lib/pbv/form-generation/source-pdfs';
import { generateSummaryPdf } from '@/lib/pbv/summary-doc/generate-summary';
import { SUMMARY_TEMPLATE_VERSION } from '@/lib/pbv/summary-doc/content';
import type { IntakeData, HouseholdMember } from '@/lib/pbv/form-generation/field-mapping';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'generate-forms', async (app) => {
    // ── 1. Load application state ───────────────────────────────────────────
    const { data: fullApp, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, intake_data, intake_snapshot, intake_status, submission_language, preferred_language')
      .eq('id', app.id)
      .maybeSingle();

    if (appError) throw appError;
    if (!fullApp) return { body: { success: false, message: 'Application not found' }, status: 404 };

    if (fullApp.intake_status !== 'complete') {
      return {
        body: {
          success: false,
          message: 'Intake must be complete before generating forms',
          code: 'intake_not_complete',
        },
        status: 422,
      };
    }

    // F4: Read from snapshot; fall back to intake_data only for legacy rows pre-backfill
    const intakeData = ((fullApp.intake_snapshot ?? fullApp.intake_data) ?? {}) as IntakeData;

    // Derive submission language: preferred es→es, pt→es, en→en, default en
    const rawLang = fullApp.submission_language ?? fullApp.preferred_language ?? 'en';
    const language: 'en' | 'es' = rawLang === 'es' || rawLang === 'pt' ? 'es' : 'en';

    // ── 2. Load household members ────────────────────────────────────────────
    const { data: memberRows, error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, date_of_birth, age, relationship, ssn_last_four, annual_income, income_sources, employed, has_ssi, has_ss, has_pension, has_tanf, has_child_support, has_unemployment, has_self_employment, has_other_income, disability, student, citizenship_status, documented_income')
      .eq('full_application_id', fullApp.id)
      .order('slot', { ascending: true });

    if (membersError) throw membersError;
    const members = (memberRows ?? []) as HouseholdMember[];

    // ── 3. Load enabled form templates ──────────────────────────────────────
    const templates = await getEnabledFormTemplates();

    // ── 4. Generate forms ────────────────────────────────────────────────────
    const generated: Array<{
      form_id: string;
      form_document_id: string;
      status: string;
      language: string;
    }> = [];

    const skipped: Array<{
      form_id: string;
      language?: string;
      reason:
        | 'source_pdf_missing'
        | 'field_map_missing'
        | 'conditional_skipped'
        | 'unknown_conditional_rule'  // PRD-63: rule string not handled by shouldGenerateForm
        | 'resolver_missing';          // PRD-63: form_id has no field-data resolver
    }> = [];

    for (const template of templates) {
      // PRD-63 (audit #7): distinguish "rule unknown" (fail-closed skip) from
      // "rule known, evaluated false" (intentional conditional skip).
      const ruleKnown = isKnownConditionalRule(template.conditional_rule);
      if (!ruleKnown) {
        console.error(
          `[generate-forms] Unknown conditional_rule "${template.conditional_rule}" on template "${template.form_id}" — failing closed (skipping)`
        );
        skipped.push({ form_id: template.form_id, reason: 'unknown_conditional_rule' });
        continue;
      }

      // Evaluate conditional rule
      const shouldGenerate = shouldGenerateForm(
        template.conditional_rule,
        intakeData,
        members
      );

      if (!shouldGenerate) {
        skipped.push({ form_id: template.form_id, reason: 'conditional_skipped' });
        continue;
      }

      // F4: For each_adult/individual scopes, emit ONE row per (form_id, language)
      // with ALL adult IDs as required signers. For other scopes, loop per slot.
      const isPerPersonAllAdults = template.per_person_scope === 'each_adult' || template.per_person_scope === 'individual';
      const signerSlots = getSignerSlots(template.per_person_scope, members);

      // For each_adult/individual: process once with all adult IDs
      // For other scopes: loop per signer slot
      const iterations = isPerPersonAllAdults ? [{ slot: 1, allAdultIds: true }] : signerSlots.map(slot => ({ slot, allAdultIds: false }));

      for (const iter of iterations) {
        const formId = template.form_id;
        const sourcePdf = getSourcePdf(formId, language);

        if (!sourcePdf) {
          console.warn(`[generate-forms] Source PDF missing for ${formId}/${language} — skipping`);
          skipped.push({ form_id: formId, language, reason: 'source_pdf_missing' });
          continue;
        }

        // Resolve field data (for per-person scopes, includes all members via row_patterns).
        // PRD-63 (audit #14): resolveFieldData throws `resolver_missing:<formId>`
        // when the form_id has no registered resolver. Catch it and skip the
        // form rather than stamping a generic name+date PDF.
        let fieldData;
        try {
          fieldData = resolveFieldData(formId, intakeData, members, language, iter.slot);
        } catch (e: any) {
          if (typeof e?.message === 'string' && e.message.startsWith('resolver_missing:')) {
            console.error(`[generate-forms] No field-data resolver for ${formId}/${language} — skipping (PRD-63 fail-closed)`);
            skipped.push({ form_id: formId, language, reason: 'resolver_missing' });
            continue;
          }
          throw e;
        }

        // Load field map JSON
        const fieldMap = await loadFieldMap(formId, language);
        if (!fieldMap) {
          console.warn(`[generate-forms] Field map missing for ${formId}/${language} — skipping`);
          skipped.push({ form_id: formId, language, reason: 'field_map_missing' });
          continue;
        }

        // Stamp the PDF
        const stampedPdf = await stampForm({
          fieldMap,
          data: fieldData,
          sourcePdfBytes: sourcePdf,
        });

        // PRD-66 (audit #5): decide generation_version + versioned unsigned path
        // before uploading, so a regenerate during a partially-signed ceremony
        // produces a NEW object instead of clobbering bytes a prior signer
        // already hashed.
        //
        // - No row yet               -> generation_version=1, upsert:true (first write)
        // - Row exists, 0 signers    -> keep existing version, upsert:true (safe to
        //                               overwrite — no signer has committed)
        // - Row exists, >=1 signers  -> bump to existing+1, upsert:false (brand-new
        //                               versioned path; collision is a real bug)
        const { data: existingDoc } = await supabaseAdmin
          .from('pbv_form_documents')
          .select('generation_version, collected_signer_member_ids')
          .eq('full_application_id', fullApp.id)
          .eq('form_id', formId)
          .eq('language', language)
          .maybeSingle();

        const existingVersion = (existingDoc?.generation_version as number | null) ?? null;
        const collectedSignerCount = (existingDoc?.collected_signer_member_ids?.length ?? 0) as number;

        // PRD-76 #4: first-generation race hardening.
        //
        // PRD-66 covered the >=1 signer case (bump + upsert:false). The
        // remaining exposure is the zero-prior-version case — two concurrent
        // first-gen requests both read existingVersion=null, both pick v1, and
        // with upsert:true the second silently overwrites the first's bytes.
        // A signer who already hashed the first PDF would mismatch the stored
        // (overwritten) bytes at finalize Check 5.
        //
        // Hardening: use upsert:false on the first-gen path too. On a
        // "exists" / "409" / "duplicate" storage error, re-read the doc row;
        // if a row now exists with the same version, treat this as
        // "another request generated v1 first" and reuse that path (no
        // overwrite, no throw — same shape as PRD-66's signed-PDF benign
        // replay handling in completeForm.ts:254-260).
        //
        // The zero-signer reuse case (existing row, 0 signers) keeps
        // upsert:true: the existing row's bytes are not yet committed-to by
        // any signer, and re-stamping with the same fieldData produces the
        // same content. This preserves PRD-66's no-bump rule.
        let generationVersion: number;
        let upsertOnUpload: boolean;
        if (existingVersion === null) {
          generationVersion = 1;
          upsertOnUpload = false;
        } else if (collectedSignerCount === 0) {
          generationVersion = existingVersion;
          upsertOnUpload = true;
        } else {
          generationVersion = existingVersion + 1;
          upsertOnUpload = false;
        }

        const storagePath = `pbv/${fullApp.id}/forms/${formId}-${language}-v${generationVersion}.pdf`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('pbv-forms')
          .upload(storagePath, stampedPdf, {
            contentType: 'application/pdf',
            upsert: upsertOnUpload,
          });

        if (uploadError) {
          const msg = String(uploadError.message ?? '').toLowerCase();
          const status = String((uploadError as any).statusCode ?? '');
          const benignFirstGenCollision =
            existingVersion === null &&
            (status === '409' || msg.includes('exist') || msg.includes('duplicate'));

          if (benignFirstGenCollision) {
            // Another concurrent first-gen request landed v1 first. Re-read
            // the winning row and surface it in the response. Do NOT upsert:
            // overwriting the row with this loser's hash would desync it
            // from the bytes actually stored (the stamper may not be byte-
            // deterministic across processes/time).
            console.log(
              `[generate-forms] First-gen collision for ${formId}/${language} v1 — reusing the row written by the concurrent request.`
            );
            const { data: winnerRow } = await supabaseAdmin
              .from('pbv_form_documents')
              .select('id, generation_version, unsigned_pdf_path')
              .eq('full_application_id', fullApp.id)
              .eq('form_id', formId)
              .eq('language', language)
              .maybeSingle();
            if (winnerRow?.id) {
              generated.push({
                form_id: formId,
                form_document_id: winnerRow.id,
                status: 'generated',
                language,
              });
            }
            // Skip the upsert below for this iteration.
            if (isPerPersonAllAdults) break;
            continue;
          }

          console.error(
            `[generate-forms] Storage upload failed for ${formId} (v${generationVersion}):`,
            uploadError
          );
          throw uploadError;
        }

        // F4: For each_adult/individual, required signers = ALL adult member IDs
        // For other scopes, use the specific slot
        const requiredSignerIds = iter.allAdultIds
          ? members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.id).filter(Boolean) as string[]
          : getRequiredSignerIds(template.per_person_scope, members, iter.slot);

        // Compute source hash (template) + unsigned hash (stamped bytes the
        // signer will hash at sign time — PRD-62 Check 5).
        const sourceHash = sha256Hex(sourcePdf);
        const unsignedHash = sha256Hex(stampedPdf);

        // Upsert pbv_form_documents row
        const { data: docRow, error: upsertError } = await supabaseAdmin
          .from('pbv_form_documents')
          .upsert(
            {
              full_application_id: fullApp.id,
              form_id: formId,
              language,
              status: 'generated',
              unsigned_pdf_path: storagePath,
              signed_pdf_path: null,
              field_data_snapshot: fieldData,
              source_pdf_hash: sourceHash,
              unsigned_pdf_hash: unsignedHash,
              generation_version: generationVersion,
              field_map_version: fieldMap.field_map_version ?? '1',
              generated_at: new Date().toISOString(),
              required_signer_member_ids: requiredSignerIds,
              collected_signer_member_ids: [],
              conditional_trigger: template.conditional_rule ?? null,
              feature_flag_key: formId,
              created_by: 'system',
            },
            { onConflict: 'full_application_id,form_id,language' }
          )
          .select('id')
          .maybeSingle();

        if (upsertError) throw upsertError;

        if (docRow) {
          generated.push({
            form_id: formId,
            form_document_id: docRow.id,
            status: 'generated',
            language,
          });
        }

        // F4: For each_adult/individual, only process once (not per slot)
        if (isPerPersonAllAdults) break;
      }
    }

    // ── 5. Generate summary document ────────────────────────────────────────
    const preferredLang = (fullApp.preferred_language ?? 'en') as 'en' | 'es' | 'pt';
    const summaryLang: 'en' | 'es' | 'pt' =
      preferredLang === 'pt' ? 'pt' : preferredLang === 'es' ? 'es' : 'en';

    let summaryGenerated = false;
    let summaryError: string | null = null;

    try {
      const hoh = members.find((m) => m.slot === 1);
      const hohName = hoh?.name ?? '';

      // Load upload requirements for this application
      const { data: docReqs } = await supabaseAdmin
        .from('pbv_document_requirements')
        .select('category_key, label')
        .eq('full_application_id', fullApp.id)
        .order('display_order', { ascending: true })
        .limit(20);

      const uploads = (docReqs ?? []).map((r: any) => ({
        category_key: r.category_key as string,
        label: r.label as string | undefined,
      }));

      const formEntries = generated.map((g) => ({
        form_id: g.form_id,
        display_name: g.form_id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      }));

      const summaryPdfBytes = await generateSummaryPdf({
        hohName,
        applicationId: fullApp.id,
        language: summaryLang,
        submissionLanguage: language,
        forms: formEntries,
        uploads,
        generatedAt: new Date(),
      });

      // PRD-83 #A11: version the summary path with SUMMARY_TEMPLATE_VERSION
      // and switch to upsert:false. Pre-PRD-83 the path was a fixed
      // `summary-${lang}-unsigned.pdf` written with upsert:true, so two
      // concurrent generate-forms calls silently clobbered each other's
      // summary (`generateSummaryPdf` embeds a per-call `generatedAt`, so
      // the bytes differ even when the template version is identical).
      //
      // With the version suffix, different template versions cannot collide.
      // For the same template version, upsert:false surfaces concurrent
      // writes as a 409 — which we treat as a benign replay: the other
      // request's summary is already at this path; we reuse it without
      // overwriting. Same shape as PRD-66/PRD-76's signed-PDF benign-replay
      // handling in completeForm.ts and generate-forms' form-document loop.
      const summaryStoragePath = `pbv/${fullApp.id}/summary-${summaryLang}-v${SUMMARY_TEMPLATE_VERSION}-unsigned.pdf`;

      const { error: summaryUploadError } = await supabaseAdmin.storage
        .from('pbv-forms')
        .upload(summaryStoragePath, summaryPdfBytes, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (summaryUploadError) {
        const msg = String(summaryUploadError.message ?? '').toLowerCase();
        const status = String((summaryUploadError as any).statusCode ?? '');
        const benignReplay = status === '409' || msg.includes('exist') || msg.includes('duplicate');

        if (!benignReplay) {
          throw summaryUploadError;
        }
        // Fall through: another concurrent generate-forms request landed
        // this summary version first. Reuse the existing object at the
        // same path; the upsert below points the pbv_summary_documents
        // row at it.
        console.log(
          JSON.stringify({
            event: 'generate_forms_summary_benign_replay',
            app_id: fullApp.id,
            language: summaryLang,
            template_version: SUMMARY_TEMPLATE_VERSION,
          })
        );
      }

      // Idempotent upsert into pbv_summary_documents
      const { error: summaryUpsertError } = await supabaseAdmin
        .from('pbv_summary_documents')
        .upsert(
          {
            full_application_id: fullApp.id,
            language: summaryLang,
            template_version: SUMMARY_TEMPLATE_VERSION,
            pdf_storage_path: summaryStoragePath,
            created_by: 'system',
          },
          { onConflict: 'full_application_id' }
        );

      if (summaryUpsertError) throw summaryUpsertError;

      summaryGenerated = true;
    } catch (err: any) {
      // Summary generation failure is non-fatal: federal forms are still returned.
      // Log and include in response for observability.
      console.error('[generate-forms] Summary doc generation failed:', err);
      summaryError = err.message ?? 'Summary generation failed';
    }

    return {
      body: {
        success: true,
        data: {
          generated,
          skipped,
          total_generated: generated.length,
          language,
          summary: {
            generated: summaryGenerated,
            language: summaryLang,
            template_version: SUMMARY_TEMPLATE_VERSION,
            error: summaryError,
          },
        },
      },
      status: 200,
    };
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSignerSlots(
  perPersonScope: string,
  members: HouseholdMember[]
): number[] {
  switch (perPersonScope) {
    case 'submission_level':
      return [1];
    case 'head_of_household_only':
      return [1];
    case 'each_adult':
      return members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.slot);
    case 'each_member':
      return members.map((m) => m.slot);
    case 'individual':
      return members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.slot);
    default:
      return [1];
  }
}

function getRequiredSignerIds(
  perPersonScope: string,
  members: HouseholdMember[],
  signerSlot: number
): string[] {
  if (perPersonScope === 'submission_level' || perPersonScope === 'head_of_household_only') {
    const hoh = members.find((m) => m.slot === 1);
    return hoh?.id ? [hoh.id] : [];
  }
  if (perPersonScope === 'each_adult' || perPersonScope === 'individual') {
    const member = members.find((m) => m.slot === signerSlot);
    return member?.id ? [member.id] : [];
  }
  return [];
}

async function loadFieldMap(formId: string, language: 'en' | 'es'): Promise<any | null> {
  const { readFileSync, existsSync } = require('fs');
  const { join } = require('path');

  const slug = formId.replace(/_/g, '-');
  const path = join(process.cwd(), 'scripts', 'field-maps', `${slug}-${language}.json`);

  if (!existsSync(path)) return null;

  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}
