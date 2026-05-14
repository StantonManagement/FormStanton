# PBV Document Revisions Decoupling — PRD

**Status:** Draft — 2026-05-14
**Sequence note:** Inserted between PRD-01 (Documents Decoupling) and PRD-02 (Packet Intake). Filename uses `1.5` because PRDs `01` and `02` were already issued; this PRD ships between them. The naming convention is updated to allow insertional numbering — see memory entry `feedback_prd_naming.md`.
**Depends on:** `pbv-01-documents-decoupling-prd_2026-05-14.md` — must be merged. Specifically depends on `application_documents` table existing and the `_migration_pbv_documents_map` artifact being intact (used to identify which revisions to migrate).
**Blocks:** Not strictly blocking PRD-02 Packet Intake (packet intake creates new documents, not revisions of existing ones). But the review surface UI is incomplete — `PriorVersionsExpander` is broken for PBV — until this PRD lands. Recommend it ship before PRD-02 so the review surface is fully decoupled.

---

## Architecture rule (binding)

PBV document revisions decouple from `form_submission_document_revisions`. A new table `application_document_revisions` is the destination, with `application_document_id UUID NOT NULL` referencing `application_documents(id)`. The revisions table does **not** carry an `anchor_type` / `anchor_id` pair of its own — polymorphism is inherited through the parent FK to `application_documents`. Querying "all revisions for a given PBV application" is a join through the parent table.

`form_submission_document_revisions` remains the substrate for revisions of documents that still live in `form_submission_documents` (simple one-shot tenant forms). Only the PBV slice is relocated.

---

## Problem Statement

PRD-01 moved PBV documents from `form_submission_documents` to `application_documents`. Revisions for those documents still live in `form_submission_document_revisions`, which is keyed against `form_submission_documents`. After PRD-01:

- `components/review/PriorVersionsExpander.tsx` calls `/api/admin/submissions/${submissionId}/documents/${documentId}/revisions` — still hits the submission-keyed substrate.
- The PBV write paths that create new revisions (per PRD-01 Phase 3 — approve, reject, replace-on-reupload, recategorize) write the parent doc to `application_documents` but, if revision creation is still wired to `form_submission_document_revisions`, those new revisions either fail (FK mismatch) or land in a substrate that's no longer joined to the canonical document.
- The PRD-01 Phase 4 grep test ("zero PBV read-path references to the old substrate") legitimately fails on `PriorVersionsExpander.tsx`. This is a scope hole in PRD-01, not a Windsurf failure.

This PRD closes the gap: new `application_document_revisions` table, migration of existing PBV revisions, retargeted write paths, retargeted read paths, updated UI component.

---

## Goals

1. New `application_document_revisions` table with FK to `application_documents`.
2. Structural parity with `form_submission_document_revisions` (every non-anchor column mirrored).
3. All existing PBV revisions migrated to the new table with full fidelity. Source rows preserved with a `migrated_to_application_document_revisions_id` marker.
4. New application-keyed read endpoint: `GET /api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/revisions`.
5. `PriorVersionsExpander` and any other PBV revision readers retargeted to the new endpoint.
6. Every PBV write path that creates a revision (identified during Phase 3) updated to write into `application_document_revisions`.
7. Zero data loss. Revision history visible in the review surface is byte-identical before and after cutover.

---

## Non-Goals

- Migrating non-PBV revisions. `form_submission_document_revisions` remains the substrate for simple-form revision history.
- Adding `anchor_type` / `anchor_id` directly to the revisions table. Polymorphism inherits through the parent FK.
- Deleting migrated `form_submission_document_revisions` rows. Preserved with a migration marker; cleanup is a follow-up PRD aligned with the broader form_submission* deletion sweep.
- Changing the revision model (when revisions are created, sequencing rules, retention behavior). This PRD relocates rows; it does not change semantics.
- Refi revisions. When refi ships, its revisions will use the same `application_document_revisions` table with a different `anchor_type` on the parent.

---

## Users & Roles

Unchanged from PRD-01. The UI surface is identical; the prior-versions expander continues to render the same history with the same permissions.

---

## Core Features

### 1. New table: `application_document_revisions`

Structural parity with `form_submission_document_revisions`. Windsurf produces a diff against the live source table and mirrors every non-anchor column verbatim.

