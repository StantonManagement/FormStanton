import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, feeType, amount } = body;

    const sessionUser = await getSessionUser();
    const addedBy = sessionUser?.displayName || body.addedBy || 'Admin';

    if (!submissionId || !feeType || !amount) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount' },
        { status: 400 }
      );
    }

    // Map fee type to column names
    const columnMap: Record<string, string> = {
      'pet_rent': 'pet_fee',
      'permit_fee': 'permit_fee',
    };

    const baseColumn = columnMap[feeType];
    if (!baseColumn) {
      return NextResponse.json(
        { success: false, message: 'Invalid fee type' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      [`${baseColumn}_added_to_appfolio`]: true,
      [`${baseColumn}_added_to_appfolio_at`]: new Date().toISOString(),
      [`${baseColumn}_added_to_appfolio_by`]: addedBy,
      [`${baseColumn}_amount`]: parsedAmount,
    };

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error marking fee added:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to update fee status' },
        { status: 500 }
      );
    }

    await logAudit(sessionUser, 'appfolio.fee_added', 'submission', submissionId, {
      feeType, amount: parsedAmount, addedBy,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Mark fee added error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark fee added' },
      { status: 500 }
    );
  }
}
