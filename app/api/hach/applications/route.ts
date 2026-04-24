import { NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/hach/applications
 * Returns the HACH review queue, grouped by review state.
 * Requires hach_admin or hach_reviewer session.
 */
export async function GET() {
  const guard = await requireHachUser();
  if (guard) return guard;

  try {
    // Fetch all applications routed to HACH (hach_review_status is not null)
    // Include doc counts via a joined aggregate approach
    const { data: apps, error } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, head_of_household_name, building_address, unit_number,
         household_size, created_at, updated_at,
         hach_review_status, stanton_review_status, form_submission_id`
      )
      .not('hach_review_status', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[hach/applications] query error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    if (!apps || apps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          needs_first_review: [],
          awaiting_response: [],
          approved: [],
        },
      });
    }

    // Fetch document counts for all form_submission_ids
    const submissionIds = apps
      .map((a: any) => a.form_submission_id)
      .filter(Boolean);

    const { data: docCounts } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, status')
      .in('form_submission_id', submissionIds);

    // Build doc summary per form_submission_id
    const docSummary: Record<
      string,
      { total: number; approved: number; rejected: number; missing: number; submitted: number }
    > = {};
    for (const doc of docCounts ?? []) {
      const sid = (doc as any).form_submission_id;
      if (!docSummary[sid]) {
        docSummary[sid] = { total: 0, approved: 0, rejected: 0, missing: 0, submitted: 0 };
      }
      docSummary[sid].total++;
      const status = (doc as any).status as string;
      if (status in docSummary[sid]) {
        (docSummary[sid] as any)[status]++;
      }
    }

    // Build document ID → submission ID → app ID maps for revision counting
    const docIdToSubmId: Record<string, string> = {};
    const submIdToAppId: Record<string, string> = {};
    for (const doc of docCounts ?? []) {
      const d = doc as any;
      if (d.id) docIdToSubmId[d.id] = d.form_submission_id;
    }
    for (const app of apps) {
      const a = app as any;
      if (a.form_submission_id) submIdToAppId[a.form_submission_id] = a.id;
    }
    const allDocIds = Object.keys(docIdToSubmId);

    // Fetch review action counts to determine "first review" vs "awaiting response"
    const appIds = apps.map((a: any) => a.id);
    const { data: actionCounts } = await supabaseAdmin
      .from('document_review_actions')
      .select('full_application_id')
      .in('full_application_id', appIds);

    const reviewedAppIds = new Set(
      (actionCounts ?? []).map((r: any) => r.full_application_id)
    );

    // Get current reviewer for view tracking
    const currentUser = await getSessionUser();
    const currentUserId = currentUser!.userId;

    // Fetch last-viewed timestamps per application for current reviewer
    const { data: viewEvents } = await supabaseAdmin
      .from('application_view_events')
      .select('full_application_id, viewed_at')
      .eq('reviewer_id', currentUserId)
      .in('full_application_id', appIds);

    const lastViewedByApp: Record<string, string> = {};
    for (const ev of viewEvents ?? []) {
      const aid = (ev as any).full_application_id;
      const vat = (ev as any).viewed_at;
      if (!lastViewedByApp[aid] || vat > lastViewedByApp[aid]) {
        lastViewedByApp[aid] = vat;
      }
    }

    // Count document revisions uploaded since last view per application
    const newRevsByApp: Record<string, number> = {};
    if (allDocIds.length > 0) {
      const { data: recentRevs } = await supabaseAdmin
        .from('form_submission_document_revisions')
        .select('document_id, created_at')
        .in('document_id', allDocIds);
      for (const rev of recentRevs ?? []) {
        const docId = (rev as any).document_id;
        const appId = submIdToAppId[docIdToSubmId[docId]] ?? null;
        if (!appId) continue;
        const lastViewed = lastViewedByApp[appId];
        if (!lastViewed) continue; // never viewed → 0 new
        if ((rev as any).created_at > lastViewed) {
          newRevsByApp[appId] = (newRevsByApp[appId] ?? 0) + 1;
        }
      }
    }

    // Enrich and group
    const enriched = apps.map((a: any) => ({
      id: a.id,
      head_of_household_name: a.head_of_household_name,
      building_address: a.building_address,
      unit_number: a.unit_number,
      household_size: a.household_size,
      created_at: a.created_at,
      hach_review_status: a.hach_review_status,
      doc_summary: docSummary[a.form_submission_id] ?? { total: 0, approved: 0, rejected: 0, missing: 0, submitted: 0 },
      has_review_actions: reviewedAppIds.has(a.id),
      last_viewed_at: lastViewedByApp[a.id] ?? null,
      documents_uploaded_since_last_view: newRevsByApp[a.id] ?? 0,
    }));

    const needsFirstReview = enriched.filter(
      (a) => a.hach_review_status === 'pending_hach' && !a.has_review_actions
    );
    const awaitingResponse = enriched.filter(
      (a) =>
        (a.hach_review_status === 'under_hach_review' ||
          (a.hach_review_status === 'pending_hach' && a.has_review_actions))
    );
    const approved = enriched.filter(
      (a) => a.hach_review_status === 'approved_by_hach'
    );

    return NextResponse.json({
      success: true,
      data: {
        needs_first_review: needsFirstReview,
        awaiting_response: awaitingResponse,
        approved,
      },
    });
  } catch (error: any) {
    console.error('[hach/applications] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
