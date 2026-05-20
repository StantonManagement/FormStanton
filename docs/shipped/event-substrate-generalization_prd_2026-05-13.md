# Event Substrate Generalization + Save-Path Verification Standard — PRD

**Status:** Draft — ready for review
**Date:** 2026-05-13
**Depends on:** `stanton-workspace-document-lifecycle` (shipped). Bug-fixed column names in `writeApplicationEvent` are the starting point.
**Blocks:** `pbv-packet-intake` (the packet intake build depends on a generic, working event substrate).

---

## Problem Statement

Two issues, intertwined, both surfaced by the workspace document lifecycle build:

**1. `application_events` is PBV-specific.** The shipped migration created the table with `full_application_id UUID NOT NULL REFERENCES pbv_full_applications(id) ON DELETE CASCADE`. That ties the event timeline to PBV applications by hard FK. Alex's standing architectural rule (memory: `reference_data_generic_ui_specific.md`) says data-layer tables generalize across workflows; PBV-specific shape belongs in API logic and UI. The shipped schema violates the rule. Refi, foreclosure, or any future workflow cannot use this substrate as-is and would either fork it or trigger a real migration with backfill.

**2. Save-path verification doesn't actually verify saves.** The lifecycle build was reported as PASS on every gate, including "End-to-end save verification." After ship, Windsurf discovered `writeApplicationEvent` was inserting into columns that don't exist (`application_id`, `metadata`, `actor_role` vs. actual `full_application_id`, `payload`, none) — every event write was silently failing for the entire build. The helper caught the error and logged it. Tests didn't catch it because `vi.mock('@/lib/supabase', …)` mocked the entire client. The build report's evidence for "save-path verification" was a prose description of the code pattern, not a paste of actual SQL output. The methodology allowed prose to substitute for execution.

If we generalize the schema without fixing the methodology, the same class of silent-write bug will recur on the rename. If we fix the methodology without generalizing the schema, the methodology stays in place but the substrate remains workflow-locked. Both belong in one build.

---

## Goals

1. **Polymorphic anchor on `application_events`.** Replace `full_application_id` (FK to `pbv_full_applications`) with `(anchor_type TEXT, anchor_id UUID)` and a CHECK constraint enumerating known anchor types. No FK to the anchor table; referential integrity is enforced at the application layer via a resolver helper.
2. **Helper API matches the new shape.** `writeApplicationEvent` takes `anchorType`/`anchorId`. A thin PBV wrapper `writePbvApplicationEvent` accepts `applicationId` and forwards to the generic helper with `anchor_type='pbv_full_application'`. All existing call sites in the codebase migrate to the wrapper. Future workflows add their own wrappers.
3. **Real-DB save-path test harness.** Replace mock-based testing for any save path with a real-DB integration test pattern. Establish this as the standard going forward; document it for future prompts.
4. **Schema-column-match smoke tests.** For every helper that writes to a DB column, an automatic test asserts that the column exists with the expected type. Prevents the next column-rename bug from being silent.
5. **Empirical health check.** Before declaring the migration done, hit a real mutation endpoint against the placeholder application, run a `SELECT` against `application_events`, paste the rows. No prose substitutes.
6. **Verification methodology documented.** A single page `docs/verification-methodology_2026-05-13.md` codifying the new save-path verification standard so future prompts can reference it.

---

## Non-Goals

