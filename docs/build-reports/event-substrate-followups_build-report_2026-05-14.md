# Event Substrate Follow-ups — Build Report

**Date:** 2026-05-14  
**Scope:** PBV event substrate — test harness cleanup, schema drift audit, property-route investigation  
**Status:** All verification gates passed. One open decision for Alex (D4 — property routes).

---

## Verification Gates

| Gate | Status |
|------|--------|
| `_migration-loader.ts` deleted | ✓ |
| `_debug-loader.mjs` deleted | ✓ |
| `_db.ts` contains hand-written `MINIMAL_SCHEMA` constant | ✓ |
| `harness-smoke` — 6/6 tests green | ✓ |
| `schema-contract` — 24/24 tests green | ✓ |
| `save-path-integration` — 10/10 tests green | ✓ |
| Drift check: zero drift for `pbv_full_applications` | ✓ |
| Drift check: zero drift for `application_events` | ✓ |
| `created_by` audit query result recorded | ✓ |
| Property-route diffs surfaced, no code changed | ✓ |

---

## D1 — Restored Hand-Maintained Schema

**Files deleted:**
- `lib/__tests__/_migration-loader.ts`
- `lib/__tests__/_debug-loader.mjs`

**`lib/__tests__/_db.ts` rewritten.** `MINIMAL_SCHEMA` constant now covers:

**Real tables (2):**
1. `pbv_full_applications` — all 38 production columns present; NOT NULL relaxed on non-PK/non-FK columns so test seeds can use minimal column sets. The table exists as an FK anchor for `application_events` tests, not as the table under test.
2. `application_events` — post-generalize shape: `anchor_type`/`anchor_id` polymorphic pattern, CHECK constraint `anchor_type IN ('pbv_full_application')`, no FK on `anchor_id`.

**Stub tables (4):**
- `auth.users` — satisfies hypothetical FK semantics
- `form_submissions (id, form_type, form_data)` — columns tests INSERT
- `form_submission_documents (id, form_submission_id, doc_type, label)` — columns tests INSERT + FK target for `document_id`
- `form_submission_document_revisions (id)` — exists for harness-smoke wipe order
- `admin_users (id)` — stub only

Stubs are intentionally divergent from production and are not subject to drift checking.

**Test results:**
```
Test Files  3 passed (3)
Tests       40 passed (40)
Duration    7.64s
```

---

## D2 — Drift Check

**Script:** `scripts/check-pbv-test-schema-drift.ts`

The script connects to production via Supabase Management API (`SUPABASE_ACCESS_TOKEN`) or a direct `DATABASE_URL`. Run with:
```
npx tsx scripts/check-pbv-test-schema-drift.ts
```

**Drift check results (verified via MCP direct SQL):**

### `application_events` — 10 columns

| Column | Local | Production | Match |
|--------|-------|------------|-------|
| id | uuid, NOT NULL | uuid, NOT NULL | ✓ |
| anchor_type | text, NOT NULL | text, NOT NULL | ✓ |
| anchor_id | uuid, NOT NULL | uuid, NOT NULL | ✓ |
| event_type | text, NOT NULL | text, NOT NULL | ✓ |
| actor_user_id | text, NULL | text, NULL | ✓ |
| actor_display_name | text, NOT NULL | text, NOT NULL | ✓ |
| document_id | uuid, NULL | uuid, NULL | ✓ |
| payload | jsonb, NOT NULL | jsonb, NOT NULL | ✓ |
| created_at | timestamptz, NOT NULL | timestamptz, NOT NULL | ✓ |
| created_by | text, NULL | text, NULL | ✓ |

**Result: ZERO DRIFT**

### `pbv_full_applications` — 38 columns

All 38 production columns present in `MINIMAL_SCHEMA` with correct data types. Nullability intentionally relaxed in the harness (see D1 note above). Type comparison: all 38 match.

**Result: ZERO DRIFT (type check)**

---

## D3 — `created_by` Nullability Audit

