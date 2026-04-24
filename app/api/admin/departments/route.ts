import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET() {
  try {
    const guard = await requirePermission('role-management', 'read');
    if (guard) return guard;

    const { data, error } = await supabaseAdmin
      .from('departments')
      .select('id, name, code, description, is_active, created_at')
      .order('name', { ascending: true });

    if (error) throw error;

    // Enrich with user count per department
    const deptIds = (data ?? []).map((d) => d.id);
    const { data: userRows } = await supabaseAdmin
      .from('admin_users')
      .select('department_id')
      .in('department_id', deptIds)
      .eq('is_active', true);

    const countMap: Record<string, number> = {};
    for (const u of userRows ?? []) {
      if (u.department_id) countMap[u.department_id] = (countMap[u.department_id] ?? 0) + 1;
    }

    const enriched = (data ?? []).map((dept) => ({
      ...dept,
      user_count: countMap[dept.id] ?? 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Departments list error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission('role-management', 'write');
    if (guard) return guard;

    const body = await request.json();
    const { name, code, description } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, message: 'Name and code are required' }, { status: 400 });
    }

    const safeCode = code.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const { data, error } = await supabaseAdmin
      .from('departments')
      .insert({ name, code: safeCode, description: description || null, is_active: true })
      .select('id, name, code, description, is_active, created_at')
      .single();

    if (error) throw error;

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'department.create', 'department', data.id, { name, code: safeCode }, getClientIp(request));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Department create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
