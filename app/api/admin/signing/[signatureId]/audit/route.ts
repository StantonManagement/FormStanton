/**
 * Admin Signing - Audit View API
 * GET: Returns audit record for a signature (requires view_signature_audit permission)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { loadAuditForSignature } from '@/lib/signing/capture/audit';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ signatureId: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Check permission
    if (!userHasPermission(user, 'pbv-full-applications', 'view_signature_audit')) {
      return NextResponse.json(
        { success: false, message: 'Permission denied' },
        { status: 403 }
      );
    }

    const { signatureId } = await context.params;

    // Load audit record
    const audit = await loadAuditForSignature(signatureId);

    if (!audit) {
      return NextResponse.json(
        { success: false, message: 'No audit record found for this signature' },
        { status: 404 }
      );
    }

    // Get signature details for context
    const { data: sig } = await supabaseAdmin
      .from('packet_signatures')
      .select('document_label, signing_party, status')
      .eq('id', signatureId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        audit: {
          id: audit.id,
          signerDisplayName: audit.signer_display_name,
          signerRole: audit.signer_role,
          identityMethod: audit.identity_method,
          consentVersion: audit.consent_text_version,
          consentLanguage: audit.consent_language,
          consentRecordedAt: audit.consent_recorded_at,
          identityVerifiedAt: audit.identity_verified_at,
          documentReviewedAt: audit.document_reviewed_at,
          pagesViewed: audit.pages_viewed,
          pdfPageCount: audit.pdf_page_count,
          signatureMethod: audit.signature_method,
          typedName: audit.typed_name,
          signedAt: audit.signed_at,
          ipAddress: audit.ip_address,
          originalDocumentHash: audit.original_document_hash,
          signedDocumentHash: audit.signed_document_hash,
          deliveredToSignerAt: audit.delivered_to_signer_at,
          deliveryMethod: audit.delivery_method,
          createdAt: audit.created_at,
        },
        signature: sig || null,
      },
    });
  } catch (error: any) {
    console.error('Admin audit GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
