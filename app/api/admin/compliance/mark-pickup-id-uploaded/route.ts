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
      const { data: existing } = await supabaseAdmin
        .from('submissions')
        .select('pickup_id_photo')
        .eq('id', submissionId)
        .single();
      if (!existing?.pickup_id_photo) {
        return NextResponse.json(
          { success: false, message: 'No pickup ID photo on file to upload.' },
          { status: 400 }
        );
      }
    }

    const updateData = isUndo
      ? {
          pickup_id_uploaded_to_appfolio: false,
          pickup_id_uploaded_to_appfolio_at: null,
          pickup_id_uploaded_to_appfolio_by: null,
        }
      : {
          pickup_id_uploaded_to_appfolio: true,
          pickup_id_uploaded_to_appfolio_at: new Date().toISOString(),
          pickup_id_uploaded_to_appfolio_by: by,
        };

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('mark-pickup-id-uploaded error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update ID upload status' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      isUndo ? 'appfolio.pickup_id_uploaded_undo' : 'appfolio.pickup_id_uploaded',
      'submission',
      submissionId,
      { by, undo: isUndo },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('mark-pickup-id-uploaded exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update ID upload status' },
      { status: 500 }
    );
  }
}
