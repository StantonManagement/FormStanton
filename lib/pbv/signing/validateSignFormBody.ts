/**
 * PRD-77 #6 (tenant) — shared validator for the sign-form request body.
 *
 * Used by:
 *   - app/api/t/[token]/pbv-full-app/sign-form/route.ts (HOH path, requireSignerMemberId: true)
 *   - app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts (member path,
 *     requireSignerMemberId: false — signer is derived from the magic-link token)
 *     [PRD-78 applies this validator to that route.]
 *
 * Pre-PRD-77 each route only checked presence (truthiness). Invalid UUIDs
 * propagated to Supabase and surfaced as opaque DB errors; a crafted
 * `device_owner` value was caught only by the `pbv_signature_events`
 * CHECK constraint, after a DB round-trip. This validator rejects both
 * with a clean 400 BEFORE any DB work.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DEVICE_OWNERS = ['self', 'hoh_device', 'staff_assisted'] as const;
export type DeviceOwner = (typeof DEVICE_OWNERS)[number];

export type ValidateSignFormBodyOpts = {
  /** HOH route passes a UUID body field; member-token route derives it from
   *  the token and does not include `signer_member_id` in the body. */
  requireSignerMemberId: boolean;
};

export type ValidateSignFormBodyResult =
  | { ok: true }
  | { ok: false; message: string };

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function validateSignFormBody(
  body: any,
  opts: ValidateSignFormBodyOpts
): ValidateSignFormBodyResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, message: 'Missing request body' };
  }

  if (!isUuid(body.form_document_id)) {
    return { ok: false, message: 'form_document_id must be a valid UUID' };
  }

  if (!isUuid(body.ceremony_id)) {
    return { ok: false, message: 'ceremony_id must be a valid UUID' };
  }

  if (opts.requireSignerMemberId && !isUuid(body.signer_member_id)) {
    return { ok: false, message: 'signer_member_id must be a valid UUID' };
  }

  if (typeof body.typed_name !== 'string' || !body.typed_name.trim()) {
    return { ok: false, message: 'typed_name is required' };
  }

  if (
    typeof body.signature_image_path !== 'string' ||
    !body.signature_image_path.trim()
  ) {
    return { ok: false, message: 'signature_image_path is required' };
  }

  if (
    body.device_owner !== undefined &&
    !DEVICE_OWNERS.includes(body.device_owner)
  ) {
    return { ok: false, message: 'device_owner is invalid' };
  }

  return { ok: true };
}
