# Windsurf Prompt — Review Workspace Schema (Data Layer)

**PRD:** `docs/review-workspace-schema_prd_2026-05-12.md` (read end-to-end before writing any code)
**Build report (you create this):** `docs/build-reports/review-workspace-schema_build-report_2026-05-12.md`
**Depends on:** `hach-payload-leak-plug` must be merged first. If `lib/hach/payload-filter.ts` does not exist, STOP and report.

---

## Context

You are building the **data layer** for a multi-party review workspace pattern. Two organizations — Stanton Management (private property manager) and the Hartford Housing Authority (HACH, city government partner) — review PBV application packets together. They currently coordinate via email; this build replaces that with structured channels.

Three channels per application workspace:
- **Stanton-private** — Stanton-only. HACH never reads.
- **HACH-private** — HACH-only. Stanton never reads.
- **Shared** — both read and write. The institutional record between the two organizations. Append-only after a 5-minute edit grace window.

The architectural wall is physical: three separate tables, not one with a `channel_type` column. Stanton API routes only query Stanton-accessible tables; HACH API routes only query HACH-accessible tables. The code that touches each side never imports the other side's queries.

The schema is also generic enough to host a future refi (refinancing) workflow with different parties (lender, borrower, escrow, title). The PBV-specific shape lives in API logic and seeds, not in the tables themselves.

**No UI in this pass.** Schema, helpers, route handlers, tests.

---

## Required reading before you start

1. **`docs/review-workspace-schema_prd_2026-05-12.md`** — entire document. Every section.
2. **`docs/hach-payload-leak-plug_prd_2026-05-12.md`** — for context on the wall and `safeHachJson`.
3. **`lib/hach/payload-filter.ts`** — the helper the HACH endpoints in this build must use.
4. **`supabase/migrations/20260424163000_hach_reviewer_portal_schema.sql`** — the prior HACH-related migration. Use it as a style template (RLS pattern, COMMENT blocks, idempotent `IF NOT EXISTS`).
5. **`lib/auth.ts`** — `isAuthenticated`, `requireHachUser`, `getSessionUser`. Understand the session shape (`user_type`, `userId`, `displayName`).
6. **`app/api/hach/applications/[id]/route.ts`** — existing HACH endpoint pattern.
7. **`app/api/admin/pbv/full-applications/[id]/route.ts`** — existing Stanton endpoint pattern.
8. **`lib/audit.ts`** — `logAudit` signature and usage.
9. **`scripts/seed-hach-test-data.ts`** — seed pattern for tests.
10. **`lib/__tests__/notifications.test.ts`** — Vitest pattern in this repo.

---

## Build this pass

### Step 1 — Migration

Create `supabase/migrations/20260512130000_review_workspace_schema.sql` (adjust timestamp if collisions). Define exactly the five tables from the PRD:
- `review_workspaces`
- `workspace_parties`
- `stanton_workspace_messages`
- `hach_workspace_messages`
- `shared_workspace_messages`
- `workspace_read_receipts`

For each:
- `IF NOT EXISTS` throughout (idempotent)
- All CHECK constraints from PRD (especially the `author_party_org` constraints on the three message tables — `'stanton'` only on `stanton_workspace_messages`, `'hach'` only on `hach_workspace_messages`, both allowed on `shared_workspace_messages`)
- Indexes per PRD
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on each
- Policy: `service_role` full access (matching existing pattern)
- COMMENT on each table explaining its role in the wall

Include a clear rollback comment at the top of the file:
```sql
-- Rollback:
--   DROP TABLE IF EXISTS public.workspace_read_receipts CASCADE;
--   DROP TABLE IF EXISTS public.shared_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.hach_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.stanton_workspace_messages CASCADE;
--   DROP TABLE IF EXISTS public.workspace_parties CASCADE;
--   DROP TABLE IF EXISTS public.review_workspaces CASCADE;
```

After writing the migration, apply it locally and verify with a `\d+ stanton_workspace_messages` (or equivalent). Capture the output for the build report.

### Step 2 — Shared types

