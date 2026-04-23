import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

/**
 * POST /api/admin/compliance/tow-manual-entries/[id]/action
 * Body: { action: 'mark_towed' | 'clear' }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    if (!action || !['mark_towed', 'clear'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 });
    }

    const sessionUser = await getSessionUser();
    const by = sessionUser?.displayName || 'Admin';

    const updateData =
      action === 'mark_towed'
        ? { towed_at: new Date().toISOString(), towed_by: by }
        : { cleared_at: new Date().toISOString(), cleared_by: by };

    const { data, error } = await supabaseAdmin
      .from('tow_manual_entries')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('tow-manual-entries action error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update entry' }, { status: 500 });
    }

    await logAudit(
      sessionUser,
      action === 'mark_towed' ? 'tow.manual_towed' : 'tow.manual_cleared',
      'tow_manual_entries',
      id,
      { by },
      getClientIp(request),
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('tow-manual-entries action exception:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to update entry' }, { status: 500 });
  }
}
