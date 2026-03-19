import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    // Get all project_unit IDs for this project
    const { data: units, error: unitsErr } = await supabaseAdmin
      .from('project_units')
      .select('id')
      .eq('project_id', projectId);

    if (unitsErr) throw unitsErr;
    if (!units || units.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const unitIds = units.map((u) => u.id);

    // Fetch all deliveries for these units, ordered by sent_at desc
    const { data: deliveries, error: delErr } = await supabaseAdmin
      .from('link_deliveries')
      .select('*')
      .in('project_unit_id', unitIds)
      .order('sent_at', { ascending: false });

    if (delErr) throw delErr;

    return NextResponse.json({ success: true, data: deliveries || [] });
  } catch (error: any) {
    console.error('Deliveries fetch error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
