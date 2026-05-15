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
import { shouldGenerateForm } from '@/lib/pbv/conditional-rules';
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
      .select('id, intake_data, intake_status, submission_language, preferred_language')
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

    const intakeData = (fullApp.intake_data ?? {}) as IntakeData;

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

    const skipped: string[] = [];

    for (const template of templates) {
      // Evaluate conditional rule
      const shouldGenerate = shouldGenerateForm(
        template.conditional_rule,
        intakeData,
        members
      );

      if (!shouldGenerate) {
        skipped.push(template.form_id);
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
          skipped.push(`${formId}/${language}`);
          continue;
        }

        // Resolve field data (for per-person scopes, includes all members via row_patterns)
        const fieldData = resolveFieldData(formId, intakeData, members, language, iter.slot);

        // Load field map JSON
        const fieldMap = await loadFieldMap(formId, language);
        if (!fieldMap) {
          console.warn(`[generate-forms] Field map missing for ${formId}/${language} — skipping`);
          skipped.push(`${formId}/${language}`);
          continue;
        }

        // Stamp the PDF
        const stampedPdf = await stampForm({
          fieldMap,
          data: fieldData,
          sourcePdfBytes: sourcePdf,
        });

        // Upload to Storage
        const storagePath = `pbv/${fullApp.id}/forms/${formId}-${language}-unsigned.pdf`;
        const { error: uploadError } = await supabaseAdmin.storage
          .from('pbv-forms')
          .upload(storagePath, stampedPdf, {
            contentType: 'application/pdf',
            upsert: true,
          });

        if (uploadError) {
          console.error(`[generate-forms] Storage upload failed for ${formId}:`, uploadError);
          throw uploadError;
        }

        // F4: For each_adult/individual, required signers = ALL adult member IDs
        // For other scopes, use the specific slot
        const requiredSignerIds = iter.allAdultIds
          ? members.filter((m) => (m.age ?? 0) >= 18).map((m) => m.id).filter(Boolean) as string[]
          : getRequiredSignerIds(template.per_person_scope, members, iter.slot);

        // Compute source hash
        const sourceHash = sha256Hex(sourcePdf);

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

      const summaryStoragePath = `pbv/${fullApp.id}/summary-${summaryLang}-unsigned.pdf`;

      const { error: summaryUploadError } = await supabaseAdmin.storage
        .from('pbv-forms')
        .upload(summaryStoragePath, summaryPdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        });

      if (summaryUploadError) throw summaryUploadError;

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
