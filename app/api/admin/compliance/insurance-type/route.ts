import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

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
    const { submissionId, insuranceType } = body;

    if (!submissionId || !insuranceType) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and insurance type required' },
        { status: 400 }
      );
    }

    if (!['renters', 'car', 'other'].includes(insuranceType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid insurance type' },
        { status: 400 }
      );
    }

    // Get current submission
    const { data: currentSubmission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('insurance_verified')
      .eq('id', submissionId)
      .single();

    if (fetchError || !currentSubmission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const updateData: any = {
      insurance_type: insuranceType,
    };

    // If changing away from 'renters' and currently verified, re-lock the gate
    if (insuranceType !== 'renters' && currentSubmission.insurance_verified) {
      updateData.insurance_verified = false;
    }

    const { data: submission, error: updateError } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Insurance type update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update insurance type' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: submission,
    });

  } catch (error: any) {
    console.error('Insurance type error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to update insurance type' },
      { status: 500 }
    );
  }
}
