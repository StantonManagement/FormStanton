# PRD — Foundation Review Layer: Per-Document Review on `form_submissions`

**Date:** April 23, 2026
**Owner:** Alex
**System:** FormStanton (standalone Supabase project)
**Status:** Draft — ready for Windsurf execution
**Depends on:** Existing `form_submissions` workflow
**Blocks:** PBV Application Layer (full application), Section 8 Recertification (future PRD)

---

## Problem Statement

FormStanton has a working review workflow on `form_submissions` — `pending_review → under_review → approved / denied / revision_requested → sent_to_appfolio → completed`, with denial reasons, revision notes, assignment, priority, and bulk actions. This works well for atomic submissions (Move-In Inspection, Pet Addendum, Vehicle Addendum, etc.) where a submission is one unit that's either accepted or rejected as a whole.

It breaks for multi-document submissions. A Section 8 recertification or a PBV full application carries 10–20 documents per household. Today the only way to reject one document is to mark the entire submission as `revision_requested` and rely on `revision_notes` to tell the tenant which document is wrong. On resubmit, there's no per-document revision history — everything is treated as v1 again.

The incoming tsunami is Section 8 recertification. Many tenants are now month-to-month; annual recertification is tracked by email and staff memory. Without per-document review, recertification at scale is not feasible. PBV full application has the same shape but smaller volume.

## Goals

Extend `form_submissions` to support per-document granularity without disrupting the 25 existing forms that use atomic review.

Deliverables:
- Per-document status, reviewer, revision number, and rejection reason
- Tenant-facing per-document resubmit UI (only the rejected documents, not the whole form)
- Human-readable file naming at rest in Supabase storage
- Per-project / per-submission bulk export (ZIP with human-readable filenames)
- Opt-in per form via a `review_granularity` flag — existing forms stay atomic by default

## Non-Goals

- Replacing the atomic review workflow for existing forms. Opt-in only.
- Touching the project tool (compliance/projects system). Out of scope per Apr 23 scoping decision.
- Main-DB apps (MaintOC, Leasing CRM, Collections). FormStanton ecosystem only.
- PBV-specific form fields, qualification logic, or HHA mapping. Those live in PRD 2 (PBV Application Layer).
- Section 8 recertification form itself. Separate future PRD that will consume this foundation.

## Users & Roles

| Role | What they do |
|---|---|
| Staff (Tess, Christine, Alex, Dan) | Review individual documents, approve/reject/request-more-info per document, write rejection reasons, trigger bulk export |
| Tenant | See per-document status on their submission, upload revisions only for rejected documents, see reviewer notes |

## Design Principles

1. **Opt-in, never forced.** A form declares its `review_granularity`. Existing forms keep `atomic`. New high-document forms set `per_document`. Never auto-migrate.
2. **Extend, don't fork.** Per-document review must extend existing `form_submissions` infrastructure (admin list, filters, assignment, priority). Not a parallel system.
3. **Append-only revision history.** When a document is resubmitted, v1 is preserved. Storage retains every revision; UI defaults to latest.
4. **Human-readable at rest.** Files stored with the Stanton naming convention at upload time, not renamed only on export.
5. **Section 8 recertification is the reuse target.** If an abstraction works for PBV full application but not for Section 8 recertification, the abstraction is wrong.

## Data Model

The model below is a proposal. Windsurf must evaluate alternatives (JSONB-per-submission, polymorphic `reviewable_items`, separate parallel table) in Phase 1 and justify the final choice in writing before migration.

### Changes to `form_submissions`

Add columns:
- `review_granularity text not null default 'atomic'` — `'atomic' | 'per_document'`
- `document_review_summary jsonb` — denormalized rollup for quick list-view rendering (counts of approved/submitted/rejected/missing). Only populated when `review_granularity = 'per_document'`.
- `tenant_access_token text unique` — magic-link token for the tenant submission-status page. Generated at submission creation time when `review_granularity = 'per_document'`. No expiration at launch; regeneration handled manually from admin detail page.

### New table: `form_submission_documents`

```sql
create table form_submission_documents (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid references form_submissions(id) on delete cascade,
  doc_type text not null,                    -- stable slug, e.g. 'paystubs', 'hud-9886a'
  label text not null,                       -- human-readable label shown to tenant and staff
  required boolean not null default true,
  display_order integer not null default 0,
  person_slot integer not null default 0,    -- 0 = submission-level; 1..N = per-person (1-based index into household_members)
  revision integer not null default 0,       -- 0 = never submitted; 1+ = submitted versions
  status text not null default 'missing',    -- 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived'
  file_name text,                            -- human-readable filename at rest (Stanton convention)
  storage_path text,                         -- full path in Supabase storage
  reviewer text,                             -- staff user id
  reviewed_at timestamp,
  rejection_reason text,
  notes text,
  created_at timestamp default now(),
  updated_at timestamp default now(),
  unique (form_submission_id, doc_type, person_slot)  -- enforces one slot per (submission, doc_type, person)
);

create index idx_fsd_submission on form_submission_documents(form_submission_id);
create index idx_fsd_status on form_submission_documents(status);
create index idx_fsd_submission_status on form_submission_documents(form_submission_id, status);
```

