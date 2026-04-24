import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * PATCH /api/admin/pbv/applications/[id]/assign
 *
 * Body: { assigned_to: string | null }
 * Assigns (or unassigns) a PBV application to a Stanton staff member.
 * Logs the change to audit_log with previous + new assignee.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const applicationId = params.id;

  let body: { assigned_to?: string | null } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const newAssignee = body.assigned_to ?? null;

  try {
    // Fetch current state for audit log
    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, assigned_to')
      .eq('id', applicationId)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const previousAssignee = current.assigned_to;

    // Validate new assignee is a real active stanton_staff user (if not null)
    if (newAssignee) {
      const { data: staff, error: staffErr } = await supabaseAdmin
        .from('admin_users')
        .select('id, display_name')
        .eq('id', newAssignee)
        .eq('user_type', 'stanton_staff')
        .is('deactivated_at', null)
        .single();

      if (staffErr || !staff) {
        return NextResponse.json({ success: false, message: 'Assignee not found or is not active Stanton staff' }, { status: 400 });
      }
    }

    // Apply update
    const { error: updateErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({
        assigned_to: newAssignee,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    // Audit log
    await logAudit(
      user,
      'pbv.application.assign',
      'pbv_full_applications',
      applicationId,
      { previous_assignee: previousAssignee, new_assignee: newAssignee },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: { id: applicationId, assigned_to: newAssignee } });
  } catch (error: any) {
    console.error('[assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
