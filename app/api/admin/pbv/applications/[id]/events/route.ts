import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/pbv/applications/[id]/events
 *
 * Returns the activity timeline for a PBV application.
 * Query params:
 *   limit  — default 50, max 100
 *   offset — default 0
 *   event_type — optional filter by event type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { id: applicationId } = await params;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);
  const eventType = searchParams.get('event_type') ?? '';

  try {
    let query = supabaseAdmin
      .from('application_events')
      .select(
        `id, event_type, actor_user_id, actor_display_name, document_id, payload, created_at`
      )
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Get total count for pagination
    const { count } = await supabaseAdmin
      .from('application_events')
      .select('*', { count: 'exact', head: true })
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId)
      .eq(eventType ? 'event_type' : '', eventType || '');

    return NextResponse.json({
      success: true,
      data: data ?? [],
      pagination: {
        total: count ?? 0,
        limit,
        offset,
        hasMore: (count ?? 0) > offset + limit,
      },
    });
  } catch (error: any) {
    console.error('[events] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
