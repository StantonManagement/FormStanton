# PBV Documents Decoupling — PRD

**Status:** Draft — 2026-05-14
**Supersedes:** the data-model assumptions in `pbv-packet-intake_prd_2026-05-13.md` (now deprecated; replaced by `pbv-02-packet-intake-prd_2026-05-14.md`).
**Depends on:** `stanton-workspace-document-lifecycle_prd_2026-05-13.md` (versioning, upload, send-to-HACH on existing `form_submission_documents`). `application_events` polymorphic anchor (already shipped, see `20260513200000_application_events_generalize.sql`).
**Blocks:** PBV Packet Intake (`pbv-02-packet-intake-prd_2026-05-14.md`) — that PRD writes to the `application_documents` table delivered here.

---

## Architecture rule (binding)

**PBV does not anchor at `form_submissions` or `form_submission_documents`.** PBV applications anchor at `pbv_full_applications.id`. PBV documents anchor polymorphically at `(anchor_type='pbv_full_application', anchor_id=<pbv_full_applications.id>)`, matching the pattern already shipped for `application_events`.

Templates remain in `form_document_templates` keyed by `form_id` — templates are a generic catalog, not an anchor. The same polymorphic pattern will be reused by refi and any future multi-step workflow.

`form_submissions` and `form_submission_documents` remain the correct substrate for simple one-shot tenant forms (move-out notice, pet approval, lease renewal, etc.). This PRD only relocates the PBV slice.

---

## Problem Statement

PBV documents live today in `form_submission_documents`, joined to PBV applications via `pbv_full_applications.form_submission_id`. This was acceptable when PBV resembled a single-form submission. It has become a structural mismatch as PBV's lifecycle has grown (preapp → full app → HACH review → revisions → recerts) and as the codebase prepares for refi and other multi-step workflows.

The `form_submissions` substrate is built for one-shot tenant forms: a single submission with a flat document list, anchored by `form_submission_id`. PBV needs application-level anchoring with polymorphic flexibility so that (a) refi and future workflows plug into the same document substrate without reusing `form_submissions`, and (b) PBV is no longer structurally coupled to a substrate it has outgrown.

This PRD relocates PBV documents to a new polymorphic `application_documents` table, migrates existing data, updates all read and write paths, retargets the `application_events.document_id` foreign key, and severs PBV's read-side dependence on `form_submissions` for documents. It does **not** drop `pbv_full_applications.form_submission_id` — other code paths may still rely on that link for non-document concerns. That cleanup is a separate, later PRD.

---

## Goals

1. New polymorphic `application_documents` table with `(anchor_type, anchor_id)` shape.
2. All existing PBV documents migrated into the new table with full fidelity (status, version chain, uploaded_by metadata, signature requirements, storage paths, timestamps).
3. All PBV write paths (upload, approve, reject, re-categorize, version, send-to-HACH, packet lock, reopen) updated to write to `application_documents` keyed by application anchor.
4. `StantonReviewSurface` and all related read paths read from `application_documents`.
5. `application_events.document_id` FK retargeted from `form_submission_documents` to `application_documents`. Existing events backfilled.
6. Seeding primitive accepts an application anchor (not a `form_submission_id`) and writes to `application_documents`.
7. Zero data loss or document-state regression in production PBV applications during cutover.
8. Foundation in place for PBV Packet Intake (separate PRD) to write into a clean substrate.

---

## Non-Goals

- Migrating non-PBV documents. `form_submission_documents` remains the substrate for simple one-shot tenant forms. Only the PBV slice moves.
- Dropping `pbv_full_applications.form_submission_id`. Other paths (the original tenant submission flow that creates the full app row) may still use it. Document-side decoupling is sufficient here.
- Refi documents. Refi has not shipped; its tables will hang off the same `application_documents` polymorphic table when refi is built.
- Restructuring `form_document_templates`. Templates stay generic, keyed by `form_id`.
- Replacing `application_events`. It is already polymorphic; only the `document_id` FK retargets.
- Deleting migrated `form_submission_documents` rows. They are preserved and marked migrated. Cleanup is a follow-up PRD.

---

## Users & Roles

Behavior at the UI level is unchanged from the lifecycle PRD. Staff and tenants interact with the review surface identically before and after. The migration is invisible at the user level. The acceptance criterion is "no behavior change at the UI" beyond what is in the lifecycle PRD.

---

## Core Features

### 1. New table: `application_documents`

Polymorphic anchor. Mirrors the column shape of `form_submission_documents` exactly, except `form_submission_id` is replaced by `(anchor_type, anchor_id)`. The lifecycle PRD's column model is correct and battle-tested; only the anchor changes.

