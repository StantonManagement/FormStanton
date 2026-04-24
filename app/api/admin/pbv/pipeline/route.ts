import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/pbv/pipeline
 *
 * Returns the full pipeline table data for Stanton staff.
 * All computation is done server-side in a small number of batch queries
 * to avoid N+1 issues even with 100+ rows.
 *
 * Query params:
 *   building  — filter by building_address ILIKE
 *   stage     — exact match on stage
 *   blocked   — filter by blocked_on: tenant | stanton | hach | nobody
 *   has_rejections — 'true' to show only apps with at least one rejection
 *   assignee  — UUID of assigned_to (or 'unassigned' for null)
 */
export async function GET(request: NextRequest) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filterBuilding   = searchParams.get('building') ?? '';
  const filterStage      = searchParams.get('stage') ?? '';
  const filterBlocked    = searchParams.get('blocked') ?? '';
  const filterRejections = searchParams.get('has_rejections') === 'true';
  const filterAssignee   = searchParams.get('assignee') ?? '';

  try {
    // ── 1. Main application rows ────────────────────────────────────────────
    let query = supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, created_at, head_of_household_name, building_address, unit_number,
         household_size, stage, stage_changed_at, last_activity_at, assigned_to,
         hach_review_status, preferred_language, form_submission_id`
      )
      .order('last_activity_at', { ascending: true });

    if (filterBuilding) query = query.ilike('building_address', `%${filterBuilding}%`);
    if (filterStage)    query = query.eq('stage', filterStage);
    if (filterAssignee === 'unassigned') query = query.is('assigned_to', null);
    else if (filterAssignee) query = query.eq('assigned_to', filterAssignee);

    const { data: apps, error: appsErr } = await query;
    if (appsErr) throw appsErr;
    if (!apps || apps.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const appIds         = apps.map((a) => a.id);
    const submissionIds  = apps.map((a) => a.form_submission_id).filter(Boolean) as string[];

    // ── 2. Document status counts per submission (batch) ───────────────────
    const { data: docRows } = await supabaseAdmin
      .from('form_submission_documents')
      .select('form_submission_id, status')
      .in('form_submission_id', submissionIds.length ? submissionIds : ['__none__']);

    // Map: submission_id → { missing, pending, rejected, approved, total }
    const docStatsBySubm: Record<string, { missing: number; pending: number; rejected: number; approved: number; total: number }> = {};
    for (const row of docRows ?? []) {
      if (!docStatsBySubm[row.form_submission_id]) {
        docStatsBySubm[row.form_submission_id] = { missing: 0, pending: 0, rejected: 0, approved: 0, total: 0 };
      }
      docStatsBySubm[row.form_submission_id].total++;
      if (row.status === 'missing')   docStatsBySubm[row.form_submission_id].missing++;
      else if (row.status === 'rejected') docStatsBySubm[row.form_submission_id].rejected++;
      else if (row.status === 'approved') docStatsBySubm[row.form_submission_id].approved++;
      else docStatsBySubm[row.form_submission_id].pending++;
    }

    // Also factor in document_review_actions (latest per doc)
    const { data: reviewActions } = await supabaseAdmin
      .from('document_review_actions')
      .select('document_id, full_application_id, action, created_at')
      .in('full_application_id', appIds)
      .order('created_at', { ascending: false });

    // Latest action per doc per application
    const latestActionByAppDoc: Record<string, Record<string, string>> = {};
    const lastActionAtByApp: Record<string, string> = {};
    const hasRejectionByApp: Record<string, boolean> = {};

    for (const ra of reviewActions ?? []) {
      if (!latestActionByAppDoc[ra.full_application_id]) {
        latestActionByAppDoc[ra.full_application_id] = {};
      }
      if (!latestActionByAppDoc[ra.full_application_id][ra.document_id]) {
        latestActionByAppDoc[ra.full_application_id][ra.document_id] = ra.action;
        if (ra.action === 'rejected') hasRejectionByApp[ra.full_application_id] = true;
      }
      if (!lastActionAtByApp[ra.full_application_id]) {
        lastActionAtByApp[ra.full_application_id] = ra.created_at;
      }
    }

    // ── 3. Assigned-to user names (batch) ──────────────────────────────────
    const assigneeIds = [...new Set(apps.map((a) => a.assigned_to).filter(Boolean))] as string[];
    const { data: assigneeUsers } = await supabaseAdmin
      .from('admin_users')
      .select('id, display_name')
      .in('id', assigneeIds.length ? assigneeIds : ['__none__']);

    const assigneeNameById: Record<string, string> = {};
    for (const u of assigneeUsers ?? []) assigneeNameById[u.id] = u.display_name;

    // ── 4. Income sources totals (batch) ───────────────────────────────────
    const { data: incomeSources } = await supabaseAdmin
      .from('pbv_income_sources')
      .select('full_application_id, annual_amount')
      .in('full_application_id', appIds);

    const incomeTotalByApp: Record<string, number> = {};
    for (const src of incomeSources ?? []) {
      incomeTotalByApp[src.full_application_id] =
        (incomeTotalByApp[src.full_application_id] ?? 0) + (src.annual_amount ?? 0);
    }

    // ── 5. AMI limits (single query — all sizes we need) ───────────────────
    const householdSizes = [...new Set(apps.map((a) => a.household_size ?? 1))];
    const { data: amiRows } = await supabaseAdmin
      .from('hud_ami_limits')
      .select('household_size, income_limit, ami_pct')
      .in('household_size', householdSizes)
      .eq('ami_pct', 50)
      .order('effective_year', { ascending: false });

    // Latest AMI limit per household size
    const amiBySize: Record<number, number> = {};
    for (const row of amiRows ?? []) {
      if (!amiBySize[row.household_size]) amiBySize[row.household_size] = row.income_limit;
    }

    // ── 6. Compute rows ────────────────────────────────────────────────────
    const HACH_STALE_DAYS = 10;
    const now = Date.now();

    const rows = apps.map((app) => {
      const docStats = docStatsBySubm[app.form_submission_id ?? ''] ?? { missing: 0, pending: 0, rejected: 0, approved: 0, total: 0 };
      const latestActions = latestActionByAppDoc[app.id] ?? {};
      const hasRejections = hasRejectionByApp[app.id] ?? false;

      // Effective doc stats using review actions
      let effMissing = 0, effPending = 0, effRejected = 0, effApproved = 0;
      // We don't have doc IDs here so use docStats as base and override with action counts
      // This is an approximation — action statuses override form_submission_documents.status
      const actionValues = Object.values(latestActions);
      const actionApproved = actionValues.filter((a) => a === 'approved').length;
      const actionRejected = actionValues.filter((a) => a === 'rejected').length;
      effMissing  = docStats.missing;
      effRejected = actionRejected;
      effApproved = actionApproved;
      effPending  = Math.max(0, docStats.total - effMissing - effRejected - effApproved);

      // blocked_on
      const stage = app.stage ?? 'intake';
      let blocked_on = 'nobody';

      if (effMissing > 0) {
        blocked_on = 'tenant';
      } else if (stage === 'stanton_review' && effPending === 0 && docStats.total > 0) {
        blocked_on = 'stanton';
      } else if (stage === 'hach_review' || stage === 'submitted_to_hach') {
        const lastActivity = lastActionAtByApp[app.id]
          ? new Date(lastActionAtByApp[app.id]).getTime()
          : null;
        const daysSinceActivity = lastActivity
          ? Math.floor((now - lastActivity) / 86400000)
          : HACH_STALE_DAYS + 1;
        if (daysSinceActivity >= HACH_STALE_DAYS) {
          blocked_on = 'hach';
        }
      } else if (stage !== 'approved' && stage !== 'denied') {
        if (effMissing > 0) blocked_on = 'tenant';
        else if (effPending > 0) blocked_on = 'stanton';
      }

      // days_in_stage
      const stageChangedAt = app.stage_changed_at
        ? new Date(app.stage_changed_at).getTime()
        : new Date(app.created_at).getTime();
      const days_in_stage = Math.floor((now - stageChangedAt) / 86400000);

      // next_action
      let next_action = '—';
      if (blocked_on === 'tenant') {
        next_action = `Chase tenant: ${effMissing} doc${effMissing !== 1 ? 's' : ''} missing`;
      } else if (blocked_on === 'stanton') {
        next_action = 'Review and submit to HACH';
      } else if (blocked_on === 'hach') {
        const daysSince = lastActionAtByApp[app.id]
          ? Math.floor((now - new Date(lastActionAtByApp[app.id]).getTime()) / 86400000)
          : days_in_stage;
        next_action = `Poke HACH — last activity ${daysSince}d ago`;
      }

      // income_status
      const income = incomeTotalByApp[app.id] ?? 0;
      const amiLimit = amiBySize[app.household_size ?? 1] ?? null;
      let income_status: 'qualifies' | 'delta' | 'over_limit' | 'no_data' = 'no_data';
      if (income > 0 && amiLimit != null) {
        if (income <= amiLimit) {
          const deltaPct = Math.abs((income - amiLimit) / amiLimit) * 100;
          income_status = deltaPct <= 10 ? 'qualifies' : 'delta';
        } else {
          income_status = 'over_limit';
        }
      }

      // staleness
      const lastActivityAt = app.last_activity_at ?? app.created_at;
      const days_stale = Math.floor((now - new Date(lastActivityAt).getTime()) / 86400000);

      return {
        id: app.id,
        head_of_household_name: app.head_of_household_name,
        building_address: app.building_address,
        unit_number: app.unit_number,
        household_size: app.household_size,
        stage,
        stage_changed_at: app.stage_changed_at,
        last_activity_at: lastActivityAt,
        days_in_stage,
        days_stale,
        blocked_on,
        next_action,
        assigned_to: app.assigned_to ?? null,
        assigned_to_name: app.assigned_to ? (assigneeNameById[app.assigned_to] ?? 'Unknown') : null,
        income_status,
        income_total: income > 0 ? income : null,
        ami_limit: amiLimit,
        has_rejections: hasRejections,
        hach_review_status: app.hach_review_status,
      };
    });

    // Apply post-fetch filters
    const filtered = rows.filter((row) => {
      if (filterBlocked && row.blocked_on !== filterBlocked) return false;
      if (filterRejections && !row.has_rejections) return false;
      return true;
    });

    // Sort: most stale first (last_activity_at ASC already applied in query)
    return NextResponse.json({ success: true, data: filtered });
  } catch (error: any) {
    console.error('[/api/admin/pbv/pipeline] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
