# PRD-34 — PBV Intake Data: Snapshot Pattern + Schema Cleanup

**Date:** 2026-05-15
**Author:** Claude (architecture review)
**Branch:** `refactor/pbv-intake-snapshot-34`
**Status:** Shipped 2026-05-15. Option C snapshot pattern implemented with `intake_snapshot` JSONB column, immutability trigger, and backfill script. Edit-and-resubmit deferred as known limitation.
**Depends on:** PRD-33 (bug fixes deploy first)

---

## Problem Statement

PBV intake state currently lives in three places that can drift:

1. **`pbv_full_applications.intake_data` (JSONB)** — written per section by autosave during intake.
2. **`pbv_household_members` and related normalized tables** — written at `/intake/complete` by the bridge logic in `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`.
3. **The bootstrap endpoint response** — currently returns nothing for `intake_data` (PRD-33 F1 fixes), but is downstream of #1.

After `/intake/complete`, both #1 and #2 exist, and there is no architectural answer to "which one is canonical for what purpose." Today:

- Tenant Review page reads from #1
- Form generation reads from #2
- Staff dashboards read from #2
- The legal artifact (what the tenant signed) is implicit in the generated PDF only

This is the underlying reason a single missed `.select(intake_data)` cascaded into an empty Review summary across the entire flow. The data model has no clear separation between **workspace** (mutable while typing), **legal artifact** (frozen at submission), and **operational state** (mutable by staff post-submission).

A second smaller issue: `_resume_section` lives as a magic JSONB key inside `intake_data` and is read via `(intake_data as any)._resume_section`. It survives no resets of `intake_data` and forces an `as any` cast.

This PRD adopts the **snapshot pattern (Option C)**: introduce an immutable `intake_snapshot` JSONB column written once at `/intake/complete`, separate from the workspace `intake_data` and from the operational normalized tables. Promotes `_resume_section` to a real column at the same time.

---

## Users & Roles

- **Tenant** — gets a Review page that reads from the immutable snapshot, so what they see post-submission is exactly what they signed.
- **Office staff** — can amend normalized tables for corrections without altering the snapshot. UI can surface "tenant submitted vs current state" diffs.
- **Compliance / HUD audit** — has a queryable, structured, immutable record of every submitted application.
- **Developer** — clear semantic per data store. No more hunting through three tables to answer "what did the tenant actually report?"

---

## Architecture decision

**Adopted: Option C — separate snapshot column.**

Three distinct stores with explicit purposes:

| Store | Purpose | Mutability | Read by |
|---|---|---|---|
| `pbv_full_applications.intake_data` (JSONB) | Workspace during data entry | Mutable until `/intake/complete`, then cleared (or marked stale) | Section autosave, intake landing's resume logic |
| `pbv_full_applications.intake_snapshot` (JSONB, NEW) | Immutable record of submitted intake | Written once at `/intake/complete`, never updated | Tenant Review page, form generation, compliance |
| `pbv_household_members` + related normalized tables | Current operational state | Mutable by staff post-submission | Staff dashboards, search, eligibility engine |

Rejected: Option B (freeze-in-place) — implicit semantics, requires DB constraint enforcement, easy to forget. Option A (delete after commit) — loses queryable artifact, requires rewriting Review against ~8 normalized tables.

---

## Closed decisions (do not relitigate)

- Snapshot lives as a new JSONB column on `pbv_full_applications`, not a separate table. Simpler join story; one row per application.
- Snapshot is set exactly once, in the same transaction as the rest of `/intake/complete`. If the transaction fails, no snapshot.
- Immutability is enforced both via application code (writes only inside `/intake/complete`) and via DB trigger (reject UPDATE to `intake_snapshot` after first set).
- Form generation reads from the snapshot, not from normalized tables. Generated PDFs match what the tenant signed, even if staff later edits normalized.
- Tenant Review page reads from snapshot when `intake_status = 'complete'`, else from `intake_data` (workspace).
- `_resume_section` becomes a real column on `pbv_full_applications` (`resume_section TEXT NULL`).

---

## Decisions resolved (Alex confirmed 2026-05-15)

- **`intake_data` lifecycle after submit**: clear it (`intake_data = '{}'::jsonb`). Workspace doesn't linger. Diffing against the snapshot is the audit path if needed.
- **Backfill strategy**: yes, copy `intake_data` → `intake_snapshot` for existing completed applications via `scripts/backfill-intake-snapshots.ts`. Dry-run mandatory; Alex green-lights before `--commit`.
- **DB trigger for immutability**: yes. Belt-and-suspenders with application-side discipline.
- **"View what I submitted" link on tenant dashboard**: NOT in this PRD. Covered by PRD-37's `/print` view, which serves the same purpose better.

## Decisions still open — out of scope for this PRD

- **Re-open intake (edit-and-resubmit) policy**: PRD-32 supports this via delete-then-insert. Snapshot semantics with re-open (new version vs overwrite) deferred. Documented as a known limitation; raise as a separate PRD when the use case arises.

---

## Core Features

### F1: Schema migration

- Add columns to `pbv_full_applications`:
  - `intake_snapshot JSONB NULL`
  - `intake_snapshot_at TIMESTAMPTZ NULL`
  - `resume_section TEXT NULL`
- Add DB trigger preventing UPDATE to `intake_snapshot` once non-null.
- Migration file: `supabase/migrations/<YYYYMMDD>_pbv_intake_snapshot.sql`.

### F2: `/intake/complete` writes snapshot

