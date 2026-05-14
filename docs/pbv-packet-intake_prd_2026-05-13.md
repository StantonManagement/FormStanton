# Packet Intake — PRD

> **DEPRECATED 2026-05-14.** Superseded by `pbv-02-packet-intake-prd_2026-05-14.md`. This PRD anchored at `form_submissions` / `form_submission_documents`, which is no longer the chosen direction for PBV. Do not build from this document. See also `pbv-01-documents-decoupling-prd_2026-05-14.md` for the substrate change that motivated the rewrite.

**Status:** DEPRECATED — see banner above.
**Date:** 2026-05-13
**Depends on:** `stanton-workspace-document-lifecycle_prd_2026-05-13.md` (staff upload, versioning, re-categorization, generic `application_events`). That PRD delivers per-row upload and the polymorphic event substrate; this PRD delivers bulk packet intake on top of it.
**Blocks:** None currently identified.

---

## Architecture rule (binding)

**Data layer generalizes; UI surfaces stay workflow-specific.** Same rule that governs the workspace tables and `application_events`.

- Intake tables (`intake_batches`, `intake_pages`, `doc_type_signatures`) are **form-agnostic**. They hang off `form_submissions` (already generic), keyed by `form_id` where needed. No FK to `pbv_full_applications`.
- API routes for intake primitives live under generic paths: `/api/admin/intake/[form_submission_id]/...`.
- UI routes are **workflow-specific**: PBV intake lives at `/admin/pbv/full-applications/[id]/intake` and uses PBV vocabulary ("Intake Packet," "Send to HACH," "Tenant Magic Link"). When refi or another workflow ships, it gets its own UI route at `/admin/refi/applications/[id]/intake` (or similar) calling the same generic API with its own vocabulary.
- This PRD's title says "Packet Intake" (not "PBV Packet Intake") because the substrate is generic. The PBV-specific surface is one consumer.

---

## Problem Statement

Tenants do not send their full document packet through the portal. They walk into the Stanton office with a folder of paper — IDs, paystubs, bank statements, signed forms — and hand it to a staff member. Today, that staff member has two bad options:

1. **Per-row upload (post-lifecycle PRD).** Open the application, click Upload on each missing row, attach the scanned page, repeat. For a complete packet this is 15–25 separate uploads per application. Per-row upload is the correct primitive for single documents arriving by email or in person; it is not the correct primitive for a packet.

2. **Paper shadow file.** Skip the system entirely until the tenant finishes the portal flow. This breaks the review surface as a source of truth, fragments the audit trail, and effectively shifts the cost of digitization onto whoever does the final reconciliation.

Neither is acceptable. Walk-in packets are not an edge case — they are a primary intake channel, especially for older tenants and tenants without reliable internet access. The system must support digitizing a packet as a first-class workflow that produces the same downstream artifacts (versioned `form_submission_documents` rows with provenance) as any other intake path.

A second, related problem is **template seeding consistency**. The current placeholder application at `/admin/pbv/full-applications/[id]` has zero document rows because it was inserted directly into the DB rather than going through `app/api/forms/[id]/submissions/route.ts`, which is where templates from `form_document_templates` get materialized. Today the seeding loop lives inline in that POST handler — a single use site, but not reusable for fixtures, backfills, or future admin-initiated application creation. This PRD treats seeding as a shared primitive.

A third problem surfaces only once intake is bulk: **packets routinely contain documents that aren't on the standard template** (court orders, medical bills, asset statements the tenant volunteered, a HACH cover letter). Today there is no home for those pages — the lifecycle PRD adds a manual "Upload" but not a manual "Create row." Intake needs the ability to create new document rows on the fly without polluting the required-document completeness counter.

---

## Goals