- Refi or other future-workflow tables — none ship in this build. The CHECK constraint enumerates `'pbv_full_application'` only. When refi arrives, the CHECK adds one literal in a one-line migration.
- Reworking `pbv_access_log`. That table stays as-is per the lifecycle PRD.
- Workspace schema changes. The workspace tables already follow the data-generic pattern.
- A new test database infrastructure beyond what's needed for save-path tests. PGlite (in-process Postgres) is the proposed default for this build's tests; if Alex prefers a Supabase test branch or test project, decide before code.
- Backfilling `actor_role` (the helper was passing it; the migration didn't include it). The lifecycle PRD's intent was for `actor_role` to live in `metadata.actor_role` if needed. This build does not add a top-level column for it.

---

## Users & Roles

No user-facing changes. This is a substrate migration plus a test methodology change. The Send-to-HACH button, the lock banner, the per-row Upload — all visible behavior stays identical. The migration is invisible to staff and tenants.

---

## Core Features

### 1. Schema migration

Single atomic migration `supabase/migrations/20260513200000_application_events_generalize.sql`. Inside one transaction:

1. `ALTER TABLE application_events ADD COLUMN anchor_type TEXT, ADD COLUMN anchor_id UUID;`
2. `UPDATE application_events SET anchor_type = 'pbv_full_application', anchor_id = full_application_id;`
3. `ALTER TABLE application_events ALTER COLUMN anchor_type SET NOT NULL, ALTER COLUMN anchor_id SET NOT NULL;`
4. `ALTER TABLE application_events ADD CONSTRAINT application_events_anchor_type_check CHECK (anchor_type IN ('pbv_full_application'));`
5. `ALTER TABLE application_events DROP CONSTRAINT IF EXISTS <existing FK constraint name>;` (Cascade discovers the actual name.)
6. `ALTER TABLE application_events DROP COLUMN full_application_id;`
7. `CREATE INDEX idx_application_events_anchor ON application_events (anchor_type, anchor_id, created_at DESC);`
8. `DROP INDEX IF EXISTS <existing full_application_id index name>;`

Rollback block at top.

The migration assumes the table has not yet accumulated downstream consumers that lock onto `full_application_id` outside the helper. Cascade audits before writing the migration.

### 2. Helper rewrite

`lib/events/application-events.ts`:

- Generic `writeApplicationEvent({ anchorType, anchorId, eventType, actorUserId, actorDisplayName, documentId?, payload? })`.
- `anchorType` is a string-literal union: `'pbv_full_application'` for v1.
- PBV wrapper `writePbvApplicationEvent({ applicationId, ...rest })` calls the generic helper with `anchorType: 'pbv_full_application'` and `anchorId: applicationId`.
- All existing call sites migrate to the wrapper. Grep for `writeApplicationEvent` and convert any that pass `fullApplicationId` to pass `applicationId` through the wrapper.
- Helper throws on any DB error — never silently catches. The previous catch-and-log behavior is what hid the column mismatch in the first place. If a caller wants to swallow errors, they do it explicitly at the call site.

A new sibling `lib/events/anchor.ts` exports `resolveAnchor(anchorType, anchorId)` returning the anchor row from whichever table the type maps to (`pbv_full_applications` for v1). Used by future read paths that render events without knowing the anchor table up front. Throws on unknown anchor type. Comes with its own column-match smoke test.

### 3. Real-DB save-path test harness

Replace mock-based testing for save paths with a real-DB pattern. Decision: **PGlite (in-process Postgres) as the default for this build's tests.** Pros: no network, no external setup, fast iteration. Cons: not 1:1 with Supabase RLS or RPCs — but save-path tests don't need either; they need INSERT/SELECT/CONSTRAINT verification, which PGlite handles natively.

New `lib/__tests__/_db.ts`:

- Spins up a PGlite instance in `beforeAll`, applies all migrations from `supabase/migrations/` in chronological order, exposes a typed query function.
- `beforeEach` wipes data from a known set of tables (events, documents, applications, etc.) without re-running migrations.
- `afterAll` shuts down the PGlite instance.
- Exports a Supabase-compatible client wrapper backed by PGlite so existing helper code (which uses the Supabase admin client) can run unchanged in tests.

Existing tests stay (they cover guard logic and HACH payload filtering). New tests live alongside.

### 4. Save-path integration tests

For each save path that writes to `application_events`, a real-DB integration test:

- Staff upload (`POST …/documents/upload`) → row in `form_submission_documents` + row in `application_events` with `anchor_type='pbv_full_application'`, `anchor_id=<application_id>`, `event_type='document.uploaded_by_staff'`, correct `payload` shape.
- Approve / Reject / Waive → correct event rows.
- Re-categorize → correct event row.
- Send-to-HACH → `handoff.sent` event; correct columns on `pbv_full_applications`.
- Reopen → `handoff.reopened` event.

Each test:
1. Sets up fixtures (an application, a submission, a doc row).
2. Calls the route handler directly (no HTTP server) using PGlite-backed client.
3. Queries the DB and asserts: row count, column values, event payload shape, `created_at` ordering.

Negative tests:
- A handler that fails partway (e.g., document not found) writes zero event rows. Force the failure, assert zero rows.
- A handler that succeeds writes exactly one event row. Assert exactly one (not zero, not two).

### 5. Schema-column-match smoke tests

New `lib/__tests__/schema-contract.test.ts`:

For each helper that writes to a DB column, an assertion that runs against the live (PGlite-applied) schema:

- For each column the helper sets, query `information_schema.columns` and verify the column exists with the expected type.
- For each NOT NULL column, verify the helper provides a value (static code check via TypeScript types is fine; runtime check supplements it).
- For each CHECK constraint relevant to the helper's writes, simulate an invalid input and assert the constraint rejects it.

This is the smoke test that would have caught Windsurf's column mismatch in seconds.

### 6. Empirical health check

Before declaring done, a manual step (not a test):

1. Apply the migration to the local Supabase dev project.
2. Open the placeholder PBV application page.
3. Approve a document.
4. Run `SELECT id, anchor_type, anchor_id, event_type, actor_user_id, actor_display_name, document_id, payload, created_at FROM application_events ORDER BY created_at DESC LIMIT 5;` and paste the output into the build report.
5. Repeat for Reject, Waive, Upload, Re-categorize, Send-to-HACH, Reopen.

If any endpoint does not produce a visible event row, the migration is not complete and the build fails.

### 7. Verification methodology document

Create `docs/verification-methodology_2026-05-13.md`. One page. Codifies:

- Save-path tests must use a real DB (PGlite or equivalent). No `vi.mock('@/lib/supabase', …)` for tests that exercise a save path.
- "Save-path verification" sections in build reports must paste actual SQL query output and the actual returned rows. Prose descriptions of the expected code pattern do not satisfy the gate.
- Schema-column-match smoke tests are required for every helper that writes to a DB column.
- Empirical health checks are required before declaring done for any migration that changes a column or table referenced by application code.

Future prompts reference this document by path. The packet intake prompt's verification phase will cite it explicitly.

---

## Data Model

### Migration shape

See Core Feature 1.

### Helper signature (before/after)

**Before:**
```ts
writeApplicationEvent({
  fullApplicationId,
  eventType,
  actorUserId,
  actorDisplayName,
  documentId?,
  payload?,
})
```

**After (generic):**
```ts
writeApplicationEvent({
  anchorType,    // string-literal union, v1: 'pbv_full_application'
  anchorId,
  eventType,
  actorUserId,
  actorDisplayName,
  documentId?,
  payload?,
})
```

**After (PBV wrapper):**
```ts
writePbvApplicationEvent({
  applicationId,    // forwards to anchorId
  eventType,
  actorUserId,
  actorDisplayName,
  documentId?,
  payload?,
})
```

All existing call sites migrate to the PBV wrapper. The generic helper is exported but not called directly from PBV routes — it's the substrate, not the call-site ergonomic.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `application_events` | Migrate | Schema change |
| `lib/events/application-events.ts` | Rewrite | Helper signature + PBV wrapper |
| `lib/events/anchor.ts` | New | Resolver for polymorphic anchor reads |
| All callers of `writeApplicationEvent` | Migrate | Switch to `writePbvApplicationEvent` |
| `supabase/migrations/…document_lifecycle…` | Refer | Confirm the FK constraint name to drop |
| Existing test files | Augment | New integration tests alongside existing mock-based tests |
| `docs/verification-methodology_2026-05-13.md` | New | Methodology codification |

---

## Implementation Phases

### Phase 1 — Test harness

Establish PGlite-backed integration testing before touching schema or helper. Without the harness, the migration's behavioral changes are unverifiable.

**Deliverables:**
- `lib/__tests__/_db.ts` — PGlite setup, migration runner, table wiper, Supabase-client wrapper.
- At least one passing integration test using the harness, hitting a save path that currently exists (pre-migration). The test confirms the harness works end-to-end. Pick `POST …/documents/[docId]/approve` as the smoke target — it's simple, well-defined, already in the codebase.
- Documentation block in `_db.ts` explaining usage.

**Done when:**
- Harness applies all migrations cleanly to PGlite.
- The smoke test passes by querying the real DB and asserting an `application_events` row exists (with the pre-migration `full_application_id` shape).
- A deliberately-broken version of the smoke test (assert wrong column value) fails, confirming the test is actually observing the DB.

### Phase 2 — Schema-column-match smoke tests

Before the migration, the column-match tests document the current schema. After the migration, they document the new schema. The tests change shape between phases; that's expected.

**Deliverables:**
- `lib/__tests__/schema-contract.test.ts` covering every helper that writes to `application_events` (just `writeApplicationEvent` today).
- Tests assert column existence, type, and NOT NULL constraints.
- Tests assert CHECK constraints reject invalid input.

**Done when:**
- All assertions pass against the current (pre-migration) schema.
- A deliberately-introduced column drift (rename a column in a scratch migration) makes the tests fail.

### Phase 3 — Empirical health check of current state

Before changing anything, verify Windsurf's column-mismatch fix actually works.

**Deliverables:**
- Apply migrations to local dev DB.
- Hit each existing save path that should write an event (Approve, Reject, Waive, Upload, Re-categorize, Send-to-HACH, Reopen) against the placeholder application.
- Paste the resulting `SELECT … FROM application_events …` output for each into the build report.

**Done when:**
- Every save path produces the expected event row.
- If any does not, **STOP**. Diagnose before continuing. The generalization migration is meaningless if the substrate is still broken.

### Phase 4 — Schema migration

**Deliverables:**
- Migration file `supabase/migrations/20260513200000_application_events_generalize.sql` per Core Feature 1.
- Migration applies cleanly against PGlite (test harness) AND local dev DB.
- Schema-column-match tests updated to assert the new column shape; pass.

**Done when:**
- Migration applies idempotently (re-running it is a no-op).
- `\d application_events` shows `anchor_type`, `anchor_id`, the CHECK constraint, the new index, no `full_application_id`.
- Rollback comment block at top is correct.

### Phase 5 — Helper rewrite and caller migration

**Deliverables:**
- `lib/events/application-events.ts` rewritten per Core Feature 2.
- `lib/events/anchor.ts` created with `resolveAnchor` and its column-match smoke test.
- Every call site of the old helper updated to use `writePbvApplicationEvent`.
- The helper no longer catches DB errors silently — it throws.

**Done when:**
- `git grep -E "writeApplicationEvent\b"` shows only the helper definition and the wrapper. All call sites use the wrapper.
- TypeScript strict compiles.
- All existing tests (including the mock-based ones in `document-lifecycle-phase1.test.ts` and `document-lifecycle-phase2.test.ts`) continue to pass after appropriate type-level updates.

### Phase 6 — Save-path integration tests

**Deliverables:**
- Integration tests per Core Feature 4, covering every save path that writes an event.
- Tests use the Phase 1 harness; assert row counts, column values, payload shapes.
- Negative tests confirm partial failures don't write events.

**Done when:**
- Every save path has a passing integration test.
- Each test queries the DB after the handler runs (not before, not via mock).
- Coverage report shows the helper code path is exercised by the tests.

### Phase 7 — Empirical post-migration health check

Same as Phase 3, repeated after the migration ships.

**Deliverables:**
- Run each save path against the placeholder application.
- Paste each `SELECT` output into the build report.
- Confirm `anchor_type` and `anchor_id` are populated correctly.

**Done when:**
- Every save path produces the expected event row in the new shape.

### Phase 8 — Methodology document

**Deliverables:**
- `docs/verification-methodology_2026-05-13.md` per Core Feature 7.

**Done when:**
- The document is one page or shorter.
- It explicitly forbids `vi.mock('@/lib/supabase', …)` for save-path tests.
- It explicitly requires SQL output paste for save-path verification.
- It is referenced from the packet intake prompt's verification phase (a one-line addition to that prompt — Cascade adds it as part of this build).

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Migration runs on a DB that has rows in `application_events` and the backfill misses some (e.g., NULL `full_application_id`) | The migration's `UPDATE` statement happens before the NOT NULL constraint. After backfill, a final `SELECT COUNT(*) WHERE anchor_id IS NULL` assertion runs; if non-zero, the migration aborts. |
| FK constraint drop fails because the name differs from what Cascade expects | The migration queries `information_schema.table_constraints` for the actual constraint name and uses `EXECUTE` to drop it dynamically. Captured in the rollback comment. |
| PGlite doesn't support a Postgres feature the migration uses (e.g., a specific function) | Run each migration through PGlite in CI; if PGlite errors, switch to testcontainers-postgres for affected tests. Document the mitigation in `_db.ts`. |
| Existing tests break because they assert on `full_application_id` | Existing mock-based tests don't assert on DB columns (they're pure logic / type tests), so the rename should be invisible to them. Verify by running the full test suite mid-Phase-5. |
| A call site is missed in the migration to the wrapper | Phase 6's integration tests run every save path; any orphaned call site produces a different event-write path that the tests will surface. |
| The "fail loudly" rewrite of the helper now propagates errors that route handlers were swallowing | Audit every call site as part of Phase 5: any caller that previously relied on the silent failure (none should — that was the bug) needs explicit error handling. Document each caller's behavior. |

