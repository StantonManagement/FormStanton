import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

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
    const statusFilter = searchParams.get('status'); // Can be comma-separated list
    const minAgeDays = searchParams.get('min_age_days');

    // Query from the assigned_documents view
    let query = supabaseAdmin
      .from('assigned_documents')
      .select('*')
      .eq('assigned_to_user_id', sessionUser.userId)
      .order('assigned_at', { ascending: false });

    // Apply status filter if provided
    if (statusFilter) {
      const statuses = statusFilter.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
      } else if (statuses.length > 1) {
        query = query.in('status', statuses);
      }
    }

    // Apply age filter if provided
    if (minAgeDays) {
      const days = parseInt(minAgeDays, 10);
      if (!isNaN(days) && days > 0) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        query = query.lte('assigned_at', cutoffDate.toISOString());
      }
    }

    const { data: docs, error } = await query;

    if (error) throw error;

    // Group by application for better UI presentation
    const groupedByApp = (docs ?? []).reduce((acc: any, doc: any) => {
      const appId = doc.application_id;
      if (!acc[appId]) {
        acc[appId] = {
          application_id: appId,
          head_of_household_name: doc.head_of_household_name,
          building_address: doc.building_address,
          unit_number: doc.unit_number,
          stanton_review_status: doc.stanton_review_status,
          documents: [],
        };
      }
      acc[appId].documents.push({
        document_id: doc.document_id,
        doc_type: doc.doc_type,
        label: doc.label,
        status: doc.status,
        revision: doc.revision,
        assigned_at: doc.assigned_at,
        owner_review_status: doc.owner_review_status,
      });
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: {
        documents: docs ?? [],
        grouped_by_application: Object.values(groupedByApp),
        total_count: docs?.length ?? 0,
      },
    });
  } catch (error: any) {
    console.error('[me/queue] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
