import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { resolveBucket } from '@/lib/storage/resolveBucket';

export const dynamic = 'force-dynamic';

const TTL = 300; // 5-minute signed URLs

/**
 * GET /api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/signed-url
 *
 * Returns a short-lived signed URL for a document, plus all prior revision signed URLs.
 * This endpoint was absent prior to PRD-35 — its absence was the root cause of the
 * "Stanton staff cannot view documents from the review surface" defect (a pre-existing
 * silent 404 that PRD-35 fixes).
 *
 * Response shape mirrors /api/hach/documents/[id]/signed-url for consistency.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string; documentId: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  try {
    const { anchor_type, anchor_id, documentId } = await params;

    const { data: doc, error: docErr } = await supabaseAdmin
      .from('application_documents')
      .select('id, label, status, storage_path, file_name, revision, doc_type, category')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    const { data: revisionRows } = await supabaseAdmin
      .from('application_document_revisions')
      .select('revision, file_name, storage_path, uploaded_by, uploaded_at')
      .eq('application_document_id', documentId)
      .order('revision', { ascending: true });

    const bucket = resolveBucket({ doc_type: doc.doc_type, category: doc.category });

    // Collect all paths that need signing
    const pathSet = new Set<string>();
    if (doc.storage_path) pathSet.add(doc.storage_path);
    for (const rev of revisionRows ?? []) {
      if (rev.storage_path) pathSet.add(rev.storage_path);
    }
    const allPaths = Array.from(pathSet);

    const signedMap: Record<string, string> = {};
    if (allPaths.length > 0) {
      const { data: signed } = await supabaseAdmin.storage
        .from(bucket)
        .createSignedUrls(allPaths, TTL);
      for (const entry of signed ?? []) {
        if (entry.path && entry.signedUrl) signedMap[entry.path] = entry.signedUrl;
      }
    }

    // Build revision list from application_document_revisions rows
    const revisionList = (revisionRows ?? []).map((rev) => ({
      revision: rev.revision,
      file_name: rev.file_name,
      uploaded_at: rev.uploaded_at,
      uploaded_by: rev.uploaded_by,
      signed_url: rev.storage_path ? (signedMap[rev.storage_path] ?? null) : null,
    }));

    // If no revision rows, synthesise v1 from the current document row
    if (revisionList.length === 0 && doc.storage_path) {
      revisionList.push({
        revision: doc.revision ?? 1,
        file_name: doc.file_name ?? null,
        uploaded_at: null,
        uploaded_by: null,
        signed_url: signedMap[doc.storage_path] ?? null,
      });
    }

    const latest = revisionList[revisionList.length - 1] ?? null;

    return NextResponse.json({
      success: true,
      data: {
        document_id: documentId,
        label: doc.label,
        file_name: latest?.file_name ?? doc.file_name ?? null,
        revision: latest?.revision ?? doc.revision ?? null,
        signed_url: latest?.signed_url ?? null,
        revisions: revisionList,
        expires_in: TTL,
      },
    });
  } catch (error: any) {
    console.error('[admin/documents/signed-url] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
