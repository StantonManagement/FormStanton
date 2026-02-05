import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { phone, buildingAddress, unitNumber } = await request.json();

    if (!phone || !buildingAddress || !unitNumber) {
      return NextResponse.json(
        { success: false, message: 'Phone, building address, and unit number are required' },
        { status: 400 }
      );
    }

    const { data: submission, error } = await supabaseAdmin
      .from('submissions')
      .select('*')
      .eq('phone', phone)
      .eq('building_address', buildingAddress)
      .eq('unit_number', unitNumber)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !submission) {
      return NextResponse.json(
        { success: false, message: 'No matching submission found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        fullName: submission.full_name,
        hasInsurance: submission.has_insurance,
        insuranceProvider: submission.insurance_provider,
        insurancePolicyNumber: submission.insurance_policy_number,
        insuranceUploadPending: submission.insurance_upload_pending,
        hasInsuranceFile: !!submission.insurance_file,
      },
    });

  } catch (error: any) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}