1. **Unified document seeding** from `form_document_templates`, extracted into one importable function used by tenant intake POST, packet intake commit, and any future admin-side application creation.
2. **Packet intake mode** as a distinct route with distinct ergonomics: upload one or more multi-page files, view all pages as a grid, classify each page to a document row, save the whole packet atomically.
3. **OCR-assisted classification from day one.** Each page is run through text extraction and matched against doc-type signatures (HUD form numbers, paystub phrases, bank statement headers). Staff confirms or corrects suggestions rather than classifying blank pages.
4. **Multi-page document grouping.** Paystubs are typically 4 pages, bank statements 2–3. The classify UI lets staff group consecutive (or non-consecutive) pages into a single document submission before commit.
5. **Custom documents.** Pages can be assigned to a "Custom — Not on Template" category. These create document rows that do not count toward the `0/0 req` completeness counter and do not gate Send-to-HACH, but are versioned, reviewable, and visible in the workspace.
6. **Atomic commit.** Either the whole packet is committed (all assigned pages become document rows + revisions; the batch is marked imported) or nothing is committed. No half-imported state.
7. **Audit trail.** Every packet intake writes an `application_events` entry (depends on the canonical events table introduced in the lifecycle PRD).

---

## Non-Goals (this PRD)

- Mobile / camera-based scanning. Staff scans with the office MFP and uploads PDFs.
- Auto-routing of pages to person slots without human confirmation. OCR suggests a slot when the page itself names a member; staff always confirms.
- Tenant-facing packet uploads. Tenants continue using the per-document portal flow.
- Backfilling historical applications that pre-date templates. The seeding extraction handles new and existing PBV applications; historical migration of other form types is out of scope.

---

## Users & Roles

| Role | Open Packet Intake | Commit Packet | Create Custom Doc Rows |
|---|---|---|---|
| Any Stanton admin user | Yes | Yes | Yes |
| Stanton role with `pbv-full-applications:send_to_hach` | Yes | Yes | Yes |
| HACH reviewer / admin | — | — | — |
| Tenant | — | — | — |

No new permission introduced. Packet intake is in-scope for any user who can access the application detail page. Send-to-HACH gating is unchanged from the lifecycle PRD.

---

## Core Features

### 1. Unified seeding primitive

Extract the current inline loop in `app/api/forms/[id]/submissions/route.ts` (lines ~71 onward) into `lib/documents/seedFromTemplates.ts` exporting `seedDocumentsForSubmission({ formId, submissionId, householdMembers, transaction })`.

The function:

- Pulls all templates for `formId` from `form_document_templates`, ordered by `display_order`.
- For each template, decides based on `applies_to` (`submission` | `each_adult` | `each_member_matching_rule`) and `per_person` whether to materialize one row or N rows.
- For per-person rows, calls `getApplicableMembers()` (already exists at `lib/memberFilter.ts`) using `member_filter` JSONB.
- Inserts rows into `form_submission_documents` with `status='missing'`, `created_by='system'`, correct `person_slot`.
- Returns a summary `{ inserted: number, perTemplate: Record<doc_type, number> }`.

Used by:

- The tenant submission POST (replaces the inline loop, no behavior change).
- A new admin-side endpoint `POST /api/admin/submissions/[form_submission_id]/seed-documents` that seeds (or re-seeds) any submission (placeholder PBV applications today, admin-created submissions for any form type going forward).
- A future `scripts/backfill-pbv-docs.ts` (out of scope here, but the primitive must be designed to support it).

[Inference] The lifecycle PRD's versioning model already protects against re-seeding clobbering uploaded files, but the seeding primitive must be idempotent: re-running it should add missing templates without duplicating existing rows. This needs a uniqueness key — `(form_submission_id, doc_type, person_slot, original_doc_type)` is a candidate but should be confirmed against the lifecycle PRD's revision model.

### 2. Packet Intake route

New route: `/admin/pbv/full-applications/[id]/intake`.

Reached from `StantonReviewSurface` via a new toolbar button **"Intake Packet"**. The button is always visible (any staff role) and is independent of whether documents have already been seeded — the intake flow seeds-on-demand if needed.

The intake route is its own page, not a modal, because the ergonomics are fundamentally different from the review surface (multi-page grid, drag-classify, OCR confirmation flows) and shoehorning it into a drawer compromises both. The lifecycle PRD's per-row Upload modal continues to handle single-document staff uploads.

### 3. Packet intake workflow

The page has three phases, indicated by a small step header at the top: **Upload → Classify → Commit**.

**Phase A: Upload**

