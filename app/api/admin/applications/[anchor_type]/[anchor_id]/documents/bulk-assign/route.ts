import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { logAudit, getClientIp } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface BulkAssignResult {
  id: string;
  ok: boolean;
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id } = await params;

    const body = await request.json().catch(() => ({}));
    const {
      document_ids: documentIds,
      user_id: targetUserId,
    }: { document_ids: string[]; user_id: string | null } = body;

    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'document_ids array is required' },
        { status: 400 }
      );
    }

    // Validate target user if assigning
    let targetUserName: string | null = null;
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

      targetUserName = targetUser.display_name;
    }

    // Fetch all documents — verified they belong to this anchor
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, assigned_to_user_id, status')
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .in('id', documentIds);

    if (docsError) throw docsError;

    const docMap = new Map((docs ?? []).map((d) => [d.id, d]));

    const results: BulkAssignResult[] = [];
    const now = new Date().toISOString();
    let successCount = 0;

    for (const docId of documentIds) {
      const doc = docMap.get(docId);
      if (!doc) {
        results.push({ id: docId, ok: false, reason: 'Document not found or does not belong to this application' });
        continue;
      }

      const fromUserId = doc.assigned_to_user_id;

      const { error: updateError } = await supabaseAdmin
        .from('application_documents')
        .update({
          assigned_to_user_id: targetUserId,
          assigned_at: now,
          assigned_by_user_id: sessionUser.userId,
        })
        .eq('id', docId)
        .eq('anchor_type', anchor_type)
        .eq('anchor_id', anchor_id);

      if (updateError) {
        results.push({ id: docId, ok: false, reason: updateError.message });
        continue;
      }

      await writePbvApplicationEvent({
        applicationId: anchor_id,
        eventType: ApplicationEventType.DOC_ASSIGNED,
        actorUserId: sessionUser.userId,
        actorDisplayName: sessionUser.displayName,
        documentId: docId,
        payload: {
          from_user_id: fromUserId,
          to_user_id: targetUserId,
          note: null,
          doc_type: doc.doc_type,
          label: doc.label,
        },
      });

      results.push({ id: docId, ok: true });
      successCount++;
    }

    // Post one summary workspace message if any succeeded
    if (successCount > 0) {
      const messageBody = targetUserId
        ? `${sessionUser.displayName} assigned ${successCount} doc${successCount !== 1 ? 's' : ''} to ${targetUserName}.`
        : `${sessionUser.displayName} unassigned ${successCount} doc${successCount !== 1 ? 's' : ''}.`;

      await supabaseAdmin.from('stanton_workspace_messages').insert({
        workspace_id: anchor_id,
        author_user_id: null,
        author_display_name: 'System',
        author_party_org: 'stanton',
        body: messageBody,
      });
    }

    await logAudit(
      sessionUser,
      'documents.bulk_assign',
      anchor_type,
      anchor_id,
      { document_ids: documentIds, to_user_id: targetUserId, succeeded: successCount },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: documentIds.length,
        succeeded: successCount,
        failed: results.filter((r) => !r.ok).length,
      },
    });
  } catch (error: any) {
    console.error('[applications bulk-assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
