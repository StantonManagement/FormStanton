# PRD-77 — Tenant Endpoint Lock & Input Guards — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/77-pbv-tenant-endpoint-lock-and-input-guards_prd_2026-05-21.md`
**Audit findings remediated:** #5 (HIGH), #6 tenant share (HIGH). The member-token share of #6 lands in PRD-78 using the helper this PRD creates.

## Deploy-blocker status

This PRD is **post-launch hardening** (per the batch prompt). The deploy-blocker line was crossed at PRD-76.

## Files changed

**New:**
- `lib/pbv/signing/validateSignFormBody.ts` — shared UUID/enum/presence validator. `requireSignerMemberId: true` for HOH route, `false` for the member-token route (used by PRD-78).
- `lib/pbv/signing/__tests__/validateSignFormBody.test.ts` — 12 tests (valid bodies, each individual failure mode, both `requireSignerMemberId` modes).
- `lib/pbv/__tests__/tenantEndpoint-packet-locked.test.ts` — 7 structural-invariant tests on the helper source.
- `lib/pbv/__tests__/sign-form-input-validation.test.ts` — 5 structural-invariant tests on the HOH route wiring.

**Edited:**
- `lib/pbv/tenantEndpoint.ts` — `TenantApp.packet_locked?: boolean | null`; new `ensurePacketLockedSelected(select)` so `packet_locked` is always fetched regardless of caller select; new 409 `packet_locked` gate AFTER `submitted_locked` and BEFORE `withIdempotency`.
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts` — replaced the inline presence-only check with `validateSignFormBody(body, { requireSignerMemberId: true })`; validation 400 fires BEFORE `withTenantContext` (no DB lookup on malformed input). PRD-64 X-Assisted-By verification + PRD-62 summary gate + custom idempotency key untouched.

## Routes inheriting the central `packet_locked` gate (no edits in this PRD)

All four flow through `withTenantContext` and now 409 `packet_locked` when staff lock the packet:
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts`
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- `app/api/t/[token]/pbv-full-app/finalize/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`

The upload route already had a local `packet_locked` check ([upload/route.ts:40](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:40)); it is now redundant with the wrapper but **left in place** (belt-and-suspenders, per PRD goal #3).

## Path taken — preferred everywhere

- **#5:** preferred path. Centralized in `withTenantContext` with `ensurePacketLockedSelected` so the gate cannot be bypassed by a caller whose select omits the column. Ordering: 404 → submitted_locked 409 → packet_locked 409 → handler.
- **#6:** preferred path. Plain regex/enum validator (O2 default — `zod` is not a project dependency). Validation fires BEFORE `withTenantContext` so a malformed body short-circuits without a DB lookup.

## OPEN-DECISIONS entries added

1. **[PRD-77] Plain UUID/enum validator, no `zod` dependency — DECISION (O2 default).**
2. **[PRD-77] Upload route's local `packet_locked` check left in place — DECISION:** belt-and-suspenders; PRD-77 does not edit PRD-76's file.
3. **[PRD-77] Tenant UI does not differentiate `packet_locked` from `submitted_locked` — DECISION (O1):** same response shape; distinct `message` string; no code-aware UI branch.

## Static gates

| Gate | Result |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean |
| `npx vitest run` on validateSignFormBody + tenantEndpoint-packet-locked + sign-form-input-validation + assisted-by-verify + sign-form-unification | ✅ 33/33 |
| `npm run build` | ✅ Clean |

## Deferred runtime gates (post-run manual pass)

- **R1 (#5):** preview deploy. Lock a packet via the staff `send-to-hach` flow, then attempt:
  - tenant `POST /sign-form` → expect 409 `{ code: 'packet_locked' }`.
  - tenant `POST /generate-forms` → expect 409 `{ code: 'packet_locked' }`.
  - tenant `POST /finalize` → expect 409 `{ code: 'packet_locked' }`.
  - tenant `POST /intake/complete` → expect 409 `{ code: 'packet_locked' }`.
  - tenant `POST /documents/.../upload` → expect 409 (now hit by central gate; local check is now belt-and-suspenders).
  - Then `reopen` and confirm the same calls return 2xx again.
- **R2 (#6 negative):** preview deploy. POST sign-form with a non-UUID `form_document_id` → expect 400 `form_document_id must be a valid UUID`. Repeat for `ceremony_id`, `signer_member_id`. POST with `device_owner: 'staff'` → expect 400 `device_owner is invalid`.
- **R3 (#6 positive):** signing happy path still works end-to-end (regression).

## Notes

- `ensurePacketLockedSelected` tokenizes on commas, dedupes if `packet_locked` is already in the caller's select. The PostgREST select syntax tenant-route callers use today is the simple comma-list form (verified 2026-05-21); if a future caller uses nested embed syntax (`tenant_member(*)`), the dedupe is still correct because `packet_locked` would not collide as a substring of an embed name.
- The validator's UUID regex is the standard variant (`[1-5]` for version digit, `[89ab]` for variant). Postgres `gen_random_uuid()` emits v4 UUIDs, which pass the regex.
