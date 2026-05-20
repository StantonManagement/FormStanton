# Windsurf Prompt — Event Substrate Follow-Ups

**PRD:** No separate PRD — this is a focused follow-up to `docs/event-substrate-generalization_prd_2026-05-13.md`. That PRD is the source of intent; this prompt closes three gaps the prior build left.
**Build report (you create this):** `docs/build-reports/event-substrate-followups_build-report_2026-05-14.md`
**Depends on:** `event-substrate-generalization` shipped. The polymorphic anchor migration, `writePbvApplicationEvent`, the PGlite harness, the save-path integration tests, and the 19 migrated route callers are all in place.
**Blocks:** `pbv-packet-intake` — that build cannot ship until these three gaps close.

---

## Why this exists

The prior build delivered the schema generalization and the helper rewrite, but left three gaps. They are not aesthetic — each one materially weakens the verification methodology the prior build was supposed to establish. The packet intake prompt depends on this methodology being trustworthy. Until these close, future builds can silently break the same way the lifecycle build did.

The three gaps, named for what they are:

**1. The PGlite harness verifies against a hand-maintained schema, not real migrations.** `lib/__tests__/_db.ts` defines `MINIMAL_SCHEMA` and `MINIMAL_SCHEMA_POST_MIGRATION` as string literals, hand-edited to mirror what production migrations produce. The PRD's intent was for the harness to apply the real `supabase/migrations/` files. Cascade chose the hand-maintained path with this note: *"60+ production migrations reference Supabase-specific roles/functions unavailable in PGlite."* Reasonable observation; wrong escape hatch. Hand-maintenance means a future migration touching `application_events` (or any FK dependency) requires a parallel edit to `_db.ts`. If forgotten, schema-contract tests stay green while production diverges. That is exactly the failure mode the prior build was trying to prevent.

**2. Phase 7 was a data check, not a write check.** The post-migration verification ran `SELECT … FROM application_events` against the existing seven rows backfilled by the migration. It did NOT re-trigger each save path after the helper rewrite to confirm new writes land correctly. Likely they do — but unverified.

**3. The methodology document is buried inside the build report.** The prior PRD called for a standalone `docs/verification-methodology_2026-05-13.md` so future prompts could cite it by path. Instead, the methodology lives as section 4 of `docs/build-reports/event-substrate-generalization_build-report_2026-05-14.md`. Future prompts can't reference a file that doesn't exist. The packet intake prompt was supposed to get a one-line reference in this same build; it didn't.

---

## Required reading before you start

1. **`docs/event-substrate-generalization_prd_2026-05-13.md`** — for context on the substrate this build operates on.
2. **`docs/event-substrate-generalization_prompt_2026-05-13.md`** — what the prior build was told to do.
3. **`docs/build-reports/event-substrate-generalization_build-report_2026-05-14.md`** — what the prior build reported. Section 4 is the methodology that needs promotion.
4. **`lib/__tests__/_db.ts`** — the harness with the hand-maintained schema you are replacing.
5. **`lib/__tests__/schema-contract.test.ts`** and **`lib/__tests__/save-path-integration.test.ts`** — the tests that consume the harness. Both keep working after the harness change.
6. **`supabase/migrations/` directory listing** — chronological order. You need to know what's there before you write the loader.
7. **A representative cross-section of migrations**: read the first migration, the most recent migration, and at least three RLS-policy-heavy ones to understand the Supabase-specific clauses you'll filter.
8. **`docs/pbv-packet-intake_prompt_2026-05-13.md`** — the prompt that needs the methodology reference added.

---

## Build this pass

Three deliverables. They are sequential — do them in order. Each has its own verification.

### Deliverable 1 — Replace hand-maintained schema with a real-migration loader

**Goal:** the harness applies actual files from `supabase/migrations/` to PGlite. The hand-maintained `MINIMAL_SCHEMA` and `MINIMAL_SCHEMA_POST_MIGRATION` constants go away entirely.

**The work:**

Create `lib/__tests__/_migration-loader.ts`:

