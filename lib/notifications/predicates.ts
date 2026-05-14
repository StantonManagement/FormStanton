/**
 * predicates.ts
 *
 * Cancel predicates for notification_schedules.cancel_predicate values.
 * Each predicate returns true if the scheduled send should be cancelled.
 */

import { supabaseAdmin } from '@/lib/supabase';

export type PredicateFn = (applicationId: string) => Promise<boolean>;

/**
 * all_docs_uploaded — cancel docs_upload_reminder once all required documents
 * have been submitted or approved (none remain in 'missing' or 'rejected' status).
 */
export async function all_docs_uploaded(applicationId: string): Promise<boolean> {
  const { count } = await supabaseAdmin
    .from('application_documents')
    .select('id', { count: 'exact', head: true })
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId)
    .in('status', ['missing', 'rejected']);

  return (count ?? 1) === 0;
}

/**
 * all_signatures_complete — cancel signing_reminder once all required
 * signature documents are signed/submitted/approved/waived.
 */
export async function all_signatures_complete(applicationId: string): Promise<boolean> {
  const { data: docs } = await supabaseAdmin
    .from('application_documents')
    .select('id, status, required')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId)
    .eq('required', true);

  if (!docs || docs.length === 0) return false;
  return docs.every((d) => d.status !== 'missing' && d.status !== 'rejected');
}

const PREDICATE_MAP: Record<string, PredicateFn> = {
  all_docs_uploaded,
  all_signatures_complete,
};

export function resolvePredicate(name: string): PredicateFn | null {
  return PREDICATE_MAP[name] ?? null;
}
