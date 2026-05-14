import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser, userHasPermission } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const permission_held = userHasPermission(sessionUser, 'pbv-full-applications', 'send_to_hach');

  try {
    const { id } = await params;

    const { data: app, error: appErr } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(
        'id, form_submission_id, stanton_review_status, hha_application_file, head_of_household_name, unit_number, building_address, total_annual_income, stanton_reviewer, stanton_review_date, packet_locked, hach_packet_revision'
      )
      .eq('id', id)
      .single();

    if (appErr || !app) {
      return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
    }

    const { data: documents } = await supabaseAdmin
      .from('application_documents')
      .select('id, required, status, doc_type, label, owner_review_status')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', id);

    const docs = documents ?? [];
    const requiredDocs = docs.filter((d: any) => d.required);
    const docsNotCleared = requiredDocs.filter(
      (d: any) => d.status !== 'approved' && d.status !== 'waived'
    );

    const docCounts = docs.reduce(
      (acc: Record<string, number>, d: any) => {
        acc[d.status] = (acc[d.status] ?? 0) + 1;
        return acc;
      },
      {}
    );

    // ── Tier-2 Lead Review Check ───────────────────────────────────────────────
    // If lead_user_id IS NOT NULL, every tier-1-reviewed doc (status IN approved/rejected/waived)
    // must have owner_review_status='confirmed'
    const { data: appWithLead } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('lead_user_id')
      .eq('id', id)
      .single();

    const hasApplicationLead = !!(appWithLead as any)?.lead_user_id;
    
    const tier1ReviewedDocs = docs.filter((d: any) =>
      ['approved', 'rejected', 'waived'].includes(d.status)
    );
    
    const unconfirmedDocs = hasApplicationLead
      ? tier1ReviewedDocs.filter((d: any) => d.owner_review_status !== 'confirmed')
      : [];

    // ── Pre-flight checks ──────────────────────────────────────────────────────
    const checks: { name: string; key: string; passed: boolean; detail: string }[] = [
      {
        name: 'All required documents approved or waived',
        key: 'required_docs_cleared',
        passed: docsNotCleared.length === 0,
        detail:
          docsNotCleared.length === 0
            ? 'All required documents are approved or waived.'
            : `${docsNotCleared.length} required document(s) still need review: ${docsNotCleared.map((d: any) => d.label).join(', ')}.`,
      },
      {
        name: 'Stanton review status is Approved',
        key: 'stanton_approved',
        passed: (app as any).stanton_review_status === 'approved',
        detail:
          (app as any).stanton_review_status === 'approved'
            ? 'Stanton review status is Approved.'
            : `Stanton review status is "${(app as any).stanton_review_status}". Must be "approved".`,
      },
      {
        name: 'HHA Application has been generated',
        key: 'hha_generated',
        passed: !!(app as any).hha_application_file,
        detail: (app as any).hha_application_file
          ? `HHA on file: ${(app as any).hha_application_file}`
          : 'HHA Application file has not been generated yet.',
      },
      {
        name: hasApplicationLead
          ? 'Application Lead has confirmed all tier-1 reviews'
          : 'Tier-2 confirmation (no Application Lead assigned)',
        key: 'tier2_confirmed',
        passed: !hasApplicationLead || unconfirmedDocs.length === 0,
        detail: hasApplicationLead
          ? unconfirmedDocs.length === 0
            ? 'All tier-1 reviews confirmed by Application Lead.'
            : `${unconfirmedDocs.length} document(s) awaiting Lead confirmation: ${unconfirmedDocs.map((d: any) => d.label).join(', ')}.`
          : 'No Application Lead assigned; tier-2 confirmation not required.',
      },
    ];

    const packet_summary = {
      applicant_name: (app as any).head_of_household_name,
      building_address: (app as any).building_address,
      unit_number: (app as any).unit_number,
      doc_counts: docCounts,
      total_docs: docs.length,
      hha_file: (app as any).hha_application_file ?? null,
      total_annual_income: (app as any).total_annual_income ?? null,
      stanton_reviewer: (app as any).stanton_reviewer ?? null,
      stanton_review_date: (app as any).stanton_review_date ?? null,
      packet_locked: (app as any).packet_locked,
      hach_packet_revision: (app as any).hach_packet_revision,
    };

    return NextResponse.json({
      success: true,
      data: {
        permission_held,
        checks,
        all_passed: checks.every((c) => c.passed),
        packet_summary,
      },
    });
  } catch (error: any) {
    console.error('[preflight] error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
