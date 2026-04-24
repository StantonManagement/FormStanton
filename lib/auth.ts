import { getIronSession } from 'iron-session';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionSecret } from '@/lib/server-env';
import { supabaseAdmin } from '@/lib/supabase';

// Permission granted to a user (cached in session at login)
export interface UserPermission {
  resource: string;
  action: string;
}

export interface ImpersonationState {
  userId: string;
  startedAt: string;
}

export interface SessionData {
  isAdmin: boolean;
  userId?: string;
  username?: string;
  displayName?: string;
  departmentId?: string | null;
  departmentCode?: string | null;
  permissions?: UserPermission[];
  isSuperAdmin?: boolean;
  impersonating?: ImpersonationState;
  user_type?: string;
}

export interface SessionUser {
  userId: string;
  username: string;
  displayName: string;
  departmentId: string | null;
  departmentCode: string | null;
  permissions: UserPermission[];
  isSuperAdmin: boolean;
  user_type: string;
}

const sessionSecret = getSessionSecret();

export const sessionOptions = {
  password: sessionSecret,
  cookieName: 'admin_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 60 * 60 * 24, // 24 hours
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isAdmin === true;
}

// Loads all permissions for a user by walking user_roles -> role_permissions -> permissions
export async function loadUserPermissions(userId: string): Promise<{
  permissions: UserPermission[];
  departmentId: string | null;
  departmentCode: string | null;
  isSuperAdmin: boolean;
  user_type: string;
}> {
  // Get all role IDs for this user
  const { data: userRoles } = await supabaseAdmin
    .from('user_roles')
    .select('role_id')
    .eq('user_id', userId);

  // Fetch department + super-admin flag + user_type regardless of role assignments
  const { data: userRow } = await supabaseAdmin
    .from('admin_users')
    .select('department_id, is_super_admin, user_type, departments(code)')
    .eq('id', userId)
    .single();

  const departmentId = userRow?.department_id ?? null;
  const deptRow = userRow?.departments as unknown as { code: string } | null;
  const departmentCode = deptRow?.code ?? null;
  const isSuperAdmin = userRow?.is_super_admin === true;
  const user_type = (userRow as any)?.user_type ?? 'stanton_staff';

  if (!userRoles || userRoles.length === 0) {
    return { permissions: [], departmentId, departmentCode, isSuperAdmin, user_type };
  }

  const roleIds = userRoles.map((r) => r.role_id);

  // Get all permissions from those roles
  const { data: rolePermissions } = await supabaseAdmin
    .from('role_permissions')
    .select('permission_id, permissions(resource, action)')
    .in('role_id', roleIds);

  const permissions: UserPermission[] = [];
  const seen = new Set<string>();

  if (rolePermissions) {
    for (const rp of rolePermissions) {
      const perm = rp.permissions as unknown as { resource: string; action: string } | null;
      if (perm) {
        const key = `${perm.resource}:${perm.action}`;
        if (!seen.has(key)) {
          seen.add(key);
          permissions.push({ resource: perm.resource, action: perm.action });
        }
      }
    }
  }

  return { permissions, departmentId, departmentCode, isSuperAdmin, user_type };
}

// Internal: resolve a SessionUser from an admin_users row + live permissions
// Used when impersonating to reflect the target's identity and authorisations.
async function loadSessionUserFromDb(userId: string): Promise<SessionUser | null> {
  const { data: row } = await supabaseAdmin
    .from('admin_users')
    .select('id, username, display_name, is_active, user_type')
    .eq('id', userId)
    .single();
  if (!row || !row.is_active) return null;
  const { permissions, departmentId, departmentCode, isSuperAdmin, user_type } = await loadUserPermissions(userId);
  return {
    userId: row.id,
    username: row.username,
    displayName: row.display_name,
    departmentId,
    departmentCode,
    permissions,
    user_type,
    // Impersonated identities never carry super-admin status, no matter the target.
    isSuperAdmin,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.isAdmin) return null;

  // If impersonating, return the impersonated user's identity & live permissions.
  // Super-admin is explicitly NOT carried over — the impersonator loses super powers
  // while viewing as someone else so the experience matches the target exactly.
  if (session.impersonating?.userId) {
    const impersonated = await loadSessionUserFromDb(session.impersonating.userId);
    if (impersonated) {
      return { ...impersonated, isSuperAdmin: false };
    }
    // Target disappeared/deactivated — fall through to real session user.
  }

  if (!session.userId || !session.username || !session.displayName) {
    return null;
  }
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    departmentId: session.departmentId ?? null,
    departmentCode: session.departmentCode ?? null,
    permissions: session.permissions ?? [],
    isSuperAdmin: session.isSuperAdmin === true,
    user_type: session.user_type ?? 'stanton_staff',
  };
}

// Returns the real logged-in user, bypassing any active impersonation.
// Use for audit logs, impersonation start/stop, and any action where the
// actual actor matters regardless of View As.
export async function getRealSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session.isAdmin) return null;
  if (!session.userId || !session.username || !session.displayName) {
    return null;
  }
  return {
    userId: session.userId,
    username: session.username,
    displayName: session.displayName,
    departmentId: session.departmentId ?? null,
    departmentCode: session.departmentCode ?? null,
    permissions: session.permissions ?? [],
    isSuperAdmin: session.isSuperAdmin === true,
    user_type: session.user_type ?? 'stanton_staff',
  };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

// Check if a session user has a specific permission (admin action implies all others)
// Super admins always pass. This short-circuit is what makes the flag unkillable.
export function userHasPermission(
  user: SessionUser,
  resource: string,
  action: string
): boolean {
  if (user.isSuperAdmin) return true;
  return user.permissions.some(
    (p) =>
      p.resource === resource &&
      (p.action === action || p.action === 'admin')
  );
}

// Route guard: returns a NextResponse on failure, null on success
export async function requirePermission(
  resource: string,
  action: string
): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (!userHasPermission(user, resource, action)) {
    return NextResponse.json(
      { success: false, message: 'You do not have permission to perform this action' },
      { status: 403 }
    );
  }
  return null;
}

// Route guard: allow only HACH users (hach_admin | hach_reviewer)
export async function requireHachUser(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (user.user_type !== 'hach_admin' && user.user_type !== 'hach_reviewer') {
    return NextResponse.json(
      { success: false, message: 'Forbidden — HACH users only' },
      { status: 403 }
    );
  }
  return null;
}

// Route guard: allow only Stanton staff (stanton_staff)
export async function requireStantonStaff(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  if (user.user_type === 'hach_admin' || user.user_type === 'hach_reviewer') {
    return NextResponse.json(
      { success: false, message: 'Forbidden — Stanton staff only' },
      { status: 403 }
    );
  }
  return null;
}

// Legacy compat: kept for requireRole('admin') calls on user-management routes
// Maps to requirePermission('user-management', 'admin')
export async function requireRole(role: 'admin' | 'staff'): Promise<NextResponse | null> {
  if (role === 'admin') {
    return requirePermission('user-management', 'admin');
  }
  const authenticated = await isAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