- Drag-and-drop or file picker. Accepts multiple files. PDF, JPG, PNG, HEIC (HEIC converts to JPG via `sharp` server-side, same as `scan-upload`).
- On submit, files post to `POST /api/admin/intake/[form_submission_id]/upload` (the generic intake API; the PBV UI resolves `form_submission_id` from the application before calling).
- The endpoint creates an `intake_batches` row, splits each PDF into per-page images using `pdfjs-dist` (the same library already used in `app/api/admin/scan-upload/route.ts`), saves each page to Supabase Storage, and enqueues OCR for each page.
- OCR runs synchronously per page during upload (acceptable for ≤30 pages — typical packet size). For larger batches, marks the batch `processing` and runs OCR in a background job (deferred until needed).
- Returns the batch ID. Page redirects to `?batch={id}` and enters Phase B.

**Phase B: Classify**

Two-column layout:

- **Left:** vertical scrolling list of all pages as thumbnails, each with: page number within source file, source file name, OCR-suggested doc_type (with confidence indicator: high / medium / low / none), suggested person_slot if OCR detected a member name on the page.
- **Right:** the application's document rows, grouped exactly as `StantonReviewSurface` groups them. Each row is a drop target.

Interactions:

- **Drag a page to a row** → page is assigned to that row's `doc_type` and `person_slot`.
- **Shift-click multiple pages** → assign them as one multi-page document (all pages go to the same target row; they become a single document submission with `page_count > 1`).
- **Click a row's "+" handle** → next dragged page or selected pages get assigned there.
- **"Custom" target** → always available at the bottom of the row list. Drops here create a new `form_submission_documents` row with `doc_type='custom'`, `required=false`, `display_order` after the highest template-driven row, and `original_doc_type=null`. A small label prompt appears on commit ("name this document").
- **"Discard"** target → pages assigned here are deleted from storage on commit. Useful for blank pages, scan separators, duplicates.
- **Unassigned** pages stay highlighted; the Commit button is disabled while any pages remain unassigned (excluding discards, which are explicit).

State for the entire classify session lives in `intake_pages.staged_assignment` JSONB until commit. This means staff can leave and resume — no lost work.

**Phase C: Commit**

Click **"Commit Packet."** A confirmation modal shows:

- Total pages assigned.
- Breakdown: N pages → M template documents, K pages → L custom documents, P pages → discarded.
- Person-slot summary: which adults received which docs.

On confirm, the commit endpoint runs in a single DB transaction:

1. For each grouped assignment, insert a `form_submission_documents` row (or create a new revision of an existing row, per lifecycle PRD versioning model) with `uploaded_by_role='staff'`, `uploaded_by_display_name=<current user>`, `source='packet_intake'`, `staff_upload_note=<batch label if provided>`.
2. Move page files from staging storage path to the canonical document storage path.
3. Write one `application_events` row per committed document (event_type: `document_uploaded`).
4. Write one summary `application_events` row (event_type: `packet_intake_committed`) with counts.
5. Mark the `intake_batches` row as `committed`.

If any step fails, the transaction rolls back. Storage moves are best-effort with a compensating delete on rollback. [Inference] Supabase Storage doesn't participate in Postgres transactions; the storage moves happen *after* the DB transaction commits and are retried on failure. The DB row is the source of truth.

### 4. OCR-assisted classification

Each page goes through text extraction (`pdfjs-dist` text layer for PDF pages, Tesseract or Claude-API OCR for image pages — see Decisions below) before being shown in Phase B.

Classifier matches extracted text against `doc_type_signatures`, a new table:

| Column | Type | Notes |
|---|---|---|
| `doc_type` | text | FK to form_document_templates implicitly |
| `signature_kind` | text | `regex`, `phrase`, `form_number` |
| `pattern` | text | The regex or literal string |
| `weight` | float | Default 1.0 |
| `negative` | boolean | If true, presence of pattern *reduces* score |
| `min_score_for_match` | float | Per doc_type threshold |

Seeded with high-precision signatures for the canonical PBV doc types:

- `hud_9886a` ← phrase "HUD-9886-A" or "Authorization for Release of Information"
- `paystubs` ← phrase "Pay Period", "Earnings", "Gross Pay" (weight 0.3 each; need ≥2 to match)
- `bank_statement_checking` ← phrase "Statement Period" + ("Checking" or "Checking Account")
- `criminal_background_release` ← phrase "Criminal Background" + "Authorization" or "Release"
- (full list maintained alongside the migration)

