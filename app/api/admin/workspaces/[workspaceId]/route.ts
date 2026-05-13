/**
 * GET /api/admin/workspaces/[workspaceId]
 * Returns workspace metadata, parties, and unread counts for Stanton-accessible channels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { resolveStantonWorkspace } from '@/lib/workspaces/scope';
import { supabaseAdmin } from '@/lib/supabase';
import { WorkspaceUnreadCounts } from '@/lib/workspaces/types';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  // Auth check
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Stanton-only check
  if (sessionUser.user_type === 'hach_admin' || sessionUser.user_type === 'hach_reviewer') {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { workspaceId } = await params;

  // Resolve workspace (enforces scope access)
  const resolved = await resolveStantonWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { workspace, parties } = resolved;

  // Calculate unread counts for Stanton-accessible channels
  const unreadCounts: WorkspaceUnreadCounts = {
    stanton: null,
    hach: null, // Stanton cannot access HACH-private
    shared: null,
  };

  // Get last read timestamps for this user
  const { data: receipts } = await supabaseAdmin
    .from('workspace_read_receipts')
    .select('channel, last_read_at')
    .eq('user_id', sessionUser.userId)
    .eq('workspace_id', workspaceId)
    .in('channel', ['stanton', 'shared']);

  const receiptMap = new Map((receipts ?? []).map((r) => [r.channel, r.last_read_at]));

  // Count unread in stanton channel
  const { count: stantonTotal } = await supabaseAdmin
    .from('stanton_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const lastReadStanton = receiptMap.get('stanton');
  if (lastReadStanton) {
    const { count: stantonRead } = await supabaseAdmin
      .from('stanton_workspace_messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .lte('created_at', lastReadStanton);
    unreadCounts.stanton = (stantonTotal ?? 0) - (stantonRead ?? 0);
  } else {
    unreadCounts.stanton = stantonTotal ?? 0;
  }

  // Exclude user's own messages from their unread count
  const { count: ownStantonMessages } = await supabaseAdmin
    .from('stanton_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('author_user_id', sessionUser.userId);
  unreadCounts.stanton = Math.max(0, (unreadCounts.stanton ?? 0) - (ownStantonMessages ?? 0));

  // Count unread in shared channel
  const { count: sharedTotal } = await supabaseAdmin
    .from('shared_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const lastReadShared = receiptMap.get('shared');
  if (lastReadShared) {
    const { count: sharedRead } = await supabaseAdmin
      .from('shared_workspace_messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .lte('created_at', lastReadShared);
    unreadCounts.shared = (sharedTotal ?? 0) - (sharedRead ?? 0);
  } else {
    unreadCounts.shared = sharedTotal ?? 0;
  }

  // Exclude user's own messages from their unread count
  const { count: ownSharedMessages } = await supabaseAdmin
    .from('shared_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('author_user_id', sessionUser.userId);
  unreadCounts.shared = Math.max(0, (unreadCounts.shared ?? 0) - (ownSharedMessages ?? 0));

  return NextResponse.json({
    success: true,
    data: {
      workspace,
      parties,
      unread_counts: unreadCounts,
    },
  });
}
