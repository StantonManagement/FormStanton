import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id, documentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { user_id: targetUserId, note }: { user_id: string | null; note?: string } = body;

    const { searchParams } = new URL(request.url);
    const suppressWorkspacePost = searchParams.get('suppress_workspace_post') === 'true';

    const { data: doc, error: docError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, assigned_to_user_id')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    if (targetUserId) {
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from('admin_users')
        .select('id, display_name, is_active')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 400 });
      }

      if (!targetUser.is_active) {
        return NextResponse.json({ success: false, message: 'Cannot assign to deactivated user' }, { status: 400 });
      }
    }

    const fromUserId = doc.assigned_to_user_id;
    const now = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        assigned_to_user_id: targetUserId,
        assigned_at: now,
        assigned_by_user_id: sessionUser.userId,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    const { data: fullApp } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name')
      .eq('id', anchor_id)
      .single();

    if (fullApp) {
      await writePbvApplicationEvent({
        applicationId: anchor_id,
        eventType: ApplicationEventType.DOC_ASSIGNED,
        actorUserId: sessionUser.userId,
        actorDisplayName: sessionUser.displayName,
        documentId,
        payload: {
          from_user_id: fromUserId ?? null,
          to_user_id: targetUserId,
          note: note ?? null,
          doc_type: doc.doc_type,
          label: doc.label,
        },
      });
    }

    if (!suppressWorkspacePost && fullApp) {
      const targetUserName = targetUserId
        ? (await supabaseAdmin.from('admin_users').select('display_name').eq('id', targetUserId).single())
            .data?.display_name ?? 'Unknown'
        : null;

      const fromUserName = fromUserId
        ? (await supabaseAdmin.from('admin_users').select('display_name').eq('id', fromUserId).single())
            .data?.display_name ?? 'Unknown'
        : null;

      const messageBody = targetUserId
        ? `${sessionUser.displayName} assigned '${doc.label}' to ${targetUserName}.`
        : fromUserName
          ? `${sessionUser.displayName} unassigned '${doc.label}' (was assigned to ${fromUserName}).`
          : `${sessionUser.displayName} unassigned '${doc.label}'.`;

      await supabaseAdmin.from('stanton_workspace_messages').insert({
        workspace_id: anchor_id,
        author_user_id: null,
        author_display_name: 'System',
        author_party_org: 'stanton',
        body: messageBody,
        document_id: documentId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        assigned_to_user_id: targetUserId,
        assigned_at: now,
        assigned_by_user_id: sessionUser.userId,
      },
    });
  } catch (error: any) {
    console.error('[application-doc-assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
