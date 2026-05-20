/**
 * GET /api/admin/notifications/timeline?application_id=<uuid>
 *
 * Returns tenant_notifications rows for a given application, newest first.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const applicationId = request.nextUrl.searchParams.get('application_id');
  if (!applicationId) {
    return NextResponse.json({ success: false, message: 'application_id required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('tenant_notifications')
    .select('id, notification_type, language, recipient_phone, message_body, delivery_status, delivery_error, created_at, sent_at, delivered_at, twilio_message_sid')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}
