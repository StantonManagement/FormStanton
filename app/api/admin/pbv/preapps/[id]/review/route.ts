import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, message: 'Invalid request body' }, { status: 400 });
    }

    const { action, notes, reviewer } = body;

    if (!action || !['approved', 'denied', 'needs_info'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'action must be one of: approved, denied, needs_info' },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('pbv_preapplications')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
      }
      throw fetchError;
    }

    const { data, error } = await supabaseAdmin
      .from('pbv_preapplications')
      .update({
        stanton_review_status: action,
        stanton_reviewer: reviewer || 'staff',
        stanton_review_date: new Date().toISOString(),
        stanton_review_notes: notes?.trim() || null,
      })
      .eq('id', existing.id)
      .select('id, stanton_review_status, stanton_reviewer, stanton_review_date, stanton_review_notes')
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('PBV preapp review error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
