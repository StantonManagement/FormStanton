/**
 * POST /api/admin/workspaces/[workspaceId]/channel/[channel]/read
 * Mark a channel as read for the current Stanton user.
 * Valid channels: 'stanton', 'shared'
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { resolveStantonWorkspace } from '@/lib/workspaces/scope';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; channel: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.user_type === 'hach_admin' || sessionUser.user_type === 'hach_reviewer') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { workspaceId, channel } = await params;

  // Validate channel parameter
  if (channel !== 'stanton' && channel !== 'shared') {
    return NextResponse.json(
      { success: false, message: 'Invalid channel. Must be "stanton" or "shared"' },
      { status: 400 }
    );
  }

  const resolved = await resolveStantonWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  // Upsert read receipt
  const { error } = await supabaseAdmin
    .from('workspace_read_receipts')
    .upsert({
      user_id: sessionUser.userId,
      workspace_id: workspaceId,
      channel: channel,
      last_read_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,workspace_id,channel',
    });

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { marked_read: channel, at: new Date().toISOString() },
  });
}
