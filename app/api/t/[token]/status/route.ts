import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: submission, error } = await supabaseAdmin
      .from('form_submissions')
      .select('id, form_type, tenant_name, building_address, unit_number, language, status, document_review_summary, submitted_at')
      .eq('tenant_access_token', token)
      .eq('review_granularity', 'per_document')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw error;
    }

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, required, display_order, person_slot, revision, status, file_name, rejection_reason, reviewed_at, scan_metadata')
      .eq('form_submission_id', submission.id)
      .order('display_order', { ascending: true })
      .order('person_slot', { ascending: true });

    if (docsError) throw docsError;

    return NextResponse.json({
      success: true,
      data: {
        submission,
        documents: documents ?? [],
      },
    });
  } catch (error: any) {
    console.error('Submission status lookup error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
