import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requirePermission, getSessionUser, getRealSessionUser } from '@/lib/auth';
import { logAudit, getClientIp } from '@/lib/audit';

const PBV_REVIEWER_ROLE_CODE = 'pbv_reviewer';
const PBV_FULL_APPLICATIONS_RESOURCE = 'pbv-full-applications';
const READ_SSN_ACTION = 'read_ssn';

// Ensure pbv_reviewer role exists with read_ssn permission
async function ensureReviewerRole(): Promise<string | null> {
  // Check if role exists
  const { data: existingRole } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('code', PBV_REVIEWER_ROLE_CODE)
    .maybeSingle();

  if (existingRole) {
    return existingRole.id;
  }

  // Find read_ssn permission
  const { data: permission } = await supabaseAdmin
    .from('permissions')
    .select('id')
    .eq('resource', PBV_FULL_APPLICATIONS_RESOURCE)
    .eq('action', READ_SSN_ACTION)
    .single();

  if (!permission) {
    return null;
  }

  // Create role
  const { data: newRole, error: roleError } = await supabaseAdmin
    .from('roles')
    .insert({
      name: 'PBV Reviewer',
      code: PBV_REVIEWER_ROLE_CODE,
      description: 'Can read decrypted SSNs for PBV household members',
      is_system: true,
    })
    .select('id')
    .single();

  if (roleError || !newRole) {
    console.error('Failed to create pbv_reviewer role:', roleError);
    return null;
  }

  // Assign permission
  const { error: permError } = await supabaseAdmin
    .from('role_permissions')
    .insert({
      role_id: newRole.id,
      permission_id: permission.id,
    });

  if (permError) {
    console.error('Failed to assign permission to pbv_reviewer role:', permError);
    return null;
  }

  return newRole.id;
}