**Note on `person_label`:** Not stored on the row. Resolved at render time from `form_submissions.form_data.household_members[person_slot - 1]` to prevent staleness if the tenant corrects their name after seeding.

### New table: `form_submission_document_revisions`

Append-only history. Every resubmission creates a new row; the parent `form_submission_documents` row reflects the latest revision.

```sql
create table form_submission_document_revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references form_submission_documents(id) on delete cascade,
  revision integer not null,
  file_name text not null,
  storage_path text not null,
  uploaded_by text not null,                 -- 'tenant' or staff user id
  uploaded_at timestamp default now(),
  status_at_review text,                     -- status set by reviewer: 'approved' | 'rejected'
  rejection_reason text,
  reviewer text,
  reviewed_at timestamp
);

create index idx_fsdr_document on form_submission_document_revisions(document_id);
```

### Document template table: `form_document_templates`

Declares which documents a per-document form expects. One row per (form, doc_type). Seeds the `form_submission_documents` rows when a submission is created for that form.

```sql
create table form_document_templates (
  id uuid primary key default gen_random_uuid(),
  form_id text not null,                     -- matches form slug, e.g. 'pbv-full-application'
  doc_type text not null,
  label text not null,
  label_es text,
  label_pt text,
  required boolean not null default true,
  conditional_on jsonb,                      -- optional: show only if form_data matches this shape
  display_order integer not null default 0,
  per_person boolean not null default false, -- if true, one slot seeded per matched household member
  applies_to text not null default 'submission', -- 'submission' | 'each_member' | 'each_adult' | 'each_member_matching_rule'
  member_filter jsonb,                       -- criteria for 'each_member_matching_rule'; ANDed
  created_at timestamp default now(),
  unique (form_id, doc_type)
);
```

## File Naming Convention (at rest)

Files are renamed to the Stanton convention on upload, not on export.

**Format (submission-level, `person_slot = 0`):**
`{AssetID}_{Unit} - {DocType} - {LastName} - {YYYYMMDD} - v{Revision}.{ext}`

**Format (per-person, `person_slot ≥ 1`):**
`{AssetID}_{Unit} - {DocType} - {LastName} - P{PersonSlot} - {YYYYMMDD} - v{Revision}.{ext}`