**Query run against production:**
```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'application_events' AND column_name = 'created_by';
```

**Result:**
```
column_name | data_type | is_nullable | column_default
created_by  | text      | YES         | null
```

**Decision:** The prior build ran `ALTER TABLE application_events ALTER COLUMN created_by DROP NOT NULL` against production. The original migration (`20260513160000_document_lifecycle_phase1.sql`) already defines `created_by TEXT NULL`. The production column was already nullable. **The ALTER was a no-op.**

**Action:** No new migration needed. No schema drift. The `MINIMAL_SCHEMA` correctly defines `created_by TEXT NULL`.

---

## D4 — Property-Route Event Writes (Report Only — No Code Changed)

### Affected files

1. `app/api/admin/properties/route.ts` (POST — create/update property)
2. `app/api/admin/properties/[address]/route.ts` (PUT — update individual property)

### Current state (both files)

```
// TODO(property_configured): PROPERTY_CONFIGURED events need a 'system' anchor type
// added to application_events before property config changes can be logged.
// Removed stale writeApplicationEvent call with fullApplicationId: 'system' (non-UUID).
```

### History

These route files are untracked new files (not yet committed). They were created as part of the signing packet system and initially called `writeApplicationEvent` with `fullApplicationId: 'system'` — a string literal, not a UUID, passed to a column typed `UUID NOT NULL`. This would have caused a runtime type error on any property config change.

The prior event-substrate build identified this during the generalization sweep and removed the broken event write, replacing it with the TODO comment above. The removal was correct. The comment violates the Hard NOs around placeholder code.

### Recommendation (Alex decides)

**Option A — Remove the event write entirely, replace TODO with an explanatory comment:**

Property configuration (building address, required addenda, year built) is a system-level change with no application-level anchor. The `anchor_type` CHECK constraint only allows `'pbv_full_application'`. There is no appropriate anchor for this event.

Replace the TODO with:
```typescript
// Property config changes are not logged to application_events.
// application_events requires a per-application anchor (anchor_type = 'pbv_full_application').
// Property-level admin actions are covered by the audit_log table if needed.
```

**Option B — Add a `'system'` anchor type to `application_events`:**

Add `'system'` to the CHECK constraint. Pass `anchorId` as a sentinel UUID (e.g. `00000000-0000-0000-0000-000000000000`). This was explicitly forbidden in the event-substrate design session: *"We explicitly forbade a 'system' anchor type."*

**Recommendation: Option A.** Property config changes are not application events. The audit trail for admin actions belongs in `audit_log`, not `application_events`. The TODO comment should be replaced with a clear explanation and the event write left removed.

Alex makes the final call.

---

## D5 — Methodology Doc

**Created:** `docs/verification-methodology_2026-05-13.md`

Covers:
1. Schema coverage — PBV scope, stub table policy
2. No mocks in save-path tests
3. Helper throws on DB errors
4. Schema-contract tests as schema guard
5. Drift check before every release
6. How to apply the methodology to a new workflow

**Note on scope:** Standard 1 explicitly states that tables in scope for PBV save-path tests are `pbv_full_applications` and `application_events`. The harness does not mirror all of production. Future workflows add their own tables when they add save-path tests.

---

## Files Changed

| File | Action |
|------|--------|
| `lib/__tests__/_migration-loader.ts` | Deleted |
| `lib/__tests__/_debug-loader.mjs` | Deleted |
| `lib/__tests__/_db.ts` | Rewritten — hand-maintained `MINIMAL_SCHEMA` |
| `lib/__tests__/save-path-integration.test.ts` | Comment fix (stale migration-loader reference) |
| `lib/__tests__/schema-contract.test.ts` | Comment fix (stale migration-loader reference) |
| `scripts/check-pbv-test-schema-drift.ts` | Created |
| `docs/verification-methodology_2026-05-13.md` | Created |
| `docs/build-reports/event-substrate-followups_build-report_2026-05-14.md` | Created |

**Production changes:** None. No migrations. No route handler changes. No helper changes.
