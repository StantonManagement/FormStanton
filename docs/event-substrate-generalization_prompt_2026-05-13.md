# Windsurf Prompt — Event Substrate Generalization + Save-Path Verification Standard

**PRD:** `docs/event-substrate-generalization_prd_2026-05-13.md` (read end-to-end before writing any code)
**Build report (you create this):** `docs/build-reports/event-substrate-generalization_build-report_2026-05-13.md`
**Depends on:** `stanton-workspace-document-lifecycle` shipped. The column-mismatch fix in `lib/events/application-events.ts` (writing to `full_application_id`, `payload`, etc.) is the starting state.
**Blocks:** `pbv-packet-intake` — that build cannot ship until this one ships.

---

## Why this exists

The lifecycle build shipped with two defects that this build addresses together because they are causally linked:

1. **Schema is PBV-specific.** `application_events.full_application_id` is a hard FK to `pbv_full_applications`. Alex's standing rule (memory: data layer generalizes; UI stays workflow-specific) requires polymorphic anchors here.

2. **Save-path verification doesn't actually verify saves.** Every event write was silently failing for the entire lifecycle build because the helper inserted into nonexistent columns. The test suite missed it because every save-path test mocks `@/lib/supabase` entirely — no test touches a real DB. The build report scored "End-to-end save verification" as PASS by describing the code pattern in prose, not by pasting SQL output.

Generalizing the schema without fixing the methodology means the next column rename will silently break the same way. Fixing the methodology without generalizing the schema leaves the substrate locked to PBV. Both belong in one build.

---

## Test infrastructure — decided

**PGlite (`@electric-sql/pglite`).** Alex chose this; do not re-surface the question.

Reasoning: the save paths in scope are plain Postgres operations (INSERT/UPDATE/SELECT/CHECK/FK against regular tables). None touch Supabase Auth (routes use iron-session via `lib/auth.ts`), RLS (service-role bypass everywhere), Storage (file writes happen outside the test boundary), Edge Functions, or RPC. So the tests need "Postgres that behaves like the migrations expect," not "the full Supabase platform." PGlite is identical to real Postgres for what's being verified, runs in-process under Vitest (~100ms startup), needs no Docker / no cloud project / no env management.

Known limit, acknowledged: when the codebase later needs to test something Supabase-specific (an RLS policy, a Storage flow, an Edge Function), PGlite won't cover it. At that point a second test class is added alongside (likely a Supabase test branch) — not instead of. That's not in this build's scope.

The harness must expose a `supabase-js`-shaped wrapper backed by PGlite. The route handlers call `supabaseAdmin.from(...).select().eq().single()` etc., not raw Postgres. Build only the surface the actual save paths use — `from`, `select`, `insert`, `update`, `delete`, `eq`, `in`, `single`, `order`, `limit`. Anything beyond that is built when a test demands it.

---

## Required reading before you start

1. **`docs/event-substrate-generalization_prd_2026-05-13.md`** — entire document.
2. **`docs/stanton-workspace-document-lifecycle_prd_2026-05-13.md`** — for context on the substrate this build modifies.
3. **`docs/build-reports/stanton-workspace-document-lifecycle_build-report_2026-05-13.md`** — read sections 2 and 3 (save-path verification, lock enforcement) to understand what was claimed and how. The methodology problem becomes visible.
4. **`lib/events/application-events.ts`** — the helper as it exists post-fix. Note the current column names: `full_application_id`, `actor_display_name`, `payload`, no `actor_role`. Note the catch-and-log on DB errors — that's part of what's getting removed.
5. **The migration that created `application_events`** — likely in `supabase/migrations/2026051*_document_lifecycle*.sql`. Find it and read it. Note the actual FK constraint name (Cascade needs it for the DROP CONSTRAINT statement).
6. **`lib/__tests__/document-lifecycle-phase1.test.ts` and `phase2.test.ts`** — read the `vi.mock` line at the top. Understand why these tests missed the bug.
7. **`supabase/migrations/` directory** — the chronological order of migrations. Your harness applies them all in order.
8. **`lib/supabase.ts`** — how the admin client is constructed. Your PGlite wrapper needs to match its surface.
9. **An existing route handler that calls `writePbvApplicationEvent` (or `writeApplicationEvent` today)** — e.g., `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts`. Understand how it's called so the integration test can hit it directly without an HTTP server.
10. **`package.json`** — confirm Vitest version and whether `pglite` (or `@electric-sql/pglite`) is already a dependency. If not, you'll add it.

---

## Build this pass

The PRD lists eight phases. They are sequential — each builds on the one before. Do not parallelize.

