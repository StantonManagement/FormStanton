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
    const { submissionId } = body;

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID required' },
        { status: 400 }
      );
    }

    // Fetch submission to get document paths
    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('full_name, unit_number, pet_addendum_file, vehicle_addendum_file, insurance_file')
      .eq('id', submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const zip = new JSZip();
    const documents: Array<{ path: string; name: string }> = [];

    if (submission.pet_addendum_file) {
      documents.push({
        path: submission.pet_addendum_file,
        name: 'Pet_Addendum.pdf'
      });
    }

    if (submission.vehicle_addendum_file) {
      documents.push({
        path: submission.vehicle_addendum_file,
        name: 'Vehicle_Addendum.pdf'
      });
    }

    if (submission.insurance_file) {
      const ext = submission.insurance_file.split('.').pop() || 'pdf';
      documents.push({
        path: submission.insurance_file,
        name: `Insurance.${ext}`
      });
    }

    if (documents.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No documents available to download' },
        { status: 404 }
      );
    }

    // Download each document and add to ZIP
    for (const doc of documents) {
      try {
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
          .from('submissions')
          .download(doc.path);

        if (downloadError || !fileData) {
          console.error(`Failed to download ${doc.name}:`, downloadError);
          continue;
        }

        const arrayBuffer = await fileData.arrayBuffer();
        zip.file(doc.name, arrayBuffer);
      } catch (error) {
        console.error(`Error processing ${doc.name}:`, error);
      }
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // Create filename
    const safeName = submission.full_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown';
    const safeUnit = submission.unit_number?.replace(/[^a-zA-Z0-9]/g, '_') || 'NoUnit';
    const filename = `${safeName}_Unit${safeUnit}_Documents.zip`;

    return new NextResponse(zipBuffer, {
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
