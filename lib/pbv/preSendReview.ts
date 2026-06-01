/**
 * lib/pbv/preSendReview.ts
 *
 * PRD-87 — pre-send document review: package_revision + approval gate.
 *
 * The intake→signing handoff (`pbv_preflight_checklist`) must NOT be sent until an
 * operator has reviewed the rendered package and approved it. Approval is bound to
 * a `package_revision` — a content hash over the exact bytes reviewed:
 *   hash( sorted list of "form_id:unsigned_pdf_hash" )
 * Regenerating documents changes `unsigned_pdf_hash` → the revision changes → a
 * prior approval no longer matches → the send is blocked until a fresh approval.
 *
 * Pure helpers (computePackageRevision, approvalReleasesPackage) are unit-tested;
 * the DB-touching wrappers compose them.
 */

import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';

export interface PackageDoc {
  form_id: string;
  /** null until the doc has been generated. */
  unsigned_pdf_hash: string | null;
}

export interface ReviewApproval {
  id: string;
  application_id: string;
  package_revision: string;
  status: 'approved' | 'held';
  approved_by: string | null;
  approved_by_name: string | null;
  approved_at: string;
  note: string | null;
}

/**
 * Content hash over the rendered bytes the operator reviews. Order-independent
 * (forms are sorted) so the revision depends only on the set of (form, bytes).
 * Returns '' when the package has no generated documents yet.
 */
export function computePackageRevision(docs: PackageDoc[]): string {
  const parts = docs
    .filter((d) => d.unsigned_pdf_hash)
    .map((d) => `${d.form_id}:${d.unsigned_pdf_hash}`)
    .sort();
  if (parts.length === 0) return '';
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

/**
 * Does this approval release the given current package revision?
 * True only for an `approved` decision whose bound revision equals the current
 * one (and the revision is non-empty — an empty package can't be approved).
 */
export function approvalReleasesPackage(
  approval: ReviewApproval | null,
  currentRevision: string
): boolean {
  if (!approval) return false;
  if (approval.status !== 'approved') return false;
  if (!currentRevision) return false;
  return approval.package_revision === currentRevision;
}

// ── DB wrappers ────────────────────────────────────────────────────────────────

/** All generated docs for an application (form_id + current unsigned hash). */
export async function getPackageDocs(applicationId: string): Promise<PackageDoc[]> {
  const { data, error } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('form_id, unsigned_pdf_hash')
    .eq('full_application_id', applicationId);
  if (error) {
    console.error('[preSendReview] getPackageDocs error:', error);
    return [];
  }
  return (data ?? []) as PackageDoc[];
}

export async function getCurrentPackageRevision(applicationId: string): Promise<string> {
  return computePackageRevision(await getPackageDocs(applicationId));
}

/** The latest review decision for an application, or null. */
export async function getLatestApproval(applicationId: string): Promise<ReviewApproval | null> {
  const { data, error } = await supabaseAdmin
    .from('pbv_document_review_approvals')
    .select('id, application_id, package_revision, status, approved_by, approved_by_name, approved_at, note')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[preSendReview] getLatestApproval error:', error);
    return null;
  }
  return (data as ReviewApproval | null) ?? null;
}

/**
 * The gate consumed by every preflight send site: is the CURRENT package approved?
 * Fails closed (returns false) on any error so a handoff is never released without
 * a verified, matching approval.
 */
export async function isHandoffApproved(applicationId: string): Promise<boolean> {
  const [revision, approval] = await Promise.all([
    getCurrentPackageRevision(applicationId),
    getLatestApproval(applicationId),
  ]);
  return approvalReleasesPackage(approval, revision);
}

export interface RecordDecisionParams {
  applicationId: string;
  status: 'approved' | 'held';
  approvedBy: string | null;
  approvedByName: string | null;
  note?: string | null;
}

/** Record an approve/hold decision bound to the current package revision. */
export async function recordReviewDecision(
  params: RecordDecisionParams
): Promise<{ approval: ReviewApproval | null; packageRevision: string }> {
  const packageRevision = await getCurrentPackageRevision(params.applicationId);
  const { data, error } = await supabaseAdmin
    .from('pbv_document_review_approvals')
    .insert({
      application_id: params.applicationId,
      package_revision: packageRevision,
      status: params.status,
      approved_by: params.approvedBy,
      approved_by_name: params.approvedByName,
      note: params.note ?? null,
    })
    .select('id, application_id, package_revision, status, approved_by, approved_by_name, approved_at, note')
    .single();
  if (error) {
    console.error('[preSendReview] recordReviewDecision error:', error);
    return { approval: null, packageRevision };
  }
  return { approval: data as ReviewApproval, packageRevision };
}
