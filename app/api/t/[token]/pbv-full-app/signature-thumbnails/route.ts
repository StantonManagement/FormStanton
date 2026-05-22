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
    const bucketPrefix = 'pbv-applications/';

    // Guard: only allow paths belonging to this application
    const safePaths = paths.filter((p) => p.startsWith(prefix));

    const urlMap: Record<string, string> = {};

    await Promise.all(
      safePaths.map(async (storagePath) => {
        // PRD-84 #A9: explicit prefix strip. Pre-PRD-84 the call used
        // .replace('pbv-applications/', '') which silently no-ops when a
        // path doesn't start with the bucket prefix — sending the full
        // (wrong) path into createSignedUrl and producing a broken URL
        // with no clear error. The safePaths filter above already
        // requires the per-app prefix, but the strip is now explicit
        // (.startsWith() + .slice(prefix.length)) so a future change
        // can't reintroduce the silent-mismatch failure mode.
        const pathInBucket = storagePath.startsWith(bucketPrefix)
          ? storagePath.slice(bucketPrefix.length)
          : storagePath;

        const { data, error } = await supabaseAdmin.storage
          .from('pbv-applications')
          .createSignedUrl(pathInBucket, SIGNED_URL_TTL_SECONDS);

        if (error || !data?.signedUrl) {
          // Log and omit. Surfacing an entry without a signed URL would
          // let a downstream <img src> render a broken icon.
          console.warn(
            JSON.stringify({
              event: 'signature_thumbnail_signed_url_failed',
              app_id: app.id,
              storage_path: storagePath,
              path_in_bucket: pathInBucket,
              error: error?.message ?? 'no signedUrl in response',
            })
          );
          return;
        }
        urlMap[storagePath] = data.signedUrl;
      })
    );

    return NextResponse.json({ success: true, data: urlMap });
  } catch (error: any) {
    console.error('[signature-thumbnails] Error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
