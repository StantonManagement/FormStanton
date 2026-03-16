import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generatePetAddendumPdf } from '@/lib/documentGenerator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    const language = formData.get('language') as string;
    const formDataString = formData.get('formData') as string;
    const signature = formData.get('signature') as string;
    
    const data = JSON.parse(formDataString);
    
    // Upload photos to Supabase Storage
    const photoUrls: string[] = [];
    
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('pet_') && key.includes('_photo_') && value instanceof File) {
        const file = value as File;
        const fileName = `${Date.now()}-${key}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('form-photos')
          .upload(`pet-approval/${fileName}`, file, {
            contentType: file.type,
            upsert: false,
          });
        
        if (uploadError) {
          console.error('Photo upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('form-photos')
            .getPublicUrl(uploadData.path);
          
          photoUrls.push(urlData.publicUrl);
        }
      }
    }
    
    // Upload signature
    let signatureUrl = '';
    if (signature) {
      const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
      const signatureFileName = `${Date.now()}-signature.png`;
      
      const { data: sigUploadData, error: sigUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`pet-approval/${signatureFileName}`, signatureBuffer, {
          contentType: 'image/png',
          upsert: false,
        });
      
      if (!sigUploadError && sigUploadData) {
        const { data: sigUrlData } = supabase.storage
          .from('form-photos')
          .getPublicUrl(sigUploadData.path);
        
        signatureUrl = sigUrlData.publicUrl;
      }
    }
    
    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'pet_approval',
        tenant_name: data.tenantName,
        building_address: data.buildingAddress,
        unit_number: data.unitNumber,
        form_data: data,
        photo_urls: photoUrls,
        signature_url: signatureUrl,
        language: language,
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();
    
    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { message: 'Failed to save submission', error: dbError.message },
        { status: 500 }
      );
    }
    
    // Generate PDF with all collected data
    let pdfPath = null;
    try {
      // Transform pets data to match expected format
      const petsArray = data.pets.map((pet: any) => ({
        pet_type: pet.petType,
        pet_name: pet.petName,
        pet_breed: pet.petBreed,
        pet_weight: pet.petWeight,
        pet_color: pet.petColor,
        pet_spayed: pet.petSpayed,
        pet_vaccinations_current: pet.petVaccinations,
      }));
      
      const petPdf = await generatePetAddendumPdf(data, petsArray, signature);
      
      const pdfFileName = `${submission.id}_pet_addendum.pdf`;
      const { data: pdfUpload, error: pdfUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`pet-approval/${pdfFileName}`, petPdf, {
          contentType: 'application/pdf',
        });
      
      if (!pdfUploadError && pdfUpload) {
        const { data: pdfUrlData } = supabase.storage
          .from('form-photos')
          .getPublicUrl(pdfUpload.path);
        
        pdfPath = pdfUrlData.publicUrl;
        
        // Update submission with PDF URL
        await supabase
          .from('form_submissions')
          .update({ pdf_url: pdfPath })
          .eq('id', submission.id);
      }
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
      // Continue even if PDF generation fails
    }
    
    // Send email notification (placeholder - implement with your email service)
    // await sendEmailNotification(data, photoUrls);
    
    return NextResponse.json(
      { 
        message: 'Pet approval request submitted successfully', 
        id: submission.id,
        pdfGenerated: !!pdfPath 
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Pet approval submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
