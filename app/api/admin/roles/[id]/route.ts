import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission('role-management', 'read');
    if (guard) return guard;

    const { id } = await params;

    const { data, error } = await supabaseAdmin
      .from('roles')
      .select(`
        id, name, code, description, is_system, created_at,
        department_id,
        departments(id, name, code),
        role_permissions(permission_id, permissions(id, resource, action, description))
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission('role-management', 'write');
    if (guard) return guard;

    const { id } = await params;
    const body = await request.json();
    const { name, description, department_id, permissions } = body;

    // Fetch role to check is_system constraint
    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id, name, is_system')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Role not found' }, { status: 404 });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (!existing.is_system && department_id !== undefined) updates.department_id = department_id || null;

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from('roles').update(updates).eq('id', id);
      if (error) throw error;
    }

    // Replace permissions if provided
    if (permissions !== undefined && Array.isArray(permissions)) {
      // Delete existing
      await supabaseAdmin.from('role_permissions').delete().eq('role_id', id);

      if (permissions.length > 0) {
        await supabaseAdmin
          .from('role_permissions')
          .insert(permissions.map((permId: string) => ({ role_id: id, permission_id: permId })));
      }
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'role.update', 'role', id, { updatedFields: Object.keys(updates), permissionsReplaced: permissions !== undefined }, getClientIp(request));

    const { data: updated } = await supabaseAdmin
      .from('roles')
      .select('id, name, code, description, is_system, department_id')
      .eq('id', id)
      .single();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Role update error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requirePermission('role-management', 'delete');
    if (guard) return guard;

    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('roles')
      .select('id, name, is_system')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Role not found' }, { status: 404 });
    }

    if (existing.is_system) {
      return NextResponse.json({ success: false, message: 'System roles cannot be deleted' }, { status: 400 });
    }

    await supabaseAdmin.from('roles').delete().eq('id', id);

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'role.delete', 'role', id, { name: existing.name }, getClientIp(request));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Role delete error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
