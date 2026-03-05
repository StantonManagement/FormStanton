import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Issue permit
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId, admin } = body;

    if (!submissionId || !admin) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and admin required' },
        { status: 400 }
      );
    }

    // Fetch submission to validate all requirements are met
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    // Validate all required items are verified before issuing permit
    const missingItems = [];
    
    if (!submission.vehicle_verified) {
      missingItems.push('Vehicle information');
    }
    
    if (!submission.pet_verified) {
      missingItems.push('Pet form');
    }
    
    if (!submission.insurance_verified) {
      missingItems.push('Renters insurance');
    }

    if (missingItems.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot issue permit. Missing verification for: ${missingItems.join(', ')}. All items must be verified before issuing a parking permit.` 
        },
        { status: 400 }
      );
    }

    // All requirements met - issue the permit
    const { data, error } = await supabase
      .from('submissions')
      .update({
        permit_issued: true,
        permit_issued_at: new Date().toISOString(),
        permit_issued_by: admin,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error issuing permit:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to issue permit' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Permit issuance error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to issue permit' },
      { status: 500 }
    );
  }
}

// Mark as picked up
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('submissions')
      .update({
        tenant_picked_up: true,
        tenant_picked_up_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error marking as picked up:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to mark as picked up' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Mark picked up error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark as picked up' },
      { status: 500 }
    );
  }
}
