import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * GET /api/admin/pbv-rejection-templates?doc_type=paystubs
 *
 * Returns PBV rejection reason templates filtered by doc_type.
 * Returns both doc-specific templates and generic templates (doc_type = NULL).
 *
 * Query params:
 *   - doc_type: optional, filters templates for specific document type
 *               if omitted or 'all', returns all templates
 */
export async function GET(request: NextRequest) {
  const auth = await isAuthenticated();
  if (!auth) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const docType = searchParams.get('doc_type');

    let query = supabaseAdmin
      .from('pbv_rejection_reason_templates')
      .select('key, doc_type, reason_en, reason_es, reason_pt')
      .order('key', { ascending: true });

    // If doc_type specified, get that doc_type + generic templates
    if (docType && docType !== 'all') {
      query = query.or(`doc_type.eq.${docType},doc_type.is.null`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[admin/pbv-rejection-templates] query error:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to load templates' },
        { status: 500 }
      );
    }

    // Group templates by category for UI organization
    const generic = (data ?? []).filter((t) => t.doc_type === null);
    const specific = (data ?? []).filter((t) => t.doc_type !== null);

    return NextResponse.json({
      success: true,
      data: data ?? [],
      grouped: {
        generic,
        doc_specific: specific,
      },
    });
  } catch (err: any) {
    console.error('[admin/pbv-rejection-templates] error:', err);
    return NextResponse.json(
      { success: false, message: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}
