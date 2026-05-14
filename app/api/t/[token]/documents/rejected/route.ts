import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VALID_LANGUAGES = new Set(['en', 'es', 'pt']);

/**
 * GET /api/t/[token]/documents/rejected
 *
 * Returns all rejected documents for a tenant's submission,
 * including the rejection reason in the tenant's preferred language.
 *
 * Query params:
 *   - language: 'en' | 'es' | 'pt' (default: 'en')
 *
 * Response:
 * {
 *   success: true;
 *   data: {
 *     documents: Array<{
 *       id: string;
 *       doc_type: string;
 *       label: string;
 *       person_slot: number;
 *       current_revision: number;
 *       rejection_code: string;
 *       rejection_message: string;  // Rendered in tenant's language
 *       rejected_at: string;
 *       rejected_by: string;
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

    // Resolve token → PBV application
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, preferred_language')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    // Use tenant's preferred language if available, otherwise fall back to query param
    const lang = (VALID_LANGUAGES.has(app.preferred_language ?? '')
      ? app.preferred_language
      : language) as 'en' | 'es' | 'pt';

    // Fetch rejected documents for this application
    const { data: docs, error: docsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, person_slot, revision, status')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .eq('status', 'rejected');

    if (docsError) {
      console.error('[documents/rejected] query error:', docsError);
      return NextResponse.json({ success: false, message: 'Failed to load documents' }, { status: 500 });
    }

    if (!docs || docs.length === 0) {
      return NextResponse.json({ success: true, data: { documents: [] } });
    }

    // Get the latest rejection actions for each document
    const documentIds = docs.map((d) => d.id);
    const { data: rejectionActions, error: actionsError } = await supabaseAdmin
      .from('document_review_actions')
      .select('document_id, reason_code, rejection_reason, created_at, reviewer_name')
      .in('document_id', documentIds)
      .eq('action', 'rejected')
      .order('created_at', { ascending: false });

    if (actionsError) {
      console.error('[documents/rejected] actions query error:', actionsError);
    }

    // Get rejection templates for rendering
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('rejection_reason_templates')
      .select('code, template_en, template_es, template_pt');

    if (templatesError) {
      console.error('[documents/rejected] templates query error:', templatesError);
    }

    const templatesMap = new Map(templates?.map((t) => [t.code, t]) ?? []);

    // Build latest action map (most recent per document)
    type ActionRow = { document_id: string; reason_code: string | null; rejection_reason: string | null; created_at: string; reviewer_name: string | null };
    const latestActionMap = new Map<string, ActionRow>();
    for (const action of rejectionActions ?? []) {
      if (!latestActionMap.has(action.document_id)) {
        latestActionMap.set(action.document_id, action);
      }
    }

    // Interpolate template helper
    const interpolate = (template: string, vars: Record<string, string>): string => {
      return template
        .replace(/\{tenant\}/g, vars.tenant)
        .replace(/\{doc\}/g, vars.doc)
        .replace(/\{doc_short\}/g, vars.doc_short)
        .replace(/\{custom\}/g, vars.custom)
        .replace(/\{[^}]+\}/g, '');
    };

    // Build response
    const rejectedDocs = docs.map((doc) => {
      const action = latestActionMap.get(doc.id);
      const reasonCode = action?.reason_code ?? 'other';
      const template = templatesMap.get(reasonCode);

      // Get template for the tenant's language
      const templateField = `template_${lang}` as 'template_en' | 'template_es' | 'template_pt';
      const rawTemplate = (template?.[templateField] ?? template?.template_en) ??
        'Your document {doc} needs to be re-uploaded.';

      // Simple interpolation - we don't have tenant name here, use generic
      const rejectionMessage = interpolate(rawTemplate, {
        tenant: 'there', // Generic greeting since we don't have tenant name in this context
        doc: doc.label,
        doc_short: doc.label.split(' ')[0].toLowerCase(),
        custom: action?.rejection_reason ?? '',
      });

      return {
        id: doc.id,
        doc_type: doc.doc_type,
        label: doc.label,
        person_slot: doc.person_slot,
        current_revision: doc.revision,
        rejection_code: reasonCode,
        rejection_message: rejectionMessage,
        rejected_at: action?.created_at ?? null,
        rejected_by: action?.reviewer_name ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        documents: rejectedDocs,
      },
    });
  } catch (error: any) {
    console.error('[documents/rejected] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal error' },
      { status: 500 }
    );
  }
}
