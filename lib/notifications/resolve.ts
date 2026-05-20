/**
 * resolve.ts
 *
 * Single source of truth for resolving a tenant's phone number and preferred
 * language from a pbv_full_applications row.
 *
 * Resolution order for phone:
 *   1. pbv_full_applications.phone  (set by tenant during intake)
 *   2. tenant_lookup.phone           (AppFolio sync — read-only hint)
 *
 * Resolution order for language:
 *   1. pbv_full_applications.preferred_language (confirmed by tenant)
 *   2. 'en' (safe default)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { parsePhoneToE164 } from '@/lib/phoneParser';

export type SupportedLanguage = 'en' | 'es' | 'pt';

export interface ResolvedTenant {
  phone: string;
  email: string | null;
  language: SupportedLanguage;
  optedOut: boolean;
}

export type ResolveResult =
  | { ok: true; tenant: ResolvedTenant }
  | { ok: false; reason: 'application_not_found' | 'missing_phone' | 'invalid_phone' };

export async function resolveTenant(applicationId: string): Promise<ResolveResult> {
  const { data: app, error } = await supabaseAdmin
    .from('pbv_full_applications')
    .select('id, phone, email, preferred_language, building_address, unit_number, sms_opted_out_at')
    .eq('id', applicationId)
    .maybeSingle();

  if (error || !app) {
    return { ok: false, reason: 'application_not_found' };
  }

  let rawPhone: string | null = app.phone ?? null;

  if (!rawPhone) {
    const { data: tl } = await supabaseAdmin
      .from('tenant_lookup')
      .select('phone')
      .eq('building_address', app.building_address)
      .eq('unit_number', app.unit_number)
      .eq('is_current', true)
      .maybeSingle();
    rawPhone = tl?.phone ?? null;
  }

  if (!rawPhone) {
    return { ok: false, reason: 'missing_phone' };
  }

  const e164 = parsePhoneToE164(rawPhone);
  if (!e164) {
    return { ok: false, reason: 'invalid_phone' };
  }

  const lang: SupportedLanguage = (['en', 'es', 'pt'].includes(app.preferred_language ?? '')
    ? (app.preferred_language as SupportedLanguage)
    : 'en');

  return {
    ok: true,
    tenant: {
      phone: e164,
      email: app.email ?? null,
      language: lang,
      optedOut: app.sms_opted_out_at != null,
    },
  };
}
