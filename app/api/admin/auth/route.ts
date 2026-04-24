import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession, loadUserPermissions } from '@/lib/auth';
import { RESOURCES } from '@/lib/permissions';
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit';
import { getAdminAuthSecrets } from '@/lib/server-env';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

async function verifyLegacyPassword(inputPassword: string): Promise<boolean> {
  try {
    const { adminPasswordHash, adminPasswordLegacy } = getAdminAuthSecrets();

    if (adminPasswordHash) {
      if (adminPasswordHash.startsWith('$2')) {
        return bcrypt.compare(inputPassword, adminPasswordHash);
      }
      return inputPassword === adminPasswordHash;
    }

    return inputPassword === adminPasswordLegacy;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (typeof password !== 'string' || password.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Password is required' },
        { status: 400 }
      );
    }
    
    const ip = request.headers.get('x-forwarded-for') || 
                request.headers.get('x-real-ip') || 
                'unknown';
    
    const rateLimitKey = username ? `auth:${username}:${ip}` : `auth:${ip}`;
    const rateLimitResult = checkRateLimit(rateLimitKey);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          success: false, 
          message: `Too many failed attempts. Account locked until ${rateLimitResult.lockedUntil?.toLocaleTimeString()}`,
          lockedUntil: rateLimitResult.lockedUntil
        },
        { status: 429 }
      );
    }

    // Try user-based auth first (new system)
    if (username && typeof username === 'string') {
      const { data: user } = await supabaseAdmin
        .from('admin_users')
        .select('id, username, display_name, password_hash, role, is_active, user_type')
        .eq('username', username.trim())
        .eq('is_active', true)
        .single();

      if (user) {
        const isValid = await bcrypt.compare(password, user.password_hash);

        if (isValid) {
          resetRateLimit(rateLimitKey);

          // Update last_login_at
          await supabaseAdmin
            .from('admin_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('id', user.id);

          const { permissions, departmentId, departmentCode, isSuperAdmin } = await loadUserPermissions(user.id);

          const session = await getSession();
          session.isAdmin = true;
          session.userId = user.id;
          session.username = user.username;
          session.displayName = user.display_name;
          session.departmentId = departmentId;
          session.departmentCode = departmentCode;
          session.permissions = permissions;
          session.isSuperAdmin = isSuperAdmin;
          session.user_type = (user as any).user_type ?? 'stanton_staff';
          // Clear any stale impersonation from a previous session on this cookie.
          session.impersonating = undefined;
          await session.save();

          await logAudit(
            { userId: user.id, username: user.username, displayName: user.display_name, departmentId: departmentId, departmentCode: departmentCode, permissions: permissions, isSuperAdmin, user_type: (user as any).user_type ?? 'stanton_staff' },
            'auth.login', 'admin_user', user.id, { method: 'user_password', isSuperAdmin }, getClientIp(request)
          );
          
          return NextResponse.json({ success: true });
        }
      }
    }

    // Fallback: legacy single-password auth (no username required)
    // This keeps the app working until all users are migrated
    const isLegacyValid = await verifyLegacyPassword(password);

    if (isLegacyValid) {
      resetRateLimit(rateLimitKey);
      
      const session = await getSession();
      session.isAdmin = true;
      session.displayName = 'Admin';
      session.isSuperAdmin = true; // legacy master-password sessions are implicitly super admin
      session.impersonating = undefined;
      // Legacy sessions use the master password — grant full access to all resources
      session.permissions = Object.values(RESOURCES).map((resource) => ({
        resource,
        action: 'admin',
      }));
      await session.save();

      await logAudit(null, 'auth.login_legacy', undefined, undefined, { method: 'legacy_password' }, getClientIp(request));
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Invalid username or password',
        remainingAttempts: rateLimitResult.remainingAttempts
      },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();

    // Backfill (legacy only): master-password sessions with no permissions get
    // full admin access. Named users no longer get silent backfills — if they
    // have no roles, they see an empty app (correct behaviour, reveals misconfig).
    if (
      session.isAdmin === true &&
      !session.userId &&
      (!session.permissions || session.permissions.length === 0)
    ) {
      session.permissions = Object.values(RESOURCES).map((resource) => ({
        resource,
        action: 'admin',
      }));
      session.isSuperAdmin = true;
      await session.save();
    }

    // If impersonating, swap in the target user's identity + live permissions
    // so the UI reflects their view exactly. Expose the real user separately
    // as `impersonator` so the banner can show who's driving.
    if (session.isAdmin === true && session.impersonating?.userId) {
      const { data: target } = await supabaseAdmin
        .from('admin_users')
        .select('id, username, display_name, is_active')
        .eq('id', session.impersonating.userId)
        .single();

      if (target && target.is_active) {
        const { permissions, departmentId, departmentCode } = await loadUserPermissions(target.id);
        return NextResponse.json({
          isAuthenticated: true,
          username: target.username,
          displayName: target.display_name,
          departmentId,
          departmentCode,
          permissions,
          isSuperAdmin: false,
          impersonator: {
            userId: session.userId ?? null,
            displayName: session.displayName ?? 'Admin',
            startedAt: session.impersonating.startedAt,
          },
        });
      }

      // Target missing/deactivated — drop the impersonation so the user isn't stuck.
      session.impersonating = undefined;
      await session.save();
    }

    return NextResponse.json({
      isAuthenticated: session.isAdmin === true,
      username: session.username || null,
      displayName: session.displayName || null,
      departmentId: session.departmentId || null,
      departmentCode: session.departmentCode || null,
      permissions: session.permissions || [],
      isSuperAdmin: session.isSuperAdmin === true,
      user_type: session.user_type ?? 'stanton_staff',
      impersonator: null,
    });
  } catch (error: any) {
    return NextResponse.json({ isAuthenticated: false });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    const user = session.userId ? { userId: session.userId, username: session.username || '', displayName: session.displayName || '', departmentId: session.departmentId ?? null, departmentCode: session.departmentCode ?? null, permissions: session.permissions ?? [], isSuperAdmin: session.isSuperAdmin === true, user_type: session.user_type ?? 'stanton_staff' } : null;
    session.destroy();
    await logAudit(user, 'auth.logout');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
