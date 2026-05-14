import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
import { buildStantonFilename, getExtension, extractLastName } from '@/lib/stantonFilename';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ anchor_type: string; anchor_id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { anchor_type, anchor_id } = await params;

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, building_address, unit_number, packet_locked')
      .eq('id', anchor_id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    if (app.packet_locked) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked. Reopen the packet before making changes.' },
        { status: 423 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentId = formData.get('document_id') as string | null;
    const staffUploadNote = formData.get('staff_upload_note') as string | null;

    if (!file) {
      return NextResponse.json({ success: false, message: 'Missing file field' }, { status: 400 });
    }
    if (!documentId) {
      return NextResponse.json({ success: false, message: 'Missing document_id field' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Accepted: JPEG, PNG, WebP, PDF.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum 20 MB.' },
        { status: 400 }
      );
    }

    const { data: doc, error: docErr } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, person_slot, revision, status')
      .eq('id', documentId)
      .eq('anchor_type', anchor_type)
      .eq('anchor_id', anchor_id)
      .single();

    if (docErr || !doc) {
      return NextResponse.json({ success: false, message: 'Document not found' }, { status: 404 });
    }

    if (doc.status === 'approved' || doc.status === 'waived') {
      return NextResponse.json(
        { success: false, message: `Document is ${doc.status} and cannot be replaced.` },
        { status: 409 }
      );
    }

    const newRevision = doc.revision + 1;
    const ext = getExtension(file.name);
    const lastName = extractLastName(app.head_of_household_name ?? '');
    const assetId = String(app.building_address ?? 'UNK');
    const unit = String(app.unit_number ?? '0');

    const fileName = buildStantonFilename({
      assetId,
      unit,
      docLabel: doc.label,
      lastName,
      personSlot: doc.person_slot,
      revision: newRevision,
      ext,
    });

    // Storage path mirrors the form-submissions bucket path structure.
    // Keyed by anchor_id (application id) rather than submission id.
    const storagePath = `form-submissions/${anchor_id}/${doc.doc_type}/${fileName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from('form-submissions')
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { error: updateError } = await supabaseAdmin
      .from('application_documents')
      .update({
        revision: newRevision,
        status: 'submitted',
        file_name: fileName,
        storage_path: storagePath,
        rejection_reason: null,
        reviewed_at: null,
        reviewer: null,
        uploaded_by_role: 'staff',
        uploaded_by_user_id: actor.userId,
        uploaded_by_display_name: actor.displayName,
        upload_source: 'packet_intake',
        staff_upload_note: staffUploadNote?.trim() || null,
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    // Insert revision row (append-only)
    const { error: revError } = await supabaseAdmin
      .from('application_document_revisions')
      .insert({
        application_document_id: documentId,
        revision: newRevision,
        file_name: fileName,
        storage_path: storagePath,
        uploaded_by: `staff:${actor.displayName}`,
        uploaded_at: new Date().toISOString(),
        status_at_review: null,
        rejection_reason: null,
        reviewer: null,
        reviewed_at: null,
        created_by: actor.userId,
      });

    if (revError) {
      console.error('[application-doc-upload] revision insert error:', revError);
      // Non-fatal: document is already updated, continue
    }

    await writePbvApplicationEvent({
      applicationId: anchor_id,
      eventType: ApplicationEventType.DOCUMENT_UPLOADED_BY_STAFF,
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      documentId,
      payload: {
        doc_type: doc.doc_type,
        label: doc.label,
        file_name: fileName,
        staff_upload_note: staffUploadNote?.trim() || null,
      },
    });

    return NextResponse.json(
      { success: true, data: { revision: newRevision, file_name: fileName } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('[application-doc-upload] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
