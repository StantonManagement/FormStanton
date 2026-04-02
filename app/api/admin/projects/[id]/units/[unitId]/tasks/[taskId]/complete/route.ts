import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; unitId: string; taskId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, unitId, taskId } = await context.params;
    const body = await request.json();
    const { completed_by, notes, status: requestedStatus, failure_reason, reviewer_notes } = body;

    // Resolve session user as fallback for completed_by
    const sessionUser = await getSessionUser();
    const completedByName = completed_by || sessionUser?.displayName || 'staff';

    // Validate status if provided
    const targetStatus = requestedStatus || 'complete';
    if (!['complete', 'failed'].includes(targetStatus)) {
      return NextResponse.json(
        { success: false, message: 'Status must be "complete" or "failed"' },
        { status: 400 }
      );
    }

    // Require failure_reason when marking as failed
    if (targetStatus === 'failed' && !failure_reason?.trim()) {
      return NextResponse.json(
        { success: false, message: 'failure_reason is required when marking task as failed' },
        { status: 400 }
      );
    }

    // 1. Verify project exists
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw projectError;
    }

    // 2. Verify unit belongs to project
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('project_units')
      .select('id, project_id, building, unit_number')
      .eq('id', unitId)
      .eq('project_id', projectId)
      .single();

    if (unitError) {
      if (unitError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Unit not found in project' }, { status: 404 });
      }
      throw unitError;
    }

    // 3. Verify task_completions row exists and get task_type info
    const { data: completion, error: compError } = await supabaseAdmin
      .from('task_completions')
      .select('*, project_tasks!inner(*, task_types(*))')
      .eq('project_task_id', taskId)
      .eq('project_unit_id', unitId)
      .single();

    if (compError) {
      if (compError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Task completion not found' }, { status: 404 });
      }
      throw compError;
    }

    // 4. Verify task is staff_check type
    const taskType = (completion as any).project_tasks?.task_types;
    if (taskType?.assignee !== 'staff') {
      return NextResponse.json(
        { success: false, message: 'Only staff tasks can be completed from the admin panel' },
        { status: 403 }
      );
    }

    // 5. Update task_completions
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('task_completions')
      .update({
        status: targetStatus,
        completed_by: completedByName,
        completed_at: new Date().toISOString(),
        notes: notes || null,
        failure_reason: targetStatus === 'failed' ? failure_reason : null,
        reviewer_notes: reviewer_notes || null,
      })
      .eq('id', completion.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 6. Side-effect: update submission field if task_type.submission_column is set
    const submissionColumn = taskType?.submission_column;
    if (submissionColumn) {
      // Set to true only if complete, false if failed
      const { error: subError } = await supabaseAdmin
        .from('submissions')
        .update({ [submissionColumn]: targetStatus === 'complete' })
        .eq('building_address', unit.building)
        .eq('unit_number', unit.unit_number);

      if (subError) {
        console.error('Side-effect submission update failed:', subError);
        // Non-fatal — task completion still succeeded
      }
    }

    // 6b. Side-effect: push result UP to parent project if parent_task_id is set
    const parentTaskId = (completion as any).project_tasks?.parent_task_id;
    if (parentTaskId) {
      try {
        // Get the parent project's project_id from the parent task
        const { data: parentTask } = await supabaseAdmin
          .from('project_tasks')
          .select('project_id')
          .eq('id', parentTaskId)
          .single();

        if (parentTask) {
          // Find the parent unit with matching building+unit_number
          const { data: parentUnit } = await supabaseAdmin
            .from('project_units')
            .select('id')
            .eq('project_id', parentTask.project_id)
            .eq('building', unit.building)
            .eq('unit_number', unit.unit_number)
            .single();

          if (parentUnit) {
            // Get the project name for the note
            const { data: thisProject } = await supabaseAdmin
              .from('projects')
              .select('name')
              .eq('id', projectId)
              .single();

            const projectName = thisProject?.name || 'Child Project';
            const timestamp = new Date().toLocaleDateString();
            const noteText = targetStatus === 'complete'
              ? `Verified by ${projectName} — ${completedByName} on ${timestamp}`
              : `Failed: ${failure_reason} — ${projectName} — ${completedByName} on ${timestamp}`;

            await supabaseAdmin
              .from('task_completions')
              .update({ notes: noteText })
              .eq('project_task_id', parentTaskId)
              .eq('project_unit_id', parentUnit.id);
          }
        }
      } catch (parentErr) {
        console.error('Parent up-flow side-effect failed:', parentErr);
        // Non-fatal — child completion still succeeded
      }
    }

    // 7. Recompute project_units.overall_status
    const { data: allCompletions, error: allCompError } = await supabaseAdmin
      .from('task_completions')
      .select('status, project_tasks!inner(required)')
      .eq('project_unit_id', unitId);

    if (allCompError) throw allCompError;

    const requiredCompletions = (allCompletions || []).filter(
      (c: any) => c.project_tasks?.required !== false
    );
    
    // Check for any failed required tasks
    const anyRequiredFailed = requiredCompletions.some(
      (c: any) => c.status === 'failed'
    );
    
    const allRequiredDone = requiredCompletions.every(
      (c: any) => c.status === 'complete' || c.status === 'waived'
    );
    const anyDone = (allCompletions || []).some(
      (c: any) => c.status === 'complete'
    );

    let overallStatus = 'not_started';
    if (anyRequiredFailed) {
      overallStatus = 'has_failure';
    } else if (allRequiredDone) {
      overallStatus = 'complete';
    } else if (anyDone) {
      overallStatus = 'in_progress';
    }

    await supabaseAdmin
      .from('project_units')
      .update({ overall_status: overallStatus })
      .eq('id', unitId);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Staff task completion error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; unitId: string; taskId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId, unitId, taskId } = await context.params;

    // 1. Verify unit belongs to project
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('project_units')
      .select('id, project_id, building, unit_number')
      .eq('id', unitId)
      .eq('project_id', projectId)
      .single();

    if (unitError) {
      if (unitError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Unit not found in project' }, { status: 404 });
      }
      throw unitError;
    }

    // 2. Get task_completions row + task_type info
    const { data: completion, error: compError } = await supabaseAdmin
      .from('task_completions')
      .select('*, project_tasks!inner(*, task_types(*))')
      .eq('project_task_id', taskId)
      .eq('project_unit_id', unitId)
      .single();

    if (compError) {
      if (compError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Task completion not found' }, { status: 404 });
      }
      throw compError;
    }

    const taskType = (completion as any).project_tasks?.task_types;
    if (taskType?.assignee !== 'staff') {
      return NextResponse.json(
        { success: false, message: 'Only staff tasks can be uncompleted from the admin panel' },
        { status: 403 }
      );
    }

    // 3. Revert task_completions to pending
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('task_completions')
      .update({
        status: 'pending',
        completed_by: null,
        completed_at: null,
        notes: null,
        failure_reason: null,
        reviewer_notes: null,
      })
      .eq('id', completion.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 4. Side-effect: revert submission field if task_type.submission_column is set
    const submissionColumn = taskType?.submission_column;
    if (submissionColumn) {
      const { error: subError } = await supabaseAdmin
        .from('submissions')
        .update({ [submissionColumn]: false })
        .eq('building_address', unit.building)
        .eq('unit_number', unit.unit_number);

      if (subError) {
        console.error('Side-effect submission revert failed:', subError);
      }
    }

    // 4b. Side-effect: clear parent note if parent_task_id is set
    const parentTaskId = (completion as any).project_tasks?.parent_task_id;
    if (parentTaskId) {
      try {
        const { data: parentTask } = await supabaseAdmin
          .from('project_tasks')
          .select('project_id')
          .eq('id', parentTaskId)
          .single();

        if (parentTask) {
          const { data: parentUnit } = await supabaseAdmin
            .from('project_units')
            .select('id')
            .eq('project_id', parentTask.project_id)
            .eq('building', unit.building)
            .eq('unit_number', unit.unit_number)
            .single();

          if (parentUnit) {
            await supabaseAdmin
              .from('task_completions')
              .update({ notes: null })
              .eq('project_task_id', parentTaskId)
              .eq('project_unit_id', parentUnit.id);
          }
        }
      } catch (parentErr) {
        console.error('Parent up-flow revert failed:', parentErr);
      }
    }

    // 5. Recompute project_units.overall_status
    const { data: allCompletions, error: allCompError } = await supabaseAdmin
      .from('task_completions')
      .select('status, project_tasks!inner(required)')
      .eq('project_unit_id', unitId);

    if (allCompError) throw allCompError;

    const requiredCompletions = (allCompletions || []).filter(
      (c: any) => c.project_tasks?.required !== false
    );
    
    // Check for any failed required tasks
    const anyRequiredFailed = requiredCompletions.some(
      (c: any) => c.status === 'failed'
    );
    
    const allRequiredDone = requiredCompletions.every(
      (c: any) => c.status === 'complete' || c.status === 'waived'
    );
    const anyDone = (allCompletions || []).some(
      (c: any) => c.status === 'complete'
    );

    let overallStatus = 'not_started';
    if (anyRequiredFailed) {
      overallStatus = 'has_failure';
    } else if (allRequiredDone) {
      overallStatus = 'complete';
    } else if (anyDone) {
      overallStatus = 'in_progress';
    }

    await supabaseAdmin
      .from('project_units')
      .update({ overall_status: overallStatus })
      .eq('id', unitId);

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('Staff task uncomplete error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
