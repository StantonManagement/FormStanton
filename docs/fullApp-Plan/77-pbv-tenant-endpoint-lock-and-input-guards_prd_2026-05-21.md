# PRD-77 — PBV Tenant Endpoint Lock & Input Guards

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** P1 — both are launch-lane correctness/compliance gaps. #5 lets a tenant sign/submit after staff has locked the packet (a HACH workflow-integrity break); #6 lets malformed input reach the DB with opaque errors.
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — finding **#5** (HIGH) and the **tenant-route portion of #6** (HIGH). The member-token signer route's share of #6 is handled in **PRD-78** so that the two signer-route files are owned by exactly one PRD.
**Scope guard:** `lib/pbv/tenantEndpoint.ts` and `app/api/t/[token]/pbv-full-app/sign-form/route.ts` only, plus a new shared validation helper. Do **not** edit the member-token signer routes (PRD-78), the upload route or generate-forms (PRD-76), or the storage-race logic.

---

## Problem Statement

**#5 — Tenant can sign/finalize while staff has the packet locked (HIGH).** `withTenantContext` ([lib/pbv/tenantEndpoint.ts:42-47](lib/pbv/tenantEndpoint.ts#L42)) returns 409 when `submitted_at` is set, but it does **not** check `packet_locked`. The document-upload route checks `packet_locked` locally ([upload/route.ts:40](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L40)), but `sign-form`, `generate-forms`, `finalize`, and `intake/complete` go through `withTenantContext` without that gate. So if staff lock a packet mid-flow (the `send-to-hach` / review lock), the tenant can still sign forms and finalize. The lock is meant to freeze the packet for review; today it does not freeze the tenant signing path.

**#6 (tenant route) — No input validation on `sign-form` (HIGH).** The tenant `sign-form` route ([sign-form/route.ts:38-57](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L38)) checks only that `form_document_id`, `signer_member_id`, `typed_name`, `signature_image_path`, and `ceremony_id` are **present** — not that the UUID-typed fields are valid UUIDs, and not that `device_owner` is one of `['self','hoh_device','staff_assisted']` (it is read from the body with a `'self'` default, [line 56](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L56)). Invalid UUIDs propagate to Supabase and fail with opaque errors; a crafted `device_owner` is caught by the DB `CHECK` constraint ([pbv_signature_events:17-18](supabase/migrations/20260515020000_pbv_signature_events.sql#L17)) but only after a round-trip, surfacing an ugly error rather than a clean 400.

---

## Root cause / findings (confirmed in code 2026-05-21)

- **#5**: the lock check exists in exactly one place (the upload route, by hand) instead of in the shared wrapper. Centralizing it in `withTenantContext` covers all four routes at once and matches how `submitted_at` is already gated there. Note `withTenantContext` resolves the app row using the **caller-supplied `select`** ([tenantEndpoint.ts:11-23](lib/pbv/tenantEndpoint.ts#L11)); several callers' selects do not include `packet_locked`, so the wrapper must always fetch the column regardless of the caller's select string.
- **#6**: there is no shared validator. The tenant route and the member signer route ([signer/[member_token]/sign-form/route.ts:45-50](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L45)) each do an ad-hoc presence check. A small shared helper gives both routes consistent UUID/enum validation (this PRD creates it and applies it to the tenant route; PRD-78 applies it to the member route).

---

## Current state

| Item | Where | Notes |
|---|---|---|
| `withTenantContext` gates only `submitted_at` | `lib/pbv/tenantEndpoint.ts:42-47` | no `packet_locked` |
| Caller-supplied select | `lib/pbv/tenantEndpoint.ts:11-23, 33` | default `'id, submitted_at'`; many callers omit `packet_locked` |
| Local lock check (upload only) | `upload/route.ts:40` | the one route that already checks it |
| Presence-only validation (tenant) | `sign-form/route.ts:38-57` | no UUID/enum checks |
| `device_owner` CHECK constraint | `pbv_signature_events:17-18` | DB catches bad values, but only after a round-trip |
| `pbv_full_applications.packet_locked` | column exists | used by `send-to-hach` / `reopen` (audit positive findings) |

---

## Goals

1. **#5:** `withTenantContext` returns **409** `{ success:false, code:'packet_locked' }` when the resolved application has `packet_locked = true`, so `sign-form`, `generate-forms`, `finalize`, and `intake/complete` are all gated centrally — a tenant cannot sign or submit while staff hold the packet.
2. **#5:** `withTenantContext` fetches `packet_locked` regardless of the caller's `select`, so the gate cannot be bypassed by a caller that forgot to select the column.
3. **#5:** The upload route's local `packet_locked` check ([upload/route.ts:40](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L40)) becomes redundant but is left in place (belt-and-suspenders); note it in the build report — do not edit the upload file in this PRD (PRD-76 owns it).
4. **#6 (tenant route):** A new shared validator rejects malformed input with a clean **400** before any DB work: `form_document_id`, `signer_member_id`, `ceremony_id` must be valid UUIDs; `device_owner` (when supplied) must be in `['self','hoh_device','staff_assisted']`; `typed_name` and `signature_image_path` must be non-empty strings.
5. No behavior change for valid requests, and the `submitted_at` 409 takes precedence consistently.

## Non-goals

- No change to the lock *semantics* (what sets/clears `packet_locked` — that is `send-to-hach`/`reopen`, unchanged).
- No edits to the member-token signer routes (PRD-78), the upload route or generate-forms (PRD-76).
- No new schema. `packet_locked` already exists on `pbv_full_applications`.
- Do **not** introduce a heavy schema-validation dependency if a 20-line helper suffices; `zod` is acceptable if it is already a project dependency — confirm before adding.

