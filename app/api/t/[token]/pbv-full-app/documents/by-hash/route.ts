/**
 * GET /api/t/[token]/pbv-full-app/documents/by-hash?hash=<sha256>&exclude_doc_id=<id>
 *
 * Finds documents with matching file_hash on the same application (dedup detection).
 * Returns compatible missing slots that could accept the same file.
 *
 * F1 of PRD-41.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'documents-by-hash', async (app) => {
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get('hash');
    const excludeDocId = searchParams.get('exclude_doc_id');

    if (!hash) {
      return {
        body: { success: false, message: 'Missing hash parameter' },
        status: 400,
      };
    }

    // Validate hash format (64 hex characters for SHA-256)
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return {
        body: { success: false, message: 'Invalid hash format. Expected 64 hex characters.' },
        status: 400,
      };
    }

    // Find documents with matching hash on the same application
    const { data: matches, error: matchesError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, category, person_slot, status, file_hash, storage_path, file_name')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .eq('file_hash', hash);

    if (matchesError) {
      console.error('[by-hash] Error fetching matches:', matchesError);
      return {
        body: { success: false, message: 'Failed to query documents' },
        status: 500,
      };
    }

    // Filter out the excluded doc if specified
    const filteredMatches = excludeDocId
      ? (matches ?? []).filter((d) => d.id !== excludeDocId)
      : (matches ?? []);

    // Get the source document (the one just uploaded) to determine category/person_slot
    let sourceCategory: string | null = null;
    let sourcePersonSlot: number | null = null;

    if (excludeDocId) {
      const { data: sourceDoc } = await supabaseAdmin
        .from('application_documents')
        .select('category, person_slot')
        .eq('id', excludeDocId)
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .maybeSingle();
      
      if (sourceDoc) {
        sourceCategory = sourceDoc.category;
        sourcePersonSlot = sourceDoc.person_slot;
      }
    }

    // Find compatible missing slots (same category, same person_slot, status='missing')
    let compatibleMissingSlots: Array<{
      id: string;
      doc_type: string;
      label: string;
      category: string | null;
      person_slot: number | null;
    }> = [];

    if (sourceCategory && sourcePersonSlot !== null) {
      const { data: missingSlots, error: missingError } = await supabaseAdmin
        .from('application_documents')
        .select('id, doc_type, label, category, person_slot')
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
        .eq('status', 'missing')
        .eq('category', sourceCategory)
        .eq('person_slot', sourcePersonSlot);

      if (!missingError && missingSlots) {
        // Exclude the source document itself if present
        compatibleMissingSlots = missingSlots.filter((d) => d.id !== excludeDocId);
      }
    }

    return {
      body: {
        success: true,
        data: {
          matches: filteredMatches.map((m) => ({
            id: m.id,
            doc_type: m.doc_type,
            label: m.label,
            category: m.category,
            person_slot: m.person_slot,
            status: m.status,
          })),
          compatible_missing_slots: compatibleMissingSlots,
        },
      },
      status: 200,
    };
  });
}
