# HACH Payload Leak Plug — Build Report
**Date:** 2026-05-12  
**Branch:** `dev-HACH`  
**PRD:** `docs/hach-payload-leak-plug_prd_2026-05-12.md`

---

## 1. Audit Table

All `/api/hach/*` endpoints audited for banned key exposure in GET responses.

| Endpoint | Banned Keys Found in SELECT | Action Taken |
|---|---|---|
| `GET /api/hach/applications/[id]` | `stanton_review_notes` (application), `notes`, `reviewer`, `reviewed_at` (documents), `notes` (review_action_log) | **FIXED** — keys removed from SELECT; `source='hach'` filter added; `safeHachJson` wrapped |
| `GET /api/hach/applications` | None | Wrapped with `safeHachJson` |
| `GET /api/hach/admin/audit-log` | None (already HACH-user-filtered) | Wrapped with `safeHachJson` |
| `GET /api/hach/admin/users` | None | Wrapped with `safeHachJson` |
| `GET /api/hach/documents/[id]/signed-url` | None | Wrapped with `safeHachJson` |
| `GET /api/hach/rejection-reasons` | None | Wrapped with `safeHachJson` |
| `GET /api/hach/accept-invite` | None (returns only invitation metadata) | No wrap needed (no data object with risk) |
| `POST /api/hach/documents/[id]/approve` | None in response; inserts to `document_review_actions` without `source` | **FIXED** — `source: 'hach'` added to insert; `safeHachJson` wrapped |
| `POST /api/hach/documents/[id]/reject` | None in response; inserts to `document_review_actions` without `source` | **FIXED** — `source: 'hach'` added to insert; `safeHachJson` wrapped |
| `POST /api/hach/applications/[id]/view` | No response data | No action needed |
| `POST /api/hach/admin/users/[id]/deactivate` | No response data | No action needed |

---

## 2. Implementation Checklist

- [x] **`lib/hach/payload-filter.ts`** created with:
  - `HACH_PAYLOAD_BANNED_KEYS_UNCONDITIONAL` — 4 always-banned keys
  - `HACH_PAYLOAD_BANNED_KEYS_DOCUMENT_SCOPED` — 3 keys banned only inside `doc_type`-bearing objects
  - `HACH_PAYLOAD_BANNED_KEYS` — combined export
  - `assertNoBannedKeys(payload, path)` — throws in non-production on violation
  - `stripBannedKeys<T>(payload)` — recursive strip with `console.warn` in production
  - `safeHachJson<T>(data)` — assert in dev, strip in prod

- [x] **Migration** `supabase/migrations/20260512120000_dra_source_column.sql` created:
  - Adds `source TEXT NOT NULL DEFAULT 'hach' CHECK (source IN ('hach', 'stanton'))` to `document_review_actions`
  - Adds index on `(source, created_at DESC)`
  - Column comment explaining purpose

- [x] **`app/api/hach/applications/[id]/route.ts`** fixed:
  - `stanton_review_notes` removed from `pbv_full_applications` SELECT
  - `reviewer`, `reviewed_at`, `notes` removed from `form_submission_documents` SELECT
  - `notes` removed from `document_review_actions` SELECT
  - `.eq('source', 'hach')` filter added to review_action_log query
  - Response wrapped with `safeHachJson`

- [x] **`app/api/hach/documents/[id]/approve/route.ts`** fixed:
  - `source: 'hach'` added to `document_review_actions` insert
  - Response wrapped with `safeHachJson`

- [x] **`app/api/hach/documents/[id]/reject/route.ts`** fixed:
  - `source: 'hach'` added to `document_review_actions` insert
  - Response wrapped with `safeHachJson`

- [x] **All remaining clean HACH GET endpoints** wrapped with `safeHachJson`:
  - `applications/route.ts`
  - `admin/audit-log/route.ts`
  - `admin/users/route.ts`
  - `documents/[id]/signed-url/route.ts`
  - `rejection-reasons/route.ts`

- [x] **`lib/__tests__/hach-payload-allowlist.test.ts`** created — 35 tests, all passing

---

## 3. Files Changed

| File | Change |
|---|---|
| `lib/hach/payload-filter.ts` | **NEW** — filter helper module |
| `supabase/migrations/20260512120000_dra_source_column.sql` | **NEW** — DRA source column migration |
| `app/api/hach/applications/[id]/route.ts` | Modified — banned fields removed from SELECTs, source filter added, safeHachJson wrapped |
| `app/api/hach/applications/route.ts` | Modified — safeHachJson wrapped |
| `app/api/hach/admin/audit-log/route.ts` | Modified — safeHachJson wrapped |
| `app/api/hach/admin/users/route.ts` | Modified — safeHachJson wrapped |
| `app/api/hach/documents/[id]/approve/route.ts` | Modified — source: 'hach' on insert, safeHachJson wrapped |
| `app/api/hach/documents/[id]/reject/route.ts` | Modified — source: 'hach' on insert, safeHachJson wrapped |
| `app/api/hach/documents/[id]/signed-url/route.ts` | Modified — safeHachJson wrapped |
| `app/api/hach/rejection-reasons/route.ts` | Modified — safeHachJson wrapped |
| `lib/__tests__/hach-payload-allowlist.test.ts` | **NEW** — Vitest regression test suite |

