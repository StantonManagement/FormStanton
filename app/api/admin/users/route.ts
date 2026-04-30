import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

const DEFAULT_NEW_USER_ROLE_CODES = ['read_only', 'front_desk', 'back_office'] as const;

async function resolveDefaultNewUserRoleIds(): Promise<string[]> {
  const { data: roles, error } = await supabaseAdmin
    .from('roles')
    .select('id, code')
    .in('code', [...DEFAULT_NEW_USER_ROLE_CODES]);

  if (error) throw error;

  const roleIdByCode = new Map((roles ?? []).map((role) => [role.code, role.id]));
  const resolved = DEFAULT_NEW_USER_ROLE_CODES
    .map((code) => roleIdByCode.get(code))
    .filter((id): id is string => Boolean(id));

  if (resolved.length !== DEFAULT_NEW_USER_ROLE_CODES.length) {
    throw new Error('Default role bundle is not fully configured');
  }

  return resolved;
}

export async function GET() {
  try {
    const guard = await requirePermission('user-management', 'read');
    if (guard) return guard;

    const { data: users, error } = await supabaseAdmin
      .from('admin_users')
      .select(`
        id, username, display_name, is_active, is_super_admin, last_login_at, created_at,
        department_id,
        departments(id, name, code),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name, code))
      `)
      .order('display_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: users ?? [] });
  } catch (error: any) {
    console.error('Users list error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermission('user-management', 'write');
    if (guard) return guard;

    const body = await request.json();
    const { username, displayName, password, department_id, roleIds } = body;

    if (!username || !displayName || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, display name, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('username', username.trim())
      .single();

    if (existing) {
      return NextResponse.json({ success: false, message: 'Username already exists' }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error: userError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        username: username.trim(),
        display_name: displayName.trim(),
        password_hash: passwordHash,
        is_active: true,
        department_id: department_id || null,
      })
      .select('id, username, display_name, is_active, created_at')
      .single();

    if (userError) throw userError;

    const requestedRoleIds = Array.isArray(roleIds)
      ? roleIds.filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      : [];
    const effectiveRoleIds = requestedRoleIds.length > 0
      ? requestedRoleIds
      : await resolveDefaultNewUserRoleIds();

    const sessionUser = await getSessionUser();

    if (effectiveRoleIds.length > 0) {
      await supabaseAdmin
        .from('user_roles')
        .insert(effectiveRoleIds.map((roleId: string) => ({
          user_id: user.id,
          role_id: roleId,
          assigned_by: sessionUser?.userId ?? null,
        })));
    }

    await logAudit(
      sessionUser,
      'user.create',
      'admin_user',
      user.id,
      { username: user.username, roleIds: effectiveRoleIds },
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data: user });
  } catch (error: any) {
    console.error('User create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const guard = await requirePermission('user-management', 'write');
    if (guard) return guard;

    const body = await request.json();
    const { userId, displayName, newPassword, department_id, isActive, roleIds } = body;

    if (!userId) {
      return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (displayName !== undefined) updates.display_name = displayName.trim();
    if (department_id !== undefined) updates.department_id = department_id || null;
    if (isActive !== undefined) updates.is_active = isActive;

    if (newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { success: false, message: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      updates.password_hash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from('admin_users').update(updates).eq('id', userId);
      if (error) throw error;
    }

    // Replace roles if provided
    if (roleIds !== undefined && Array.isArray(roleIds)) {
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
      if (roleIds.length > 0) {
        const sessionUser = await getSessionUser();
        await supabaseAdmin
          .from('user_roles')
          .insert(roleIds.map((roleId: string) => ({
            user_id: userId,
            role_id: roleId,
            assigned_by: sessionUser?.userId ?? null,
          })));
      }
    }

    const sessionUser = await getSessionUser();
    await logAudit(
      sessionUser,
      'user.update',
      'admin_user',
      userId,
      { updatedFields: Object.keys(updates), rolesReplaced: roleIds !== undefined },
      getClientIp(request)
    );

    const { data: updated } = await supabaseAdmin
      .from('admin_users')
      .select(`
        id, username, display_name, is_active, last_login_at,
        department_id,
        departments(id, name, code),
        user_roles!user_roles_user_id_fkey(role_id, roles(id, name, code))
      `)
      .eq('id', userId)
      .single();

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('User update error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
