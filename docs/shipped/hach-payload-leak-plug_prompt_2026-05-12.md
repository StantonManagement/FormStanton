# Windsurf Prompt — HACH Payload Leak Plug

**PRD:** `docs/hach-payload-leak-plug_prd_2026-05-12.md` (read it completely before doing anything else)
**Build report (you create this):** `docs/build-reports/hach-payload-leak-plug_build-report_2026-05-12.md`

---

## Context

The HACH reviewer portal endpoint at `app/api/hach/applications/[id]/route.ts` currently selects Stanton-internal fields (`stanton_review_notes`, document-level `notes`/`reviewer`/`reviewed_at`) into its JSON response. The HACH UI does not render these, but they are on the wire — any HACH user with browser devtools can read Stanton's internal review content.

HACH is the Hartford Housing Authority, a city government partner agency. This is a confidentiality wall between two organizations, and right now the wall is logical (the UI happens not to render the fields), not enforced. Make it enforced at the API layer.

This is a **defensive, low-risk, high-value** change. No UI rewrites. No new tables beyond one column.

---

## Required reading before you start

1. **`docs/hach-payload-leak-plug_prd_2026-05-12.md`** — the spec for this task. Re-read every section.
2. **`app/api/hach/applications/[id]/route.ts`** — the primary file with the leak.
3. **`app/api/admin/submissions/[submissionId]/documents/[documentId]/review/route.ts`** — Stanton's per-document review endpoint (writes the `notes` field).
4. **`supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql`** — existing HACH schema.
5. **`app/hach/applications/[id]/page.tsx`** — the HACH UI consuming the endpoint. Identify exactly which keys it actually reads. You will need this to confirm you haven't over-stripped.
6. **Every file under `app/api/hach/`** — audit pass.
7. **`lib/auth.ts`** — `requireHachUser`, `getSessionUser`, session shape.

---

## Build this pass

### Step 1 — Audit every `/api/hach/*` endpoint

For each file under `app/api/hach/**`, list:
- File path
- HTTP method(s)
- Tables it SELECTs from
- Specific columns it returns
- Whether any column listed in the PRD's banned-key set (`stanton_review_notes`, `notes` under documents, `reviewer` under documents, `reviewed_at` under documents, `stanton_reviewer`, `stanton_review_date`, `internal_notes`) appears in the response

Write this as a table in the build report under section "Endpoint audit". Do not skip any file. If an endpoint returns nothing of concern, list it with "✓ clean".

### Step 2 — Create `lib/hach/payload-filter.ts`

Exports:
```ts
export const HACH_PAYLOAD_BANNED_KEYS: ReadonlySet<string>;
export function assertNoBannedKeys(payload: unknown, context?: string): void;
export function stripBannedKeys<T>(payload: T): T;
export function safeHachJson<T>(data: T): T; // dev: assertNoBannedKeys then return; prod: stripBannedKeys
```

Initial banned keys per PRD:
- `stanton_review_notes`
- `stanton_reviewer`
- `stanton_review_date`
- `internal_notes`
- `notes` (when nested inside an object that also has `doc_type` OR `document_id` — i.e. clearly a document object)
- `reviewer` (same nesting rule — only banned under a document object)
- `reviewed_at` (same nesting rule)

The nesting rule matters because `notes` may legitimately appear in other shapes; the banned occurrence is specifically the document-object internal-annotation field.

`assertNoBannedKeys` recursively walks the object. On a violation, it throws an `Error` whose message includes the path (e.g., `root.documents[3].notes`). Only active when `process.env.NODE_ENV !== 'production'`.

`stripBannedKeys` does the same walk but mutates a deep clone, removing offending keys. Used in production.

`safeHachJson` calls `assertNoBannedKeys` in dev (throw on violation) and `stripBannedKeys` in production (silent removal + `console.warn`). Every HACH route's `NextResponse.json(...)` either wraps the data with this helper or returns `NextResponse.json(safeHachJson(data))`.

