import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .select('id, household_size, income_limit, effective_date, created_at')
      .order('household_size', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error('PBV thresholds GET error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body.thresholds)) {
      return NextResponse.json({ success: false, message: 'thresholds array required' }, { status: 400 });
    }

    const rows: { household_size: number; income_limit: number; effective_date: string }[] = [];

    for (const t of body.thresholds) {
      const household_size = Number(t.household_size);
      const income_limit = Number(t.income_limit);
      const effective_date = String(t.effective_date ?? '').trim();

      if (!Number.isInteger(household_size) || household_size < 1 || household_size > 12) {
        return NextResponse.json(
          { success: false, message: `Invalid household_size: ${t.household_size}` },
          { status: 400 },
        );
      }
      if (!Number.isFinite(income_limit) || income_limit < 0) {
        return NextResponse.json(
          { success: false, message: `Invalid income_limit for household_size ${household_size}` },
          { status: 400 },
        );
      }
      if (!effective_date || !/^\d{4}-\d{2}-\d{2}$/.test(effective_date)) {
        return NextResponse.json(
          { success: false, message: `Invalid effective_date for household_size ${household_size}` },
          { status: 400 },
        );
      }

      rows.push({ household_size, income_limit, effective_date });
    }

    // Delete all existing rows for these household sizes then insert fresh rows
    // (upsert by household_size — no unique constraint exists, so we delete+insert)
    const sizes = rows.map((r) => r.household_size);
    const { error: delError } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .delete()
      .in('household_size', sizes);

    if (delError) throw delError;

    const { data, error: insError } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .insert(rows)
      .select('id, household_size, income_limit, effective_date');

    if (insError) throw insError;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('PBV thresholds POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