Anchor swap:

| Source (`form_submission_document_revisions`) | Target (`application_document_revisions`) |
|---|---|
| `form_submission_id` (UUID, FK) | removed |
| `form_submission_document_id` (UUID, FK) — or whatever the live parent FK is called | replaced by `application_document_id` (UUID NOT NULL, FK to `application_documents(id)` ON DELETE CASCADE) |

Every other column on the source is mirrored on the target with the same type, default, and constraint. Common columns expected (Windsurf confirms against live schema):

- `id` (UUID, PK, `gen_random_uuid()`)
- `application_document_id` (UUID, NOT NULL, FK)
- `revision` (INTEGER, NOT NULL)
- `file_name`, `storage_path`, `file_size_bytes`, `mime_type`
- `uploaded_by_role`, `uploaded_by_display_name`, `uploaded_by_user_id`
- `upload_source` (TEXT, mirror enum from `form_submission_document_revisions`)
- `notes` or `staff_upload_note` if present on source
- `created_at` (TIMESTAMPTZ DEFAULT now())
- Anything else on the source

Plus a traceability column added by this migration:

- `migrated_from_form_submission_document_revisions_id` (UUID, NULL) — populated for migrated rows, NULL for rows created post-cutover.

Indexes:
- `(application_document_id, revision DESC)` — primary "show me all revisions of this doc" query
- `(application_document_id, created_at DESC)` — timeline view alternative
- `migrated_from_form_submission_document_revisions_id` — for migration validation

Constraints:
- UNIQUE `(application_document_id, revision)` — one row per revision number per parent doc.
- FK on `application_document_id` with `ON DELETE CASCADE`.

RLS: enabled. Mirror the policies on `form_submission_document_revisions`. Service role full access.

### 2. Existing data migration

A migration script that:

1. Adds a transient column `form_submission_document_revisions.migrated_to_application_document_revisions_id UUID NULL`.
2. For each row in `form_submission_document_revisions`, looks up the parent doc in `form_submission_documents`.
3. If that parent doc has an entry in `_migration_pbv_documents_map` (the PRD-01 migration artifact), the parent doc is a PBV doc. Insert a corresponding row in `application_document_revisions` with `application_document_id` set to the mapped new doc id; copy all other fields verbatim.
4. Record the old → new mapping in a transient table `_migration_pbv_revisions_map (old_id, new_id, migrated_at)` and on the source row's `migrated_to_application_document_revisions_id`.
5. If `_migration_pbv_documents_map` does not exist (PRD-01 cleanup may have dropped it before this PRD ships), reconstruct the mapping by joining `form_submission_documents.migrated_to_application_documents_id` directly. PRD-01 specifies the map should not be dropped until a stable production deploy; Windsurf confirms it still exists.
6. Inverse script for rollback: clears `application_document_revisions`, clears the migration marker on source rows, drops the transient map.

Idempotent. Re-running makes zero changes.

### 3. New read endpoint

