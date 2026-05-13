import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      tenantName,
      buildingAddress,
      unitNumber,
      phone,
      lockoutDate,
      lockoutTime,
      entryProvided,
      staffMember,
      lockoutFee,
      feeCollected,
      paymentMethod,
      notes,
      signature,
      language = 'en',
    } = body;

    // Validation
    if (!tenantName?.trim()) {
      return NextResponse.json({ message: 'Tenant name is required' }, { status: 400 });
    }
    if (!buildingAddress?.trim()) {
      return NextResponse.json({ message: 'Building address is required' }, { status: 400 });
    }
    if (!unitNumber?.trim()) {
      return NextResponse.json({ message: 'Unit number is required' }, { status: 400 });
    }
    if (!lockoutDate) {
      return NextResponse.json({ message: 'Lockout date is required' }, { status: 400 });
    }
    if (!lockoutTime) {
      return NextResponse.json({ message: 'Lockout time is required' }, { status: 400 });
    }

    // Insert into database
    const { data, error } = await supabaseAdmin
      .from('lockout_entry_requests')
      .insert({
        tenant_name: tenantName,
        building_address: buildingAddress,
        unit_number: unitNumber,
        phone: phone || null,
        lockout_date: lockoutDate,
        lockout_time: lockoutTime,
        entry_provided: entryProvided || false,
        staff_member: staffMember || null,
        lockout_fee: lockoutFee ? parseFloat(lockoutFee) : null,
        fee_collected: feeCollected || false,
        payment_method: paymentMethod || null,
        notes: notes || null,
        signature_data: signature || null,
        language,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { message: 'Failed to save lockout entry request' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Lockout entry request submitted successfully', id: data.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error processing lockout entry request:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}
