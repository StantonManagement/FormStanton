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

    if (!isUndo) {
      // Guard: can't mark entered if permit not issued
      const { data: existing } = await supabaseAdmin
        .from('submissions')
        .select('permit_issued')
        .eq('id', submissionId)
        .single();
      if (!existing?.permit_issued) {
        return NextResponse.json(
          { success: false, message: 'Cannot mark permit entered in AppFolio before the permit is issued.' },
          { status: 400 }
        );
      }
    }

    const updateData = isUndo
      ? {
          permit_entered_in_appfolio: false,
          permit_entered_in_appfolio_at: null,
          permit_entered_in_appfolio_by: null,
        }
      : {
          permit_entered_in_appfolio: true,
          permit_entered_in_appfolio_at: new Date().toISOString(),
          permit_entered_in_appfolio_by: by,
        };

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('mark-permit-entered error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update permit status' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      isUndo ? 'appfolio.permit_entered_undo' : 'appfolio.permit_entered',
      'submission',
      submissionId,
      { by, undo: isUndo },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('mark-permit-entered exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update permit status' },
      { status: 500 }
    );
  }
}
