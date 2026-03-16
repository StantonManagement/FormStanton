import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { logAudit, getClientIp } from '@/lib/audit';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const building = searchParams.get('building');
    const unit = searchParams.get('unit');

    if (!building || !unit) {
      return NextResponse.json(
        { success: false, message: 'Building address and unit number required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_interactions')
      .select('*')
      .eq('building_address', building)
      .eq('unit_number', unit)
      .eq('is_current', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching interactions:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch interactions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, interactions: data || [] });
  } catch (error: any) {
    console.error('Interactions GET error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch interactions' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ success: false, message: 'Missing interaction ID' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('tenant_interactions')
      .update({ is_current: false })
      .eq('id', id);

    if (error) {
      console.error('Error soft-deleting interaction:', error);
      return NextResponse.json({ success: false, message: 'Failed to delete interaction' }, { status: 500 });
    }

    const sessionUser = await getSessionUser();
    await logAudit(sessionUser, 'interaction.delete', 'tenant_interaction', id, {}, getClientIp(request));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Interactions DELETE error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Failed to delete interaction' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { tenant_name, building_address, unit_number, action_type, action_data, notes } = body;

    // Get identity from session instead of request body
    const sessionUser = await getSessionUser();
    const performedBy = sessionUser?.displayName || body.performed_by || 'Unknown';

    if (!tenant_name || !building_address || !unit_number || !action_type) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_interactions')
      .insert({
        tenant_name,
        building_address,
        unit_number,
        action_type,
        action_data: action_data || {},
        notes: notes || null,
        performed_by: performedBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving interaction:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to save interaction' },
        { status: 500 }
      );
    }

    await logAudit(sessionUser, 'interaction.create', 'tenant_interaction', data?.id, {
      tenant_name, building_address, unit_number, action_type,
    }, getClientIp(request));

    return NextResponse.json({ success: true, interaction: data });
  } catch (error: any) {
    console.error('Interactions POST error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to save interaction' },
      { status: 500 }
    );
  }
}
