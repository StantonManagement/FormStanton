import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const PAGE_SIZE = 50;

/**
 * GET /api/hach/admin/audit-log
 * Returns paginated audit log entries for HACH users.
 * Query params: page, date_from, date_to, user_id, action
 * Requires hach_admin.
 */
export async function GET(request: NextRequest) {
  const guard = await requireHachUser();
  if (guard) return guard;
  const sessionUser = await getSessionUser();
  if (!sessionUser || sessionUser.user_type !== 'hach_admin') {
    return NextResponse.json({ success: false, message: 'HACH admin access required' }, { status: 403 });
  }

  try {
    const sp = request.nextUrl.searchParams;
    const dateFrom   = sp.get('date_from');
    const dateTo     = sp.get('date_to');
    const filterUser = sp.get('user_id');
    const filterAct  = sp.get('action');
    const page       = Math.max(0, parseInt(sp.get('page') || '0', 10));

    // Resolve HACH user IDs so we can filter audit_log entries to HACH actors only
    const { data: hachUsers } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name, username')
      .in('user_type', ['hach_admin', 'hach_reviewer']);

    const hachUserIds = (hachUsers ?? []).map((u: any) => u.id);
    const hachUserMap: Record<string, string> = {};
    for (const u of hachUsers ?? []) {
      hachUserMap[(u as any).id] = (u as any).display_name || (u as any).username;
    }

    if (hachUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { entries: [], total: 0, page, has_more: false, actions: [], hach_users: [] },
      });
    }

    let query = supabaseAdmin
      .from('audit_log')
      .select(
        'id, user_id, username, action, entity_type, entity_id, details, ip_address, created_at, user_type, user_agent',
        { count: 'exact' }
      )
      .in('user_id', hachUserIds)
      .order('created_at', { ascending: false });

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      query = query.lt('created_at', toDate.toISOString());
    }
    if (filterUser) {
      query = query.eq('user_id', filterUser);
    }
    if (filterAct) {
      query = query.eq('action', filterAct);
    }

    query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    const { data: entries, error, count } = await query;

    if (error) {
      console.error('[hach/admin/audit-log] query error:', error);
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Distinct action types (for filter dropdown) — from all HACH entries
    const { data: distinctActions } = await supabaseAdmin
      .from('audit_log')
      .select('action')
      .in('user_id', hachUserIds);
    const actions = [...new Set((distinctActions ?? []).map((r: any) => r.action as string))].sort();

    const total = count ?? 0;
    return NextResponse.json({
      success: true,
      data: {
        entries: entries ?? [],
        total,
        page,
        has_more: total > (page + 1) * PAGE_SIZE,
        actions,
        hach_users: (hachUsers ?? []).map((u: any) => ({
          id: u.id,
          name: u.display_name || u.username,
        })),
      },
    });
  } catch (err: any) {
    console.error('[hach/admin/audit-log] error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
