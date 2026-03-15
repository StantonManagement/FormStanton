import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    const { tenantName, buildingAddress, unitNumber, leaseStartDate, utilities, signature, language } = data;
    
    // Validate required fields
    if (!tenantName || !buildingAddress || !unitNumber || !leaseStartDate) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Upload signature if provided
    let signatureUrl = '';
    if (signature) {
      const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
      const signatureFileName = `${Date.now()}-utility-transfer-signature.png`;
      
      const { data: sigUploadData, error: sigUploadError } = await supabase.storage
        .from('form-photos')
        .upload(`utility-transfer/${signatureFileName}`, signatureBuffer, {
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
        form_type: 'utility_transfer',
        tenant_name: tenantName,
        building_address: buildingAddress,
        unit_number: unitNumber,
        form_data: {
          leaseStartDate,
          utilities,
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
      { message: 'Utility transfer confirmation submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Utility transfer submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
