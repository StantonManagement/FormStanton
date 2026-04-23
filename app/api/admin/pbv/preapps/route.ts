import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
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

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('PBV preapps list error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
