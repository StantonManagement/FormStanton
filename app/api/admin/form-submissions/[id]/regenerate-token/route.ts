import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated, getSessionUser } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';
import { generateToken } from '@/lib/generateToken';
import { logAudit, getClientIp } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authenticated = await isAuthenticated();
    if (!authenticated) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const sessionUser = await getSessionUser();
    const { id } = await params;

    const { data: submission, error: fetchError } = await supabaseAdmin
      .from('form_submissions')
      .select('id, review_granularity')
      .eq('id', id)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json({ success: false, message: 'Submission not found' }, { status: 404 });
    }

    if (submission.review_granularity !== 'per_document') {
      return NextResponse.json(
        { success: false, message: 'tenant_access_token only applies to per_document submissions' },
        { status: 400 }
      );
    }

    const newToken = generateToken();

    const { data, error: updateError } = await supabaseAdmin
      .from('form_submissions')
      .update({ tenant_access_token: newToken })
      .eq('id', id)
      .select('id, tenant_access_token')
      .single();

    if (updateError) throw updateError;

    await logAudit(
      sessionUser,
      'submission.regenerate_token',
      'form_submission',
      id,
      {},
      getClientIp(request)
    );

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Token regeneration error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
