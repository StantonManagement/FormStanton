import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const guard = await requirePermission('user-management', 'read');
    if (guard) return guard;

    const { data: user, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, display_name, is_active')
      .eq('id', id)
      .single();

    if (error || !user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('User fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
