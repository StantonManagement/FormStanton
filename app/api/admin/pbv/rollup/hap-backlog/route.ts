/**
 * GET /api/admin/pbv/rollup/hap-backlog
 *
 * Returns applications HACH-approved more than 7 days ago but not yet executed.
 * For the workforce dashboard HAP execution backlog panel.
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    // Calculate 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find applications approved by HACH more than 7 days ago
    // that don't have an executed signing packet
    const { data: applications, error } = await supabaseAdmin
      .from('pbv_full_applications')
      .select(`
        id,
        head_of_household_name,
        building_address,
        unit_number,
        hach_review_status,
        updated_at,
        signing_packets!left (
          id,
          executed_at
        )
      `)
      .eq('hach_review_status', 'approved_by_hach')
      .lt('updated_at', sevenDaysAgo.toISOString())
      .order('updated_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch backlog: ${error.message}`);
    }

    // Filter to only those without executed packets
    const backlog = (applications || [])
      .filter((app: any) => {
        const packet = app.signing_packets?.[0];
        return !packet || !packet.executed_at;
      })
      .map((app: any) => ({
        id: app.id,
        head_of_household_name: app.head_of_household_name,
        building_address: app.building_address,
        unit_number: app.unit_number,
        days_since_approval: Math.floor(
          (Date.now() - new Date(app.updated_at).getTime()) / (1000 * 60 * 60 * 24)
        ),
      }));

    return NextResponse.json({
      success: true,
      data: backlog,
      count: backlog.length,
    });

  } catch (error: any) {
    console.error('[hap-backlog GET] error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