Create `lib/workspaces/types.ts`:

```ts
export type WorkspaceType = 'pbv' | 'refi';
export type ChannelScope = 'stanton' | 'hach' | 'shared';
export type PartyOrg = 'stanton' | 'hach' | 'lender' | 'borrower' | 'title';

export interface ReviewWorkspace {
  id: string;
  workspace_type: WorkspaceType;
  anchor_id: string;
  created_at: string;
  created_by: string | null;
}

export interface WorkspaceParty {
  id: string;
  workspace_id: string;
  party_role: string;
  party_org: PartyOrg;
  display_label: string;
  created_at: string;
}

export interface WorkspaceMessage {
  id: string;
  workspace_id: string;
  document_id: string | null;
  author_user_id: string | null;
  author_display_name: string;
  author_party_org: PartyOrg;
  body: string;
  created_at: string;
  edited_at: string | null;
}

export interface WorkspaceUnreadCounts {
  stanton: number | null; // null if user has no access
  hach: number | null;
  shared: number | null;
}
```

### Step 3 — Scope resolver helpers

Create `lib/workspaces/scope.ts`. Two pure functions, intentionally separate:

```ts
/**
 * Resolves a workspace for a Stanton session.
 * Verifies the workspace anchor maps to an application the Stanton user can access.
 * If no workspace exists for this anchor, creates one with the two default PBV parties.
 * Returns null if the anchor is unreachable for this session (caller returns 403).
 */
export async function resolveStantonWorkspace(
  workspaceId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] } | null> { ... }

/**
 * Mirror of resolveStantonWorkspace for HACH sessions.
 * Verifies the anchor application has hach_review_status set (i.e. HACH-accessible).
 */
export async function resolveHachWorkspace(
  workspaceId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] } | null> { ... }

/**
 * Lazy create for the application-level entry point: given a Stanton or HACH session and an
 * application id, return the workspace (creating it if needed). Used when the UI links into
 * the workspace from an application detail page.
 */
export async function ensurePbvWorkspaceForApplication(
  applicationId: string,
  sessionUser: SessionUser
): Promise<{ workspace: ReviewWorkspace; parties: WorkspaceParty[] }> { ... }
```

Implementation detail: `ensurePbvWorkspaceForApplication` uses `INSERT … ON CONFLICT (workspace_type, anchor_id) DO NOTHING` then `SELECT` to handle the auto-create race. After insert, seed `workspace_parties` with `{stanton, hach}` per the PRD.

### Step 4 — Edit window helper

Create `lib/workspaces/edit-window.ts`:

```ts
export const EDIT_WINDOW_MINUTES = 5;

export function isEditWindowOpen(createdAt: string | Date): boolean {
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const ageMs = Date.now() - created.getTime();
  return ageMs <= EDIT_WINDOW_MINUTES * 60 * 1000;
}
```

### Step 5 — Stanton API routes

Create every route from the PRD's Stanton routes table. Each route:
- Calls `isAuthenticated()`; returns 401 if not.
- Calls `getSessionUser()`; returns 401 if no user.
- Verifies the user is a Stanton user (`user_type` in `{'stanton_admin', 'stanton_staff', 'stanton_reviewer'}` — adapt to actual values found in `admin_users`).
- Uses `resolveStantonWorkspace` to scope-check; returns 403 if it returns null.
- Touches ONLY `stanton_workspace_messages` and `shared_workspace_messages` (and `workspace_read_receipts`). NEVER queries `hach_workspace_messages` from a Stanton route.
- On POST to shared, sets `author_party_org = 'stanton'` explicitly. Trust the column, not the request body.
- On PATCH, calls `isEditWindowOpen` and `author_user_id === session.userId`. Returns 409 or 403 accordingly.
- Calls `logAudit` on every POST/PATCH with the operation and resource ID.

### Step 6 — HACH API routes

