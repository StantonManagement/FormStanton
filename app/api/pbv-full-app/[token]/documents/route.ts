import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const VALID_LANGUAGES = new Set(['en', 'es', 'pt']);

/**
 * GET /api/pbv-full-app/[token]/documents
 *
 * Returns the document list for a PBV full application tenant portal.
 * Reads from application_documents (not form_submission_documents).
 *
 * Query params:
 *   - language: 'en' | 'es' | 'pt' (default: 'en')
 *
 * Response shape per PRD-03 §Phase 2:
 * {
 *   success: true;
 *   data: {
 *     application_id: string;
 *     packet_locked: boolean;
 *     documents: Array<{
 *       id: string;
 *       doc_type: string;
 *       label: string;
 *       required: boolean;
 *       person_slot: number;
 *       status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived';
 *       rejection_reason: string | null;
 *       current_revision: number;
 *       uploaded_at: string | null;
 *     }>;
 *   };
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Parse language param (default: 'en')
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language') ?? 'en';

    if (!VALID_LANGUAGES.has(language)) {
      return NextResponse.json(
        { success: false, message: `Invalid language. Must be one of: ${Array.from(VALID_LANGUAGES).join(', ')}` },
        { status: 400 }
      );
    }

    // Resolve token → application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, form_submission_id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) {
      console.error('[pbv-full-app/documents] Error resolving token:', appError);
      return NextResponse.json(
        { success: false, message: 'Failed to resolve token' },
        { status: 500 }
      );
    }

    if (!app) {
      return NextResponse.json(
        { success: false, message: 'Not found' },
        { status: 404 }
      );
    }

    // Check if token is expired (applications with intake_submitted_at and no form_submission_id are "expired")
    // This is a guard against tokens that should no longer be used
    const { data: appStatus } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_submitted_at, form_submission_id')
      .eq('id', app.id)
      .single();

    if (appStatus?.intake_submitted_at && !appStatus?.form_submission_id) {
      // Token is expired — intake done but no document portal available
      return NextResponse.json(
        { success: false, message: 'Token expired' },
        { status: 403 }
      );
    }

    // Read documents from application_documents (PRD-03 anchor pattern)
    const { data: documents, error: docsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, required, person_slot, status, rejection_reason, revision, created_at, updated_at')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .order('display_order', { ascending: true })
      .order('person_slot', { ascending: true });

    if (docsError) {
      console.error('[pbv-full-app/documents] Error fetching documents:', docsError);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Fetch translated labels for the requested language
    const docTypes = documents?.map(d => d.doc_type) ?? [];
    let translations: Record<string, string> = {};

    if (docTypes.length > 0) {
      const { data: translationRows } = await supabaseAdmin
        .from('pbv_document_label_translations')
        .select('doc_type, label')
        .in('doc_type', docTypes)
        .eq('language', language);

      translations = Object.fromEntries(
        (translationRows ?? []).map(t => [t.doc_type, t.label])
      );
    }

    // Map to response shape
    const mappedDocs = (documents ?? []).map(doc => ({
      id: doc.id,
      doc_type: doc.doc_type,
      label: translations[doc.doc_type] ?? doc.label, // Use translation if available, fallback to original
      required: doc.required,
      person_slot: doc.person_slot,
      status: doc.status as 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived',
      rejection_reason: doc.rejection_reason ?? null,
      current_revision: doc.revision,
      uploaded_at: doc.status === 'missing' ? null : (doc.updated_at ?? doc.created_at),
    }));

    return NextResponse.json({
      success: true,
      data: {
        application_id: app.id,
        packet_locked: app.packet_locked ?? false,
        documents: mappedDocs,
      },
    });

  } catch (error: any) {
    console.error('[pbv-full-app/documents] Unexpected error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
