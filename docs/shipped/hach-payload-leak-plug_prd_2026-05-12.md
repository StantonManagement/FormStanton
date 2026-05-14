# HACH Payload Leak Plug — PRD

**Status:** Draft — ready for build
**Depends on:** none (touches existing HACH endpoints only)
**Blocks:** `review-workspace-schema` should not ship until this lands
**Severity:** High — current code exposes internal Stanton review content to HACH-session users

---

## Problem Statement

The HACH reviewer portal endpoint `/api/hach/applications/[id]` (and possibly others under `/api/hach/*`) currently returns fields in its JSON payload that contain Stanton's internal review content. The HACH-facing UI does not render those fields today, but the data is on the wire — any HACH user with browser devtools can read it. The wall between Stanton's internal deliberation and HACH's view is not enforced at the API layer; it is enforced only by what the UI happens to display, which is not a wall at all.

Confirmed exposures in `app/api/hach/applications/[id]/route.ts`:

- `pbv_full_applications.stanton_review_notes` selected directly into the application payload (line 28)
- `form_submission_documents.notes` (internal annotation written by Stanton's per-document review endpoint) selected into the documents payload (line 56)
- `form_submission_documents.reviewer` and `reviewed_at` (Stanton staff member identity and timestamp) selected into the documents payload (line 56)
- Full `document_review_actions` history shipped as `review_action_log` (line 135) without filtering — currently this table only receives HACH writes, but there is no enforcement preventing future Stanton-side writes from leaking here

Possible additional exposure points (must be audited):
- `/api/hach/admin/audit-log/route.ts` — may surface Stanton actions
- `/api/hach/applications/route.ts` (queue list) — may select internal fields
- `/api/hach/documents/[id]/approve/route.ts` and `.../reject/route.ts` response payloads

This is a confidentiality boundary between Stanton (private property management firm) and the Hartford Housing Authority (a city government partner agency). A breach is unlikely to be malicious but is plausible from a curious reviewer opening devtools. The cost of a leak ranges from professional embarrassment to mission failure on the PBV partnership.

---

## Goals

1. **Eliminate** every existing Stanton-internal field from HACH endpoint responses.
2. **Prevent regressions** with a payload allowlist constant referenced by every HACH endpoint plus an automated test that fetches each endpoint and asserts no banned field appears anywhere in the response (recursive scan).
3. **Audit** every existing HACH endpoint and document the result.

This PRD does NOT cover the future war-room workspace tables — those are in `review-workspace-schema_prd_2026-05-12.md`. It only plugs leaks in what exists today.

---

## Users & Roles

| Role | Impact |
|---|---|
| HACH reviewer | No visible UX change. Devtools no longer exposes Stanton internal data. |
| HACH admin | Same. |
| Stanton staff | No change — internal review surface still has full access to internal fields. |

---

## Banned-Field Allowlist Approach

Define a constant `HACH_PAYLOAD_BANNED_KEYS` in `lib/hach/payload-filter.ts`. Any key in this set is forbidden anywhere in any HACH endpoint JSON response, recursively. Initial banlist:

- `stanton_review_notes`
- `stanton_review_status` *(see open question 1)*
- `stanton_reviewer`
- `stanton_review_date`
- `notes` *(when nested under a document object — this is the internal annotation)*
- `reviewer` *(when nested under a document object)*
- `reviewed_at` *(when nested under a document object)*
- `internal_notes` *(reserved for future use)*

The list is intentionally generous. Adding a banned key never breaks the HACH UI because the UI never reads internal fields anyway.

A helper `filterHachPayload(payload)` recursively walks the response object before send and either (a) throws in development if a banned key is present, or (b) deletes the key silently in production. Default to throw-in-dev so leaks are caught loudly during build.

---

## Required Changes

### Change 1 — `/api/hach/applications/[id]` SELECTs

Remove from the application SELECT:
- `stanton_review_notes`

Keep:
- `stanton_review_status` is in the existing payload. **Open question 1:** does HACH need to know that Stanton has approved an application before it lands in their queue? If yes, this field stays. If no, it gets banned. Default for v1: keep `stanton_review_status` (HACH benefits from knowing Stanton has signed off) but ban the freeform `stanton_review_notes`.

Remove from the documents SELECT:
- `notes`
- `reviewer`
- `reviewed_at`

The HACH UI's "Awaiting Review by [name] on [date]" line, if any, must source from the latest `document_review_actions` row, not from `form_submission_documents.reviewer`. (The HACH page already does this for actions but not for unactioned docs.)

### Change 2 — `review_action_log` payload filtering

Even though `document_review_actions` is currently HACH-only by convention, defend against future Stanton writes by filtering server-side: only return rows where `created_by` matches a HACH user, or add a `source TEXT` column with values `'hach' | 'stanton'` and filter on that. The simpler defense is a column.

Add a `source` column to `document_review_actions` (default `'hach'` for existing rows) and filter HACH responses to `source = 'hach'`. Stanton-side review writes — if they ever start writing to this table — would be excluded.

### Change 3 — `lib/hach/payload-filter.ts` helper

```ts
export const HACH_PAYLOAD_BANNED_KEYS: ReadonlySet<string> = new Set([
  'stanton_review_notes',
  'stanton_reviewer',
  'stanton_review_date',
  'internal_notes',
  // Document-level internal fields
  'notes',         // when nested under a document — see filter logic
  'reviewer',      // when nested under a document
  'reviewed_at',   // when nested under a document
]);

export function assertNoBannedKeys(payload: unknown, path = 'root'): void { ... }
export function stripBannedKeys<T>(payload: T): T { ... }
```

Behavior: in development (`NODE_ENV !== 'production'`), `assertNoBannedKeys` throws. In production, the response middleware calls `stripBannedKeys`. Every HACH route's `NextResponse.json(...)` is wrapped or the helper is invoked before returning.

### Change 4 — Audit + remediate the rest of `/api/hach/*`

Every file under `app/api/hach/` is audited line by line. The build report lists each file, the SELECTs it performs, and whether anything internal was leaking. Fixes are applied where found.

### Change 5 — Audit `/api/hach/admin/audit-log`

The HACH audit log endpoint must only return audit log entries authored by HACH users, never Stanton users. Filter on `user_type = 'hach_admin' OR user_type = 'hach_reviewer'` (or equivalent).

---

## Verification

### Automated

1. **Payload allowlist test** — `__tests__/hach-payload-allowlist.test.ts`. For each HACH GET endpoint:
   - Seed an application with both Stanton and HACH review activity, internal notes populated, etc.
   - Mock a HACH user session.
   - Fetch the endpoint.
   - Recursively walk the JSON response.
   - Assert no key in `HACH_PAYLOAD_BANNED_KEYS` appears anywhere.

2. **Per-endpoint smoke tests** — confirm the endpoint still returns enough data for the UI to render (no over-stripping).

### Manual

3. **Browser devtools check** — log in as a seeded HACH test user, open `/hach/applications/[id]`, open Network tab, inspect the JSON response from `/api/hach/applications/[id]`. Verify:
   - No `stanton_review_notes` key present
   - No document object contains `notes`, `reviewer`, or `reviewed_at`
   - No `review_action_log` entry sourced from Stanton

4. **Cross-role walkthrough** — log in as a Stanton staff user, populate internal notes on every doc + the application. Switch to a HACH session. Verify nothing flows through.

---

## Data Model Changes

```sql
-- Add source column to differentiate HACH actions from any future Stanton writes
ALTER TABLE public.document_review_actions
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'hach'
  CHECK (source IN ('hach', 'stanton'));

CREATE INDEX IF NOT EXISTS idx_dra_source
  ON public.document_review_actions (source, created_at DESC);

COMMENT ON COLUMN public.document_review_actions.source IS
  'Which side wrote the action. HACH endpoints filter on source = ''hach''. '
  'Defends the wall against future Stanton writes to this table.';
```

Existing rows default to `'hach'` since all current writers are HACH endpoints.

No table is dropped. No data is migrated. Rollback is `ALTER TABLE … DROP COLUMN source;`.

---

## Files Touched (Inferred — Cascade Confirms in Build Report)

- `app/api/hach/applications/[id]/route.ts` — remove SELECT fields, filter `review_action_log`, wrap response
- `app/api/hach/applications/route.ts` — audit + fix if needed
- `app/api/hach/admin/audit-log/route.ts` — filter by HACH user_type
- `app/api/hach/documents/[id]/approve/route.ts` — set `source: 'hach'` on insert; audit response shape
- `app/api/hach/documents/[id]/reject/route.ts` — same
- `app/api/hach/documents/[id]/signed-url/route.ts` — audit
- `app/api/hach/applications/[id]/view/route.ts` — audit
- `app/api/hach/accept-invite/route.ts` — audit
- `app/api/hach/admin/users/route.ts` and `[id]/deactivate/route.ts` — audit
- `app/api/hach/rejection-reasons/route.ts` — audit
- `lib/hach/payload-filter.ts` — NEW
- `supabase/migrations/20260512XXXXXX_dra_source_column.sql` — NEW
- `__tests__/hach-payload-allowlist.test.ts` — NEW

---

## Out of Scope

- The workspace/war-room schema and APIs (separate PRD)
- The unified review UI (separate PRD)
- Any change to the Stanton-side review endpoints
- Any change to tenant-facing routes
- Any change to the HACH UI files (the leak is in the API; the UI is fine)

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Over-stripping breaks the HACH UI | Per-endpoint smoke test asserts the response still has the keys the UI needs. Run the actual HACH page in dev after the fix. |
| Banned-key check throws in production due to oversight | In production, `stripBannedKeys` deletes silently. Only dev throws. A log warning fires either way. |
| `document_review_actions.source` default of `'hach'` hides historical Stanton writes | None exist today per code audit. Verify by querying for any DRA row created by a non-HACH user before applying the migration. |
| Future endpoint forgets to call the filter | Add ESLint rule or code-review checklist item. Out of scope for this PRD; flag for follow-up. |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should HACH see `stanton_review_status` (so they know Stanton signed off) or not? | Alex | Keep it. Ban only `stanton_review_notes`. |
| 2. Should `document_review_actions.source` column be added, or should we audit-grep to confirm Stanton never writes to it? | Alex | Add the column. Cheap defense in depth. |
| 3. Throw-in-dev vs. log-in-dev for `assertNoBannedKeys`? | Alex | Throw. Loud is good during build. |

---

## Acceptance Criteria

- [ ] `lib/hach/payload-filter.ts` exists with `HACH_PAYLOAD_BANNED_KEYS`, `assertNoBannedKeys`, `stripBannedKeys`
- [ ] Every HACH GET endpoint wraps its response with `stripBannedKeys` (or equivalent)
- [ ] `stanton_review_notes`, `notes`, `reviewer`, `reviewed_at` are no longer present anywhere in the response from `/api/hach/applications/[id]`
- [ ] `document_review_actions.source` column exists with default `'hach'`
- [ ] HACH endpoints filter `review_action_log` on `source = 'hach'`
- [ ] HACH audit log endpoint only returns entries from HACH users
- [ ] Vitest `hach-payload-allowlist.test.ts` passes and covers every HACH GET endpoint
- [ ] HACH UI continues to render with no regressions
- [ ] Build report enumerates every `/api/hach/*` file reviewed and the result
