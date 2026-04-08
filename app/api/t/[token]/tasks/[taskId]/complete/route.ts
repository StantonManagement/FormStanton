import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

interface UnitWithProject {
  id: string;
  project_id: string;
  building: string;
  unit_number: string;
  tenant_link_token: string;
  token_expires_at: string | null;
  preferred_language: string;
  overall_status: string;
  projects: {
    id: string;
    sequential: boolean;
    status: string;
  };
}

interface CompletionWithTask {
  id: string;
  project_unit_id: string;
  project_task_id: string;
  status: string;
  evidence_url: string | null;
  project_tasks: {
    id: string;
    order_index: number;
    required: boolean;
    task_types: {
      id: string;
      name: string;
      assignee: string;
      evidence_type: string;
      form_id: string | null;
      instructions: string | null;
    } | null;
  };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string; taskId: string }> }
) {
  try {
    const { token, taskId } = await context.params;

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

    const typedUnit = unit as unknown as UnitWithProject;
    const project = typedUnit.projects;

    // 2. Verify task_completions row exists for this project_task_id + project_unit_id
    const { data: completion, error: compError } = await supabaseAdmin
      .from('task_completions')
      .select('*, project_tasks!inner(*, task_types(*))')
      .eq('project_task_id', taskId)
      .eq('project_unit_id', unit.id)
      .single();

    if (compError) {
      if (compError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Task not found for this unit' }, { status: 404 });
      }
      throw compError;
    }

    // 3. Reject if already complete
    if (completion.status === 'complete') {
      return NextResponse.json({ success: false, message: 'Task already completed' }, { status: 409 });
    }

    const typedCompletion = completion as unknown as CompletionWithTask;
    const projectTask = typedCompletion.project_tasks;
    const taskType = projectTask?.task_types;

    // Reject if staff_check — tenants cannot complete these
    if (taskType?.assignee === 'staff') {
      return NextResponse.json({ success: false, message: 'This task is completed by staff' }, { status: 403 });
    }

    // 4. If sequential project: verify all prior tasks are complete
    if (project.sequential) {
      const { data: allTasks, error: allTasksError } = await supabaseAdmin
        .from('project_tasks')
        .select('id, order_index')
        .eq('project_id', unit.project_id)
        .order('order_index', { ascending: true });

      if (allTasksError) throw allTasksError;

      const currentOrderIndex = projectTask?.order_index ?? 0;
      const priorTaskIds = (allTasks || [])
        .filter((t: any) => t.order_index < currentOrderIndex)
        .map((t: any) => t.id);

      if (priorTaskIds.length > 0) {
        const { data: priorCompletions, error: priorError } = await supabaseAdmin
          .from('task_completions')
          .select('status')
          .eq('project_unit_id', unit.id)
          .in('project_task_id', priorTaskIds);

        if (priorError) throw priorError;

        const allPriorComplete = (priorCompletions || []).every(
          (c: any) => c.status === 'complete' || c.status === 'waived' || c.status === 'failed'
        );

        if (!allPriorComplete) {
          return NextResponse.json(
            { success: false, message: 'Complete previous tasks first' },
            { status: 403 }
          );
        }
      }
    }

    // 5. Process submission based on evidence type
    const evidenceType = taskType?.evidence_type;
    let evidenceUrl: string | null = null;
    let notes: string | null = null;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // File-based evidence types: file_upload, photo
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      notes = (formData.get('notes') as string) || null;

      if (file && file.size > 0) {
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${unit.id}/${taskId}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from('project-evidence')
          .upload(storagePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          return NextResponse.json(
            { success: false, message: 'File upload failed' },
            { status: 500 }
          );
        }

        const { data: urlData } = supabaseAdmin
          .storage
          .from('project-evidence')
          .getPublicUrl(storagePath);

        evidenceUrl = urlData.publicUrl;
      }
    } else {
      // JSON body for acknowledgment, signature, form
      const body = await request.json().catch(() => ({}));
      notes = body.notes || null;

      if (evidenceType === 'signature' && body.signature_data) {
        // Store signature as a PNG in storage
        const base64 = body.signature_data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64, 'base64');
        const storagePath = `${unit.id}/${taskId}/signature_${Date.now()}.png`;

        const { error: uploadError } = await supabaseAdmin
          .storage
          .from('project-evidence')
          .upload(storagePath, buffer, {
            contentType: 'image/png',
            upsert: false,
          });

        if (uploadError) {
          console.error('Signature upload error:', uploadError);
          return NextResponse.json(
            { success: false, message: 'Signature upload failed' },
            { status: 500 }
          );
        }

        const { data: urlData } = supabaseAdmin
          .storage
          .from('project-evidence')
          .getPublicUrl(storagePath);

        evidenceUrl = urlData.publicUrl;
      }
    }

    // Update task_completions row
    const { error: updateError } = await supabaseAdmin
      .from('task_completions')
      .update({
        status: 'complete',
        completed_by: 'tenant',
        completed_at: new Date().toISOString(),
        evidence_url: evidenceUrl,
        notes: notes,
      })
      .eq('id', completion.id);

    if (updateError) throw updateError;

    // 6. Recompute project_units.overall_status
    const { data: allCompletions, error: allCompError } = await supabaseAdmin
      .from('task_completions')
      .select('status, project_tasks!inner(required)')
      .eq('project_unit_id', unit.id);

    if (allCompError) throw allCompError;

    const requiredCompletions = (allCompletions || []).filter(
      (c: any) => c.project_tasks?.required !== false
    );
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
      .eq('id', unit.id);

    // 7. Return refreshed task list
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
    console.error('Task completion error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
