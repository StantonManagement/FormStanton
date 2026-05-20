/**
 * tests/e2e/helpers/extractMagicLinkFromQueue.ts
 *
 * Extracts the magic link token for a specific household member from either:
 *   (a) the SMS outbox queue table (if Twilio is stubbed and writes to DB)
 *   (b) the pbv_full_applications / pbv_household_members row directly
 *       (used when additional_signer_tokens are stored on the member row)
 *
 * In the test environment Twilio is always stubbed (TWILIO_TEST_MODE=true).
 * The send-link API writes the generated token to pbv_household_members.magic_link_token
 * instead of delivering an SMS.
 */

import { supabaseTestClient } from './supabaseTestClient';

export interface MagicLinkInfo {
  token: string;
  tenantUrl: string;
  memberId: string;
}

/**
 * Polls pbv_household_members for a populated magic_link_token for the
 * member at `slot` in the given application.
 *
 * Falls back to triggering the generate-link endpoint if no token is found
 * within the timeout.
 */
export async function extractMagicLinkFromQueue(
  baseUrl: string,
  applicationId: string,
  memberSlot: number,
  timeoutMs = 10_000
): Promise<MagicLinkInfo> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const { data: member } = await supabaseTestClient
      .from('pbv_household_members')
      .select('id, magic_link_token')
      .eq('full_application_id', applicationId)
      .eq('slot', memberSlot)
      .maybeSingle();

    if (member?.magic_link_token) {
      return {
        token: member.magic_link_token,
        tenantUrl: `${baseUrl}/pbv-full-app/${member.magic_link_token}`,
        memberId: member.id,
      };
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  throw new Error(
    `extractMagicLinkFromQueue: no magic_link_token found for slot ${memberSlot} in app ${applicationId} after ${timeoutMs}ms`
  );
}

/**
 * Triggers the send-additional-signer-link endpoint then polls for the token.
 */
export async function triggerAndExtractMagicLink(
  baseUrl: string,
  token: string,
  applicationId: string,
  memberSlot: number
): Promise<MagicLinkInfo> {
  const res = await fetch(`${baseUrl}/api/t/${token}/pbv-full-app/additional-signers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ member_slot: memberSlot }),
  });

  if (!res.ok && res.status !== 409) {
    const text = await res.text().catch(() => '');
    throw new Error(`triggerAndExtractMagicLink failed ${res.status}: ${text}`);
  }

  return extractMagicLinkFromQueue(baseUrl, applicationId, memberSlot);
}