// GET: List all PBV reviewers and recent access log
export async function GET(request: NextRequest) {
  const guard = await requirePermission(PBV_FULL_APPLICATIONS_RESOURCE, 'admin');
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const includeLog = searchParams.get('include_log') === 'true';

    // Get role ID
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('code', PBV_REVIEWER_ROLE_CODE)
      .maybeSingle();

    let reviewers: Array<{
      id: string;
      username: string;
      display_name: string;
      is_active: boolean;
      last_login_at: string | null;
      assigned_at: string | null;
    }> = [];

    if (role) {
      const { data: userRoles } = await supabaseAdmin
        .from('user_roles')
        .select('user_id, created_at')
        .eq('role_id', role.id);

      if (userRoles && userRoles.length > 0) {
        const userIds = userRoles.map((ur) => ur.user_id);
        const assignmentMap = new Map(userRoles.map((ur) => [ur.user_id, ur.created_at]));

        const { data: users } = await supabaseAdmin
          .from('admin_users')
          .select('id, username, display_name, is_active, last_login_at')
          .in('id', userIds)
          .order('display_name', { ascending: true });

        reviewers = (users ?? []).map((u) => ({
          ...u,
          assigned_at: assignmentMap.get(u.id) ?? null,
        }));
      }
    }

    // Get recent access log entries
    let recentAccess: Array<{
      id: string;
      user_id: string;
      user_display_name: string | null;
      action: string;
      resource_type: string;
      resource_id: string;
      accessed_at: string;
      notes: string | null;
    }> = [];

    if (includeLog) {
      const { data: logEntries } = await supabaseAdmin
        .from('pbv_access_log')
        .select('id, user_id, action, resource_type, resource_id, accessed_at, notes')
        .order('accessed_at', { ascending: false })
        .limit(50);

      if (logEntries && logEntries.length > 0) {
        const userIds = Array.from(new Set(logEntries.map((e) => e.user_id)));
        const { data: users } = await supabaseAdmin
          .from('admin_users')
          .select('id, display_name')
          .in('id', userIds);

        const userMap = new Map(users?.map((u) => [u.id, u.display_name]) ?? []);

        recentAccess = logEntries.map((e) => ({
          ...e,
          user_display_name: userMap.get(e.user_id) ?? null,
        }));
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reviewers,
        recent_access: recentAccess,
        role_exists: !!role,
      },
    });
  } catch (error: any) {
    console.error('GET /api/admin/pbv/reviewers error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// POST: Grant PBV reviewer role to a user
export async function POST(request: NextRequest) {
  const guard = await requirePermission(PBV_FULL_APPLICATIONS_RESOURCE, 'admin');
  if (guard) return guard;

  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 });
    }

    // Ensure role exists
    const roleId = await ensureReviewerRole();
    if (!roleId) {
      return NextResponse.json(
        { success: false, message: 'Failed to create or find pbv_reviewer role' },
        { status: 500 }
      );
    }

    // Check if user exists
    const { data: user } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name')
      .eq('id', user_id)
      .single();

    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    // Assign role using upsert to handle race conditions gracefully
    const actor = await getRealSessionUser();
    const { error: assignError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id,
        role_id: roleId,
        assigned_by: actor?.userId ?? null,
      }, {
        onConflict: 'user_id,role_id',
        ignoreDuplicates: false, // We want to know if it was an insert or update
      });

    // If we get a unique constraint violation, it means the user already has the role
    // (race condition occurred between our check and insert)
    if (assignError) {
      if (assignError.code === '23505' || assignError.message?.includes('unique constraint')) {
        return NextResponse.json(
          { success: false, message: 'User already has PBV reviewer access' },
          { status: 409 }
        );
      }
      throw assignError;
    }

    // Log audit
    await logAudit(
      actor,
      'pbv.reviewer.grant',
      'admin_user',
      user_id,
      { granted_to: user.display_name, role: 'pbv_reviewer' },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: { user_id, role_id: roleId },
    });
  } catch (error: any) {
    console.error('POST /api/admin/pbv/reviewers error:', error);
    // Return user-friendly error message, log full error server-side
    const userMessage = error?.code === '23505' || error?.message?.includes('unique constraint')
      ? 'User already has PBV reviewer access'
      : 'Failed to grant reviewer access. Please try again.';
    return NextResponse.json({ success: false, message: userMessage }, { status: 500 });
  }
}

// DELETE: Revoke PBV reviewer role from a user
export async function DELETE(request: NextRequest) {
  const guard = await requirePermission(PBV_FULL_APPLICATIONS_RESOURCE, 'admin');
  if (guard) return guard;

  try {
    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ success: false, message: 'user_id is required' }, { status: 400 });
    }

    // Get role ID
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('code', PBV_REVIEWER_ROLE_CODE)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ success: false, message: 'PBV reviewer role not found' }, { status: 404 });
    }

    // Get user info for audit
    const { data: user } = await supabaseAdmin
      .from('admin_users')
      .select('display_name')
      .eq('id', user_id)
      .single();

    // Remove assignment
    const { error: deleteError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', user_id)
      .eq('role_id', role.id);

    if (deleteError) {
      throw deleteError;
    }

    // Log audit
    const actor = await getRealSessionUser();
    await logAudit(
      actor,
      'pbv.reviewer.revoke',
      'admin_user',
      user_id,
      { revoked_from: user?.display_name ?? 'unknown', role: 'pbv_reviewer' },
      getClientIp(request)
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/pbv/reviewers error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to remove reviewer access. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT: Ensure pbv_reviewer role exists (idempotent)
export async function PUT() {
  const guard = await requirePermission(PBV_FULL_APPLICATIONS_RESOURCE, 'admin');
  if (guard) return guard;

  try {
    const roleId = await ensureReviewerRole();
    if (!roleId) {
      return NextResponse.json(
        { success: false, message: 'Failed to create pbv_reviewer role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { role_id: roleId, role_code: PBV_REVIEWER_ROLE_CODE },
    });
  } catch (error: any) {
    console.error('PUT /api/admin/pbv/reviewers error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
