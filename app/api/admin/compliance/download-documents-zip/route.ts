import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import JSZip from 'jszip';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { submissionId, submissionIds } = body;

    // Determine the list of IDs to process
    const ids: string[] = submissionIds
      ? (Array.isArray(submissionIds) ? submissionIds : [submissionIds])
      : submissionId
        ? [submissionId]
        : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Submission ID(s) required' },
        { status: 400 }
      );
    }

    // Fetch all submissions
    const { data: submissions, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('id, full_name, unit_number, pet_addendum_file, vehicle_addendum_file, insurance_file')
      .in('id', ids);

    if (fetchError || !submissions || submissions.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No submissions found' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const isBulk = submissions.length > 1;
    let totalDocs = 0;

    for (const submission of submissions) {
      const safeName = submission.full_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
      const safeUnit = submission.unit_number?.replace(/[^a-zA-Z0-9]/g, '_') || 'NoUnit';
      const folderPrefix = isBulk ? `Unit_${safeUnit}_${safeName}/` : '';

      const documents: Array<{ path: string; name: string }> = [];

      if (submission.pet_addendum_file) {
        documents.push({ path: submission.pet_addendum_file, name: 'Pet_Addendum.pdf' });
      }
      if (submission.vehicle_addendum_file) {
        documents.push({ path: submission.vehicle_addendum_file, name: 'Vehicle_Addendum.pdf' });
      }
      if (submission.insurance_file) {
        const ext = submission.insurance_file.split('.').pop() || 'pdf';
        documents.push({ path: submission.insurance_file, name: `Insurance.${ext}` });
      }

      for (const doc of documents) {
        try {
          const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('submissions')
            .download(doc.path);

          if (downloadError || !fileData) {
            console.error(`Failed to download ${doc.name} for ${submission.id}:`, downloadError);
            continue;
          }

          const arrayBuffer = await fileData.arrayBuffer();
          zip.file(`${folderPrefix}${doc.name}`, arrayBuffer);
          totalDocs++;
        } catch (error) {
          console.error(`Error processing ${doc.name} for ${submission.id}:`, error);
        }
      }
    }

    if (totalDocs === 0) {
      return NextResponse.json(
        { success: false, message: 'No documents available to download' },
        { status: 404 }
      );
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create filename
    const filename = isBulk
      ? `Documents_${submissions.length}_tenants.zip`
      : (() => {
          const s = submissions[0];
          const sn = s.full_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
          const su = s.unit_number?.replace(/[^a-zA-Z0-9]/g, '_') || 'NoUnit';
          return `${sn}_Unit${su}_Documents.zip`;
        })();

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error: any) {
    console.error('Download documents ZIP error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create document archive' },
      { status: 500 }
    );
  }
}
