/**
 * PRD-78 #8 — magic-link expiry helper.
 *
 * Pre-PRD-78 the two signer routes each hand-rolled `new Date(...) < new Date()`.
 * The audit's concern was robustness/consistency rather than a live bug: the
 * comparison is correct in principle when `magic_link_expires_at` is a
 * Postgres `timestamptz` (which it is — see
 * `supabase/migrations/20260515000000_pbv_form_execution_columns.sql:68`).
 * Confirmed 2026-05-21: column is TIMESTAMPTZ, so a `Date.parse(...)` round-
 * trips as a UTC epoch instant.
 *
 * This helper centralizes the check with an explicit epoch-ms comparison and
 * fail-closed semantics for null / unparseable inputs.
 */
export function isMagicLinkExpired(
  expiresAt: string | null | undefined
): boolean {
  if (!expiresAt) return true;
  const exp = Date.parse(expiresAt);
  if (Number.isNaN(exp)) return true;
  return exp < Date.now();
}
