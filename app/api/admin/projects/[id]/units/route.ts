import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const { data, error } = await supabaseAdmin
      .from('project_units')
      .select('*, task_completions(*)')
      .eq('project_id', id)
      .order('building', { ascending: true })
      .order('unit_number', { ascending: true });

    if (error) throw error;

    // Enrich with submission cross-reference (insurance_file, etc.)
    const buildings = [...new Set((data || []).map((u: any) => u.building))];
    let submissionMap = new Map<string, any>();
    if (buildings.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from('submissions')
        .select('building_address, unit_number, insurance_file, insurance_verified, insurance_type')
        .in('building_address', buildings);

      for (const s of subs || []) {
        submissionMap.set(`${s.building_address}||${s.unit_number}`, s);
      }
    }

    const enriched = (data || []).map((u: any) => {
      const sub = submissionMap.get(`${u.building}||${u.unit_number}`);
      return {
        ...u,
        submission_data: sub ? {
          insurance_file: sub.insurance_file,
          insurance_verified: sub.insurance_verified,
          insurance_type: sub.insurance_type,
        } : null,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    console.error('Project units fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const units: { building: string; unit_number: string }[] = body.units;

    if (!Array.isArray(units) || units.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Request body must include a non-empty units array' },
        { status: 400 }
      );
    }

    // 1. Verify project exists and is active
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id, status, deadline')
      .eq('id', id)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw projectError;
    }

    if (project.status !== 'active') {
      return NextResponse.json(
        { success: false, message: 'Project must be active to add units' },
        { status: 400 }
      );
    }

    // 2. Get existing units to skip duplicates
    const { data: existingUnits, error: existingError } = await supabaseAdmin
      .from('project_units')
      .select('building, unit_number')
      .eq('project_id', id);

    if (existingError) throw existingError;

    const existingSet = new Set(
      (existingUnits || []).map((u: any) => `${u.building}||${u.unit_number}`)
    );

    const newUnits = units.filter(
      (u) => !existingSet.has(`${u.building}||${u.unit_number}`)
    );

    if (newUnits.length === 0) {
      return NextResponse.json({
        success: true,
        data: { units_added: 0, tasks_created: 0 },
        message: 'All units already exist in this project',
      });
    }

    // 3. Fetch project tasks
    const { data: projectTasks, error: tasksError } = await supabaseAdmin
      .from('project_tasks')
      .select('id')
      .eq('project_id', id);

    if (tasksError) throw tasksError;

    // 4. Lookup tenant names
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenant_lookup')
      .select('building_address, unit_number, name')
      .eq('is_current', true);

    if (tenantsError) throw tenantsError;

    const tenantNameMap = new Map<string, string>();
    for (const t of tenants || []) {
      tenantNameMap.set(`${t.building_address}||${t.unit_number}`, t.name);
    }

    // 5. Lookup tenant_profiles for preferred_language
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('tenant_profiles')
      .select('building, unit_number, preferred_language');

    if (profilesError) throw profilesError;

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(`${p.building}||${p.unit_number}`, p.preferred_language);
    }

    // 6. Compute token_expires_at
    let tokenExpiresAt: string | null = null;
    if (project.deadline) {
      const d = new Date(project.deadline);
      d.setDate(d.getDate() + 30);
      tokenExpiresAt = d.toISOString().split('T')[0];
    }

    // 7. Insert new project_units
    const unitRows = newUnits.map((u) => ({
      project_id: id,
      building: u.building,
      unit_number: u.unit_number,
      tenant_name: tenantNameMap.get(`${u.building}||${u.unit_number}`) || null,
      tenant_link_token: generateToken(),
      token_expires_at: tokenExpiresAt,
      preferred_language: profileMap.get(`${u.building}||${u.unit_number}`) || 'en',
      overall_status: 'not_started',
    }));

    const { data: insertedUnits, error: unitsError } = await supabaseAdmin
      .from('project_units')
      .insert(unitRows)
      .select('id');

    if (unitsError) throw unitsError;

    // 8. Create task_completions for each new unit × task
    const completionRows: { project_unit_id: string; project_task_id: string; status: string }[] = [];
    for (const unit of insertedUnits || []) {
      for (const task of projectTasks || []) {
        completionRows.push({
          project_unit_id: unit.id,
          project_task_id: task.id,
          status: 'pending',
        });
      }
    }

    if (completionRows.length > 0) {
      const { error: completionsError } = await supabaseAdmin
        .from('task_completions')
        .insert(completionRows);

      if (completionsError) throw completionsError;
    }

    return NextResponse.json({
      success: true,
      data: {
        units_added: (insertedUnits || []).length,
        tasks_created: completionRows.length,
      },
    });
  } catch (error: any) {
    console.error('Add units to project error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
