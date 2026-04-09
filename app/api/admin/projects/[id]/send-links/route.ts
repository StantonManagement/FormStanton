import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { parsePhoneToE164 } from '@/lib/phoneParser';
import { sendPortalSMS, sendPortalEmail } from '@/lib/sendPortalLink';
import { PreferredLanguage } from '@/types/compliance';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

function getPortalUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL || BASE_URL;
  return `${base}/t/${token}`;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const body = await request.json();
    const { unit_ids, method = 'auto' } = body as {
      unit_ids?: string[];
      method?: 'sms' | 'email' | 'auto';
    };

    // 1. Fetch project info
    const { data: project, error: projErr } = await supabaseAdmin
      .from('projects')
      .select('name, deadline, status')
      .eq('id', projectId)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    }

    if (project.status !== 'active') {
      return NextResponse.json({ success: false, message: 'Project must be active to send links' }, { status: 400 });
    }

    // 2. Fetch project_units (optionally filtered by unit_ids)
    let query = supabaseAdmin
      .from('project_units')
      .select('id, building, unit_number, asset_id, tenant_link_token, preferred_language')
      .eq('project_id', projectId);

    if (unit_ids && unit_ids.length > 0) {
      query = query.in('id', unit_ids);
    }

    const { data: units, error: unitsErr } = await query;
    if (unitsErr) throw unitsErr;
    if (!units || units.length === 0) {
      return NextResponse.json({ success: false, message: 'No units found' }, { status: 404 });
    }

    // 3. Batch lookup tenant contacts from tenant_lookup via asset_id
    const unitAssetIds = [...new Set(units.map((u: any) => u.asset_id).filter(Boolean))];

    const { data: tenants, error: tenantErr } = await supabaseAdmin
      .from('tenant_lookup')
      .select('asset_id, unit_number, phone, email, name')
      .in('asset_id', unitAssetIds.length > 0 ? unitAssetIds : ['__none__'])
      .eq('is_current', true);

    if (tenantErr) throw tenantErr;

    // Build lookup map: "asset_id||unit" -> tenant
    const tenantMap = new Map<string, { phone: string | null; email: string | null; name: string | null }>();
    for (const t of (tenants || [])) {
      const key = `${t.asset_id}||${t.unit_number}`;
      tenantMap.set(key, { phone: t.phone, email: t.email, name: t.name });
    }

    // 4. Process in batches of 50
    const results: Array<{
      unit_id: string;
      building: string;
      unit_number: string;
      status: 'sent' | 'failed' | 'no_contact';
      method?: string;
      sent_to?: string;
      error?: string;
    }> = [];

    const BATCH_SIZE = 50;
    const sentBy = 'admin';
    const deadlineStr = project.deadline || null;

    for (let i = 0; i < units.length; i += BATCH_SIZE) {
      const batch = units.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (unit) => {
        const key = `${(unit as any).asset_id}||${unit.unit_number}`;
        const tenant = tenantMap.get(key);

        const rawPhone = tenant?.phone || null;
        const e164Phone = parsePhoneToE164(rawPhone);
        const email = tenant?.email || null;
        const language = (unit.preferred_language || 'en') as PreferredLanguage;
        const portalUrl = getPortalUrl(unit.tenant_link_token);

        // Determine send method
        let chosenMethod: 'sms' | 'email' | null = null;
        let sendTo: string | null = null;

        if (method === 'sms') {
          if (e164Phone) { chosenMethod = 'sms'; sendTo = e164Phone; }
        } else if (method === 'email') {
          if (email) { chosenMethod = 'email'; sendTo = email; }
        } else {
          // auto: prefer SMS, fall back to email
          if (e164Phone) { chosenMethod = 'sms'; sendTo = e164Phone; }
          else if (email) { chosenMethod = 'email'; sendTo = email; }
        }

        if (!chosenMethod || !sendTo) {
          results.push({
            unit_id: unit.id,
            building: unit.building,
            unit_number: unit.unit_number,
            status: 'no_contact',
          });
          return;
        }

        // Send
        const sendResult = chosenMethod === 'sms'
          ? await sendPortalSMS(sendTo, portalUrl, language)
          : await sendPortalEmail(sendTo, portalUrl, language, project.name, deadlineStr);

        // Record in link_deliveries
        await supabaseAdmin.from('link_deliveries').insert({
          project_unit_id: unit.id,
          method: chosenMethod,
          sent_to: sendTo,
          sent_by: sentBy,
          send_error: sendResult.error || null,
        });

        results.push({
          unit_id: unit.id,
          building: unit.building,
          unit_number: unit.unit_number,
          status: sendResult.success ? 'sent' : 'failed',
          method: chosenMethod,
          sent_to: sendTo,
          error: sendResult.error,
        });
      });

      await Promise.all(promises);
    }

    const sent = results.filter((r) => r.status === 'sent').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const noContact = results.filter((r) => r.status === 'no_contact').length;

    return NextResponse.json({
      success: true,
      summary: { sent, failed, no_contact: noContact, total: units.length },
      details: results,
    });
  } catch (error: any) {
    console.error('Send links error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
