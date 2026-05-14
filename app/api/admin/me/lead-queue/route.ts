import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// GET /api/admin/me/lead-queue
// Returns documents awaiting confirmation for applications where the current user is Lead
export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status'); // 'pending', 'confirmed', 'flagged', or null for all

    // First, get applications where this user is the Lead
    const { data: leadApps } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number')
      .eq('lead_user_id', sessionUser.userId);

    if (!leadApps || leadApps.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          documents: [],
          grouped_by_application: [],
          total_count: 0,
        },
      });
    }

    const appIds = leadApps.map((a) => a.id);
    const appMap = new Map(leadApps.map((a) => [a.id, a]));

    // Get form_submission_ids for these applications
    const { data: submissions } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, form_submission_id')
      .in('id', appIds);

    const submissionIds = (submissions ?? []).map((s) => s.form_submission_id).filter(Boolean);

    if (submissionIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          documents: [],
          grouped_by_application: [],
          total_count: 0,
        },
      });
    }

    // Query documents with owner_review_status
    let query = supabaseAdmin
      .from('form_submission_documents')
      .select(
        `id, form_submission_id, doc_type, label, status, revision,
         owner_review_status, owner_flag_reason, reviewer, reviewed_at,
         assigned_to_user_id, assigned_at`
      )
      .in('form_submission_id', submissionIds)
      .not('owner_review_status', 'is', null)
      .order('reviewed_at', { ascending: false });

    // Apply status filter if provided
    if (statusFilter) {
      query = query.eq('owner_review_status', statusFilter);
    }

    const { data: docs, error } = await query;

    if (error) throw error;

    // Map documents to applications
    const docsWithApps = (docs ?? []).map((doc) => {
      // Find the application for this submission
      const app = (submissions ?? []).find((s) => s.form_submission_id === doc.form_submission_id);
      const appInfo = app ? appMap.get(app.id) : null;

      return {
        document_id: doc.id,
        doc_type: doc.doc_type,
        label: doc.label,
        status: doc.status,
        revision: doc.revision,
        owner_review_status: doc.owner_review_status,
        owner_flag_reason: doc.owner_flag_reason,
        reviewer: doc.reviewer,
        reviewed_at: doc.reviewed_at,
        assigned_to_user_id: doc.assigned_to_user_id,
        application_id: app?.id ?? '',
        head_of_household_name: appInfo?.head_of_household_name ?? 'Unknown',
        building_address: appInfo?.building_address ?? '',
        unit_number: appInfo?.unit_number ?? '',
      };
    });

    // Group by application
    const grouped = docsWithApps.reduce((acc: any, doc: any) => {
      if (!acc[doc.application_id]) {
        acc[doc.application_id] = {
          application_id: doc.application_id,
          head_of_household_name: doc.head_of_household_name,
          building_address: doc.building_address,
          unit_number: doc.unit_number,
          documents: [],
        };
      }
      acc[doc.application_id].documents.push(doc);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        documents: docsWithApps,
        grouped_by_application: Object.values(grouped),
        total_count: docsWithApps.length,
      },
    });
  } catch (error: any) {
    console.error('[me/lead-queue] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
