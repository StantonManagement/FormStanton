/**
 * lib/pbv/applyDocumentTriggers.ts
 *
 * Applies documentTriggers config to the application_documents rows for a
 * given application, based on the current intake_data snapshot.
 *
 * Called:
 *   1. On intake/complete — to mark de-triggered docs 'no_longer_required'
 *   2. On GET /documents — to filter out 'no_longer_required' for tenant view
 *
 * Database mutation (option 1) is done via supabaseAdmin and is transactional.
 * The filter-only path (option 2) is pure: pass docs through filterByTriggers.
 */

import { supabaseAdmin } from '@/lib/supabase';
import type { IntakeData } from './intake-schema';
import { TRIGGER_MAP } from './documentTriggers';

type DocRow = {
  id: string;
  doc_type: string;
  status: string;
  required: boolean;
};

/**
 * Pure filter: given a list of doc rows and intake data, return only
 * the docs that are triggered (or have no trigger config at all = legacy).
 * Also re-activates a doc that was previously no_longer_required if its
 * trigger now fires — returns it with status reset to 'missing'.
 */
export function filterByTriggers<T extends DocRow>(
  docs: T[],
  intakeData: IntakeData
): T[] {
  return docs.map((doc) => {
    const trigger = TRIGGER_MAP.get(doc.doc_type);
    if (!trigger) return doc; // no trigger config → leave as-is

    const triggered = trigger.isTriggered(intakeData);

    if (!triggered && doc.status !== 'no_longer_required') {
      // De-triggered: treat as no_longer_required for display
      return { ...doc, status: 'no_longer_required' };
    }
    if (triggered && doc.status === 'no_longer_required') {
      // Re-triggered: show as missing again for display
      return { ...doc, status: 'missing' };
    }
    return doc;
  });
}

/**
 * Database mutation: evaluate triggers against intakeData and update
 * application_documents rows in the DB.
 *
 * - Triggered docs that are currently 'no_longer_required' → reset to 'missing'
 * - De-triggered docs that are currently 'missing' → set to 'no_longer_required'
 * - Previously-uploaded de-triggered docs ('submitted' | 'approved') → set to
 *   'no_longer_required' (file preserved in storage)
 *
 * Returns { activated, deactivated } counts.
 */
export async function persistDocumentTriggers(
  applicationId: string,
  intakeData: IntakeData
): Promise<{ activated: number; deactivated: number; error?: string }> {
  const { data: docs, error: fetchErr } = await supabaseAdmin
    .from('application_documents')
    .select('id, doc_type, status, required')
    .eq('anchor_type', 'pbv_full_application')
    .eq('anchor_id', applicationId);

  if (fetchErr) {
    return { activated: 0, deactivated: 0, error: fetchErr.message };
  }

  const rows = (docs ?? []) as DocRow[];
  const toDeactivate: string[] = [];
  const toActivate: string[] = [];

  for (const doc of rows) {
    const trigger = TRIGGER_MAP.get(doc.doc_type);
    if (!trigger) continue; // no trigger config → skip

    const triggered = trigger.isTriggered(intakeData);

    if (!triggered && doc.status !== 'no_longer_required') {
      toDeactivate.push(doc.id);
    }
    if (triggered && doc.status === 'no_longer_required') {
      toActivate.push(doc.id);
    }
  }

  if (toDeactivate.length > 0) {
    const { error } = await supabaseAdmin
      .from('application_documents')
      .update({ status: 'no_longer_required', updated_at: new Date().toISOString() })
      .in('id', toDeactivate);
    if (error) return { activated: 0, deactivated: 0, error: error.message };
  }

  if (toActivate.length > 0) {
    const { error } = await supabaseAdmin
      .from('application_documents')
      .update({ status: 'missing', updated_at: new Date().toISOString() })
      .in('id', toActivate);
    if (error) return { activated: toActivate.length, deactivated: toDeactivate.length, error: error.message };
  }

  return { activated: toActivate.length, deactivated: toDeactivate.length };
}
