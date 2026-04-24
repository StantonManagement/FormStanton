import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { generateToken } from '@/lib/generateToken';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: existing } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id, intake_submitted_at')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    if (existing.intake_submitted_at) {
      return NextResponse.json(
        { success: false, message: 'Cannot regenerate token after intake has been submitted' },
        { status: 400 }
      );
    }

    const newToken = generateToken();
    const { error } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ tenant_access_token: newToken })
      .eq('id', id);

    if (error) throw error;

    const magicLink = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/pbv-full-app/${newToken}`;
    return NextResponse.json({ success: true, data: { tenant_access_token: newToken, magic_link: magicLink } });
  } catch (error: any) {
    console.error('PATCH /api/admin/pbv/full-applications/[id]/token error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