---

## Implementation phases

### Phase 1 — #5: centralize the `packet_locked` gate in `withTenantContext`
In `lib/pbv/tenantEndpoint.ts`:

1. Ensure `packet_locked` is always fetched. Either (a) make `resolveTokenToApp` append `, packet_locked` to whatever `select` is passed (de-duplicating if already present), or (b) always select `'id, submitted_at, packet_locked'` and merge the caller's extra columns. Prefer (a) so callers keep their existing selects.
2. After the `submitted_at` check ([line 42-47](lib/pbv/tenantEndpoint.ts#L42)), add:

```ts
if (app.packet_locked) {
  return NextResponse.json(
    { success: false, message: 'This packet is currently under review. Please contact the Stanton office.', code: 'packet_locked' },
    { status: 409 }
  );
}
```

Add `packet_locked?: boolean` to the `TenantApp` interface. Order: `not found (404)` → `submitted_at (409 submitted_locked)` → `packet_locked (409 packet_locked)` → handler.

Confirm the four affected tenant routes (`sign-form`, `generate-forms`, `finalize`, `intake/complete`) all flow through `withTenantContext` and so inherit the gate — list them in the build report. The tenant client should handle the new `packet_locked` 409 the way it already handles `submitted_locked` (same shape); if the client special-cases codes, note any UI follow-up as a DECISION (do not build UI here).

### Phase 2 — #6 (tenant route): shared validator + apply to tenant `sign-form`
Create `lib/pbv/signing/validateSignFormBody.ts` (or extend an existing validation util if one is found — grep for `isUuid`/`uuidRegex` first):

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEVICE_OWNERS = ['self', 'hoh_device', 'staff_assisted'] as const;

export function validateSignFormBody(body: any, opts: { requireSignerMemberId: boolean }):
  { ok: true } | { ok: false; message: string } {
  if (!body) return { ok: false, message: 'Missing request body' };
  for (const f of ['form_document_id', 'ceremony_id']) {
    if (!UUID_RE.test(body[f] ?? '')) return { ok: false, message: `${f} must be a valid UUID` };
  }
  if (opts.requireSignerMemberId && !UUID_RE.test(body.signer_member_id ?? ''))
    return { ok: false, message: 'signer_member_id must be a valid UUID' };
  if (typeof body.typed_name !== 'string' || !body.typed_name.trim())
    return { ok: false, message: 'typed_name is required' };
  if (typeof body.signature_image_path !== 'string' || !body.signature_image_path.trim())
    return { ok: false, message: 'signature_image_path is required' };
  if (body.device_owner !== undefined && !DEVICE_OWNERS.includes(body.device_owner))
    return { ok: false, message: 'device_owner is invalid' };
  return { ok: true };
}
```

In the tenant `sign-form` route, replace the presence-only check ([lines 38-47](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L38)) with a call to `validateSignFormBody(body, { requireSignerMemberId: true })`, returning **400** with the helper's message on failure. Keep the existing PRD-64 `X-Assisted-By` session verification and the idempotency key unchanged.

> The member signer route uses `{ requireSignerMemberId: false }` (it derives the member from the token), but applying the helper there is **PRD-78's** job — do not edit that file here. Creating the helper here is what lets PRD-78 reuse it.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#5 locked):** unit test — `withTenantContext` with a resolved app where `packet_locked = true` returns 409 `packet_locked` and the handler is not invoked.
- **Gate 2 (#5 select):** unit test — a caller whose `select` omits `packet_locked` still gets the gate (the wrapper fetched the column anyway).
- **Gate 3 (#5 unlocked):** unit test — `packet_locked = false` (and `submitted_at = null`) → handler runs as today.
- **Gate 4 (#6 invalid UUID):** unit test — non-UUID `form_document_id`/`ceremony_id`/`signer_member_id` → 400, no DB call.
- **Gate 5 (#6 bad enum):** unit test — `device_owner = 'staff'` → 400; absent `device_owner` → accepted (defaults to `'self'` downstream).
- **Gate 6 (#6 valid):** unit test — well-formed body passes the validator unchanged.
- **Gate 7:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`).

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** on a preview deploy, lock a packet via `send-to-hach`, then attempt tenant `sign-form` / `finalize` → 409 `packet_locked`; `reopen` → tenant can sign again.

---

## Open questions

- **O1 (#5):** Does the tenant UI need a distinct message/redirect for `packet_locked` vs `submitted_locked`? Default: reuse the existing 409 handling; log a UI follow-up if the codes are special-cased.
- **O2 (#6):** Is `zod` already a dependency? If yes, the validator may use it; if not, use the regex helper above rather than adding a dependency. Default: plain helper.

## Decisions

- **D1 (#5):** Gate `packet_locked` centrally in `withTenantContext`, fetching the column regardless of caller select; leave the upload route's local check in place.
- **D2 (#6):** Shared `validateSignFormBody` helper created here, applied to the tenant route; reused by PRD-78 for the member route. Plain regex/enum validation unless `zod` is already present.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `lib/pbv/tenantEndpoint.ts` | #5 | fetch `packet_locked` regardless of caller select; 409 `packet_locked`; extend `TenantApp` |
| `lib/pbv/signing/validateSignFormBody.ts` (new) | #6 | shared UUID/enum/presence validator |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | #6 | replace presence-only check with `validateSignFormBody(body, { requireSignerMemberId: true })` → 400 |
| new test(s) | #5, #6 | Gates 1–6 |

If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL. Do **not** edit the member signer routes (PRD-78) or the upload/generate-forms routes (PRD-76).
