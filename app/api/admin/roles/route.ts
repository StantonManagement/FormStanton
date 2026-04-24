import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET() {
  try {
    const guard = await requirePermission('role-management', 'read');
    if (guard) return guard;

    const { data, error } = await supabaseAdmin
      .from('roles')
      .select(`
        id, name, code, description, is_system, created_at,
        department_id,
        departments(id, name, code),
        role_permissions(permission_id, permissions(resource, action))
      `)
      .order('name', { ascending: true });

    if (error) throw error;

    // Attach user count per role
    const roleIds = (data ?? []).map((r) => r.id);
    const { data: userRoleCounts } = await supabaseAdmin
      .from('user_roles')
      .select('role_id')
      .in('role_id', roleIds);

    const countMap: Record<string, number> = {};
    for (const ur of userRoleCounts ?? []) {
      countMap[ur.role_id] = (countMap[ur.role_id] ?? 0) + 1;
    }

    const enriched = (data ?? []).map((role) => ({
      ...role,
      user_count: countMap[role.id] ?? 0,
      permissions: (role.role_permissions as unknown as Array<{ permissions: { resource: string; action: string } }>)
        ?.map((rp) => rp.permissions)
        .filter(Boolean) ?? [],
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Roles list error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission('role-management', 'write');
    if (guard) return guard;

    const body = await request.json();
    const { name, code, description, department_id, permissions } = body;

    if (!name || !code) {
      return NextResponse.json({ success: false, message: 'Name and code are required' }, { status: 400 });
    }

    const safeCode = code.toLowerCase().replace(/[^a-z0-9_]/g, '_');

    const { data: role, error: roleError } = await supabaseAdmin
      .from('roles')
      .insert({ name, code: safeCode, description: description || null, department_id: department_id || null, is_system: false })
      .select('id, name, code')
      .single();

    if (roleError) throw roleError;

    if (permissions && Array.isArray(permissions) && permissions.length > 0) {
      const { data: permRows } = await supabaseAdmin
        .from('permissions')
        .select('id, resource, action')
        .in('id', permissions);

      if (permRows && permRows.length > 0) {
        await supabaseAdmin
          .from('role_permissions')
          .insert(permRows.map((p) => ({ role_id: role.id, permission_id: p.id })));
      }
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'role.create', 'role', role.id, { name, code: safeCode }, getClientIp(request));

    return NextResponse.json({ success: true, data: role });
  } catch (error: any) {
    console.error('Role create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
