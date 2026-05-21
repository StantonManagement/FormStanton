# PRD-81 — PBV Storage Write-Races Round 2

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Status:** Draft — ready for build
**Severity:** **Before-deploy.** A3 (legacy tenant document upload) is the matrix's "document upload race — legacy paths" before-deploy item. A2 (signatures POST) is tagged **CRITICAL in the findings** but **demoted to v1.1 in the launch matrix** — see the conflict note below; this PRD treats both as before-deploy-grade because both can leave a row desynced from storage while the tenant believes the action succeeded.
**Source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` — findings **A2** and **A3**. Grouped because both are the same read-decide-write storage race that PRD-76 already closed for the PBV upload + generate-forms paths; these are the two remaining clones in different files.
**Scope guard:** `app/api/t/[token]/pbv-full-app/signatures/route.ts` and `app/api/t/[token]/documents/[documentId]/route.ts` only. Do **not** touch the PBV upload route or generate-forms (PRD-76), `lib/pbv/signing/*`, or `withTenantContext`.

> **Severity conflict to surface:** the audit's findings section labels A2 CRITICAL ("Fix Before Launch"); its Launch Decision Matrix lists "signatures POST race" as "Fix in v1.1". This PRD builds the fix regardless (it's a small, contained change); **Alex decides the deploy gate.** The batch-run prompt's deploy-blocker line includes this PRD — flag the A2 phasing question in the build report.

---

## Problem Statement

**A2 — `signatures` POST has a storage-upload-first race (per audit, [signatures/route.ts:164-168](app/api/t/[token]/pbv-full-app/signatures/route.ts#L164)).** The signature image is uploaded to storage with `upsert: false` **before** the DB UPDATE on `application_documents`. If two concurrent requests sign the same document, the second storage upload fails with 409; the route throws without rolling back, so the DB UPDATE never runs and the document stays in `missing` status even though the tenant believes the signature was captured. Net effect: a silent row/storage desync the tenant cannot see.

**A3 — `t/[token]/documents/[documentId]` (legacy upload) has the same race (per audit, [documents/[documentId]/route.ts:124-151](app/api/t/[token]/documents/[documentId]/route.ts#L124)).** This is the legacy tenant document upload endpoint (non-PBV path, still active). It uploads to storage with `upsert: false`, then updates the DB **without checking the affected-row count**. Two concurrent uploads → one 409, an orphan file, and an inconsistent row.

---

## Root cause / findings (audit-reported; confirm in code before editing)

- Both are the failure shape PRD-76 documented: a read-decide-write sequence where the storage write and the DB write are not ordered/guarded, so the second concurrent writer either orphans a file or leaves the row out of sync. PRD-76's remedy was **gate the storage write on the DB outcome / affected-row count, and never proceed to storage when another request already won.** Apply the same shape here.
- **A2** specifically inverts the safe order (storage first, DB second, no rollback). The fix is to make the DB UPDATE authoritative — either UPDATE-first with a status guard and check the count, then upload; or treat the 409 as a benign duplicate and still complete the DB UPDATE. [Inference] UPDATE-first-with-guard is the cleaner of the two because it never leaves a storage object the DB doesn't reference; confirm the existing handler flow (single doc vs. loop over multiple signatures) before choosing.
- **A3** has the right order (storage then DB) but never inspects whether the guarded UPDATE actually affected a row, so the loser of the race proceeds as if it succeeded. The fix mirrors PRD-76 #2: request the affected-row count (or `.select('id')` length) and, on 0 rows, remove the orphan object just uploaded and return 409.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Storage upload before DB update | `signatures/route.ts:164-168` (loop `127-182`) | `upsert:false`; throw on 409 without rollback; DB never updated |
| Storage-then-DB, no count check | `documents/[documentId]/route.ts:124-151` (update `134-151`) | `upsert:false`; only `updateError` inspected, not affected rows |
| Reference pattern | PRD-76 (upload route) | affected-row count gate; abort-before-storage; remove orphan on loss |

---

## Goals

1. **A2:** A second concurrent signature for the same document does not leave the row in `missing` while the tenant sees success. Either (a) UPDATE-first with a status guard (e.g. `.eq('status','missing')` or the appropriate signing-state guard), check the affected-row count, and only upload to storage when the row was claimed; or (b) handle the storage 409 as a benign duplicate (same bytes) and still complete the DB UPDATE. Whichever is chosen, the row and the stored object end consistent, and the route never throws-without-rollback. Log the chosen approach.
2. **A3:** The legacy upload route requests the affected-row count on its guarded UPDATE and, when 0 rows are affected, **removes the orphan storage object it just uploaded** and returns a clean **409** (`document_superseded` or similar) — no orphan file, no desynced row.
3. No change to the non-racing happy path, to MIME/size/HEIC handling, hash computation, or event emission.

## Non-goals

- No change to the PBV upload route or generate-forms (PRD-76 owns those — do not re-touch).
- No change to `lib/pbv/signing/*`, `finalizeValidation.ts`, or `withTenantContext`.
- No new DB primitive expected (no advisory-lock RPC); these are affected-row-count / order fixes. If you believe a migration is required, **stop and log it** rather than adding one silently.
- Do **not** apply any migration to prod.

---

## Implementation phases

### Phase 1 — A2: make the DB update authoritative in `signatures` POST
Confirm whether the route handles one signature or loops over several ([lines 127-182](app/api/t/[token]/pbv-full-app/signatures/route.ts#L127)). Then restructure each unit so the DB claim precedes the storage write:

1. **UPDATE first** with the correct status guard and request the count (`{ count: 'exact' }`, or `.select('id')` and read `.length` if the installed supabase-js requires it — log which).
2. **If 0 rows affected**, another request won this signature — skip it cleanly (no storage write, no throw).
3. **If the claim succeeded**, upload to storage with `upsert: true` (idempotent for identical bytes).
4. **If the storage upload then fails**, roll the row back to its prior status so it does not falsely read as signed.

If UPDATE-first is awkward given the existing handler shape, the documented fallback is: keep the order but **catch the storage 409 as benign** (the object already exists from the winning request) and still run the DB UPDATE so the row reflects the captured signature. Either way: no throw-without-rollback, and log the path taken in OPEN-DECISIONS.

### Phase 2 — A3: affected-row guard on the legacy upload
At `documents/[documentId]/route.ts:134-151`, after the storage upload, request the count on the guarded UPDATE and clean up on loss:

```ts
const { data: updateResult, error: updateError } = await supabaseAdmin
  .from('application_documents')
  .update({ /* ... */ })
  .eq('id', documentId)
  .eq('status', 'missing') // race guard (confirm the correct guard column/value in code)
  .select('id');

