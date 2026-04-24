import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * POST /api/hach/admin/users/[id]/deactivate
 * Soft-deactivates a HACH user. Requires hach_admin.
 * Cannot deactivate your own account.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireHachUser();
  if (guard) return guard;
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.user_type !== 'hach_admin') {
    return NextResponse.json({ success: false, message: 'HACH admin access required' }, { status: 403 });
  }

  const { id } = params;

  if (id === sessionUser.userId) {
    return NextResponse.json(
      { success: false, message: 'Cannot deactivate your own account' },
      { status: 400 }
    );
  }

  try {
    const { data: target, error: targetErr } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name, user_type, deactivated_at')
      .eq('id', id)
      .in('user_type', ['hach_admin', 'hach_reviewer'])
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ success: false, message: 'HACH user not found' }, { status: 404 });
    }

    if ((target as any).deactivated_at) {
      return NextResponse.json({ success: false, message: 'User is already deactivated' }, { status: 409 });
    }

    const { error: updateErr } = await supabaseAdmin
      .from('admin_users')
      .update({ deactivated_at: new Date().toISOString(), is_active: false })
      .eq('id', id);

    if (updateErr) {
      return NextResponse.json({ success: false, message: updateErr.message }, { status: 500 });
    }

    await logAudit(sessionUser, 'user.deactivated', 'admin_user', id, {
      target_name: (target as any).display_name,
      target_user_type: (target as any).user_type,
    }, getClientIp(request));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[hach/admin/users/deactivate] error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
