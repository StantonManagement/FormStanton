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

const VALID_PICKUP_REASONS = ['initial', 'lost', 'replacement', 'additional_vehicle', 'other'] as const;
type PickupReason = typeof VALID_PICKUP_REASONS[number];

// Mark as picked up (supports repeat pickups)
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
    const { submissionId, idPhotoPath, reason, reasonNotes } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || body.by || 'Admin';

    // Fetch existing submission to know pickup_count / existing ID
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('pickup_count, pickup_events, pickup_id_photo, pickup_id_uploaded_to_appfolio')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const currentCount = existing.pickup_count ?? 0;
    const events: any[] = Array.isArray(existing.pickup_events) ? [...existing.pickup_events] : [];
    const newEventNumber = currentCount + 1;

    // Repeat pickup must have a valid reason. First pickup defaults to 'initial'.
    let finalReason: PickupReason = 'initial';
    if (newEventNumber > 1) {
      if (!reason || !VALID_PICKUP_REASONS.includes(reason)) {
        return NextResponse.json(
          { success: false, message: 'Reason is required for repeat pickups (lost, replacement, additional_vehicle, other)' },
          { status: 400 }
        );
      }
      finalReason = reason;
    } else if (reason && VALID_PICKUP_REASONS.includes(reason)) {
      finalReason = reason;
    }

    // ID photo required on first pickup; optional on subsequent (re-uses existing if none provided)
    const effectiveIdPath = idPhotoPath || existing.pickup_id_photo || null;
    if (newEventNumber === 1 && !effectiveIdPath) {
      return NextResponse.json(
        { success: false, message: 'ID photo is required for the first pickup' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    events.push({
      at: nowIso,
      by,
      id_photo_path: effectiveIdPath,
      reason: finalReason,
      reason_notes: typeof reasonNotes === 'string' && reasonNotes.trim() ? reasonNotes.trim() : null,
      event_number: newEventNumber,
    });

    const updateData: Record<string, any> = {
      tenant_picked_up: true,
      tenant_picked_up_at: nowIso,
      pickup_events: events,
      pickup_count: newEventNumber,
    };

    if (idPhotoPath) {
      // New ID uploaded — overwrite and reset AppFolio upload flag
      updateData.pickup_id_photo = idPhotoPath;
      updateData.pickup_id_uploaded_to_appfolio = false;
      updateData.pickup_id_uploaded_to_appfolio_at = null;
      updateData.pickup_id_uploaded_to_appfolio_by = null;
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

    await logAudit(sessionUser, 'permit.pickup', 'submission', submissionId, {
      event_number: newEventNumber,
      reason: finalReason,
      new_id_supplied: !!idPhotoPath,
    }, getClientIp(request));

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Mark picked up error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to mark as picked up' },
      { status: 500 }
    );
  }
}

// Undo the most recent pickup event
export async function DELETE(request: NextRequest) {
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

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('pickup_count, pickup_events')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const events: any[] = Array.isArray(existing.pickup_events) ? [...existing.pickup_events] : [];
    if (events.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No pickup events to undo' },
        { status: 400 }
      );
    }

    events.pop();
    const newCount = events.length;
    const last = events[events.length - 1];

    const updateData: Record<string, any> = {
      pickup_events: events,
      pickup_count: newCount,
    };

    if (newCount === 0) {
      updateData.tenant_picked_up = false;
      updateData.tenant_picked_up_at = null;
      updateData.pickup_id_photo = null;
      updateData.pickup_id_uploaded_to_appfolio = false;
      updateData.pickup_id_uploaded_to_appfolio_at = null;
      updateData.pickup_id_uploaded_to_appfolio_by = null;
    } else {
      updateData.tenant_picked_up_at = last?.at || null;
      updateData.pickup_id_photo = last?.id_photo_path || null;
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('Error undoing pickup:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to undo pickup' },
        { status: 500 }
      );
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'permit.pickup_undo', 'submission', submissionId, {
      events_remaining: newCount,
    }, getClientIp(request));

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Undo pickup error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to undo pickup' },
      { status: 500 }
    );
  }
}
