import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser, requireStantonStaff } from '@/lib/auth';
import {
  writePbvApplicationEvent,
  ApplicationEventType,
} from '@/lib/events/application-events';
import { buildStantonFilename, extractLastName } from '@/lib/stantonFilename';

export const dynamic = 'force-dynamic';

interface StagedAssignment {
  target: 'doc_row' | 'custom' | 'discard';
  doc_row_id?: string;
  group_id?: string;
  custom_label?: string;
}

interface IntakePage {
  id: string;
  global_index: number;
  image_path: string;
  staged_assignment: StagedAssignment | null;
}

interface DocRow {
  id: string;
  doc_type: string;
  label: string;
  person_slot: number;
  revision: number;
  required: boolean;
  display_order: number;
}

interface AppRecord {
  id: string;
  head_of_household_name: string | null;
  building_address: string | null;
  unit_number: string | null;
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ anchor_type: string; anchor_id: string; batch_id: string }>;
  }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const actor = await getSessionUser();
  if (!actor) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { anchor_type, anchor_id, batch_id } = await params;

  if (anchor_type !== 'pbv_full_application') {
    return NextResponse.json(
      { success: false, message: `Unsupported anchor_type: ${anchor_type}` },
      { status: 400 }
    );
  }

  const { data: batch, error: batchErr } = await supabaseAdmin
    .from('intake_batches')
    .select('id, anchor_type, anchor_id, status, source_label')
    .eq('id', batch_id)
    .single();

  if (batchErr || !batch) {
    return NextResponse.json({ success: false, message: 'Batch not found' }, { status: 404 });
  }
  if (batch.anchor_type !== anchor_type || batch.anchor_id !== anchor_id) {
    return NextResponse.json(
      { success: false, message: 'Batch does not belong to this application' },
      { status: 403 }
    );
  }
  if (batch.status !== 'classifying') {
    return NextResponse.json(
      { success: false, message: `Batch status is ${batch.status}; expected classifying` },
      { status: 409 }
    );
  }

  const { data: app, error: appErr } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, building_address, unit_number, packet_locked')
    .eq('id', anchor_id)
    .single();

  if (appErr || !app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }
  if ((app as { packet_locked: boolean }).packet_locked) {
    return NextResponse.json(
      { success: false, message: 'Packet is locked. Reopen before committing intake.' },
      { status: 423 }
    );
  }

  const { data: pages, error: pagesErr } = await supabaseAdmin
    .from('intake_pages')
    .select('id, global_index, image_path, staged_assignment')
    .eq('batch_id', batch_id)
    .order('global_index');

  if (pagesErr || !pages) {
    return NextResponse.json({ success: false, message: 'Failed to fetch pages' }, { status: 500 });
  }

  const unassigned = (pages as IntakePage[]).filter((p) => !p.staged_assignment);
  if (unassigned.length > 0) {
    return NextResponse.json(
      {
        success: false,
        message: `${unassigned.length} page(s) are unassigned. Assign all pages before committing.`,
      },
      { status: 422 }
    );
  }

  await supabaseAdmin
    .from('intake_batches')
    .update({ status: 'committing' })
    .eq('id', batch_id);

  const { data: existingDocs, error: docsErr } = await supabaseAdmin
    .from('application_documents')
    .select('id, doc_type, label, person_slot, revision, required, display_order')
    .eq('anchor_type', anchor_type)
    .eq('anchor_id', anchor_id);

  if (docsErr) {
    await supabaseAdmin
      .from('intake_batches')
      .update({ status: 'classifying' })
      .eq('id', batch_id);
    return NextResponse.json({ success: false, message: 'Failed to fetch document rows' }, { status: 500 });
  }

  const docMap = new Map<string, DocRow>();
  for (const d of (existingDocs ?? []) as DocRow[]) {
    docMap.set(d.id, d);
  }

  const typedApp = app as unknown as AppRecord;

  const groupedPages = groupByGroupId(pages as IntakePage[]);

  const committedDocuments: Array<{
    applicationDocumentId: string;
    pageIds: string[];
    stagingPaths: string[];
    docType: string;
    label: string;
    personSlot: number;
    revision: number;
    isCustom: boolean;
  }> = [];

  let templateDocsCount = 0;
  let customDocsCount = 0;
  let discardedPagesCount = 0;

  const maxDisplayOrder = Math.max(
    0,
    ...(existingDocs ?? []).map((d) => (d as DocRow).display_order)
  );
  let nextDisplayOrder = maxDisplayOrder + 10;

  for (const group of groupedPages) {
    const firstPage = group[0];
    const assignment = firstPage.staged_assignment!;

    if (assignment.target === 'discard') {
      discardedPagesCount += group.length;
      continue;
    }

    if (assignment.target === 'doc_row') {
      const docRowId = assignment.doc_row_id;
      if (!docRowId) continue;
      const docRow = docMap.get(docRowId);
      if (!docRow) continue;

      const existingRevisions = (existingDocs ?? []).filter(
        (d) =>
          (d as DocRow).doc_type === docRow.doc_type &&
          (d as DocRow).person_slot === docRow.person_slot
      ) as DocRow[];
      const maxRevision = Math.max(0, ...existingRevisions.map((d) => d.revision));
      const newRevision = maxRevision + 1;

      const lastName = extractLastName(typedApp.head_of_household_name ?? '');
      const assetId = String(typedApp.building_address ?? 'UNK');
      const unit = String(typedApp.unit_number ?? '0');
      const fileName = buildStantonFilename({
        assetId,
        unit,
        docLabel: docRow.label,
        lastName,
        personSlot: docRow.person_slot,
        revision: newRevision,
        ext: 'jpg',
      });

      const { data: newDoc, error: insertErr } = await supabaseAdmin
        .from('application_documents')
        .insert({
          anchor_type,
          anchor_id,
          doc_type: docRow.doc_type,
          label: docRow.label,
          required: docRow.required,
          display_order: docRow.display_order,
          person_slot: docRow.person_slot,
          revision: newRevision,
          status: 'submitted',
          file_name: fileName,
          storage_path: `form-submissions/${anchor_id}/${docRow.doc_type}/${fileName}`,
          uploaded_by_role: 'staff',
          uploaded_by_user_id: actor.userId,
          uploaded_by_display_name: actor.displayName,
          upload_source: 'packet_intake',
          staff_upload_note: (batch.source_label as string | null) ?? null,
          created_by: actor.userId,
        })
        .select('id')
        .single();

      if (insertErr || !newDoc) {
        console.error('[intake/commit] Failed to insert document:', insertErr);
        await supabaseAdmin
          .from('intake_batches')
          .update({ status: 'classifying' })
          .eq('id', batch_id);
        return NextResponse.json(
          { success: false, message: `Failed to commit document: ${insertErr?.message}` },
          { status: 500 }
        );
      }

      committedDocuments.push({
        applicationDocumentId: (newDoc as { id: string }).id,
        pageIds: group.map((p) => p.id),
        stagingPaths: group.map((p) => p.image_path),
        docType: docRow.doc_type,
        label: docRow.label,
        personSlot: docRow.person_slot,
        revision: newRevision,
        isCustom: false,
      });
      templateDocsCount++;
    } else if (assignment.target === 'custom') {
      const customLabel = assignment.custom_label?.trim() || 'Custom Document';

      const { data: customDoc, error: customErr } = await supabaseAdmin
        .from('application_documents')
        .insert({
          anchor_type,
          anchor_id,
          doc_type: 'custom',
          label: customLabel,
          required: false,
          requires_signature: false,
          display_order: nextDisplayOrder,
          person_slot: 0,
          revision: 1,
          status: 'submitted',
          original_doc_type: null,
          file_name: `custom-${nextDisplayOrder}.jpg`,
          storage_path: `form-submissions/${anchor_id}/custom/custom-${nextDisplayOrder}.jpg`,
          uploaded_by_role: 'staff',
          uploaded_by_user_id: actor.userId,
          uploaded_by_display_name: actor.displayName,
          upload_source: 'packet_intake',
          staff_upload_note: customLabel,
          created_by: actor.userId,
        })
        .select('id')
        .single();

      if (customErr || !customDoc) {
        await supabaseAdmin
          .from('intake_batches')
          .update({ status: 'classifying' })
          .eq('id', batch_id);
        return NextResponse.json(
          { success: false, message: `Failed to commit custom document: ${customErr?.message}` },
          { status: 500 }
        );
      }

      committedDocuments.push({
        applicationDocumentId: (customDoc as { id: string }).id,
        pageIds: group.map((p) => p.id),
        stagingPaths: group.map((p) => p.image_path),
        docType: 'custom',
        label: customLabel,
        personSlot: 0,
        revision: 1,
        isCustom: true,
      });
      customDocsCount++;
      nextDisplayOrder += 10;
    }
  }

  for (const committed of committedDocuments) {
    await writePbvApplicationEvent({
      applicationId: anchor_id,
      eventType: ApplicationEventType.DOCUMENT_UPLOADED_BY_STAFF,
      actorUserId: actor.userId,
      actorDisplayName: actor.displayName,
      payload: {
        doc_type: committed.docType,
        label: committed.label,
        file_name: `packet_intake_batch_${batch_id}`,
        staff_upload_note: (batch.source_label as string | null) ?? null,
      },
    });
  }

  await writePbvApplicationEvent({
    applicationId: anchor_id,
    eventType: ApplicationEventType.PACKET_INTAKE_COMMITTED,
    actorUserId: actor.userId,
    actorDisplayName: actor.displayName,
    payload: {
      batch_id,
      total_pages: pages.length,
      template_docs: templateDocsCount,
      custom_docs: customDocsCount,
      discarded_pages: discardedPagesCount,
      source_label: (batch.source_label as string | null) ?? null,
    },
  });

  await supabaseAdmin
    .from('intake_batches')
    .update({
      status: 'committed',
      committed_at: new Date().toISOString(),
      committed_document_count: templateDocsCount + customDocsCount,
    })
    .eq('id', batch_id);

  const storageErrors: string[] = [];
  for (const committed of committedDocuments) {
    for (let i = 0; i < committed.stagingPaths.length; i++) {
      const stagingPath = committed.stagingPaths[i];
      const destPath = `form-submissions/${anchor_id}/${committed.docType}/${committed.applicationDocumentId}-${i + 1}.jpg`;

      const { error: moveErr } = await supabaseAdmin.storage
        .from('intake-staging')
        .move(stagingPath, destPath.replace('form-submissions/', ''));

      if (moveErr) {
        storageErrors.push(stagingPath);
        await supabaseAdmin
          .from('intake_pages')
          .update({ storage_move_failed: true })
          .in('id', committed.pageIds);
      } else {
        await supabaseAdmin
          .from('intake_pages')
          .update({ committed_document_id: committed.applicationDocumentId })
          .in('id', committed.pageIds);
      }
    }
  }

  if (storageErrors.length > 0) {
    console.error('[intake/commit] Storage move failures:', storageErrors);
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        committed_documents: templateDocsCount + customDocsCount,
        template_docs: templateDocsCount,
        custom_docs: customDocsCount,
        discarded_pages: discardedPagesCount,
        storage_errors: storageErrors.length,
      },
    },
    { status: 200 }
  );
}

function groupByGroupId(pages: IntakePage[]): IntakePage[][] {
  const groups = new Map<string, IntakePage[]>();
  const singletons: IntakePage[][] = [];

  for (const page of pages) {
    const assignment = page.staged_assignment;
    if (!assignment) continue;

    if (assignment.target === 'discard') {
      singletons.push([page]);
      continue;
    }

    const groupId = assignment.group_id;
    if (groupId) {
      if (!groups.has(groupId)) groups.set(groupId, []);
      groups.get(groupId)!.push(page);
    } else {
      singletons.push([page]);
    }
  }

  const result: IntakePage[][] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.global_index - b.global_index);
    result.push(group);
  }
  result.push(...singletons);
  result.sort((a, b) => a[0].global_index - b[0].global_index);

  return result;
}
