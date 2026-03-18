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
      .from('task_types')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Task types fetch error:', error);
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
    const { name, description, assignee, evidence_type, form_id, instructions } = body;

    if (!name || !assignee || !evidence_type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: name, assignee, evidence_type' },
        { status: 400 }
      );
    }

    const validAssignees = ['tenant', 'staff'];
    if (!validAssignees.includes(assignee)) {
      return NextResponse.json({ success: false, message: 'Invalid assignee' }, { status: 400 });
    }

    const validEvidenceTypes = ['form', 'file_upload', 'photo', 'signature', 'acknowledgment', 'staff_check'];
    if (!validEvidenceTypes.includes(evidence_type)) {
      return NextResponse.json({ success: false, message: 'Invalid evidence_type' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('task_types')
      .insert({
        name,
        description: description || null,
        assignee,
        evidence_type,
        form_id: form_id || null,
        instructions: instructions || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Task type create error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
