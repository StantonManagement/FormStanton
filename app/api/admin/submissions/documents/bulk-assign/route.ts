import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
export const dynamic = 'force-dynamic';

interface BulkAssignResult {
  id: string;
  ok: boolean;
  reason?: string;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
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

    // If assigning to a specific user, validate they exist and are active
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

    // Fetch all documents with their application context
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, form_submission_id, doc_type, label, assigned_to_user_id, status')
      .in('id', documentIds);

    if (docsError) throw docsError;

    const docMap = new Map(docs?.map((d) => [d.id, d]) ?? []);

    // Process each document
    const results: BulkAssignResult[] = [];
    const now = new Date().toISOString();

    for (const docId of documentIds) {
      const doc = docMap.get(docId);
      if (!doc) {
        results.push({ id: docId, ok: false, reason: 'Document not found' });
        continue;
      }

      // Update the document assignment
      const { error: updateError } = await supabaseAdmin
        .from('form_submission_documents')
        .update({
          assigned_to_user_id: targetUserId,
          assigned_at: now,
          assigned_by_user_id: sessionUser.userId,
        })
        .eq('id', docId);

      if (updateError) {
        results.push({ id: docId, ok: false, reason: updateError.message });
        continue;
      }

      results.push({ id: docId, ok: true });
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        total: documentIds.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
      },
    });
  } catch (error: any) {
    console.error('[bulk-assign] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
