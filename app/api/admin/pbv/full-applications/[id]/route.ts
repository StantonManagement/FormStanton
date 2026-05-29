import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: app, error } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, created_at, head_of_household_name, building_address, unit_number,
         bedroom_count, household_size, intake_status, intake_completed_at,
         stanton_review_status, stanton_reviewer, stanton_review_date, stanton_review_notes,
         hha_application_file, hach_review_status,
         tenant_access_token, form_submission_id, preapp_id,
         claiming_medical_deduction, has_childcare_expense, dv_status,
         homeless_at_admission, reasonable_accommodation_requested,
         packet_locked, submitted_to_hach_at, submitted_to_hach_by, hach_packet_revision,
         sms_opted_out_at, stage, assigned_to, preferred_language, intake_snapshot, intake_snapshot_at,
         phone, admin_users:assigned_to(display_name)`
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const { data: members } = await supabaseAdmin
      .from('pbv_household_members')
      .select(
        `id, slot, name, date_of_birth, age, relationship, ssn_last_four,
         annual_income, documented_income, income_sources, disability, student, citizenship_status,
         criminal_history, signature_required, signature_date, signed_forms`
      )
      .eq('full_application_id', id)
      .order('slot', { ascending: true });

    const { data: documents } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, person_slot, status, required, display_order, requires_signature, revision, file_name, storage_path, uploaded_by_role, uploaded_by_display_name, staff_upload_note, original_doc_type, assigned_to_user_id, assigned_at, owner_review_status, owner_flag_reason, category')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', id)
      .order('display_order', { ascending: true });

    // Signature state must reflect BOTH signing models, because the admin counter
    // historically read only pbv_household_members.signed_forms:
    //   * Legacy flow (POST .../signatures) writes members.signed_forms directly.
    //   * Canonical flow (completeForm.ts on pbv_form_documents) writes
    //     collected_signer_member_ids and never touches members.signed_forms.
    // Reading only the legacy column made every modern-signed member show as
    // unsigned. Derive each member's signed forms as the UNION of the legacy
    // column and the forms whose collected_signer_member_ids include them, so
    // neither signing model is missed and legacy-signed apps don't regress.
    const { data: formDocs } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('form_id, collected_signer_member_ids')
      .eq('full_application_id', id);

    const signedFormsByMember = new Map<string, string[]>();
    for (const fd of (formDocs ?? [])) {
      const collected = (fd.collected_signer_member_ids as string[] | null) ?? [];
      for (const memberId of collected) {
        const list = signedFormsByMember.get(memberId) ?? [];
        list.push(fd.form_id as string);
        signedFormsByMember.set(memberId, list);
      }
    }

    // Generated form PDFs for the admin "Generated Forms" review block. Lets
    // staff preview the filled (unsigned) and signed PDFs without leaving the
    // page. Join template display names so the UI shows readable labels.
    const { data: formDocsDetail } = await supabaseAdmin
      .from('pbv_form_documents')
      .select('id, form_id, language, status, generated_at, finalized_at, unsigned_pdf_path, signed_pdf_path, required_signer_member_ids, collected_signer_member_ids')
      .eq('full_application_id', id)
      .order('form_id', { ascending: true });

    const { data: formTemplates } = await supabaseAdmin
      .from('pbv_form_templates')
      .select('form_id, display_name_en');
    const formNameById = new Map<string, string>(
      (formTemplates ?? []).map((t) => [t.form_id as string, (t.display_name_en as string) ?? (t.form_id as string)])
    );

    const generatedForms = (formDocsDetail ?? []).map((fd) => ({
      id: fd.id,
      form_id: fd.form_id,
      display_name: formNameById.get(fd.form_id as string) ?? (fd.form_id as string),
      language: fd.language,
      status: fd.status,
      generated_at: fd.generated_at,
      finalized_at: fd.finalized_at,
      has_unsigned_pdf: !!fd.unsigned_pdf_path,
      has_signed_pdf: !!fd.signed_pdf_path,
      required_signer_member_ids: (fd.required_signer_member_ids as string[] | null) ?? [],
      collected_signer_member_ids: (fd.collected_signer_member_ids as string[] | null) ?? [],
    }));

    const membersWithSignatures = (members ?? []).map((m) => {
      const legacy = Array.isArray((m as { signed_forms?: unknown }).signed_forms)
        ? ((m as { signed_forms: string[] }).signed_forms)
        : [];
      const derived = signedFormsByMember.get(m.id as string) ?? [];
      return {
        ...m,
        signed_forms: Array.from(new Set([...legacy, ...derived])),
      };
    });

    // Extract assigned_to_name from the join
    const assignedToName = (app.admin_users as unknown as { display_name: string } | null)?.display_name ?? null;
    const { admin_users, ...appWithoutJoin } = app as unknown as Record<string, unknown>;

    return NextResponse.json({
      success: true,
      data: {
        ...appWithoutJoin,
        assigned_to_name: assignedToName,
        members: membersWithSignatures,
        documents: documents ?? [],
        generated_forms: generatedForms,
        magic_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pbv-full-app/${app.tenant_access_token}`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/full-applications/[id] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    // Check packet_locked before any mutation
    const { data: lockCheck } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('packet_locked')
      .eq('id', id)
      .single();

    if ((lockCheck as any)?.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked. Reopen the packet before making changes.' },
        { status: 423 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      stanton_review_status,
      stanton_reviewer,
      stanton_review_notes,
      member_income_updates,
    } = body as {
      stanton_review_status?: string;
      stanton_reviewer?: string;
      stanton_review_notes?: string;
      member_income_updates?: Array<{ id: string; documented_income: number | null }>;
    };

    const VALID_STATUSES = ['pending', 'under_review', 'approved', 'denied', 'needs_info'] as const;

    const appUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (stanton_review_status !== undefined) {
      if (!VALID_STATUSES.includes(stanton_review_status as any)) {
        return NextResponse.json({ success: false, message: 'Invalid stanton_review_status' }, { status: 400 });
      }
      appUpdate.stanton_review_status = stanton_review_status;
      if (stanton_review_status === 'approved' || stanton_review_status === 'denied') {
        appUpdate.stanton_review_date = new Date().toISOString();
      }
    }
    if (stanton_reviewer !== undefined) appUpdate.stanton_reviewer = stanton_reviewer;
    if (stanton_review_notes !== undefined) appUpdate.stanton_review_notes = stanton_review_notes;

    if (Object.keys(appUpdate).length > 1) {
      const { error: updateError } = await supabaseAdmin
        .from('pbv_full_applications')
        .update(appUpdate)
        .eq('id', id);
      if (updateError) throw updateError;
    }

    if (Array.isArray(member_income_updates) && member_income_updates.length > 0) {
      // F7: Load intake_snapshot for drift detection
      const { data: snapshotRow } = await supabaseAdmin
        .from('pbv_full_applications')
        .select('intake_snapshot')
 