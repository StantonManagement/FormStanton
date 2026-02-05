import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
  try {
    const authenticated = await isAuthenticated();
    
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('submissions')
      .select('building_address')
      .not('building_address', 'is', null);

    if (error) throw error;

    const uniqueBuildings = [...new Set(data.map(item => item.building_address))].sort();

    return NextResponse.json({ success: true, data: uniqueBuildings });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
