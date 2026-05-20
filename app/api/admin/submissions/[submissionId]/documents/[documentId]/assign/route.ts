import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
