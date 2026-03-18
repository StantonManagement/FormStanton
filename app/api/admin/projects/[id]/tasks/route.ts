import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

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
      .from('project_tasks')
      .select('*, task_types(*)')
      .eq('project_id', id)
      .order('order_index', { ascending: true });

    if (error) throw error;

    const tasks = (data || []).map((t: any) => ({
      id: t.id,
      project_id: t.project_id,
      task_type_id: t.task_type_id,
      order_index: t.order_index,
      required: t.required,
      task_type: t.task_types as unknown,
    }));

    return NextResponse.json({ success: true, data: tasks });
  } catch (error: any) {
    console.error('Project tasks fetch error:', error);
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
    const { task_type_id, order_index, required } = body;

    if (!task_type_id || order_index === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: task_type_id, order_index' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('project_tasks')
      .insert({
        project_id: id,
        task_type_id,
        order_index,
        required: required !== false,
      })
      .select('*, task_types(*)')
      .single();

    if (error) throw error;

    const task = {
      id: data.id,
      project_id: data.project_id,
      task_type_id: data.task_type_id,
      order_index: data.order_index,
      required: data.required,
      task_type: (data as any).task_types as unknown,
    };

    return NextResponse.json({ success: true, data: task });
  } catch (error: any) {
    console.error('Project task create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
