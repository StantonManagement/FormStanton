import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { submissionId, documentId } = await params;

    // Verify document belongs to submission
    const { data: doc, error: docError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id')
      .eq('id', documentId)
      .eq('form_submission_id', submissionId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const { data: revisions, error } = await supabaseAdmin
      .from('form_submission_document_revisions')
      .select('revision, file_name, storage_path, uploaded_by, uploaded_at, status_at_review, rejection_reason, reviewer, reviewed_at')
      .eq('document_id', documentId)
      .order('revision', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: revisions ?? [] });
  } catch (error: any) {
    console.error('GET /revisions error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