Mirror Step 5 for HACH. Each route:
- Calls `requireHachUser()`; returns whatever it returns on failure.
- Uses `resolveHachWorkspace` to scope-check.
- Touches ONLY `hach_workspace_messages` and `shared_workspace_messages` (and `workspace_read_receipts`). NEVER queries `stanton_workspace_messages`.
- On POST to shared, sets `author_party_org = 'hach'` explicitly.
- Wraps every JSON response with `safeHachJson` from `lib/hach/payload-filter.ts`.
- Calls `logAudit`.

### Step 7 — Tests

Create `__tests__/workspace-wall.test.ts`.

Test infrastructure setup:
- Seed two `admin_users`: one Stanton (`user_type='stanton_staff'`), one HACH (`user_type='hach_reviewer'`).
- Seed a `pbv_full_applications` row with `hach_review_status='under_hach_review'`.
- Create a workspace via `ensurePbvWorkspaceForApplication`.
- Seed a few document rows on the same submission for document-anchored message tests.

Implement every test enumerated in PRD section "Verification → Test Suite". Each test calls the route handlers directly (no HTTP server), mocking sessions via whatever pattern the repo already uses (see existing tests). Specifically:

1. Stanton session cannot retrieve HACH-private messages via any Stanton route.
2. HACH session cannot retrieve Stanton-private messages via any HACH route.
3. DB constraint rejects `INSERT INTO stanton_workspace_messages (..., author_party_org) VALUES (..., 'hach')`.
4. DB constraint rejects the symmetric case on `hach_workspace_messages`.
5. Both sessions retrieve the same shared messages with consistent content.
6. POST shared from Stanton → row has `author_party_org='stanton'`; from HACH → `'hach'`.
7. Edit within 4 min succeeds; edit at 6 min returns 409. (Use a small Vitest time-mock — `vi.useFakeTimers()` and `vi.setSystemTime()`.)
8. User A posts, user B tries to edit → 403.
9. Workspace B never sees workspace A's messages — confirm cross-workspace isolation.
10. HACH response payloads pass `safeHachJson` (no banned keys).

If your test runner can't talk to Postgres directly, use the existing pattern in `lib/pbv/__tests__/income-eligibility.test.ts` or `lib/__tests__/notifications.test.ts` for guidance.

### Step 8 — Build report

Create `docs/build-reports/review-workspace-schema_build-report_2026-05-12.md` (sections below).

---

## Tech constraints

- Next.js App Router
- Supabase admin client with service_role (existing `lib/supabase.ts` pattern)
- iron-session via `lib/auth.ts` (existing)
- TypeScript strict — no `any` in new code
- Vitest for tests
- Do not introduce new libraries
- Use `gen_random_uuid()` for IDs (existing pattern)
- Migrations are idempotent (`IF NOT EXISTS`)

---

## Hard NOs

- **Do NOT build any UI** — this is data layer only. Adding a component file fails the build.
- **Do NOT touch the existing `document_review_actions` table** beyond what `hach-payload-leak-plug` already changed.
- **Do NOT add a `channel_type` column to a unified messages table** — the physical separation is the wall. Do not collapse the three message tables into one.
- **Do NOT share a query helper between Stanton and HACH routes** — separate routes import separate, type-bound query functions. If you find yourself writing `getMessages(channel: ChannelScope)`, stop. Write `getStantonMessages` and `getHachMessages` and `getSharedMessages` and call them from the correct side.
- **Do NOT skip RLS** on any new table. Every new table has RLS enabled with the `service_role` policy.
- **Do NOT add placeholder code or TODOs** — every line is production-grade.
- **Do NOT invent file paths** that don't match the PRD's `Files Touched` list. If you need a new file not listed, add it and note in the build report under "Deviations from PRD".
- **Do NOT skip the verification phase below.**
- **Do NOT auto-fix unrelated bugs you spot** — note them under "Pre-existing issues observed".

---

## Verification phase (mandatory)

End-to-end checks before declaring done. **Skipping any of these means the task is not complete.**

1. **Migration applies clean.** `psql` or Supabase CLI apply against local dev DB. No errors. All five tables exist with correct constraints.

2. **`npm run build` succeeds.** Zero errors.