if (updateError) {
  // existing error handling
}
if ((updateResult?.length ?? 0) === 0) {
  // another request won — delete the orphan file we just uploaded
  await supabaseAdmin.storage.from('pbv-applications').remove([storagePath]);
  return NextResponse.json(
    { success: false, message: 'This document was just uploaded by another request. Refresh to see it.', code: 'document_superseded' },
    { status: 409 }
  );
}
```

Confirm the real bucket name and the correct status guard for the legacy route before wiring this (it may differ from the PBV path). Do not assume `'missing'` if the legacy route uses a different lifecycle.

---

## Verification / test plan

**Static gates (in-session, before commit):**
- **Gate 1 (A2 race-loser):** unit test — simulate the DB claim affecting 0 rows (or a storage 409 in the fallback path); assert no false-success and the row is not left mid-state.
- **Gate 2 (A2 happy path):** unit test — single request claims the row and uploads; row ends consistent with storage.
- **Gate 3 (A3 superseded):** unit test — guarded UPDATE returns 0 rows after a storage upload → the orphan object is removed and a 409 is returned.
- **Gate 4 (A3 happy path):** unit test — count ≥ 1 → 200/201 as today, no orphan removal.
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`). **No Playwright/e2e.**

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** concurrency walk on a preview deploy — fire two concurrent signatures at the same document and two concurrent legacy uploads at the same doc; confirm no orphan storage object and no row that reads "signed/submitted" without the matching stored bytes.

---

## Open questions

- **O1 (A2):** Does `signatures` POST handle one signature or a batch loop? Determines whether the claim/guard is per-row in a loop. Confirm in code.
- **O2 (A2):** UPDATE-first-with-guard vs. catch-409-benign. Default: **UPDATE-first** (no orphan possible); fall back to catch-409 if the handler shape makes UPDATE-first invasive. Log the choice.
- **O3 (A3):** The correct status guard + bucket name for the legacy route (may differ from the PBV path). Confirm before wiring.

## Decisions

- **D1 (A2):** The DB row is authoritative; the route must never throw-without-rollback and never leave a `missing` row that the tenant believes is signed.
- **D2 (A3):** Gate on affected-row count; on loss, remove the orphan object and return 409.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | A2 | DB-claim-first (or benign-409) so row/storage stay consistent; no throw-without-rollback |
| `app/api/t/[token]/documents/[documentId]/route.ts` | A3 | affected-row count gate; remove orphan + 409 on race loss |
| new test(s) | A2, A3 | Gates 1–4 |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`. Do **not** re-touch the PRD-76 routes (upload, generate-forms).
