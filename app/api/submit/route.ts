import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import { 
  generatePetAddendumPdf,
  generateNoPetsAddendumPdf,
  generateVehicleAddendumPdf,
} from '@/lib/documentGenerator';
import { sanitizePlate } from '@/lib/plateSanitizer';
import { getErrorMessage } from '@/lib/errorMessage';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const formDataJson = JSON.parse(formData.get('formData') as string);
    const signaturesJson = JSON.parse(formData.get('signatures') as string);
    const language = formData.get('language') as string;

    const insuranceProofFile = formData.get('insuranceProof') as File | null;

    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const submissionId = crypto.randomUUID();

    let insuranceProofPath = null;
    let petSignaturePath = null;
    let vehicleSignaturePath = null;

    // Upload per-pet files and build pets array for DB
    const petsArray: any[] = [];
    if (formDataJson.hasPets === true && formDataJson.pets) {
      for (let i = 0; i < formDataJson.pets.length; i++) {
        const pet = formDataJson.pets[i];
        let vaccinationPath = null;
        let spayNeuterPath = null;
        let photoPath = null;

        const vacFile = formData.get(`petVaccination_${i}`) as File | null;
        if (vacFile) {
          const fileName = `${submissionId}_pet_${i}_vaccination.${vacFile.name.split('.').pop()}`;
          const buffer = await vacFile.arrayBuffer();
          const { data, error } = await supabaseAdmin.storage
            .from('submissions')
            .upload(`vaccinations/${fileName}`, buffer, { contentType: vacFile.type });
          if (error) throw error;
          vaccinationPath = data.path;
        }

        const photoFile = formData.get(`petPhoto_${i}`) as File | null;
        if (photoFile) {
          const fileName = `${submissionId}_pet_${i}_photo.${photoFile.name.split('.').pop()}`;
          const buffer = await photoFile.arrayBuffer();
          const { data, error } = await supabaseAdmin.storage
            .from('submissions')
            .upload(`pet_photos/${fileName}`, buffer, { contentType: photoFile.type });
          if (error) throw error;
          photoPath = data.path;
        }

        const spayNeuterFile = formData.get(`petSpayNeuterProof_${i}`) as File | null;
        if (spayNeuterFile) {
          const fileName = `${submissionId}_pet_${i}_spay_neuter.${spayNeuterFile.name.split('.').pop()}`;
          const buffer = await spayNeuterFile.arrayBuffer();
          const { data, error } = await supabaseAdmin.storage
            .from('submissions')
            .upload(`pet_documents/${fileName}`, buffer, { contentType: spayNeuterFile.type });
          if (error) throw error;
          spayNeuterPath = data.path;
        }

        petsArray.push({
          pet_type: pet.petType || null,
          pet_name: pet.petName || null,
          pet_breed: pet.petBreed || null,
          pet_weight: pet.petWeight ? parseInt(pet.petWeight) : null,
          pet_color: pet.petColor || null,
          pet_spayed: pet.petSpayed,
          pet_vaccinations_current: pet.petVaccinationsCurrent,
          pet_vaccination_file: vaccinationPath,
          pet_spay_neuter_file: spayNeuterPath,
          pet_photo_file: photoPath,
        });
      }
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

    let insuranceAuthSignaturePath = null;
    if (signaturesJson.insurance) {
      const base64Data = signaturesJson.insurance.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${submissionId}_insurance_auth_signature.png`;
      const { data, error } = await supabaseAdmin.storage
        .from('submissions')
        .upload(`signatures/${fileName}`, buffer, {
          contentType: 'image/png',
        });
      if (error) throw error;
      insuranceAuthSignaturePath = data.path;
    }

    const { error: dbError } = await supabaseAdmin
      .from('submissions')
      .insert({
        id: submissionId,
        language,
        full_name: formDataJson.fullName,
        phone: formDataJson.phone,
        email: formDataJson.email,
        phone_is_new: formDataJson.phoneIsNew,
        building_address: formDataJson.buildingAddress,
        unit_number: formDataJson.unitNumber,
        has_pets: formDataJson.hasPets,
        pets: petsArray.length > 0 ? petsArray : null,
        pet_signature: petSignaturePath,
        pet_signature_date: formDataJson.petSignatureDate || null,
        has_insurance: formDataJson.hasInsurance,
        insurance_provider: formDataJson.insuranceProvider || null,
        insurance_policy_number: formDataJson.insurancePolicyNumber || null,
        insurance_expiration_date: formDataJson.insuranceExpirationDate || null,
        insurance_file: insuranceProofPath,
        insurance_upload_pending: formDataJson.insuranceUploadPending || false,
        add_insurance_to_rent: formDataJson.addInsuranceToRent,
        insurance_authorization_signature: insuranceAuthSignaturePath,
        insurance_authorization_signature_date: formDataJson.addInsuranceToRent ? new Date().toISOString().split('T')[0] : null,
        has_vehicle: formDataJson.hasVehicle,
        vehicle_make: formDataJson.vehicleMake || null,
        vehicle_model: formDataJson.vehicleModel || null,
        vehicle_year: formDataJson.vehicleYear ? parseInt(formDataJson.vehicleYear) : null,
        vehicle_color: formDataJson.vehicleColor || null,
        vehicle_plate: sanitizePlate(formDataJson.vehiclePlate),
        vehicle_signature: vehicleSignaturePath,
        vehicle_signature_date: formDataJson.vehicleSignatureDate || null,
        additional_vehicles: formDataJson.additionalVehicles && formDataJson.additionalVehicles.length > 0
          ? formDataJson.additionalVehicles.map((av: any) => ({
              vehicle_make: av.vehicleMake || null,
              vehicle_model: av.vehicleModel || null,
              vehicle_year: av.vehicleYear ? parseInt(av.vehicleYear) : null,
              vehicle_color: av.vehicleColor || null,
              vehicle_plate: sanitizePlate(av.vehiclePlate),
              requested_at: new Date().toISOString(),
            }))
          : null,
        ip_address: ip,
        user_agent: userAgent,
      });

    if (dbError) throw dbError;

    // Generate documents based on form responses
    let petAddendumPath = null;
    let vehicleAddendumPath = null;

    try {
      // Generate pet addendum PDF (either with pets or no pets)
      if (formDataJson.hasPets === true && signaturesJson.pet) {
        const petPdf = await generatePetAddendumPdf(formDataJson, petsArray, signaturesJson.pet);
        
        const petFileName = `${submissionId}_pet_addendum.pdf`;
        const { data: petUpload, error: petUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${petFileName}`, petPdf, {
            contentType: 'application/pdf',
          });
        
        if (petUploadError) throw petUploadError;
        petAddendumPath = petUpload.path;
      } else if (formDataJson.hasPets === false && signaturesJson.pet) {
        const noPetPdf = await generateNoPetsAddendumPdf(formDataJson, signaturesJson.pet);
        
        const noPetFileName = `${submissionId}_no_pets_addendum.pdf`;
        const { data: noPetUpload, error: noPetUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${noPetFileName}`, noPetPdf, {
            contentType: 'application/pdf',
          });
        
        if (noPetUploadError) throw noPetUploadError;
        petAddendumPath = noPetUpload.path;
      }

      // Generate vehicle addendum PDF
      if (formDataJson.hasVehicle === true && signaturesJson.vehicle) {
        const vehiclePdf = await generateVehicleAddendumPdf(formDataJson, signaturesJson.vehicle);
        
        const vehicleFileName = `${submissionId}_vehicle_addendum.pdf`;
        const { data: vehicleUpload, error: vehicleUploadError } = await supabaseAdmin.storage
          .from('submissions')
          .upload(`documents/${vehicleFileName}`, vehiclePdf, {
            contentType: 'application/pdf',
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

    let emailSent = true;
    try {
      await resend.emails.send({
        from: 'Stanton Management <onboarding@stantonmanagement.com>',
        to: formDataJson.email ? formDataJson.email : 'admin@stantonmanagement.com',
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
      emailSent = false;
    }

    return NextResponse.json({ 
      success: true, 
      submissionId,
      warnings: {
        emailFailed: !emailSent,
        documentsFailed: !petAddendumPath && !vehicleAddendumPath && (formDataJson.hasPets || formDataJson.hasVehicle)
      }
    });

  } catch (error: unknown) {
    console.error('Submission error:', error);
    return NextResponse.json(
      { success: false, message: getErrorMessage(error, 'Submission failed') },
      { status: 500 }
    );
  }
}
