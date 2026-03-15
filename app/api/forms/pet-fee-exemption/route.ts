import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
    
    // Upload documents to Supabase Storage
    const documentUrls: string[] = [];
    
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('document_') && value instanceof File) {
        const file = value as File;
        const fileName = `${Date.now()}-${key}-${file.name}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('form-photos')
          .upload(`pet-fee-exemption/${fileName}`, file, {
            contentType: file.type,
            upsert: false,
          });
        
        if (uploadError) {
          console.error('Document upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('form-photos')
            .getPublicUrl(uploadData.path);
          
          documentUrls.push(urlData.publicUrl);
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
        .upload(`pet-fee-exemption/${signatureFileName}`, signatureBuffer, {
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
        form_type: 'pet_fee_exemption',
        tenant_name: data.tenantName,
        building_address: data.buildingAddress,
        unit_number: data.unitNumber,
        form_data: {
          ...data,
          exemptionReason: data.exemptionReason,
          reasonExplanation: data.reasonExplanation,
          petDescription: data.petDescription,
        },
        photo_urls: documentUrls,
        signature_url: signatureUrl,
        language: language,
        submitted_at: new Date().toISOString(),
        reviewed: false,
        exemption_reason: data.exemptionReason,
        exemption_documents: documentUrls,
        exemption_status: 'pending',
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
    
    // Also update the main submissions table if tenant exists
    const { data: existingSubmission } = await supabase
      .from('submissions')
      .select('id')
      .eq('full_name', data.tenantName)
      .eq('building_address', data.buildingAddress)
      .eq('unit_number', data.unitNumber)
      .single();
    
    if (existingSubmission) {
      await supabase
        .from('submissions')
        .update({
          exemption_reason: data.exemptionReason,
          exemption_documents: documentUrls,
          exemption_status: 'pending',
          exemption_notes: `Exemption request submitted on ${new Date().toISOString().split('T')[0]}`,
        })
        .eq('id', existingSubmission.id);
    }
    
    // Send email notification (placeholder - implement with your email service)
    // await sendEmailNotification(data, documentUrls);
    
    return NextResponse.json(
      { message: 'Pet fee exemption request submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Pet fee exemption submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