3. **TypeScript compiles strict.** No new `any`, no implicit returns.

4. **`npm test` passes.** Every test in `workspace-wall.test.ts` is green. The 10 wall tests are explicitly enumerated.

5. **Manual route walkthrough with curl (or REST Client / Thunder Client).** Capture and save the request/response pairs for the build report. Do all of these in order against your local dev server:

   a. As Stanton session, POST a message to `/api/admin/workspaces/<id>/channel/stanton/messages` — succeeds, returns 200/201 with the new row.

   b. Re-GET — confirms the message is in the list.

   c. As HACH session, GET `/api/hach/workspaces/<id>/channel/shared/messages` — succeeds.

   d. As HACH session, attempt GET `/api/admin/workspaces/<id>/channel/stanton/messages` — returns 403.

   e. As HACH session, POST to `/api/hach/workspaces/<id>/channel/shared/messages` — succeeds, response shows `author_party_org: 'hach'`.

   f. As Stanton session, GET the same shared channel — sees the HACH-authored message.

   g. PATCH the just-posted Stanton message within 5 minutes (different body) — succeeds, response shows `edited_at` is set.

   h. PATCH it again after 6 minutes (use `vi`-style time travel in test, or just wait — preferred in test, but for the manual check, edit a message that was seeded >5min ago) — returns 409.

   i. Mark the shared channel read as Stanton; re-GET workspace metadata; confirm `unread_counts.shared` decreased.

6. **End-to-end save verification.** This is the failure mode Alex flagged — "load works but save doesn't." For every POST and PATCH endpoint, confirm the database row is actually present after the response returns success. Don't rely on the response alone — query the database. Document in build report:
   - Endpoint
   - Sample payload posted
   - SQL query used to verify
   - Confirmation that the row exists with the right values

   Particular attention to:
   - `author_party_org` actually being set correctly on writes (not null, not the wrong value)
   - `edited_at` actually updating on PATCH (not just on the response)
   - `workspace_read_receipts` actually upserting

7. **Wall walkthrough.** Manually attempt every cross-side access you can think of:
   - Stanton route + HACH session → 403
   - HACH route + Stanton session → 403
   - Stanton session POST to a HACH-private endpoint via curl using browser cookies → 403
   - HACH session POST to a Stanton-private endpoint → 403

   Document the response code for each.

8. **HACH allowlist passes for the new endpoints.** Run the leak-plug test suite (`hach-payload-allowlist.test.ts`) extended to include the new HACH workspace routes (you may add them to that file or its harness). Confirm all green.

If anything in 1–8 fails, **do not declare done**. Leave the task open, report what failed, await instruction.

---

## Build report requirements

Create `docs/build-reports/review-workspace-schema_build-report_2026-05-12.md`:

### 1. Migration
- File path, applied successfully Y/N, `\d+` output for each new table.

### 2. PRD requirements checklist
Every acceptance criterion with `[x]` or `[ ]` and a one-line note.

### 3. Files created
List with one-line description.

### 4. Files modified
Each modified file + summary.

### 5. Test results
- Full Vitest output for the new test file (paste).
- The 10 wall tests explicitly enumerated with pass/fail.

### 6. Manual walkthrough log
Step-by-step results for verification phase items 5–8. Include request/response excerpts.

### 7. End-to-end save verification
For each write endpoint: payload, SQL verification query, result.

### 8. Wall walkthrough table
Cross-side access matrix with HTTP response codes.

### 9. Deviations from the PRD
If any. Reasoning. Empty if none.

### 10. Pre-existing issues observed
Anything broken or risky out of scope. Do not fix.

### 11. Verification phase results
Items 1–8 with pass/fail + evidence.

---

## When you finish

Reply in chat with:
- Build report file length (lines)
- Section count
- Confirmation every section is populated
- 10 wall tests pass/fail status (all should pass)
- Manual walkthrough item 5a–5i status
- End-to-end save verification status for every write endpoint
- Anything that blocked you

If any test fails, any verification item fails, or any wall check returns the wrong status code, do not declare complete. Leave the task in progress and stop.