### Phase 1 — Test harness (PGlite-backed)

Create `lib/__tests__/_db.ts`:

- Imports PGlite (add `@electric-sql/pglite` to dependencies if not present).
- Exports `setupTestDb()`: creates a fresh PGlite instance in memory, reads every file in `supabase/migrations/` in chronological order, applies each. Throws on any error.
- Exports `wipeTestData(tables: string[])`: `DELETE FROM` each table in dependency-safe order. Used in `beforeEach`.
- Exports `getTestSupabaseClient()`: returns an object that matches the surface of the Supabase admin client (`from`, `rpc`, etc.) backed by PGlite. The minimum useful surface is `from(table).select`, `from(table).insert`, `from(table).update`, `from(table).delete`, with `.eq()`, `.in()`, `.single()`, `.order()`, `.limit()` chaining. Build only what the actual save paths use.
- Exports `teardownTestDb()`: shuts down the PGlite instance.
- Includes a documentation block at the top explaining usage with a 10-line example.

Create one smoke test `lib/__tests__/harness-smoke.test.ts`:

- Uses the harness to set up a DB.
- Inserts a fixture row directly.
- Queries it back.
- Asserts the row exists with the expected values.
- Deliberately inverts an assertion (in a commented-out variant) to confirm the test would fail if observation broke.

**Done when:**
- `npm test -- harness-smoke` passes.
- The deliberately-broken variant fails when uncommented (commit only the passing version).

### Phase 2 — Schema-column-match smoke tests

Create `lib/__tests__/schema-contract.test.ts`:

- Sets up the harness in `beforeAll`.
- For `application_events`: asserts each column the current helper writes exists in `information_schema.columns` with the expected type. Pre-migration, this means asserting `full_application_id UUID NOT NULL`, `event_type TEXT NOT NULL`, `actor_user_id UUID NULL`, `actor_display_name TEXT NULL`, `document_id UUID NULL`, `payload JSONB NULL`, `created_at TIMESTAMPTZ NOT NULL`.
- Asserts NOT NULL constraints by attempting an INSERT with a NULL value for each NOT NULL column and asserting Postgres rejects it.
- Asserts the FK constraint exists by attempting an INSERT with a `full_application_id` that doesn't exist in `pbv_full_applications` and asserting rejection.

After Phase 4 (migration), these assertions get rewritten to match the new schema. The Phase 4 verification is partly: did the schema-contract tests still pass after I updated them? If they're trivial to make pass without thinking, you've fallen back into prose-not-execution. Each assertion must observe the live schema.

**Done when:**
- `npm test -- schema-contract` passes against the pre-migration schema.
- Inserting an introduced column drift (test locally by renaming a column in a scratch migration) makes the tests fail.

### Phase 3 — Empirical pre-migration health check

**You do this manually against the local Supabase dev DB, not against PGlite.** This confirms Windsurf's column-mismatch fix actually wrote rows after the prior session restored the function.

Steps:

1. Apply all migrations to local dev DB.
2. Open the placeholder PBV application page (`/admin/pbv/full-applications/<placeholder-id>`).
3. For each of the following actions, perform the action, then immediately run the corresponding SQL and paste the result into the build report:

   - Approve a document: `SELECT id, full_application_id, event_type, actor_display_name, document_id, payload, created_at FROM application_events ORDER BY created_at DESC LIMIT 1;`
   - Reject a document: same query.
   - Waive a document: same query.
   - Staff upload a document: same query.
   - Re-categorize a document: same query.
   - Send-to-HACH (if pre-flight passes): same query.
   - Reopen (after Send-to-HACH): same query.

4. For each action, confirm the returned row has the expected `event_type` and `payload`.

**Done when:**
- Every action produces an expected row.
- The SQL output for each action is pasted into section 3 of the build report verbatim.

**If any action produces zero rows, STOP.** Diagnose. The migration in later phases is meaningless if events still aren't being written.

### Phase 4 — Schema migration

Create `supabase/migrations/20260513200000_application_events_generalize.sql`.

The migration runs in one transaction:

