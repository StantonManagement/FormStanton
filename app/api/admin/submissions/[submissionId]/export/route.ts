import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import JSZip from 'jszip';

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

    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, tenant_name, building_address, unit_number, form_type, review_granularity')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (submission.review_granularity !== 'per_document') {
      return NextResponse.json(
        { success: false, message: 'Export is only available for per_document submissions' },
        { status: 400 }
      );
    }

    const { data: documents, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, person_slot, revision, status, file_name, storage_path, reviewer, reviewed_at, rejection_reason')
      .eq('form_submission_id', submissionId)
      .order('display_order', { ascending: true })
      .order('person_slot', { ascending: true });

    if (docsError) throw docsError;

    const exportable = (documents ?? []).filter(
      d => d.storage_path && (d.status === 'approved' || d.status === 'waived' || d.status === 'submitted')
    );

    const zip = new JSZip();

    // Build manifest CSV
    const csvLines = [
      'submission_id,doc_type,label,person_slot,revision,status,file_name,reviewer,reviewed_at,rejection_reason',
    ];

    for (const doc of exportable) {
      // Download from storage
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('form-submissions')
        .download(doc.storage_path);

      if (downloadError) {
        console.error(`Failed to download ${doc.storage_path}:`, downloadError);
        continue;
      }

      const buffer = await fileData.arrayBuffer();
      zip.file(doc.file_name, buffer);

      csvLines.push(
        [
          submissionId,
          doc.doc_type,
          `"${doc.label}"`,
          doc.person_slot,
          doc.revision,
          doc.status,
          doc.file_name,
          doc.reviewer ?? '',
          doc.reviewed_at ?? '',
          doc.rejection_reason ? `"${doc.rejection_reason}"` : '',
        ].join(',')
      );
    }

    zip.file('manifest.csv', csvLines.join('\n'));

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const safeLabel = (submission.tenant_name ?? submissionId)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 50);
    const zipName = `submission_${safeLabel}.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error: any) {
    console.error('Submission export error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
