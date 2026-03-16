import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId } = body;

    const sessionUser = await getSessionUser();
    const receivedBy = sessionUser?.displayName || body.receivedBy || 'Admin';

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and receivedBy required' },
        { status: 400 }
      );
    }

    const { data: submission, error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({
        vehicle_addendum_received: true,
        vehicle_addendum_received_at: new Date().toISOString(),
        vehicle_addendum_received_by: receivedBy,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Vehicle receipt update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to mark vehicle addendum as received' },
        { status: 500 }
      );
    }

    await logAudit(sessionUser, 'receipt.vehicle_addendum', 'submission', submissionId, { receivedBy }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data: submission,
    });

  } catch (error: any) {
    console.error('Vehicle receipt error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark vehicle addendum as received' },
      { status: 500 }
    );
  }
}
