# PRD-78 — Magic-Link Signer Route Hardening — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/78-pbv-magic-link-signer-route-hardening_prd_2026-05-21.md`
**Audit findings remediated:** #8 (MEDIUM, both signer routes); #6 member-route share (HIGH).

## Deploy-blocker status

Post-launch hardening. The deploy-blocker line was crossed at PRD-76.

## Files changed

**New:**
- `lib/pbv/magicLinkExpiry.ts` — `isMagicLinkExpired(expiresAt)` epoch-based helper. Fails closed on null/undefined/empty/unparseable.
- `lib/pbv/__tests__/magicLinkExpiry.test.ts` — 7 tests including future/past/null/garbage/`+00:00` PostgREST tz format.
- `lib/pbv/__tests__/signer-routes-hardening.test.ts` — 12 structural-invariant tests across both signer routes.

**Edited:**
- `app/api/pbv-full-app/signer/[member_token]/route.ts` — imports `isMagicLinkExpired`; replaced inline `const now = new Date(); … new Date(expires) < now` with helper call. 410 `expired` shape unchanged.
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` — imports `isMagicLinkExpired` AND `validateSignFormBody`; replaced inline expiry comparison with helper call; replaced presence-only body check with `validateSignFormBody(body, { requireSignerMemberId: false })`. Order: 404 → 410 expired → 400 invalid body → 409 submitted_locked → `completeFormSigning`.

**No migration written** — `magic_link_expires_at` is already `TIMESTAMPTZ` (confirmed via `supabase/migrations/20260515000000_pbv_form_execution_columns.sql:68`), so the audit's #8 is consistency hardening rather than a type fix.

## Path taken — preferred everywhere

- **#8 (helper):** preferred. Single epoch-ms comparison, fail-closed on null/unparseable, used by both signer routes.
- **#8 (column type):** preferred — confirmed `TIMESTAMPTZ` in committed migration; no type-conversion migration needed.
- **#6 (member route):** preferred. Reuses PRD-77's `validateSignFormBody` with `{ requireSignerMemberId: false }`. No `device_owner` enum check applies on this route (hard-coded `'self'`).

## OPEN-DECISIONS entries added

1. **[PRD-78] `magic_link_expires_at` is already TIMESTAMPTZ — DECISION (O1 confirmed).**
2. **[PRD-78] No type-conversion migration written — DECISION.**

## Static gates

| Gate | Result |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean |
| `npx vitest run` on magicLinkExpiry + signer-routes-hardening | ✅ 19/19 |
| `npm run build` | ✅ Clean |

## Deferred runtime gates (post-run manual pass)

- **R1 (#8 expired):** preview deploy. Mint a member magic link, manually expire it (set `magic_link_expires_at` to a past TIMESTAMPTZ), open it → 410 `expired` on both GET and POST.
- **R2 (#8 valid):** preview deploy. Mint a fresh member magic link → signer page loads, a form can be signed.
- **R3 (#6 member):** preview deploy. POST signer sign-form with a non-UUID `form_document_id` → 400 `form_document_id must be a valid UUID`. Repeat for `ceremony_id`.

## Notes

- The bootstrap GET sets 404 for "link not found" with `code: 'not_found'`; the sign-form POST sets 404 without a code. Left both unchanged (matches the pre-PRD-78 shape; introducing the code on the sign-form route is a separate API-shape decision and out of lane).
- PRD-77's helper handles both routes' shapes via the `requireSignerMemberId` flag; PRD-78 simply applies it. No new validation logic was needed here.
