import { NextRequest, NextResponse } from 'next/server';
import { requireHachUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

const BUCKET = 'form-submissions';
const TTL = 300; // 5 minutes

/**
 * GET /api/hach/documents/[id]/signed-url?version=N
 * Returns a short-lived signed URL for the document (or a specific revision).
 * Scope-checks that the document belongs to a HACH-accessible application.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = await requireHachUser();
  if (guard) return guard;

  const documentId = params.id;
  const versionParam = request.nextUrl.searchParams.get('version');
  const requestedRevision = versionParam ? parseInt(versionParam, 10) : null;

  try {
    // Fetch the document
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, label, status, storage_path, file_name, revision, form_submission_id')
      .eq('id', documentId)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    // Scope-check: must belong to a HACH-accessible application
    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, hach_review_status')
      .eq('form_submission_id', doc.form_submission_id)
      .not('hach_review_status', 'is', null)
      .single();

    if (appErr || !app) {
      return NextResponse.json(
        { success: false, message: 'Document not in HACH review scope' },
        { status: 403 }
      );
    }

    // Fetch all revisions for this document
    const { data: revisions } = await supabaseAdmin
      .from('form_submission_document_revisions')
      .select('id, revision, storage_path, file_name, created_at, uploaded_by')
      .eq('document_id', documentId)
      .order('revision', { ascending: true });

    // Collect storage paths to sign
    const allPaths: string[] = [];
    if (doc.storage_path) allPaths.push(doc.storage_path);
    for (const rev of revisions ?? []) {
      if (rev.storage_path && !allPaths.includes(rev.storage_path)) {
        allPaths.push(rev.storage_path);
      }
    }

    // Batch sign
    const signedMap: Record<string, string> = {};
    if (allPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrls(allPaths, TTL);
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) signedMap[entry.path] = entry.signedUrl;
      }
    }

    // Build revision list
    const revisionList = (revisions ?? []).map((rev) => ({
      revision: rev.revision,
      file_name: rev.file_name,
      uploaded_at: rev.created_at,
      uploaded_by: rev.uploaded_by,
      signed_url: rev.storage_path ? (signedMap[rev.storage_path] ?? null) : null,
    }));

    // If no revisions table data, fall back to the document's own storage_path as v1
    if (revisionList.length === 0 && doc.storage_path) {
      revisionList.push({
        revision: doc.revision ?? 1,
        file_name: doc.file_name,
        uploaded_at: null,
        uploaded_by: null,
        signed_url: signedMap[doc.storage_path] ?? null,
      });
    }

    // Determine which revision to serve
    const targetRevision =
      requestedRevision != null
        ? revisionList.find((r) => r.revision === requestedRevision) ?? revisionList[revisionList.length - 1]
        : revisionList[revisionList.length - 1];

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        label: doc.label,
        file_name: targetRevision?.file_name ?? doc.file_name,
        revision: targetRevision?.revision ?? doc.revision,
        signed_url: targetRevision?.signed_url ?? null,
        revisions: revisionList,
        expires_in: TTL,
      },
    });
  } catch (error: any) {
    console.error('[hach/documents/signed-url] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
