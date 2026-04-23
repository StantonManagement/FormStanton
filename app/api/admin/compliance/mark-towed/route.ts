import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, undo } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || body.by || 'Admin';
    const isUndo = undo === true;

    // 'undo' also doubles as "clear from tow list" (e.g. false alarm) — clears tow_flagged
    const updateData = isUndo
      ? {
          tow_flagged: false,
          towed_at: null,
          towed_by: null,
        }
      : {
          tow_flagged: false,
          towed_at: new Date().toISOString(),
          towed_by: by,
        };

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('mark-towed error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update tow status' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      isUndo ? 'permit.towed_undo' : 'permit.towed',
      'submission',
      submissionId,
      { by, undo: isUndo },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('mark-towed exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update tow status' },
      { status: 500 }
    );
  }
}
