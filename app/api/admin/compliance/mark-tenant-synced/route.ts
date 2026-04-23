import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * Mark every applicable AppFolio-sync item for a tenant as done in one transaction.
 *
 * This is the "I just uploaded all of this tenant's documents + added their fees in AppFolio,
 * close them out" shortcut Allan uses from the per-tenant processing drawer.
 *
 * Body:
 *   {
 *     submissionId: string,
 *     petFeeAmount?: number,     // required if pet_fee is pending and has_pets
 *     permitFeeAmount?: number,  // required if permit_fee is pending and requires parking permit
 *   }
 *
 * Flips (only where applicable AND file/state exists):
 *   - pet_addendum_uploaded_to_appfolio (if pet_addendum_file)
 *   - vehicle_addendum_uploaded_to_appfolio (if vehicle_addendum_file)
 *   - insurance_uploaded_to_appfolio (if insurance_file)
 *   - esa_doc_uploaded_to_appfolio (if any exemption_documents)
 *   - pickup_id_uploaded_to_appfolio (if pickup_id_photo)
 *   - permit_entered_in_appfolio (if permit_issued)
 *   - pet_fee_added_to_appfolio (if has_pets + amount provided)
 *   - permit_fee_added_to_appfolio (if tenant_picked_up + amount provided)
 *
 * Returns the flipped set so the UI can surface exactly what was done.
 */
export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionId } = body;
    const petFeeAmount = body.petFeeAmount;
    const permitFeeAmount = body.permitFeeAmount;

    if (!submissionId) {
      return NextResponse.json({ success: false, message: 'submissionId required' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const actor = sessionUser?.displayName || body.by || 'Admin';
    const now = new Date().toISOString();

    // Fetch current state so we only flip what's pending + applicable
    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !sub) {
      return NextResponse.json(
        { success: false, message: fetchErr?.message || 'Submission not found' },
        { status: 404 }
      );
    }

    if (sub.permit_revoked) {
      return NextResponse.json(
        { success: false, message: 'Cannot sync a revoked permit; handle move-out flow first.' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const flipped: string[] = [];

    // ---------- Documents ----------
    const docColumns: Array<{ file: string; flag: string; key: string }> = [
      { file: 'pet_addendum_file', flag: 'pet_addendum_uploaded_to_appfolio', key: 'pet_addendum' },
      { file: 'vehicle_addendum_file', flag: 'vehicle_addendum_uploaded_to_appfolio', key: 'vehicle_addendum' },
      { file: 'insurance_file', flag: 'insurance_uploaded_to_appfolio', key: 'insurance' },
    ];

    for (const col of docColumns) {
      if (sub[col.file] && !sub[col.flag]) {
        updateData[col.flag] = true;
        updateData[`${col.flag}_at`] = now;
        updateData[`${col.flag}_by`] = actor;
        flipped.push(col.key);
      }
    }

    // ESA docs — array column, flip uploaded flag if any doc present
    const exemptionDocs = Array.isArray(sub.exemption_documents)
      ? sub.exemption_documents.filter((d: unknown) => typeof d === 'string' && d.length > 0)
      : [];
    if (exemptionDocs.length > 0 && !sub.esa_doc_uploaded_to_appfolio) {
      updateData.esa_doc_uploaded_to_appfolio = true;
      updateData.esa_doc_uploaded_to_appfolio_at = now;
      updateData.esa_doc_uploaded_to_appfolio_by = actor;
      flipped.push('exemption_document');
    }

    // Pickup ID photo
    if (sub.pickup_id_photo && !sub.pickup_id_uploaded_to_appfolio) {
      updateData.pickup_id_uploaded_to_appfolio = true;
      updateData.pickup_id_uploaded_to_appfolio_at = now;
      updateData.pickup_id_uploaded_to_appfolio_by = actor;
      flipped.push('pickup_id');
    }

    // Permit entered (only if the permit was actually issued)
    if (sub.permit_issued && !sub.permit_entered_in_appfolio) {
      updateData.permit_entered_in_appfolio = true;
      updateData.permit_entered_in_appfolio_at = now;
      updateData.permit_entered_in_appfolio_by = actor;
      flipped.push('permit_entered');
    }

    // ---------- Fees ----------
    if (sub.has_pets && !sub.pet_fee_added_to_appfolio) {
      if (petFeeAmount !== undefined && petFeeAmount !== null && petFeeAmount !== '') {
        const parsed = parseFloat(String(petFeeAmount));
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json(
            { success: false, message: 'Invalid petFeeAmount' },
            { status: 400 }
          );
        }
        updateData.pet_fee_added_to_appfolio = true;
        updateData.pet_fee_added_to_appfolio_at = now;
        updateData.pet_fee_added_to_appfolio_by = actor;
        updateData.pet_fee_amount = parsed;
        flipped.push('pet_fee');
      }
    }

    // Permit fee — only for tenants who actually picked up
    if (sub.tenant_picked_up && !sub.permit_fee_added_to_appfolio) {
      if (permitFeeAmount !== undefined && permitFeeAmount !== null && permitFeeAmount !== '') {
        const parsed = parseFloat(String(permitFeeAmount));
        if (isNaN(parsed) || parsed < 0) {
          return NextResponse.json(
            { success: false, message: 'Invalid permitFeeAmount' },
            { status: 400 }
          );
        }
        updateData.permit_fee_added_to_appfolio = true;
        updateData.permit_fee_added_to_appfolio_at = now;
        updateData.permit_fee_added_to_appfolio_by = actor;
        updateData.permit_fee_amount = parsed;
        flipped.push('permit_fee');
      }
    }

    if (flipped.length === 0) {
      return NextResponse.json({
        success: true,
        flipped: [],
        message: 'Nothing to flip — tenant already fully synced or missing the data required.',
      });
    }

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateErr) {
      console.error('mark-tenant-synced update error:', updateErr);
      return NextResponse.json(
        { success: false, message: 'Failed to update submission' },
        { status: 500 }
      );
    }

    // One audit entry summarizing the bulk action
    await logAudit(
      sessionUser,
      'appfolio.tenant_synced',
      'submission',
      submissionId,
      { flipped, actor },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data: updated, flipped });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to sync tenant';
    console.error('mark-tenant-synced exception:', error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
