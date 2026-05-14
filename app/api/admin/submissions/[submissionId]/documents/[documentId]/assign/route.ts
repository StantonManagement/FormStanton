import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { stantonWorkspaceClient } from '@/lib/workspaces/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { submissionId, documentId } = await params;
    const body = await request.json().catch(() => ({}));
    const { user_id: targetUserId, note }: { user_id: string | null; note?: string } = body;

    // Check for suppress_workspace_post query param (used by bulk callers)
    const { searchParams } = new URL(request.url);
    const suppressWorkspacePost = searchParams.get('suppress_workspace_post') === 'true';

    // Fetch the document with its application context
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, doc_type, label, assigned_to_user_id, status')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // If assigning to a specific user, validate they exist and are active
    if (targetUserId) {
      const { data: targetUser, error: userError } = await supabaseAdmin
        .from('admin_users')
        .select('id, display_name, is_active')
        .eq('id', targetUserId)
        .single();

      if (userError || !targetUser) {
        return NextResponse.json(
          { success: false, message: 'Target user not found' },
          { status: 400 }
        );
      }

      if (!targetUser.is_active) {
        return NextResponse.json(
          { success: false, message: 'Cannot assign to deactivated user' },
          { status: 400 }
        );
      }
    }

    // Get the current assigned user for the event
    const fromUserId = doc.assigned_to_user_id;

    // Update the document assignment
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from('form_submission_documents')
      .update({
        assigned_to_user_id: targetUserId,
        assigned_at: now,
        assigned_by_user_id: sessionUser.userId,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Fetch the full application ID for the event
    const { data: fullApp } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name')
      .eq('form_submission_id', submissionId)
      .single();

    // Write the doc_assigned event
    if (fullApp) {
      await writePbvApplicationEvent({
        applicationId: fullApp.id,
        eventType: ApplicationEventType.DOC_ASSIGNED,
        actorUserId: sessionUser.userId,
        actorDisplayName: sessionUser.displayName,
        documentId,
        payload: {
          from_user_id: fromUserId,
          to_user_id: targetUserId,
          note: note ?? null,
          doc_type: doc.doc_type,
          label: doc.label,
        },
      });
    }

    // Post workspace message (unless suppressed for bulk operations)
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

      // Post to Stanton-private workspace using admin API
      await supabaseAdmin.from('stanton_workspace_messages').insert({
        workspace_id: fullApp.id,
        author_user_id: null, // System message
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
    console.error('[document-assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
