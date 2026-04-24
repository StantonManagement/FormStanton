import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildStantonFilename, extractLastName } from '@/lib/stantonFilename';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, form_submission_id, head_of_household_name')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const { data: adults, error: adultsError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, signature_required, signed_forms')
      .eq('full_application_id', app.id)
      .eq('signature_required', true)
      .order('slot', { ascending: true });

    if (adultsError) throw adultsError;

    if (!adults || adults.length === 0) {
      return NextResponse.json({ success: true, data: { adults: [] } });
    }

    const { data: docs, error: docsError } = await supabaseAdmin
      .from('form_submission_documents')
      .select('id, doc_type, label, person_slot, status, display_order, signer_scope, requires_signature')
      .eq('form_submission_id', app.form_submission_id)
      .eq('requires_signature', true)
      .order('display_order', { ascending: true });

    if (docsError) throw docsError;

    const docsMap: Record<number, typeof docs> = {};
    const isAdultSlot = (slot: number): boolean => adults.some((a) => a.slot === slot);

    for (const doc of docs ?? []) {
      if (doc.signer_scope === 'hoh_only' && doc.person_slot === 0) {
        if (!docsMap[1]) docsMap[1] = [];
        docsMap[1].push(doc);
        continue;
      }
      if (doc.person_slot > 0 && isAdultSlot(doc.person_slot)) {
        if (!docsMap[doc.person_slot]) docsMap[doc.person_slot] = [];
        docsMap[doc.person_slot].push(doc);
      }
    }

    const result = adults.map((a) => ({
      id: a.id,
      slot: a.slot,
      name: a.name,
      signed_forms: (a.signed_forms as string[]) ?? [],
      documents: docsMap[a.slot] ?? [],
    }));

    return NextResponse.json({ success: true, data: { adults: result } });
  } catch (error: any) {
    console.error('PBV signatures GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, form_submission_id, head_of_household_name, building_address, unit_number')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || !body.member_id || !Array.isArray(body.signatures) || body.signatures.length === 0) {
      return NextResponse.json(
        { success: false, message: 'member_id and non-empty signatures array required' },
        { status: 400 }
      );
    }

    const { member_id, signatures } = body as {
      member_id: string;
      signatures: Array<{ document_id: string; data_url: string }>;
    };

    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, signature_required')
      .eq('id', member_id)
      .eq('full_application_id', app.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ success: false, message: 'Member not found' }, { status: 404 });
    }
    if (!member.signature_required) {
      return NextResponse.json(
        { success: false, message: 'Signature not required for this member' },
        { status: 400 }
      );
    }

    const today = new Date().toISOString().split('T')[0];
    const lastName = extractLastName(app.head_of_household_name ?? '');
    const assetId = app.building_address ?? 'UNK';
    const unit = app.unit_number ?? '0';
    const signedDocTypes: string[] = [];
    let firstSignaturePath: string | null = null;

    for (const sig of signatures) {
      const { document_id, data_url } = sig;
      if (!document_id || !data_url) continue;

      const { data: doc } = await supabaseAdmin
        .from('form_submission_documents')
        .select('id, doc_type, label, person_slot, signer_scope, revision, status, file_name')
        .eq('id', document_id)
        .eq('form_submission_id', app.form_submission_id)
        .single();

      if (!doc) continue;
      const matchesSigner =
        doc.person_slot === member.slot ||
        (doc.signer_scope === 'hoh_only' && member.slot === 1 && doc.person_slot === 0) ||
        (doc.signer_scope === 'individual' && member.slot === 1 && doc.person_slot === 0);

      if (!matchesSigner) continue;
      if (doc.status === 'approved' || doc.status === 'waived') continue;

      const base64 = data_url.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');

      const newRevision = (doc.revision ?? 0) + 1;
      const fileName = buildStantonFilename({
        assetId,
        unit,
        docLabel: doc.label,
        lastName,
        personSlot: member.slot,
        revision: newRevision,
        ext: 'png',
      });

      const storagePath = `form-submissions/${app.form_submission_id}/${doc.doc_type}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('form-submissions')
        .upload(storagePath, buffer, { contentType: 'image/png', upsert: false });

      if (uploadError) throw uploadError;

      await supabaseAdmin.from('form_submission_document_revisions').insert({
        document_id,
        revision: newRevision,
        file_name: fileName,
        storage_path: storagePath,
        uploaded_by: 'tenant',
        created_by: 'tenant',
      });

      await supabaseAdmin
        .from('form_submission_documents')
        .update({
          revision: newRevision,
          status: 'submitted',
          file_name: fileName,
          storage_path: storagePath,
          rejection_reason: null,
        })
        .eq('id', document_id);

      signedDocTypes.push(doc.doc_type);
      if (!firstSignaturePath) firstSignaturePath = storagePath;
    }

    if (signedDocTypes.length > 0) {
      const deduped = Array.from(new Set(signedDocTypes));
      const memberUpdate: Record<string, unknown> = {
        signed_forms: deduped,
        signature_date: today,
      };
      if (firstSignaturePath) memberUpdate.signature_image = firstSignaturePath;

      await supabaseAdmin.from('pbv_household_members').update(memberUpdate).eq('id', member_id);
    }

    await recomputeSubmission(app.form_submission_id);

    return NextResponse.json({ success: true, data: { signed: signedDocTypes.length } });
  } catch (error: any) {
    console.error('PBV signatures POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

async function recomputeSubmission(submissionId: string): Promise<void> {
  const { data: docs } = await supabaseAdmin
    .from('form_submission_documents')
    .select('status, required')
    .eq('form_submission_id', submissionId);

  if (!docs) return;

  const summary = { total: docs.length, missing: 0, submitted: 0, approved: 0, rejected: 0, waived: 0 };
  for (const d of docs) {
    const key = d.status as keyof typeof summary;
    if (key in summary) summary[key] = (summary[key] ?? 0) + 1;
  }

  const required = docs.filter((d) => d.required);
  let status = 'pending_review';
  if (required.every((d) => d.status === 'approved' || d.status === 'waived')) {
    status = 'approved';
  } else if (required.some((d) => d.status === 'rejected')) {
    status = 'revision_requested';
  } else if (required.some((d) => d.status === 'submitted')) {
    status = 'under_review';
  }

  await supabaseAdmin
    .from('form_submissions')
    .update({ document_review_summary: summary, status })
    .eq('id', submissionId)
    .eq('review_granularity', 'per_document');
}
