import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';

export async function PATCH(
  _request: NextRequest,
  context: { params: Promise<{ id: string; unitId: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id, unitId } = await context.params;

    // Look up the project to recompute token_expires_at
    const { data: project, error: projectError } = await supabaseAdmin
      .from('projects')
      .select('deadline')
      .eq('id', id)
      .single();

    if (projectError) {
      if (projectError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
      }
      throw projectError;
    }

    let tokenExpiresAt: string | null = null;
    if (project.deadline) {
      const d = new Date(project.deadline);
      d.setDate(d.getDate() + 30);
      tokenExpiresAt = d.toISOString().split('T')[0];
    }

    const { data, error } = await supabaseAdmin
      .from('project_units')
      .update({
        tenant_link_token: generateToken(),
        token_expires_at: tokenExpiresAt,
      })
      .eq('id', unitId)
      .eq('project_id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Project unit not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Token regenerate error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
