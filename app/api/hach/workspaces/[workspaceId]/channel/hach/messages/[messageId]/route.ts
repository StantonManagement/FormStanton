/**
 * PATCH /api/hach/workspaces/[workspaceId]/channel/hach/messages/[messageId]
 * Edit a HACH-private message — only author can edit within 5-minute window.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { resolveHachWorkspace } from '@/lib/workspaces/scope';
import { isEditWindowOpen } from '@/lib/workspaces/edit-window';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { safeHachJson } from '@/lib/hach/payload-filter';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string; messageId: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId, messageId } = await params;

  const resolved = await resolveHachWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  // Fetch the existing message
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('hach_workspace_messages')
    .select('id, author_user_id, body, created_at')
    .eq('id', messageId)
    .eq('workspace_id', workspaceId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ success: false, message: 'Message not found' }, { status: 404 });
  }

  // Author check
  if (existing.author_user_id !== sessionUser.userId) {
    return NextResponse.json(
      { success: false, message: 'Only the author can edit this message' },
      { status: 403 }
    );
  }

  // Edit window check
  if (!isEditWindowOpen(existing.created_at)) {
    return NextResponse.json(
      { success: false, message: 'Edit window expired' },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
    return NextResponse.json({ success: false, message: 'Message body is required' }, { status: 400 });
  }

  // Update the message
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('hach_workspace_messages')
    .update({
      body: body.body.trim(),
      edited_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('workspace_id', workspaceId)
    .select('id, workspace_id, document_id, author_user_id, author_display_name, author_party_org, body, created_at, edited_at')
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      { success: false, message: updateError?.message ?? 'Failed to update message' },
      { status: 500 }
    );
  }

  // Audit log
  await logAudit(
    sessionUser,
    'workspace_message_edit',
    'hach_workspace_message',
    messageId,
    { workspace_id: workspaceId, channel: 'hach' },
    getClientIp(request)
  );

  return NextResponse.json({
    success: true,
    data: safeHachJson(updated),
  });
}
