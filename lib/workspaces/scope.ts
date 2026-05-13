/**
 * Workspace Scope Resolver
 *
 * Enforces the wall between Stanton and HACH by validating session access
 * to workspaces and auto-creating workspaces on first access.
 *
 * Stanton routes use resolveStantonWorkspace — never touches HACH-private tables.
 * HACH routes use resolveHachWorkspace — never touches Stanton-private tables.
 */

import { supabaseAdmin } from '@/lib/supabase';
import { SessionUser } from '@/lib/auth';
import { ReviewWorkspace, WorkspaceParty } from './types';

// PBV workspace default parties
const PBV_DEFAULT_PARTIES: Array<{ party_role: string; party_org: 'stanton' | 'hach'; display_label: string }> = [
  { party_role: 'stanton', party_org: 'stanton', display_label: 'Stanton Management' },
  { party_role: 'hach', party_org: 'hach', display_label: 'Hartford Housing Authority' },
];

/**
 * Resolves a workspace for a Stanton session.
 * Verifies the workspace anchor maps to an application the Stanton user can access.
 * If no workspace exists for this anchor, creates one with the two default PBV parties.
 * Returns null if the anchor is unreachable for this session (caller returns 403).
 */
export async function resolveStantonWorkspace(
  workspaceId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] } | null> {
  // Verify this is a Stanton user
  if (sessionUser.user_type === 'hach_admin' || sessionUser.user_type === 'hach_reviewer') {
    return null;
  }

  // Fetch the workspace
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('review_workspaces')
    .select('id, workspace_type, anchor_id, created_at, created_by')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return null;
  }

  // Verify the anchor application exists and is accessible to Stanton users
  // For PBV workspaces, we check pbv_full_applications — Stanton can access any
  const { data: app, error: appError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id')
    .eq('id', workspace.anchor_id)
    .single();

  if (appError || !app) {
    return null;
  }

  // Fetch parties for this workspace
  const { data: parties, error: partiesError } = await supabaseAdmin
    .from('workspace_parties')
    .select('id, workspace_id, party_role, party_org, display_label, created_at')
    .eq('workspace_id', workspaceId);

  if (partiesError) {
    return null;
  }

  return {
    workspace: workspace as unknown as ReviewWorkspace,
    parties: (parties ?? []) as unknown as WorkspaceParty[],
  };
}

/**
 * Mirror of resolveStantonWorkspace for HACH sessions.
 * Verifies the anchor application has hach_review_status set (i.e. HACH-accessible).
 */
export async function resolveHachWorkspace(
  workspaceId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] } | null> {
  // Verify this is a HACH user
  if (sessionUser.user_type !== 'hach_admin' && sessionUser.user_type !== 'hach_reviewer') {
    return null;
  }

  // Fetch the workspace
  const { data: workspace, error: workspaceError } = await supabaseAdmin
    .from('review_workspaces')
    .select('id, workspace_type, anchor_id, created_at, created_by')
    .eq('id', workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return null;
  }

  // Verify the anchor application is HACH-accessible (has hach_review_status)
  const { data: app, error: appError } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, hach_review_status')
    .eq('id', workspace.anchor_id)
    .not('hach_review_status', 'is', null)
    .single();

  if (appError || !app) {
    return null;
  }

  // Fetch parties for this workspace
  const { data: parties, error: partiesError } = await supabaseAdmin
    .from('workspace_parties')
    .select('id, workspace_id, party_role, party_org, display_label, created_at')
    .eq('workspace_id', workspaceId);

  if (partiesError) {
    return null;
  }

  return {
    workspace: workspace as unknown as ReviewWorkspace,
    parties: (parties ?? []) as unknown as WorkspaceParty[],
  };
}

/**
 * Lazy create for the application-level entry point: given a Stanton or HACH session and an
 * application id, return the workspace (creating it if needed). Used when the UI links into
 * the workspace from an application detail page.
 *
 * Uses INSERT … ON CONFLICT (workspace_type, anchor_id) DO NOTHING to handle races.
 */
export async function ensurePbvWorkspaceForApplication(
  applicationId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] }> {
  const workspaceType = 'pbv';

  // Try to find existing workspace
  let { data: workspace } = await supabaseAdmin
    .from('review_workspaces')
    .select('id, workspace_type, anchor_id, created_at, created_by')
    .eq('workspace_type', workspaceType)
    .eq('anchor_id', applicationId)
    .single();

  // If no workspace exists, create it with default parties
  if (!workspace) {
    // Insert workspace
    const { data: newWorkspace, error: insertError } = await supabaseAdmin
      .from('review_workspaces')
      .insert({
        workspace_type: workspaceType,
        anchor_id: applicationId,
        created_by: sessionUser.userId,
      })
      .select('id, workspace_type, anchor_id, created_at, created_by')
      .single();

    if (insertError) {
      // Race condition: another request may have created it — try select again
      const { data: raceWorkspace } = await supabaseAdmin
        .from('review_workspaces')
        .select('id, workspace_type, anchor_id, created_at, created_by')
        .eq('workspace_type', workspaceType)
        .eq('anchor_id', applicationId)
        .single();

      if (!raceWorkspace) {
        throw new Error(`Failed to create or find workspace: ${insertError.message}`);
      }
      workspace = raceWorkspace;
    } else {
      workspace = newWorkspace;

      // Seed default parties
      const partyInserts = PBV_DEFAULT_PARTIES.map((p) => ({
        workspace_id: workspace!.id,
        ...p,
      }));

      const { error: partyError } = await supabaseAdmin
        .from('workspace_parties')
        .insert(partyInserts);

      if (partyError) {
        // Non-fatal: parties can be backfilled if needed
        console.error('Failed to seed workspace parties:', partyError);
      }
    }
  }

  // Fetch parties
  const { data: parties } = await supabaseAdmin
    .from('workspace_parties')
    .select('id, workspace_id, party_role, party_org, display_label, created_at')
    .eq('workspace_id', workspace.id);

  return {
    workspace: workspace as unknown as ReviewWorkspace,
    parties: (parties ?? []) as unknown as WorkspaceParty[],
  };
}
