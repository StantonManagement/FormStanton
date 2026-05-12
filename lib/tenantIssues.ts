import { supabaseAdmin } from '@/lib/supabase';

export interface TenantIssueInput {
  tenant_name: string;
  unit_number?: string | null;
  building_address?: string | null;
  issue_type: 'parking_warning' | 'parking_declined_tow' | 'parking_tow_listed' | 'parking_delinquency';
  issue_date: string;
  reference_type?: string | null;
  reference_id?: string | null;
  severity?: number;
  notes?: string | null;
  created_by: string;
}

/**
 * Create a tenant issue record for scoring and tracking.
 * Used by tow list operations, parking enforcement, etc.
 */
export async function createTenantIssue(input: TenantIssueInput): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_issues')
      .insert({
        tenant_name: input.tenant_name,
        unit_number: input.unit_number || null,
        building_address: input.building_address || null,
        issue_type: input.issue_type,
        issue_date: input.issue_date,
        reference_type: input.reference_type || null,
        reference_id: input.reference_id || null,
        severity: input.severity || 3,
        notes: input.notes || null,
        created_by: input.created_by,
        resolved: false,
      })
      .select()
      .single();

    if (error) {
      console.error('createTenantIssue error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('createTenantIssue exception:', err);
    return { success: false, error: err.message || 'Failed to create tenant issue' };
  }
}

/**
 * Mark a tenant issue as resolved.
 */
export async function resolveTenantIssue(
  issueId: string,
  resolvedBy: string,
  notes?: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_issues')
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy,
        notes: notes ? `${notes} (resolved)` : 'Resolved',
      })
      .eq('id', issueId)
      .select()
      .single();

    if (error) {
      console.error('resolveTenantIssue error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err: any) {
    console.error('resolveTenantIssue exception:', err);
    return { success: false, error: err.message || 'Failed to resolve tenant issue' };
  }
}

/**
 * Find existing unresolved tenant issues for a reference.
 * Useful for checking if an issue already exists before creating a duplicate.
 */
export async function findExistingIssue(
  referenceType: string,
  referenceId: string,
  issueType: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_issues')
      .select('*')
      .eq('reference_type', referenceType)
      .eq('reference_id', referenceId)
      .eq('issue_type', issueType)
      .eq('resolved', false);

    if (error) {
      console.error('findExistingIssue error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: any) {
    console.error('findExistingIssue exception:', err);
    return { success: false, error: err.message || 'Failed to find existing issue' };
  }
}
