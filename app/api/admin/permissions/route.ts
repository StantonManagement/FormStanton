import { NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const guard = await requirePermission('role-management', 'read');
    if (guard) return guard;

    const { data, error } = await supabaseAdmin
      .from('permissions')
      .select('id, resource, action, description')
      .order('resource', { ascending: true })
      .order('action', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
