import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildStantonFilename, extractLastName } from '@/lib/stantonFilename';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name')
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
      .from('application_documents')
      .select('id, doc_type, label, person_slot, status, display_order, signer_scope, requires_signature, storage_path')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
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
  const { token } = await params;
  return withTenantContext(
    request,
    token,
    'signatures',
    async (app) => {
      try {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      request.headers.get('x-real-ip') ??
      'unknown';

    const body = await request.json().catch(() => null);
    if (!body || !body.member_id || !Array.isArray(body.signatures) || body.signatures.length === 0) {
      return { body: { success: false, message: 'member_id and non-empty signatures array required' }, status: 400 };
    }

    const { member_id, signatures, consent_confirmed, consent_confirmed_at, user_agent } = body as {
      member_id: string;
      signatures: Array<{ document_id: string; data_url: string }>;
      consent_confirmed?: boolean;
      consent_confirmed_at?: string;
      user_agent?: string;
    };

    const { data: member, error: memberError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, signature_required')
      .eq('id', member_id)
      .eq('full_application_id', app.id)
      .single();

    if (memberError || !member) {
      return { body: { success: false, message: 'Member not found' }, status: 404 };
    }
    if (!member.signature_required) {
      return { body: { success: false, message: 'Signature not required for this member' }, status: 400 };
    }

    const today = new Date().toISOString().split('T')[0];
    const lastName = extractLastName((app.head_of_household_name as string | null) ?? '');
    const assetId = (app.building_address as string | null) ?? 'UNK';
    const unit = (app.unit_number as string | null) ?? '0';
    const signedDocTypes: string[] = [];
    let firstSignaturePath: string | null = null;

    for (const sig of signatures) {
      const { document_id, data_url } = sig;
      if (!document_id || !data_url) continue;

      const { data: doc } = await supabaseAdmin
        .from('application_documents')
        .select('id, doc_type, label, person_slot, signer_scope, revision, status, file_name')
        .eq('id', document_id)
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', app.id)
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

      const storagePath = `pbv-applications/${app.id}/${doc.doc_type}/${fileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('pbv-applications')
        .upload(storagePath, buffer, { contentType: 'image/png', upsert: false });

      if (uploadError) throw uploadError;

      await supabaseAdmin
        .from('application_documents')
        .update({
          revision: newRevision,
          status: 'submitted',
          file_name: fileName,
          storage_path: storagePath,
          rejection_reason: null,
          upload_source: 'tenant',
          uploaded_by_role: 'tenant',
          updated_at: new Date().toISOString(),
        })
        .eq('id', document_id);

      signedDocTypes.push(doc.doc_type);
      if (!firstSignaturePath) firstSignaturePath = storagePath;

      // PRD-18: Write e-sign audit row (awaited - legally required)
      const { error: auditError } = await supabaseAdmin.from('pbv_signature_audit_log').insert({
        application_id: app.id,
        document_id: document_id,
        member_id: member_id,
        signer_name: member.name,
        slot: member.slot,
        signed_at: new Date().toISOString(),
        consent_confirmed: consent_confirmed ?? false,
        consent_confirmed_at: consent_confirmed_at ?? null,
        ip_address: ipAddress,
        user_agent: user_agent ?? null,
        storage_path: storagePath,
      });

      if (auditError) {
        console.error('[pbv-signatures] Audit log write failed:', auditError.message);
        // Continue processing but alert admin via logging
      }
    }

    if (signedDocTypes.length > 0) {
      // Fetch existing signed_forms to accumulate across sessions rather than overwrite.
      const { data: freshMember } = await supabaseAdmin
        .from('pbv_household_members')
        .select('signed_forms')
        .eq('id', member_id)
        .single();

      const existing: string[] = Array.isArray(freshMember?.signed_forms) ? (freshMember.signed_forms as string[]) : [];
      const merged = Array.from(new Set([...existing, ...signedDocTypes]));

      const memberUpdate: Record<string, unknown> = {
        signed_forms: merged,
        signature_date: today,
      };
      if (firstSignaturePath) memberUpdate.signature_image = firstSignaturePath;

      await supabaseAdmin.from('pbv_household_members').update(memberUpdate).eq('id', member_id);
    }

    return { body: { success: true, data: { signed: signedDocTypes.length } }, status: 200 };
      } catch (error: any) {
        console.error('PBV signatures POST error:', error);
        return { body: { success: false, message: error.message }, status: 500 };
      }
    },
    'id, head_of_household_name, building_address, unit_number, submitted_at'
  );
}

