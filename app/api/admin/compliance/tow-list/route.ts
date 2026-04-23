import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';

/**
 * Returns the tow list as CSV for monthly review.
 * Query: ?format=csv (default) returns CSV; otherwise JSON.
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const format = (request.nextUrl.searchParams.get('format') || 'csv').toLowerCase();

    const [{ data: rows, error }, { data: manualRows, error: manualError }] = await Promise.all([
      supabaseAdmin
        .from('submissions')
        .select(
          `id, full_name, building_address, unit_number, vehicle_plate, vehicle_make, vehicle_model, vehicle_year, vehicle_color,
           permit_revoked_reason, permit_revoked_notes, permit_revoked_at, permit_revoked_by, tow_flagged, towed_at`
        )
        .is('merged_into', null)
        .eq('tow_flagged', true)
        .is('towed_at', null)
        .order('permit_revoked_at', { ascending: true }),
      supabaseAdmin
        .from('tow_manual_entries')
        .select('*')
        .is('towed_at', null)
        .is('cleared_at', null)
        .order('added_at', { ascending: true }),
    ]);

    if (error) {
      console.error('tow-list error:', error);
      return NextResponse.json({ success: false, message: 'Failed to load tow list' }, { status: 500 });
    }
    if (manualError) {
      console.error('tow-list manual error:', manualError);
    }

    if (format === 'json') {
      return NextResponse.json({ success: true, rows, manual_rows: manualRows || [] });
    }

    // CSV output
    const header = [
      'Source',
      'Plate',
      'Year',
      'Make',
      'Model',
      'Color',
      'Building',
      'Unit',
      'Former Tenant',
      'Reason',
      'Flagged At',
      'Flagged By',
      'Notes',
    ];

    const esc = (v: any): string => {
      const s = v == null ? '' : String(v);
      if (s.includes('"') || s.includes(',') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const lines = [header.join(',')];
    for (const r of rows || []) {
      lines.push(
        [
          esc('permit'),
          esc(r.vehicle_plate),
          esc(r.vehicle_year),
          esc(r.vehicle_make),
          esc(r.vehicle_model),
          esc(r.vehicle_color),
          esc(r.building_address),
          esc(r.unit_number),
          esc(r.full_name),
          esc(r.permit_revoked_reason),
          esc(r.permit_revoked_at),
          esc(r.permit_revoked_by),
          esc(r.permit_revoked_notes),
        ].join(',')
      );
    }
    for (const r of manualRows || []) {
      lines.push(
        [
          esc(r.source === 'submission_search' ? 'manual (from submission)' : 'manual'),
          esc(r.vehicle_plate),
          esc(r.vehicle_year),
          esc(r.vehicle_make),
          esc(r.vehicle_model),
          esc(r.vehicle_color),
          esc(r.building_address),
          esc(r.unit_number),
          esc(r.tenant_name),
          esc(r.reason),
          esc(r.added_at),
          esc(r.added_by),
          esc(r.notes),
        ].join(',')
      );
    }

    const csv = lines.join('\n');
    const today = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="tow-list-${today}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('tow-list exception:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Failed to export tow list' },
      { status: 500 }
    );
  }
}
