# PRD-76 — PBV Tenant Storage Write-Race Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-stress-test-hardening`
**Status:** Draft — ready for build
**Severity:** #2 is **P0 — deploy blocker** (concurrent uploads can desync the DB row from storage / orphan a file). #4 is **P1** (a rarer first-generation overwrite that can hand a signer a different PDF than what is stored).
**Source:** `docs/audits/pbv-stress-test-report_2026-05-21.md` — findings **#2** (CRITICAL) and **#4** (HIGH). Both are read-decide-write storage races in the tenant lane; grouped because they share the same failure shape (two concurrent requests both read pre-write state, both write the same path).
**Scope guard:** The two tenant routes named below only. Do **not** touch `lib/pbv/signing/*`, the PRD-66 versioning logic for the `>=1 signer` case (that path is already handled), or `withTenantContext` (the `packet_locked` gate is **PRD-77**).

---

## Problem Statement

**#2 — Document upload race orphans storage files / desyncs the row (CRITICAL).** In the non-replace path, the guarded update adds `.eq('status', 'missing')` ([app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:152-154](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L152)) but never checks how many rows it affected. Two concurrent uploads for the same `missing` doc both read `status='missing'`, both compute `newRevision = doc.revision + 1` (same value), both attempt `storage.upload(..., { upsert: false })`. One storage write wins; the other gets a 409 and runs the rollback branch ([lines 185-202](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L185)). But both already issued the DB update to `status='submitted'` with the same `storage_path`; the rollback of the loser can revert the row to `missing` while the winner's storage object exists — or, depending on interleaving, the row points at a revision/path that does not match the bytes actually stored. The `.eq('status','missing')` guard means the *second* DB update affects **0 rows**, but the code proceeds to storage upload anyway because it never inspects the count.

**#4 — `generate-forms` first-generation overwrite (HIGH).** For the zero-prior-version case, both concurrent requests read `existingVersion = null` ([generate-forms/route.ts:189-196](app/api/t/[token]/pbv-full-app/generate-forms/route.ts#L189)), both choose `generationVersion = 1, upsertOnUpload = true`, both upload to the identical path `pbv/<appId>/forms/<formId>-<lang>-v1.pdf` ([line 205-211](app/api/t/[token]/pbv-full-app/generate-forms/route.ts#L205)). With `upsert:true`, the second silently overwrites the first's bytes. PRD-66 already handles the `>=1 signer` case correctly (bumps version, `upsert:false`); the **zero-signer first generation** is the remaining exposure. [Inference] a signer who hashed the first-written bytes would then mismatch the stored (overwritten) PDF at finalize Check 5; this is the same class of hazard PRD-66 closed for the multi-signer case, not yet reproduced in-session.

---

## Root cause / findings (confirmed in code 2026-05-21)

- **#2**: the guard `.eq('status','missing')` correctly makes the second update a no-op at the DB level, but the route treats the update as if it succeeded — it checks only `updateError` ([line 155](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L155)), not the affected-row **count**. A no-op update returns no error and `count: 0`. The decision to proceed to storage upload must be gated on `count >= 1`.
- **#4**: the read-decide-upload sequence (`select existingDoc` → choose version → `storage.upload`) is not atomic. Two first-generation requests interleave between the read and the upsert. The `>=1 signer` branch is safe only because it picks `upsert:false` on a brand-new versioned path; the first-gen branch uses `upsert:true` on a fixed `v1` path.
- Note (no action here): the upload route already checks `app.packet_locked` locally ([line 40](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L40)). PRD-77 centralizes that gate in `withTenantContext`; this PRD leaves the local check alone.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Guarded update, no count check | `upload/route.ts:152-157` | `.eq('status','missing')` then only `updateError` inspected |
| Rollback branch | `upload/route.ts:185-202` | reverts row on storage 409 — assumes its own update landed |
| First-gen version decision | `generate-forms/route.ts:189-203` | `null → v1, upsert:true` |
| First-gen upload | `generate-forms/route.ts:205-211` | fixed path, `upsert: upsertOnUpload` |
| PRD-66 multi-signer path | `generate-forms/route.ts:197-203` | already correct (`existing+1, upsert:false`) — do not touch |

---

## Goals

1. **#2:** The upload route requests the affected-row **count** on the guarded (non-replace) update and **aborts before any storage upload** if `count === 0` (another upload already claimed the `missing` slot). The aborting request returns a clean 409 (e.g. `{ success:false, code:'upload_superseded' }`) and writes nothing to storage, so no orphan object and no row/storage desync results from the second writer.
2. **#4:** Two concurrent first-generation requests for the same `(appId, formId, language)` cannot both write `v1` with `upsert:true`. Exactly one writes the canonical first version; the other either no-ops on identical bytes safely or is serialized behind the first.
3. No change to the replace path (`status in ('submitted','rejected')`), the PRD-66 `>=1 signer` versioning, or any non-racing behavior.

## Non-goals

- No change to HEIC conversion, MIME/size validation, hash computation, or the event-emission sequence.
- No change to `lib/pbv/signing/*` or `finalizeValidation.ts`.
- No `packet_locked` work (PRD-77).
- Do **not** apply any migration to prod.

