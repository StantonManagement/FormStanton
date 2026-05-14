/**
 * POST /api/admin/pbv/full-applications/[id]/signing/[signatureId]/upload
 * 
 * Uploads a signed PDF for a signature row.
 * Preserves prior versions in versioned blob paths.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { writePbvApplicationEvent } from '@/lib/events/application-events';
import { buildSignedPdfPath, getRevisionFromPath, listSignatureVersions } from '@/lib/signing/storage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; signatureId: string }> }
) {
  const authError = await requireAuth();
  if (authError) return authError;

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId, signatureId } = await params;

  try {
    // Fetch the signature row
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

    // Verify packet belongs to this application
    if ((signature as any).signing_packets?.application_id !== applicationId) {
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
    const existingVersions = await listSignatureVersions(applicationId, signatureId);
    const nextRevision = existingVersions.length > 0 
      ? Math.max(...existingVersions.map(v => v.revision)) + 1 
      : 1;

    // Build storage path
    const storagePath = buildSignedPdfPath(
      applicationId,
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
    const isHapContract = signature.signing_party === 'stanton_and_hach';
    const updateData: any = {
      signed_pdf_path: storagePath,
      signed_at: new Date().toISOString(),
      signed_pdf_uploaded_by: user.userId,
      signed_pdf_uploaded_by_role: 'stanton',
      signature_method: 'wet_upload',
      status: isHapContract ? 'signed' : 'signed', // HAP stays signed until executed
    };

    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update(updateData)
      .eq('id', signatureId);

    if (updateError) {
      // Try to clean up uploaded file
      await supabaseAdmin.storage.from('signing-packets').remove([storagePath]);
      throw new Error(`Failed to update signature: ${updateError.message}`);
    }

    // Write event
    await writePbvApplicationEvent({
      applicationId,
      eventType: 'signature_received',
      actorUserId: user.userId,
      actorDisplayName: user.displayName,
      payload: {
        document_slug: signature.document_slug,
        document_label: signature.document_label,
        signing_party: signature.signing_party,
        uploader_role: 'stanton',
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
    console.error('[signature upload POST] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
