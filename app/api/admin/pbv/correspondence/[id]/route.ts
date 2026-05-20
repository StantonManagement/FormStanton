import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * PATCH /api/admin/pbv/correspondence/[id]
 *
 * Updates a HACH correspondence entry (primarily status).
 * Body: {
 *   status?: 'awaiting_their_response' | 'awaiting_our_response' | 'resolved'
 *   body?: string (for editing notes)
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: correspondenceId } = await params;

  let body: {
    status?: 'awaiting_their_response' | 'awaiting_our_response' | 'resolved';
    body?: string;
  } = {};

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  // Validation
  if (body.status && !['awaiting_their_response', 'awaiting_our_response', 'resolved'].includes(body.status)) {
    return NextResponse.json({ success: false, message: 'Invalid status value' }, { status: 400 });
  }

  try {
    // Fetch current to get application_id for updating last_activity_at
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('hach_correspondence_log')
      .select('application_id')
      .eq('id', correspondenceId)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ success: false, message: 'Correspondence entry not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    if (body.status) updates.status = body.status;
    if (body.body !== undefined) updates.body = body.body.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('hach_correspondence_log')
      .update(updates)
      .eq('id', correspondenceId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Update last_activity_at on the application
    await supabaseAdmin
      .from('pbv_full_applications')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('id', current.application_id);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('[correspondence PATCH] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/pbv/correspondence/[id]
 *
 * Deletes a HACH correspondence entry.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { id: correspondenceId } = await params;

  try {
    const { error } = await supabaseAdmin
      .from('hach_correspondence_log')
      .delete()
      .eq('id', correspondenceId);

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[correspondence DELETE] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
