import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;

    // Fetch project units for this project
    const { data: units, error: unitsErr } = await supabaseAdmin
      .from('project_units')
      .select('building, unit_number')
      .eq('project_id', projectId);

    if (unitsErr) throw unitsErr;
    if (!units || units.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    // Fetch all current tenants
    const { data: tenants, error: tenantErr } = await supabaseAdmin
      .from('tenant_lookup')
      .select('building_address, unit_number, name, phone, email')
      .eq('is_current', true);

    if (tenantErr) throw tenantErr;

    return NextResponse.json({ success: true, data: tenants || [] });
  } catch (error: any) {
    console.error('Tenant contacts error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
