# PRD-34 Implementation Plan: Intake Data Snapshot Pattern + Schema Cleanup

## Overview
Implements the snapshot pattern for PBV intake data: separates mutable workspace (`intake_data`) from immutable legal artifact (`intake_snapshot`). Also promotes `_resume_section` from JSONB magic key to real column.

**Architecture Decision:** Option C — separate snapshot column on `pbv_full_applications`

| Store | Purpose | Mutability | Read by |
|---|---|---|---|
| `intake_data` (JSONB) | Workspace during data entry | Cleared at `/intake/complete` | Section autosave, intake landing |
| `intake_snapshot` (JSONB, NEW) | Immutable submitted record | Written once, never updated | Tenant Review, form generation, compliance |
| `pbv_household_members` (normalized) | Current operational state | Mutable by staff post-submission | Staff dashboards, eligibility engine |

## Files to Modify

### Phase 1 — Schema + Write Path

1. **Migration** `supabase/migrations/20260515110000_pbv_intake_snapshot.sql`
   - Add `intake_snapshot JSONB NULL`
   - Add `intake_snapshot_at TIMESTAMPTZ NULL`
   - Add `resume_section TEXT NULL`
   - Create immutability trigger function
   - Backfill `resume_section` from existing JSONB

2. **F2** `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:78-85`
   - Add snapshot write + intake_data clear inside transaction
   - Validate `intake_data` before writing

3. **F5 Write** `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:55-69`
   - Replace `_resume_section` JSONB write with `resume_section` column UPDATE

### Phase 2 — Read Path

4. **F3** `app/api/t/[token]/pbv-full-app/route.ts:20,274`
   - Add `intake_snapshot, intake_snapshot_at, resume_section` to `.select()`
   - Return `intake_snapshot` as `intake_data` when status='complete'
   - Add `resume_section` to response

5. **F4** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:40`
   - Switch from `intake_data` to `intake_snapshot` read

6. **F4 Audit** `lib/pbv/form-generation/field-mapping.ts`
   - Verify what this file reads (it has its own `IntakeData` interface)

7. **F5 Read** `app/pbv-full-app/[token]/intake/page.tsx:155`
   - Replace `(intakeData as any)?._resume_section` with `resume_section` from bootstrap

8. **F5 Read** `app/pbv-full-app/[token]/page.tsx:491`
   - Same: use `resume_section` from bootstrap response

9. **F5 Type** `lib/pbv/intake-schema.ts:201`
   - Remove `_resume_section?: SectionSlug` from `IntakeData` interface

### Phase 3 — Backfill + Cleanup

10. **F6 Script** `scripts/backfill-intake-snapshots.ts`
    - Dry-run by default, `--commit` to execute
    - Copy `intake_data` → `intake_snapshot` for `intake_status='complete'` rows
    - Set `intake_snapshot_at = COALESCE(submitted_at, updated_at, NOW())`

11. **F5 Cleanup Migration** (post-verify)
    - `UPDATE pbv_full_applications SET intake_data = intake_data - '_resume_section' WHERE intake_data ? '_resume_section'`

## Database Migration Details

```sql
-- F1 Schema Changes
ALTER TABLE pbv_full_applications
  ADD COLUMN intake_snapshot      JSONB        NULL,
  ADD COLUMN intake_snapshot_at   TIMESTAMPTZ  NULL,
  ADD COLUMN resume_section       TEXT         NULL;

-- Immutability trigger
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

-- Backfill resume_section from existing data
UPDATE pbv_full_applications
   SET resume_section = intake_data->>'_resume_section'
 WHERE intake_data ? '_resume_section';
```

## Verification Steps

1. **New token E2E:** Walk intake → `/intake/complete` → verify `intake_snapshot` populated, `intake_data` cleared
2. **Old token (post-backfill):** Visit dashboard → Review page renders from snapshot → data matches
3. **SQL test:** `UPDATE pbv_full_applications SET intake_snapshot = '{}' WHERE intake_snapshot IS NOT NULL` should raise

## Open Decisions (Resolved)

- `intake_data` lifecycle after submit: **CLEAR** it (`= '{}'::jsonb`)
- Backfill strategy: **YES**, run script with dry-run first
- "View what I submitted" link: **Deferred** to PRD-37

## Commit Sequence

1. `feat(pbv-schema): add intake_snapshot, resume_section columns + immutability trigger (F1)`
2. `feat(pbv-intake): write immutable intake_snapshot at /intake/complete (F2)`
3. `refactor(pbv-intake): resume_section as column on writes (F5 part 1)`
4. `feat(pbv-bootstrap): serve snapshot when complete; expose resume_section (F3)`
5. `refactor(pbv-forms): form generation reads intake_snapshot (F4)`
6. `refactor(pbv-intake): resume_section as column on reads, remove from IntakeData type (F5 part 2)`
7. `chore(pbv-data): backfill intake_snapshot for existing completed applications (F6)`
8. `chore(pbv-data): remove _resume_section from intake_data JSONB (F5 cleanup)`

## Dependencies

- PRD-33 must be deployed first (bootstrap fix) ✓ CONFIRMED

---

**Ready for review. Say "go" to proceed with implementation.**
