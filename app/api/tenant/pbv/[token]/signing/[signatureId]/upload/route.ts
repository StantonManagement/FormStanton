/**
 * POST /api/tenant/pbv/[token]/signing/[signatureId]/upload
 *
 * Tenant uploads a signed PDF for their signature row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';
import { buildSignedPdfPath, listSignatureVersions } from '@/lib/signing/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string; signatureId: string }> }
) {
  const { token, signatureId } = await params;

  try {
    // Validate token and get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, tenant_access_token, hach_review_status')
      .eq('tenant_access_token', token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired access token' },
        { status: 401 }
      );
    }

    // Verify this is a tenant row
    const { data: signature, error: sigError } = await supabaseAdmin
      .from('packet_signatures')
      .select('*, signing_packets!inner(application_id, executed_at)')
      .eq('id', signatureId)
      .single();

    if (sigError || !signature) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // HACH wall: verify this is a tenant signature
    if (!signature.signing_party.includes('tenant')) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Verify packet belongs to this application
    if ((signature as any).signing_packets?.application_id !== application.id) {
      return NextResponse.json(
        { success: false, message: 'Signature does not belong to this application' },
        { status: 403 }
      );
    }

    // Check if packet is already executed
    if ((signature as any).signing_packets?.executed_at) {
      return NextResponse.json(
        { success: false, message: 'Packet is locked after HAP execution' },
        { status: 423 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, message: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, message: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Determine next revision number
    const existingVersions = await listSignatureVersions(application.id, signatureId);
    const nextRevision = existingVersions.length > 0
      ? Math.max(...existingVersions.map(v => v.revision)) + 1
      : 1;

    // Build storage path
    const storagePath = buildSignedPdfPath(
      application.id,
      signatureId,
      nextRevision,
      file.name
    );

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('signing-packets')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update signature row
    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update({
        signed_pdf_path: storagePath,
        signed_at: new Date().toISOString(),
        signed_pdf_uploaded_by: null, // Tenant upload - no user ID
        signed_pdf_uploaded_by_role: 'tenant',
        signature_method: 'wet_upload',
        status: 'signed',
      })
      .eq('id', signatureId);

    if (updateError) {
      // Try to clean up uploaded file
      await supabaseAdmin.storage.from('signing-packets').remove([storagePath]);
      throw new Error(`Failed to update signature: ${updateError.message}`);
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId: application.id,
      eventType: 'signature_received',
      actorUserId: null, // Tenant upload
      actorDisplayName: application.head_of_household_name,
      payload: {
        document_slug: signature.document_slug,
        document_label: signature.document_label,
        signing_party: signature.signing_party,
        uploader_role: 'tenant',
        signature_method: 'wet_upload',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Signed PDF uploaded successfully',
      data: {
        revision: nextRevision,
        path: storagePath,
      },
    });

  } catch (error: any) {
    console.error('[tenant upload POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
