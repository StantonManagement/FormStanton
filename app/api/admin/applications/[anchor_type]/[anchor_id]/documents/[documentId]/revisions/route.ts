import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string; documentId: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id, documentId } = await params;

    // Verify document belongs to the given anchor
    const { data: doc, error: docError } = await supabaseAdmin
      .from('application_documents')
      .select('id')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const { data: revisions, error } = await supabaseAdmin
      .from('application_document_revisions')
      .select('revision, file_name, storage_path, uploaded_by, uploaded_at, status_at_review, rejection_reason, reviewer, reviewed_at')
      .eq('application_document_id', documentId)
      .order('revision', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: revisions ?? [] });
  } catch (error: any) {
    console.error('GET /revisions error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
