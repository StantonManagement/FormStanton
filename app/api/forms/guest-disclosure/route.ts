import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGenericFormPdf } from '@/lib/documentGenerator';

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
    
    // Upload signature
    let signatureUrl = '';
    if (signature) {
      const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
      const signatureFileName = `${Date.now()}-signature.png`;
      
      const { data: sigUploadData, error: sigUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`guest-disclosure/${signatureFileName}`, signatureBuffer, {
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
        form_type: 'guest_disclosure',
        tenant_name: data.tenantName,
        building_address: data.buildingAddress,
        unit_number: data.unitNumber,
        form_data: data,
        photo_urls: [],
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
      const formPdf = await generateGenericFormPdf(
        'guest_disclosure',
        'Extended Guest Disclosure',
        data,
        signature
      );
      
      const pdfFileName = `${submission.id}_guest_disclosure.pdf`;
      const { data: pdfUpload, error: pdfUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`guest-disclosure/${pdfFileName}`, formPdf, {
          contentType: 'application/pdf',
        });
      
      if (!pdfUploadError && pdfUpload) {
        const { data: pdfUrlData } = supabase.storage
          .from('form-photos')
          .getPublicUrl(pdfUpload.path);
        
        pdfPath = pdfUrlData.publicUrl;
        
        await supabase
          .from('form_submissions')
          .update({ pdf_url: pdfPath })
          .eq('id', submission.id);
      }
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError);
    }
    
    return NextResponse.json(
      { message: 'Guest disclosure submitted successfully', id: submission.id, pdfGenerated: !!pdfPath },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Guest disclosure submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