### Step 3 — Add `source` column to `document_review_actions`

New migration file: `supabase/migrations/20260512120000_dra_source_column.sql` (use the next sensible timestamp prefix if 12:00:00 conflicts).

```sql
ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'hach'
  CHECK (source IN ('hach', 'stanton'));

CREATE INDEX IF NOT EXISTS idx_dra_source
  ON public.document_review_actions (source, created_at DESC);

COMMENT ON COLUMN public.document_review_actions.source IS
  'Which side wrote the action. HACH endpoints filter on source = ''hach''. '
  'Defends the wall against future Stanton writes to this table.';
```

Before applying, verify no existing rows are from Stanton writers — query for any DRA row whose reviewer's `user_type` is not `hach_admin`/`hach_reviewer`. If you find any, STOP and report in the build report — do not apply the default-`'hach'` migration over Stanton-authored rows.

### Step 4 — Fix `app/api/hach/applications/[id]/route.ts`

Edits:
1. Remove `stanton_review_notes` from the application SELECT.
2. Remove `reviewer, reviewed_at, notes` from the documents SELECT.
3. Add `.eq('source', 'hach')` to the `document_review_actions` query for `reviewActions`.
4. Replace the final `return NextResponse.json({ success: true, data: { ... } });` with a call to `safeHachJson` around the data.
5. Keep `stanton_review_status` in the application SELECT (HACH may want to know Stanton signed off — see PRD Open Question 1). If Alex changes the call, banning it is a one-line allowlist edit.

### Step 5 — Fix the other HACH endpoints from your audit

For each endpoint in your audit that returned banned fields, apply the same pattern:
- Remove the offending fields from the SELECT
- Wrap responses with `safeHachJson`

For `app/api/hach/admin/audit-log/route.ts` specifically: confirm it filters audit log entries by HACH-user authors only. Audit log rows authored by Stanton users must not appear. If it currently returns all rows, fix by filtering on the user's `user_type` via a JOIN to `admin_users`.

For `app/api/hach/documents/[id]/approve/route.ts` and `.../reject/route.ts`: when inserting into `document_review_actions`, set `source: 'hach'` explicitly.

### Step 6 — Test

Create `__tests__/hach-payload-allowlist.test.ts` (use the existing `__tests__/` Vitest setup — `lib/__tests__/notifications.test.ts` shows the pattern).

The test:
1. Sets up a seeded application with:
   - `stanton_review_notes = "INTERNAL: This is Stanton's deliberation."`
   - At least one document with `notes = "Stanton thinks this is suspicious"`, `reviewer = "Tess"`, `reviewed_at = <a date>`
   - At least one `document_review_actions` row with `source = 'hach'`
   - (Optional but ideal) At least one `document_review_actions` row with `source = 'stanton'` to verify it's filtered out
