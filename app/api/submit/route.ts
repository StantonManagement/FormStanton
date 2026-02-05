import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import { 
  generateDocument, 
  preparePetTemplateData, 
  prepareTemplateData, 
  prepareVehicleTemplateData 
} from '@/lib/documentGenerator';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const formDataJson = JSON.parse(formData.get('formData') as string);
    const signaturesJson = JSON.parse(formData.get('signatures') as string);
    const language = formData.get('language') as string;

    const petVaccinationFile = formData.get('petVaccination') as File | null;
    const petPhotoFile = formData.get('petPhoto') as File | null;
    const insuranceProofFile = formData.get('insuranceProof') as File | null;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const submissionId = crypto.randomUUID();

    let petVaccinationPath = null;
    let petPhotoPath = null;
    let insuranceProofPath = null;
    let petSignaturePath = null;
    let vehicleSignaturePath = null;

    if (petVaccinationFile) {
      const fileName = `${submissionId}_vaccination.${petVaccinationFile.name.split('.').pop()}`;
      const buffer = await petVaccinationFile.arrayBuffer();
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`vaccinations/${fileName}`, buffer, {
          contentType: petVaccinationFile.type,
        });
      if (error) throw error;
      petVaccinationPath = data.path;
    }

    if (petPhotoFile) {
      const fileName = `${submissionId}_pet_photo.${petPhotoFile.name.split('.').pop()}`;
      const buffer = await petPhotoFile.arrayBuffer();
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`pet_photos/${fileName}`, buffer, {
          contentType: petPhotoFile.type,
        });
      if (error) throw error;
      petPhotoPath = data.path;
    }

    if (insuranceProofFile) {
      const fileName = `${submissionId}_insurance.${insuranceProofFile.name.split('.').pop()}`;
      const buffer = await insuranceProofFile.arrayBuffer();
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`insurance/${fileName}`, buffer, {
          contentType: insuranceProofFile.type,
        });
      if (error) throw error;
      insuranceProofPath = data.path;
    }

    if (signaturesJson.pet) {
      const base64Data = signaturesJson.pet.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${submissionId}_pet_signature.png`;
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`signatures/${fileName}`, buffer, {
          contentType: 'image/png',
        });
      if (error) throw error;
      petSignaturePath = data.path;
    }

    if (signaturesJson.vehicle) {
      const base64Data = signaturesJson.vehicle.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${submissionId}_vehicle_signature.png`;
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`signatures/${fileName}`, buffer, {
          contentType: 'image/png',
        });
      if (error) throw error;
      vehicleSignaturePath = data.path;
    }

    const { error: dbError } = await supabaseAdmin
      .from('submissions')
      .insert({
        id: submissionId,
        language,
        full_name: formDataJson.fullName,
        phone: formDataJson.phone,
        phone_is_new: formDataJson.phoneIsNew,
        building_address: formDataJson.buildingAddress,
        unit_number: formDataJson.unitNumber,
        has_pets: formDataJson.hasPets,
        pet_type: formDataJson.petType || null,
        pet_name: formDataJson.petName || null,
        pet_breed: formDataJson.petBreed || null,
        pet_weight: formDataJson.petWeight ? parseInt(formDataJson.petWeight) : null,
        pet_color: formDataJson.petColor || null,
        pet_spayed: formDataJson.petSpayed,
        pet_vaccinations_current: formDataJson.petVaccinationsCurrent,
        pet_vaccination_file: petVaccinationPath,
        pet_photo_file: petPhotoPath,
        pet_signature: petSignaturePath,
        pet_signature_date: formDataJson.hasPets ? new Date().toISOString().split('T')[0] : null,
        has_insurance: formDataJson.hasInsurance,
        insurance_provider: formDataJson.insuranceProvider || null,
        insurance_policy_number: formDataJson.insurancePolicyNumber || null,
        insurance_file: insuranceProofPath,
        add_insurance_to_rent: formDataJson.addInsuranceToRent,
        has_vehicle: formDataJson.hasVehicle,
        vehicle_make: formDataJson.vehicleMake || null,
        vehicle_model: formDataJson.vehicleModel || null,
        vehicle_year: formDataJson.vehicleYear ? parseInt(formDataJson.vehicleYear) : null,
        vehicle_color: formDataJson.vehicleColor || null,
        vehicle_plate: formDataJson.vehiclePlate || null,
        vehicle_signature: vehicleSignaturePath,
        vehicle_signature_date: formDataJson.hasVehicle ? new Date().toISOString().split('T')[0] : null,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (dbError) throw dbError;

    // Generate documents based on form responses
    let petAddendumPath = null;
    let vehicleAddendumPath = null;

    try {
      // Generate pet addendum (either with pets or no pets)
      if (formDataJson.hasPets === true && signaturesJson.pet) {
        const petData = preparePetTemplateData(
          formDataJson,
          signaturesJson.pet,
          new Date().toISOString().split('T')[0]
        );
        const petDoc = await generateDocument('pet_addendum_template', petData);
        
        const petFileName = `${submissionId}_pet_addendum.docx`;
        const { data: petUpload, error: petUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${petFileName}`, petDoc, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        
        if (petUploadError) throw petUploadError;
        petAddendumPath = petUpload.path;
      } else if (formDataJson.hasPets === false && signaturesJson.pet) {
        const noPetData = prepareTemplateData(
          formDataJson,
          signaturesJson.pet,
          new Date().toISOString().split('T')[0]
        );
        const noPetDoc = await generateDocument('no_pets_template', noPetData);
        
        const noPetFileName = `${submissionId}_no_pets_addendum.docx`;
        const { data: noPetUpload, error: noPetUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${noPetFileName}`, noPetDoc, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        
        if (noPetUploadError) throw noPetUploadError;
        petAddendumPath = noPetUpload.path;
      }

      // Generate vehicle addendum
      if (formDataJson.hasVehicle === true && signaturesJson.vehicle) {
        const vehicleData = prepareVehicleTemplateData(
          formDataJson,
          signaturesJson.vehicle,
          new Date().toISOString().split('T')[0]
        );
        const vehicleDoc = await generateDocument('vehicle_addendum_template', vehicleData);
        
        const vehicleFileName = `${submissionId}_vehicle_addendum.docx`;
        const { data: vehicleUpload, error: vehicleUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${vehicleFileName}`, vehicleDoc, {
            contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
        
        if (vehicleUploadError) throw vehicleUploadError;
        vehicleAddendumPath = vehicleUpload.path;
      }

      // Update submission with document paths
      if (petAddendumPath || vehicleAddendumPath) {
        const { error: updateError } = await supabaseAdmin
          .from('submissions')
          .update({
            pet_addendum_file: petAddendumPath,
            vehicle_addendum_file: vehicleAddendumPath,
          })
          .eq('id', submissionId);
        
        if (updateError) throw updateError;
      }
    } catch (docError) {
      console.error('Document generation failed:', docError);
    }

    try {
      await resend.emails.send({
        from: 'Stanton Management <onboarding@stantonmanagement.com>',
        to: formDataJson.fullName.includes('@') ? formDataJson.fullName : 'admin@stantonmanagement.com',
        subject: 'Tenant Onboarding Form Submission Confirmation',
        html: `
          <h2>Thank you for completing your tenant onboarding form</h2>
          <p>Dear ${formDataJson.fullName},</p>
          <p>We have received your tenant onboarding form submission. Here's a summary:</p>
          <ul>
            <li><strong>Building:</strong> ${formDataJson.buildingAddress}</li>
            <li><strong>Unit:</strong> ${formDataJson.unitNumber}</li>
            <li><strong>Pets:</strong> ${formDataJson.hasPets ? 'Yes' : 'No'}</li>
            <li><strong>Insurance:</strong> ${formDataJson.hasInsurance ? 'Yes' : 'No'}</li>
            <li><strong>Vehicle:</strong> ${formDataJson.hasVehicle ? 'Yes' : 'No'}</li>
          </ul>
          <p>If you have any questions, please contact our office.</p>
          <p>Best regards,<br>Stanton Management</p>
        `,
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
    }

    return NextResponse.json({ 
      success: true, 
      submissionId 
    });

  } catch (error: any) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Submission failed' },
      { status: 500 }
    );
  }
}
