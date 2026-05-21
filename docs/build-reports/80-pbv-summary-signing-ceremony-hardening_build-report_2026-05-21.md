# PRD-80 — Summary-Signing Ceremony Hardening — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Commit SHA:** `400c81f`
**Audit source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (A1, A5, A6)

---

## What changed (files)

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | A1, A5 | mirror PRD-64's `getSession()` assisted-by check; UUID/enum input validation → 400 |
| `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` | A6 | UUID guard on `signer_member_id` (required) and `ceremony_id` (when supplied) → 400 |
| `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` | A6 (analogue) | UUID guard on `ceremony_id` when supplied (signer_member_id is derived from the token) |
| `lib/pbv/__tests__/prd80-sign-summary-hardening.test.ts` | A1, A5, A6 | new — Gates 1–5 |

## Path taken (preferred vs. fallback) + why

- **A1 — preferred path taken:** mirrored the `sign-form` (PRD-64) block exactly — `getSession()` → `session.assistedMode` → require `staffUserId === header` **and** `applicationId === app.id`; fail-closed 401 `assisted_session_unverified` with a `console.warn` audit log of the attempt. Same shape, same code, same status.
- **A5 — preferred path taken:** reused the shared `isUuid` primitive from `lib/pbv/signing/validateSignFormBody.ts` (PRD-77) — no new regex, no `zod` dependency.
- **A6 — preferred path taken:** same `isUuid` import on both `signature/capture` routes. On the tenant route both `signer_member_id` (required) and `ceremony_id` (optional) are validated. On the member-token route only `ceremony_id` is validated because `signer_member_id` is derived from the magic-link token, not body-supplied — see OPEN-DECISIONS entry below.
- **`template_version` validation (A5):** the field is a free-form date-like string (default `'2026-05-15-v1'`); validated only as a non-empty string. Logged as a default in OPEN-DECISIONS (O2).

## Static gates

- `node ./node_modules/typescript/bin/tsc --noEmit` → **clean** (no output).
- `npm run build` → **clean** (only the two pre-existing route warnings unrelated to this PRD).
- `npx vitest run lib/pbv/__tests__/prd80-sign-summary-hardening.test.ts` → **16/16 passed**.

## Gates (PRD-80 plan map)

| Gate | Status | Notes |
|---|---|---|
| G1 (A1 spoof) | ✅ static — asserts no `admin_users` lookup after `assistedByHeader`; asserts `assisted_session_unverified` + 401 in source | Runtime walk deferred (R1) |
| G2 (A1 valid assisted) | ✅ static — asserts both `staffUserId === header` and `applicationId === app.id` matchers | Runtime walk deferred (R1) |
| G3 (A1 no header) | ✅ static — asserts `let assistedByStaffUserId: string \| null = null` + `if (assistedByHeader)` gating | Runtime walk deferred (R1) |
| G4 (A5) | ✅ static + primitive | `ceremony_id` UUID, `language` ∈ {en, es, pt}, `template_version` non-empty |
| G5 (A6) | ✅ static + primitive | tenant: `signer_member_id` + optional `ceremony_id`; member: optional `ceremony_id` only |
| G6 (tsc/build/tests) | ✅ all green | |

## Deferred runtime gates (post-run pass)

- **R1:** on a deployed build, walk an assisted summary signature with a valid staff cookie → attributed; replay with a forged `X-Assisted-By` (a real admin id, no session cookie) → 401 `assisted_session_unverified`; replay with valid cookie but mismatched `applicationId` → 401. Confirm the `assisted_by_unverified` warn is emitted.
- **R2:** confirm the corrected (single-wrap) `signature/capture` still returns `data.signature_image_path` and that summary + forms signing walk to completion (regression check against the prior double-wrap fix). Repeat on the member-token `signature/capture` for non-HOH adults.
- **R3:** post invalid inputs to `sign-summary` (`ceremony_id='1234'`, `language='fr'`, `template_version=''`) → 400 with the expected message; and to `signature/capture` (`signer_member_id='no'`) → 400.

## OPEN-DECISIONS entries (appended)

- `[PRD-80] template_version validation shape — DECISION` (non-empty string default; needs Alex's confirmation if format ever locks down).
- `[PRD-80] Member-token signature/capture body shape — DECISION` (signer_member_id is derived from the magic-link token, only ceremony_id required UUID guard; logged so Alex knows the gap was *checked*, not skipped).

## Notes / cross-PRD flags

- No prior-batch file was reverted. The `signature/capture` (tenant) handler is still the single-wrap `withTenantContext`-only version produced by the double-wrap fix; PRD-80 layered the UUID validation **inside** that handler without re-introducing the outer `withIdempotency`.
- `isUuid` is the same primitive used by PRD-77's `validateSignFormBody`; both ceremonies now share one regex source.
- No migrations.
