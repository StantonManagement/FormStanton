import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/pbv/applications/[id]/correspondence
 *
 * Returns HACH correspondence entries for a PBV application.
 * Sorted by occurred_at desc (most recent first).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { id: applicationId } = await params;

  try {
    const { data, error } = await supabaseAdmin
      .from('hach_correspondence_log')
      .select(
        `id, direction, channel, from_party, to_party, subject, body, occurred_at, status, logged_by, logged_at, admin_users:logged_by(display_name)`
      )
      .eq('application_id', applicationId)
      .order('occurred_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Transform admin_users join into logged_by_name
    const transformed = (data ?? []).map((row: any) => ({
      ...row,
      logged_by_name: row.admin_users?.display_name ?? null,
      admin_users: undefined,
    }));

    return NextResponse.json({
      success: true,
      data: transformed,
    });
  } catch (error: any) {
    console.error('[correspondence GET] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/pbv/applications/[id]/correspondence
 *
 * Creates a new HACH correspondence entry.
 * Body: {
 *   direction: 'inbound' | 'outbound',
 *   channel: 'email' | 'phone' | 'portal' | 'in_person' | 'other',
 *   from_party?: string,
 *   to_party?: string,
 *   subject?: string,
 *   body: string,
 *   occurred_at: string (ISO),
 *   status?: 'awaiting_their_response' | 'awaiting_our_response' | 'resolved'
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  let body: {
    direction?: 'inbound' | 'outbound';
    channel?: 'email' | 'phone' | 'portal' | 'in_person' | 'other';
    from_party?: string;
    to_party?: string;
    subject?: string;
    body?: string;
    occurred_at?: string;
    status?: 'awaiting_their_response' | 'awaiting_our_response' | 'resolved';
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  // Validation
  if (!body.direction || !['inbound', 'outbound'].includes(body.direction)) {
    return NextResponse.json({ success: false, message: 'direction is required (inbound or outbound)' }, { status: 400 });
  }

  if (!body.channel || !['email', 'phone', 'portal', 'in_person', 'other'].includes(body.channel)) {
    return NextResponse.json({ success: false, message: 'channel is required' }, { status: 400 });
  }

  if (!body.body?.trim()) {
    return NextResponse.json({ success: false, message: 'body is required' }, { status: 400 });
  }

  if (!body.occurred_at) {
    return NextResponse.json({ success: false, message: 'occurred_at is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('hach_correspondence_log')
      .insert({
        application_id: applicationId,
        direction: body.direction,
        channel: body.channel,
        from_party: body.from_party ?? null,
        to_party: body.to_party ?? null,
        subject: body.subject ?? null,
        body: body.body.trim(),
        occurred_at: body.occurred_at,
        status: body.status ?? 'resolved',
        logged_by: user.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Update last_activity_at on the application
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', applicationId);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[correspondence POST] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