- Exports `loadMigrationsForPGlite(): Promise<string>` — returns the concatenated DDL, ready to apply.
- Reads every `.sql` file in `supabase/migrations/` in chronological filename order.
- For each file, applies a documented filter pass that strips or transforms Supabase-specific clauses PGlite cannot handle. The filter is explicit and exhaustive:
  - `CREATE POLICY ... ` statements → strip (RLS policies are Supabase-runtime; tests don't enforce them).
  - `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` → strip.
  - `GRANT … TO {service_role|authenticated|anon}` → strip.
  - `REVOKE … FROM {service_role|authenticated|anon}` → strip.
  - References to `auth.uid()`, `auth.jwt()`, `auth.role()` in defaults or expressions → if encountered in a column that the tests touch, fail the loader with a clear error (forces the engineer to decide how to handle it for that specific column). If in a column tests don't touch, strip the default.
  - `storage.*` schema references → if a migration only references `storage.*`, skip the whole migration. Otherwise fail loudly.
  - Supabase-specific extensions (`CREATE EXTENSION IF NOT EXISTS "pg_net"`, similar) → strip.
- Each filtered file is wrapped in a `-- ===== <filename> =====` comment block in the concatenated output so failures point to the source file.

Update `lib/__tests__/_db.ts`:

- Delete `MINIMAL_SCHEMA` and `MINIMAL_SCHEMA_POST_MIGRATION` constants entirely.
- `setupTestDb()` calls `loadMigrationsForPGlite()` and applies the result to a fresh PGlite instance.
- Document at the top of `_db.ts` that the harness now applies real migrations through a filter, with a pointer to `_migration-loader.ts` for the filter rules.

Update `lib/__tests__/schema-contract.test.ts` if needed — the assertions should still pass because they reference the same column names and constraints; the schema is now derived from real migrations rather than hand-written.

Update `lib/__tests__/save-path-integration.test.ts` if needed — same reasoning.

**Hard NO:** do NOT leave the hand-maintained constants as a fallback. Delete them. If a migration's clause needs handling, handle it in the filter, not by maintaining a parallel schema.

**Done when:**
- `npm test -- harness-smoke` passes.
- `npm test -- schema-contract` passes.
- `npm test -- save-path-integration` passes (all 10 integration tests).
- `lib/__tests__/_db.ts` contains zero hand-written DDL.
- The filter rules in `_migration-loader.ts` are exhaustively documented inline.
- A deliberately-introduced column rename in a scratch migration (test locally, do NOT commit) makes schema-contract tests fail. This proves the harness now observes real migrations.

### Deliverable 2 — Post-migration write check

**Goal:** empirical proof that after the helper rewrite and migration, each of the seven save paths produces a correct event row in production.

**The work:** manual, against the local dev Supabase project.

For each of these actions, perform the action against the placeholder PBV application, then immediately run the SQL query and paste the result into the build report:

| Action | SQL |
|---|---|
| Approve a document | `SELECT anchor_type, anchor_id, event_type, actor_display_name, document_id, payload, created_at FROM application_events ORDER BY created_at DESC LIMIT 1;` |
| Reject a document | same |
| Waive a document | same |
| Staff upload a document | same |
| Re-categorize a document | same |
| Send-to-HACH (override mode is fine if pre-flight blocks) | same |
| Reopen | same |

For each row returned, verify:
- `anchor_type = 'pbv_full_application'`
- `anchor_id` matches the placeholder application UUID
- `event_type` matches the action
- `payload` contains the expected fields for that event type (per `EventPayloadMap` in `lib/events/application-events.ts`)
- `actor_display_name` is the staff user (not null, not "System" unless the action is system-authored)

If any action produces zero rows, **STOP**. The prior build's silent-failure mode has recurred. Diagnose before continuing.

**Done when:**
- Seven actions, seven rows pasted in section 2 of the build report.
- Every row has correct `anchor_type` and `anchor_id`.
- Every payload matches the event type's `EventPayloadMap` shape.

### Deliverable 3 — Promote methodology to standalone document + reference it

**Goal:** future prompts can cite the methodology by path.

**The work:**

Create `docs/verification-methodology_2026-05-13.md`. Source: section 4 of `docs/build-reports/event-substrate-generalization_build-report_2026-05-14.md`. Copy verbatim, then refine into a standalone reference:

- Reframe the document as a standing standard, not a one-build artifact. Drop references to "this build" or "the prior build."
- Add a short header explaining what the document is and when to consult it.
- Keep it one page or less (~500 words max).
- Cover the four standards already in the build report: schema-contract checks, helper usage rule, integration test requirement, post-deploy health check.
- Add a fifth standard explicitly: **helpers must throw on DB errors, never silently catch.** The prior build established this for `writeApplicationEvent`; the standard generalizes.

Update `docs/pbv-packet-intake_prompt_2026-05-13.md`:

- Find the "Verification phase (mandatory)" section.
- Add this line at the top of that section, before the numbered list:
  > **All verification gates below follow the standards in `docs/verification-methodology_2026-05-13.md`. In particular: save-path tests use the PGlite harness (no mocks of `@/lib/supabase`), save-path verification requires pasted SQL output (not prose), and the helper throws on DB errors.**
- No other changes to the packet intake prompt.

**Done when:**
- `docs/verification-methodology_2026-05-13.md` exists and is ≤500 words.
- The packet intake prompt's verification section references it by path.
- The five standards are clearly enumerated in the methodology doc.

---

## Tech constraints

- Next.js App Router; Vitest; TypeScript strict; no `any` in new code.
- No new dependencies (`@electric-sql/pglite` is already installed by the prior build).
- The migration loader runs synchronously at test setup; no file watching or hot-reload concerns.
- Filter rules are documented inline in `_migration-loader.ts`; not in a separate spec file.

---

## Hard NOs

- **Do NOT keep the hand-maintained `MINIMAL_SCHEMA` as a fallback.** Delete it. The whole point of this build is that the harness reads real migrations.
- **Do NOT silently skip migrations the filter doesn't know how to handle.** If the filter encounters a Supabase-specific clause it can't categorize, fail loudly with the file name and the offending statement. The engineer adding the migration extends the filter; the filter is not "best effort."
- **Do NOT change any production code in this build** other than the one-line addition to the packet intake prompt. The schema, the helper, the route handlers — all stay as the prior build left them. This is a test-infrastructure build plus a docs build.
- **Do NOT re-introduce mocks of `@/lib/supabase` in save-path tests.** Standing rule from the prior build.
- **Do NOT skip Deliverable 2 (the empirical write check).** Tests that pass against PGlite are necessary but not sufficient. Production behavior is the last check.
- **Do NOT auto-fix unrelated bugs you spot.** Note them in "Pre-existing issues observed."

---

## Verification phase (mandatory)

The methodology document this build creates is the canonical reference. All gates here cite it.

1. **Migration loader handles every migration in `supabase/migrations/`.** Run the loader; output applies cleanly to PGlite. If any migration falls through the filter, the loader threw a clear error and you extended the filter to handle it. Document which migrations needed which filter rules in section 1 of the build report.

2. **`npm test` passes.** Including `harness-smoke`, `schema-contract`, `save-path-integration`. All prior tests still green.

3. **Hand-maintained schema constants are gone.** `git grep -nE "MINIMAL_SCHEMA"` shows zero matches anywhere in the codebase. Paste the grep output in the build report.

4. **Schema drift detection works.** Locally introduce a column drift (rename a column in a scratch migration). Run `npm test -- schema-contract`. It fails. Revert the scratch change. Document this in the build report.

5. **Deliverable 2 — seven actions, seven rows.** Paste each SELECT result in section 2 of the build report. Verify each row's shape against `EventPayloadMap`.

6. **Methodology doc exists at `docs/verification-methodology_2026-05-13.md`** and is ≤500 words. Word count in section 3.

7. **Packet intake prompt references the methodology doc.** Grep the packet intake prompt for `verification-methodology`. Confirm the one-line addition is in place.

If any of 1–7 fails, **do not declare done.** Leave the task open, report what failed, await instruction.

---

## Build report requirements

Create `docs/build-reports/event-substrate-followups_build-report_2026-05-14.md`:

### 1. Migration loader
- Filter rules implemented, one bullet per rule.
- Per-migration handling: any migration that required a non-trivial filter decision, named with the rule that handled it.
- `npm test -- harness-smoke` output paste.
- Confirmation that `MINIMAL_SCHEMA` constants are deleted (grep output).
- Schema drift test result (item 4 from verification).

### 2. Post-migration write check — REAL SQL OUTPUT
For each of the seven save paths:
- Action description.
- Exact SQL run.
- Returned row (verbatim).
- Confirmation of `anchor_type`, `anchor_id`, `event_type`, `payload` shape.

This section MUST contain real SQL output. No prose substitutes.

### 3. Methodology document
- File path.
- Word count.
- The five standards listed.

### 4. Packet intake prompt update
- The one-line addition shown in context.

### 5. Test results
- Full Vitest output for `harness-smoke`, `schema-contract`, `save-path-integration`.

### 6. Deviations from this prompt
Reasoning. Empty if none.

### 7. Pre-existing issues observed
Anything broken or risky out of scope. Do not fix.

### 8. Verification phase results
Items 1–7 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report length and section count.
- Pass/fail status for each of verification items 1–7.
- Confirmation `MINIMAL_SCHEMA` constants no longer exist anywhere.
- Confirmation section 2 contains real SQL output.
- Confirmation the methodology doc and packet intake prompt update both exist.
- Anything that blocked you.

If any verification item fails, do not declare complete. Document the failure, stop, wait.
