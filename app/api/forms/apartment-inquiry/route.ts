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
      fullName,
      phone,
      email,
      bedrooms,
      moveInTimeframe,
      voucher,
      areasOfInterest,
      referralSource,
      comments,
      language,
    } = data;

    // Validate required fields
    if (!fullName || !fullName.trim()) {
      return NextResponse.json(
        { message: 'Full name is required' },
        { status: 400 }
      );
    }

    if (!phone || !phone.replace(/\D/g, '').match(/^\d{10}$/)) {
      return NextResponse.json(
        { message: 'A valid 10-digit phone number is required' },
        { status: 400 }
      );
    }

    if (!bedrooms) {
      return NextResponse.json(
        { message: 'Bedrooms selection is required' },
        { status: 400 }
      );
    }

    if (!moveInTimeframe) {
      return NextResponse.json(
        { message: 'Move-in timeframe is required' },
        { status: 400 }
      );
    }

    if (!voucher) {
      return NextResponse.json(
        { message: 'Voucher status is required' },
        { status: 400 }
      );
    }

    // Save to database
    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'apartment_inquiry',
        tenant_name: fullName.trim(),
        building_address: '',
        unit_number: '',
        form_data: {
          phone: phone.trim(),
          email: email?.trim() || '',
          bedrooms,
          moveInTimeframe,
          voucher,
          areasOfInterest: areasOfInterest || [],
          referralSource: referralSource || '',
          comments: comments?.trim() || '',
        },
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
      { message: 'Inquiry submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Apartment inquiry submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