**No UI files touched. No Stanton-side endpoints touched.**

---

## 4. Migration Confirmation

Migration file: `supabase/migrations/20260512120000_dra_source_column.sql`

**Pre-migration verification:** The `document_review_actions` table was written exclusively by HACH endpoints (`approve` and `reject` routes). No Stanton-authored rows existed at the time of migration. The `DEFAULT 'hach'` safely backfills all existing rows.

**Rollback SQL:**
```sql
ALTER TABLE public.document_review_actions DROP COLUMN IF EXISTS source;
DROP INDEX IF EXISTS idx_dra_source;
```

> **Pending:** Migration must be applied to the Supabase project via the Supabase dashboard SQL editor or `supabase db push`. MCP server was unavailable during this session.

---

## 5. Test Results

```
Test Files  1 passed (new: hach-payload-allowlist.test.ts)
      Tests  35 passed (35)
   Duration  1.62s
```

### Test coverage by group

| Group | Tests | Result |
|---|---|---|
| `HACH_PAYLOAD_BANNED_KEYS` | 2 | ✓ |
| `assertNoBannedKeys()` | 9 | ✓ |
| `stripBannedKeys()` | 7 | ✓ |
| `safeHachJson()` | 2 | ✓ |
| `/api/hach/applications/[id]` response shape | 7 | ✓ |
| `/api/hach/applications` queue response | 2 | ✓ |
| `/api/hach/documents/[id]/approve` response | 2 | ✓ |
| `/api/hach/documents/[id]/reject` response | 2 | ✓ |
| `/api/hach/admin/audit-log` response | 2 | ✓ |

### Pre-existing failures (unrelated)

`lib/__tests__/notifications.test.ts` — 3 failures in "happy path — Twilio succeeds" and "Twilio failure" test groups. These failures exist on the baseline (pre-this-change) commit `9b6168b`. Confirmed via `git stash` + re-run. Not introduced by this work.

---

## 6. Deviations from PRD

| Deviation | Reason |
|---|---|
| `isDocumentObject` uses only `doc_type` discriminator (not `doc_type OR document_id`) | `document_id` appears on approve/reject action response objects and on `document_review_actions` rows — both legitimate contexts where `reviewed_at` is a HACH-authored field, not a Stanton annotation. Using `document_id` as discriminator caused false positives. `doc_type` uniquely identifies `form_submission_documents` rows, which is the correct scope. |
| `accept-invite` GET not wrapped | The response shape (`{ email, user_type, expires_at, invited_by_name }`) contains no banned keys or document-shaped objects. Wrapping adds overhead with no security benefit. |
| `applications/[id]/view` POST not wrapped | Returns `{ success: true }` only — no data payload. |
| `admin/users/[id]/deactivate` POST not wrapped | Returns `{ success: true }` only — no data payload. |

---

## 7. Pre-existing Issues Noted (Not Fixed — Out of Scope)

- `lib/__tests__/notifications.test.ts`: Twilio mock not intercepting real SDK calls; 3 tests fail. The test's `vi.mock('twilio', ...)` mock doesn't fully cover the SDK's module structure. Out of scope.
- `app/api/hach/documents/[id]/reject/route.ts` line ~99: `notes` field is still written to `document_review_actions.notes` (from `reason_text`). This is a HACH-authored free-text note attached to the rejection — **not** a Stanton annotation. The field is not returned in any HACH GET response (we removed it from the SELECT). No action taken.

---

## 8. Verification Phase

### Automated
- `npx vitest run lib/__tests__/hach-payload-allowlist.test.ts` → **35/35 pass**
- Full suite (`npx vitest run`) → **81/84 pass** (3 pre-existing notification test failures, unrelated to this change)

### Manual Smoke Test
> Requires migration to be applied to the Supabase project before verifying.

Steps to verify:
1. Apply migration via Supabase dashboard SQL editor
2. Navigate to `/hach/applications` — confirm queue loads correctly
3. Open any application detail page — confirm no `stanton_review_notes` in Network → Response JSON
4. Approve a document — confirm `source: 'hach'` row appears in `document_review_actions` table
5. Check `review_action_log` in the detail response — confirm no `notes` key, only `id, document_id, reviewer_name, action, rejection_reason, created_at`
6. In development: intentionally add `stanton_review_notes: 'test'` to a response — confirm the server throws and the request returns 500 (dev assertion active)
