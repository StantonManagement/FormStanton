import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateGenericFormPdf } from '@/lib/documentGenerator';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const multipart = await request.formData();

    const language = (multipart.get('language') as string) || 'en';
    const formDataString = multipart.get('formData') as string | null;
    const voiceNote = multipart.get('voiceNote') as File | null;

    if (!formDataString) {
      return NextResponse.json(
        { message: 'Submission failed', error: 'Missing form data payload' },
        { status: 400 }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(formDataString);
    } catch {
      return NextResponse.json(
        { message: 'Submission failed', error: 'Invalid form data payload' },
        { status: 400 }
      );
    }

    let voiceNoteUrl = '';

    if (voiceNote && voiceNote.size > 0) {
      const fileName = `${Date.now()}-voice-note-${voiceNote.name}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('form-photos')
        .upload(`tenant-assessment/${fileName}`, voiceNote, {
          contentType: voiceNote.type || 'audio/webm',
          upsert: false,
        });

      if (uploadError) {
        console.error('Voice note upload error:', {
          message: uploadError.message,
          name: uploadError.name,
          status: (uploadError as unknown as { status?: number }).status,
          statusCode: (uploadError as unknown as { statusCode?: string }).statusCode,
        });
      } else {
        const { data: urlData } = supabase.storage
          .from('form-photos')
          .getPublicUrl(uploadData.path);

        voiceNoteUrl = urlData.publicUrl;
      }
    }

    const payload = {
      ...data,
      voiceNoteUrl,
    };

    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'tenant_assessment',
        tenant_name: data.prospectName || null,
        building_address: data.property || null,
        unit_number: data.unit || null,
        form_data: payload,
        language,
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();

    if (dbError) {
      const dbErrorDetails = {
        message: dbError.message,
        code: (dbError as unknown as { code?: string }).code,
        details: (dbError as unknown as { details?: string }).details,
        hint: (dbError as unknown as { hint?: string }).hint,
      };

      console.error('Database error (tenant assessment):', dbErrorDetails);
      return NextResponse.json(
        {
          message: 'Failed to save submission',
          error: dbErrorDetails.message,
          code: dbErrorDetails.code,
        },
        { status: 500 }
      );
    }

    // Generate PDF with all collected data
    let pdfPath = null;
    try {
      const formPdf = await generateGenericFormPdf(
        'tenant_assessment',
        'Tenant Assessment',
        payload,
        undefined
      );
      
      const pdfFileName = `${submission.id}_tenant_assessment.pdf`;
      const { data: pdfUpload, error: pdfUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`tenant-assessment/${pdfFileName}`, formPdf, {
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
      { message: 'Tenant assessment submitted successfully', id: submission.id, pdfGenerated: !!pdfPath },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Tenant assessment submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