---

## Implementation phases

### Phase 1 — #2: check affected-row count on the guarded update
In `upload/route.ts`, request the count on the non-replace branch and gate storage on it:

```ts
const baseQuery = supabaseAdmin
  .from('application_documents')
  .update(updateData, { count: 'exact' })   // request affected-row count
  .eq('id', doc_row_id);

const { error: updateError, count } = isReplace
  ? await baseQuery
  : await baseQuery.eq('status', 'missing');

if (updateError) {
  throw new Error(`Failed to update document: ${updateError.message}`);
}
if (!isReplace && (count ?? 0) === 0) {
  // another concurrent upload already claimed this 'missing' slot
  return {
    body: { success: false, message: 'This document was just uploaded from another tab or device. Refresh to see it.', code: 'upload_superseded' },
    status: 409,
  };
}
```

This abort happens **before** the storage upload block ([lines 180-213](app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts#L180)), so the superseded request never touches storage and the existing rollback logic is not involved for it. Confirm supabase-js returns `count` on `.update(..., { count: 'exact' })`; if the installed client requires `.select()` to return affected rows, use `.select('id')` and check `data?.length` instead — log which mechanism you used.

### Phase 2 — #4: serialize first-generation per `(appId, formId, language)`
Preferred: wrap the read-decide-upload in a **transaction-scoped advisory lock** keyed by a hash of `(fullApp.id, formId, language)` so concurrent first-generations for the same form serialize. Because supabase-js issues separate statements (advisory locks are connection-scoped and unreliable across the pool — see PRD-74 #10), implement this as a single `SECURITY DEFINER` RPC, e.g. `generate_form_claim(p_app_id uuid, p_form_id text, p_language text)` that runs `pg_advisory_xact_lock(hashtext(...))` and returns the current `(generation_version, collected_signer_member_ids)` in the same transaction — so the lock is held for the duration of the read inside the function. The route then decides version from the RPC result. [Inference] keeping the lock and the version read in one DB transaction serializes the decision; this is the same reasoning PRD-66 used for the multi-signer path.

Simpler alternative (default if the RPC can't be validated in-session): make the first-generation write **collision-detecting** instead of overwriting — use `upsert:false` on the `v1` path for the first generation too, and on a 409 storage error, re-read `existingDoc`; if a row now exists, treat it as "another request generated it first" and return that version rather than overwriting. This converts the silent-overwrite into a detected-and-resolved collision without a new DB primitive. Whichever path you take, **log it** in OPEN-DECISIONS; do not leave `upsert:true` on a fixed first-gen path.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (#2 superseded):** unit test — simulate the guarded update returning `count: 0`; assert the route returns 409 `upload_superseded` and `storage.upload` is **not** called.
- **Gate 2 (#2 happy path):** unit test — `count: 1` → proceeds to storage upload and 201 as today.
- **Gate 3 (#2 replace path unchanged):** unit test — `isReplace` path does not gate on count (replace legitimately updates a non-missing row).
- **Gate 4 (#4):** unit test — two first-generation calls for the same `(app, form, lang)`: exactly one canonical `v1` object results; the second does not overwrite with `upsert:true` (asserted via the chosen mechanism — RPC serialize or collision-detect).
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`).

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** if the #4 RPC path is taken, apply its migration on staging and confirm the advisory lock serializes two concurrent generate-forms calls.
- **Gate R2:** concurrency walk on a preview deploy — fire two uploads at the same `missing` doc and two first-generations at the same form; confirm no orphan storage object and a single canonical PDF.

---

## Open questions

- **O1 (#2):** Does the installed supabase-js return `count` from `.update(data, { count: 'exact' })`, or is `.select()` required to get affected rows? Confirm in code; default to `{ count: 'exact' }` and fall back to `.select('id')` length if needed.
- **O2 (#4):** RPC advisory-lock vs collision-detect. Default to the **RPC advisory-lock** if it can be validated in-session (stronger); otherwise collision-detect (`upsert:false` + re-read). Log the choice.

## Decisions

- **D1 (#2):** Gate storage upload on affected-row count; superseded second writer returns 409 and writes nothing to storage.
- **D2 (#4):** Serialize first-generation per `(app, form, language)` (RPC advisory lock preferred) or detect-and-resolve the collision (`upsert:false`); never silently overwrite `v1`.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` | #2 | request affected-row count on guarded update; abort to 409 before storage if 0 |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | #4 | serialize/collision-detect first-generation; remove `upsert:true` on fixed `v1` path |
| `supabase/migrations/<ts>_generate_form_claim_fn.sql` (new, only if RPC path) | #4 | `SECURITY DEFINER` advisory-lock RPC — **commit only, list in OPEN-DECISIONS, do not apply** |
| new test(s) | #2, #4 | Gates 1–4 |

If anything outside this list needs changing, default-and-log per BATCH-RUN-PROTOCOL. Do **not** edit `withTenantContext` here (PRD-77).
