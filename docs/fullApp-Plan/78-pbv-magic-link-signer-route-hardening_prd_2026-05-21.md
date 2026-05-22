# PRD-78 — PBV Magic-Link Signer Route Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** P2 — #8 is a clock-handling robustness gap on magic-link expiry; the member-route share of #6 is input-validation hardening. Neither is a deploy blocker, but both touch the non-HOH signer lane that is exposed via emailed magic links.
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — finding **#8** (MEDIUM, both signer routes) and the **member-route portion of #6** (HIGH). This PRD owns **both** signer-route files so neither is edited by another PRD (PRD-77 owns the tenant `sign-form` route + the shared validator).
**Scope guard:** The two `app/api/pbv-full-app/signer/[member_token]/*` route files only. Do **not** touch the tenant routes, `withTenantContext`, or `lib/pbv/signing/completeForm.ts`.
**Dependency:** Runs **after PRD-77**, which creates `lib/pbv/signing/validateSignFormBody.ts`. This PRD imports that helper. If PRD-77 has not landed, create the helper here per PRD-77's spec and note the reorder.

---

## Problem Statement

**#8 — Magic-link expiry compares against server-local `new Date()` (MEDIUM).** Both signer routes compare `magic_link_expires_at` against a freshly constructed `new Date()`:

| Route | Where | Code |
|---|---|---|
| signer GET | [signer/[member_token]/route.ts:34-35](app/api/pbv-full-app/signer/[member_token]/route.ts#L34) | `const now = new Date(); … new Date(member.magic_link_expires_at) < now` |
| signer sign-form | [signer/[member_token]/sign-form/route.ts:40](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L40) | `new Date(member.magic_link_expires_at) < new Date()` |

The comparison itself is timezone-correct in principle (both `Date` objects are absolute instants once parsed). The audit's concern is robustness and consistency: the two routes construct "now" differently, and the correctness of the comparison depends on `magic_link_expires_at` being stored and parsed as an unambiguous UTC instant. If `magic_link_expires_at` is ever stored as a naive/local timestamp (no offset), `new Date(...)` parses it in a way that can shift the boundary. [Inference] a `timestamptz` column round-trips as UTC and parses unambiguously, in which case the current comparison is already correct and this finding is hardening, not a live bug — confirm the column type during build.

**#6 (member route) — No input validation on the signer `sign-form` (HIGH).** The member signer `sign-form` route ([signer/[member_token]/sign-form/route.ts:45-50](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L45)) checks only presence of `form_document_id`, `typed_name`, `signature_image_path`, `ceremony_id`. As with the tenant route (PRD-77), invalid UUIDs propagate to Supabase with opaque errors. `device_owner` is hard-coded `'self'` here ([line 83](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L83)), so the enum part of #6 does not apply to this route — only UUID/presence validation does.

---

## Root cause / findings (confirmed in code 2026-05-21)

- **#8**: two routes hand-roll the expiry comparison with slightly different "now" construction. The robust form is a single, explicit UTC comparison using `Date.now()` (epoch ms) on both sides, and a confirmation that `magic_link_expires_at` is a `timestamptz`. Centralizing the check in one helper removes the divergence.
- **#6 (member)**: no shared validator was applied; PRD-77 introduces `validateSignFormBody`. Here it is reused with `{ requireSignerMemberId: false }` because the member is derived from the token, not the body.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Expiry check (GET) | `signer/[member_token]/route.ts:34-35` | `new Date()` local construction |
| Expiry check (sign-form) | `signer/[member_token]/sign-form/route.ts:40` | inline `new Date()` |
| `magic_link_expires_at` column type | `pbv_household_members` | confirm `timestamptz` (introspect) |
| Presence-only validation | `signer/[member_token]/sign-form/route.ts:45-50` | no UUID checks |
| `device_owner` hard-coded | `signer/[member_token]/sign-form/route.ts:83` | `'self'` — enum check N/A here |
| Shared validator | `lib/pbv/signing/validateSignFormBody.ts` (PRD-77) | reuse with `requireSignerMemberId:false` |

---

## Goals

1. **#8:** Both signer routes determine expiry via one shared helper that compares epoch milliseconds (`Date.now()` vs `Date.parse(expiresAt)`), returning 410 `expired` when expired or when `magic_link_expires_at` is null/unparseable. The two routes no longer construct "now" independently.
2. **#8:** Confirm `magic_link_expires_at` is `timestamptz`; if it is, document that the comparison was already UTC-correct and this is consistency hardening. If it is **not** `timestamptz`, log a BLOCKER/MIGRATION-TO-APPLY recommending the column be converted — do not silently rely on local parsing.
3. **#6 (member):** The member signer `sign-form` route validates `form_document_id` and `ceremony_id` as UUIDs and `typed_name`/`signature_image_path` as non-empty via the shared `validateSignFormBody` helper, returning 400 before DB work. `signer_member_id` is not in the body here (`requireSignerMemberId: false`).
4. No change to the 410-on-expiry contract, the 409 submitted-lock check ([sign-form:67-72](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L67)), or the shared `completeFormSigning` call.

## Non-goals

- No change to how magic links are *minted* or how `magic_link_expires_at` is set (unless the column type forces a migration, which is logged, not auto-applied).
- No edits to the tenant routes, `withTenantContext`, or `completeForm.ts`.
- No new validation dependency; reuse PRD-77's helper.
- Do **not** apply any migration to prod.

---

## Implementation phases

### Phase 1 — #8: one shared expiry helper, epoch-based
Add `lib/pbv/magicLinkExpiry.ts`:

```ts
/** True when the magic link is expired, null, or unparseable (treat as expired = fail-closed). */
export function isMagicLinkExpired(expiresAt: string | null | undefined): boolean {
  if (!expiresAt) return true;
  const exp = Date.parse(expiresAt);     // epoch ms; UTC for a timestamptz round-trip
  if (Number.isNaN(exp)) return true;     // unparseable → fail closed
  return exp < Date.now();
}
```

Replace the inline comparisons:
- `signer/[member_token]/route.ts:34-35` → `if (isMagicLinkExpired(member.magic_link_expires_at)) return 410 expired;` (drop the local `const now`).
- `signer/[member_token]/sign-form/route.ts:40` → same.

**Confirm the column type** (`magic_link_expires_at` on `pbv_household_members`) via Supabase MCP introspection. If `timestamptz`: add a code comment that the epoch comparison is UTC-correct and note in the build report that #8 was consistency hardening. If **not** `timestamptz`: log a MIGRATION-TO-APPLY in OPEN-DECISIONS proposing `ALTER COLUMN … TYPE timestamptz USING …` and keep the fail-closed helper (which is still an improvement).

### Phase 2 — #6 (member route): apply the shared validator
Import `validateSignFormBody` from `lib/pbv/signing/validateSignFormBody.ts` (PRD-77). Replace the presence-only check ([signer/[member_token]/sign-form/route.ts:45-50](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L45)) with:

```ts
const v = validateSignFormBody(body, { requireSignerMemberId: false });
if (!v.ok) return NextResponse.json({ success: false, message: v.message }, { status: 400 });
```

Keep the expiry (410) and submitted-lock (409) checks ahead of the body validation in their current order; validation runs after the link is confirmed valid and before `completeFormSigning`.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#8 expired):** unit test — `isMagicLinkExpired` returns true for a past timestamp, null, and a garbage string; false for a future timestamp.
- **Gate 2 (#8 routes):** unit test — both signer routes return 410 `expired` for a past `magic_link_expires_at` and proceed for a future one, using the helper.
- **Gate 3 (#6 invalid UUID):** unit test — non-UUID `form_document_id`/`ceremony_id` on the member sign-form route → 400, no DB call.
- **Gate 4 (#6 valid):** unit test — well-formed member body passes validation and reaches `completeFormSigning` (mock it).
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`).

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** confirm `magic_link_expires_at` column type on staging; if a type migration was logged, apply and re-verify expiry behavior.
- **Gate R2:** on a preview deploy, open an expired member link → 410; a valid one → signer page loads and a form can be signed.

---

## Open questions

- **O1 (#8):** Is `magic_link_expires_at` a `timestamptz`? Default assumption: yes (so the fix is consistency hardening). If no, log a type-conversion MIGRATION-TO-APPLY; do not auto-apply.
- **O2 (ordering):** Has PRD-77 landed (and thus `validateSignFormBody` exists)? If not, create the helper here per PRD-77's spec and note the reorder in the build report.

## Decisions

- **D1 (#8):** Single epoch-based `isMagicLinkExpired` helper, fail-closed on null/unparseable, used by both signer routes.
- **D2 (#6 member):** Reuse PRD-77's `validateSignFormBody` with `requireSignerMemberId: false`; no `device_owner` check (hard-coded `'self'`).

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `lib/pbv/magicLinkExpiry.ts` (new) | #8 | epoch-based `isMagicLinkExpired` helper |
| `app/api/pbv-full-app/signer/[member_token]/route.ts` | #8 | use helper; drop local `new Date()` |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | #8, #6 | use expiry helper; apply `validateSignFormBody({ requireSignerMemberId:false })` → 400 |
| new test(s) | #8, #6 | Gates 1–4 |
| `supabase/migrations/<ts>_magic_link_expires_timestamptz.sql` (only if column is not timestamptz) | #8 | type conversion — **commit only, list in OPEN-DECISIONS, do not apply** |

If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL. Do **not** edit the tenant routes or `withTenantContext` (PRD-77).
