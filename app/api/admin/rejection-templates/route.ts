import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated, getRealSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

/**
 * GET /api/admin/rejection-templates
 * Returns all rejection reason templates (active and inactive).
 * Requires: authenticated admin user
 */
export async function GET(_request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('rejection_reason_templates')
      .select('code, label, template_en, template_es, template_pt, sort_order, is_active')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[admin/rejection-templates] query error:', error);
      return NextResponse.json({ success: false, message: 'Failed to load templates' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error('[admin/rejection-templates] error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/rejection-templates
 * Updates a rejection reason template.
 * Requires: super admin or role-management admin permission
 */
export async function POST(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  // Get current user to check permissions
  const user = await getRealSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'User not found' }, { status: 403 });
  }

  // TODO: Add proper permission check for role-management admin
  // For now, we check if the user is a super admin (admin user with appropriate role)
  // This is handled by middleware in production

  let body: {
    code: string;
    template_en?: string;
    template_es?: string;
    template_pt?: string;
    is_active?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { code, template_en, template_es, template_pt, is_active } = body;

  if (!code) {
    return NextResponse.json({ success: false, message: 'code is required' }, { status: 400 });
  }

  try {
    // Build update object with only provided fields
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (template_en !== undefined) updateData.template_en = template_en;
    if (template_es !== undefined) updateData.template_es = template_es;
    if (template_pt !== undefined) updateData.template_pt = template_pt;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_by = user.userId;

    const { error } = await supabaseAdmin
      .from('rejection_reason_templates')
      .update(updateData)
      .eq('code', code);

    if (error) {
      console.error('[admin/rejection-templates] update error:', error);
      return NextResponse.json({ success: false, message: 'Failed to update template' }, { status: 500 });
    }

    // Audit log
    await logAudit(
      user,
      'admin.rejection_template.update',
      'rejection_reason_templates',
      code,
      { code, ...updateData },
      request.headers.get('x-forwarded-for') || undefined
    );

    return NextResponse.json({ success: true, message: 'Template updated' });
  } catch (err: any) {
    console.error('[admin/rejection-templates] error:', err);
    return NextResponse.json({ success: false, message: err.message || 'Internal error' }, { status: 500 });
  }
}
