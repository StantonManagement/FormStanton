import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const { 
      tenantName, 
      buildingAddress, 
      unitNumber, 
      dateOfNotice, 
      intendedMoveOutDate, 
      newAddress, 
      cityStateZip, 
      bestContact, 
      submissionMethod, 
      acknowledgments, 
      signature, 
      language 
    } = data;
    
    // Validate required fields
    if (!tenantName || !buildingAddress || !unitNumber || !dateOfNotice || !intendedMoveOutDate) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate all acknowledgments are checked
    const allAcknowledgmentsChecked = Object.values(acknowledgments).every(v => v);
    if (!allAcknowledgmentsChecked) {
      return NextResponse.json(
        { message: 'All acknowledgments must be checked' },
        { status: 400 }
      );
    }
    
    // Upload signature if provided
    let signatureUrl = '';
    if (signature) {
      const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
      const signatureFileName = `${Date.now()}-move-out-notice-signature.png`;
      
      const { data: sigUploadData, error: sigUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`move-out-notice/${signatureFileName}`, signatureBuffer, {
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
    
    // Calculate 30-day notice period end date
    const noticeEndDate = new Date(dateOfNotice);
    noticeEndDate.setDate(noticeEndDate.getDate() + 30);
    
    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'move_out_notice',
        tenant_name: tenantName,
        building_address: buildingAddress,
        unit_number: unitNumber,
        form_data: {
          dateOfNotice,
          intendedMoveOutDate,
          newAddress,
          cityStateZip,
          bestContact,
          submissionMethod,
          acknowledgments,
          noticePeriodEnds: noticeEndDate.toISOString().split('T')[0],
        },
        signature_url: signatureUrl,
        language: language || 'en',
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
    
    return NextResponse.json(
      { message: 'Move-out notice submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Move-out notice submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
