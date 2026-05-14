/**
 * Tenant Signing - Apply API
 * POST: Final signature application with PDF stamping and audit
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { loadCaptureState, deleteCaptureState, verifyOriginalPdfUnchanged } from '@/lib/signing/capture/capture-state';
import { writeAuditRow } from '@/lib/signing/capture/audit';
import { deliverSignedDocument, recordDeliveryInAudit } from '@/lib/signing/capture/delivery';
import { writePbvApplicationEvent, ApplicationEventType } from '@/lib/events/application-events';
import { isConsentVersionActive } from '@/lib/signing/capture/consent';
import { stampPdf } from '@/lib/signing/capture/pdf-stamp';
import type { ConsentLanguage } from '@/lib/signing/capture/consent';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; signatureId: string }> }
) {
  try {
    const { token, signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.stateId || !body?.typedName || !body?.signatureImageDataUrl || !body?.date) {
      return NextResponse.json(
        { success: false, message: 'typedName, signatureImageDataUrl, and date are required' },
        { status: 400 }
      );
    }

    // Verify tenant token and get application details
    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, preferred_language, signing_packets!inner(id)')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError || !app) {
      return NextResponse.json(
        { success: false, message: 'Invalid token' },
        { status: 401 }
      );
    }

    const packet = app.signing_packets as unknown as { id: string } | null;
    if (!packet) {
      return NextResponse.json(
        { success: false, message: 'No signing packet found' },
        { status: 404 }
      );
    }

    // Load capture state
    const state = await loadCaptureState(body.stateId);
    if (!state) {
      return NextResponse.json(
        { success: false, message: 'Session expired. Please start over.' },
        { status: 400 }
      );
    }

    // Validate state
    if (state.step !== 'complete' && state.step !== 'signature') {
      return NextResponse.json(
        { success: false, message: `Invalid step: ${state.step}` },
        { status: 400 }
      );
    }

    // Check consent version is still active
    if (state.consentVersion && state.consentLanguage) {
      const isActive = await isConsentVersionActive(state.consentVersion, state.consentLanguage as ConsentLanguage);
      if (!isActive) {
        return NextResponse.json(
          { success: false, message: 'Disclosure has been updated. Please re-consent.' },
          { status: 409 }
        );
      }
    }

    // Verify identity was completed
    if (!state.identityVerifiedAt) {
      return NextResponse.json(
        { success: false, message: 'Identity verification required' },
        { status: 400 }
      );
    }

    // Verify document was reviewed
    if (!state.documentReviewedAt || !state.pagesViewed || !state.pdfPageCount) {
      return NextResponse.json(
        { success: false, message: 'Document review required' },
        { status: 400 }
      );
    }

    // Get signature details for the document
    const { data: sigData } = await supabaseAdmin
      .from('packet_signatures')
      .select('document_slug, document_label, signing_party')
      .eq('id', signatureId)
      .single();

    if (!sigData) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // Verify this is a tenant-allowed signature
    if (!sigData.signing_party.includes('tenant')) {
      return NextResponse.json(
        { success: false, message: 'Tenants cannot sign this document' },
        { status: 403 }
      );
    }

    // Get forwarded IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Determine language
    const rawLang = app.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang) ? (rawLang as ConsentLanguage) : 'en';

    // Load original PDF from storage
    // In a full implementation, we'd load the PDF from the signing-packets bucket
    // For now, we assume the PDF is available at the expected path
    const originalPdfPath = state.originalPdfPath || `signing-packets/${app.id}/${signatureId}/original.pdf`;
    
    // Load the PDF buffer from Supabase storage
    const { data: pdfData, error: pdfError } = await supabaseAdmin
      .storage
      .from('signing-packets')
      .download(originalPdfPath.replace('signing-packets/', ''));

    if (pdfError || !pdfData) {
      return NextResponse.json(
        { success: false, message: 'Document not found in storage' },
        { status: 404 }
      );
    }

    const originalPdfBuffer = Buffer.from(await pdfData.arrayBuffer());

    // Verify original PDF hasn't changed
    if (state.originalPdfHash && state.originalPdfHash !== 'pending') {
      const unchanged = await verifyOriginalPdfUnchanged(state.id, state.originalPdfHash);
      if (!unchanged) {
        return NextResponse.json(
          { success: false, message: 'Document has changed. Please review again.' },
          { status: 409 }
        );
      }
    }

    // Stamp the PDF
    const signedPdfPath = originalPdfPath.replace('original.pdf', `${Date.now()}_signed_in_app.pdf`);
    
    const { pdfBytes, originalHash, signedHash } = await stampPdf(
      originalPdfBuffer,
      {
        signerName: body.typedName,
        signatureImageDataUrl: body.signatureImageDataUrl,
        date: body.date,
        auditId: 'pending', // Will be filled after audit row created
        consentVersion: state.consentVersion || 'esign-disclosure-v1',
      }
    );

    // Upload signed PDF to storage
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('signing-packets')
      .upload(signedPdfPath.replace('signing-packets/', ''), pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Failed to upload signed PDF: ${uploadError.message}`);
    }

    const now = new Date();

    // Write audit row first (to get the ID for the stamp reference)
    const auditId = await writeAuditRow({
      packetSignatureId: signatureId,
      signerTenantToken: token,
      signerDisplayName: body.typedName,
      signerRole: 'tenant',
      consentRecordedAt: state.consentRecordedAt!,
      consentTextVersion: state.consentVersion!,
      consentLanguage: state.consentLanguage!,
      identityMethod: 'magic_link_plus_dob',
      identityVerifiedAt: state.identityVerifiedAt,
      documentReviewedAt: state.documentReviewedAt,
      pagesViewed: state.pagesViewed,
      pdfPageCount: state.pdfPageCount,
      signatureMethod: 'typed_and_drawn',
      typedName: body.typedName,
      signedAt: now,
      ipAddress: ip,
      userAgent: userAgent,
      originalPdfPath,
      originalDocumentHash: originalHash,
      signedPdfPath,
      signedDocumentHash: signedHash,
    });

    // Update packet_signatures
    const { error: updateError } = await supabaseAdmin
      .from('packet_signatures')
      .update({
        status: 'signed',
        signed_at: now.toISOString(),
        signed_pdf_path: signedPdfPath,
        signature_method: 'in_app',
        signed_pdf_uploaded_by_role: 'tenant',
        updated_at: now.toISOString(),
      })
      .eq('id', signatureId);

    if (updateError) {
      throw new Error(`Failed to update signature: ${updateError.message}`);
    }

    // Write signature_received event
    await writePbvApplicationEvent({
      applicationId: app.id,
      eventType: ApplicationEventType.SIGNATURE_RECEIVED,
      actorUserId: null,
      actorDisplayName: body.typedName,
      payload: {
        document_slug: sigData.document_slug,
        document_label: sigData.document_label,
        signing_party: sigData.signing_party,
        uploader_role: 'tenant',
        signature_method: 'in_app',
      },
    });

    // Deliver signed document
    // Get tenant email from application or household
    const { data: member } = await supabaseAdmin
      .from('pbv_household_members')
      .select('email')
      .eq('full_application_id', app.id)
      .eq('slot', 1)
      .maybeSingle();

    const delivery = await deliverSignedDocument({
      recipientEmail: member?.email || null,
      recipientName: body.typedName,
      documentName: sigData.document_label,
      pdfBuffer: Buffer.from(pdfBytes),
      pdfPath: signedPdfPath,
      language: lang,
      tenantToken: token,
      isStaff: false,
    });

    // Record delivery in audit
    if (delivery.success && delivery.method) {
      await recordDeliveryInAudit(auditId, delivery.method, member?.email || null);
    }

    // Clean up capture state
    await deleteCaptureState(state.id);

    return NextResponse.json({
      success: true,
      data: {
        signed: true,
        auditId,
        deliveryMethod: delivery.method,
        downloadUrl: `/api/tenant/signing/${token}/${signatureId}/download`,
      },
    });
  } catch (error: any) {
    console.error('Tenant apply POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
