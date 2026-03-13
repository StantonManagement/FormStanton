import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { sanitizePlate } from '@/lib/plateSanitizer';

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

    if (!submissionId) {
      return NextResponse.json(
        { success: false, message: 'Submission ID is required' },
        { status: 400 }
      );
    }

    // Get current submission
    const { data: currentSubmission, error: fetchError } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('id', submissionId)
      .single();

    if (fetchError || !currentSubmission) {
      return NextResponse.json(
        { success: false, message: 'Submission not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    let hasUpdates = false;

    // Tenant info
    const fullName = formData.get('fullName') as string | null;
    if (fullName) {
      updateData.full_name = fullName;
      hasUpdates = true;
    }

    const phone = formData.get('phone') as string | null;
    if (phone !== null) {
      updateData.phone = phone;
      hasUpdates = true;
    }

    const email = formData.get('email') as string | null;
    if (email !== null) {
      updateData.email = email;
      hasUpdates = true;
    }

    // Vehicle information
    const vehicleMake = formData.get('vehicleMake') as string | null;
    const vehicleModel = formData.get('vehicleModel') as string | null;
    const vehicleYear = formData.get('vehicleYear') as string | null;
    const vehicleColor = formData.get('vehicleColor') as string | null;
    const vehiclePlate = formData.get('vehiclePlate') as string | null;
    const staffName = formData.get('staffName') as string | null;

    if (vehicleMake || vehicleModel || vehicleYear || vehicleColor || vehiclePlate) {
      updateData.has_vehicle = true;
      updateData.vehicle_make = vehicleMake;
      updateData.vehicle_model = vehicleModel;
      updateData.vehicle_year = vehicleYear ? parseInt(vehicleYear) : null;
      updateData.vehicle_color = vehicleColor;
      updateData.vehicle_plate = sanitizePlate(vehiclePlate);
      updateData.vehicle_submitted_by_phone = true;
      updateData.vehicle_phone_submission_date = new Date().toISOString();
      updateData.vehicle_phone_submission_by = staffName;
      updateData.vehicle_signature_date = new Date().toISOString().split('T')[0];
      hasUpdates = true;
    }

    // Insurance information
    const insuranceProvider = formData.get('insuranceProvider') as string | null;
    const insurancePolicyNumber = formData.get('insurancePolicyNumber') as string | null;

    if (insuranceProvider) {
      updateData.insurance_provider = insuranceProvider;
      updateData.has_insurance = true;
      hasUpdates = true;
    }

    if (insurancePolicyNumber) {
      updateData.insurance_policy_number = insurancePolicyNumber;
      updateData.has_insurance = true;
      hasUpdates = true;
    }

    // Pet document upload
    const petDocFile = formData.get('petDocument') as File | null;
    if (petDocFile) {
      const fileExt = petDocFile.name.split('.').pop();
      const fileName = `${submissionId}_pet_addendum.${fileExt}`;
      const buffer = await petDocFile.arrayBuffer();
      
      const { data: petUploadData, error: petUploadError } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`pets/${fileName}`, buffer, {
          contentType: petDocFile.type,
          upsert: true,
        });

      if (petUploadError) {
        console.error('Pet document upload error:', petUploadError);
        return NextResponse.json(
          { success: false, message: 'Failed to upload pet document' },
          { status: 500 }
        );
      }

      updateData.pet_addendum_file = petUploadData.path;
      updateData.has_pets = true;
      hasUpdates = true;
    }

    // Insurance document upload
    const insuranceDocFile = formData.get('insuranceDocument') as File | null;
    if (insuranceDocFile) {
      const fileExt = insuranceDocFile.name.split('.').pop();
      const fileName = `${submissionId}_insurance.${fileExt}`;
      const buffer = await insuranceDocFile.arrayBuffer();
      
      const { data: insuranceUploadData, error: insuranceUploadError } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`insurance/${fileName}`, buffer, {
          contentType: insuranceDocFile.type,
          upsert: true,
        });

      if (insuranceUploadError) {
        console.error('Insurance document upload error:', insuranceUploadError);
        return NextResponse.json(
          { success: false, message: 'Failed to upload insurance document' },
          { status: 500 }
        );
      }

      updateData.insurance_file = insuranceUploadData.path;
      updateData.insurance_upload_pending = false;
      updateData.has_insurance = true;
      hasUpdates = true;
    }

    if (!hasUpdates) {
      return NextResponse.json(
        { success: false, message: 'No updates provided' },
        { status: 400 }
      );
    }

    // Update the submission
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update(updateData)
      .eq('id', submissionId);

    if (updateError) {
      console.error('Submission update error:', updateError);
      return NextResponse.json(
        { success: false, message: 'Failed to update submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Submission updated successfully',
      updated: updateData,
    });

  } catch (error: any) {
    console.error('Update submission error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Update failed' },
      { status: 500 }
    );
  }
}
