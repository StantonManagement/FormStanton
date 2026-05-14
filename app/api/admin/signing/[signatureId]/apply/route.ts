/**
 * Admin/Staff Signing - Apply API
 * POST: Final signature application
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, getRealSessionUser } from '@/lib/auth';
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
  context: { params: Promise<{ signatureId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const realUser = await getRealSessionUser();
    if (!realUser) {
      return NextResponse.json({ success: false, message: 'Session error' }, { status: 401 });
    }

    const { signatureId } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body?.stateId || !body?.typedName || !body?.signatureImageDataUrl || !body?.date) {
      return NextResponse.json(
        { success: false, message: 'typedName, signatureImageDataUrl, and date are required' },
        { status: 400 }
      );
    }

    // Get signature and application details
    const { data: sig, error: sigError } = await supabaseAdmin
      .from('packet_signatures')
      .select('id, document_slug, document_label, signing_party, packet_id, signing_packets!inner(application_id)')
      .eq('id', signatureId)
      .single();

    if (sigError || !sig) {
      return NextResponse.json(
        { success: false, message: 'Signature not found' },
        { status: 404 }
      );
    }

    // Verify this is a stanton-allowed signature
    if (!sig.signing_party.includes('stanton')) {
      return NextResponse.json(
        { success: false, message: 'Stanton staff cannot sign this document' },
        { status: 403 }
      );
    }

    const packet = sig.signing_packets as unknown as { application_id: string };

    // Get application details
    const { data: app } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, preferred_language')
      .eq('id', packet.application_id)
      .maybeSingle();

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

    // Verify document was reviewed
    if (!state.documentReviewedAt || !state.pagesViewed || !state.pdfPageCount) {
      return NextResponse.json(
        { success: false, message: 'Document review required' },
        { status: 400 }
      );
    }

    // Get IP
    const forwardedFor = request.headers.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Determine language
    const rawLang = app?.preferred_language ?? 'en';
    const lang: ConsentLanguage = ['en', 'es', 'ht'].includes(rawLang) ? (rawLang as ConsentLanguage) : 'en';

    // Load original PDF from storage
    const originalPdfPath = state.originalPdfPath || `signing-packets/${app?.id}/${signatureId}/original.pdf`;
    
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
        auditId: 'pending',
        consentVersion: state.consentVersion || 'esign-disclosure-v1',
      }
    );

    // Upload signed PDF
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

    // Write audit row
    const auditId = await writeAuditRow({
      packetSignatureId: signatureId,
      signerUserId: realUser.userId,
      signerDisplayName: body.typedName,
      signerRole: 'stanton',
      consentRecordedAt: state.consentRecordedAt!,
      consentTextVersion: state.consentVersion!,
      consentLanguage: state.consentLanguage!,
      identityMethod: 'admin_session',
      identityVerifiedAt: state.identityVerifiedAt || now, // Staff identity verified at consent step
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
    await supabaseAdmin
      .from('packet_signatures')
      .update({
        status: 'signed',
        signed_at: now.toISOString(),
        signed_pdf_path: signedPdfPath,
        signed_pdf_uploaded_by: realUser.userId,
        signature_method: 'in_app',
        signed_pdf_uploaded_by_role: 'stanton',
        updated_at: now.toISOString(),
      })
      .eq('id', signatureId);

    // Write event
    await writePbvApplicationEvent({
      applicationId: app?.id || packet.application_id,
      eventType: ApplicationEventType.SIGNATURE_RECEIVED,
      actorUserId: realUser.userId,
      actorDisplayName: realUser.displayName,
      payload: {
        document_slug: sig.document_slug,
        document_label: sig.document_label,
        signing_party: sig.signing_party,
        uploader_role: 'stanton',
        signature_method: 'in_app',
      },
    });

    // Deliver to staff email
    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('email')
      .eq('id', realUser.userId)
      .maybeSingle();

    const delivery = await deliverSignedDocument({
      recipientEmail: adminUser?.email || null,
      recipientName: body.typedName,
      documentName: sig.document_label,
      pdfBuffer: Buffer.from(pdfBytes),
      pdfPath: signedPdfPath,
      language: lang,
      tenantToken: null,
      isStaff: true,
    });

    if (delivery.success && delivery.method) {
      await recordDeliveryInAudit(auditId, delivery.method, adminUser?.email || null);
    }

    // Clean up capture state
    await deleteCaptureState(state.id);

    return NextResponse.json({
      success: true,
      data: {
        signed: true,
        auditId,
        deliveryMethod: delivery.method,
      },
    });
  } catch (error: any) {
    console.error('Admin apply POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
