import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getSession } from '@/lib/auth';
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
        .select('id, username, display_name, password_hash, role, is_active')
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

          const session = await getSession();
          session.isAdmin = true;
          session.userId = user.id;
          session.username = user.username;
          session.displayName = user.display_name;
          session.role = user.role;
          await session.save();

          await logAudit(
            { userId: user.id, username: user.username, displayName: user.display_name, role: user.role },
            'auth.login', 'admin_user', user.id, { method: 'user_password' }, getClientIp(request)
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
      // Legacy sessions don't have user identity
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
    return NextResponse.json({
      isAuthenticated: session.isAdmin === true,
      username: session.username || null,
      displayName: session.displayName || null,
      role: session.role || null,
    });
  } catch (error: any) {
    return NextResponse.json({ isAuthenticated: false });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    const user = session.userId ? { userId: session.userId, username: session.username || '', displayName: session.displayName || '', role: (session.role || 'staff') as 'admin' | 'staff' } : null;
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
