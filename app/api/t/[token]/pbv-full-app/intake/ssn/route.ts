/**
 * POST /api/t/[token]/pbv-full-app/intake/ssn
 *
 * Encrypts a member's full SSN server-side and stores the ciphertext in
 * intake_data.ssn_vault[slot]. This keeps the plaintext full SSN out of the
 * autosaved `household` section payload (and therefore out of intake_data /
 * intake_snapshot as plaintext) while still letting the completion bridge seed
 * pbv_household_members.ssn_encrypted.
 *
 * Body: { slot: number, ssn?: string }
 *   - ssn is a full 9-digit SSN  -> encrypt, store { enc, last4 }
 *   - ssn is exactly 4 digits    -> store last-4 only ({ last4 }, no enc)
 *   - ssn empty / omitted        -> clear the vault entry for that slot
 *
 * Response: { success, data: { slot, last4, has_full } } — NEVER echoes the full SSN.
 *
 * The ssn_vault key is intentionally separate from `household` so the generic
 * section autosave (which does intake_data.household = sectionData) never clobbers it.
 */

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { withTenantContext } from '@/lib/pbv/tenantEndpoint';
import { encryptSsn } from '@/lib/ssnEncryption';
import { normalizeSsn, isValidSsn, isLastFourOnly } from '@/lib/pbv/ssnValidation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  return withTenantContext(request, token, 'intake-ssn', async (app) => {
    const body = await request.json().catch(() => null);
    const slot = body?.slot;
    if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 1) {
      return { body: { success: false, message: 'slot must be a positive integer' }, status: 400 };
    }

    const raw = typeof body?.ssn === 'string' ? body.ssn : '';
    const digits = normalizeSsn(raw);

    // Build the new vault entry (or null to clear).
    let entry: { enc: string; last4: string } | null = null;
    if (digits.length === 0) {
      entry = null; // clear
    } else if (isValidSsn(digits)) {
      entry = { enc: encryptSsn(digits), last4: digits.slice(-4) };
    } else if (isLastFourOnly(digits)) {
      entry = { enc: '', last4: digits }; // last-4 only; no ciphertext
    } else {
      return {
        body: { success: false, message: 'Enter a valid 9-digit SSN or exactly the last 4 digits' },
        status: 400,
      };
    }

    // Merge into intake_data.ssn_vault without disturbing other keys/slots.
    const { data: current, error: readError } = await supabaseAdmin
      .from('pbv_full_applications')
      .select('intake_data')
      .eq('id', app.id)
      .maybeSingle();
    if (readError) throw readError;

    const intakeData = (current?.intake_data as Record<string, unknown>) ?? {};
    const vault = { ...((intakeData.ssn_vault as Record<string, unknown>) ?? {}) };
    if (entry) {
      vault[slot] = entry;
    } else {
      delete vault[slot];
    }

    const merged = {
      ...intakeData,
      ssn_vault: vault,
      _last_saved_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabaseAdmin
      .from('pbv_full_applications')
      .update({ intake_data: merged, updated_at: new Date().toISOString() })
      .eq('id', app.id);
    if (updateError) throw updateError;

    return {
      body: {
        success: true,
        data: { slot, last4: entry?.last4 ?? null, has_full: !!entry?.enc },
      },
      status: 200,
    };
  });
}