Columns (final list verified by Windsurf against the live `form_submission_documents` schema):

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, `gen_random_uuid()` |
| anchor_type | TEXT | NOT NULL. CHECK in (`'pbv_full_application'`). Extend the CHECK when refi ships. |
| anchor_id | UUID | NOT NULL. No FK constraint (polymorphic, application-enforced). |
| doc_type | TEXT | NOT NULL |
| status | TEXT | NOT NULL. CHECK in (`missing`, `submitted`, `approved`, `rejected`, `waived`) — exact set per current `form_submission_documents` |
| person_slot | INTEGER | 0 = submission-level; 1..N = per-person |
| requires_signature | BOOLEAN | |
| signer_scope | TEXT | CHECK in (`all_adults`, `hoh_only`, `individual`, NULL) |
| file_name | TEXT | |
| storage_path | TEXT | |
| file_size_bytes | BIGINT | |
| mime_type | TEXT | |
| revision | INTEGER | Versioning model from lifecycle PRD |
| original_doc_type | TEXT | Nullable. Re-categorization audit trail. |
| uploaded_by_role | TEXT | CHECK in (`tenant`, `staff`) |
| uploaded_by_display_name | TEXT | |
| uploaded_by_user_id | TEXT | Nullable |
| upload_source | TEXT | CHECK matching the current `form_submission_documents` enum + `'packet_intake'` (already added or to be added per the lifecycle PRD) |
| staff_upload_note | TEXT | Nullable |
| approved_at | TIMESTAMPTZ | Nullable |
| approved_by_user_id | TEXT | Nullable |
| approved_by_display_name | TEXT | Nullable |
| rejected_at | TIMESTAMPTZ | Nullable |
| rejected_by_user_id | TEXT | Nullable |
| rejected_by_display_name | TEXT | Nullable |
| rejection_reason | TEXT | Nullable |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

Windsurf is responsible for diffing this list against the live `form_submission_documents` schema and including every column that exists there. Any column on `form_submission_documents` that isn't in the list above is added to `application_documents` with the same type and constraint. The principle: **structural parity** with `form_submission_documents`, modulo the anchor.

Indexes:

- `(anchor_type, anchor_id)` — primary lookup
- `(anchor_type, anchor_id, doc_type, person_slot, revision DESC)` — versioning queries
- `(anchor_type, anchor_id, status)` — review-surface filters
- `doc_type` — cross-application reports

Constraints:

- UNIQUE `(anchor_type, anchor_id, doc_type, person_slot, revision)` — the lifecycle PRD's revision contract.
- No FK on `anchor_id` (polymorphic). Referential integrity is application-enforced. Same pattern as `application_events`.

RLS: enabled. Service role full access. Match the policies on `form_submission_documents`.

### 2. Seeding primitive update

`lib/documents/seedFromTemplates.ts` exports a new function:

```
seedDocumentsForApplication({
  formId,           // 'pbv-full-application'
  anchorType,       // 'pbv_full_application'
  anchorId,         // pbv_full_applications.id
  householdMembers,
  transaction
}) → { inserted: number, perTemplate: Record<doc_type, number> }
```

Replaces the existing `seedDocumentsForSubmission({ formId, submissionId, ... })` for PBV. The submission-keyed function may be retained as a thin wrapper that calls into the new application-keyed primitive for tenant-intake of non-PBV forms (which still need to write to `form_submission_documents`). Windsurf decides the cleanest factoring.

Reads templates from `form_document_templates WHERE form_id = $1` (unchanged). Writes rows to `application_documents` with the given anchor (instead of `form_submission_documents` with a submission FK).

New admin endpoint: `POST /api/admin/applications/[anchor_type]/[anchor_id]/seed-documents` calls the primitive. Used to seed the placeholder PBV application and any future admin-created applications. Idempotent.

### 3. Existing data migration

A migration script (run during deploy of this PRD) that:

1. Adds a transient column `form_submission_documents.migrated_to_application_documents_id UUID NULL`.
2. For each `pbv_full_applications` row, finds its `form_submission_id`.
3. For each `form_submission_documents` row attached to that submission, inserts an equivalent `application_documents` row with `anchor_type='pbv_full_application'`, `anchor_id=<pbv_full_applications.id>`. Preserves all field values, including timestamps and IDs of nested concepts (`approved_by_user_id`, etc.).
4. Records the old→new ID mapping in `form_submission_documents.migrated_to_application_documents_id` and in a transient table `_migration_pbv_documents_map(old_id, new_id, migrated_at)`.
5. Updates `application_events.document_id` for every event whose anchor is a PBV application: rewrites the value to the new `application_documents.id` using the map.
6. Does not delete or modify the source `form_submission_documents` rows beyond setting the migration marker.

