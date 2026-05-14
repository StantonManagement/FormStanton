import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireStantonStaff } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const guard = await requireStantonStaff();
  if (guard) return guard;

  const { path } = await params;
  const storagePath = path.join('/');

  const { data, error } = await supabaseAdmin.storage
    .from('intake-staging')
    .createSignedUrl(storagePath, 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl, 302);
}
