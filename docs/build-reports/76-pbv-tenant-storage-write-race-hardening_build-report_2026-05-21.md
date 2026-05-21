# PRD-76 — Tenant Storage Write-Race Hardening — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/76-pbv-tenant-storage-write-race-hardening_prd_2026-05-21.md`
**Audit findings remediated:** #2 (CRITICAL — deploy blocker), #4 (HIGH)

## Deploy-blocker status

**#2 cleared at this commit.** The non-replace UPDATE in the document upload route now requests `count: 'exact'` and aborts to **409 `upload_superseded`** BEFORE any `storage.upload(...)` call when the affected-row count is 0 (another concurrent upload claimed the `missing` slot first). No orphan storage object can result from a second concurrent writer. The rollback branch is untouched and is no longer entangled with the supersede case.

**This concludes the three deploy blockers.** With PRD-74 (#1 cron auth), PRD-75 (#3 RLS lockdown), and PRD-76 #2 (upload race) all committed, the deploy-blocker line is crossed. PRDs 77–79 are post-launch hardening.

## Files changed

**Edited:**
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` — `.update(updateData, { count: 'exact' })`; destructure `count: updatedCount`; abort to 409 `upload_superseded` when `!isReplace && (updatedCount ?? 0) === 0`. Replace path unaffected.
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` — first-gen path now uses `upsert: false`. On a benign first-gen collision (409 / "exist" / "duplicate" AND `existingVersion === null`) the route re-reads the winning row, pushes its `form_document_id` to the response, and `continue`s to the next form. The upsert is **skipped** in the collision branch so the winner row's hash is not overwritten by the loser. PRD-66 multi-signer behavior (`bump + upsert:false`) and zero-signer reuse behavior (`reuse + upsert:true`) are preserved exactly.

**New tests:**
- `lib/pbv/__tests__/upload-superseded-guard.test.ts` — 6 structural-invariant tests on the upload route.
- `lib/pbv/__tests__/generate-forms-first-gen-race.test.ts` — 7 structural-invariant tests on the collision-detect branch + PRD-66 regression.

**No migration written** — collision-detect path chosen over the optional `generate_form_claim_fn.sql` RPC migration (see OPEN-DECISIONS).

## Path taken — fallback on O2, preferred on #2 and O1

- **#2 (count check):** preferred path. `.update(data, { count: 'exact' })` directly returns count; no `.select()` fallback needed.
- **#4 (first-gen race):** **fallback** path — collision-detect (`upsert:false` + 409/exist/duplicate detection + re-read winner). The preferred RPC advisory-lock path would require a new `SECURITY DEFINER` migration that mixes `pg_advisory_xact_lock` with a row read, AND validation against a live DB. With the migration commit-only constraint and no DB access in-session, the collision-detect fallback is the safer ship-now choice. Structurally identical to PRD-66's `completeForm.ts:254-260` benign-replay handling.

## OPEN-DECISIONS entries added

1. **[PRD-76] Collision-detect (not RPC advisory-lock) for first-gen race — DECISION (O2):** fallback path chosen because RPC validation requires a live DB.
2. **[PRD-76] supabase-js `count: 'exact'` returns count without `.select()` — DECISION (O1):** confirmed in code.
3. **[PRD-76] No `generate_form_claim_fn.sql` migration written — DECISION:** not needed for the collision-detect path.

## Static gates

| Gate | Result |
|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean |
| `npx vitest run lib/pbv/__tests__/upload-superseded-guard lib/pbv/__tests__/generate-forms-first-gen-race lib/pbv/__tests__/generate-forms-versioning` | ✅ 20/20 (3 files) — including PRD-66 regression |
| `npm run build` | ✅ Clean |

## Deferred runtime gates (post-run manual pass)

- **R1 (#2):** preview deploy. Fire two near-simultaneous uploads at the same `missing` document row. Expect: one returns 201 with the file in storage; the other returns 409 `upload_superseded`. Confirm there is exactly ONE object in `form-submissions/pbv-documents/<app>/<row>/...` and the row's `storage_path` matches the winner.
- **R2 (#4):** preview deploy. Fire two near-simultaneous `POST /generate-forms` calls for the same fresh application (intake complete, no prior forms generated). Expect: both return success with the same `form_document_id` for each form. Confirm there is exactly ONE `pbv/<app>/forms/<form>-<lang>-v1.pdf` in storage and the `pbv_form_documents` row's `unsigned_pdf_hash` matches `sha256` of that file's bytes.
- **R3 (regression):** run the existing PBV signing happy-path E2E on a preview deploy; confirm no regression from the `upsert:false` change on the first-gen path.

## Notes

- The collision detection accepts any of `statusCode === '409'`, `message` containing "exist", or `message` containing "duplicate" — matches the supabase-js storage SDK error shape used by `completeForm.ts:254-260`.
- The collision branch skips the `pbv_form_documents` upsert entirely; the winner row remains authoritative. Re-reading the winner via the same `(full_application_id, form_id, language)` key as the prior `existingDoc` select is intentional — both reads can race in theory, but the winner row exists by definition (the storage object that caused the 409 was written together with its upsert in the winning request's transaction).
- `withTenantContext` is NOT modified by this PRD — the `packet_locked` gate added centrally there is PRD-77's lane.
