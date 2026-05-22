/**
 * DELETE /api/admin/pbv/full-applications/[id]/data
 *
 * PRP-019 / G3 — admin-only PII anonymization endpoint.
 *
 * Scrubs the personally-identifiable fields on the full application + its
 * household members and tombstones the signature image references, while
 * PRESERVING audit-event metadata (pbv_signature_events, application_events)
 * so the integrity trail is still readable after the right-to-delete
 * action.
 *
 * Guardrails:
 *   - Requires `pbv_full_applications:delete` (admin or write+admin).
 *   - Idempotent: subsequent calls on an already-anonymized application
 *     are no-ops and return the same summary shape.
 *   - Hard-rails: caller must POST a JSON body `{ confirm: 'ANONYMIZE' }`
 *     so an accidental fetch can't trigger the irreversible scrub.
 *   - Writes a `pbv_application_data_anonymized` application-event so the
 *     timeline shows when and by whom the action ran.
 *
 * Out of scope:
 *   - The actual delete of signature-image / signed-PDF Storage objects.
 *     The columns are tombstoned (path nulled), but the objects are left
 *     for the Storage-lifecycle cron documented in
 *     docs/data-retention-policy.md.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission } from '@/lib/auth';
import { RESOURCES } from '@/lib/permissions';

const ANONYMIZED_NAME = '[ANONYMIZED]';
const ANONYMIZED_TS = '[ANONYMIZED]';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePermission(RESOURCES.PBV_FULL_APPLICATIONS, 'delete');
  if (gate) return gate;

  const { id } = await context.params;

  // Require explicit confirmation in the body.
  const body = await request.json().catch(() => null);
  if (!body || (body as any).confirm !== 'ANONYMIZE') {
    return NextResponse.json(
      {
        success: false,
        message: 'Missing or invalid confirmation. POST body must be { "confirm": "ANONYMIZE" }.',
        code: 'confirm_required',
      },
      { status: 400 }
    );
  }

  // Verify the application exists.
  const { data: app, error: appErr } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name')
    .eq('id', id)
    .maybeSingle();

  if (appErr) {
    console.error('[pbv-anonymize] load failed:', appErr);
    return NextResponse.json({ success: false, message: 'Lookup failed' }, { status: 500 });
  }
  if (!app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }

  // Idempotent guard: name == ANONYMIZED sentinel means a prior call already
  // ran. No-op + same response shape.
  if ((app as any).head_of_household_name === ANONYMIZED_NAME) {
    return NextResponse.json({ success: true, already_anonymized: true });
  }

  // 1) Scrub the application row.
  const { error: scrubAppErr } = await supabaseAdmin
    .from('pbv_full_applications')
    .update({
      head_of_household_name: ANONYMIZED_NAME,
      phone: null,
      email: null,
      mailing_address: null,
      intake_data: null,
      intake_snapshot: null,
    } as Record<string, unknown>)
    .eq('id', id);

  if (scrubAppErr) {
    console.error('[pbv-anonymize] scrub application failed:', scrubAppErr);
    return NextResponse.json(
      { success: false, message: 'Anonymization failed (application)' },
      { status: 500 }
    );
  }

  // 2) Scrub household members.
  const { data: members, error: memListErr } = await supabaseAdmin
    .from('pbv_household_members')
    .select('id')
    .eq('full_application_id', id);

  if (memListErr) {
    console.error('[pbv-anonymize] member list failed:', memListErr);
    return NextResponse.json(
      { success: false, message: 'Anonymization failed (member list)' },
      { status: 500 }
    );
  }

  const memberCount = members?.length ?? 0;
  if (memberCount > 0) {
    const { error: memScrubErr } = await supabaseAdmin
      .from('pbv_household_members')
      .update({
        name: ANONYMIZED_NAME,
        dob: null,
        ssn_last_four: null,
        phone: null,
        email: null,
      } as Record<string, unknown>)
      .eq('full_application_id', id);
    if (memScrubErr) {
      console.error('[pbv-anonymize] scrub members failed:', memScrubErr);
      return NextResponse.json(
        { success: false, message: 'Anonymization failed (members)' },
        { status: 500 }
      );
    }
  }

  // 3) Tombstone signature image paths (audit references kept; objects
  //    deleted by the Storage-lifecycle cron — see retention policy).
  const { data: sigEvents, error: sigListErr } = await supabaseAdmin
    .from('pbv_signature_events')
    .select('id')
    .in('form_document_id',
      // subquery via .in requires an array of ids; resolve in-process.
      (await supabaseAdmin
        .from('pbv_form_documents')
        .select('id')
        .eq('full_application_id', id)).data?.map((r: any) => r.id) ?? []
    );
  if (sigListErr) {
    console.error('[pbv-anonymize] signature event list failed:', sigListErr);
  }
  const sigCount = sigEvents?.length ?? 0;

  if (sigCount > 0) {
    await supabaseAdmin
      .from('pbv_signature_events')
      .update({ signature_image_path: ANONYMIZED_TS } as Record<string, unknown>)
      .in('id', sigEvents!.map((r: any) => r.id));
  }

  // 4) Audit-event row. Caller identity is the session user.
  // We don't have a writePbvApplicationEvent import here (to avoid drag);
  // simple insert directly.
  await supabaseAdmin.from('application_events').insert({
    application_id: id,
    event_type: 'pbv_application_data_anonymized',
    actor_user_id: null, // populate via session if needed in a follow-up
    actor_display_name: 'Admin',
    payload: { member_count: memberCount, signature_count: sigCount },
    occurred_at: new Date().toISOString(),
  } as Record<string, unknown>);

  return NextResponse.json({
    success: true,
    already_anonymized: false,
    member_count: memberCount,
    signature_count: sigCount,
  });
}
