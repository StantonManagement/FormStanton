import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .select('id, household_size, income_limit, effective_date, zipcode, created_at')
      .order('household_size', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err: any) {
    console.error('PBV thresholds GET error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!Array.isArray(body.thresholds)) {
      return NextResponse.json({ success: false, message: 'thresholds array required' }, { status: 400 });
    }

    const rows: { household_size: number; income_limit: number; effective_date: string; zipcode?: string | null }[] = [];

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

      const zipcode = t.zipcode !== undefined ? (t.zipcode || null) : undefined;
      rows.push({ household_size, income_limit, effective_date, zipcode });
    }

    // Use upsert to avoid race condition (delete+insert is not atomic)
    // Match on unique constraint: household_size + zipcode + effective_date
    const { data, error: upsertError } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .upsert(
        rows.map((r) => ({
          household_size: r.household_size,
          income_limit: r.income_limit,
          effective_date: r.effective_date,
          zipcode: r.zipcode ?? null,
        })),
        { onConflict: 'household_size,zipcode,effective_date' }
      )
      .select('id, household_size, income_limit, effective_date, zipcode');

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    console.error('PBV thresholds POST error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
