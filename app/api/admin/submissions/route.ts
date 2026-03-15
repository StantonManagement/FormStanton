import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing submission ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('submissions').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Submission delete error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

const ALLOWED_FIELDS = new Set([
  'full_name', 'phone', 'email', 'building_address', 'unit_number',
  'vehicle_make', 'vehicle_model', 'vehicle_year', 'vehicle_color', 'vehicle_plate',
  'insurance_provider', 'insurance_policy_number', 'pets',
]);

export async function PATCH(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id, updates } = await request.json();
    if (!id || !updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, message: 'Missing id or updates' }, { status: 400 });
    }

    // Only allow whitelisted fields
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (ALLOWED_FIELDS.has(key)) {
        sanitized[key] = value;
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return NextResponse.json({ success: false, message: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .update(sanitized)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Submission PATCH error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const buildingAddress = searchParams.get('building');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const hasPets = searchParams.get('hasPets');
    const needsInsurance = searchParams.get('needsInsurance');

    let query = supabaseAdmin
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (buildingAddress && buildingAddress !== 'all') {
      query = query.eq('building_address', buildingAddress);
    }

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDateTime.toISOString());
    }

    if (hasPets === 'true') {
      query = query.eq('has_pets', true);
    } else if (hasPets === 'false') {
      query = query.eq('has_pets', false);
    }

    if (needsInsurance === 'true') {
      query = query.eq('insurance_upload_pending', true);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Submissions fetch error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
