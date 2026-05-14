import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { safeHachJson } from '@/lib/hach/payload-filter';

/**
 * GET /api/hach/applications/[id]
 * Returns the full packet for a single PBV application.
 * Requires hach_admin or hach_reviewer session.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const { id } = await params;

  try {
    // Application
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, head_of_household_name, building_address, unit_number,
         household_size, bedroom_count, created_at, updated_at,
         hach_review_status, stanton_review_status,
         dv_status, claiming_medical_deduction, has_childcare_expense,
         hach_packet_revision, submitted_to_hach_at`
      )
      .eq('id', id)
      .not('hach_review_status', 'is', null)
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
      .from('application_documents')
      .select(
        `id, doc_type, label, status, file_name, storage_path,
         display_order, person_slot, required, revision,
         rejection_reason`
      )
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', id)
      .order('display_order');

    // Review actions (latest per document_id)
    const { data: reviewActions } = await supabaseAdmin
      .from('document_review_actions')
      .select(
        `id, document_id, reviewer_name, action, rejection_reason, created_at`
      )
      .eq('full_application_id', id)
      .eq('source', 'hach')
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
    const docIds = (documents ?? []).map((d: any) => d.id);
    const enrichedDocs = (documents ?? []).map((doc: any) => ({
      ...doc,
      latest_action: latestActionByDoc[doc.id] ?? null,
    }));

    // Compute new-since-last-view for the current reviewer (for the detail page banner)
    let last_viewed_at: string | null = null;
    let new_since_last_view = 0;
    const currentUser = await getSessionUser();
    if (currentUser && docIds.length > 0) {
      const { data: viewEvs } = await supabaseAdmin
        .from('application_view_events')
        .select('viewed_at')
        .eq('full_application_id', id)
        .eq('reviewer_id', currentUser.userId)
        .order('viewed_at', { ascending: false })
        .limit(1);
      last_viewed_at = (viewEvs?.[0] as any)?.viewed_at ?? null;
      if (last_viewed_at) {
        const { data: newDocs } = await supabaseAdmin
          .from('application_documents')
          .select('id')
          .eq('anchor_type', 'pbv_full_application')
          .eq('anchor_id', id)
          .gt('updated_at', last_viewed_at);
        new_since_last_view = (newDocs ?? []).length;
      }
    }

    return NextResponse.json({
      success: true,
      data: safeHachJson({
        application: app,
        members: members ?? [],
        documents: enrichedDocs,
        review_action_log: reviewActions ?? [],
        last_viewed_at,
        new_since_last_view,
      }),
    });
  } catch (error: any) {
    console.error('[hach/applications/[id]] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
