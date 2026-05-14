/**
 * POST /api/signing/signatures/[id]/send
 * POST /api/signing/signatures/[id]/receive
 * POST /api/signing/signatures/[id]/waive
 * 
 * Per-signature actions for the signing packet workflow.
 * Each action updates the signature status and writes appropriate events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';

interface ActionBody {
  note?: string;
  waived_reason?: string;
  hap_initiation_direction?: 'stanton_first' | 'hach_first';
  signature_method?: 'wet_upload' | 'in_app';
}

async function handleSend(
  request: NextRequest,
  signatureId: string,
  user: any
) {
  const body: ActionBody = await request.json();
  const { note, hap_initiation_direction } = body;

  // Get current signature
  const { data: signature, error: sigError } = await supabaseAdmin
    .from('packet_signatures')
    .select(`
      *,
      signing_packets!inner(
        application_id,
        template_key
      )
    `)
    .eq('id', signatureId)
    .single();

  if (sigError || !signature) {
    return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
  }

  if (signature.status !== 'pending') {
    return NextResponse.json(
      { error: 'Signature must be in pending status to mark as sent' },
      { status: 400 }
    );
  }

  // Update signature
  const { error: updateError } = await supabaseAdmin
    .from('packet_signatures')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: user.id,
      notes: hap_initiation_direction 
        ? `HAP initiation direction: ${hap_initiation_direction}${note ? `. ${note}` : ''}`
        : note
    })
    .eq('id', signatureId);

  if (updateError) {
    console.error('Failed to update signature status:', updateError);
    return NextResponse.json({ error: 'Failed to mark signature as sent' }, { status: 500 });
  }

  // Write event
  await writePbvApplicationEvent({
    applicationId: signature.signing_packets.application_id,
    eventType: ApplicationEventType.SIGNATURE_MARKED_SENT,
    actorUserId: user.id,
    actorDisplayName: user.display_name || user.email,
    payload: {
      document_slug: signature.document_slug,
      document_label: signature.document_label,
      signing_party: signature.signing_party,
      note,
      hap_initiation_direction
    }
  });

  return NextResponse.json({ success: true });
}

async function handleReceive(
  request: NextRequest,
  signatureId: string,
  user: any
) {
  const body: ActionBody = await request.json();
  const { signature_method = 'wet_upload' } = body;

  // Get current signature
  const { data: signature, error: sigError } = await supabaseAdmin
    .from('packet_signatures')
    .select(`
      *,
      signing_packets!inner(
        application_id,
        template_key
      )
    `)
    .eq('id', signatureId)
    .single();

  if (sigError || !signature) {
    return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
  }

  if (signature.status !== 'sent') {
    return NextResponse.json(
      { error: 'Signature must be sent before it can be received' },
      { status: 400 }
    );
  }

  // Update signature
  const { error: updateError } = await supabaseAdmin
    .from('packet_signatures')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      signature_method,
      signed_pdf_uploaded_by: user.id,
      signed_pdf_uploaded_by_role: 'stanton' // TODO: Determine role based on user context
    })
    .eq('id', signatureId);

  if (updateError) {
    console.error('Failed to update signature status:', updateError);
    return NextResponse.json({ error: 'Failed to mark signature as received' }, { status: 500 });
  }

  // Write event
  await writePbvApplicationEvent({
    applicationId: signature.signing_packets.application_id,
    eventType: ApplicationEventType.SIGNATURE_RECEIVED,
    actorUserId: user.id,
    actorDisplayName: user.display_name || user.email,
    payload: {
      document_slug: signature.document_slug,
      document_label: signature.document_label,
      signing_party: signature.signing_party,
      uploader_role: 'stanton', // TODO: Determine role based on user context
      signature_method
    }
  });

  return NextResponse.json({ success: true });
}

async function handleWaive(
  request: NextRequest,
  signatureId: string,
  user: any
) {
  const body: ActionBody = await request.json();
  const { waived_reason } = body;

  if (!waived_reason) {
    return NextResponse.json(
      { error: 'waived_reason is required for waiver' },
      { status: 400 }
    );
  }

  // Get current signature
  const { data: signature, error: sigError } = await supabaseAdmin
    .from('packet_signatures')
    .select(`
      *,
      signing_packets!inner(
        application_id,
        template_key
      )
    `)
    .eq('id', signatureId)
    .single();

  if (sigError || !signature) {
    return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
  }

  if (signature.status !== 'pending') {
    return NextResponse.json(
      { error: 'Only pending signatures can be waived' },
      { status: 400 }
    );
  }

  // Update signature
  const { error: updateError } = await supabaseAdmin
    .from('packet_signatures')
    .update({
      status: 'waived',
      waived_reason
    })
    .eq('id', signatureId);

  if (updateError) {
    console.error('Failed to update signature status:', updateError);
    return NextResponse.json({ error: 'Failed to waive signature' }, { status: 500 });
  }

  // Write event
  await writePbvApplicationEvent({
    applicationId: signature.signing_packets.application_id,
    eventType: ApplicationEventType.SIGNATURE_WAIVED,
    actorUserId: user.id,
    actorDisplayName: user.display_name || user.email,
    payload: {
      document_slug: signature.document_slug,
      document_label: signature.document_label,
      signing_party: signature.signing_party,
      reason: waived_reason
    }
  });

  return NextResponse.json({ success: true });
}

// Main handler
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('pbv-full-applications', 'write');
    if (authResult) {
      return authResult;
    }

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: signatureId } = await params;
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json({ error: 'action parameter is required' }, { status: 400 });
    }

    switch (action) {
      case 'send':
        return handleSend(request, signatureId, user);
      case 'receive':
        return handleReceive(request, signatureId, user);
      case 'waive':
        return handleWaive(request, signatureId, user);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Error in POST /api/signing/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authentication and authorization
    const authResult = await requirePermission('pbv-full-applications', 'read');
    if (authResult) {
      return authResult;
    }

    const { id: signatureId } = await params;

    // Get signature with packet info
    const { data: signature, error } = await supabaseAdmin
      .from('packet_signatures')
      .select(`
        *,
        signing_packets!inner(
          application_id,
          template_key,
          created_at
        )
      `)
      .eq('id', signatureId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Signature not found' }, { status: 404 });
      }
      console.error('Failed to fetch signature:', error);
      return NextResponse.json({ error: 'Failed to fetch signature' }, { status: 500 });
    }

    return NextResponse.json(signature);

  } catch (error) {
    console.error('Error in GET /api/signing/signatures/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
