import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * PATCH — Mark lobby_notes as processed on a submission.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submission_id, processed } = body;

    if (!submission_id) {
      return NextResponse.json(
        { success: false, message: 'Missing submission_id' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();

    const { data: updated, error } = await supabaseAdmin
      .from('submissions')
      .update({
        lobby_notes_processed: processed !== false,
      })
      .eq('id', submission_id)
      .select('id, lobby_notes, lobby_notes_processed')
      .single();

    if (error) {
      console.error('Error updating lobby notes processed:', error);
      return NextResponse.json({ success: false, message: 'Failed to update' }, { status: 500 });
    }

    await logAudit(sessionUser, 'compliance.lobby_notes_processed', 'submission', submission_id, {
      processed: processed !== false,
    }, getClientIp(request));

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Lobby notes PATCH error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update lobby notes' },
      { status: 500 }
    );
  }
}
