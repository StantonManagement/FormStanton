import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

/**
 * GET /api/admin/pbv/appfolio-queue
 * Returns rows from the appfolio_update_queue view.
 * Sorted by confirmed_at DESC.
 */
export async function GET(_request: NextRequest) {
  try {
    const { data, error } = await supabaseAdmin
      .from('appfolio_update_queue')
      .select('*')
      .order('confirmed_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (error: any) {
    console.error('[pbv/appfolio-queue] error:', error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
