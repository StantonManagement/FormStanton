import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { generateShortToken } from '@/lib/generateToken';
import { buildingUnitSlug } from '@/lib/buildingSlug';
import { getPortalBaseUrl } from '@/lib/urls';

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
      .select('id, intake_submitted_at, building_address, unit_number')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }
    if (existing.intake_submitted_at) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Cannot regenerate the invite link after the tenant has submitted their intake form. Use the document portal link instead.',
        },
        { status: 400 }
      );
    }

    // Block if documents have already been uploaded — the old token is embedded
    // in the document portal link that the tenant may already be using.
    {
      const { count } = await supabaseAdmin
        .from('application_documents')
        .select('id', { count: 'exact', head: true })
        .eq('anchor_type', 'pbv_full_application')
        .eq('anchor_id', id)
        .gt('revision', 0);
      if ((count ?? 0) > 0) {
        return NextResponse.json(
          {
            success: false,
            message:
              'Cannot regenerate the invite link — the tenant has already uploaded documents. Use the document portal link instead.',
          },
          { status: 400 }
        );
      }
    }

    const slug = buildingUnitSlug(
      (existing.building_address ?? '').trim(),
      (existing.unit_number ?? '').trim()
    );
    const newToken = `${slug}-${generateShortToken()}`;
    const { error } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ tenant_access_token: newToken })
      .eq('id', id);

    if (error) throw error;

    const magicLink = `${getPortalBaseUrl()}/pbv-full-app/${newToken}`;
    return NextResponse.json({ success: true, data: { tenant_access_token: newToken, magic_link: magicLink } });
  } catch (error: any) {
    console.error('PATCH /api/admin/pbv/full-applications/[id]/token error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