```sql
-- Rollback comment block at top
BEGIN;

ALTER TABLE application_events ADD COLUMN anchor_type TEXT;
ALTER TABLE application_events ADD COLUMN anchor_id UUID;

UPDATE application_events SET anchor_type = 'pbv_full_application', anchor_id = full_application_id;

-- Assert backfill is complete before locking the columns down
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM application_events WHERE anchor_id IS NULL) THEN
    RAISE EXCEPTION 'application_events generalization: backfill incomplete — rows with NULL anchor_id remain';
  END IF;
END $$;

ALTER TABLE application_events ALTER COLUMN anchor_type SET NOT NULL;
ALTER TABLE application_events ALTER COLUMN anchor_id SET NOT NULL;

ALTER TABLE application_events
  ADD CONSTRAINT application_events_anchor_type_check
  CHECK (anchor_type IN ('pbv_full_application'));

-- Drop the existing FK constraint by querying its actual name
DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'application_events'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = 'application_events'::regclass AND attname = 'full_application_id')];
  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE application_events DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE application_events DROP COLUMN full_application_id;

-- Drop the old index if it exists, by name
DROP INDEX IF EXISTS idx_application_events_full_app;

CREATE INDEX idx_application_events_anchor
  ON application_events (anchor_type, anchor_id, created_at DESC);

COMMIT;
```

Idempotent: the migration uses `IF EXISTS` / `IF NOT EXISTS` where applicable, but the column rename is inherently one-shot. To make re-runs safe, wrap each ALTER in a conditional:

```sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='application_events' AND column_name='full_application_id') THEN
    -- the steps above
  END IF;
END $$;
```

Cascade decides the exact idempotency pattern. The result must be: running the migration twice has no effect on the second run.

Rollback comment block at the top describing the inverse operation.

