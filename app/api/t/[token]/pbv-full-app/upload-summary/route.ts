/**
 * GET /api/t/[token]/pbv-full-app/upload-summary
 *
 * Thin wrapper around application_documents for the dashboard upload card.
 * Returns { total, complete, optional_total, optional_complete } counts for this application,
 * grouped by category.
 *
 * PRD-58 Phase 5: Applies trigger filtering against intake_snapshot so counts
 * match the documents page (filterByTriggers over required docs only).
 *
 * "required" = documents where required = true, after trigger filtering
 * "complete"  = status IN ('submitted', 'approved', 'waived')
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { filterByTriggers } from '@/lib/pbv/applyDocumentTriggers';
import type { IntakeData } from '@/lib/pbv/intake-schema';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, intake_snapshot')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });

    // Fetch all documents (both required and optional)
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, category, status, required')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .neq('status', 'no_longer_required');

    if (docsError) throw docsError;

    const all = docs ?? [];
    const completeStatuses = new Set(['submitted', 'approved', 'waived']);

    // PRD-58 Phase 5: Apply intake-based trigger filter so dashboard counts
    // match the documents page (same filter logic as documents/route.ts)
    const intakeSnapshot = (app.intake_snapshot ?? null) as IntakeData | null;
    const triggeredDocs = intakeSnapshot
      ? filterByTriggers(all, intakeSnapshot)
      : all;

    // Required documents (after trigger filtering)
    const requiredDocs = triggeredDocs.filter((d) => d.required === true);
    const total = requiredDocs.length;
    const complete = requiredDocs.filter((d) => completeStatuses.has(d.status)).length;

    // Optional documents (also after trigger filtering for coherence)
    const optionalDocs = triggeredDocs.filter((d) => d.required === false);
    const optional_total = optionalDocs.length;
    const optional_complete = optionalDocs.filter((d) => completeStatuses.has(d.status)).length;

    // Group by category (required only, as before)
    const byCategory: Record<string, { total: number; complete: number }> = {};
    for (const doc of requiredDocs) {
      const cat = doc.category ?? 'other';
      if (!byCategory[cat]) byCategory[cat] = { total: 0, complete: 0 };
      byCategory[cat].total++;
      if (completeStatuses.has(doc.status)) byCategory[cat].complete++;
    }

    return NextResponse.json({
      success: true,
      data: { total, complete, optional_total, optional_complete, by_category: byCategory },
    });
  } catch (error: any) {
    console.error('[upload-summary] GET error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
