/**
 * Workspace Types — Multi-party review workspace data layer
 *
 * These types support the physical wall between Stanton and HACH.
 * Three separate message tables are represented as distinct channel scopes.
 */

export type WorkspaceType = 'pbv' | 'refi';
export type ChannelScope = 'stanton' | 'hach' | 'shared';
export type PartyOrg = 'stanton' | 'hach' | 'lender' | 'borrower' | 'title';

export interface ReviewWorkspace {
  id: string;
  workspace_type: WorkspaceType;
  anchor_id: string;
  created_at: string;
  created_by: string | null;
}

export interface WorkspaceParty {
  id: string;
  workspace_id: string;
  party_role: string;
  party_org: PartyOrg;
  display_label: string;
  created_at: string;
}

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  document_id: string | null;
  author_user_id: string | null;
  author_display_name: string;
  author_party_org: PartyOrg;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export interface WorkspaceUnreadCounts {
  stanton: number | null; // null if user has no access
  hach: number | null;
  shared: number | null;
}
