# Build Report — PRD-34: Intake Data Snapshot Pattern

**Date:** 2026-05-17  
**Branch:** `refactor/pbv-intake-snapshot-34`  
**Status:** Shipped 2026-05-15

---

## What shipped

- **F1** — `intake_snapshot` JSONB column added to `pbv_full_applications`
- **F2** — Immutability trigger prevents updates after first write
- **F3** — `/intake/complete` writes snapshot before clearing `intake_data`
- **F4** — `_resume_section` promoted to real column `resume_section`
- **F5** — Backfill script `scripts/backfill-intake-snapshots.ts` (dry-run + commit modes)

---

## What changed from PRD

- **Pattern** — Option C (separate snapshot column) ratified. `intake_data` cleared to `'{}'::jsonb` after snapshot write.

---

## What was deferred

- **Edit-and-resubmit** — Requires design conversation on snapshot invalidation. Deferred as known limitation.
- **"View what I submitted" link** — Covered by PRD-37 `/print` instead.

---

## Verification status

| Item | Status |
|---|---|
| Snapshot written at complete | [inference based on code review] |
| Trigger prevents updates | [inference based on migration] |
| Backfill script runs | Pending Alex dry-run + commit |

---

## Known issues / followups

- Backfill needs explicit `--commit` flag to run on production data
- Edit-and-resubmit deferred to future PRD
