import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/hach/applications/[id]
 * Returns the full packet for a single PBV application.
 * Requires hach_admin or hach_reviewer session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const { id } = params;

  try {
    // Application
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, head_of_household_name, building_address, unit_number,
         household_size, bedroom_count, created_at, updated_at,
         hach_review_status, stanton_review_status,
         stanton_review_notes, form_submission_id,
         dv_status, claiming_medical_deduction, has_childcare_expense`
      )
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { success: false, message: 'Application not found' },
        { status: 404 }
      );
    }

    // Household members
    const { data: members } = await supabaseAdmin
      .from('pbv_household_members')
      .select(
        `id, slot, name, relationship, date_of_birth, age,
         annual_income, income_sources, employed, has_ssi, has_ss,
         has_pension, has_tanf, has_child_support, has_unemployment,
         has_self_employment, has_other_income, disability, citizenship_status`
      )
      .eq('full_application_id', id)
      .order('slot');

    // Documents
    const { data: documents } = await supabaseAdmin
      .from('form_submission_documents')
      .select(
        `id, doc_type, label, status, file_name, storage_path,
         display_order, person_slot, required, revision,
         reviewer, reviewed_at, rejection_reason, notes`
      )
      .eq('form_submission_id', (app as any).form_submission_id)
      .order('display_order');

    // Review actions (latest per document_id)
    const { data: reviewActions } = await supabaseAdmin
      .from('document_review_actions')
      .select(
        `id, document_id, reviewer_name, action, rejection_reason, notes, created_at`
      )
      .eq('full_application_id', id)
      .order('created_at', { ascending: false });

    // Collapse to latest action per document
    const latestActionByDoc: Record<string, any> = {};
    for (const action of reviewActions ?? []) {
      const docId = (action as any).document_id;
      if (!latestActionByDoc[docId]) {
        latestActionByDoc[docId] = action;
      }
    }

    // Enrich documents with latest review action
    const enrichedDocs = (documents ?? []).map((doc: any) => ({
      ...doc,
      latest_action: latestActionByDoc[doc.id] ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        application: app,
        members: members ?? [],
        documents: enrichedDocs,
        review_action_log: reviewActions ?? [],
      },
    });
  } catch (error: any) {
    console.error('[hach/applications/[id]] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
