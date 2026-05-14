import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
import { splitFileToPages } from '@/lib/scan/splitPdf';
import { classifyPage, warmSignatureCache } from '@/lib/intake/classifier';
import { runOcr } from '@/lib/intake/ocr';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB per file

interface HouseholdMember {
  first_name?: string;
  last_name?: string;
  person_slot?: number;
}

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

  const { anchor_type, anchor_id } = await params;

  if (anchor_type !== 'pbv_full_application') {
    return NextResponse.json(
      { success: false, message: `Unsupported anchor_type: ${anchor_type}` },
      { status: 400 }
    );
  }

  const { data: app, error: appErr } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, packet_locked, form_data')
    .eq('id', anchor_id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }
  if (app.packet_locked) {
    return NextResponse.json(
      { success: false, message: 'Packet is locked. Reopen before intake.' },
      { status: 423 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid multipart form data' }, { status: 400 });
  }

  const files = formData.getAll('files') as File[];
  const sourceLabel = (formData.get('source_label') as string | null)?.trim() || null;

  if (!files.length) {
    return NextResponse.json({ success: false, message: 'No files provided' }, { status: 400 });
  }

  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, message: `Unsupported file type: ${file.type}` },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: `File ${file.name} exceeds 100 MB limit` },
        { status: 400 }
      );
    }
  }

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('intake_batches')
    .insert({
      anchor_type,
      anchor_id,
      status: 'uploading',
      source_label: sourceLabel,
      created_by_user_id: actor.userId,
      created_by: actor.displayName,
    })
    .select('id')
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ success: false, message: 'Failed to create batch' }, { status: 500 });
  }

  const batchId = batch.id as string;

  const householdMembers: HouseholdMember[] = (() => {
    const fd = app.form_data as Record<string, unknown> | null;
    if (!fd) return [];
    const members = fd.household_members;
    if (!Array.isArray(members)) return [];
    return members as HouseholdMember[];
  })();

  const maxPagesSyncRaw = parseInt(process.env.INTAKE_OCR_MAX_PAGES_SYNC ?? '30', 10);
  const maxPagesSync = isNaN(maxPagesSyncRaw) ? 30 : maxPagesSyncRaw;

  let globalIndex = 1;
  const pageInserts: {
    batch_id: string;
    source_file_name: string;
    page_index: number;
    global_index: number;
    image_path: string;
    created_by: string;
  }[] = [];
  const pageBuffers: { globalIndex: number; buffer: Buffer; fileName: string; pageIndex: number }[] = [];

  for (const file of files) {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    let mimeType = file.type;
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      mimeType = 'image/jpeg';
    }

    const pages = await splitFileToPages(fileBuffer, mimeType);

    for (const page of pages) {
      const imagePath = `${batchId}/${globalIndex}.jpg`;

      const { error: storageErr } = await supabaseAdmin.storage
        .from('intake-staging')
        .upload(imagePath, page.buffer, { contentType: 'image/jpeg', upsert: false });

      if (storageErr) {
        await supabaseAdmin
          .from('intake_batches')
          .update({ status: 'abandoned' })
          .eq('id', batchId);
        return NextResponse.json(
          { success: false, message: `Storage upload failed: ${storageErr.message}` },
          { status: 500 }
        );
      }

      pageInserts.push({
        batch_id: batchId,
        source_file_name: file.name,
        page_index: page.pageIndex + 1,
        global_index: globalIndex,
        image_path: imagePath,
        created_by: actor.displayName,
      });
      pageBuffers.push({ globalIndex, buffer: page.buffer, fileName: file.name, pageIndex: page.pageIndex });

      globalIndex++;
    }
  }

  const { data: insertedPages, error: insertErr } = await supabaseAdmin
    .from('intake_pages')
    .insert(pageInserts)
    .select('id, global_index');

  if (insertErr || !insertedPages) {
    await supabaseAdmin.from('intake_batches').update({ status: 'abandoned' }).eq('id', batchId);
    return NextResponse.json({ success: false, message: 'Failed to insert pages' }, { status: 500 });
  }

  const totalPages = pageInserts.length;
  const runOcrSync = totalPages <= maxPagesSync;

  await supabaseAdmin
    .from('intake_batches')
    .update({ total_pages: totalPages, status: 'classifying' })
    .eq('id', batchId);

  if (runOcrSync) {
    await warmSignatureCache('pbv-full-application');
    const pageIdMap = new Map<number, string>();
    for (const p of insertedPages) {
      pageIdMap.set(p.global_index as number, p.id as string);
    }

    for (const pb of pageBuffers) {
      const pageId = pageIdMap.get(pb.globalIndex);
      if (!pageId) continue;

      const base64Image = pb.buffer.toString('base64');
      const ocrResult = await runOcr(base64Image);
      const classification = classifyPage(ocrResult.text, householdMembers, 'pbv-full-application');

      await supabaseAdmin
        .from('intake_pages')
        .update({
          extracted_text: ocrResult.text || null,
          ocr_confidence: ocrResult.confidence,
          suggested_doc_type: classification.suggested_doc_type,
          suggested_person_slot: classification.suggested_person_slot,
          suggested_score: classification.suggested_score,
        })
        .eq('id', pageId);
    }
  }

  await writePbvApplicationEvent({
    applicationId: anchor_id,
    eventType: ApplicationEventType.PACKET_INTAKE_STARTED,
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    payload: {
      batch_id: batchId,
      source_label: sourceLabel,
      file_count: files.length,
    },
  });

  return NextResponse.json(
    { success: true, data: { batch_id: batchId, total_pages: totalPages, ocr_run: runOcrSync } },
    { status: 201 }
  );
}
