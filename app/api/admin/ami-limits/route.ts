import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

function canManage(user: Awaited<ReturnType<typeof getSessionUser>>) {
  if (!user) return false;
  return user.isSuperAdmin || userHasPermission(user, 'role-management', 'admin');
}

/**
 * GET /api/admin/ami-limits
 * Returns all HUD AMI limit rows, ordered by effective_year desc, ami_pct, household_size.
 * Optionally filterable via ?msa_code=&ami_pct=&effective_year=
 */
export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const msaCode = searchParams.get('msa_code');
  const amiPct = searchParams.get('ami_pct');
  const effectiveYear = searchParams.get('effective_year');

  let query = supabaseAdmin
    .from('hud_ami_limits')
    .select('id, msa_code, msa_name, effective_year, ami_pct, household_size, annual_limit, created_at')
    .order('effective_year', { ascending: false })
    .order('ami_pct', { ascending: true })
    .order('household_size', { ascending: true });

  if (msaCode) query = query.eq('msa_code', msaCode);
  if (amiPct) query = query.eq('ami_pct', parseInt(amiPct, 10));
  if (effectiveYear) query = query.eq('effective_year', parseInt(effectiveYear, 10));

  const { data, error } = await query;

  if (error) {
    console.error('[ami-limits] GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

/**
 * POST /api/admin/ami-limits
 * Insert a single new AMI limit row.
 * Requires super admin or role-management admin.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!canManage(user)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { msa_code, msa_name, effective_year, ami_pct, household_size, annual_limit } = body;

  if (!msa_code || !effective_year || !ami_pct || !household_size || annual_limit == null) {
    return NextResponse.json(
      { success: false, message: 'msa_code, effective_year, ami_pct, household_size, and annual_limit are required' },
      { status: 400 }
    );
  }

  if (![30, 50, 80, 100].includes(Number(ami_pct))) {
    return NextResponse.json(
      { success: false, message: 'ami_pct must be 30, 50, 80, or 100' },
      { status: 400 }
    );
  }

  if (Number(household_size) < 1 || Number(household_size) > 8) {
    return NextResponse.json(
      { success: false, message: 'household_size must be between 1 and 8' },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from('hud_ami_limits')
    .insert({
      msa_code: String(msa_code),
      msa_name: msa_name ? String(msa_name) : null,
      effective_year: Number(effective_year),
      ami_pct: Number(ami_pct),
      household_size: Number(household_size),
      annual_limit: Number(annual_limit),
      created_by: user.username,
    })
    .select('id, msa_code, msa_name, effective_year, ami_pct, household_size, annual_limit, created_at')
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { success: false, message: 'A row for this MSA / year / band / household size already exists' },
        { status: 409 }
      );
    }
    console.error('[ami-limits] POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data }, { status: 201 });
}

/**
 * DELETE /api/admin/ami-limits
 * Delete a row by id.
 * Body: { id: string }
 * Requires super admin or role-management admin.
 */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!canManage(user)) {
    return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
  }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 });
  }

  const { id } = body;
  if (!id) {
    return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('hud_ami_limits')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[ami-limits] DELETE error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
