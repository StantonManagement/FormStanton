import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';
import { safeHachJson } from '@/lib/hach/payload-filter';

/**
 * POST /api/hach/documents/[id]/approve
 * Inserts a document_review_actions row (action='approved').
 * Scope-checks that the document belongs to a pbv_full_applications row
 * that has hach_review_status set (i.e. is HACH-accessible).
 * Returns updated document status + packet progress summary.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: documentId } = await params;

  try {
    // 1. Fetch the document and scope-check it belongs to a HACH-accessible application
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('application_documents')
      .select('id, label, status, anchor_id')
      .eq('id', documentId)
      .eq('anchor_type', 'pbv_full_application')
      .single();

    if (docErr || !doc) {
      return NextResponse.json(
        { success: false, message: 'Document not found' },
        { status: 404 }
      );
    }

    // Verify the document's application is HACH-accessible
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, hach_review_status')
      .eq('id', doc.anchor_id)
      .not('hach_review_status', 'is', null)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { success: false, message: 'Application not in HACH review scope' },
        { status: 403 }
      );
    }

    const applicationId = app.id;

    // 2. Insert document_review_actions row
    const { error: insertErr } = await supabaseAdmin
      .from('document_review_actions')
      .insert({
        document_id: documentId,
        full_application_id: applicationId,
        reviewer_id: user.userId,
        reviewer_name: user.displayName,
        action: 'approved',
        rejection_reason: null,
        notes: null,
        created_by: user.username,
        source: 'hach',
      });

    if (insertErr) {
      console.error('[hach/approve] insert error:', insertErr);
      return NextResponse.json(
        { success: false, message: 'Failed to record approval' },
        { status: 500 }
      );
    }

    // 3a. Update document status to 'approved'
    await supabaseAdmin
      .from('application_documents')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer: user.displayName, updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // 3b. Update last_activity_at if the column exists — silently skip if not
    try {
      await supabaseAdmin
        .from('pbv_full_applications')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', applicationId);
    } catch {
      // Column may not exist — non-fatal
    }

    // 4. Recompute packet progress summary
    const { data: allDocs } = await supabaseAdmin
      .from('application_documents')
      .select('id, status')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId);

    const { data: allActions } = await supabaseAdmin
      .from('document_review_actions')
      .select('document_id, action, created_at')
      .eq('full_application_id', applicationId)
      .order('created_at', { ascending: false });

    // Collapse to latest action per doc
    const latestByDoc: Record<string, string> = {};
    for (const a of allActions ?? []) {
      if (!latestByDoc[a.document_id]) {
        latestByDoc[a.document_id] = a.action;
      }
    }

    const progress = { approved: 0, pending: 0, rejected: 0, waived: 0, missing: 0, total: 0 };
    for (const d of allDocs ?? []) {
      progress.total++;
      const effectiveAction = latestByDoc[d.id];
      if (effectiveAction === 'approved') progress.approved++;
      else if (effectiveAction === 'rejected') progress.rejected++;
      else if (effectiveAction === 'waived') progress.waived++;
      else if (d.status === 'missing') progress.missing++;
      else progress.pending++;
    }

    // 5. Audit log
    await logAudit(
      user,
      'hach.document.approve',
      'application_documents',
      documentId,
      { application_id: applicationId, document_label: doc.label },
      getClientIp(request)
    );

    return NextResponse.json({
      success: true,
      data: safeHachJson({
        document_id: documentId,
        effective_status: 'approved',
        reviewer_name: user.displayName,
        reviewed_at: new Date().toISOString(),
        progress,
      }),
    });
  } catch (error: any) {
    console.error('[hach/documents/approve] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
