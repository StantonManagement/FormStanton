import { NextRequest, NextResponse } from 'next/server';
import { requireStantonStaff, getSessionUser, canApprovePreSendReview } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import {
  computePackageRevision,
  getLatestApproval,
  approvalReleasesPackage,
  type PackageDoc,
} from '@/lib/pbv/preSendReview';

const FORMS_BUCKET = 'pbv-forms';
const SIGNED_URL_TTL = 60 * 30; // 30 min

/**
 * GET /api/admin/pbv/applications/[id]/review
 *
 * PRD-87 — the pre-send review package for an application: applicant header, every
 * generated document (status + a signed viewer URL of the exact unsigned PDF the
 * applicant will sign), the current package_revision, and the current approval
 * state (approved at this revision / held / none). Read-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id: applicationId } = await params;

  const { data: app, error: appErr } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, head_of_household_name, household_size, preferred_language, submission_language, intake_status, stage')
    .eq('id', applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }

  const { data: docRows, error: docErr } = await supabaseAdmin
    .from('pbv_form_documents')
    .select('id, form_id, language, status, unsigned_pdf_path, unsigned_pdf_hash, generated_at')
    .eq('full_application_id', applicationId)
    .order('form_id', { ascending: true });

  if (docErr) {
    return NextResponse.json({ success: false, message: docErr.message }, { status: 500 });
  }

  const docs = docRows ?? [];

  // Signed viewer URLs for the exact stored unsigned bytes (what the approval binds to).
  const documents = await Promise.all(
    docs.map(async (d) => {
      let viewerUrl: string | null = null;
      if (d.unsigned_pdf_path) {
        const { data: signed } = await supabaseAdmin.storage
          .from(FORMS_BUCKET)
          .createSignedUrl(d.unsigned_pdf_path, SIGNED_URL_TTL);
        viewerUrl = signed?.signedUrl ?? null;
      }
      return {
        id: d.id,
        form_id: d.form_id,
        language: d.language,
        status: d.status,
        generated_at: d.generated_at,
        viewerUrl,
        // PRD-86 validator output slot — populated once Phase B persists validation.
        validation: null as null | { pass: boolean; flags: { field: string; page: number; reason: string }[] },
      };
    })
  );

  const packageRevision = computePackageRevision(docs as PackageDoc[]);
  const approval = await getLatestApproval(applicationId);
  const approved = approvalReleasesPackage(approval, packageRevision);

  return NextResponse.json({
    success: true,
    data: {
      application: {
        id: app.id,
        head_of_household_name: app.head_of_household_name,
        household_size: app.household_size,
        language: app.preferred_language ?? app.submission_language ?? 'en',
        intake_status: app.intake_status,
        stage: app.stage,
      },
      documents,
      packageRevision,
      approved,
      latestDecision: approval
        ? {
            status: approval.status,
            package_revision: approval.package_revision,
            approved_by_name: approval.approved_by_name,
            approved_at: approval.approved_at,
            note: approval.note,
            // A prior decision whose revision != current means the package changed.
            staleForCurrentPackage: approval.package_revision !== packageRevision,
          }
        : null,
      canApprove: canApprovePreSendReview(user),
    },
  });
}
