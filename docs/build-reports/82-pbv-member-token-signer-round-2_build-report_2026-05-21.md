# PRD-82 — Member-Token Signer Round 2 — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Commit SHA:** (filled by commit step)
**Audit source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (A4, A12)

---

## What changed (files)

| File | Finding | Change |
|---|---|---|
| `app/api/pbv-full-app/signer/[member_token]/route.ts` | A4 | added `packet_locked` to the app select; returns 409 `packet_locked` after the expiry/slot checks and before HOH lookup |
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | A4 | added `packet_locked` to the app select; returns 409 `packet_locked` **before** the `pbv_form_documents` query so a locked packet is never enumerated |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | A4, A12 | added `packet_locked` to the app select; returns 409 `packet_locked` **after** the `submitted_at` check; status mapping now uses `result.errorCode === 'not_found' ? 404 : 422` |
| `lib/pbv/signing/completeForm.ts` | A12 | added `CompleteFormErrorCode` typed union; added optional `errorCode` to `CompleteFormResult`; every error-return branch sets one. `error` string preserved (additive). |
| `lib/pbv/__tests__/prd82-member-token-signer-round-2.test.ts` | A4, A12 | new — Gates 1–6 |

## Path taken (preferred vs. fallback) + why

- **A4 — preferred (per-route inline gate, matching PRD-77's shape).** Each member-token route fetches `packet_locked` on its existing app lookup (no extra round-trip) and returns 409 with the same `code: 'packet_locked'` and a message identical in shape to PRD-77's tenant gate, so the existing tenant client handling carries over.
- **A4 — order per route per the PRD plan:** not-found / expired (existing) → `submitted_at` 409 (existing) → `packet_locked` 409 (new) → handler. On the GET routes (no `submitted_at` check), packet_locked sits between expiry and the handler.
- **A12 — preferred (additive typed errorCode).** Added an optional `errorCode` of a closed union to `CompleteFormResult`; every error branch in `completeFormSigning` sets one (11 codes — enumerated from the existing failure modes, no invented ones). The existing `error` string is preserved verbatim, so PRD-77's tenant `sign-form` route — which uses `.toLowerCase().includes('not found')` — is unaffected and still compiles. The member-token route now maps status from `errorCode === 'not_found'`, and surfaces the code to the client via the response `code` field.
- **Tenant route NOT touched:** per PRD-82 scope guard. The tenant `sign-form` route is owned by PRD-77; switching it to `errorCode` is logged as an optional follow-up (PRD-82 O3 default).

## Static gates

- `node ./node_modules/typescript/bin/tsc --noEmit` → **clean** (no output).
- `npm run build` → **clean** (only pre-existing route warnings unrelated to this PRD).
- `npx vitest run` — `prd82-member-token-signer-round-2.test.ts` **13/13 passed**; existing `completeForm.test.ts` (4/4) and `validateSignFormBody.test.ts` (untouched scope) still pass.

## Gates (PRD-82 plan map)

| Gate | Status | Notes |
|---|---|---|
| G1 (A4 locked) | ✅ static — asserts each route returns 409 `packet_locked` | runtime walk deferred (R1) |
| G2 (A4 select) | ✅ static — asserts each route's app `.select(...)` includes `packet_locked` | |
| G3 (A4 unlocked) | ✅ implicit — gate only fires when `app?.packet_locked` truthy | runtime walk deferred (R1) |
| G4 (A12 not_found) | ✅ static — asserts `result.errorCode === 'not_found'` mapping | |
| G5 (A12 other) | ✅ implicit — 422 falls through; codes for the other 10 failure modes set | |
| G6 (A12 caller-safety) | ✅ tenant route unchanged; existing completeForm test green | |
| G7 (tsc/build/tests) | ✅ all green | |

## Deferred runtime gates (post-run pass)

- **R1:** on a preview deploy: lock a packet via `send-to-hach`, then open a member magic link. Confirm the GET bootstrap, the forms list, and a sign-form POST all return 409 `packet_locked`. Then `reopen` → magic-link signer can view + sign again.
- **R2:** post a sign-form to a missing `form_document_id` → 404 with `code: 'not_found'` and the readable message. Post to a valid id with the signer not in `required_signer_member_ids` → 422 with `code: 'signer_not_required'`.

## OPEN-DECISIONS entries (appended)

- `[PRD-82] Tenant sign-form route NOT migrated to errorCode in this PRD — DECISION` (owned by PRD-77; additive change won't break it; ship the consistency follow-up separately).
- `[PRD-82] CompleteFormErrorCode union — enumerated from existing failure branches — DECISION`.

## Notes / cross-PRD flags

- The `error` string `'Form document not found'` is preserved verbatim in `completeForm.ts`, so PRD-77's tenant route — which still does `.toLowerCase().includes('not found')` — continues to map status correctly. No behavior change for that caller.
- No edits to `validateSignFormBody.ts`, `magicLinkExpiry.ts`, `withTenantContext`, or any tenant route.
- No migrations. `packet_locked` already exists on `pbv_full_applications`.
