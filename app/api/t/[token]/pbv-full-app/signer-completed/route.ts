import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  writePbvApplicationEvent,
  ApplicationEventType,
} from '@/lib/events/application-events';

export async function POST(
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

    const body = await request.json().catch(() => null);
    if (!body?.signer_id || !body?.name || body?.slot == null) {
      return NextResponse.json(
        { success: false, message: 'signer_id, name, and slot required' },
        { status: 400 }
      );
    }

    const { signer_id, slot, name } = body as {
      signer_id: string;
      slot: number;
      name: string;
    };

    // Idempotency: only write if no existing event for this signer on this application
    const { data: existing } = await supabaseAdmin
      .from('application_events')
      .select('id')
      .eq('anchor_type', 'pbv_full_application')
      .eq('anchor_id', app.id)
      .eq('event_type', ApplicationEventType.TENANT_SIGNER_COMPLETED)
      .contains('payload', { signer_id })
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, data: { already_recorded: true } });
    }

    const completed_at = new Date().toISOString();

    await writePbvApplicationEvent({
      applicationId: app.id,
      eventType: ApplicationEventType.TENANT_SIGNER_COMPLETED,
      actorUserId: null,
      actorDisplayName: name,
      payload: { signer_id, slot, name, completed_at },
    });

    return NextResponse.json({ success: true, data: { already_recorded: false } });
  } catch (error: any) {
    console.error('[signer-completed] Unexpected error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error', code: 'server_error' }, { status: 500 });
  }
}
