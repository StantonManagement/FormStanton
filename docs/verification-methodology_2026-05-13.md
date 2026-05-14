# Save-Path Verification Methodology

*Extracted from event-substrate-generalization build, 2026-05-13. Revised 2026-05-14.*

This document defines the verification standard for save-path tests in the FormStanton codebase. It applies to any feature that writes rows to `application_events` or a similar event table.

---

## Standard 1 — Schema coverage

The PGlite test harness (`lib/__tests__/_db.ts`) contains a hand-maintained `MINIMAL_SCHEMA` constant covering **exactly two real tables** in scope for PBV save-path tests:

- `pbv_full_applications`
- `application_events`

All other tables in the harness are **stub tables** (single primary key column, plus any additional columns the tests INSERT). Stubs exist only to satisfy FK references. They are intentionally divergent from production and are NOT subject to drift checking.

**Scope rule:** Tables in scope for PBV save-path tests are `pbv_full_applications` and `application_events`. When a new workflow (e.g. refi, HACH intake) adds save-path tests, those tests add their own tables to the scope — either by extending `MINIMAL_SCHEMA` (if they share the `_db.ts` harness) or by creating a separate harness file scoped to that workflow. The harness does not attempt to mirror all of production.

---

## Standard 2 — No mocks in save-path tests

Save-path integration tests wire the event-write logic directly to PGlite via `rawQuery`. No Supabase client mocks. No HTTP interception. The test exercises the exact column names and types the helper writes, against the exact schema defined in `MINIMAL_SCHEMA`.

If a test requires a mock to run, it is a unit test, not a save-path integration test.

---

## Standard 3 — Helper throws on DB errors

The event-write helper (`writeApplicationEvent`, `writePbvApplicationEvent`) throws a hard error on any Supabase/PGlite error. It does not swallow errors, return null, or log-and-continue. Tests that expect a write to fail must assert on the thrown error.

---

## Standard 4 — Schema-contract tests as schema guard

`schema-contract.test.ts` asserts:
- Column existence and data type for every column in `application_events`
- Nullability for every NOT NULL column
- CHECK constraint enforcement for `anchor_type`
- FK enforcement for `document_id`

If you rename a column, change a type, or add/remove a NOT NULL constraint in `MINIMAL_SCHEMA`, at least one schema-contract test will fail. That is intentional. Fix the helper and the test together — never relax the test to make it pass.

---

## Standard 5 — Drift check before every release

Run `npx tsx scripts/check-pbv-test-schema-drift.ts` before cutting a release or applying a migration that touches `pbv_full_applications` or `application_events`.

The script compares `MINIMAL_SCHEMA` column names and data types against the live production database for those two tables. It exits non-zero on any drift.

**When drift is detected:** Update `MINIMAL_SCHEMA` to match production, re-run the drift check, then re-run `npm test`. Do not deploy with known drift.

**Stub tables are not checked.** The drift script explicitly excludes `form_submissions`, `form_submission_documents`, `form_submission_document_revisions`, and `admin_users`.

---

## Applying this methodology to a new workflow

1. Identify the table(s) the new workflow's helper writes to.
2. Add the table(s) to `MINIMAL_SCHEMA` (or create a new harness file).
3. Add any FK dependencies as stub tables with only the columns the tests INSERT.
4. Write schema-contract assertions for the new table's critical columns.
5. Write save-path tests using `rawQuery` — no mocks.
6. Add the new table to `scripts/check-pbv-test-schema-drift.ts` (or create a separate drift check script).
7. Run the drift check once against production before merging.
