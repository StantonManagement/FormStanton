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
      dob,
      currentAddress,
      addressDuration,
      householdSize,
      occupants,
      incomeSource1,
      incomeSource2,
      monthlyIncomeRange,
      bedroomsNeeded,
      areasOfInterest,
      desiredMoveIn,
      paymentType,
      hasPets,
      pets,
      currentLandlord,
      landlordPhone,
      reasonForMoving,
      marketRateAuth,
      housingAuthority,
      voucherBedSize,
      paymentStandard,
      voucherExpiration,
      caseworkerName,
      caseworkerPhone,
      caseworkerEmail,
      docsVoucher,
      docsMovingPacket,
      docsBankStatement,
      s8Auth,
      ssnOrTaxId,
      docsPhotoId,
      docsSsnCard,
      signature,
      language,
    } = data;

    if (!fullName?.trim()) {
      return NextResponse.json({ message: 'Full name is required' }, { status: 400 });
    }

    if (!phone?.trim()) {
      return NextResponse.json({ message: 'Phone number is required' }, { status: 400 });
    }

    let signatureUrl = '';
    if (signature) {
      try {
        const signatureBuffer = Buffer.from(signature.split(',')[1], 'base64');
        const signatureFileName = `${Date.now()}-rental-application-signature.png`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('form-photos')
          .upload(`rental-application/${signatureFileName}`, signatureBuffer, {
            contentType: 'image/png',
            upsert: false,
          });

        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage
            .from('form-photos')
            .getPublicUrl(uploadData.path);
          signatureUrl = urlData.publicUrl;
        }
      } catch (sigErr) {
        console.error('Signature upload error:', sigErr);
      }
    }

    const formPayload = {
      email: email?.trim() || null,
      dob: dob || null,
      currentAddress: currentAddress?.trim() || null,
      addressDuration: addressDuration?.trim() || null,
      householdSize: householdSize ? parseInt(householdSize, 10) : null,
      occupants: occupants || [],
      incomeSource1: incomeSource1 || null,
      incomeSource2: incomeSource2 || null,
      monthlyIncomeRange: monthlyIncomeRange || null,
      bedroomsNeeded: bedroomsNeeded || null,
      areasOfInterest: areasOfInterest || [],
      desiredMoveIn: desiredMoveIn || null,
      paymentType: paymentType || null,
      hasPets: hasPets || null,
      pets: pets || [],
      currentLandlord: currentLandlord?.trim() || null,
      landlordPhone: landlordPhone?.trim() || null,
      reasonForMoving: reasonForMoving?.trim() || null,
      marketRateAuth: marketRateAuth || false,
      section8Info: paymentType === 'section8' ? {
        housingAuthority: housingAuthority?.trim() || null,
        voucherBedSize: voucherBedSize?.trim() || null,
        paymentStandard: paymentStandard?.trim() || null,
        voucherExpiration: voucherExpiration || null,
        caseworkerName: caseworkerName?.trim() || null,
        caseworkerPhone: caseworkerPhone?.trim() || null,
        caseworkerEmail: caseworkerEmail?.trim() || null,
        docsVoucher: docsVoucher || false,
        docsMovingPacket: docsMovingPacket || false,
        docsBankStatement: docsBankStatement || false,
        s8Auth: s8Auth || false,
      } : null,
      ssnOrTaxId: ssnOrTaxId?.trim() || null,
      docsPhotoId: docsPhotoId || false,
      docsSsnCard: docsSsnCard || false,
      signatureUrl: signatureUrl || null,
    };

    const { data: submission, error: dbError } = await supabase
      .from('form_submissions')
      .insert({
        form_type: 'rental_application',
        tenant_name: fullName.trim(),
        building_address: null,
        unit_number: null,
        form_data: {
          phone: phone.trim(),
          ...formPayload,
        },
        language: language || 'en',
        submitted_at: new Date().toISOString(),
        reviewed: false,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error (rental application):', dbError);
      return NextResponse.json(
        { message: 'Failed to save submission', error: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Application submitted successfully', id: submission.id },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Rental application submission error:', error);
    return NextResponse.json(
      { message: 'Submission failed', error: error.message },
      { status: 500 }
    );
  }
}
