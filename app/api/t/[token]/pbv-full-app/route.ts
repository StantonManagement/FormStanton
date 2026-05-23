import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { encryptSsn, ssnLastFour } from '@/lib/ssnEncryption';
import { getApplicableMembers } from '@/lib/memberFilter';
import { parsePhoneToE164 } from '@/lib/phoneParser';
import { recomputeApplicationDocSummary } from '@/lib/recomputeApplicationDocs';
import { validateReadyToFinalize } from '@/lib/pbv/finalizeValidation';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { computeAge } from '@/lib/pbv/age';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, building_address, unit_number, preapp_id, phone, preferred_language, language_confirmed_at, submitted_at, head_of_household_name, intake_status, signing_status, submission_language, intake_data, intake_snapshot, intake_snapshot_at, resume_section, application_review_status, application_review_status_at, application_review_status_note')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;

    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Check if intake already submitted (household members exist)
    const { count } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id', { count: 'exact', head: true })
      .eq('full_application_id', app.id);

    const intake_submitted = (count ?? 0) > 0;

    // Fetch HOH member ID (slot=1) for summary signing flow
    const { data: hohMember } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id')
      .eq('full_application_id', app.id)
      .eq('slot', 1)
      .maybeSingle();

    const hoh_member_id = hohMember?.id ?? null;

    // Language: use confirmed value from pbv_full_applications if set, else fall back to preapp
    let preferred_language: string = app.preferred_language ?? 'en';
    if (!app.preferred_language && app.preapp_id) {
      const { data: preapp } = await supabaseAdmin
        .from('pbv_preapplications')
        .select('language')
        .eq('id', app.preapp_id)
        .maybeSingle();
      if (preapp?.language) preferred_language = preapp.language;
    }

    // Phone hint from tenant_lookup (AppFolio sync source)
    let phone_hint: string | null = null;
    if (app.phone) {
      phone_hint = app.phone;
    } else {
      const { data: tlRow } = await supabaseAdmin
        .from('tenant_lookup')
        .select('phone')
        .eq('building_address', app.building_address)
        .eq('unit_number', app.unit_number)
        .eq('is_current', true)
        .maybeSingle();
      if (tlRow?.phone) {
        const parsed = parsePhoneToE164(tlRow.phone);
        if (parsed) phone_hint = parsed;
      }
    }

    // Document summary from application_documents
    let document_summary: Record<string, number> | null = null;
    let rejected_documents_count = 0;
    if (intake_submitted) {
      document_summary = await recomputeApplicationDocSummary(app.id) as unknown as Record<string, number>;
      
      // Count rejected documents for action_required status
      const { count: rejectedCount } = await supabaseAdmin
        .from('application_documents')
        .select('id', { count: 'exact', head: true })
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .eq('status', 'rejected');
      rejected_documents_count = rejectedCount ?? 0;
    }

    const signature_progress: Array<{
      member_id: string;
      slot: number;
      name: string;
      required_doc_count: number;
      signed_doc_count: number;
    }> = [];

    // Signatures complete check — all required signature docs are signed/submitted per signer scope
    let signatures_complete = false;
    if (intake_submitted) {
      const { data: sigMembers } = await supabaseAdmin
        .from('pbv_household_members')
        .select('id, slot, name, signature_required')
        .eq('full_application_id', app.id)
        .eq('signature_required', true);

      const { data: signatureDocs } = await supabaseAdmin
        .from('application_documents')
        .select('id, person_slot, signer_scope, status, requires_signature')
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .eq('requires_signature', true);

      const isSignedStatus = (status: string): boolean =>
        status === 'submitted' || status === 'approved' || status === 'waived';

      const docsForMember = (slot: number) =>
        (signatureDocs ?? []).filter((doc) => {
          if (doc.signer_scope === 'all_adults') {
            return doc.person_slot === slot;
          }
          if (doc.signer_scope === 'hoh_only') {
            return slot === 1 && doc.person_slot === 0;
          }
          if (doc.signer_scope === 'individual') {
            return doc.person_slot === slot || (slot === 1 && doc.person_slot === 0);
          }
          return doc.person_slot === slot;
        });

      if (sigMembers && sigMembers.length > 0) {
        for (const member of sigMembers) {
          const requiredDocs = docsForMember(member.slot);
          const signedCount = requiredDocs.filter((d) => isSignedStatus(d.status)).length;

          signature_progress.push({
            member_id: member.id,
            slot: member.slot,
            name: member.name,
            required_doc_count: requiredDocs.length,
            signed_doc_count: signedCount,
          });
        }

        signatures_complete = signature_progress.every(
          (m) => m.required_doc_count === 0 || m.signed_doc_count >= m.required_doc_count
        );
      } else {
        signatures_complete = true;
      }
    }

    // Use shared helper to determine if ready for finalize (complete)
    const finalizeCheck = intake_submitted ? await validateReadyToFinalize(app.id) : { ready: false, missing: { documents: [], signatures: [] } };

    const next_step = !intake_submitted
      ? 'intake'
      : !signatures_complete
      ? 'signatures'
      : ((document_summary?.missing ?? 0) + (document_summary?.rejected ?? 0) > 0)
      ? 'documents'
      : finalizeCheck.ready
      ? 'complete'
      : 'documents';

    // Fetch preapp household data for pre-population (if linked and intake not yet submitted)
    let preapp_household_data: {
      hoh_name?: string;
      hoh_dob?: string;
      household_members?: Array<{
        name: string;
        dob: string;
        relationship: string;
        income_sources: string[];
        annual_income: number;
      }>;
    } | null = null;

    if (!intake_submitted && app.preapp_id) {
      const { data: preapp } = await supabaseAdmin
        .from('pbv_preapplications')
        .select('hoh_name, hoh_dob, household_members')
        .eq('id', app.preapp_id)
        .maybeSingle();

      if (preapp) {
        preapp_household_data = {
          hoh_name: preapp.hoh_name,
          hoh_dob: preapp.hoh_dob,
          household_members: Array.isArray(preapp.household_members) ? preapp.household_members : [],
        };
      }
    }

    // PRD-20: Full document list for already_submitted screen
    let documents: Array<{
      id: string;
      doc_type: string;
      label: string;
      person_slot: number;
      person_name?: string;
      status: string;
      category?: string;
      display_order: number;
    }> = [];

    if (intake_submitted) {
      const { data: docs } = await supabaseAdmin
        .from('application_documents')
        .select('id, doc_type, label, person_slot, status, category, display_order, person_name')
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .order('display_order', { ascending: true })
        .order('person_slot', { ascending: true });

      if (docs) {
        documents = docs.map(d => ({
          id: d.id,
          doc_type: d.doc_type,
          label: d.label,
          person_slot: d.person_slot,
          person_name: d.person_name ?? undefined,
          status: d.status,
          category: d.category ?? undefined,
          display_order: d.display_order,
        }));
      }
    }

    // PRD-20: Completed signatures with signer attribution
    let signatures: Array<{
      id: string;
      document_id: string;
      signer_name: string;
      signed_at: string;
      document_label: string;
    }> = [];

    if (intake_submitted) {
      const { data: sigs } = await supabaseAdmin
        .from('pbv_signature_audit_log')
        .select('id, document_id, signer_name, signed_at, document_id!inner(label)')
        .eq('application_id', app.id)
        .order('signed_at', { ascending: true });

      if (sigs) {
        signatures = sigs.map((s: any) => ({
          id: s.id,
          document_id: s.document_id,
          signer_name: s.signer_name,
          signed_at: s.signed_at,
          document_label: s.document_id?.label ?? 'Unknown Document',
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        building_address: app.building_address,
        unit_number: app.unit_number,
        preferred_language,
        language_confirmed_at: app.language_confirmed_at ?? null,
        phone_hint,
        intake_submitted,
        signatures_complete,
        signature_progress,
        document_summary,
        next_step,
        submitted_at: app.submitted_at,
        preapp_household_data,
        // PRD-20: Additional fields for already_submitted screen
        head_of_household_name: app.head_of_household_name,
        documents,
        signatures,
        // PRD-26/31: Fields needed by dashboard and dispatcher
        intake_status: app.intake_status ?? null,
        signing_status: app.signing_status ?? null,
        submission_language: app.submission_language ?? null,
        hoh_member_id,
        // F3: Return snapshot when complete, workspace when in-progress
        intake_data: (app.intake_status === 'complete' ? app.intake_snapshot : app.intake_data) ?? {},
        intake_snapshot_at: app.intake_snapshot_at ?? null,
        resume_section: app.resume_section ?? null,
        // PRD-36: Application review status fields
        application_review_status: app.application_review_status ?? null,
        application_review_status_at: app.application_review_status_at ?? null,
        application_review_status_note: app.application_review_status_note ?? null,
        rejected_documents_count: rejected_documents_count,
      },
    });
  } catch (error: any) {
    console.error('PBV full-app GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  return withTenantContext(
    request,
    token,
    'intake',
    async (app) => {
      try {
    // Duplicate submission guard
    const { count: existingCount } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id', { count: 'exact', head: true })
      .eq('full_application_id', app.id);

    if ((existingCount ?? 0) > 0) {
      return { body: { success: false, message: 'Application intake already submitted' }, status: 409 };
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return { body: { success: false, message: 'Invalid request body' }, status: 400 };
    }

    const {
      hoh_name,
      hoh_dob,
      household_members,
      phone,
      preferred_language,
      has_insurance_settlement = false,
      has_cd_trust_bond = false,
      has_life_insurance = false,
      claiming_medical_deduction = false,
      has_childcare_expense = false,
      dv_status = false,
      homeless_at_admission = false,
      reasonable_accommodation_requested = false,
    } = body;

    if (!hoh_name?.trim()) {
      return { body: { success: false, message: 'Head of household name is required' }, status: 400 };
    }
    if (!hoh_dob) {
      return { body: { success: false, message: 'Head of household date of birth is required' }, status: 400 };
    }
    if (!Array.isArray(household_members) || household_members.length === 0) {
      return { body: { success: false, message: 'At least one household member is required' }, status: 400 };
    }

    for (let i = 0; i < household_members.length; i++) {
      const m = household_members[i];
      if (!m.name?.trim()) {
        return { body: { success: false, message: `Member ${i + 1}: name is required` }, status: 400 };
      }
      if (!m.dob) {
        return { body: { success: false, message: `Member ${i + 1}: date of birth is required` }, status: 400 };
      }
      if (i === 0 && !m.relationship) {
        return { body: { success: false, message: 'Head of household relationship is required' }, status: 400 };
      }
      if (i > 0 && !m.relationship) {
        return { body: { success: false, message: `Member ${i + 1}: relationship is required` }, status: 400 };
      }
    }

    // Process and insert household members
    const memberRows: object[] = [];
    const memberDataForFormData: object[] = [];

    for (let i = 0; i < household_members.length; i++) {
      const m = household_members[i];
      const slot = i + 1;
      const age = computeAge(m.dob);
      const signature_required = !m.is_minor && age !== null && age >= 18;

      // Encrypt SSN if provided (never log the plaintext)
      let ssn_encrypted: string | null = null;
      let ssn_last_four: string | null = null;
      if (m.ssn?.replace(/\D/g, '').length >= 4) {
        ssn_encrypted = encryptSsn(m.ssn.trim());
        ssn_last_four = ssnLastFour(m.ssn.trim());
      }

      // Derive boolean income flags from income_sources array
      const sources: string[] = Array.isArray(m.income_sources) ? m.income_sources : [];
      const employed          = sources.includes('employment');
      const has_ssi           = sources.includes('ssi');
      const has_ss            = sources.includes('ss');
      const has_pension       = sources.includes('pension');
      const has_tanf          = sources.includes('tanf');
      const has_child_support = sources.includes('child_support');
      const has_unemployment  = sources.includes('unemployment');
      const has_self_employment = sources.includes('self_employment');
      const has_other_income  = sources.includes('other');

      memberRows.push({
        full_application_id: app.id,
        slot,
        name: m.name.trim(),
        date_of_birth: m.dob,
        age,
        relationship: i === 0 ? 'head' : (m.relationship || 'other'),
        ssn_encrypted,
        ssn_last_four,
        annual_income: typeof m.annual_income === 'number' ? m.annual_income : 0,
        income_sources: sources,
        employed,
        has_ssi,
        has_ss,
        has_pension,
        has_tanf,
        has_child_support,
        has_unemployment,
        has_self_employment,
        has_other_income,
        disability: m.disability === true,
        student: m.student === true,
        citizenship_status: m.citizenship_status || 'not_reported',
        criminal_history: typeof m.criminal_history === 'boolean' ? m.criminal_history : null,
        signature_required,
        created_by: 'tenant',
      });

      // Shape for form_data.household_members — used by memberFilter at Phase 5 seeding
      memberDataForFormData.push({
        slot,
        age,
        employed,
        has_ssi,
        has_ss,
        has_pension,
        has_tanf,
        has_child_support,
        has_unemployment,
        has_self_employment,
        has_other_income,
        citizenship_status: m.citizenship_status || 'not_reported',
      });
    }

    // Insert household members — DB unique index on (full_application_id, slot)
    // will reject a concurrent duplicate intake at the DB level.
    const { error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .insert(memberRows);

    if (membersError) throw membersError;

    const total_annual_income = (household_members as any[]).reduce(
      (sum: number, m: any) => sum + (typeof m.annual_income === 'number' ? m.annual_income : 0),
      0
    );

    const validLang = ['en', 'es', 'pt'].includes(preferred_language ?? '') ? preferred_language : null;
    const cleanPhone = phone?.trim() || null;

    // Update application fields — intentionally NOT setting intake_submitted_at yet.
    // That timestamp is the commit point and is written only after docs are seeded.
    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        head_of_household_name: hoh_name.trim(),
        household_size: household_members.length,
        total_annual_income,
        dv_status: dv_status === true,
        homeless_at_admission: homeless_at_admission === true,
        claiming_medical_deduction: claiming_medical_deduction === true,
        has_childcare_expense: has_childcare_expense === true,
        reasonable_accommodation_requested: reasonable_accommodation_requested === true,
        phone: cleanPhone,
        preferred_language: validLang ?? null,
        language_confirmed_at: validLang ? new Date().toISOString() : null,
        ...(cleanPhone ? {
          sms_consent_captured_at: new Date().toISOString(),
          sms_consent_text_version: '2026-05-14-v1',
        } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', app.id);

    if (updateError) throw updateError;

    // Seed application_documents.
    // Failures here trigger a compensating rollback: delete the members we just
    // inserted so the application record stays clean and the tenant can retry.
    try {
      const anyMemberHasChildSupport = memberDataForFormData.some(
        (m: any) => m.has_child_support === true
      );

      const { data: templates, error: templatesError } = await supabaseAdmin
        .from('form_document_templates')
        .select('*')
        .eq('form_id', 'pbv-full-application')
        .order('display_order', { ascending: true });

      if (templatesError) throw templatesError;
      if (!templates || templates.length === 0) {
        throw new Error('No document templates found for pbv-full-application — cannot seed document slots.');
      }

      // Clear any stale slots before re-seeding
      const { error: deleteError } = await supabaseAdmin
        .from('application_documents')
        .delete()
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id);

      if (deleteError) throw deleteError;

      const docRows: object[] = [];
      for (const template of templates) {
        if (template.doc_type === 'vawa_certification' && dv_status !== true) continue;
        if (template.doc_type === 'reasonable_accommodation_request' && reasonable_accommodation_requested !== true) continue;
        if (template.doc_type === 'child_support_affidavit' && !anyMemberHasChildSupport) continue;
        if (template.doc_type === 'no_child_support_affidavit' && anyMemberHasChildSupport) continue;

        if (!template.per_person || template.applies_to === 'submission') {
          docRows.push({
            anchor_type: 'pbv_full_application',
            anchor_id: app.id,
            doc_type: template.doc_type,
            label: template.label,
            required: template.required,
            requires_signature: template.requires_signature === true,
            signer_scope: template.signer_scope ?? null,
            display_order: template.display_order,
            person_slot: 0,
            status: 'missing',
            created_by: 'system',
            category: template.category,
          });
        } else {
          const matched = getApplicableMembers(
            memberDataForFormData as any[],
            template.applies_to,
            template.member_filter
          );
          const slots = matched.length > 0 ? matched.map(({ slot }) => slot) : [0];
          for (const slot of slots) {
            docRows.push({
              anchor_type: 'pbv_full_application',
              anchor_id: app.id,
              doc_type: template.doc_type,
              label: template.label,
              required: template.required,
              requires_signature: template.requires_signature === true,
              signer_scope: template.signer_scope ?? null,
              display_order: template.display_order,
              person_slot: slot,
              status: 'missing',
              created_by: 'system',
              category: template.category,
            });
          }
        }
      }

      const { error: insertError } = await supabaseAdmin
        .from('application_documents')
        .insert(docRows);

      if (insertError) throw insertError;
    } catch (seedError: any) {
      // Compensating rollback: remove the members we inserted so the application
      // remains in a retryable state. intake_submitted_at has not been set yet.
      console.error('PBV intake doc seeding failed — rolling back members:', seedError);
      await supabaseAdmin
        .from('pbv_household_members')
        .delete()
        .eq('full_application_id', app.id);
      return { body: { success: false, message: 'Failed to prepare your document checklist. Please try submitting again.' }, status: 500 };
    }

    // Commit point: stamp intake completion only after everything succeeded.
    // Write the canonical signal (intake_status / intake_completed_at) that the
    // admin and downstream consumers read, alongside the legacy intake_submitted_at
    // for backward compatibility. Both are set together so the two paths agree.
    const committedAt = new Date().toISOString();
    const { error: commitError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        intake_submitted_at: committedAt,
        intake_status: 'complete',
        intake_completed_at: committedAt,
      })
      .eq('id', app.id);

    if (commitError) throw commitError;

    return { body: { success: true, data: { id: app.id } }, status: 200 };
  } catch (error: any) {
    console.error('PBV full-app POST error:', error);
    return { body: { success: false, message: 'Internal server error', code: 'server_error' }, status: 500 };
  }
    },
    'id, building_address, unit_number, submitted_at'
  );
}
