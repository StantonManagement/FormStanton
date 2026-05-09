import { supabaseAdmin } from '@/lib/supabase';

type DocStatus = 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';

interface RecomputeResult {
  summary: Record<DocStatus | 'total', number>;
  status: string;
}

/**
 * Recomputes form_submissions.document_review_summary and status from the
 * current state of form_submission_documents. Throws on DB error so callers
 * can surface the failure rather than silently swallowing it.
 *
 * Only updates submissions where review_granularity = 'per_document'.
 */
export async function recomputeSubmission(submissionId: string): Promise<RecomputeResult> {
  const { data: docs, error: fetchError } = await supabaseAdmin
    .from('form_submission_documents')
    .select('status, required')
    .eq('form_submission_id', submissionId);

  if (fetchError) throw fetchError;
  if (!docs) throw new Error(`recomputeSubmission: no docs returned for submission ${submissionId}`);

  const summary: Record<string, number> = {
    total: docs.length,
    missing: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    waived: 0,
  };

  for (const d of docs) {
    const key = d.status as string;
    if (key in summary) summary[key] = (summary[key] ?? 0) + 1;
  }

  const required = docs.filter((d) => d.required);

  let status = 'pending_review';
  if (required.length > 0 && required.every((d) => d.status === 'approved' || d.status === 'waived')) {
    status = 'approved';
  } else if (required.some((d) => d.status === 'rejected')) {
    status = 'revision_requested';
  } else if (required.some((d) => d.status === 'submitted')) {
    status = 'under_review';
  }

  const { error: updateError } = await supabaseAdmin
    .from('form_submissions')
    .update({ document_review_summary: summary, status })
    .eq('id', submissionId)
    .eq('review_granularity', 'per_document');

  if (updateError) throw updateError;

  return { summary: summary as Record<DocStatus | 'total', number>, status };
}