2. Mocks a HACH user session (use whatever pattern exists in the codebase — check `scripts/seed-hach-test-data.ts` and existing tests for the seed/mock approach).
3. Hits each HACH GET endpoint via the route handler directly (don't spin up a server).
4. Recursively walks the response JSON.
5. Asserts no banned key appears anywhere — pathing through arrays and nested objects.
6. Asserts the response still contains the keys the UI actually reads (don't over-strip — verify `documents`, `members`, `application.head_of_household_name`, `progress`-like fields, etc., are still there).

### Step 7 — Manual smoke

After tests pass, do a manual run:
1. Start the dev server.
2. Log in as a HACH user (use the seed script if needed).
3. Navigate to `/hach/applications/[some-real-id]`.
4. Open browser devtools → Network → click the application fetch → inspect the JSON.
5. Confirm: no `stanton_review_notes`, no `notes`/`reviewer`/`reviewed_at` under document objects, no `review_action_log` entries with `source != 'hach'`.
6. Confirm the UI still renders correctly — all panels, document rows, progress bar.

Capture screenshots of the network panel (one showing the application response, one showing the documents within it). Save them under `docs/build-reports/screenshots/hach-payload-leak-plug-2026-05-12/`.

---

## Tech constraints

- Next.js App Router, server route handlers
- Supabase admin client (existing)
- Vitest
- TypeScript strict — no `any` in new code; existing `any` is left alone unless directly relevant
- Do not introduce new libraries
- Do not refactor Stanton-side endpoints in this pass
- Do not touch UI files in this pass

---

## Hard NOs

- **Do NOT touch any file under `app/admin/`** — Stanton admin surface is untouched in this pass
- **Do NOT touch any file under `app/hach/`** — UI is untouched in this pass
- **Do NOT touch any file under `app/t/` or `app/api/t/`** — tenant routes are untouched
- **Do NOT add TODO comments or placeholder code** — every line you write must be production-grade and end-to-end-functional
- **Do NOT invent file paths** — every file you reference must exist or be created in this pass
- **Do NOT add new libraries** — anything you need is already in `package.json`
- **Do NOT auto-fix unrelated bugs you spot** — report them in the build report under section "Pre-existing issues observed". Alex will decide whether to address.
- **Do NOT skip the manual smoke step** — the screenshots are required deliverables
- **Do NOT mark the task complete if any test fails** — leave it open and report

---

## Verification phase (mandatory before reporting done)

After all changes are committed, do this end-to-end:

1. **Build succeeds:** `npm run build` returns zero errors.
2. **Tests pass:** `npm test` (or whatever is configured) returns zero failures. The new `hach-payload-allowlist.test.ts` is included and green.
3. **Type check passes:** TypeScript compiles cleanly.
4. **Manual smoke completed:** screenshots saved.
5. **No regression in HACH UI:** the page renders, the queue renders, approve/reject still work end-to-end. Specifically test:
   - Loading the queue at `/hach`
   - Loading a packet at `/hach/applications/[id]`
   - Clicking Approve on a pending doc — confirm the action persists (refresh the page, confirm the doc shows approved)
   - Clicking Reject on a pending doc, picking a reason, submitting — confirm the action persists
   - **Pay particular attention to the save path on Reject** — it's the kind of thing that quietly fails when fields get stripped from response payloads
6. **Devtools confirmation:** Stanton-internal fields are not in the network responses.

If any of these fail, do not declare done. Leave the task in progress, document what failed, and stop.

---

## Build report requirements

Create `docs/build-reports/hach-payload-leak-plug_build-report_2026-05-12.md` with these sections:

### 1. Endpoint audit
Markdown table — one row per `/api/hach/*` endpoint, listing tables, selected columns, banned-key exposure.

### 2. PRD requirements checklist
Every acceptance criterion from the PRD, with `[x]` or `[ ]` and a one-line note on how it was satisfied (file path + line range, or test name).

### 3. Files created
List each new file with one-line description.

### 4. Files modified
List each modified file with what changed.

### 5. Migration applied
Confirmation that the `source` column migration was applied to local dev DB, with output of a `\d document_review_actions` or equivalent verification query.

### 6. Tests
List every test added (file path, test name, what it verifies). Show the final passing test output.

### 7. Manual smoke results
Screenshots referenced, observations from devtools, UI walkthrough notes.

### 8. Deviations from the PRD
Anything you did that diverged from the PRD, with reasoning. Empty section if there were none.

### 9. Pre-existing issues observed
Anything you spotted that is broken or risky but is out of scope. Do not fix — just note.

### 10. Verification phase results
Each of the 6 verification items above with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- File length of the build report (lines)
- Section count
- Confirmation that every section is populated
- Pass/fail status on each of the 6 verification phase items
- Any blockers that stopped you mid-build

Do not declare the task complete unless every verification item passes. If something fails, leave the task open, summarize the failure clearly, and wait for Alex's call.
