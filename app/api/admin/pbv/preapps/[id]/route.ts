import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { parsePhoneToE164 } from '@/lib/phoneParser';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from('pbv_preapplications')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('PBV preapp GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      phone,
      email,
      total_household_income,
      override,
    } = body as {
      phone?: string | null;
      email?: string | null;
      total_household_income?: number;
      override?: { reason: string };
    };

    const updateData: Record<string, any> = {};

    // Handle phone
    if (phone !== undefined) {
      if (phone !== null) {
        const e164 = parsePhoneToE164(phone);
        if (!e164) {
          return NextResponse.json({ success: false, message: 'Invalid phone number format' }, { status: 400 });
        }
      }
      updateData.phone = phone ?? null;
    }

    // Handle email
    if (email !== undefined) {
      if (email !== null) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return NextResponse.json({ success: false, message: 'Invalid email format' }, { status: 400 });
        }
      }
      updateData.email = email ?? null;
    }

    // Handle income
    if (total_household_income !== undefined) {
      if (typeof total_household_income !== 'number' || total_household_income < 0) {
        return NextResponse.json({ success: false, message: 'Invalid income amount' }, { status: 400 });
      }
      updateData.total_household_income = total_household_income;
    }

    // Handle override
    if (override?.reason) {
      updateData.qualification_override_reason = override.reason;
      updateData.qualification_override_at = new Date().toISOString();
      // Get current user from session for override_by
      const { data: { user } } = await supabaseAdmin.auth.getUser();
      updateData.qualification_override_by = user?.email ?? 'admin';
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, message: 'No valid fields to update' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('pbv_preapplications')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('PBV preapp PATCH error:', error);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await context.params;

    const { error } = await supabaseAdmin
      .from('pbv_preapplications')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('PBV preapp DELETE error:', msg);
    return NextResponse.json({ success: false, message: msg }, { status: 500 });
  }
}
