import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { buildingUnits, buildings } from '@/lib/buildings';
import { checkRateLimit } from '@/lib/rateLimiter';
import type { HouseholdMember } from '@/types/compliance';

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (!checkRateLimit(ip, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { success: false, message: 'Too many submissions. Please try again later.' },
      { status: 429 },
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      building_address,
      unit_number,
      hoh_name,
      hoh_dob,
      household_members,
      citizenship_answer,
      signature_data,
    } = body;

    // --- Validation ---
    if (!building_address?.trim() || !buildings.includes(building_address)) {
      return NextResponse.json({ success: false, message: 'Invalid building address' }, { status: 400 });
    }
    if (!unit_number?.trim()) {
      return NextResponse.json({ success: false, message: 'Unit number is required' }, { status: 400 });
    }
    if (!hoh_name?.trim()) {
      return NextResponse.json({ success: false, message: 'Head of household name is required' }, { status: 400 });
    }
    if (!hoh_dob) {
      return NextResponse.json({ success: false, message: 'Date of birth is required' }, { status: 400 });
    }
    if (!household_members || !Array.isArray(household_members) || household_members.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one household member is required' }, { status: 400 });
    }
    if (!citizenship_answer || !['yes', 'no', 'unsure'].includes(citizenship_answer)) {
      return NextResponse.json({ success: false, message: 'Citizenship answer is required' }, { status: 400 });
    }
    if (!signature_data) {
      return NextResponse.json({ success: false, message: 'Signature is required' }, { status: 400 });
    }

    for (let i = 0; i < household_members.length; i++) {
      const m = household_members[i] as HouseholdMember;
      if (!m.name?.trim()) {
        return NextResponse.json({ success: false, message: `Member ${i + 1}: name is required` }, { status: 400 });
      }
      if (!m.dob) {
        return NextResponse.json({ success: false, message: `Member ${i + 1}: date of birth is required` }, { status: 400 });
      }
      if (!m.relationship) {
        return NextResponse.json({ success: false, message: `Member ${i + 1}: relationship is required` }, { status: 400 });
      }
      if (typeof m.annual_income !== 'number' || m.annual_income < 0) {
        return NextResponse.json({ success: false, message: `Member ${i + 1}: valid annual income is required` }, { status: 400 });
      }
    }

    // --- Canonical unit check ---
    const knownUnits = buildingUnits[building_address] ?? null;
    const unit_not_in_canonical_list =
      knownUnits !== null &&
      !knownUnits.some((u) => u.toLowerCase() === unit_number.trim().toLowerCase());

    // --- Qualification math ---
    const household_size = (household_members as HouseholdMember[]).length;
    const total_household_income = (household_members as HouseholdMember[]).reduce(
      (sum, m) => sum + (m.annual_income || 0),
      0,
    );

    const { data: thresholdRow } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .select('income_limit')
      .eq('household_size', Math.min(household_size, 8))
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const income_limit = thresholdRow?.income_limit ?? null;
    const income_ok = income_limit === null || total_household_income <= income_limit;

    // Map citizenship_answer to qualification result
    // yes -> citizenship_ok = true
    // no -> citizenship_ok = false
    // unsure -> citizenship_ok = null (needs review)
    let qualification_result: string;
    if (citizenship_answer === 'yes') {
      qualification_result = income_ok ? 'likely_qualifies' : 'over_income';
    } else if (citizenship_answer === 'unsure') {
      qualification_result = income_ok ? 'needs_citizenship_review' : 'over_income';
    } else {
      // citizenship_answer === 'no'
      qualification_result = income_ok ? 'citizenship_issue' : 'over_income_and_citizenship';
    }

    // Map to existing database columns
    const hoh_is_citizen = citizenship_answer === 'yes' ? true : citizenship_answer === 'no' ? false : null;

    // --- Insert ---
    const { data: preapp, error } = await supabaseAdmin
      .from('pbv_preapplications')
      .insert({
        hoh_name: hoh_name.trim(),
        hoh_dob,
        building_address: building_address.trim(),
        unit_number: unit_number.trim(),
        household_members,
        household_size,
        total_household_income,
        hoh_is_citizen,
        other_adult_citizen: null,
        income_limit,
        qualification_result,
        signature_data,
        signature_date: new Date().toISOString().split('T')[0],
        stanton_review_status: 'pending',
        language: 'en',
        created_by: 'open_enrollment',
        unit_not_in_canonical_list,
        submission_source: 'open_enrollment',
      })
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data: { id: preapp.id } });
  } catch (err: any) {
    console.error('PBV open enrollment submit error:', err);
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
