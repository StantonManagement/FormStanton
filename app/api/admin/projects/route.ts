import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Projects fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, deadline, sequential, parent_project_id } = body;

    if (!name) {
      return NextResponse.json({ success: false, message: 'Missing required field: name' }, { status: 400 });
    }

    if (parent_project_id) {
      const { data: parent, error: parentErr } = await supabaseAdmin
        .from('projects')
        .select('id')
        .eq('id', parent_project_id)
        .single();
      if (parentErr || !parent) {
        return NextResponse.json({ success: false, message: 'Parent project not found' }, { status: 400 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('projects')
      .insert({
        name,
        description: description || null,
        deadline: deadline || null,
        sequential: sequential === true,
        parent_project_id: parent_project_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Project create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
