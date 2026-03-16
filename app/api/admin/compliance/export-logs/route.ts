import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const { data, error } = await supabaseAdmin
      .from('vehicle_export_logs')
      .select('*')
      .order('exported_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching export logs:', error);
      return NextResponse.json(
        { success: false, message: 'Failed to fetch export logs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error: any) {
    console.error('Export logs error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to fetch export logs' },
      { status: 500 }
    );
  }
}
