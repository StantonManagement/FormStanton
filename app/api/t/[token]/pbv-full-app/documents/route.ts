import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveBucket } from '@/lib/storage/resolveBucket';
import { filterByTriggers } from '@/lib/pbv/applyDocumentTriggers';
import type { IntakeData } from '@/lib/pbv/intake-schema';

export const dynamic = 'force-dynamic';

const VALID_LANGUAGES = new Set(['en', 'es', 'pt']);

/**
 * GET /api/t/[token]/pbv-full-app/documents
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

    // Resolve token → application (include intake_snapshot for F4 trigger filtering)
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, packet_locked, form_submission_id, intake_snapshot')
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
      .select('id, doc_type, label, required, person_slot, status, rejection_reason, rejection_reason_key, revision, created_at, updated_at, category, display_order, storage_path')
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

    // Fetch rejection templates for rejected documents with keys
    const rejectionKeys = documents
      ?.filter(d => d.status === 'rejected' && d.rejection_reason_key)
      .map(d => d.rejection_reason_key) ?? [];

    let rejectionTemplates: Record<string, { reason_en: string; reason_es: string; reason_pt: string }> = {};

    if (rejectionKeys.length > 0) {
      const { data: templateRows } = await supabaseAdmin
        .from('pbv_rejection_reason_templates')
        .select('key, reason_en, reason_es, reason_pt')
        .in('key', rejectionKeys);

      rejectionTemplates = Object.fromEntries(
        (templateRows ?? []).map(t => [t.key, { reason_en: t.reason_en, reason_es: t.reason_es, reason_pt: t.reason_pt }])
      );
    }

    // Generate signed URLs for uploaded docs (submitted | approved | rejected)
    const signedUrls: Record<string, string> = {};
    const uploadedDocs = (documents ?? []).filter(
      (d) => (d.status === 'submitted' || d.status === 'approved' || d.status === 'rejected') && d.storage_path
    );
    await Promise.all(
      uploadedDocs.map(async (d) => {
        const bucket = resolveBucket({ doc_type: d.doc_type, category: d.category });
        const { data: signed } = await supabaseAdmin.storage
          .from(bucket)
          .createSignedUrl(d.storage_path!, 300);
        if (signed?.signedUrl) signedUrls[d.id] = signed.signedUrl;
      })
    );

    // F4: Apply intake-based trigger filter so tenant only sees relevant docs.
    // Uses intake_snapshot (immutable post-submit) when available, else skip filter.
    const intakeSnapshot = app.intake_snapshot as IntakeData | null;
    const rawDocs = intakeSnapshot
      ? filterByTriggers(documents ?? [], intakeSnapshot)
      : (documents ?? []);

    // Map to response shape
    const mappedDocs = rawDocs.map(doc => {
      // Build rejection reason display (template → free-text → generic fallback)
      let rejectionReasonDisplay: string | null = null;
      if (doc.status === 'rejected') {
        const template = doc.rejection_reason_key ? rejectionTemplates[doc.rejection_reason_key] : null;
        if (template) {
          rejectionReasonDisplay = language === 'en'
            ? template.reason_en
            : language === 'es'
            ? template.reason_es
            : template.reason_pt;
        } else if (doc.rejection_reason?.trim()) {
          rejectionReasonDisplay = doc.rejection_reason.trim();
        } else {
          rejectionReasonDisplay = language === 'en'
            ? 'Please contact the office for details on why this document was rejected.'
            : language === 'es'
            ? 'Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.'
            : 'Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.';
        }
      }

      return {
        id: doc.id,
        doc_type: doc.doc_type,
        label: translations[doc.doc_type] ?? doc.label, // Use translation if available, fallback to original
        required: doc.required,
        person_slot: doc.person_slot,
        status: doc.status as 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived' | 'no_longer_required',
        rejection_reason: doc.rejection_reason ?? null,
        rejection_reason_key: doc.rejection_reason_key ?? null,
        rejection_reason_display: rejectionReasonDisplay,
        current_revision: doc.revision,
        uploaded_at: doc.status === 'missing' ? null : (doc.updated_at ?? doc.created_at),
        category: doc.category ?? 'custom',
        display_order: doc.display_order ?? 0,
        file_url: signedUrls[doc.id] ?? null,
      };
    });

    // F4: Exclude no_longer_required docs from tenant view entirely
    // PRP-023: also exclude signed_forms category — these are handled by
    // the dedicated /sign/forms flow (pbv_form_documents + FormsStack), not
    // by the upload UI. Showing them as upload cards confused tenants into
    // thinking they had to scan a federal form they were about to sign.
    const visibleDocs = mappedDocs.filter(
      (d) => d.status !== 'no_longer_required' && d.category !== 'signed_forms'
    );

    return NextResponse.json({
      success: true,
      data: {
        application_id: app.id,
        packet_locked: app.packet_locked ?? false,
        documents: visibleDocs,
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
