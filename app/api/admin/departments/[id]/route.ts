import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission('role-management', 'write');
    if (guard) return guard;

    const { id } = await params;
    const body = await request.json();
    const { name, description, is_active } = body;

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (is_active !== undefined) updates.is_active = is_active;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, message: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select('id, name, code, description, is_active')
      .single();

    if (error) throw error;

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'department.update', 'department', id, { updatedFields: Object.keys(updates) }, getClientIp(request));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Department update error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
