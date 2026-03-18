import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const profiles: {
      building: string;
      unit_number: string;
      preferred_language: string;
      tenant_name: string | null;
    }[] = body.profiles;

    if (!Array.isArray(profiles) || profiles.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Request body must include a non-empty profiles array' },
        { status: 400 }
      );
    }

    const validLanguages = ['en', 'es', 'pt'];
    const rows = profiles.map((p) => ({
      building: p.building,
      unit_number: p.unit_number,
      preferred_language: validLanguages.includes(p.preferred_language) ? p.preferred_language : 'en',
      tenant_name: p.tenant_name || null,
      last_synced_at: new Date().toISOString(),
    }));

    const { data, error } = await supabaseAdmin
      .from('tenant_profiles')
      .upsert(rows, { onConflict: 'building,unit_number' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: { synced: (data || []).length },
    });
  } catch (error: any) {
    console.error('Tenant profiles sync error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
