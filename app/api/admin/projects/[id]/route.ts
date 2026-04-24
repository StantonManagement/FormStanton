import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

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

    const { data: tasks, error: tasksError } = await supabaseAdmin
      .from('project_tasks')
      .select('*, task_types(*)')
      .eq('project_id', id)
      .order('order_index', { ascending: true });

    if (tasksError) throw tasksError;

    const { count, error: countError } = await supabaseAdmin
      .from('project_units')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id);

    if (countError) throw countError;

    return NextResponse.json({
      success: true,
      data: {
        ...project,
        tasks: (tasks || []).map((t: any) => ({
          id: t.id,
          project_id: t.project_id,
          task_type_id: t.task_type_id,
          order_index: t.order_index,
          required: t.required,
          parent_task_id: t.parent_task_id || null,
          task_type: t.task_types as unknown,
        })),
        unit_count: count || 0,
      },
    });
  } catch (error: any) {
    console.error('Project fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;

    const { error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Collect unit IDs for cascade
    const { data: units, error: unitFetchError } = await supabaseAdmin
      .from('project_units')
      .select('id')
      .eq('project_id', id);

    if (unitFetchError) throw unitFetchError;

    const unitIds = (units || []).map((u: any) => u.id);

    if (unitIds.length > 0) {
      const { error: tcError } = await supabaseAdmin
        .from('task_completions')
        .delete()
        .in('project_unit_id', unitIds);
      if (tcError) throw tcError;

      // Unlink pbv_preapplications rather than delete them
      const { error: pbvError } = await supabaseAdmin
        .from('pbv_preapplications')
        .update({ project_unit_id: null })
        .in('project_unit_id', unitIds);
      if (pbvError) throw pbvError;
    }

    const { error: unitsError } = await supabaseAdmin
      .from('project_units')
      .delete()
      .eq('project_id', id);
    if (unitsError) throw unitsError;

    const { error: tasksError } = await supabaseAdmin
      .from('project_tasks')
      .delete()
      .eq('project_id', id);
    if (tasksError) throw tasksError;

    const { error: deleteError } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', id);
    if (deleteError) throw deleteError;

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'project.delete', 'project', id, {}, getClientIp(_request));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Project delete error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(
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

    const allowed: Record<string, any> = {};
    if (body.name !== undefined) allowed.name = body.name;
    if (body.description !== undefined) allowed.description = body.description;
    if (body.deadline !== undefined) allowed.deadline = body.deadline || null;
    if (body.status !== undefined) {
      const validStatuses = ['draft', 'active', 'closed'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 });
      }
      allowed.status = body.status;
    }
    if (body.sequential !== undefined) allowed.sequential = body.sequential === true;
    if (body.parent_project_id !== undefined) allowed.parent_project_id = body.parent_project_id || null;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ success: false, message: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .update(allowed)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw error;
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'project.update', 'project', id, { updatedFields: Object.keys(allowed) }, getClientIp(request));

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Project update error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
