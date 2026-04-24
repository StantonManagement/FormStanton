import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { generateToken } from '@/lib/generateToken';

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') ?? '';
    const building = searchParams.get('building') ?? '';

    let query = supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, created_at, head_of_household_name, building_address, unit_number,
         bedroom_count, household_size, intake_submitted_at,
         stanton_review_status,
         tenant_access_token, form_submission_id, preapp_id`
      )
      .order('created_at', { ascending: false });

    if (status) query = query.eq('stanton_review_status', status);
    if (building) query = query.ilike('building_address', `%${building}%`);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/full-applications error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      preapp_id,
      building_address,
      unit_number,
      bedroom_count,
      head_of_household_name,
      language = 'en',
    } = body as {
      preapp_id?: string;
      building_address: string;
      unit_number: string;
      bedroom_count?: number;
      head_of_household_name: string;
      language?: string;
    };

    if (!building_address?.trim() || !unit_number?.trim() || !head_of_household_name?.trim()) {
      return NextResponse.json(
        { success: false, message: 'building_address, unit_number, and head_of_household_name are required' },
        { status: 400 }
      );
    }

    // Prevent duplicate invitations for the same building/unit
    const { data: existing } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, tenant_access_token')
      .eq('building_address', building_address.trim())
      .eq('unit_number', unit_number.trim())
      .is('intake_submitted_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          message: 'An active invitation already exists for this unit.',
          data: {
            id: existing.id,
            tenant_access_token: existing.tenant_access_token,
            magic_link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pbv-full-app/${existing.tenant_access_token}`,
          },
        },
        { status: 409 }
      );
    }

    // Create form_submissions row (foundation layer)
    const formSubmissionToken = generateToken();
    const { data: submission, error: subError } = await supabaseAdmin
      .from('form_submissions')
      .insert({
        form_type: 'pbv-full-application',
        tenant_name: head_of_household_name.trim(),
        building_address: building_address.trim(),
        unit_number: unit_number.trim(),
        language,
        review_granularity: 'per_document',
        status: 'pending_review',
        tenant_access_token: formSubmissionToken,
        created_by: 'admin',
      })
      .select('id')
      .single();

    if (subError) throw subError;

    // Create pbv_full_applications row
    const appToken = generateToken();
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .insert({
        preapp_id: preapp_id ?? null,
        form_submission_id: submission.id,
        building_address: building_address.trim(),
        unit_number: unit_number.trim(),
        bedroom_count: bedroom_count ?? null,
        head_of_household_name: head_of_household_name.trim(),
        household_size: 1,
        tenant_access_token: appToken,
        created_by: 'admin',
      })
      .select('id, tenant_access_token')
      .single();

    if (appError) throw appError;

    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pbv-full-app/${app.tenant_access_token}`;

    return NextResponse.json({
      success: true,
      data: {
        id: app.id,
        tenant_access_token: app.tenant_access_token,
        form_submission_token: formSubmissionToken,
        magic_link: magicLink,
      },
    });
  } catch (error: any) {
    console.error('POST /api/admin/pbv/full-applications error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