- File: `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- Inside the same transaction as the existing member/document seeding:
  1. Read current `intake_data`.
  2. Validate it (Zod schema against `IntakeData` from `lib/pbv/intake-schema.ts`).
  3. Write to `intake_snapshot` with `intake_snapshot_at = NOW()`.
  4. Clear `intake_data` to `'{}'::jsonb` (per open decision).
  5. Continue with existing bridge logic.

### F3: Bootstrap returns snapshot when complete

- File: `app/api/t/[token]/pbv-full-app/route.ts`
- Update `.select()` to include `intake_snapshot, intake_snapshot_at, resume_section`.
- In response object: when `intake_status = 'complete'`, return `intake_snapshot` as `intake_data`. When `'in_progress'` or `'not_started'`, return `intake_data` (workspace) as today.
- This keeps `useIntakeBootstrap` and downstream client code unchanged.

### F4: Form generation reads snapshot

- File: `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` and `lib/pbv/form-generation/*`
- Audit every read of `intake_data`. After this PRD, generation must read `intake_snapshot`.
- If form generation currently reads from normalized tables (verify), no change needed. Document the source per form.

### F5: `resume_section` migration

- Replace all reads of `(intake_data as any)._resume_section` with reads from the new `resume_section` column.
- Replace all writes (currently in `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:58`) to update the column instead of the JSONB key.
- Remove the `_resume_section?: SectionSlug` field from the `IntakeData` interface in `lib/pbv/intake-schema.ts`.
- Backfill: `UPDATE pbv_full_applications SET resume_section = intake_data->>'_resume_section' WHERE intake_data ? '_resume_section'`.
- After verifying, optional cleanup: `UPDATE pbv_full_applications SET intake_data = intake_data - '_resume_section' WHERE intake_data ? '_resume_section'`.

### F6: Backfill snapshots for existing complete applications

- Migration script: `scripts/backfill-intake-snapshots.ts`.
- For each `pbv_full_applications` row where `intake_status = 'complete'` AND `intake_snapshot IS NULL`:
  - Copy `intake_data` to `intake_snapshot`.
  - Set `intake_snapshot_at` to `submitted_at` if present, else `updated_at`, else `NOW()`.
- Dry-run mode by default. Confirm with Alex before running with `--commit`.
- Log every row touched. Output a summary count.

### F7: Admin "tenant submitted vs current state" diff (light)

- Out-of-scope as a UI feature for this PRD.
- But: log a metric (Sentry breadcrumb or simple counter) every time the snapshot disagrees with normalized data on a comparable field, so we have visibility on drift.

---

## Data Model

```sql
ALTER TABLE pbv_full_applications
  ADD COLUMN intake_snapshot      JSONB        NULL,
  ADD COLUMN intake_snapshot_at   TIMESTAMPTZ  NULL,
  ADD COLUMN resume_section       TEXT         NULL;

CREATE OR REPLACE FUNCTION pbv_intake_snapshot_immutable() RETURNS trigger AS $$
BEGIN
  IF OLD.intake_snapshot IS NOT NULL AND NEW.intake_snapshot IS DISTINCT FROM OLD.intake_snapshot THEN
    RAISE EXCEPTION 'intake_snapshot is immutable once set (application_id=%)', OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pbv_full_applications_snapshot_immutable
  BEFORE UPDATE ON pbv_full_applications
  FOR EACH ROW
  EXECUTE FUNCTION pbv_intake_snapshot_immutable();

-- Backfill resume_section from existing JSONB
UPDATE pbv_full_applications
   SET resume_section = intake_data->>'_resume_section'
 WHERE intake_data ? '_resume_section';
```

Backfill of `intake_snapshot` happens in F6 via the script, not the migration (allows dry-run + review).

---

## Integration Points

- `/intake/complete` POST — writes snapshot
- `/pbv-full-app` GET (bootstrap) — reads snapshot when complete, intake_data when in-progress
- `/intake/[section]` POST — writes `resume_section` column instead of JSONB key
- Form generation pipeline — reads snapshot, not normalized
- Future: admin UI for snapshot vs current diff (separate PRD)

---

## Open Questions

See "Decisions still open" above. Recommend Alex confirms before build:
1. Clear `intake_data` after snapshot write? (recommended yes)
2. Backfill existing complete applications? (recommended yes)
3. New "View what I submitted" link on tenant dashboard? (recommended yes — small)

---

## Implementation Phases

**Phase 1 — Schema + write path (target: half day)**
- F1: migration
- F2: `/intake/complete` writes snapshot
- F5: `resume_section` column writes

**Phase 2 — Read path (target: half day)**
- F3: bootstrap returns snapshot when complete
- F4: form generation reads snapshot (audit + change)
- F5 cont.: `resume_section` column reads

**Phase 3 — Backfill + cleanup (target: half day, scheduled)**
- F6: snapshot backfill script (dry-run, then commit with Alex)
- F5 cleanup: remove `_resume_section` from JSONB
- F7: drift logging

---

## Acceptance — what "done" looks like

- `intake_snapshot` column exists, populated for every `intake_status = 'complete'` row (existing + new).
- DB trigger prevents accidental updates to a populated `intake_snapshot`.
- Tenant Review page on a completed application reads from snapshot. Staff editing a normalized field (e.g., `pbv_household_members.phone`) does not change what the tenant sees on Review.
- `_resume_section` no longer exists in JSONB. `as any` cast is removed.
- Backfill report shows N rows snapshotted, with a sample diff showing they match the source `intake_data`.
