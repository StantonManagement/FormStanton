import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * POST /api/admin/pbv/applications/bulk-assign
 *
 * Body: { application_ids: string[], assigned_to: string }
 * Bulk-assigns multiple applications to a Stanton staff member.
 * Logs each change to audit_log.
 */
export async function POST(request: NextRequest) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  let body: { application_ids?: string[]; assigned_to?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { application_ids, assigned_to } = body;

  if (!application_ids || !Array.isArray(application_ids) || application_ids.length === 0) {
    return NextResponse.json({ success: false, message: 'application_ids must be a non-empty array' }, { status: 400 });
  }
  if (!assigned_to) {
    return NextResponse.json({ success: false, message: 'assigned_to is required' }, { status: 400 });
  }

  try {
    // Validate assignee
    const { data: staff, error: staffErr } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name')
      .eq('id', assigned_to)
      .eq('user_type', 'stanton_staff')
      .is('deactivated_at', null)
      .single();

    if (staffErr || !staff) {
      return NextResponse.json(
        { success: false, message: 'Assignee not found or is not active Stanton staff' },
        { status: 400 }
      );
    }

    // Fetch previous assignees for audit log
    const { data: previous } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, assigned_to')
      .in('id', application_ids);

    const prevMap: Record<string, string | null> = {};
    for (const row of previous ?? []) prevMap[row.id] = row.assigned_to;

    // Apply bulk update
    const now = new Date().toISOString();
    const { error: updateErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ assigned_to, last_activity_at: now })
      .in('id', application_ids);

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    // Audit log each change (batch — one entry per application)
    const ip = getClientIp(request);
    await Promise.all(
      application_ids.map((appId) =>
        logAudit(
          user,
          'pbv.application.bulk_assign',
          'pbv_full_applications',
          appId,
          {
            previous_assignee: prevMap[appId] ?? null,
            new_assignee: assigned_to,
            new_assignee_name: staff.display_name,
          },
          ip
        )
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        assigned_count: application_ids.length,
        assigned_to,
        assigned_to_name: staff.display_name,
      },
    });
  } catch (error: any) {
    console.error('[bulk-assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