Person-slot detection: extracted text is searched for each household member's name (last name + first initial is the conservative matcher). If exactly one member matches, suggest that slot. Otherwise, no slot suggestion.

Confidence levels exposed to staff:

- **High:** single doc_type matches above its threshold by a wide margin (>50% headroom). Pre-filled, green badge.
- **Medium:** matches above threshold but within 20% of a competing doc_type. Pre-filled, yellow badge.
- **Low:** matches but barely. Pre-filled, gray badge, staff prompted to confirm.
- **None:** no signatures matched. No suggestion, staff classifies manually.

Staff always retains override. Suggestions never auto-commit.

### 5. Custom documents (not on template)

Documents created during intake under "Custom" land in `form_submission_documents` with:

- `doc_type = 'custom'`
- `label = <staff-entered name>`
- `required = false`
- `requires_signature = false`
- `display_order` = max existing + 10
- `original_doc_type = null`

Custom docs:

- Appear in `StantonReviewSurface` in a separate visual group ("Additional Documents") below the standard categories.
- Do **not** count toward the `Docs Approved: N/N req` tile.
- Do **not** gate Send-to-HACH.
- Are versioned, reviewable, downloadable, re-categorizable (lifecycle PRD) like any other doc.
- Can be re-categorized to a standard doc_type later if it turns out they belong on the template (e.g., a court order that should have been the child support documentation).

### 6. Re-running intake

A given application can have intake run multiple times — a tenant may bring an initial packet, then follow up later with the docs they were missing. The second intake batch is independent; assignments either create new revisions of existing rows (lifecycle PRD revision model) or new rows for previously-unsubmitted slots. Staff can see prior batches from a "Packet History" expander on the intake route.

---

## Data Model

### New tables

**`intake_batches`** (form-agnostic)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `form_submission_id` | uuid | FK `form_submissions(id)` on delete cascade, indexed. This is the only required anchor — `form_submissions` is already generic, so no polymorphic anchor needed at this layer. |
| `created_at` | timestamptz | default now() |
| `created_by_user_id` | uuid | nullable for system seeds; required for staff intake |
| `status` | text | `uploading`, `classifying`, `committing`, `committed`, `abandoned` |
| `source_label` | text | optional, e.g., "Walk-in 5/13" |
| `total_pages` | integer | populated after split |
| `committed_at` | timestamptz | nullable |
| `committed_document_count` | integer | nullable |

The PBV-specific surface joins to `pbv_full_applications` via `form_submission_id` to find which application owns the batch. Refi will do the same with its own application table.

**`intake_pages`** (form-agnostic)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `batch_id` | uuid | FK `intake_batches(id)` on delete cascade |
| `source_file_name` | text | original upload filename |
| `page_index` | integer | 1-based position in source file |
| `global_index` | integer | 1-based across all files in batch |
| `image_path` | text | Supabase Storage path |
| `extracted_text` | text | OCR result |
| `ocr_confidence` | text | `high`, `medium`, `low`, `none` |
| `suggested_doc_type` | text | nullable |
| `suggested_person_slot` | integer | nullable |
| `suggested_score` | float | for ordering equally-confident matches |
| `staged_assignment` | jsonb | `{ target: 'doc_row' \| 'custom' \| 'discard', doc_row_id?, group_id?, custom_label? }` |
| `committed_document_id` | uuid | FK `form_submission_documents(id)`, set on commit |

**`doc_type_signatures`** (form-agnostic, form_id-keyed)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `form_id` | text | which form this signature applies to (e.g., `'pbv-full-application'`). Indexed. |
| `doc_type` | text | the doc_type within that form |
| `signature_kind` | text | `regex`, `phrase`, `form_number` |
| `pattern` | text | the regex or literal |
| `weight` | float | default 1.0 |
| `negative` | boolean | if true, presence reduces score |
| `min_score_for_match` | float | per-`(form_id, doc_type)` threshold |

