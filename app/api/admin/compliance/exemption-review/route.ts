import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function PUT(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId, action, notes, reviewerName } = await request.json();

    if (!submissionId || !action || !reviewerName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = ['approve', 'deny', 'request_more_info'];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid action' },
        { status: 400 }
      );
    }

    // Update form_submissions table
    const { data: formSubmission, error: formError } = await supabaseAdmin
      .from('form_submissions')
      .update({
        exemption_status: action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'more_info_needed',
        exemption_reviewed_by: reviewerName,
        exemption_reviewed_at: new Date().toISOString(),
        exemption_notes: notes,
        reviewed: true,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewerName,
      })
      .eq('id', submissionId)
      .select()
      .single();

    if (formError) {
      console.error('Form submission update error:', formError);
      throw formError;
    }

    // Also update the main submissions table if tenant exists
    if (formSubmission) {
      const { data: existingSubmission } = await supabaseAdmin
        .from('submissions')
        .select('id')
        .eq('full_name', formSubmission.tenant_name)
        .eq('building_address', formSubmission.building_address)
        .eq('unit_number', formSubmission.unit_number)
        .single();

      if (existingSubmission) {
        const { error: submissionError } = await supabaseAdmin
          .from('submissions')
          .update({
            exemption_status: action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'more_info_needed',
            exemption_reviewed_by: reviewerName,
            exemption_reviewed_at: new Date().toISOString(),
            exemption_notes: notes,
          })
          .eq('id', existingSubmission.id);

        if (submissionError) {
          console.error('Submission update error:', submissionError);
        }
      }
    }

    // TODO: Send email notification to tenant about the decision
    // await sendExemptionDecisionEmail(formSubmission, action, notes);

    return NextResponse.json({
      success: true,
      message: `Exemption ${action}d successfully`,
      data: formSubmission,
    });
  } catch (error: any) {
    console.error('Exemption review error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