The script is reversible. An inverse script restores `application_events.document_id` references to the original `form_submission_documents.id` values and truncates `application_documents`. Windsurf delivers both.

The script is idempotent. Re-running it makes zero changes.

### 4. `application_events.document_id` retarget

Schema change:

- Drop the FK constraint `application_events.document_id → form_submission_documents.id` (if present).
- The column stays as a soft reference; application-layer code is responsible for resolving it against `application_documents` going forward.
- Existing event rows are backfilled per section 3.

This matches the polymorphic anchor pattern already in `application_events` (`anchor_type`/`anchor_id` are soft, application-enforced).

### 5. Read-path updates

All read paths that query `form_submission_documents` for PBV documents are changed to query `application_documents WHERE anchor_type='pbv_full_application' AND anchor_id=<pbv_full_applications.id>`.

Architectural surfaces (Windsurf enumerates the actual files during the build):

- `StantonReviewSurface` and child components: `DocumentRow`, status tiles, completeness counter, Send-to-HACH gating, packet lock indicator, reopen gating.
- All API routes under `app/api/admin/pbv/full-applications/[id]/...` that fetch, list, or summarize documents.
- HACH-bound packet generation (PDF assembly, manifest building) — confirm with the Send-to-HACH code path.
- Any PBV-specific cron jobs, reports, or backfills that read documents.

The change is **read-path-only** here. Write paths are covered in section 6.

### 6. Write-path updates

All write paths that currently insert/update `form_submission_documents` for PBV documents are changed to write to `application_documents` keyed by application anchor.

Architectural surfaces:

- Staff upload endpoint (per-row Upload from the lifecycle PRD).
- Document approve / reject endpoint.
- Re-categorize endpoint.
- Versioning / revision creation.
- Send-to-HACH (does not write documents directly, but joined read shapes change; verify all queries).
- Packet lock and reopen (no document writes, but gating queries shift to the new table).

After this PRD, no new PBV document rows are written to `form_submission_documents` by any code path. Existing rows there are preserved as historical.

---

## Data Model

See Core Features section 1 for `application_documents`.

Transient migration artifacts:

```
ALTER TABLE form_submission_documents
  ADD COLUMN IF NOT EXISTS migrated_to_application_documents_id UUID NULL;

CREATE TABLE IF NOT EXISTS _migration_pbv_documents_map (
  old_id UUID PRIMARY KEY,
  new_id UUID NOT NULL UNIQUE,
  migrated_at TIMESTAMPTZ DEFAULT now()
);
```

Both are kept until a stable production deploy is confirmed; then a follow-up cleanup PRD drops them.

---

## Integration Points

- **`form_document_templates`**: read-only. No schema change. Continues to be the template catalog keyed by `form_id`.
- **`application_events`**: FK retarget per Core Features section 4. Soft reference going forward.
- **`pbv_full_applications`**: no schema change. The `form_submission_id` FK persists for non-document concerns until a separate cleanup PRD.
- **`form_submission_documents`**: rows preserved during cutover, marked with `migrated_to_application_documents_id`. Cleanup is a separate PRD.
- **Storage**: existing file paths in `pbv-documents/{application_id}/{document_id}/{revision}.{ext}` are referenced unchanged from `application_documents.storage_path`. No file moves required. The `document_id` in the path corresponds to the old `form_submission_documents.id` for migrated rows; new rows created after the cutover use the new `application_documents.id`. Both layouts coexist in storage; rows point at the correct path.

---

## Implementation Phases

### Phase 1 — New table + seeding primitive

**Deliverable:**
- Migration `supabase/migrations/<ts>_application_documents.sql` with table, indexes, constraints, RLS, structural parity with `form_submission_documents`.
- `lib/documents/seedFromTemplates.ts` exports `seedDocumentsForApplication`. The existing `seedDocumentsForSubmission` is preserved as a thin wrapper for non-PBV consumers, or removed if no longer used after this PRD's read/write changes.
- Endpoint `POST /api/admin/applications/[anchor_type]/[anchor_id]/seed-documents` calling the new primitive. Idempotent.

**Done when:**
- Table exists with correct shape; structural diff against `form_submission_documents` is zero (modulo the anchor swap).
- Seeding endpoint creates rows in `application_documents` for the placeholder PBV application.
- Re-running the endpoint inserts zero rows.
- Tenant intake of non-PBV forms continues to behave identically; tests green.

### Phase 2 — Existing data migration

