import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { HouseholdMember } from '@/types/compliance';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('project_units')
      .select('*')
      .eq('tenant_link_token', token)
      .single();

    if (unitError) {
      if (unitError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw unitError;
    }

    if (unit.token_expires_at) {
      const expires = new Date(unit.token_expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expires < today) {
        return NextResponse.json({ success: false, message: 'This link has expired' }, { status: 410 });
      }
    }

    const { data: bedroomRow } = await supabaseAdmin
      .from('unit_bedroom_map')
      .select('bedroom_count')
      .eq('building_address', unit.building)
      .eq('unit_number', unit.unit_number)
      .maybeSingle();

    const { data: existing } = await supabaseAdmin
      .from('pbv_preapplications')
      .select('*')
      .eq('project_unit_id', unit.id)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      data: {
        building: unit.building,
        unit_number: unit.unit_number,
        preferred_language: unit.preferred_language,
        bedroom_count: bedroomRow?.bedroom_count ?? null,
        existing_submission: existing ?? null,
      },
    });
  } catch (error: any) {
    console.error('PBV preapp GET error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const { data: unit, error: unitError } = await supabaseAdmin
      .from('project_units')
      .select('*')
      .eq('tenant_link_token', token)
      .single();

    if (unitError) {
      if (unitError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw unitError;
    }

    if (unit.token_expires_at) {
      const expires = new Date(unit.token_expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expires < today) {
        return NextResponse.json({ success: false, message: 'This link has expired' }, { status: 410 });
      }
    }

    const { data: existing } = await supabaseAdmin
      .from('pbv_preapplications')
      .select('id')
      .eq('project_unit_id', unit.id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, message: 'Pre-application already submitted' }, { status: 409 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const {
      hoh_name,
      hoh_dob,
      household_members,
      hoh_is_citizen,
      other_adult_citizen,
      signature_data,
      task_id,
    } = body;

    if (!hoh_name?.trim()) {
      return NextResponse.json({ success: false, message: 'Head of household name is required' }, { status: 400 });
    }
    if (!hoh_dob) {
      return NextResponse.json({ success: false, message: 'Date of birth is required' }, { status: 400 });
    }
    if (!household_members || !Array.isArray(household_members) || household_members.length === 0) {
      return NextResponse.json({ success: false, message: 'At least one household member is required' }, { status: 400 });
    }
    if (typeof hoh_is_citizen !== 'boolean') {
      return NextResponse.json({ success: false, message: 'Citizenship status is required' }, { status: 400 });
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

    const household_size = household_members.length;
    const total_household_income = (household_members as HouseholdMember[]).reduce(
      (sum, m) => sum + (m.annual_income || 0),
      0
    );

    const { data: bedroomRow } = await supabaseAdmin
      .from('unit_bedroom_map')
      .select('bedroom_count')
      .eq('building_address', unit.building)
      .eq('unit_number', unit.unit_number)
      .maybeSingle();

    const bedroom_count = bedroomRow?.bedroom_count ?? null;

    const { data: thresholdRow } = await supabaseAdmin
      .from('pbv_income_thresholds')
      .select('income_limit')
      .eq('household_size', Math.min(household_size, 8))
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const income_limit = thresholdRow?.income_limit ?? null;

    const citizenship_ok = hoh_is_citizen === true || other_adult_citizen === true;
    const income_ok = income_limit === null || total_household_income <= income_limit;

    let qualification_result: string;
    if (income_ok && citizenship_ok) {
      qualification_result = 'likely_qualifies';
    } else if (!income_ok && !citizenship_ok) {
      qualification_result = 'over_income_and_citizenship';
    } else if (!income_ok) {
      qualification_result = 'over_income';
    } else {
      qualification_result = 'citizenship_issue';
    }

    const { data: preapp, error: insertError } = await supabaseAdmin
      .from('pbv_preapplications')
      .insert({
        project_unit_id: unit.id,
        hoh_name: hoh_name.trim(),
        hoh_dob,
        building_address: unit.building,
        unit_number: unit.unit_number,
        household_members,
        household_size,
        total_household_income,
        hoh_is_citizen,
        other_adult_citizen: hoh_is_citizen ? null : (other_adult_citizen ?? null),
        bedroom_count,
        income_limit,
        qualification_result,
        signature_data,
        signature_date: new Date().toISOString().split('T')[0],
        stanton_review_status: 'pending',
        language: unit.preferred_language || 'en',
        created_by: 'tenant',
      })
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Update task_completion if task_id provided
    if (task_id) {
      const { data: completion } = await supabaseAdmin
        .from('task_completions')
        .select('id')
        .eq('project_task_id', task_id)
        .eq('project_unit_id', unit.id)
        .maybeSingle();

      if (completion) {
        await supabaseAdmin
          .from('task_completions')
          .update({
            status: 'complete',
            completed_by: 'tenant',
            completed_at: new Date().toISOString(),
            evidence_url: null,
            notes: null,
          })
          .eq('id', completion.id);

        // Recompute overall_status
        const { data: allCompletions } = await supabaseAdmin
          .from('task_completions')
          .select('status, project_tasks!inner(required)')
          .eq('project_unit_id', unit.id);

        if (allCompletions) {
          const required = allCompletions.filter((c: any) => c.project_tasks?.required !== false);
          const anyFailed = required.some((c: any) => c.status === 'failed');
          const allDone = required.every((c: any) => c.status === 'complete' || c.status === 'waived');
          const anyDone = allCompletions.some((c: any) => c.status === 'complete');

          let overallStatus = 'not_started';
          if (anyFailed) overallStatus = 'has_failure';
          else if (allDone) overallStatus = 'complete';
          else if (anyDone) overallStatus = 'in_progress';

          await supabaseAdmin
            .from('project_units')
            .update({ overall_status: overallStatus })
            .eq('id', unit.id);
        }

        // Update preapp with task_completion_id
        await supabaseAdmin
          .from('pbv_preapplications')
          .update({ task_completion_id: completion.id })
          .eq('id', preapp.id);
      }
    }

    return NextResponse.json({ success: true, data: { id: preapp.id } });
  } catch (error: any) {
    console.error('PBV preapp POST error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
