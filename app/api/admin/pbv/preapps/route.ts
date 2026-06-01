import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const qualificationResult = searchParams.get('qualification_result');
    const reviewStatus = searchParams.get('review_status');
    const building = searchParams.get('building');

    let query = supabaseAdmin
      .from('pbv_preapplications')
      .select('id, created_at, hoh_name, building_address, unit_number, household_size, total_household_income, income_limit, qualification_result, stanton_review_status, stanton_reviewer, stanton_review_date, bedroom_count, language, unit_not_in_canonical_list, submission_source')
      .order('created_at', { ascending: false });

    if (qualificationResult) {
      query = query.eq('qualification_result', qualificationResult);
    }
    if (reviewStatus) {
      query = query.eq('stanton_review_status', reviewStatus);
    }
    if (building) {
      query = query.eq('building_address', building);
    }

    const { data, error } = await query;
    if (error) throw error;

    const preapps = data ?? [];

    // Attach full-application send status. A linked pbv_full_applications row
    // (via preapp_id) is created as part of the approve→send invitation flow,
    // so its existence means the applicant has been sent a full application.
    const preappIds = preapps.map((p) => p.id);
    const fullAppByPreapp = new Map<string, { id: string; intake_status: string }>();
    if (preappIds.length > 0) {
      const { data: fullApps, error: faError } = await supabaseAdmin
        .from('pbv_full_applications')
        .select('id, preapp_id, intake_status, created_at')
        .in('preapp_id', preappIds)
        .order('created_at', { ascending: false });
      if (faError) throw faError;
      for (const fa of fullApps ?? []) {
        if (!fa.preapp_id) continue;
        // Rows are ordered newest-first, so the first one we see per preapp wins.
        if (!fullAppByPreapp.has(fa.preapp_id)) {
          fullAppByPreapp.set(fa.preapp_id, { id: fa.id, intake_status: fa.intake_status });
        }
      }
    }

    const enriched = preapps.map((p) => ({
      ...p,
      full_application: fullAppByPreapp.get(p.id) ?? null,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('PBV preapps list error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
