import { supabaseAdmin } from '@/lib/supabase';

/**
 * Records a reviewer's view of an application.
 * Fire-and-forget — caller should not await or check the result.
 */
export async function recordApplicationView(
  applicationId: string,
  reviewerId: string,
  reviewerName: string
): Promise<void> {
  try {
    await supabaseAdmin.from('application_view_events').insert({
      full_application_id: applicationId,
      reviewer_id: reviewerId,
      reviewer_name: reviewerName,
      viewed_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[view-tracking] failed to record view:', error);
  }
}
