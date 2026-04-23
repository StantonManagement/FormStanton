import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submissionIds } = body as { submissionIds: string[] };

    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'submissionIds array is required' },
        { status: 400 }
      );
    }

    const { data: submissions, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, tenant_name, building_address, unit_number, form_type, review_granularity')
      .in('id', submissionIds);

    if (subError) throw subError;

    const eligible = (submissions ?? []).filter((s) => s.review_granularity === 'per_document');

    if (eligible.length === 0) {
      return NextResponse.json(
        { success: false, message: 'None of the selected submissions are per_document type' },
        { status: 400 }
      );
    }

    const zip = new JSZip();

    const csvLines = [
      'submission_id,tenant_name,doc_type,label,person_slot,revision,status,file_name,reviewer,reviewed_at,rejection_reason',
    ];

    for (const submission of eligible) {
      const { data: documents, error: docsError } = await supabaseAdmin
        .from('form_submission_documents')
        .select(
          'id, doc_type, label, person_slot, revision, status, file_name, storage_path, reviewer, reviewed_at, rejection_reason'
        )
        .eq('form_submission_id', submission.id)
        .order('display_order', { ascending: true })
        .order('person_slot', { ascending: true });

      if (docsError) {
        console.error(`Failed to fetch documents for submission ${submission.id}:`, docsError);
        continue;
      }

      const exportable = (documents ?? []).filter(
        (d) =>
          d.storage_path &&
          (d.status === 'approved' || d.status === 'waived' || d.status === 'submitted')
      );

      const safeLabel = (submission.tenant_name ?? submission.id)
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
      const folderName = `${safeLabel}_${submission.id.slice(0, 8)}`;

      for (const doc of exportable) {
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('form-submissions')
          .download(doc.storage_path);

        if (downloadError) {
          console.error(`Failed to download ${doc.storage_path}:`, downloadError);
          continue;
        }

        const buffer = await fileData.arrayBuffer();
        zip.file(`${folderName}/${doc.file_name}`, buffer);

        csvLines.push(
          [
            submission.id,
            `"${(submission.tenant_name ?? '').replace(/"/g, '""')}"`,
            doc.doc_type,
            `"${doc.label.replace(/"/g, '""')}"`,
            doc.person_slot,
            doc.revision,
            doc.status,
            doc.file_name,
            doc.reviewer ?? '',
            doc.reviewed_at ?? '',
            doc.rejection_reason ? `"${doc.rejection_reason.replace(/"/g, '""')}"` : '',
          ].join(',')
        );
      }
    }

    zip.file('manifest.csv', csvLines.join('\n'));

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' });

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const zipName = `bulk_export_${date}_${eligible.length}submissions.zip`;

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (error: any) {
    console.error('Bulk export error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
