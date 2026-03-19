import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

// Issue permit
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
    const { submissionId, managerOverride, overrideReason } = body;

    const sessionUser = await getSessionUser();
    const admin = sessionUser?.displayName || body.admin || 'Admin';

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    // Fetch submission to validate all requirements are met
    const { data: submission, error: fetchError } = await supabaseAdmin
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

    // Validate required items before issuing permit
    const missingItems: string[] = [];

    if (!submission.vehicle_verified) {
      missingItems.push('Vehicle verification');
    }

    // Pet verification only applies if tenant has pets and no fee exemption
    if (!submission.pet_verified && submission.has_pets && !submission.has_fee_exemption) {
      missingItems.push('Pet verification');
    }

    if (!submission.insurance_verified) {
      missingItems.push('Insurance verification');
    }

    if (missingItems.length > 0 && !managerOverride) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Cannot issue permit. Missing verification for: ${missingItems.join(', ')}. Manager override is required to continue.`,
          missingItems,
        },
        { status: 400 }
      );
    }

    const trimmedOverrideReason = typeof overrideReason === 'string' ? overrideReason.trim() : '';
    if (missingItems.length > 0 && managerOverride && !trimmedOverrideReason) {
      return NextResponse.json(
        {
          success: false,
          message: 'Override reason is required when issuing a permit with manager override',
          missingItems,
        },
        { status: 400 }
      );
    }

    // All requirements met - issue the permit (no PDF, permits are hand-written)
    const existingNotes = typeof submission.admin_notes === 'string' ? submission.admin_notes : '';
    const overrideNote =
      missingItems.length > 0 && managerOverride
        ? `[${new Date().toISOString()}] Manager override permit issue by ${admin}. Missing: ${missingItems.join(', ')}. Reason: ${trimmedOverrideReason}`
        : '';

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update({
        permit_issued: true,
        permit_issued_at: new Date().toISOString(),
        permit_issued_by: admin,
        admin_notes: overrideNote
          ? (existingNotes ? `${existingNotes}\n${overrideNote}` : overrideNote)
          : submission.admin_notes,
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

    await logAudit(sessionUser, 'permit.issue', 'submission', submissionId, {
      admin,
      manager_override: !!managerOverride,
      override_reason: trimmedOverrideReason || null,
      missing_items: missingItems,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data,
      managerOverrideUsed: !!managerOverride,
      missingItems,
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
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, idPhotoPath } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    const updateData: Record<string, any> = {
      tenant_picked_up: true,
      tenant_picked_up_at: new Date().toISOString(),
    };

    if (idPhotoPath) {
      updateData.pickup_id_photo = idPhotoPath;
      updateData.pickup_id_photo_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
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

    const sessionUser2 = await getSessionUser();
    await logAudit(sessionUser2, 'permit.pickup', 'submission', submissionId, { hasIdPhoto: !!idPhotoPath }, getClientIp(request));

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
