import { supabaseAdmin } from '@/lib/supabase';

type DocStatus = 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';

export interface ApplicationDocSummary {
  total: number;
  missing: number;
  submitted: number;
  approved: number;
  rejected: number;
  waived: number;
}

/**
 * Recomputes document counts for a PBV full application from application_documents.
 * Returns the summary; does NOT write it anywhere — callers decide where to persist.
 */
export async function recomputeApplicationDocSummary(
  applicationId: string
): Promise<ApplicationDocSummary> {
  const { data: docs, error } = await supabaseAdmin
    .from('application_documents')
    .select('status')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId);

  if (error) {
    throw new Error(`recomputeApplicationDocSummary: failed to fetch docs for ${applicationId}: ${error.message}`);
  }

  const summary: ApplicationDocSummary = {
    total: (docs ?? []).length,
    missing: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    waived: 0,
  };

  for (const d of docs ?? []) {
    const key = d.status as DocStatus;
    if (key in summary) summary[key]++;
  }

  return summary;
}