Update `lib/__tests__/schema-contract.test.ts` to assert the new schema. The tests must now reject `full_application_id` (it's gone) and assert `anchor_type` / `anchor_id` / the CHECK constraint.

**Done when:**
- Migration applies cleanly to PGlite (via harness) and to local dev DB.
- Re-running the migration is a no-op.
- `\d application_events` shows the new shape.
- Schema-contract tests pass.

### Phase 5 — Helper rewrite + caller migration

Rewrite `lib/events/application-events.ts`:

```ts
// Pseudocode shape — Cascade implements faithfully

export type AnchorType = 'pbv_full_application';

export interface WriteApplicationEventParams<T extends ApplicationEventType> {
  anchorType: AnchorType;
  anchorId: string;
  eventType: T;
  actorUserId: string | null;
  actorDisplayName: string;
  documentId?: string | null;
  payload?: EventPayloadMap[T];
}

export async function writeApplicationEvent<T extends ApplicationEventType>(
  params: WriteApplicationEventParams<T>
): Promise<{ id: string }> {
  const { error, data } = await supabaseAdmin
    .from('application_events')
    .insert({
      anchor_type: params.anchorType,
      anchor_id: params.anchorId,
      event_type: params.eventType,
      actor_user_id: params.actorUserId,
      actor_display_name: params.actorDisplayName,
      document_id: params.documentId ?? null,
      payload: params.payload ?? {},
    })
    .select('id')
    .single();

  if (error) throw error;        // <-- NO silent catch. This is the standing rule now.
  return { id: data.id };
}

export async function writePbvApplicationEvent<T extends ApplicationEventType>(
  params: Omit<WriteApplicationEventParams<T>, 'anchorType' | 'anchorId'> & { applicationId: string }
): Promise<{ id: string }> {
  return writeApplicationEvent({
    ...params,
    anchorType: 'pbv_full_application',
    anchorId: params.applicationId,
  });
}
```

Migrate every caller:

1. `git grep -nE "writeApplicationEvent\b"` to find all references.
2. Each call site that passes `fullApplicationId` becomes a call to `writePbvApplicationEvent` passing `applicationId`.
3. No direct calls to `writeApplicationEvent` remain in PBV route handlers. The generic helper is exported for future wrappers (refi, etc.) but not used by PBV directly.
4. The previously-silent error-swallowing in the helper is gone. Audit each caller: any route handler that previously relied on the silent failure (none should — that's the bug) gets explicit error handling. Document each in the build report.

Create `lib/events/anchor.ts`:

```ts
export async function resolveAnchor(anchorType: AnchorType, anchorId: string): Promise<unknown> {
  switch (anchorType) {
    case 'pbv_full_application': {
      const { data, error } = await supabaseAdmin
        .from('pbv_full_applications')
        .select('*')
        .eq('id', anchorId)
        .single();
      if (error) throw error;
      return data;
    }
    default: {
      const _exhaustive: never = anchorType;
      throw new Error(`Unknown anchor type: ${_exhaustive}`);
    }
  }
}
```

Add a column-match smoke test for `resolveAnchor` to `schema-contract.test.ts`.

**Done when:**
- `git grep -nE "writeApplicationEvent\b"` shows only the helper definition and `writePbvApplicationEvent`.
- TypeScript strict compiles.
- All existing tests (including the mock-based ones) continue to pass after type-level updates.
- `resolveAnchor` correctly returns a row for a valid `pbv_full_application` anchor and throws for an unknown anchor type.

### Phase 6 — Save-path integration tests

Create `lib/__tests__/save-paths.integration.test.ts`:

For each route below, a real-DB integration test:

| Route | Expected event | Assertions |
|---|---|---|
| `POST …/documents/upload` | `document.uploaded_by_staff` | `anchor_type='pbv_full_application'`, `anchor_id=<app_id>`, `document_id=<doc_id>`, `payload.doc_type` correct, `payload.label` correct |
| `POST …/documents/[docId]/approve` | `document.approved` | same anchor/doc, `payload.doc_type` correct |
| `POST …/documents/[docId]/reject` | `document.rejected` | same anchor/doc, `payload.rejection_reason` correct |
| `POST …/documents/[docId]/waive` | `document.waived` | same anchor/doc |
| `POST …/documents/[docId]/categorize` | `document.recategorized` | `payload.from_doc_type`, `payload.to_doc_type` correct |
| `POST …/send-to-hach` | `handoff.sent` | `payload.hach_review_status='pending_hach'`, `payload.hach_packet_revision=1` |
| `POST …/reopen` | `handoff.reopened` | event present after a prior `handoff.sent` |

Each test:
1. `beforeEach`: wipe `application_events`, `form_submission_documents`, `pbv_full_applications`, `form_submissions`. Seed fresh fixtures.
2. Call the route handler directly using the PGlite-backed Supabase client.
3. Query `application_events` after the handler returns. Assert row count, column values, payload shape, `created_at` is recent.

Negative tests:
- Force a route handler to fail mid-mutation (e.g., reject by approving a doc that doesn't exist). Assert zero event rows are written.
- Force the helper to fail (e.g., pass an invalid `anchor_type`). Assert the route handler propagates the error rather than swallowing it.

**Done when:**
- Every route in the table has a passing integration test.
- Negative tests pass.
- Tests query the DB after the handler runs — verify by reading the test code.
- Coverage report (if available) shows `writeApplicationEvent` is exercised.

### Phase 7 — Empirical post-migration health check

Repeat Phase 3 manually against local dev DB **after applying the migration** and **after the helper rewrite is deployed**.

For each action, paste the SELECT output. The query now uses the new column names:

```sql
SELECT id, anchor_type, anchor_id, event_type, actor_display_name, document_id, payload, created_at
FROM application_events
ORDER BY created_at DESC
LIMIT 1;
```

Expected: `anchor_type='pbv_full_application'`, `anchor_id` matches the application UUID, `event_type` matches the action.

**Done when:**
- Every save path produces the expected event row in the new shape.
- SQL output for each action pasted into section 7 of the build report.

### Phase 8 — Verification methodology document

Create `docs/verification-methodology_2026-05-13.md`. One page or less. Contents:

- **Save-path tests must use a real DB.** No `vi.mock('@/lib/supabase', ...)` in tests that exercise a save path. PGlite is the default; alternative test infrastructures are allowed but must be justified per-build.
- **Save-path verification gates require pasted SQL output**, not prose descriptions of the expected code pattern. Format: `psql> SELECT … ;` followed by the returned rows. Zero rows = failed gate.
- **Schema-column-match smoke tests are mandatory** for every helper that writes to a DB column. Tests assert column existence, type, NOT NULL, and CHECK constraints against the live schema.
- **Empirical health checks** are mandatory before declaring done for any migration that changes a column or table referenced by application code. Manual step. SQL output pasted in build report.
- **Helpers do not silently catch DB errors.** They throw. Callers handle explicitly.

Update the packet intake prompt (`docs/pbv-packet-intake_prompt_2026-05-13.md`) to reference this document by path in its verification phase. One-line addition. Cascade does this as part of this build's deliverables.

**Done when:**
- The methodology document exists and is one page or less.
- The packet intake prompt references it.

---

## Tech constraints

- Next.js App Router
- Supabase admin client (real) for prod code; PGlite-backed shim for tests
- TypeScript strict — no `any` in new code
- Vitest
- New dep allowed: `@electric-sql/pglite` (or equivalent PGlite package). No other new libraries.
- Use `gen_random_uuid()` for IDs
- Migrations are idempotent

---

## Hard NOs

- **Do NOT mock `@/lib/supabase` in any new save-path test.** That's the entire failure mode being fixed. New tests use the PGlite-backed harness.
- **Do NOT re-introduce silent catch-and-log in the events helper.** Errors throw. Callers handle explicitly.
- **Do NOT collapse the migration into the helper rewrite or vice versa.** They are sequential phases. The migration ships first; the helper rewrite ships second; otherwise there's a window where the helper writes to columns that don't exist (which is how we got here).
- **Do NOT skip Phase 3 (pre-migration health check).** If the substrate is still broken from the lifecycle build, the generalization migration is meaningless. The pre-migration check confirms the substrate works *before* you change it.
- **Do NOT skip Phase 7 (post-migration health check).** That's the actual proof the migration worked end-to-end. Tests are necessary but not sufficient.
- **Do NOT add anchor types beyond `'pbv_full_application'`** in this build. Refi gets added when refi ships. The CHECK constraint and the TypeScript union both have exactly one value today.
- **Do NOT auto-fix unrelated bugs you spot.** Note them in "Pre-existing issues observed."
- **Do NOT introduce placeholder code or TODOs.**

---

## Verification phase (mandatory)

The verification gate language in this prompt is the new standard. Refer to `docs/verification-methodology_2026-05-13.md` (which you create in Phase 8) for the canonical version.

1. **Migration applies clean.** PGlite via harness AND local dev DB. Idempotent (re-running is a no-op).
2. **`npm run build` succeeds.** Zero errors.
3. **TypeScript compiles strict.** No new `any`.
4. **`npm test` passes.** Every existing test green. Every new test green.
5. **Schema-contract tests pass against the new schema.** Including the smoke test for `resolveAnchor`.
6. **Save-path integration tests pass.** Each one queries the DB after the handler runs.
7. **Pre-migration health check (Phase 3)**: SQL output pasted for every save path, every action produces an event row in the OLD shape.
8. **Post-migration health check (Phase 7)**: SQL output pasted for every save path, every action produces an event row in the NEW shape with correct `anchor_type` and `anchor_id`.
9. **`git grep -nE "writeApplicationEvent\b"` shows only the helper definition and `writePbvApplicationEvent`.** Paste the grep output.
10. **`git grep -nE "full_application_id"` shows zero matches in `app/`, `lib/`, `components/`.** (Migrations are allowed to reference it.)
11. **Verification methodology document exists** at `docs/verification-methodology_2026-05-13.md`, is one page or less, and is referenced from the packet intake prompt.

If any of 1–11 fails, **do not declare done.** Leave the task open, report what failed, await instruction.

---

## Build report requirements

Create `docs/build-reports/event-substrate-generalization_build-report_2026-05-13.md`:

### 1. Pre-build decisions
- Test infrastructure: PGlite (`@electric-sql/pglite`) — decided by Alex, no re-surfacing.
- Any deviation from PRD.

### 2. Files created / modified
- Migration file, harness, smoke tests, integration tests, helper rewrite, anchor helper, methodology doc, packet intake prompt one-line update.

### 3. Pre-migration health check (Phase 3) — REAL SQL OUTPUT
For each save path, paste:
- Action description.
- The exact SQL run.
- The actual rows returned (or "0 rows" if zero — which means STOP).

This section MUST contain real `psql` output (or Supabase SQL editor output). No prose substitutes.

### 4. Migration verification
- `\d application_events` output before and after.
- Confirmation of idempotency: re-run output ("0 rows affected" or equivalent).

### 5. Helper rewrite + caller migration
- `git grep` output proving no orphan callers of the generic helper.
- List of every modified call site with one-line summary.

### 6. Schema-contract test results
- Test output.
- Confirmation each column the helper writes is asserted to exist.

### 7. Save-path integration test results
- Full Vitest output.
- For each route in the table, confirmation that the test queries the DB after the handler runs (cite the test line).

### 8. Post-migration health check (Phase 7) — REAL SQL OUTPUT
Same format as section 3 but against the new schema. Every action produces an event row with `anchor_type='pbv_full_application'`.

### 9. Verification methodology document
- File path.
- Word count (must be ≤ 500).
- Confirmation it is referenced from the packet intake prompt.

### 10. Deviations from PRD
Reasoning. Empty if none.

### 11. Pre-existing issues observed
Anything broken or risky out of scope. Do not fix.

### 12. Verification phase results
Items 1–11 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines) and section count.
- For each Verification phase item (1–11), pass/fail status.
- Confirmation sections 3 and 8 contain real SQL output, not prose.
- Confirmation `git grep` shows zero orphan calls to the old helper.
- Confirmation no new test mocks `@/lib/supabase` for a save path.
- Anything that blocked you.

If any verification item fails, do not declare complete. Document the failure, stop, wait.