---

## Acceptance Criteria

- [ ] Migration applies cleanly to PGlite AND local dev DB. Idempotent.
- [ ] `application_events` has `anchor_type`, `anchor_id`, the CHECK constraint, the new index, no `full_application_id`.
- [ ] `writeApplicationEvent` takes `anchorType`/`anchorId`; `writePbvApplicationEvent` is the PBV wrapper; the helper throws on DB error.
- [ ] All call sites of the old helper migrated to the wrapper. `git grep` confirms.
- [ ] `lib/events/anchor.ts` exists with `resolveAnchor` and a passing column-match smoke test.
- [ ] PGlite-backed test harness exists in `lib/__tests__/_db.ts`.
- [ ] Schema-column-match tests in `lib/__tests__/schema-contract.test.ts` pass against the new schema.
- [ ] Save-path integration tests cover every event-writing path. Each test queries the DB after the handler runs.
- [ ] Negative tests confirm partial failures don't write events.
- [ ] Phase 7 empirical health check: every save path against the placeholder produces the expected event row with `anchor_type='pbv_full_application'`. SQL output pasted in build report.
- [ ] `docs/verification-methodology_2026-05-13.md` exists, is one page or shorter, and is referenced from at least one downstream prompt.
- [ ] No mock-based tests for save paths going forward. Existing mock-based tests for pure logic / type shapes stay.
