/**
 * lib/work/queries.ts
 *
 * Typed query functions for the Workforce Dashboards.
 * All panels read from existing tables — no new substrate.
 *
 * Tables used:
 * - application_events — for fresh activity, throughput, recently completed, overrides
 * - form_submission_documents / assigned_documents view — for my queue, workload, doc age
 * - pbv_full_applications — for bottlenecks, at-risk, apps without lead
 * - pbv_pipeline_stage_columns (via pbv_full_applications) — stage and days-in-stage
 */

import { supabaseAdmin } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Aging Thresholds (hardcoded per Open Question #3)
// ─────────────────────────────────────────────────────────────────────────────

export const AGING_THRESHOLDS = {
  stanton_review_days: 5,
  hach_review_days: 14,
  default_stage_days: 10,
  stale_touched_days: 7,
  at_risk_move_in_days: 14,
  doc_age_buckets: [1, 3, 7, 14],
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface AssignedDoc {
  document_id: string;
  doc_type: string;
  label: string;
  status: string;
  revision: number;
  assigned_at: string;
  owner_review_status: string | null;
  form_submission_id: string;
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
}

export interface AwaitingConfirmationDoc {
  document_id: string;
  doc_type: string;
  label: string;
  status: string;
  revision: number;
  owner_review_status: string;
  owner_flag_reason: string | null;
  reviewer: string | null;
  reviewed_at: string | null;
  assigned_to_user_id: string | null;
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
}

export interface AppLeadSummary {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  stage: string;
  tier1_pending_count: number;
  tier2_pending_count: number;
  ready_to_send: boolean;
}

export interface FreshActivityEvent {
  event_id: string;
  event_type: string;
  actor_display_name: string;
  created_at: string;
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  document_id: string | null;
  document_label: string | null;
  metadata: Record<string, unknown>;
}

export interface StaleTouchedApp {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  stage: string;
  days_stale: number;
  last_actor: string;
  suspected_blocker: 'tenant' | 'stanton' | 'hach' | 'internal';
  last_event_type: string;
  last_event_at: string;
}

export interface RecentlyCompletedDoc {
  document_id: string;
  doc_type: string;
  label: string;
  action: 'approved' | 'rejected' | 'waived';
  acted_at: string;
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
}

export interface WorkloadReviewer {
  user_id: string;
  display_name: string;
  assigned_count: number;
  awaiting_review_count: number;
  resubmitted_count: number;
  avg_age_days: number;
  reviewed_last_7_days: number;
  last_activity_at: string | null;
}

export interface BottleneckStage {
  stage: string;
  application_count: number;
  avg_days_in_stage: number;
  max_days_in_stage: number;
  above_threshold: boolean;
  threshold_days: number;
}

export interface AtRiskApp {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  stage: string;
  days_in_stage: number;
  target_move_in_date: string | null;
  days_until_move_in: number | null;
  risk_source: 'target_date' | 'stage_age';
}

export interface RecentOverride {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  submitted_at: string;
  submitted_by: string;
  override_reason: string;
  failed_checks: string[];
}

export interface DocAgeBucket {
  bucket_label: string;
  min_days: number;
  max_days: number | null;
  count: number;
}

export interface AppWithoutLead {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  stage: string;
  days_in_stage: number;
}

export interface Tier2BacklogApp {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  tier1_completed_count: number;
  tier1_total_count: number;
  tier2_pending_count: number;
  tier2_pending_percentage: number;
  lead_user_id: string | null;
  lead_display_name: string | null;
}

export interface HapExecutionBacklogApp {
  application_id: string;
  head_of_household_name: string;
  building_address: string;
  unit_number: string;
  packet_created_at: string;
  days_since_packet_creation: number;
  required_signatures_count: number;
  completed_signatures_count: number;
  hap_signature_status: string;
  can_execute: boolean;
  blocking_signatures: Array<{
    document_slug: string;
    document_label: string;
    status: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// My Work Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get documents assigned to a specific user (My Queue)
 */
export async function getMyQueue(
  userId: string,
  filters?: { status?: string; minAgeDays?: number; flaggedForRereview?: boolean }
): Promise<AssignedDoc[]> {
  let query = supabaseAdmin
    .from('assigned_documents')
    .select('*')
    .eq('assigned_to_user_id', userId);

  if (filters?.status) {
    const statuses = filters.status.split(',').map((s) => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
      query = query.in('status', statuses);
    }
  }

  if (filters?.flaggedForRereview) {
    query = query.eq('status', 'flagged_for_rereview');
  }

  if (filters?.minAgeDays && filters.minAgeDays > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - filters.minAgeDays);
    query = query.lte('assigned_at', cutoffDate.toISOString());
  }

  const { data, error } = await query.order('assigned_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as AssignedDoc[];
}

/**
 * Get documents awaiting confirmation from a user who is Application Lead
 */
export async function getAwaitingMyConfirmation(
  userId: string,
  statusFilter?: 'pending' | 'confirmed' | 'flagged'
): Promise<AwaitingConfirmationDoc[]> {
  // First, get applications where this user is the Lead
  const { data: leadApps, error: appsError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, building_address, unit_number, form_submission_id')
    .eq('lead_user_id', userId);

  if (appsError) throw appsError;
  if (!leadApps || leadApps.length === 0) return [];

  const submissionIds = leadApps.map((a) => a.form_submission_id).filter(Boolean);
  if (submissionIds.length === 0) return [];

  // Build app map for enrichment
  const appMap = new Map(
    leadApps.map((a) => [
      a.form_submission_id,
      {
        application_id: a.id,
        head_of_household_name: a.head_of_household_name,
        building_address: a.building_address,
        unit_number: a.unit_number,
      },
    ])
  );

  // Query documents with owner_review_status
  let query = supabaseAdmin
    .from('form_submission_documents')
    .select(
      `id, form_submission_id, doc_type, label, status, revision,
       owner_review_status, owner_flag_reason, reviewer, reviewed_at,
       assigned_to_user_id`
    )
    .in('form_submission_id', submissionIds)
    .not('owner_review_status', 'is', null);

  if (statusFilter) {
    query = query.eq('owner_review_status', statusFilter);
  }

  const { data: docs, error: docsError } = await query.order('reviewed_at', { ascending: false });

  if (docsError) throw docsError;
  if (!docs) return [];

  return docs.map((doc) => {
    const appInfo = appMap.get(doc.form_submission_id);
    return {
      document_id: doc.id,
      doc_type: doc.doc_type,
      label: doc.label,
      status: doc.status,
      revision: doc.revision,
      owner_review_status: doc.owner_review_status,
      owner_flag_reason: doc.owner_flag_reason,
      reviewer: doc.reviewer,
      reviewed_at: doc.reviewed_at,
      assigned_to_user_id: doc.assigned_to_user_id,
      application_id: appInfo?.application_id ?? '',
      head_of_household_name: appInfo?.head_of_household_name ?? 'Unknown',
      building_address: appInfo?.building_address ?? '',
      unit_number: appInfo?.unit_number ?? '',
    };
  });
}

/**
 * Get applications where user is Application Lead, with per-app rollup
 */
export async function getAppsILead(
  userId: string,
  includeFinished: boolean = false
): Promise<AppLeadSummary[]> {
  let query = supabaseAdmin
    .from('pbv_full_applications')
    .select(
      `id, head_of_household_name, building_address, unit_number, stage, form_submission_id`
    )
    .eq('lead_user_id', userId);

  if (!includeFinished) {
    // Exclude terminal stages
    query = query.not('stage', 'in', '("approved","denied","withdrawn")');
  }

  const { data: apps, error: appsError } = await query;
  if (appsError) throw appsError;
  if (!apps || apps.length === 0) return [];

  const submissionIds = apps.map((a) => a.form_submission_id).filter(Boolean);

  // Get document counts for each app
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('form_submission_documents')
    .select('form_submission_id, status, owner_review_status')
    .in('form_submission_id', submissionIds);

  if (docsError) throw docsError;

  return apps.map((app) => {
    const appDocs = (docs ?? []).filter((d) => d.form_submission_id === app.form_submission_id);

    // Tier-1 pending: submitted or flagged_for_rereview
    const tier1Pending = appDocs.filter(
      (d) => d.status === 'submitted' || d.status === 'flagged_for_rereview'
    );

    // Tier-2 pending: owner_review_status = 'pending'
    const tier2Pending = appDocs.filter((d) => d.owner_review_status === 'pending');

    // Ready to send: no tier-1 pending, no tier-2 pending
    const readyToSend = tier1Pending.length === 0 && tier2Pending.length === 0;

    return {
      application_id: app.id,
      head_of_household_name: app.head_of_household_name,
      building_address: app.building_address,
      unit_number: app.unit_number,
      stage: app.stage ?? 'unknown',
      tier1_pending_count: tier1Pending.length,
      tier2_pending_count: tier2Pending.length,
      ready_to_send: readyToSend,
    };
  });
}

/**
 * Get fresh activity (last 48h events) on apps where user is involved
 */
export async function getFreshActivity(userId: string): Promise<FreshActivityEvent[]> {
  const cutoffDate = new Date();
  cutoffDate.setHours(cutoffDate.getHours() - 48);

  // First, get applications where user has:
  // 1. Assigned docs, OR
  // 2. Is the Application Lead, OR
  // 3. Has acted as a reviewer recently

  const [{ data: assignedDocs }, { data: leadApps }, { data: actedEvents }] = await Promise.all([
    supabaseAdmin
      .from('assigned_documents')
      .select('application_id')
      .eq('assigned_to_user_id', userId),
    supabaseAdmin.from('pbv_full_applications').select('id').eq('lead_user_id', userId),
    supabaseAdmin
      .from('application_events')
      .select('anchor_id')
      .eq('anchor_type', 'pbv_full_application')
      .eq('actor_user_id', userId)
      .gte('created_at', cutoffDate.toISOString()),
  ]);

  const appIdSet = new Set<string>();
  assignedDocs?.forEach((d) => appIdSet.add(d.application_id));
  leadApps?.forEach((a) => appIdSet.add(a.id));
  actedEvents?.forEach((e) => appIdSet.add(e.anchor_id));

  const appIds = Array.from(appIdSet);
  if (appIds.length === 0) return [];

  // Get app info for enrichment
  const { data: appInfo } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, building_address, unit_number')
    .in('id', appIds);

  const appMap = new Map(
    (appInfo ?? []).map((a) => [
      a.id,
      { head_of_household_name: a.head_of_household_name, building_address: a.building_address, unit_number: a.unit_number },
    ])
  );

  // Get relevant events
  const eventTypes = [
    'document.uploaded_by_staff',
    'document.recategorized',
    'shared_workspace_messages',
    'handoff.sent',
    'handoff.reopened',
    'doc_assigned',
    'app_lead_assigned',
    'doc_owner_confirmed',
    'doc_owner_flagged',
  ];

  const { data: events, error } = await supabaseAdmin
    .from('application_events')
    .select(
      `id, event_type, actor_display_name, created_at, anchor_id, document_id, payload`
    )
    .eq('anchor_type', 'pbv_full_application')
    .in('anchor_id', appIds)
    .in('event_type', eventTypes)
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Get document labels for enrichment
  const docIds = (events ?? []).map((e) => e.document_id).filter(Boolean);
  let docMap = new Map<string, string>();

  if (docIds.length > 0) {
    const { data: docInfo } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, label')
      .in('id', docIds);
    docMap = new Map((docInfo ?? []).map((d) => [d.id, d.label]));
  }

  return (events ?? []).map((e) => {
    const app = appMap.get(e.anchor_id);
    return {
      event_id: e.id,
      event_type: e.event_type,
      actor_display_name: e.actor_display_name,
      created_at: e.created_at,
      application_id: e.anchor_id,
      head_of_household_name: app?.head_of_household_name ?? 'Unknown',
      building_address: app?.building_address ?? '',
      unit_number: app?.unit_number ?? '',
      document_id: e.document_id,
      document_label: e.document_id ? docMap.get(e.document_id) ?? null : null,
      metadata: e.payload as Record<string, unknown>,
    };
  });
}

/**
 * Get apps where user was last actor but no movement in 7+ days
 */
export async function getStaleTouched(userId: string): Promise<StaleTouchedApp[]> {
  const staleThreshold = new Date();
  staleThreshold.setDate(staleThreshold.getDate() - AGING_THRESHOLDS.stale_touched_days);

  // Get apps where this user was the most recent actor
  const { data: latestEvents, error } = await supabaseAdmin.rpc('get_latest_app_events');

  if (error) {
    // Fallback: use a simpler query if RPC doesn't exist
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('application_events')
      .select(
        `anchor_id, event_type, actor_user_id, actor_display_name, created_at`
      )
      .eq('anchor_type', 'pbv_full_application')
      .eq('actor_user_id', userId)
      .lte('created_at', staleThreshold.toISOString())
      .order('created_at', { ascending: false });

    if (eventsError) throw eventsError;

    // Group by app and get most recent
    const latestByApp = new Map<string, (typeof events)[0]>();
    (events ?? []).forEach((e) => {
      if (!latestByApp.has(e.anchor_id)) {
        latestByApp.set(e.anchor_id, e);
      }
    });

    const appIds = Array.from(latestByApp.keys());
    if (appIds.length === 0) return [];

    // Get app info
    const { data: apps } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number, stage, last_activity_at')
      .in('id', appIds)
      .not('stage', 'in', '("approved","denied","withdrawn")');

    return (apps ?? []).map((app) => {
      const lastEvent = latestByApp.get(app.id)!;
      const lastActivity = app.last_activity_at ? new Date(app.last_activity_at) : new Date(lastEvent.created_at);
      const daysStale = Math.floor(
        (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine suspected blocker from event type
      let suspectedBlocker: StaleTouchedApp['suspected_blocker'] = 'internal';
      if (lastEvent.event_type.includes('upload')) {
        suspectedBlocker = 'tenant';
      } else if (lastEvent.event_type.includes('hach')) {
        suspectedBlocker = 'hach';
      } else if (lastEvent.event_type.includes('handoff')) {
        suspectedBlocker = 'hach';
      }

      return {
        application_id: app.id,
        head_of_household_name: app.head_of_household_name,
        building_address: app.building_address,
        unit_number: app.unit_number,
        stage: app.stage ?? 'unknown',
        days_stale: daysStale,
        last_actor: lastEvent.actor_display_name,
        suspected_blocker: suspectedBlocker,
        last_event_type: lastEvent.event_type,
        last_event_at: lastEvent.created_at,
      };
    });
  }

  // If RPC exists, use it
  return [];
}

/**
 * Get recently completed documents (user's last N review actions)
 */
export async function getRecentlyCompleted(userId: string, limit: number = 10): Promise<RecentlyCompletedDoc[]> {
  const { data: events, error } = await supabaseAdmin
    .from('application_events')
    .select(
      `id, event_type, created_at, anchor_id, document_id, payload`
    )
    .eq('anchor_type', 'pbv_full_application')
    .eq('actor_user_id', userId)
    .in('event_type', ['document.approved', 'document.rejected', 'document.waived'])
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  if (!events || events.length === 0) return [];

  // Get app info
  const appIds = [...new Set(events.map((e) => e.anchor_id))];
  const { data: apps } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, building_address, unit_number')
    .in('id', appIds);

  const appMap = new Map(
    (apps ?? []).map((a) => [
      a.id,
      { head_of_household_name: a.head_of_household_name, building_address: a.building_address, unit_number: a.unit_number },
    ])
  );

  // Get doc labels
  const docIds = events.map((e) => e.document_id).filter(Boolean);
  const { data: docs } = await supabaseAdmin
    .from('form_submission_documents')
    .select('id, doc_type, label')
    .in('id', docIds);

  const docMap = new Map((docs ?? []).map((d) => [d.id, { doc_type: d.doc_type, label: d.label }]));

  return events.map((e) => {
    const app = appMap.get(e.anchor_id);
    const doc = e.document_id ? docMap.get(e.document_id) : null;
    const action = e.event_type.replace('document.', '') as RecentlyCompletedDoc['action'];

    return {
      document_id: e.document_id ?? '',
      doc_type: doc?.doc_type ?? 'unknown',
      label: doc?.label ?? 'Unknown document',
      action,
      acted_at: e.created_at,
      application_id: e.anchor_id,
      head_of_household_name: app?.head_of_household_name ?? 'Unknown',
      building_address: app?.building_address ?? '',
      unit_number: app?.unit_number ?? '',
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Team Rollup Queries
// ─────────────────────────────────────────────────────────────────────────────

function getDateRange(range: 'week' | 'month' | 'custom', from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  let fromDate: Date;
  let toDate: Date = now;

  if (range === 'custom' && from && to) {
    fromDate = new Date(from);
    toDate = new Date(to);
  } else if (range === 'month') {
    fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 30);
  } else {
    // week (default)
    fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - 7);
  }

  return { from: fromDate, to: toDate };
}

/**
 * Get workload rollup per reviewer
 */
export async function getWorkloadByReviewer(
  range: 'week' | 'month' | 'custom' = 'week',
  from?: string,
  to?: string
): Promise<WorkloadReviewer[]> {
  const dateRange = getDateRange(range, from, to);

  // Get all active admin users
  const { data: users, error: usersError } = await supabaseAdmin
    .from('admin_users')
    .select('id, display_name, is_active')
    .eq('is_active', true);

  if (usersError) throw usersError;
  if (!users || users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  // ── Batched queries: 3 total round-trips regardless of user count ──────────
  const [
    { data: allAssigned, error: assignedError },
    { data: allReviewed, error: reviewedError },
    { data: allActivity, error: activityError },
  ] = await Promise.all([
    // All current assignments across users
    supabaseAdmin
      .from('assigned_documents')
      .select('assigned_to_user_id, status, assigned_at')
      .in('assigned_to_user_id', userIds),
    // All review events in date range across users
    supabaseAdmin
      .from('application_events')
      .select('actor_user_id, created_at')
      .in('actor_user_id', userIds)
      .in('event_type', ['document.approved', 'document.rejected', 'document.waived'])
      .gte('created_at', dateRange.from.toISOString())
      .lte('created_at', dateRange.to.toISOString()),
    // All events ordered by recency — folded per-user below to find max created_at
    supabaseAdmin
      .from('application_events')
      .select('actor_user_id, created_at')
      .in('actor_user_id', userIds)
      .order('created_at', { ascending: false }),
  ]);

  if (assignedError) throw assignedError;
  if (reviewedError) throw reviewedError;
  if (activityError) throw activityError;

  // Group by user_id in memory (cheap — datasets are small)
  const assignedByUser = new Map<string, Array<{ status: string; assigned_at: string }>>();
  (allAssigned ?? []).forEach((row) => {
    const arr = assignedByUser.get(row.assigned_to_user_id) ?? [];
    arr.push({ status: row.status, assigned_at: row.assigned_at });
    assignedByUser.set(row.assigned_to_user_id, arr);
  });

  const reviewedCountByUser = new Map<string, number>();
  (allReviewed ?? []).forEach((row) => {
    reviewedCountByUser.set(row.actor_user_id, (reviewedCountByUser.get(row.actor_user_id) ?? 0) + 1);
  });

  // Most recent activity per user (first occurrence due to DESC order)
  const lastActivityByUser = new Map<string, string>();
  (allActivity ?? []).forEach((row) => {
    if (!lastActivityByUser.has(row.actor_user_id)) {
      lastActivityByUser.set(row.actor_user_id, row.created_at);
    }
  });

  const results: WorkloadReviewer[] = users.map((user) => {
    const assigned = assignedByUser.get(user.id) ?? [];
    const assignedCount = assigned.length;
    const awaitingCount = assigned.filter(
      (d) => d.status === 'submitted' || d.status === 'flagged_for_rereview'
    ).length;
    const resubmittedCount = assigned.filter((d) => d.status === 'flagged_for_rereview').length;

    const ages = assigned.map((d) => {
      const assignedAt = new Date(d.assigned_at);
      return Math.floor((Date.now() - assignedAt.getTime()) / (1000 * 60 * 60 * 24));
    });
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;

    return {
      user_id: user.id,
      display_name: user.display_name,
      assigned_count: assignedCount,
      awaiting_review_count: awaitingCount,
      resubmitted_count: resubmittedCount,
      avg_age_days: Math.round(avgAge * 10) / 10,
      reviewed_last_7_days: reviewedCountByUser.get(user.id) ?? 0,
      last_activity_at: lastActivityByUser.get(user.id) ?? null,
    };
  });

  // Sort by assigned count descending
  return results.sort((a, b) => b.assigned_count - a.assigned_count);
}

/**
 * Get bottlenecks by stage
 */
export async function getBottlenecks(
  range: 'week' | 'month' | 'custom' = 'week',
  from?: string,
  to?: string
): Promise<BottleneckStage[]> {
  const { data: apps, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('stage, days_in_stage')
    .not('stage', 'in', '("approved","denied","withdrawn")');

  if (error) throw error;

  // Group by stage
  const stageGroups = new Map<string, number[]>();
  (apps ?? []).forEach((app) => {
    const stage = app.stage ?? 'unknown';
    if (!stageGroups.has(stage)) {
      stageGroups.set(stage, []);
    }
    stageGroups.get(stage)!.push(app.days_in_stage ?? 0);
  });

  const results: BottleneckStage[] = [];

  for (const [stage, days] of stageGroups) {
    const count = days.length;
    const avg = days.reduce((a, b) => a + b, 0) / count;
    const max = Math.max(...days);

    // Determine threshold
    let threshold: number = AGING_THRESHOLDS.default_stage_days;
    if (stage === 'stanton_review') threshold = AGING_THRESHOLDS.stanton_review_days;
    if (stage === 'hach_review') threshold = AGING_THRESHOLDS.hach_review_days;

    results.push({
      stage,
      application_count: count,
      avg_days_in_stage: Math.round(avg * 10) / 10,
      max_days_in_stage: max,
      above_threshold: avg > threshold,
      threshold_days: threshold,
    });
  }

  // Sort chronologically by stage order
  const stageOrder = ['pre_app', 'intake', 'stanton_review', 'submitted_to_hach', 'hach_review'];
  return results.sort((a, b) => {
    const aIdx = stageOrder.indexOf(a.stage);
    const bIdx = stageOrder.indexOf(b.stage);
    if (aIdx === -1 && bIdx === -1) return a.stage.localeCompare(b.stage);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

/**
 * Get at-risk applications
 */
export async function getAtRisk(): Promise<AtRiskApp[]> {
  const now = new Date();
  const atRiskThreshold = new Date(now);
  atRiskThreshold.setDate(atRiskThreshold.getDate() + AGING_THRESHOLDS.at_risk_move_in_days);

  // First, try to find apps with target_move_in_date within threshold
  const { data: dateBasedApps, error: dateError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select(
      `id, head_of_household_name, building_address, unit_number, stage, days_in_stage, target_move_in_date`
    )
    .lte('target_move_in_date', atRiskThreshold.toISOString().split('T')[0])
    .not('stage', 'in', '("approved","denied","withdrawn")')
    .order('target_move_in_date', { ascending: true });

  if (dateError) throw dateError;

  const results: AtRiskApp[] = [];

  // Add date-based at-risk apps
  (dateBasedApps ?? []).forEach((app) => {
    const targetDate = app.target_move_in_date ? new Date(app.target_move_in_date) : null;
    const daysUntil = targetDate
      ? Math.floor((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    results.push({
      application_id: app.id,
      head_of_household_name: app.head_of_household_name,
      building_address: app.building_address,
      unit_number: app.unit_number,
      stage: app.stage ?? 'unknown',
      days_in_stage: app.days_in_stage ?? 0,
      target_move_in_date: app.target_move_in_date,
      days_until_move_in: daysUntil,
      risk_source: 'target_date',
    });
  });

  // If no date-based results, fall back to stage-age for hach_review and submitted_to_hach
  if (results.length === 0) {
    const { data: stageBasedApps, error: stageError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        `id, head_of_household_name, building_address, unit_number, stage, days_in_stage, target_move_in_date`
      )
      .in('stage', ['submitted_to_hach', 'hach_review'])
      .gte('days_in_stage', AGING_THRESHOLDS.hach_review_days)
      .not('stage', 'in', '("approved","denied","withdrawn")')
      .order('days_in_stage', { ascending: false });

    if (stageError) throw stageError;

    (stageBasedApps ?? []).forEach((app) => {
      results.push({
        application_id: app.id,
        head_of_household_name: app.head_of_household_name,
        building_address: app.building_address,
        unit_number: app.unit_number,
        stage: app.stage ?? 'unknown',
        days_in_stage: app.days_in_stage ?? 0,
        target_move_in_date: null,
        days_until_move_in: null,
        risk_source: 'stage_age',
      });
    });
  }

  return results;
}

/**
 * Get recent overrides (apps submitted with override in date range)
 */
export async function getRecentOverrides(
  rangeDays: number = 30
): Promise<RecentOverride[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - rangeDays);

  const { data: events, error } = await supabaseAdmin
    .from('application_events')
    .select(
      `anchor_id, created_at, actor_display_name, payload`
    )
    .eq('anchor_type', 'pbv_full_application')
    .in('event_type', ['handoff.sent', 'handoff.revised'])
    .gte('created_at', cutoffDate.toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Filter to only override events
  const overrideEvents = (events ?? []).filter((e) => {
    const payload = e.payload as Record<string, unknown>;
    return payload?.preflight_overrides && (payload.preflight_overrides as string[]).length > 0;
  });

  if (overrideEvents.length === 0) return [];

  // Get app info
  const appIds = [...new Set(overrideEvents.map((e) => e.anchor_id))];
  const { data: apps } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, building_address, unit_number')
    .in('id', appIds);

  const appMap = new Map(
    (apps ?? []).map((a) => [
      a.id,
      { head_of_household_name: a.head_of_household_name, building_address: a.building_address, unit_number: a.unit_number },
    ])
  );

  return overrideEvents.map((e) => {
    const app = appMap.get(e.anchor_id);
    const payload = e.payload as Record<string, unknown>;

    return {
      application_id: e.anchor_id,
      head_of_household_name: app?.head_of_household_name ?? 'Unknown',
      building_address: app?.building_address ?? '',
      unit_number: app?.unit_number ?? '',
      submitted_at: e.created_at,
      submitted_by: e.actor_display_name,
      override_reason: (payload?.override_reason as string) ?? 'No reason provided',
      failed_checks: (payload?.preflight_overrides as string[]) ?? [],
    };
  });
}

/**
 * Get document age distribution histogram
 */
export async function getDocAgeDistribution(
  filterByUploaderRole?: 'tenant' | 'staff' | 'hach'
): Promise<DocAgeBucket[]> {
  const { data: docs, error } = await supabaseAdmin
    .from('form_submission_documents')
    .select('created_at, uploaded_by_role')
    .eq('status', 'submitted');

  if (error) throw error;

  // Filter by uploader role if specified
  let filtered = docs ?? [];
  if (filterByUploaderRole) {
    filtered = filtered.filter((d) => d.uploaded_by_role === filterByUploaderRole);
  }

  const now = Date.now();
  const buckets: DocAgeBucket[] = [
    { bucket_label: '0–1 days', min_days: 0, max_days: 1, count: 0 },
    { bucket_label: '2–3 days', min_days: 2, max_days: 3, count: 0 },
    { bucket_label: '4–7 days', min_days: 4, max_days: 7, count: 0 },
    { bucket_label: '8–14 days', min_days: 8, max_days: 14, count: 0 },
    { bucket_label: '15+ days', min_days: 15, max_days: null, count: 0 },
  ];

  filtered.forEach((doc) => {
    const createdAt = new Date(doc.created_at);
    const ageDays = Math.floor((now - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    if (ageDays <= 1) buckets[0].count++;
    else if (ageDays <= 3) buckets[1].count++;
    else if (ageDays <= 7) buckets[2].count++;
    else if (ageDays <= 14) buckets[3].count++;
    else buckets[4].count++;
  });

  return buckets;
}

/**
 * Get applications without an assigned Lead
 */
export async function getAppsWithoutLead(): Promise<AppWithoutLead[]> {
  const { data: apps, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select(
      `id, head_of_household_name, building_address, unit_number, stage, days_in_stage`
    )
    .is('lead_user_id', null)
    .not('stage', 'in', '("pre_app","intake","approved","denied","withdrawn")')
    .order('days_in_stage', { ascending: false });

  if (error) throw error;

  return (apps ?? []).map((app) => ({
    application_id: app.id,
    head_of_household_name: app.head_of_household_name,
    building_address: app.building_address,
    unit_number: app.unit_number,
    stage: app.stage ?? 'unknown',
    days_in_stage: app.days_in_stage ?? 0,
  }));
}

/**
 * Get Tier-2 backlog (apps where tier-1 is mostly done but Lead hasn't confirmed)
 */
export async function getTier2Backlog(): Promise<Tier2BacklogApp[]> {
  // Get in-flight apps with a Lead assigned
  const { data: apps, error: appsError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select(
      `id, head_of_household_name, building_address, unit_number, form_submission_id, lead_user_id`
    )
    .not('stage', 'in', '("pre_app","intake","approved","denied","withdrawn")')
    .not('lead_user_id', 'is', null);

  if (appsError) throw appsError;
  if (!apps || apps.length === 0) return [];

  const submissionIds = apps.map((a) => a.form_submission_id).filter(Boolean);

  // Get documents for these apps
  const { data: docs, error: docsError } = await supabaseAdmin
    .from('form_submission_documents')
    .select('form_submission_id, status, owner_review_status')
    .in('form_submission_id', submissionIds);

  if (docsError) throw docsError;

  // Get lead display names
  const leadIds = [...new Set(apps.map((a) => a.lead_user_id).filter(Boolean))];
  const { data: leads } = await supabaseAdmin
    .from('admin_users')
    .select('id, display_name')
    .in('id', leadIds);

  const leadMap = new Map((leads ?? []).map((l) => [l.id, l.display_name]));

  const results: Tier2BacklogApp[] = [];

  for (const app of apps) {
    const appDocs = (docs ?? []).filter((d) => d.form_submission_id === app.form_submission_id);

    // Tier-1 completed = approved, rejected, or waived
    const tier1Completed = appDocs.filter(
      (d) => d.status === 'approved' || d.status === 'rejected' || d.status === 'waived'
    );

    // Tier-2 pending
    const tier2Pending = appDocs.filter((d) => d.owner_review_status === 'pending');

    // Check if >= 80% tier-1 complete AND tier-2 pending > 0
    const tier1Total = appDocs.length;
    const tier1Done = tier1Completed.length;
    const tier2Count = tier2Pending.length;

    if (tier1Total > 0 && tier1Done / tier1Total >= 0.8 && tier2Count > 0) {
      results.push({
        application_id: app.id,
        head_of_household_name: app.head_of_household_name,
        building_address: app.building_address,
        unit_number: app.unit_number,
        tier1_completed_count: tier1Done,
        tier1_total_count: tier1Total,
        tier2_pending_count: tier2Count,
        tier2_pending_percentage: Math.round((tier2Count / tier1Total) * 100),
        lead_user_id: app.lead_user_id,
        lead_display_name: app.lead_user_id ? leadMap.get(app.lead_user_id) ?? null : null,
      });
    }
  }

  // Sort by tier2_pending_count descending
  return results.sort((a, b) => b.tier2_pending_count - a.tier2_pending_count);
}

/**
 * Get HAP execution backlog (applications with signing packets ready for HAP execution)
 */
export async function getHapExecutionBacklog(): Promise<HapExecutionBacklogApp[]> {
  // Get applications with signing packets that haven't been executed
  const { data: packets, error: packetError } = await supabaseAdmin
    .from('signing_packets')
    .select(`
      application_id,
      created_at,
      executed_at,
      pbv_full_applications!inner(
        head_of_household_name,
        building_address,
        unit_number
      )
    `)
    .is('executed_at', null)
    .order('created_at', { ascending: false });

  if (packetError) throw packetError;
  if (!packets || packets.length === 0) return [];

  const appIds = packets.map(p => p.application_id);

  // Get all signatures for these packets
  const { data: signatures, error: sigError } = await supabaseAdmin
    .from('packet_signatures')
    .select(`
      packet_id,
      document_slug,
      document_label,
      signing_party,
      is_required,
      status
    `)
    .in('packet_id', appIds);

  if (sigError) throw sigError;

  const results: HapExecutionBacklogApp[] = [];

  for (const packet of packets) {
    const packetSignatures = (signatures ?? []).filter(s => s.packet_id === packet.application_id);
    const requiredSignatures = packetSignatures.filter(s => s.is_required);
    const completedSignatures = requiredSignatures.filter(s => ['signed', 'waived'].includes(s.status));
    
    // Find HAP signature
    const hapSignature = packetSignatures.find(s => 
      s.document_slug === 'hap_contract' && s.signing_party === 'stanton_and_hach'
    );

    // Find blocking signatures
    const blockingSignatures = requiredSignatures
      .filter(s => !['signed', 'waived'].includes(s.status))
      .map(s => ({
        document_slug: s.document_slug,
        document_label: s.document_label,
        status: s.status
      }));

    // Check if can execute (all required signatures complete AND HAP signed)
    const canExecute = completedSignatures.length === requiredSignatures.length && 
                      hapSignature?.status === 'signed';

    const daysSinceCreation = Math.floor(
      (Date.now() - new Date(packet.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    results.push({
      application_id: packet.application_id,
      head_of_household_name: packet.pbv_full_applications[0]?.head_of_household_name,
      building_address: packet.pbv_full_applications[0]?.building_address,
      unit_number: packet.pbv_full_applications[0]?.unit_number,
      packet_created_at: packet.created_at,
      days_since_packet_creation: daysSinceCreation,
      required_signatures_count: requiredSignatures.length,
      completed_signatures_count: completedSignatures.length,
      hap_signature_status: hapSignature?.status || 'missing',
      can_execute: canExecute,
      blocking_signatures: blockingSignatures
    });
  }

  // Sort by days_since_packet_creation descending (oldest first)
  return results.sort((a, b) => b.days_since_packet_creation - a.days_since_packet_creation);
}
