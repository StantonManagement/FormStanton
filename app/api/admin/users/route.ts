import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isAuthenticated, getSessionUser, requireRole } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

// List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const roleCheck = await requireRole('admin');
    if (roleCheck) return roleCheck;

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .select('id, username, display_name, role, is_active, last_login_at, created_at')
      .order('display_name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Users list error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// Create a new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const roleCheck = await requireRole('admin');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { username, displayName, password, role } = body;

    if (!username || !displayName || !password) {
      return NextResponse.json(
        { success: false, message: 'Username, display name, and password are required' },
        { status: 400 }
      );
    }

    if (role && !['admin', 'staff'].includes(role)) {
      return NextResponse.json(
        { success: false, message: 'Role must be admin or staff' },
        { status: 400 }
      );
    }

    // Check for duplicate username
    const { data: existing } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { success: false, message: 'A user with this username already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .insert({
        username: username.toLowerCase(),
        display_name: displayName,
        password_hash: passwordHash,
        role: role || 'staff',
        is_active: true,
      })
      .select('id, username, display_name, role, is_active, created_at')
      .single();

    if (error) throw error;

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'user.create', 'admin_user', data?.id, {
      username: username.toLowerCase(), displayName, role: role || 'staff',
    }, getClientIp(request));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('User create error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}

// Update a user (admin only)
export async function PUT(request: NextRequest) {
  try {
    const roleCheck = await requireRole('admin');
    if (roleCheck) return roleCheck;

    const body = await request.json();
    const { userId, displayName, role, isActive, newPassword } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: 'User ID is required' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = {};

    if (displayName !== undefined) updates.display_name = displayName;
    if (role !== undefined) {
      if (!['admin', 'staff'].includes(role)) {
        return NextResponse.json(
          { success: false, message: 'Role must be admin or staff' },
          { status: 400 }
        );
      }
      updates.role = role;
    }
    if (isActive !== undefined) updates.is_active = isActive;
    if (newPassword) {
      updates.password_hash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, message: 'No updates provided' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('admin_users')
      .update(updates)
      .eq('id', userId)
      .select('id, username, display_name, role, is_active, last_login_at, created_at')
      .single();

    if (error) throw error;

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'user.update', 'admin_user', userId, {
      updatedFields: Object.keys(updates).filter(k => k !== 'password_hash'),
      passwordChanged: !!newPassword,
    }, getClientIp(request));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('User update error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
