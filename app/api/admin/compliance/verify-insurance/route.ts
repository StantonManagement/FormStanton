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
    const { submissionId, verified } = body;

    if (!submissionId || typeof verified !== 'boolean') {
      return NextResponse.json(
        { success: false, message: 'submissionId and verified (boolean) are required' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const verifiedBy = sessionUser?.displayName || 'Admin';

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({ insurance_verified: verified })
      .eq('id', submissionId)
      .select('id, insurance_verified')
      .single();

    if (error) {
      console.error('Error updating insurance_verified:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update insurance verification status' },
        { status: 500 }
      );
    }

    await logAudit(
      sessionUser,
      verified ? 'insurance.verified' : 'insurance.verified_undo',
      'submission',
      submissionId,
      { verifiedBy, verified },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Verify insurance error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update insurance verification' },
      { status: 500 }
    );
  }
}
