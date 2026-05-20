/**
 * POST /api/admin/notifications/resend-magic-link
 *
 * Admin-triggered resend of the tenant portal magic link.
 * Body: { application_id: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionUser } from '@/lib/auth';
import { sendTenantNotification } from '@/lib/notifications/send';
import { initNotificationTriggers } from '@/lib/notifications/init';

initNotificationTriggers();

export async function POST(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.application_id) {
    return NextResponse.json({ success: false, message: 'application_id required' }, { status: 400 });
  }

  const { application_id } = body as { application_id: string };

  const { data: app } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('tenant_access_token')
    .eq('id', application_id)
    .maybeSingle();

  if (!app) {
    return NextResponse.json({ success: false, message: 'Application not found' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const portalUrl = `${appUrl}/t/${app.tenant_access_token}`;

  const result = await sendTenantNotification({
    applicationId: application_id,
    notificationType: 'magic_link_resent',
    interpolations: { portal_url: portalUrl },
  });

  if (result.status === 'sent') {
    return NextResponse.json({ success: true, notificationId: result.notificationId });
  }

  const reason = 'reason' in result ? result.reason : 'unknown';
  return NextResponse.json({ success: false, message: reason }, { status: 400 });
}
