import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * Typeahead search for submissions that can be added to the tow list.
 * Returns submissions that have a vehicle plate, are not already tow_flagged,
 * not already towed, and not merged.
 * Query param: ?q=<search term>
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const q = (request.nextUrl.searchParams.get('q') || '').trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ success: true, rows: [] });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('submissions')
      .select(
        'id, full_name, unit_number, building_address, vehicle_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color'
      )
      .is('merged_into', null)
      .eq('tow_flagged', false)
      .is('towed_at', null)
      .not('vehicle_plate', 'is', null)
      .or(`full_name.ilike.%${q}%,vehicle_plate.ilike.%${q}%,unit_number.ilike.%${q}%,building_address.ilike.%${q}%`)
      .limit(20);

    if (error) {
      console.error('submission-search error:', error);
      return NextResponse.json({ success: false, message: 'Search failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rows: rows || [] });
  } catch (error: any) {
    console.error('submission-search exception:', error);
    return NextResponse.json({ success: false, message: error.message || 'Search failed' }, { status: 500 });
  }
}