**Deliverable:**
- Migration script (SQL or one-off TypeScript via `scripts/migrate-pbv-documents.ts` — Windsurf chooses) that copies all PBV documents from `form_submission_documents` to `application_documents` and retargets `application_events.document_id` references.
- Inverse script for rollback.
- Idempotent: re-running makes zero changes.

**Done when:**
- For every PBV application in a prod-shaped test dataset, `application_documents` row count and field values match the corresponding `form_submission_documents` rows exactly.
- Every `application_events.document_id` for PBV-anchored events resolves to a row in `application_documents`.
- Re-running the migration is a no-op (idempotency verified).
- Inverse script restores the prior state on a copy of the test dataset.

### Phase 3 — Write-path migration

**Deliverable:**
- Every PBV write path updated to write to `application_documents`. Architectural surfaces in Core Features section 6.

**Done when:**
- Every existing automated test touching a PBV document write passes against the new table.
- A grep across the codebase confirms no PBV write path writes to `form_submission_documents`.
- A dynamic check: triggering each PBV write path against a test application creates rows in `application_documents` and not in `form_submission_documents`.

### Phase 4 — Read-path migration

**Deliverable:**
- Every PBV read path updated to read from `application_documents`. Architectural surfaces in Core Features section 5.

**Done when:**
- Every PBV-touching test passes against the new read path.
- Manual walkthrough of `/admin/pbv/full-applications/{placeholder_id}` and at least one fully-populated test application: review surface UI, document counts, status tiles, Send-to-HACH gating, packet lock indicator, completeness counter all behave identically to pre-migration.
- A grep across the codebase confirms no PBV read path queries `form_submission_documents` (excluding the migration code paths themselves).

### Phase 5 — Verification + production cutover plan

**Deliverable:**
- Verification phase per `docs/verification-methodology_2026-05-13.md` — all save-path tests run against real DB, no mocks.
- Documented cutover plan: order of deploy steps, expected duration, rollback trigger, who runs the migration script in production, monitoring queries to run before and after.
- Pre/post cutover validation query: returns identical row counts and document-state distribution for every PBV application before and after.

**Done when:**
- Verification phase items all pass.
- Cutover plan reviewed and approved.

---

## Closed decisions

1. **Polymorphic table over PBV-specific table.** `application_documents` with `(anchor_type, anchor_id)` matches the `application_events` pattern and is ready for refi without further migration.
2. **Templates stay generic.** `form_document_templates` keyed by `form_id` is unchanged.
3. **Existing PBV docs migrated, not dual-read.** Cleaner cutover; no permanent dual-read complexity.
4. **`form_submission_documents` rows preserved post-migration.** Marked with `migrated_to_application_documents_id`. Deletion is a separate cleanup PRD.
5. **`application_events.document_id` retargeted via backfill.** FK constraint dropped; reference becomes soft, application-enforced.
6. **Storage paths unchanged.** New rows reference existing file paths via `storage_path`. No file moves in this PRD.
7. **Structural parity with `form_submission_documents`.** Every column on the source table that isn't anchor-related is mirrored on `application_documents` with the same type and constraint.

---

## Open questions for Windsurf

1. **Exact column inventory of `form_submission_documents`.** The PRD's column list above is the intent; Windsurf produces a diff against the live schema and confirms structural parity before writing the migration. Report any column not mirrored, with justification.
2. **`upload_source` enum membership.** Confirm whether `'packet_intake'` is already present in the source enum (added by the lifecycle PRD) or needs to be added here. Add it on `application_documents` regardless, since PBV Packet Intake (PRD-B) depends on it.
3. **Transactional boundary of the data migration.** For ≤10K PBV apps, run the entire migration in one transaction. If the prod set is larger, chunk by application. Report the prod row count before deciding.
4. **`form_submission_documents` triggers, RLS policies, or downstream views.** Identify any and replicate the equivalents on `application_documents`. Report what was found and what was replicated.

---

## Out of Scope

- Dropping `pbv_full_applications.form_submission_id`.
- Deleting old `form_submission_documents` rows.
- Migrating non-PBV documents.
- Refi tables (will use the same `application_documents` polymorphic table when refi ships).
- Any changes to `form_document_templates` shape.
- Storage path migration.

---

## Success Criteria

- Every PBV application's document state on the review surface is byte-identical before and after migration.
- No new PBV document rows hit `form_submission_documents`.
- `application_events.document_id` for PBV-anchored events all resolve to `application_documents.id`.
- The seeding primitive is callable with any `(anchor_type, anchor_id)` pair. PBV is the only consumer today; refi is the next consumer.
- A clean substrate exists for PBV Packet Intake (`pbv-02-packet-intake-prd_2026-05-14.md`) to write into.
- Rollback path is documented and tested on a copy of the prod-shaped dataset.
