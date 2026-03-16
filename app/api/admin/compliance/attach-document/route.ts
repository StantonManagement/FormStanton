import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const submissionId = formData.get('submissionId') as string;
    const documentType = formData.get('documentType') as string;
    const file = formData.get('file') as File;

    if (!submissionId || !documentType || !file) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['pet_addendum', 'insurance', 'vehicle_addendum', 'pickup_id_photo'].includes(documentType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid document type' },
        { status: 400 }
      );
    }

    // Generate file path and column to update based on document type
    let storagePath: string;
    let columnToUpdate: string;
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop() || 'pdf';

    switch (documentType) {
      case 'insurance':
        storagePath = `insurance/${submissionId}_${timestamp}.${fileExt}`;
        columnToUpdate = 'insurance_file';
        break;
      case 'pet_addendum':
        storagePath = `documents/${submissionId}_pet_addendum.${fileExt}`;
        columnToUpdate = 'pet_addendum_file';
        break;
      case 'vehicle_addendum':
        storagePath = `documents/${submissionId}_vehicle_addendum.${fileExt}`;
        columnToUpdate = 'vehicle_addendum_file';
        break;
      case 'pickup_id_photo':
        storagePath = `id_photos/${submissionId}_pickup_id_${timestamp}.${fileExt}`;
        columnToUpdate = 'pickup_id_photo';
        break;
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid document type' },
          { status: 400 }
        );
    }

    // Upload to Supabase Storage
    const buffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('submissions')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, message: 'Failed to upload file' },
        { status: 500 }
      );
    }

    // Get session user for metadata tracking
    const sessionUser = await getSessionUser();

    // Update submission record
    const updateData: any = {
      [columnToUpdate]: uploadData.path,
    };

    // If insurance file, also clear upload_pending flag
    if (documentType === 'insurance') {
      updateData.insurance_upload_pending = false;
    }

    // If vehicle addendum, capture upload metadata
    if (documentType === 'vehicle_addendum') {
      updateData.vehicle_addendum_file_uploaded_at = new Date().toISOString();
      updateData.vehicle_addendum_file_uploaded_by = sessionUser?.displayName || 'Admin';
    }

    const { data: submission, error: updateError } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId)
      .select()
      .single();

    if (updateError) {
      console.error('Submission update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update submission' },
        { status: 500 }
      );
    }
    await logAudit(sessionUser, 'document.attach', 'submission', submissionId, {
      documentType, fileName: file.name,
    }, getClientIp(request));

    return NextResponse.json({
      success: true,
      data: submission,
      filePath: uploadData.path,
    });

  } catch (error: any) {
    console.error('Attach document error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to attach document' },
      { status: 500 }
    );
  }
}
