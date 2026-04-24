import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/pbv/staff-users
 * Returns active Stanton staff users for assignment dropdowns.
 */
export async function GET(_request: NextRequest) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, display_name')
    .eq('user_type', 'stanton_staff')
    .is('deactivated_at', null)
    .order('display_name', { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
