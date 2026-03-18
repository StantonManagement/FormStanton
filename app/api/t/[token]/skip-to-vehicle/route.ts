import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { vehicleTaskId } = body;

    if (!vehicleTaskId) {
      return NextResponse.json({ success: false, message: 'vehicleTaskId required' }, { status: 400 });
    }

    // 1. Resolve token → project_units row
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('project_units')
      .select('*, projects(*)')
      .eq('tenant_link_token', token)
      .single();

    if (unitError) {
      if (unitError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw unitError;
    }

    // Check token expiry
    if (unit.token_expires_at) {
      const expires = new Date(unit.token_expires_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (expires < today) {
        return NextResponse.json({ success: false, message: 'This link has expired' }, { status: 410 });
      }
    }

    // 2. Get the vehicle task's order_index
    const { data: vehicleProjectTask, error: vtError } = await supabaseAdmin
      .from('project_tasks')
      .select('id, order_index')
      .eq('id', vehicleTaskId)
      .eq('project_id', unit.project_id)
      .single();

    if (vtError) {
      if (vtError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Vehicle task not found' }, { status: 404 });
      }
      throw vtError;
    }

    // 3. Find all prior non-required tasks that are still pending
    const { data: priorTasks, error: priorError } = await supabaseAdmin
      .from('project_tasks')
      .select('id, order_index, required')
      .eq('project_id', unit.project_id)
      .lt('order_index', vehicleProjectTask.order_index)
      .order('order_index', { ascending: true });

    if (priorError) throw priorError;

    const nonRequiredPriorIds = (priorTasks || [])
      .filter((t: any) => !t.required)
      .map((t: any) => t.id);

    if (nonRequiredPriorIds.length > 0) {
      // Get their task_completions that are still pending
      const { data: pendingCompletions, error: pcError } = await supabaseAdmin
        .from('task_completions')
        .select('id, project_task_id, status')
        .eq('project_unit_id', unit.id)
        .in('project_task_id', nonRequiredPriorIds)
        .in('status', ['pending', 'not_started']);

      if (pcError) throw pcError;

      // Waive them
      if (pendingCompletions && pendingCompletions.length > 0) {
        const waiveIds = pendingCompletions.map((c: any) => c.id);

        const { error: waiveError } = await supabaseAdmin
          .from('task_completions')
          .update({
            status: 'waived',
            completed_by: 'tenant',
            completed_at: new Date().toISOString(),
            notes: 'Skipped — tenant used vehicle shortcut',
          })
          .in('id', waiveIds);

        if (waiveError) throw waiveError;
      }
    }

    // 4. Recompute project_units.overall_status
    const { data: allCompletions, error: allCompError } = await supabaseAdmin
      .from('task_completions')
      .select('status, project_tasks!inner(required)')
      .eq('project_unit_id', unit.id);

    if (allCompError) throw allCompError;

    const requiredCompletions = (allCompletions || []).filter(
      (c: any) => c.project_tasks?.required !== false
    );
    const allRequiredDone = requiredCompletions.every(
      (c: any) => c.status === 'complete' || c.status === 'waived'
    );
    const anyDone = (allCompletions || []).some(
      (c: any) => c.status === 'complete' || c.status === 'waived'
    );

    let overallStatus = 'not_started';
    if (allRequiredDone) {
      overallStatus = 'complete';
    } else if (anyDone) {
      overallStatus = 'in_progress';
    }

    await supabaseAdmin
      .from('project_units')
      .update({ overall_status: overallStatus })
      .eq('id', unit.id);

    // 5. Return refreshed task list
    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('project_tasks')
      .select('*, task_types(*), task_completions!inner(status, evidence_url, completed_at, notes)')
      .eq('project_id', unit.project_id)
      .eq('task_completions.project_unit_id', unit.id)
      .order('order_index', { ascending: true });

    if (tasksError) throw tasksError;

    const taskList = (tasks || []).map((t: any) => ({
      id: t.id,
      order_index: t.order_index,
      required: t.required,
      task_type: {
        id: t.task_types?.id,
        name: t.task_types?.name,
        description: t.task_types?.description,
        assignee: t.task_types?.assignee,
        evidence_type: t.task_types?.evidence_type,
        form_id: t.task_types?.form_id,
        instructions: t.task_types?.instructions,
      },
      completion: {
        status: t.task_completions?.[0]?.status ?? 'pending',
        evidence_url: t.task_completions?.[0]?.evidence_url ?? null,
        completed_at: t.task_completions?.[0]?.completed_at ?? null,
        notes: t.task_completions?.[0]?.notes ?? null,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        overall_status: overallStatus,
        tasks: taskList,
      },
    });
  } catch (error: any) {
    console.error('Skip-to-vehicle error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
