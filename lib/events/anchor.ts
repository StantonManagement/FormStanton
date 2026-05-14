/**
 * anchor.ts
 *
 * resolveAnchor — fetches the anchor row for a given (anchorType, anchorId) pair.
 * Used by event consumers that need to display or validate the anchor entity.
 *
 * Only 'pbv_full_application' is supported in this build.
 * Add new anchor types here when new workflows are onboarded.
 */

import { supabaseAdmin } from '@/lib/supabase';
import type { AnchorType } from './application-events';

export interface PbvFullApplicationAnchor {
  anchorType: 'pbv_full_application';
  id: string;
  headOfHouseholdName: string;
  formSubmissionId: string;
  packetLocked: boolean;
}

export type AnchorRow = PbvFullApplicationAnchor;

export async function resolveAnchor(
  anchorType: AnchorType,
  anchorId: string
): Promise<AnchorRow> {
  if (anchorType === 'pbv_full_application') {
    const { data, error } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, form_submission_id, packet_locked')
      .eq('id', anchorId)
      .single();

    if (error || !data) {
      throw new Error(
        `[anchor] Could not resolve pbv_full_application anchor ${anchorId}: ${error?.message ?? 'not found'}`
      );
    }

    return {
      anchorType: 'pbv_full_application',
      id: (data as any).id,
      headOfHouseholdName: (data as any).head_of_household_name,
      formSubmissionId: (data as any).form_submission_id,
      packetLocked: (data as any).packet_locked,
    };
  }

  throw new Error(`[anchor] Unknown anchorType: ${anchorType}`);
}
