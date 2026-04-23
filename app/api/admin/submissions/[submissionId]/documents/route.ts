import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { submissionId } = await params;

    // Verify submission exists and is per_document
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, review_granularity, tenant_name, building_address, unit_number, form_data')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (submission.review_granularity !== 'per_document') {
      return NextResponse.json(
        { success: false, message: 'Submission uses atomic review — use the standard submission endpoint' },
        { status: 400 }
      );
    }

    // Fetch all document slots
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('*')
      .eq('form_submission_id', submissionId)
      .order('display_order', { ascending: true })
      .order('person_slot', { ascending: true });

    if (docsError) throw docsError;

    // Fetch all revision history for these documents in one query
    const documentIds = (documents ?? []).map(d => d.id);
    let revisions: any[] = [];
    if (documentIds.length > 0) {
      const { data: revData, error: revError } = await supabaseAdmin
        .from('form_submission_document_revisions')
        .select('*')
        .in('document_id', documentIds)
        .order('revision', { ascending: true });

      if (revError) throw revError;
      revisions = revData ?? [];
    }

    // Group revisions by document_id
    const revisionsByDoc = revisions.reduce<Record<string, any[]>>((acc, rev) => {
      if (!acc[rev.document_id]) acc[rev.document_id] = [];
      acc[rev.document_id].push(rev);
      return acc;
    }, {});

    const documentsWithRevisions = (documents ?? []).map(doc => ({
      ...doc,
      revisions: revisionsByDoc[doc.id] ?? [],
    }));

    return NextResponse.json({
      success: true,
      data: {
        submission_id: submissionId,
        tenant_name: submission.tenant_name,
        building_address: submission.building_address,
        unit_number: submission.unit_number,
        form_data: submission.form_data,
        documents: documentsWithRevisions,
      },
    });
  } catch (error: any) {
    console.error('Admin submission documents fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