`GET /api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/revisions`:
- Authenticates as Stanton user.
- Resolves the document under the given application anchor.
- Returns the revision list from `application_document_revisions` for that document, ordered by revision DESC (or created_at DESC — match the existing endpoint's contract).
- Returns shape identical to the existing submission-keyed endpoint to minimize UI changes.

The old endpoint `GET /api/admin/submissions/[submissionId]/documents/[documentId]/revisions` stays in place for non-PBV submissions. No changes to it.

### 4. `PriorVersionsExpander` client update

Mirror the pattern PRD-01 used for `UploadDialog` and `RecategorizeDialog`: take an explicit `revisionsUrl` prop (constructed by the caller) instead of a `submissionId`. The PBV caller in `StantonReviewSurface` constructs:

```
const revisionsUrl = anchorType && anchorId
  ? `/api/admin/applications/${anchorType}/${anchorId}/documents/${documentId}/revisions`
  : `/api/admin/submissions/${application.form_submission_id}/documents/${documentId}/revisions`;
```

Following PRD-01's pattern. **However, the fallback behavior must be reconsidered** — see the note in section 6 below.

### 5. Write-path migration

Every PBV write path that creates a revision migrates to writing into `application_document_revisions`. Identify by inspecting the PRD-01-migrated routes (`approve`, `reject`, `waive`, `categorize`, `upload`, `tier2`) — wherever they currently insert into `form_submission_document_revisions`, swap to `application_document_revisions` with the application_document_id.

If revision creation is centralized in a helper, update the helper. If it's inlined per-route, update each route.

**Done when:** grep across new PBV code paths from this PRD shows zero references to `form_submission_document_revisions`.

### 6. Fallback pattern reconsideration (carried over from PRD-01 audit)

PRD-01's `StantonReviewSurface` uses a `anchorType && anchorId ? new_url : /api/admin/submissions/...` ternary. The audit flagged this as a footgun: if a future PBV caller forgets the anchor props, PBV writes silently route to the old substrate.

This PRD should either:
- **Option A:** make `anchorType` and `anchorId` required props on `StantonReviewSurface`, `UploadDialog`, `RecategorizeDialog`, and `PriorVersionsExpander`. Remove the fallback. `StantonReviewSurface` becomes application-anchored only. Non-PBV form review uses a different component or wrapper.
- **Option B:** keep the props optional but make the fallback throw a loud runtime error rather than silently submit to the old endpoint, and add a type-level assertion that the component is in PBV mode when constructed from PBV pages.

Recommendation: Option A. The component already lives in `components/review/` and is referenced in earlier PRDs as the Stanton review surface — a PBV-specific concept. Making it application-anchored aligns the type with the actual usage. Refi will use the same component with `anchorType='refi_application'` when refi ships.

This is a scope addition to this PRD because the audit raised it concurrent with the revisions gap. If the user prefers to handle the fallback fix as its own micro-PRD, drop section 6 from this PRD and address it separately.

---

## Data Model

See Core Features section 1.

Transient migration artifacts:

```sql
ALTER TABLE form_submission_document_revisions
  ADD COLUMN IF NOT EXISTS migrated_to_application_document_revisions_id UUID NULL;

CREATE TABLE IF NOT EXISTS _migration_pbv_revisions_map (
  old_id UUID PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ DEFAULT now()
);
```

Dropped by the same future cleanup PRD that handles deletion of migrated `form_submission_document_revisions` rows.

---

## Integration Points

- **`application_documents`** (PRD-01): parent FK target. Must be in place and stable.
- **`_migration_pbv_documents_map`** (PRD-01 artifact): consulted to identify which revisions to migrate. Must still exist.
- **`form_submission_documents.migrated_to_application_documents_id`** (PRD-01 column): fallback mapping if the map table is unavailable.
- **`form_submission_document_revisions`**: source of truth pre-migration. Rows preserved, marked migrated.
- **`PriorVersionsExpander.tsx`**: read-path consumer. Updated to take `revisionsUrl` prop.
- **`StantonReviewSurface.tsx`**: constructs the right URL based on anchor. If section 6 Option A is adopted, refactored to require anchor props.
- **`UploadDialog.tsx`**, **`RecategorizeDialog.tsx`** (PRD-01 changes): no change needed unless section 6 Option A removes the submission-keyed fallback, in which case these become required-prop too.

---

## Implementation Phases

### Phase 1 — New table + read endpoint

**Deliverable:**
- Migration `supabase/migrations/<ts>_application_document_revisions.sql` — new table with structural parity to `form_submission_document_revisions`, anchor swap, indexes, constraints, RLS.
- Endpoint `GET /api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/revisions`.

**Done when:**
- Table exists; structural diff against `form_submission_document_revisions` is zero (modulo anchor).
- New endpoint returns empty arrays for valid anchors with no migrated data yet.
- Tenant intake of non-PBV forms (move-out, pet approval, lease renewal) continues to record revisions in `form_submission_document_revisions`; existing tests green.

### Phase 2 — Existing data migration

**Deliverable:**
- Migration SQL (or `scripts/migrate-pbv-revisions.ts` — Windsurf decides; document the choice) copying PBV revisions to the new table.
- Inverse rollback script.
- Transient map artifacts.
- Idempotent: re-run = zero changes.

**Done when:**
- For every PBV doc in `application_documents` with `revision > 1`, all prior revisions resolve to rows in `application_document_revisions` keyed by the new `application_document_id`.
- Row counts and field values match source for every migrated row (diff query).
- Re-running migration is a no-op.
- Inverse script restores state on a copy of the test dataset.

### Phase 3 — Write-path migration

**Deliverable:**
- Every PBV write path that creates a revision updated to write into `application_document_revisions`. Specific routes: those covered by PRD-01 Phase 3 (`approve`, `reject`, `waive`, `categorize`, `upload`, `tier2`, and any new `bulk-assign` route added per the PRD-01 audit).

**Done when:**
- Every existing automated test touching a PBV revision write passes against the new table.
- Grep across the codebase confirms no PBV write path writes to `form_submission_document_revisions`.
- Dynamic check: trigger each PBV write path that would create a revision; verify the row lands in `application_document_revisions`.

### Phase 4 — Read-path migration + UI

**Deliverable:**
- `PriorVersionsExpander.tsx` takes `revisionsUrl` prop; PBV caller constructs application-keyed URL.
- Any other PBV revision readers (Windsurf identifies via grep) updated.
- If section 6 Option A is adopted in this PRD's scope: `StantonReviewSurface`, `UploadDialog`, `RecategorizeDialog`, `PriorVersionsExpander` all require anchor props. Submission-keyed fallback removed from the PBV-facing component path.

**Done when:**
- Manual walkthrough of a PBV application with multiple revisions: prior versions expander shows identical content pre/post migration.
- Grep across PBV code paths shows zero hits for `form_submission_document_revisions` and zero hits for `/api/admin/submissions/${submissionId}/documents/${documentId}/revisions` patterns originating from PBV-only consumers.

### Phase 5 — Verification + cutover plan

**Deliverable:**
- Verification phase per `docs/verification-methodology_2026-05-13.md` — save-path tests against real DB, no mocks.
- Documented cutover plan: order of deploy steps, expected duration, rollback trigger, monitoring queries.
- Pre/post cutover validation query: identical revision history visible for every PBV application.

**Done when:**
- All verification phase items pass.
- Cutover plan posted in build report and reviewed.

---

## Closed decisions

1. **Polymorphism via parent FK, not direct anchor on the revisions table.** Cleaner normalization; the parent table already carries the polymorphism.
2. **Source rows preserved post-migration.** Marked with `migrated_to_application_document_revisions_id`. Deletion is the same future cleanup PRD that drops migrated `form_submission_documents` rows.
3. **Application-keyed read endpoint** mirrors the URL structure introduced by PRD-01.
4. **Structural parity with `form_submission_document_revisions`.** Every non-anchor column on the source is mirrored on the target with the same type and constraint.
5. **Existing submission-keyed revisions endpoint stays in place** for non-PBV consumers. No removal in this PRD.

---

## Open questions for Windsurf

1. **Exact column inventory of `form_submission_document_revisions`.** Diff against live schema before writing the migration. Report any column not mirrored, with justification.
2. **`_migration_pbv_documents_map` availability.** Confirm the map table from PRD-01 still exists in production. If not, use `form_submission_documents.migrated_to_application_documents_id` as the join key.
3. **Triggers, RLS policies, views, or downstream consumers of `form_submission_document_revisions`.** Enumerate everything. Replicate equivalents on `application_document_revisions`. Report inventory.
4. **Centralized revision-creation helper.** If a single helper handles revision inserts across all write paths, update the helper rather than each route. Confirm.
5. **Section 6 fallback fix scope.** Section 6 of this PRD bundles the fallback-removal change with the revisions migration. Confirm with Alex before starting Phase 4 whether to adopt Option A (required props, no fallback), Option B (loud error fallback), or carve out section 6 to a separate micro-PRD.

---

## Out of Scope

- Migrating non-PBV revisions.
- Deleting migrated rows.
- Changing revision semantics or retention rules.
- Refi revisions (will use the same table when refi ships).
- Any change to the underlying `application_documents` schema. This PRD only adds children, not changes parents.

---

## Success Criteria

- Every PBV application's revision history in the review surface is byte-identical before and after migration.
- No new PBV revision rows hit `form_submission_document_revisions`.
- `PriorVersionsExpander` for PBV reads exclusively from `application_document_revisions`.
- The PRD-01 Phase 4 grep test passes cleanly: zero `form_submission_documents` or `form_submission_document_revisions` references in PBV code paths (excluding the intentional `token/route.ts` pre-intake guard, if confirmed correct in the PRD-01 audit follow-up).
- Substrate ready for refi revisions without further migration.