**Examples:**
- `S0001_2A - Proof of Identity - Garcia - 20260422 - v1.pdf` (submission-level)
- `S0001_2A - Paystubs - Garcia - P2 - 20260422 - v1.pdf` (Adult 2's paystubs)

Rules:
- `AssetID_Unit` joined by underscore (one token — matches compliance storage path convention)
- All other fields separated by ` - ` (space-dash-space)
- `DocType` is the human-readable label from `form_document_templates.label`, not the slug (e.g., "Paystubs" not "paystubs")
- `LastName` is always the head-of-household's surname; `P{slot}` disambiguates which person within the household
- `P{slot}` segment present only when `person_slot ≥ 1`; omit entirely for submission-level docs — do not render "P0"
- Date in `YYYYMMDD` (no dashes) — avoids ambiguity with separator dashes
- Revision always present, even for v1
- If the combined filename exceeds 200 characters, truncate `DocType` first, then `LastName`; never truncate `P{slot}` (it is the disambiguation key)

Storage path: `form-submissions/{submission_id}/{doc_type}/{file_name}`

AssetID and Unit come from the `form_submissions` row's linked unit. LastName comes from tenant name on the submission. Revision comes from the new row in `form_submission_document_revisions`.

Legacy files in existing storage buckets are not renamed. This applies only to new per-document uploads.

## Review State Machine (per document)

```
missing  →  submitted  →  approved
                      ↘   rejected  →  (tenant resubmits) →  submitted  →  ...
         →  waived  (staff-only transition; bypasses review)
```

- `missing` — template says this doc is required, nothing uploaded yet
- `submitted` — latest revision uploaded, awaiting review
- `approved` — reviewed and accepted
- `rejected` — reviewed and rejected with reason; tenant sees reason and can resubmit
- `waived` — staff marks not applicable (e.g., citizenship docs for US citizen)

Parent `form_submissions.status` derived from child states when `review_granularity = 'per_document'`:
- All required documents `approved` or `waived` → parent moves to `approved`
- Any `rejected` → parent stays `revision_requested`
- Any `missing` → parent stays `pending_review` or `under_review`

Parent status transitions must not regress without explicit staff action (e.g., approving a parent that has no rejected docs but still has missing required docs is disallowed).

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| Existing `form_submissions` table | Extend | Add 2 columns; preserve atomic workflow |
| Existing `/admin/form-submissions` | Extend | Detail view branches on `review_granularity` |
| Existing filter tabs ("Needs Review", etc.) | Reuse | Per-document review rolls up to parent status |
| Supabase Storage | Write | Per-document uploads with Stanton naming |
| New tenant submission-status page at `/t/[token]` | New build | Per-document status UI + resubmit flow; reuses magic-link token pattern from project tool |
| Existing bulk export (legacy submissions ZIP) | Extend pattern | New bulk export for per-document submissions |

## Implementation Phases

**All phases require a `tasks/todo.md` checkpoint at start and end. Agent stops at end of each phase for Alex's review.**

### Phase 0 — Reconnaissance
- Read existing `form_submissions` schema (Supabase migrations)
- Read `/admin/form-submissions` page and components (list, filters, detail modal, detail page)
- Read `FormSubmissionQuickViewModal`
- Read existing bulk export routes
- Read tenant portal submission flow for one representative form (Pet Addendum is a good candidate)
- Read `EvidenceViewer.tsx` to understand file rendering patterns
- Output: `tasks/foundation-review-audit.md` with specific file paths and line numbers for every integration point
- No code written

**Checkpoint:** Alex reviews audit, confirms accuracy, approves Phase 1.

### Phase 1 — Schema Design (proposed, not executed)
- Evaluate 3 schema alternatives for per-document review:
  1. Child table model (above proposal)
  2. JSONB-per-submission
  3. Polymorphic reviewable_items table
- Write tradeoff analysis: query ergonomics, indexing, RLS complexity, bulk export difficulty, future reuse (Section 8 recert)
- Pick one with written reasoning
- Write migration file — **do not run**
- Include rollback instructions
- Output: migration file + `tasks/foundation-review-schema-decision.md`

**Checkpoint:** Alex reviews schema decision, approves Phase 2.

### Phase 2 — Schema Execution + API Layer
- **First:** apply pre-existing workflow migration `20260314220000_add_submission_workflow_fields.sql`. This migration adds `status`, `assigned_to`, `priority`, `status_history`, `denial_reason`, `revision_notes`, `sent_to_appfolio_at`, `sent_to_appfolio_by` to `form_submissions`. It was never applied to the live DB. If it fails or conflicts, stop and flag — do not skip or modify it without approval.
- After workflow migration succeeds, run the new per-document migration
- Build API routes:
  - `POST /api/forms/[form_id]/submissions` — extended to initialize `form_submission_documents` rows from templates when `review_granularity = 'per_document'`
  - `POST /api/t/[token]/submissions/[submission_id]/documents/[doc_type]` — tenant upload (creates new revision, renames to Stanton convention)
  - `POST /api/admin/submissions/[submission_id]/documents/[document_id]/review` — staff approve/reject/waive with reason
  - `GET /api/admin/submissions/[submission_id]/documents` — list with full revision history
  - `GET /api/admin/submissions/[submission_id]/export` — ZIP with human-readable filenames
- Write integration tests for each route (happy path + rejection + resubmit cycle + waiver)
- Do not build UI

**Checkpoint:** Alex verifies API via curl or equivalent. Approves Phase 3.

### Phase 3 — Admin UI: Per-Document Review
- Extend `/admin/form-submissions/[id]` detail page: when `review_granularity = 'per_document'`, render per-document table (pattern from `pbv-document-tracker.jsx` mockup — reuse its visual language)
- Each row: doc label, status badge, filename, reviewer, review date, revision number, rejection reason, view button
- Approve/reject/waive action per row with rejection-reason input
- Filter rows by status within the detail view
- Rollup summary at top (X/Y approved, Z rejected, W missing)
- Do not touch atomic-review UI path

**Checkpoint:** Alex reviews in browser. Approves Phase 4.

### Phase 4 — Tenant UI: Per-Document Resubmit
- Build tenant submission-status page at `/t/[token]` (new page — reuses project tool's magic-link token pattern; there is no existing tenant-facing submission-status page to extend)
- Token resolved from `form_submissions.tenant_access_token`; language context from submission's stored `language` field
- Token is the sole authorization mechanism — no account, no DOB verification
- Regeneration endpoint on admin detail page (button generates new token, shows shareable URL)
- Show per-document status with same visual language as admin
- Upload button per document (only enabled when status is `rejected` or `missing`)
- Show reviewer's rejection reason inline
- Auto-update status to `submitted` on upload
- Trilingual (EN/ES/PT) via existing i18n
- Approved documents render read-only; tenant cannot re-upload to replace an approved doc without staff intervention

**Checkpoint:** Alex runs end-to-end tenant flow. Approves Phase 5.

### Phase 5 — Bulk Export
- Per-submission ZIP endpoint (Phase 2 delivered API; this wires UI button on admin detail page)
- Per-form bulk export: staff selects N submissions on list view, downloads one ZIP organized by submission
- All files in ZIP use Stanton naming (already at rest, just copy)
- Manifest.csv at root of ZIP: one row per document with submission id, tenant, doc type, status, reviewer, review date

**Checkpoint:** End of foundation PRD. Ready for PBV Application Layer PRD.

## Anti-Slop Guardrails (apply to all phases)

- Forbidden: creating a new component when an existing one can be extended. Must cite which existing component was considered and why extension isn't viable.
- Forbidden: JSONB columns without written justification (default to proper columns).
- Forbidden: new routes that duplicate existing routes. Must cite existing route first.
- Required: file paths and line numbers when claiming "this already exists" or "this doesn't exist."
- Required: `tasks/todo.md` update at end of each phase with what was built, what was decided, what's deferred.
- Forbidden: placeholder/TODO code in committed output. If something isn't built, it doesn't exist — no stubs.
- Forbidden: the words "comprehensive," "robust," "seamlessly," "cutting-edge," "leverages" in comments or commit messages.
- Required: if a nuance surfaces mid-phase that the approved schema can't accommodate, stop and flag for schema amendment. Do not JSONB-hack around it.

## Decisions Made

| Decision | Rationale |
|---|---|
| Opt-in per form (`review_granularity`) vs. global change | 25 existing forms work fine atomic. No reason to disrupt them. |
| Child table vs. JSONB | Proposal. Windsurf re-evaluates in Phase 1 with written tradeoffs. |
| Human-readable naming at rest, not on export | Avoids rename-on-export complexity; files are portable from day one. |
| Append-only revision history | Staff needs to see prior rejected versions to explain the pattern of rejection to tenant. |
| Parent status derived from children | Single source of truth; reduces drift between parent and child state. |
| Section 8 recertification as stress-test | If the abstraction doesn't fit recert, the abstraction is wrong. |
| Filename convention: see naming section | Submission-level omits person segment. Per-person appends `P{slot}` before date. LastName is always HOH. Decided Phase 0 checkpoint; per-person segment added Phase 1 amendment. |
| Tenant access via `tenant_access_token` on `form_submissions` | Magic-link pattern consistent with project tool. No account required. Token is authorization. Decided Phase 0 checkpoint. |
| Phase 4 is a new page, not an extension of TenantPortal | No existing tenant-facing submission-status page exists for `form_submissions`. Confirmed Phase 0 audit. |
| Pre-existing workflow migration applied first in Phase 2 | Migration `20260314220000` was never applied to live DB. Must land before any new per-document columns. Confirmed Phase 0 audit. |
| `pbv-document-tracker.jsx` lives in `tasks/reference/` for Phase 3 | Reference-only; not a route, not imported. Alex provides before Phase 3 begins. |
| `person_label` not stored on document rows | Resolved at render time from `form_data.household_members[person_slot - 1]`. Storing names creates staleness risk. Decided Phase 1 amendment. |
| `applies_to` is generic (`each_member_matching_rule` + `member_filter`) | Avoids ossifying PBV-specific values into foundation schema. Each form seeds its own filter criteria. Decided Phase 1 amendment. |

## Open Questions

| Question | Owner | Blocks |
|---|---|---|
| Which staff users should have write access to review actions? Role-based access or flat? | Alex | Phase 2 API |
| File retention: do we ever delete old revisions, or keep forever? | Alex / Dan | Phase 2 (affects storage cost over time, not implementation) |
| Does manifest.csv in bulk export need any column beyond listed above? | Alex / Tess | Phase 5 |

## Reuse Targets Named Upfront

This foundation must work for:
- **PBV Full Application** (PRD 2) — 15–20 documents per household, multi-signer, sensitive data
- **Section 8 Recertification** (future PRD) — annual, ~10 documents per household, high volume
- **Any future tenant-facing intake with document review** — pattern available for reuse

If a design choice makes PBV easier but recertification harder, recertification wins because volume wins.

## Success Criteria

- All 25 existing forms continue to work with atomic review; no regressions
- A form flagged `review_granularity = 'per_document'` renders per-document review UI for staff and per-document status UI for tenants
- Tenant can resubmit only the rejected document; v1 is preserved
- Bulk export produces a ZIP with human-readable filenames and a manifest
- Section 8 recertification can be built in a future PRD with no foundation changes required
