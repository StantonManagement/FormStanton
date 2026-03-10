import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { canApproveAdditionalPermit } from '@/lib/parkingAnalytics';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}


export async function POST(request: NextRequest) {
  const supabase = getSupabase();

  try {
    const body = await request.json();
    const { submissionId, admin } = body;

    if (!submissionId || !admin) {
      return NextResponse.json(
        { success: false, message: 'Submission ID and admin required' },
        { status: 400 }
      );
    }

    // Get the submission
    const { data: submission, error: fetchError } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found', detail: fetchError?.message },
        { status: 404 }
      );
    }

    // Check if additional vehicles exist
    if (!submission.additional_vehicles || submission.additional_vehicles.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No additional vehicles to approve' },
        { status: 400 }
      );
    }

    // Fetch all submissions for the building to check availability
    const { data: allSubmissions, error: allError } = await supabase
      .from('submissions')
      .select('*')
      .eq('building_address', submission.building_address);

    if (allError) {
      return NextResponse.json(
        { success: false, message: 'Failed to check parking availability', detail: allError.message },
        { status: 500 }
      );
    }

    // Check if we can approve (validates parking availability)
    const canApprove = canApproveAdditionalPermit(submission.building_address, allSubmissions || []);

    if (!canApprove) {
      return NextResponse.json(
        { success: false, message: 'No parking spots available for additional vehicles' },
        { status: 400 }
      );
    }

    // Approve the additional vehicle request
    const { data, error } = await supabase
      .from('submissions')
      .update({
        additional_vehicle_approved: true,
        additional_vehicle_approved_at: new Date().toISOString(),
        additional_vehicle_approved_by: admin,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error approving additional vehicle:', error);
      return NextResponse.json(
        {
          success: false,
          message: `Failed to approve: ${error.message}`,
          code: error.code,
          detail: error.details || error.hint,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('Approval error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to approve additional vehicle' },
      { status: 500 }
    );
  }
}
