import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * Re-issue a permit after revocation.
 * Archives the current permit cycle into `permit_history`, resets all permit
 * fields so the tenant re-enters the normal issue → pickup → AppFolio flow,
 * and optionally flags the old permit for towing.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId, towOldPermit } = body;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'Submission ID required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || body.by || 'Admin';

    // Fetch current submission
    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (!sub.permit_revoked) {
      return NextResponse.json(
        { success: false, message: 'Permit must be revoked before re-issuing' },
        { status: 400 },
      );
    }

    // Build the archived permit cycle entry
    const archivedCycle = {
      permit_issued_at: sub.permit_issued_at,
      permit_issued_by: sub.permit_issued_by,
      tenant_picked_up: sub.tenant_picked_up,
      tenant_picked_up_at: sub.tenant_picked_up_at,
      pickup_count: sub.pickup_count ?? 0,
      pickup_events: sub.pickup_events ?? [],
      pickup_id_photo: sub.pickup_id_photo,
      permit_revoked_at: sub.permit_revoked_at,
      permit_revoked_by: sub.permit_revoked_by,
      permit_revoked_reason: sub.permit_revoked_reason,
      permit_revoked_notes: sub.permit_revoked_notes,
      tow_flagged: towOldPermit === true,
      towed_at: sub.towed_at,
      permit_fee_amount: sub.permit_fee_amount,
      permit_fee_added_to_appfolio: sub.permit_fee_added_to_appfolio,
      permit_entered_in_appfolio: sub.permit_entered_in_appfolio,
      vehicle_addendum_uploaded_to_appfolio: sub.vehicle_addendum_uploaded_to_appfolio,
      pickup_id_uploaded_to_appfolio: sub.pickup_id_uploaded_to_appfolio,
      archived_at: new Date().toISOString(),
      archived_by: by,
    };

    const existingHistory: any[] = Array.isArray(sub.permit_history) ? sub.permit_history : [];
    const newHistory = [...existingHistory, archivedCycle];

    // Reset all permit-cycle fields
    const resetFields: Record<string, any> = {
      permit_history: newHistory,
      // Permit issuance
      permit_issued: false,
      permit_issued_at: null,
      permit_issued_by: null,
      // Pickup
      tenant_picked_up: false,
      tenant_picked_up_at: null,
      pickup_count: 0,
      pickup_events: [],
      pickup_id_photo: null,
      // Revoke
      permit_revoked: false,
      permit_revoked_at: null,
      permit_revoked_by: null,
      permit_revoked_reason: null,
      permit_revoked_notes: null,
      // Tow (reset — old tow status is in archive)
      tow_flagged: false,
      towed_at: null,
      towed_by: null,
      // AppFolio flags (re-enter the queue)
      permit_fee_added_to_appfolio: false,
      permit_fee_added_to_appfolio_at: null,
      permit_fee_added_to_appfolio_by: null,
      permit_fee_amount: null,
      permit_entered_in_appfolio: false,
      permit_entered_in_appfolio_at: null,
      permit_entered_in_appfolio_by: null,
      vehicle_addendum_uploaded_to_appfolio: false,
      vehicle_addendum_uploaded_to_appfolio_at: null,
      vehicle_addendum_uploaded_to_appfolio_by: null,
      pickup_id_uploaded_to_appfolio: false,
      pickup_id_uploaded_to_appfolio_at: null,
      pickup_id_uploaded_to_appfolio_by: null,
    };

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(resetFields)
      .eq('id', submissionId)
      .select()
      .single();

    if (error) {
      console.error('reissue-permit update error:', error);
      return NextResponse.json({ success: false, message: 'Failed to re-issue permit' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      'permit.reissue',
      'submission',
      submissionId,
      {
        by,
        tow_old_permit: towOldPermit === true,
        cycle_number: newHistory.length,
      },
      getClientIp(request),
    );

    return NextResponse.json({
      success: true,
      data,
      cycleNumber: newHistory.length + 1,
    });
  } catch (error: any) {
    console.error('reissue-permit exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to re-issue permit' },
      { status: 500 },
    );
  }
}
