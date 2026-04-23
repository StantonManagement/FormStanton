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
    const petIndexRaw = formData.get('petIndex');
    const petIndex = typeof petIndexRaw === 'string' ? Number(petIndexRaw) : null;

    if (!submissionId || !documentType || !file) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['pet_addendum', 'insurance', 'vehicle_addendum', 'pickup_id_photo', 'exemption_document', 'pet_vaccination_proof', 'pet_spay_neuter_proof'].includes(documentType)) {
      return NextResponse.json(
        { success: false, message: 'Invalid document type' },
        { status: 400 }
      );
    }

    if ((documentType === 'pet_vaccination_proof' || documentType === 'pet_spay_neuter_proof') && (petIndex === null || Number.isNaN(petIndex) || petIndex < 0)) {
      return NextResponse.json(
        { success: false, message: 'Missing or invalid pet index for pet proof document upload' },
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
      case 'exemption_document':
        storagePath = `exemptions/${submissionId}_exemption_${timestamp}.${fileExt}`;
        columnToUpdate = '__exemption_array__';
        break;
      case 'pet_vaccination_proof':
        storagePath = `pet_documents/${submissionId}_pet_${petIndex}_vaccination_${timestamp}.${fileExt}`;
        columnToUpdate = '__pet_array_doc__';
        break;
      case 'pet_spay_neuter_proof':
        storagePath = `pet_documents/${submissionId}_pet_${petIndex}_spay_neuter_${timestamp}.${fileExt}`;
        columnToUpdate = '__pet_array_doc__';
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
    let submission;
    let updateError;

    if (columnToUpdate === '__exemption_array__') {
      // Exemption documents: append to array and set status to pending
      const { data: existing } = await supabaseAdmin
        .from('submissions')
        .select('exemption_documents')
        .eq('id', submissionId)
        .single();

      const existingDocs = Array.isArray(existing?.exemption_documents) ? existing.exemption_documents : [];
      const updatedDocs = [...existingDocs, uploadData.path];

      const { data, error } = await supabaseAdmin
        .from('submissions')
        .update({
          exemption_documents: updatedDocs,
          exemption_status: existing?.exemption_documents?.length ? undefined : 'pending',
        })
        .eq('id', submissionId)
        .select()
        .single();

      submission = data;
      updateError = error;
    } else if (columnToUpdate === '__pet_array_doc__') {
      const { data: existing, error: existingError } = await supabaseAdmin
        .from('submissions')
        .select('pets')
        .eq('id', submissionId)
        .single();

      if (existingError) {
        console.error('Failed to load pets for document attach:', existingError);
        return NextResponse.json(
          { success: false, message: 'Failed to load pet records for this submission' },
          { status: 500 }
        );
      }

      const existingPets = Array.isArray(existing?.pets) ? [...existing.pets] : [];
      if (petIndex === null || petIndex >= existingPets.length) {
        return NextResponse.json(
          { success: false, message: 'Pet index is out of range for this submission' },
          { status: 400 }
        );
      }

      const currentPet = existingPets[petIndex] || {};
      existingPets[petIndex] = {
        ...currentPet,
        ...(documentType === 'pet_vaccination_proof' ? { pet_vaccination_file: uploadData.path } : {}),
        ...(documentType === 'pet_spay_neuter_proof' ? { pet_spay_neuter_file: uploadData.path } : {}),
      };

      const { data, error } = await supabaseAdmin
        .from('submissions')
        .update({ pets: existingPets })
        .eq('id', submissionId)
        .select()
        .single();

      submission = data;
      updateError = error;
    } else {
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

      // If pickup_id_photo, reset the AppFolio upload flag (new ID → must re-upload)
      if (documentType === 'pickup_id_photo') {
        updateData.pickup_id_uploaded_to_appfolio = false;
        updateData.pickup_id_uploaded_to_appfolio_at = null;
        updateData.pickup_id_uploaded_to_appfolio_by = null;
      }

      const { data, error } = await supabaseAdmin
        .from('submissions')
        .update(updateData)
        .eq('id', submissionId)
        .select()
        .single();

      submission = data;
      updateError = error;
    }

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
