/**
 * GET /api/t/[token]/pbv-full-app/action-items
 *
 * Returns consolidated action items for tenant portal:
 * - Pending signatures
 * - Rejected documents
 * - Missing documents
 * - Approved documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Validate token and get application
    const { data: application, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, head_of_household_name, head_of_household_id')
      .eq('tenant_access_token', token)
      .single();

    if (appError || !application) {
      return NextResponse.json(
        { success: false, message: 'Invalid or expired access token' },
        { status: 401 }
      );
    }

    const applicationId = application.id;

    // Get household members with signature_required flag
    const { data: householdMembers, error: membersError } = await supabaseAdmin
      .from('pbv_household_members')
      .select('id, slot, name, relationship, signature_required, signed_forms')
      .eq('full_application_id', applicationId)
      .eq('signature_required', true);

    // Get signature-required documents
    const { data: signatureDocs, error: sigsError } = await supabaseAdmin
      .from('application_documents')
      .select('id, doc_type, label, person_slot, signer_scope, status, requires_signature')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', applicationId)
      .eq('requires_signature', true);

    // Get rejected documents
    const { data: rejectedDocs, error: rejectedError } = await supabaseAdmin
      .from('application_documents')
      .select('id, label, rejection_reason, doc_type, status')
      .eq('anchor_id', applicationId)
      .eq('anchor_type', 'pbv_full_application')
      .eq('status', 'rejected');

    // Get missing documents (required but not yet uploaded)
    const { data: missingDocs, error: missingError } = await supabaseAdmin
      .from('application_documents')
      .select('id, label, doc_type, required, status')
      .eq('anchor_id', applicationId)
      .eq('anchor_type', 'pbv_full_application')
      .eq('status', 'missing')
      .eq('required', true);

    // Get approved documents
    const { data: approvedDocs, error: approvedError } = await supabaseAdmin
      .from('application_documents')
      .select('id, label, doc_type, status, person_name')
      .eq('anchor_id', applicationId)
      .eq('anchor_type', 'pbv_full_application')
      .eq('status', 'approved')
      .order('updated_at', { ascending: false });

    if (sigsError) console.error('[action-items] signatures error:', sigsError);
    if (membersError) console.error('[action-items] members error:', membersError);
    if (rejectedError) console.error('[action-items] rejected error:', rejectedError);
    if (missingError) console.error('[action-items] missing error:', missingError);
    if (approvedError) console.error('[action-items] approved error:', approvedError);

    // Calculate signature progress per member
    const isSignedStatus = (status: string): boolean =>
      status === 'submitted' || status === 'approved' || status === 'waived';

    const docsForMember = (slot: number) =>
      (signatureDocs ?? []).filter((doc) => {
        if (doc.signer_scope === 'all_adults') {
          return doc.person_slot === slot;
        }
        if (doc.signer_scope === 'hoh_only') {
          return slot === 1 && doc.person_slot === 0;
        }
        if (doc.signer_scope === 'individual') {
          return doc.person_slot === slot || (slot === 1 && doc.person_slot === 0);
        }
        return doc.person_slot === slot;
      });

    const signatureProgress: Array<{
      member_id: string;
      slot: number;
      name: string;
      required_doc_count: number;
      signed_doc_count: number;
    }> = [];

    for (const member of householdMembers || []) {
      const requiredDocs = docsForMember(member.slot);
      const signedCount = requiredDocs.filter((d) => isSignedStatus(d.status)).length;

      signatureProgress.push({
        member_id: member.id,
        slot: member.slot,
        name: member.name,
        required_doc_count: requiredDocs.length,
        signed_doc_count: signedCount,
      });
    }

    // Calculate pending signatures (docs that need to be signed)
    const totalPendingSigs = signatureProgress.reduce(
      (acc, m) => acc + (m.required_doc_count - m.signed_doc_count),
      0
    );

    // Format signatures by household member with pending docs
    const signaturesByMember = (householdMembers || []).map(member => {
      const memberDocs = docsForMember(member.slot);
      const pendingDocs = memberDocs.filter((d) => !isSignedStatus(d.status));

      return {
        member_id: member.id,
        name: member.name,
        relationship: member.relationship,
        pending_signatures: pendingDocs.map((doc) => ({
          signature_id: doc.id,
          document_name: doc.label,
        })),
      };
    }).filter(m => m.pending_signatures.length > 0);

    return NextResponse.json({
      success: true,
      data: {
        signatures: signaturesByMember,
        rejected_documents: (rejectedDocs || []).map(doc => ({
          document_id: doc.id,
          label: doc.label,
          rejection_reason: doc.rejection_reason,
          doc_type: doc.doc_type,
        })),
        missing_documents: (missingDocs || []).map(doc => ({
          document_id: doc.id,
          label: doc.label,
          doc_type: doc.doc_type,
          required: doc.required,
        })),
        approved_documents: (approvedDocs || []).map(doc => ({
          document_id: doc.id,
          label: doc.label,
          doc_type: doc.doc_type,
          person_name: doc.person_name,
        })),
        signatureProgress,
        counts: {
          pending_signatures: totalPendingSigs,
          rejected_documents: rejectedDocs?.length || 0,
          missing_documents: missingDocs?.length || 0,
          approved_documents: approvedDocs?.length || 0,
        },
      },
    });

  } catch (error: any) {
    console.error('[action-items GET] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
