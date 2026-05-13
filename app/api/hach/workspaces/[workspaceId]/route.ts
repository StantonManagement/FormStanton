/**
 * GET /api/hach/workspaces/[workspaceId]
 * Returns workspace metadata, parties, and unread counts for HACH-accessible channels.
 * Wrapped with safeHachJson for payload filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { resolveHachWorkspace } from '@/lib/workspaces/scope';
import { supabaseAdmin } from '@/lib/supabase';
import { WorkspaceUnreadCounts } from '@/lib/workspaces/types';
import { safeHachJson } from '@/lib/hach/payload-filter';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  // HACH-only guard
  const guard = await requireHachUser();
  if (guard) return guard;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = await params;

  // Resolve workspace (enforces HACH scope access)
  const resolved = await resolveHachWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const { workspace, parties } = resolved;

  // Calculate unread counts for HACH-accessible channels
  const unreadCounts: WorkspaceUnreadCounts = {
    stanton: null, // HACH cannot access Stanton-private
    hach: null,
    shared: null,
  };

  // Get last read timestamps for this user
  const { data: receipts } = await supabaseAdmin
    .from('workspace_read_receipts')
    .select('channel, last_read_at')
    .eq('user_id', sessionUser.userId)
    .eq('workspace_id', workspaceId)
    .in('channel', ['hach', 'shared']);

  const receiptMap = new Map((receipts ?? []).map((r) => [r.channel, r.last_read_at]));

  // Count unread in hach channel
  const { count: hachTotal } = await supabaseAdmin
    .from('hach_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  const lastReadHach = receiptMap.get('hach');
  if (lastReadHach) {
    const { count: hachRead } = await supabaseAdmin
      .from('hach_workspace_messages')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .lte('created_at', lastReadHach);
    unreadCounts.hach = (hachTotal ?? 0) - (hachRead ?? 0);
  } else {
    unreadCounts.hach = hachTotal ?? 0;
  }

  // Exclude user's own messages from their unread count
  const { count: ownHachMessages } = await supabaseAdmin
    .from('hach_workspace_messages')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('author_user_id', sessionUser.userId);
  unreadCounts.hach = Math.max(0, (unreadCounts.hach ?? 0) - (ownHachMessages ?? 0));

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
    data: safeHachJson({
      workspace,
      parties,
      unread_counts: unreadCounts,
    }),
  });
}
