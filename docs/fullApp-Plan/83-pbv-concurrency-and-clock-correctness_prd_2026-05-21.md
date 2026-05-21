# PRD-83 — PBV Concurrency & Clock Correctness

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Status:** Draft — ready for build
**Severity:** P2/P3. All three are correctness/robustness gaps the matrix puts post-launch: A7 (idempotency expiry clock), A10 (send-link token race), A11 (generate-forms *summary* overwrite).
**Source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` — findings **A7** (HIGH), **A10** (MEDIUM), **A11** (MEDIUM). Grouped as "time/concurrency correctness": each is a clock or read-decide-write race in a distinct file.
**Scope guard:** `lib/idempotency.ts`, `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts`, and the **summary-PDF region only** of `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`. Do **not** touch `withTenantContext`, the cron routes / `lib/cron/*` (PRD-74), or the form-document first-generation logic in generate-forms (PRD-76).

**Dependency (A11):** `generate-forms/route.ts` is edited by **PRD-76** (form-document first-gen race). This PRD's A11 change is in a **different region** of the same file (the summary-PDF upload), so run **after PRD-76** to layer cleanly on its version. If PRD-76 has not landed, build on the current file and note the reorder. Do not modify PRD-76's form-document logic.

---

## Problem Statement

**A7 — `withIdempotency` uses server-local `new Date()` for the expiry comparison (per audit, [lib/idempotency.ts:31](lib/idempotency.ts#L31)).** The check `new Date(existing.expires_at) > new Date()` compares against a freshly constructed local `Date`. This is the same clock/consistency concern the audit raised for magic-link expiry (PRD-78 #8): the comparison is only unambiguous if `expires_at` round-trips as a UTC instant. The robust form compares epoch milliseconds explicitly.

> **Do not change `withIdempotency`'s behavior or signature** beyond this comparison. The double-wrap fix and PRD-77/78 depend on `withIdempotency` being otherwise stable — this is a one-line correctness tightening, not a refactor.

**A10 — `additional-signers/send-link` token generation has a race (per audit, [send-link/route.ts:88-100](app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts#L88)).** Two concurrent calls can both pass the expiry check ([:71-75](app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts#L71)), both generate a new token, and the second UPDATE overwrites the first. Both callers receive different tokens; only the last one written is valid, so a link already handed out can be silently invalidated.

**A11 — `generate-forms` summary upload uses `upsert: true` without a version guard (per audit, [generate-forms/route.ts:315-320](app/api/t/[token]/pbv-full-app/generate-forms/route.ts#L315)).** The summary PDF path `pbv/${fullApp.id}/summary-${summaryLang}-unsigned.pdf` is written with `upsert: true`. Two concurrent generate-forms calls → the second silently overwrites the first's summary PDF. Less critical than the form-document race (the summary has no signer hashes), but still a silent inconsistency. This is the summary analogue of the form-document race PRD-76 closed.

---

## Root cause / findings (audit-reported; confirm in code before editing)

- **A7**: local `Date` construction on both sides. The fix is `new Date(existing.expires_at).getTime() > Date.now()` — epoch ms, unambiguous. Mirrors the `isMagicLinkExpired` reasoning in PRD-78 (`Date.parse` / `Date.now`). [Inference] if `expires_at` is a `timestamptz`, the current comparison is already correct and this is consistency hardening; if it is ever a naive timestamp, the epoch form is the safer read. Confirm the column type if cheap; either way the epoch form is the deliverable.
- **A10**: the read-decide-write (check expiry → generate token → UPDATE) is not atomic. The fix is an **optimistic-lock guard** on the UPDATE: scope it to the token value that was read, so only the first writer succeeds; the loser re-reads and returns the winning token rather than overwriting it.
- **A11**: `upsert: true` on a fixed summary path silently overwrites. The fix mirrors PRD-76 #4's options: either **version the summary path** (append a generation/template-version suffix) or use **`upsert: false` and treat a 409 as a benign replay** (re-read and return the existing summary). Whichever is chosen, two concurrent first-generations cannot silently clobber each other. Confirm whether a summary version/counter is already available on the app row before inventing one.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Local-clock expiry compare | `lib/idempotency.ts:31` | `new Date(existing.expires_at) > new Date()` |
| Non-atomic token regen | `send-link/route.ts:71-75, 88-100` | check → generate → UPDATE, no optimistic guard |
| Summary overwrite | `generate-forms/route.ts:315-320` | fixed path `summary-${lang}-unsigned.pdf`, `upsert:true` |
| Reference (summary analogue) | PRD-76 #4 (form-document first-gen) | version-or-collision-detect; do not re-touch that region |
| Reference (clock) | PRD-78 `isMagicLinkExpired` | `Date.parse` / `Date.now` epoch comparison |

---

## Goals

1. **A7:** `withIdempotency` compares expiry by epoch milliseconds (`new Date(existing.expires_at).getTime() > Date.now()`), with no other behavior change. A null/unparseable `expires_at` is handled fail-safe (treat as not-usable / regenerate) consistent with the function's current intent — confirm and preserve that intent.
2. **A10:** Concurrent `send-link` calls cannot silently invalidate an already-issued token. The UPDATE carries an optimistic-lock guard scoped to the token that was read (`.eq('magic_link_token', member.magic_link_token ?? '')`); the loser re-reads and returns the winning token (`regenerated:false, race:true`) rather than overwriting it.
3. **A11:** Two concurrent first-generations of the same summary cannot silently overwrite. Either the summary path carries a version suffix, or the write uses `upsert:false` with a benign-409 re-read. No change to the form-document generation (PRD-76).
4. No change to unrelated behavior in any of the three files.

## Non-goals

- No refactor of `withIdempotency` beyond the comparison line; no signature change.
- No change to the cron `cleanup-idempotency-keys` route or `lib/cron/*` (PRD-74).
- No change to the form-document first-generation logic in generate-forms (PRD-76 owns it).
- No new DB primitive / advisory-lock RPC expected. If you conclude one is required, **stop and log it**; do not add a migration silently.
- Do **not** apply any migration to prod.

---

## Implementation phases

### Phase 1 — A7: epoch comparison in `withIdempotency`
At `lib/idempotency.ts:31`:

```ts
if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
```

Confirm the surrounding branch's intent (return the cached response when the key is still live) is preserved exactly. Add a one-line comment that the epoch comparison is the UTC-safe form. Do not alter how keys are written or expired.

### Phase 2 — A10: optimistic lock on `send-link` token regeneration
At `send-link/route.ts:88-100`, scope the UPDATE to the token that was read and handle the lost race:

```ts
const { error: updateError } = await supabaseAdmin
  .from('pbv_household_members')
  .update({ magic_link_token: newToken, magic_link_expires_at: expiresAt })
  .eq('id', member.id)
  .eq('magic_link_token', member.magic_link_token ?? ''); // optimistic lock

if (updateError) {
  // race lost (or other error) — re-read and return the current token rather than overwriting
  const { data: fresh } = await supabaseAdmin
    .from('pbv_household_members')
    .select('magic_link_token, magic_link_expires_at')
    .eq('id', member.id)
    .single();
  return NextResponse.json({
    success: true,
    data: {
      magic_link_token: fresh?.magic_link_token,
      magic_link_expires_at: fresh?.magic_link_expires_at,
      regenerated: false,
      race: true,
    },
  });
}
```

Confirm the real table/column names (`pbv_household_members`, `magic_link_token`, `magic_link_expires_at`) and that an `updateError` is the right race signal for the installed supabase-js (an `.eq` guard that matches 0 rows may return `count:0` rather than an error — if so, gate on the count instead and log the mechanism).

### Phase 3 — A11: version or collision-detect the summary upload
At `generate-forms/route.ts:315-320`, in the **summary-PDF region only**, replace the silent overwrite. Preferred — version the path:

```ts
const summaryStoragePath = `pbv/${fullApp.id}/summary-${summaryLang}-v${SUMMARY_TEMPLATE_VERSION}-unsigned.pdf`;
```

(only if a stable `SUMMARY_TEMPLATE_VERSION` / generation counter already exists on the app row or in config — confirm; do not invent a version source). Fallback — `upsert:false` + benign-409: on a 409, re-read and reuse the existing summary instead of overwriting. Whichever path, **log it** in OPEN-DECISIONS and do not leave `upsert:true` on a fixed summary path. Do not touch the form-document generation in the same file.

---

## Verification / test plan

**Static gates (in-session, before commit):**
- **Gate 1 (A7):** unit test — a still-live key (`expires_at` in the future) returns the cached path; an expired key does not; comparison is independent of local `new Date()` construction.
- **Gate 2 (A10 race-loser):** unit test — simulate the optimistic-lock UPDATE losing (token changed underneath); assert the route returns the winning token with `race:true`, not a new overwrite.
- **Gate 3 (A10 happy path):** unit test — single call regenerates and returns `regenerated:true`.
- **Gate 4 (A11):** unit test — two first-generations of the same summary do not both write a fixed `upsert:true` path; exactly one canonical summary results (asserted via the chosen mechanism).
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`). **No Playwright/e2e.**

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** concurrency walk on a preview deploy — two concurrent `send-link` regenerations leave exactly one valid token; two concurrent generate-forms calls leave one canonical summary PDF.

---

## Open questions

- **O1 (A7):** Is `existing.expires_at`'s column a `timestamptz`? If yes, this is consistency hardening; if no, the epoch form is the safer read. Confirm if cheap; ship the epoch form either way.
- **O2 (A10):** Does the installed supabase-js signal a 0-row guarded UPDATE via `updateError` or `count:0`? Gate on whichever applies; log it.
- **O3 (A11):** Is there a stable summary version/counter to suffix the path with? Default to versioned path if one exists; otherwise `upsert:false` + benign-409. Log the choice.

## Decisions

- **D1 (A7):** Epoch-ms comparison in `withIdempotency`; no other change to the function.
- **D2 (A10):** Optimistic-lock the token UPDATE; the loser returns the winning token, never overwrites.
- **D3 (A11):** Version the summary path or `upsert:false`+benign-409; never silently overwrite a fixed summary path.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `lib/idempotency.ts` | A7 | epoch-ms expiry comparison (one line) + comment |
| `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts` | A10 | optimistic-lock the token UPDATE; loser returns winning token |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | A11 | summary-PDF region: version path or `upsert:false`+benign-409 |
| new test(s) | A7, A10, A11 | Gates 1–4 |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`. Do **not** touch the cron/idempotency-cleanup routes (PRD-74) or the form-document generation region (PRD-76).
