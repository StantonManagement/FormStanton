import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 120;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const { data: app, error: appError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('id')
      .eq('tenant_access_token', token)
      .maybeSingle();

    if (appError) throw appError;
    if (!app) {
      return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
    }

    const pathsParam = request.nextUrl.searchParams.get('paths');
    if (!pathsParam) {
      return NextResponse.json({ success: true, data: {} });
    }

    const paths = pathsParam.split(',').filter(Boolean);
    const prefix = `pbv-applications/${app.id}/`;

    // Guard: only allow paths belonging to this application
    const safePaths = paths.filter((p) => p.startsWith(prefix));

    const urlMap: Record<string, string> = {};

    await Promise.all(
      safePaths.map(async (storagePath) => {
        const { data, error } = await supabaseAdmin.storage
          .from('pbv-applications')
          .createSignedUrl(storagePath.replace('pbv-applications/', ''), SIGNED_URL_TTL_SECONDS);

        if (!error && data?.signedUrl) {
          urlMap[storagePath] = data.signedUrl;
        }
      })
    );

    return NextResponse.json({ success: true, data: urlMap });
  } catch (error: any) {
    console.error('[signature-thumbnails] Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