Natural-key uniqueness on `(form_id, doc_type, signature_kind, pattern)`. Seeded per form_id in dedicated migrations (PBV signatures in this build; refi signatures land with refi's build).

### Schema impacts on existing tables

**`form_submission_documents`** (no schema change, value-only additions):

- New `doc_type` value: `'custom'` (with `original_doc_type` always null for these).
- New `uploaded_by_source` value: `'packet_intake'` (assuming lifecycle PRD's `source` enum exists; if it does not yet, this PRD requires it).

**`application_events`** (introduced in lifecycle PRD, referenced here):

- New event_type values: `packet_intake_started`, `packet_intake_committed`, `packet_intake_abandoned`.

### Relationship to existing `scan_batches` / `scan_extractions`

The existing tables at `supabase/migrations/create_scan_tables.sql` are tightly coupled to a different domain (`scan_extractions.submission_id` references `submissions`, not `form_submissions` or `pbv_full_applications`). They were built for tenant assessment scan ingestion.

**Decision (closed):** New parallel tables (`intake_batches`, `intake_pages` as designed above). The two flows differ in important ways — PBV intake assigns pages to per-application document rows; assessment scan extracts structured form data — and merging them would create coupling between two domains that don't share a roadmap. The existing tenant-assessment flow is untouched.

---

## Integration Points

### Existing code paths to reuse

- `app/api/admin/scan-upload/route.ts` — page splitter logic using `pdfjs-dist` and `sharp`. Extract the PDF→page-image function into `lib/scan/splitPdf.ts` so packet intake and the existing scan flow share it.
- `lib/memberFilter.ts:matchesMemberFilter()` and `getApplicableMembers()` — used by the new `seedFromTemplates`.
- `components/review/StantonReviewSurface.tsx` — needs new "Intake Packet" button in the toolbar; needs visual group for `doc_type='custom'` rows.
- `components/review/DocumentRow.tsx` — already handles `source='packet_intake'` if the lifecycle PRD's source enum is in place. Verify and extend if not.

### OCR provider — Claude API (decision closed)

OCR uses the Claude API vision endpoint. Decision rationale: quality matters when classification confidence drives staff workload; the engineering cost of standing up a Tesseract worker pipeline isn't justified by the marginal savings; reuses existing API access and runs inline; handles photos, handwritten annotations, and rotated scans without preprocessing.

Implementation notes:
- Per-page calls return `{ text: string, confidence: 'high' | 'medium' | 'low' | 'none' }` — confidence is derived from response quality heuristics (length, structure, error markers), not provided by the API directly.
- The OCR client wrapper (`lib/intake/ocr.ts`) reads the model and any rate-limit / cost-ceiling settings from environment variables so they're tunable without code changes.
- On API failure, the page is still inserted with `ocr_confidence='none'` and no suggestion — the batch is not blocked.

### Storage layout

Supabase Storage buckets:

- `intake-staging/{batch_id}/{global_index}.jpg` — pages during classify phase (form-agnostic bucket, shared across all consumers of the intake substrate).
- `pbv-documents/{application_id}/{document_id}/{revision}.{ext}` — final committed documents (existing convention, confirm with lifecycle PRD).

On commit, files move from staging to final. Staging is auto-purged 7 days after batch reaches `committed` or `abandoned`.

### `application_events` dependency

This PRD assumes the `application_events` table from the lifecycle PRD is in place. If lifecycle PRD ships first (assumed), no work needed here. If they ship in parallel, the events writes are guarded behind a feature flag and become no-ops until the table exists.

---

## Implementation Phases

### Phase 1 — Unified seeding primitive

**Deliverable:** `lib/documents/seedFromTemplates.ts` exporting `seedDocumentsForSubmission()`. Refactor `app/api/forms/[id]/submissions/route.ts` to call it. No behavior change for tenant intake. New generic endpoint `POST /api/admin/submissions/[form_submission_id]/seed-documents` calls the same primitive. Placeholder PBV application is seeded by hitting the endpoint manually post-deploy; the same endpoint serves future admin-created submissions for any form type.

**Done when:**

- Existing tenant intake submission tests pass without changes.
- Hitting the new admin endpoint against the placeholder seeds the correct number of rows (one per applicable template, expanded per adult / per matching member).
- Re-running the endpoint is idempotent: no duplicate rows.

### Phase 2 — Intake batch infrastructure

**Deliverable:** Tables `intake_batches` and `intake_pages` (form-agnostic per the architecture rule). Generic endpoint `POST /api/admin/intake/[form_submission_id]/upload` that accepts multipart files, runs the PDF splitter (extracted to `lib/scan/splitPdf.ts`), creates batch + page rows, stores page images. No OCR yet. No commit yet.

**Done when:**

- Upload returns a batch ID and the correct number of page rows.
- Pages are visible in Supabase Storage at the staging path.
- A 30-page test PDF round-trips end-to-end.

### Phase 3 — OCR + classifier

**Deliverable:** `lib/intake/ocr.ts` calling the chosen OCR provider. `lib/intake/classifier.ts` running text through `doc_type_signatures`. Migration seeding signatures for all PBV doc types. Upload endpoint runs OCR + classification synchronously and writes `extracted_text`, `suggested_doc_type`, `suggested_person_slot`, `ocr_confidence` to each `intake_pages` row.

**Done when:**

- A test packet containing one of each canonical doc type produces ≥80% correct doc_type suggestions at high or medium confidence (measured against a hand-labeled fixture set).
- Person-slot suggestions are correct when exactly one household member's name appears on the page.

### Phase 4 — Classify UI

**Deliverable:** `/admin/pbv/full-applications/[id]/intake` route. Two-column classify view. Drag-and-drop assignment. Multi-page grouping. Custom and Discard targets. `staged_assignment` persists between page loads.

**Done when:**

- A staff user can take an unclassified 20-page batch and assign all pages in under 5 minutes without keyboard shortcuts.
- Refreshing the page mid-classification preserves all assignments.

### Phase 5 — Commit + audit

**Deliverable:** `POST /api/admin/intake/[form_submission_id]/commit/[batch_id]` (generic). Transactional creation of document rows / revisions, storage moves, event writes. Confirmation modal. Packet History expander.

**Done when:**

- Committing a packet produces exactly the expected `form_submission_documents` rows (or new revisions) with correct provenance fields.
- A rollback test (force a storage failure mid-commit) leaves DB and storage in a consistent state.
- `application_events` shows the expected entries.
- Custom docs land in their own visual group in `StantonReviewSurface` and do not affect the required-doc completeness counter.

### Phase 6 — Polish

**Deliverable:** Empty states. Errors. Permissioning surface (any staff user can intake; gate matches application detail page access). Storage cleanup job for abandoned batches.

---

## Closed decisions

1. **OCR provider:** Claude API vision. ✓
2. **scan_batches reuse:** New parallel tables (`intake_batches`, `intake_pages`). ✓
3. **Intake route placement:** PBV UI surface at `/admin/pbv/full-applications/[id]/intake`; generic API at `/api/admin/intake/[form_submission_id]/...`. ✓
4. **Generalization:** Data layer is form-agnostic (tables hung off `form_submissions`, `doc_type_signatures` keyed by `form_id`). UI layer uses PBV vocabulary. ✓

## Open questions for Windsurf to confirm before coding

1. **Idempotency key for seeding:** confirm uniqueness fields against the lifecycle PRD's versioning model (which is being built in parallel by Windsurf). The candidate is `(form_submission_id, doc_type, person_slot, revision)` — confirm against the actual revision semantics that ship in the lifecycle migration before adding the unique constraint here.
2. **Source enum on `form_submission_documents`:** confirm the lifecycle build added `'packet_intake'` to the `upload_source` CHECK enum. If not, this PRD's migration extends it.

---

## Out of Scope (named explicitly to prevent drift)

- Email-to-intake (forward an email with PDF attachments to a Stanton inbox and have it land in an intake batch). Real feature, separate PRD.
- Auto-rotation correction on upside-down scans. The MFP handles this; if it becomes a problem, separate PRD.
- Bulk re-categorization across documents already committed (lifecycle PRD handles single-document re-categorization).
- Tenant-facing packet upload via the portal.
- Cross-application packet intake (one batch attached to multiple applications). Each batch is per-application.

---

## Success Criteria

- Staff can take a walk-in tenant's packet (15–25 documents across multiple files) from paper to fully classified, person-attributed, committed `form_submission_documents` rows in under 10 minutes of staff time.
- Zero duplicated document rows across re-runs of seeding.
- ≥80% of pages get a correct high- or medium-confidence doc_type suggestion on first OCR pass.
- No half-committed batches in production. Either all pages land or none do.
- Packet intake never blocks Send-to-HACH on the basis of custom documents.
