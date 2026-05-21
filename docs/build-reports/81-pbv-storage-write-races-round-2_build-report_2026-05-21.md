# PRD-81 — Storage Write-Races Round 2 — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Commit SHA:** (filled by commit step)
**Audit source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (A2, A3)

---

## ⚠️ Deploy-blocker line crossed after this commit

PRD-80 (A1) was committed at `400c81f`. This PRD remediates A3 (legacy document upload race — explicitly listed as before-deploy in the audit matrix). With this commit on the branch, the before-deploy items from the new audit are now closed.

**A2 deploy-gate question for Alex (surfaced, not decided):** the audit's findings section tags A2 (signatures POST race) **CRITICAL**, but its Launch Decision Matrix demotes it to **v1.1**. This PRD builds the fix regardless. The matrix's phrasing was "Fix in v1.1 — Storage-first without rollback." Decide whether to gate launch on A2 or accept it as already-on-branch hardening that ships post-deploy.

---

## What changed (files)

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | A2 | DB-claim-first w/ optimistic lock; upload uses `upsert:true`; storage failure reverts the row to its prior (status, revision, file_name, storage_path) |
| `app/api/t/[token]/documents/[documentId]/route.ts` | A3 | UPDATE gated on read (status, revision); on 0 rows affected → remove orphan storage object + return 409 `document_superseded` |
| `lib/pbv/__tests__/prd81-storage-write-races.test.ts` | A2, A3 | new — Gates 1–4 |

## Path taken (preferred vs. fallback) + why

- **A2 — preferred (UPDATE-first w/ optimistic lock).** Per PRD-81 Phase 1, the cleaner of the two options because it never leaves an orphan storage object (storage write only happens *after* the DB claim succeeds). The handler loops over `body.signatures`, so the claim/upload/rollback is per-iteration; each iteration captures `priorStatus`, `priorRevision`, `priorStoragePath`, `priorFileName` from the pre-iteration `doc` read, and uses `.eq('status', priorStatus).eq('revision', priorRevision)` as the optimistic lock. Storage upload moved to `upsert:true` (idempotent for the same path/bytes) so an at-most-once-retry pattern doesn't false-409.
- **A2 — race-lost branch:** logs `pbv_signatures_race_lost` and `continue` (no throw, no orphan — we never reached the upload).
- **A2 — storage-failure branch:** reverts the row to its prior values and re-throws, so the existing 500 `Failed to save signatures` handler still fires (no new error shape).
- **A3 — kept the audit's preferred shape:** `.eq('status', doc.status).eq('revision', doc.revision ?? 0).select('id')` after the upload, with orphan `.remove([storagePath])` and 409 `document_superseded` on 0 rows. Race-loss is exceedingly rare on the legacy single-doc path; keeping upload-first kept the diff small. If the orphan remove itself fails, we log `tenant_document_orphan_remove_failed` and still return 409 (do not throw out of the cleanup branch).

## Decisions logged in OPEN-DECISIONS

- `[PRD-81] A2 optimistic-lock key (status + revision) — DECISION` (locked on the two columns the read already covered; revision drift would also signal a race).
- `[PRD-81] A2 storage upload mode flipped from upsert:false → upsert:true — DECISION` (the new DB-claim-first ordering makes upsert:false redundant and harmful — identical bytes from the same claim must succeed; the file path encodes the new revision so cross-revision collisions can't happen).
- `[PRD-81] A2 vs v1.1 deploy gate — needs Alex.**`

## Static gates

- `node ./node_modules/typescript/bin/tsc --noEmit` → **clean** (no output).
- `npm run build` → **clean** (only pre-existing route warnings unrelated to this PRD).
- `npx vitest run lib/pbv/__tests__/prd81-storage-write-races.test.ts` → **12/12 passed**.

## Gates (PRD-81 plan map)

| Gate | Status | Notes |
|---|---|---|
| G1 (A2 race-loser) | ✅ static — asserts `pbv_signatures_race_lost` + `continue` follows | runtime walk deferred (R1) |
| G2 (A2 happy path) | ✅ static — asserts UPDATE precedes upload + upsert:true | runtime walk deferred (R1) |
| G3 (A3 superseded) | ✅ static — asserts `.remove([storagePath])` + 409 `document_superseded` | runtime walk deferred (R1) |
| G4 (A3 happy path) | ✅ static — asserts `status: 201` + file_name returned (unchanged) | |
| G5 (tsc/build/tests) | ✅ all green | |

## Deferred runtime gates (post-run pass)

- **R1:** concurrency walk on a preview deploy:
  - Two concurrent signature submits for the same `document_id` → exactly one row ends in `submitted` with bytes; the other tenant gets a clean 200 with `signed:0` (race lost is silent), no orphan storage object exists.
  - Two concurrent legacy uploads for the same `documentId` → one returns 201, the other returns 409 `document_superseded`; storage bucket has exactly one object at the winning `storage_path`.
  - Force a storage error after a successful claim (simulate via permissions toggle on the preview environment) → the row reverts to its prior status and the tenant sees the existing 500 surface.

## OPEN-DECISIONS entries (appended)

- `[PRD-81] A2 deploy gate — needs Alex` (audit findings = CRITICAL, matrix = v1.1; this PRD builds the fix regardless).
- `[PRD-81] Storage upload mode in signatures POST flipped to upsert:true — DECISION`.

## Notes / cross-PRD flags

- No prior-batch file reverted. PRD-76 owns the **upload** + **generate-forms** routes; PRD-81 owns the **signatures** + **legacy documents** routes. Disjoint.
- `signatures` POST `signed_forms` accumulation in the `pbv_household_members` UPDATE (lines after the loop) is unchanged — it operates on `signedDocTypes` which is only appended after a successful claim+upload, so it stays consistent with the row state automatically.
- No migrations.
