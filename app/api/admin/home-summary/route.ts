import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Use counts where possible to avoid heavy payloads
    const [
      pendingReview,
      revisionRequested,
      approvedUnsent,
      activeProjects,
      draftProjects,
    ] = await Promise.all([
      supabaseAdmin
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending_review'),
      supabaseAdmin
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'revision_requested'),
      supabaseAdmin
        .from('form_submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'approved')
        .is('sent_to_appfolio_at', null),
      supabaseAdmin
        .from('projects')
        .select('id, name, deadline, status', { count: 'exact' })
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(5),
      supabaseAdmin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'draft'),
    ]);

    // Today's permit pickups — count permits picked up today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const pickupsToday = await supabaseAdmin
      .from('tenant_lookup')
      .select('id', { count: 'exact', head: true })
      .gte('tenant_picked_up_at', todayStart.toISOString());

    // Tow flagged count
    const towFlagged = await supabaseAdmin
      .from('tenant_lookup')
      .select('id', { count: 'exact', head: true })
      .eq('tow_flagged', true);

    return NextResponse.json({
      success: true,
      data: {
        submissions: {
          pending_review: pendingReview.count ?? 0,
          revision_requested: revisionRequested.count ?? 0,
          approved_unsent: approvedUnsent.count ?? 0,
        },
        projects: {
          active_count: activeProjects.count ?? 0,
          draft_count: draftProjects.count ?? 0,
          active: activeProjects.data ?? [],
        },
        lobby: {
          pickups_today: pickupsToday.count ?? 0,
          tow_flagged: towFlagged.count ?? 0,
        },
      },
    });
  } catch (error: any) {
    console.error('Home summary error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
