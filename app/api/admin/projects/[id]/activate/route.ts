import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';
import { buildingToAssetId } from '@/lib/buildings';

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

    // 1. Verify project exists and is in draft status
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw projectError;
    }

    if (project.status !== 'draft') {
      return NextResponse.json(
        { success: false, message: 'Project must be in draft status to activate' },
        { status: 400 }
      );
    }

    // 2. Fetch all project_tasks for this project
    const { data: projectTasks, error: tasksError } = await supabaseAdmin
      .from('project_tasks')
      .select('id')
      .eq('project_id', id);

    if (tasksError) throw tasksError;

    if (!projectTasks || projectTasks.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Project has no tasks defined — add tasks before activating' },
        { status: 400 }
      );
    }

    // 3. Batch-lookup tenant_profiles for preferred_language
    const profileKeys = units.map((u) => `${u.building}||${u.unit_number}`);
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('tenant_profiles')
      .select('building, unit_number, preferred_language');

    if (profilesError) throw profilesError;

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(`${p.building}||${p.unit_number}`, p.preferred_language);
    }

    // 3b. Batch-lookup tenant_lookup for tenant names via asset_id
    const unitAssetIds = [...new Set(units.map(u => buildingToAssetId[u.building]).filter(Boolean))];
    const { data: tenants, error: tenantsError } = await supabaseAdmin
      .from('tenant_lookup')
      .select('asset_id, unit_number, name')
      .in('asset_id', unitAssetIds.length > 0 ? unitAssetIds : ['__none__'])
      .eq('is_current', true);

    if (tenantsError) throw tenantsError;

    const tenantNameMap = new Map<string, string>();
    for (const t of tenants || []) {
      tenantNameMap.set(`${t.asset_id}||${t.unit_number}`, t.name);
    }

    // 4. Compute token_expires_at: project deadline + 30 days, or null
    let tokenExpiresAt: string | null = null;
    if (project.deadline) {
      const d = new Date(project.deadline);
      d.setDate(d.getDate() + 30);
      tokenExpiresAt = d.toISOString().split('T')[0];
    }

    // 5. Build project_units rows
    const unitRows = units.map((u) => {
      const assetId = buildingToAssetId[u.building];
      if (!assetId) {
        throw new Error(`Unknown building: ${u.building} — no asset_id mapping found`);
      }
      return {
        project_id: id,
        building: u.building,
        unit_number: u.unit_number,
        asset_id: assetId,
        tenant_name: tenantNameMap.get(`${assetId}||${u.unit_number}`) || null,
        tenant_link_token: generateToken(),
        token_expires_at: tokenExpiresAt,
        preferred_language: profileMap.get(`${u.building}||${u.unit_number}`) || 'en',
        overall_status: 'not_started',
      };
    });

    const { data: insertedUnits, error: unitsError } = await supabaseAdmin
      .from('project_units')
      .insert(unitRows)
      .select('id');

    if (unitsError) throw unitsError;

    // 6. Build task_completions rows (one per unit × task)
    const completionRows: { project_unit_id: string; project_task_id: string; status: string }[] = [];
    for (const unit of insertedUnits || []) {
      for (const task of projectTasks) {
        completionRows.push({
          project_unit_id: unit.id,
          project_task_id: task.id,
          status: 'pending',
        });
      }
    }

    const { error: completionsError } = await supabaseAdmin
      .from('task_completions')
      .insert(completionRows);

    if (completionsError) throw completionsError;

    // 7. Set project status to active
    const { error: statusError } = await supabaseAdmin
      .from('projects')
      .update({ status: 'active' })
      .eq('id', id);

    if (statusError) throw statusError;

    return NextResponse.json({
      success: true,
      data: {
        units_activated: (insertedUnits || []).length,
        tasks_created: completionRows.length,
      },
    });
  } catch (error: any) {
    console.error('Project activate error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
