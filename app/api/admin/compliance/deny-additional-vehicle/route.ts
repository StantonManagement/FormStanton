import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, reason } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    // Deny the additional vehicle request
    const { data, error } = await supabase
      .from('submissions')
      .update({
        additional_vehicle_denied: true,
        additional_vehicle_denial_reason: reason || 'No parking spots available',
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error denying additional vehicle:', error);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to deny: ${error.message}`,
          code: error.code,
          detail: error.details || error.hint,
        },
        { status: 500 }
      );
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'vehicle.deny_additional', 'submission', submissionId, { reason }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Denial error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to deny additional vehicle' },
      { status: 500 }
    );
  }
}
