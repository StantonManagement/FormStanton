/**
 * GET/POST /api/hach/workspaces/[workspaceId]/channel/shared/messages
 * Shared channel — both HACH and Stanton read/write. Institutional record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { resolveHachWorkspace } from '@/lib/workspaces/scope';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { safeHachJson } from '@/lib/hach/payload-filter';

export const dynamic = 'force-dynamic';

// GET — list shared messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = await params;

  const resolved = await resolveHachWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  // Optional document_id filter
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('document_id');

  let query = supabaseAdmin
    .from('shared_workspace_messages')
    .select('id, workspace_id, document_id, author_user_id, author_display_name, author_party_org, body, created_at, edited_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (documentId) {
    query = query.eq('document_id', documentId);
  }

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    data: safeHachJson(messages ?? []),
  });
}

// POST — create new shared message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { workspaceId } = await params;

  const resolved = await resolveHachWorkspace(workspaceId, sessionUser);
  if (!resolved) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.body !== 'string' || body.body.trim().length === 0) {
    return NextResponse.json({ success: false, message: 'Message body is required' }, { status: 400 });
  }

  const documentId = body.document_id || null;

  // Insert message with explicit author_party_org = 'hach'
  const { data: message, error } = await supabaseAdmin
    .from('shared_workspace_messages')
    .insert({
      workspace_id: workspaceId,
      document_id: documentId,
      author_user_id: sessionUser.userId,
      author_display_name: sessionUser.displayName,
      author_party_org: 'hach',
      body: body.body.trim(),
    })
    .select('id, workspace_id, document_id, author_user_id, author_display_name, author_party_org, body, created_at, edited_at')
    .single();

  if (error || !message) {
    return NextResponse.json(
      { success: false, message: error?.message ?? 'Failed to create message' },
      { status: 500 }
    );
  }

  // Audit log
  await logAudit(
    sessionUser,
    'workspace_message_post',
    'shared_workspace_message',
    message.id,
    { workspace_id: workspaceId, document_id: documentId, channel: 'shared', author_party_org: 'hach' },
    getClientIp(request)
  );

  return NextResponse.json({
    success: true,
    data: safeHachJson(message),
  });
}
