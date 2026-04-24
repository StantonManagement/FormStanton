import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

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
         bedroom_count, household_size, intake_submitted_at,
         stanton_review_status, stanton_reviewer, stanton_review_date, stanton_review_notes,
         hha_application_file,
         tenant_access_token, form_submission_id, preapp_id,
         claiming_medical_deduction, has_childcare_expense, dv_status,
         homeless_at_admission, reasonable_accommodation_requested`
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
      .from('form_submission_documents')
      .select('id, doc_type, label, person_slot, status, required, display_order')
      .eq('form_submission_id', app.form_submission_id)
      .order('display_order', { ascending: true });

    return NextResponse.json({
      success: true,
      data: {
        ...app,
        members: members ?? [],
        documents: documents ?? [],
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
      for (const update of member_income_updates) {
        if (!update.id) continue;
        await supabaseAdmin
          .from('pbv_household_members')
          .update({ documented_income: update.documented_income ?? null })
          .eq('id', update.id)
          .eq('full_application_id', id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PATCH /api/admin/pbv/full-applications/[id] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
