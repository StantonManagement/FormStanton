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
      formerUnitAddress, 
      moveOutDate, 
      newMailingAddress, 
      cityStateZip, 
      newPhoneNumber, 
      emailAddress, 
      signature, 
      language 
    } = data;
    
    // Validate required fields
    if (!tenantName || !formerUnitAddress || !moveOutDate || !newMailingAddress || !cityStateZip) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Upload signature if provided
    let signatureUrl = '';
    if (signature) {
      const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
      const signatureFileName = `${Date.now()}-forwarding-address-signature.png`;
      
      const { data: sigUploadData, error: sigUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`forwarding-address/${signatureFileName}`, signatureBuffer, {
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
    
    // Calculate deposit return deadline (30 days from move-out)
    const moveOutDateObj = new Date(moveOutDate);
    const depositReturnDeadline = new Date(moveOutDateObj);
    depositReturnDeadline.setDate(depositReturnDeadline.getDate() + 30);
    
    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'forwarding_address',
        tenant_name: tenantName,
        building_address: formerUnitAddress.split(' - ')[0] || '',
        unit_number: formerUnitAddress.split(' - ')[1] || '',
        form_data: {
          formerUnitAddress,
          moveOutDate,
          newMailingAddress,
          cityStateZip,
          newPhoneNumber,
          emailAddress,
          depositReturnDeadline: depositReturnDeadline.toISOString().split('T')[0],
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
      { message: 'Forwarding address submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Forwarding address submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
