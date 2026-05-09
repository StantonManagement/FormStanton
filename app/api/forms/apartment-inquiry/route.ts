import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let parsed: Record<string, unknown> = {};

    if (contentType.includes('multipart/form-data')) {
      const fd = await request.formData();
      const raw = fd.get('formData');
      if (typeof raw === 'string') parsed = JSON.parse(raw);

      const incomeFiles = fd.getAll('incomeDocuments') as File[];
      const uploadedUrls: string[] = [];
      for (const file of incomeFiles) {
        if (file.size === 0) continue;
        const buf = Buffer.from(await file.arrayBuffer());
        const key = `apartment-inquiry/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { error: upErr } = await supabase.storage.from('form-photos').upload(key, buf, { contentType: file.type });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('form-photos').getPublicUrl(key);
          uploadedUrls.push(urlData.publicUrl);
        }
      }
      if (uploadedUrls.length) parsed.incomeDocumentUrls = uploadedUrls;
    } else {
      parsed = await request.json();
    }

    const {
      fullName, dateOfBirth, phone, email,
      bedrooms, moveInTimeframe,
      voucher, voucherBedroomSize, voucherHousingAuthority,
      areasOfInterest, householdIncome, incomeDocumentUrls,
      numberOfOccupants, additionalOccupants,
      referralSource, referralOther, comments, language,
    } = parsed as Record<string, unknown>;

    if (!fullName || !(fullName as string).trim())
      return NextResponse.json({ message: 'Full name is required' }, { status: 400 });
    if (!phone || !(phone as string).replace(/\D/g, '').match(/^\d{10}$/))
      return NextResponse.json({ message: 'A valid 10-digit phone number is required' }, { status: 400 });
    if (!bedrooms)
      return NextResponse.json({ message: 'Bedrooms selection is required' }, { status: 400 });
    if (!moveInTimeframe)
      return NextResponse.json({ message: 'Move-in timeframe is required' }, { status: 400 });
    if (!voucher)
      return NextResponse.json({ message: 'Voucher status is required' }, { status: 400 });

    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'apartment_inquiry',
        tenant_name: (fullName as string).trim(),
        building_address: '',
        unit_number: '',
        form_data: {
          dateOfBirth: dateOfBirth || '',
          phone: (phone as string).trim(),
          email: ((email as string | undefined) || '').trim(),
          bedrooms,
          moveInTimeframe,
          voucher,
          voucherBedroomSize: voucherBedroomSize || '',
          voucherHousingAuthority: voucherHousingAuthority || '',
          areasOfInterest: areasOfInterest || [],
          householdIncome: householdIncome || '',
          incomeDocumentUrls: incomeDocumentUrls || [],
          numberOfOccupants: numberOfOccupants || '',
          additionalOccupants: additionalOccupants || '',
          referralSource: referralSource || '',
          referralOther: referralOther || '',
          comments: ((comments as string | undefined) || '').trim(),
        },
        language: language || 'en',
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ message: 'Failed to save submission', error: dbError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Application submitted successfully', id: submission.id }, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('Apartment inquiry submission error:', error);
    return NextResponse.json({ message: 'Submission failed', error: msg }, { status: 500 });
  }
}
