import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    // Look up the project_unit by token
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

    // Record view tracking (fire-and-forget, don't block response)
    supabaseAdmin
      .from('project_units')
      .update({
        view_count: (unit.view_count ?? 0) + 1,
        last_viewed_at: new Date().toISOString(),
        ...(unit.first_viewed_at ? {} : { first_viewed_at: new Date().toISOString() }),
      })
      .eq('id', unit.id)
      .then(({ error: viewErr }) => {
        if (viewErr) console.error('View tracking error:', viewErr);
      });

    const project = (unit as any).projects as any;

    // Fetch ordered tasks with completion status for this unit
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
        project_unit_id: unit.id,
        project_name: project?.name ?? null,
        deadline: project?.deadline ?? null,
        sequential: project?.sequential ?? false,
        preferred_language: unit.preferred_language,
        building: unit.building,
        unit_number: unit.unit_number,
        overall_status: unit.overall_status,
        tasks: taskList,
      },
    });
  } catch (error: any) {
    console.error('Token resolution error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
