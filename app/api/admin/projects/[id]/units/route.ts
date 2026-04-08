import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';
import { normalizeAddress } from '@/lib/addressNormalizer';

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

    // Fetch the project to check for parent_project_id
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('id, parent_project_id')
      .eq('id', id)
      .single();
    if (projErr) throw projErr;

    const { data, error } = await supabaseAdmin
      .from('project_units')
      .select('*, task_completions(*)')
      .eq('project_id', id)
      .order('building', { ascending: true })
      .order('unit_number', { ascending: true });

    if (error) throw error;

    // Enrich with submission cross-reference (insurance_file, etc.)
    const buildings = [...new Set((data || []).map((u: any) => u.building))];

    // Live tenant name lookup — normalize both sides so address variants resolve correctly
    const liveNameMap = new Map<string, string>();
    {
      const { data: liveTenants } = await supabaseAdmin
        .from('tenant_lookup')
        .select('building_address, unit_number, name, first_name, last_name')
        .eq('is_current', true);
      for (const t of liveTenants || []) {
        const derived = t.name !== 'Occupied Unit' && t.name
          ? t.name
          : `${t.first_name || ''} ${t.last_name || ''}`.trim();
        if (derived && derived !== 'Occupied Unit') {
          const normBuilding = normalizeAddress(t.building_address || '');
          liveNameMap.set(`${normBuilding}||${t.unit_number}`, derived);
        }
      }
    }

    let submissionMap = new Map<string, any>();
    if (buildings.length > 0) {
      const { data: subs } = await supabaseAdmin
        .from('submissions')
        .select('building_address, unit_number, insurance_file, insurance_verified, insurance_type, add_insurance_to_rent, created_at, is_primary')
        .in('building_address', buildings)
        .order('created_at', { ascending: false });

      // Sort: primary submissions first, then newest
      const sorted = (subs || []).slice().sort((a: any, b: any) => {
        if (a.is_primary && !b.is_primary) return -1;
        if (!a.is_primary && b.is_primary) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      for (const s of sorted) {
        const key = `${s.building_address}||${s.unit_number}`;
        const existing = submissionMap.get(key);
        if (!existing) {
          // First (canonical) row for this unit
          submissionMap.set(key, s);
        } else {
          // Backfill insurance fields if canonical row is missing them
          if (!existing.insurance_file && s.insurance_file) {
            submissionMap.set(key, { ...existing, insurance_file: s.insurance_file });
          }
          if (!existing.add_insurance_to_rent && s.add_insurance_to_rent) {
            submissionMap.set(key, { ...submissionMap.get(key), add_insurance_to_rent: s.add_insurance_to_rent });
          }
        }
      }
    }

    // Build parent evidence map: child_task_id → { building||unit → evidence }
    // Only populated if this project has a parent and tasks have parent_task_id set
    let parentEvidenceMap = new Map<string, Map<string, { evidence_url: string | null; task_name: string; completed_at: string | null; status: string }>>();
    if (project.parent_project_id) {
      // Get this project's tasks that have parent_task_id
      const { data: childTasks } = await supabaseAdmin
        .from('project_tasks')
        .select('id, parent_task_id')
        .eq('project_id', id)
        .not('parent_task_id', 'is', null);

      const parentTaskIds = (childTasks || []).map((t: any) => t.parent_task_id).filter(Boolean);

      if (parentTaskIds.length > 0) {
        // Get parent units + their completions for those parent tasks
        const { data: parentUnits } = await supabaseAdmin
          .from('project_units')
          .select('building, unit_number')
          .eq('project_id', project.parent_project_id);

        const { data: parentCompletions } = await supabaseAdmin
          .from('task_completions')
          .select('project_task_id, project_unit_id, evidence_url, completed_at, status, project_tasks!inner(id, task_types(name)), project_units!inner(building, unit_number)')
          .in('project_task_id', parentTaskIds)
          .eq('project_units.project_id', project.parent_project_id);

        // Build a mapping from child_task_id → building||unit → evidence
        const parentTaskToChildTask = new Map<string, string>();
        for (const ct of childTasks || []) {
          if (ct.parent_task_id) parentTaskToChildTask.set(ct.parent_task_id, ct.id);
        }

        for (const pc of parentCompletions || []) {
          const pu = (pc as any).project_units;
          const pt = (pc as any).project_tasks;
          const taskName = pt?.task_types?.name || 'Unknown';
          const childTaskId = parentTaskToChildTask.get(pc.project_task_id);
          if (!childTaskId || !pu) continue;

          const unitKey = `${pu.building}||${pu.unit_number}`;
          if (!parentEvidenceMap.has(childTaskId)) {
            parentEvidenceMap.set(childTaskId, new Map());
          }
          parentEvidenceMap.get(childTaskId)!.set(unitKey, {
            evidence_url: pc.evidence_url,
            task_name: taskName,
            completed_at: pc.completed_at,
            status: pc.status,
          });
        }
      }
    }

    const enriched = (data || []).map((u: any) => {
      const sub = submissionMap.get(`${u.building}||${u.unit_number}`);
      const unitKey = `${u.building}||${u.unit_number}`;
      const normUnitKey = `${normalizeAddress(u.building)}||${u.unit_number}`;

      // Build parent_evidence keyed by child task ID
      const parent_evidence: Record<string, { evidence_url: string | null; task_name: string; completed_at: string | null; status: string }> = {};
      for (const [childTaskId, unitMap] of parentEvidenceMap) {
        const ev = unitMap.get(unitKey);
        if (ev) parent_evidence[childTaskId] = ev;
      }

      return {
        ...u,
        tenant_name: liveNameMap.get(normUnitKey) || u.tenant_name || null,
        submission_data: sub ? {
          insurance_file: sub.insurance_file,
          insurance_verified: sub.insurance_verified,
          insurance_type: sub.insurance_type,
          add_insurance_to_rent: sub.add_insurance_to_rent ?? false,
        } : null,
        parent_evidence: Object.keys(parent_evidence).length > 0 ? parent_evidence : null,
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
