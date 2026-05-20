# Cursor/Windsurf Prompt — PRD-34: Intake Data Snapshot Pattern + Schema Cleanup

## Context

PRD-33 patches the visible bug; PRD-34 fixes the architecture that allowed it. Today intake data lives in three drift-prone places (workspace JSONB, normalized tables, bootstrap response) with no clear semantic for which is canonical. This PRD adopts **Option C — separate snapshot column**: `intake_data` is workspace, `intake_snapshot` is the immutable legal artifact, normalized tables are mutable operational state. Promotes `_resume_section` to a real column at the same time.

PRD-33 must land first. This PRD's read-path changes assume PRD-33 F1's bootstrap fix is in.

Schema changes here. Migration must be reviewed by Alex before running with `--commit`.

## Required reading before you start

1. `docs/fullApp-Plan/34-pbv-intake-data-snapshot-pattern_prd_2026-05-15.md` — this PRD with full architecture rationale
2. `docs/fullApp-Plan/33-pbv-intake-flow-fixes_prd_2026-05-15.md` — must land first
3. `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — F2 + F5 target
4. `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:55-69` — F5 write target
5. `app/api/t/[token]/pbv-full-app/route.ts:31-33, 263` — F3 read target (post-PRD-33)
6. `lib/pbv/intake-schema.ts:200-end` — `IntakeData` interface; remove `_resume_section` field at end of F5
7. `app/pbv-full-app/[token]/intake/page.tsx:90` — F5 read site (`(intakeData as any)?._resume_section`)
8. `app/pbv-full-app/[token]/page.tsx:491` — same, second occurrence
9. `lib/pbv/form-generation/*` — F4 audit; verify what intake_data is read where
10. `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` — F4 target
11. `supabase/migrations/` — pattern for the new migration file

## Closed decisions (do not relitigate)

- Pattern: Option C, separate snapshot column on `pbv_full_applications`
- Snapshot is set exactly once in the same transaction as the rest of `/intake/complete`
- Immutability enforced via DB trigger AND application-side discipline (writes only inside `/intake/complete`)
- Form generation reads from snapshot, not normalized
- Tenant Review reads from snapshot when complete, else from intake_data workspace
- `_resume_section` becomes a real column, removed from JSONB

## Decisions still open — resolve during build, document in build report

- **`intake_data` lifecycle after submit**: clear (`= '{}'::jsonb`) or leave? Recommend clear. Confirm with Alex; if unclear, leave it and add a follow-up ticket.
- **Backfill timing**: run `scripts/backfill-intake-snapshots.ts --commit` immediately after deploy, or schedule? Confirm with Alex. Dry-run mandatory first.
- **"View what I submitted" link on tenant dashboard**: add now (small) or defer? Recommend add now if Phase 2 has time; otherwise PRD-37 picks it up via the printable view.
- **Form-generation source verification**: audit every `intake_data` read in `lib/pbv/form-generation/*` and `app/api/t/[token]/pbv-full-app/generate-forms/`. Document which reads switched to snapshot and which already read from normalized.

## Build this pass (one commit per phase)

### Phase 1 — Schema + write path

1. **F1 + F5 schema** — Create `supabase/migrations/<YYYYMMDD>_pbv_intake_snapshot.sql` with the `ALTER TABLE`, the immutability trigger function, the trigger, and the resume_section backfill from the PRD's "Data Model" section. Test in local PGlite.
   Commit: `feat(pbv-schema): add intake_snapshot, resume_section columns + immutability trigger (F1)`

2. **F2** — `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`: inside the existing transaction, after validation and before stamping `intake_status = 'complete'`:
   - Validate `intake_data` against `IntakeData` (use existing schema or add Zod)
   - Write to `intake_snapshot` and `intake_snapshot_at`
   - Per open decision: clear `intake_data = '{}'::jsonb` (or leave)
   - Continue with existing bridge logic
   Add a unit test: `/intake/complete` populates `intake_snapshot` matching the prior `intake_data`. Second call to the same endpoint must NOT overwrite `intake_snapshot` (the trigger should reject it; verify with a SQL-level test).
   Commit: `feat(pbv-intake): write immutable intake_snapshot at /intake/complete (F2)`

3. **F5 write path** — `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts:55-69`: stop writing `_resume_section` into `intake_data`; UPDATE the `resume_section` column instead. Keep `_last_saved_at` write as-is.
   Commit: `refactor(pbv-intake): resume_section as column on writes (F5 part 1)`

### Phase 2 — Read path

4. **F3** — `app/api/t/[token]/pbv-full-app/route.ts`: add `intake_snapshot, intake_snapshot_at, resume_section` to the `.select()`. In the response object, when `intake_status = 'complete'`, return `intake_data: app.intake_snapshot ?? {}` (so client code keeps reading from `intake_data`). When in-progress, return `intake_data: app.intake_data ?? {}`. Add `resume_section` to the response.
   Commit: `feat(pbv-bootstrap): serve snapshot when complete; expose resume_section (F3)`

5. **F4** — Audit `lib/pbv/form-generation/*` and `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` for every `intake_data` read. Switch any direct DB reads of `intake_data` to read `intake_snapshot` first, falling back to `intake_data` only if snapshot is null (handles in-flight legacy rows pre-backfill). Document each touched file in the commit body.
   Commit: `refactor(pbv-forms): form generation reads intake_snapshot (F4)`

6. **F5 read path** — Replace all `(intakeData as any)?._resume_section` with the new `resume_section` field exposed by bootstrap. Sites: `app/pbv-full-app/[token]/intake/page.tsx:90`, `app/pbv-full-app/[token]/page.tsx:491`. Remove `_resume_section?: SectionSlug` from `IntakeData` in `lib/pbv/intake-schema.ts`.
   Commit: `refactor(pbv-intake): resume_section as column on reads, remove from IntakeData type (F5 part 2)`

### Phase 3 — Backfill + cleanup

7. **F6** — Write `scripts/backfill-intake-snapshots.ts`:
   - Default `--dry-run` mode logs every row that would change with a sample of the data
   - `--commit` mode actually performs the UPDATE
   - For each `pbv_full_applications` where `intake_status = 'complete'` AND `intake_snapshot IS NULL`:
     - Set `intake_snapshot = intake_data`
     - Set `intake_snapshot_at = COALESCE(submitted_at, updated_at, NOW())`
   - Print summary count at the end
   Run dry-run, present output to Alex, get green light, run with `--commit`.
   Commit: `chore(pbv-data): backfill intake_snapshot for existing completed applications (F6)`

8. **F5 cleanup** — After verifying F5 read path is good in production: `UPDATE pbv_full_applications SET intake_data = intake_data - '_resume_section' WHERE intake_data ? '_resume_section'`. Run as a one-off script or migration; no code change. Mention in commit body that this is post-deploy cleanup.
   Commit: `chore(pbv-data): remove _resume_section from intake_data JSONB (F5 cleanup)`

9. **F7** — Add a Sentry breadcrumb (or simple console.log → metric counter) inside the staff-side normalized-update paths: when a `pbv_household_members` field is updated and the corresponding `intake_snapshot` value differs, log it. Just visibility; no UI work.
   Commit: `feat(pbv-observability): log snapshot vs normalized drift (F7)`

## Verification before merging Phase 1+2

- New token end-to-end: walk the full intake → `/intake/complete` → confirm `intake_snapshot` populated, `intake_data` cleared, `resume_section` column updated mid-intake
- Old token (post-backfill): visit dashboard; Review page renders from snapshot; data matches what was in `intake_data` before backfill
- Manual SQL test: try to UPDATE `intake_snapshot` directly. Trigger should raise.

## Build report requirements

- Migration file path
- All open decisions resolved with rationale
- Backfill dry-run output (row count, sample 5 rows)
- Backfill commit run output
- Smoke test results (token IDs)
- Any form-generation reads that did NOT switch to snapshot, with reasoning
