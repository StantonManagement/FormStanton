# PBV Packet Intake — PRD

**Status:** Draft — 2026-05-14.
**Supersedes:** `pbv-packet-intake_prd_2026-05-13.md` (deprecated; the data model in that PRD anchored at `form_submissions`, which is no longer the direction).
**Depends on:** `shipped/pbv-01-documents-decoupling-prd_2026-05-14.md` — must be merged first. Packet Intake writes to `application_documents`, which that PRD delivers. `shipped/stanton-workspace-document-lifecycle_prd_2026-05-13.md` for versioning, send-to-HACH, packet lock, audit timeline.
**Blocks:** None currently identified.

---

## Architecture rule (binding)

**PBV does not anchor at `form_submissions`.** Substrate tables (`intake_batches`, `intake_pages`, `doc_type_signatures`) are form-agnostic. Their anchors are polymorphic `(anchor_type, anchor_id)`. Document writes go to `application_documents` (delivered in PRD-01), never `form_submission_documents`.

API routes for intake primitives live under generic paths: `/api/admin/intake/[anchor_type]/[anchor_id]/...`.

UI routes are workflow-specific: PBV intake lives at `/admin/pbv/full-applications/[id]/intake` and uses PBV vocabulary ("Intake Packet," "Send to HACH," "Tenant Magic Link"). When refi (or other workflows) ship, they get their own UI route calling the same generic API.

This PRD's title says "PBV Packet Intake" because PBV is the only consumer being built. The substrate (intake tables, API routes, document destination) is form-agnostic.

---

## Problem Statement

Tenants do not send their full document packet through the portal. They walk into the Stanton office with a folder of paper — IDs, paystubs, bank statements, signed forms — and hand it to a staff member. Today, the staff member has two bad options:

1. **Per-row upload (delivered in lifecycle PRD).** Open the application, click Upload on each missing row, attach the scanned page, repeat. For a complete packet this is 15–25 separate uploads per application. Per-row upload is the correct primitive for a single document arriving by email or in person; it is not the correct primitive for a packet.

2. **Paper shadow file.** Skip the system entirely until the tenant finishes the portal flow. This breaks the review surface as a source of truth, fragments the audit trail, and shifts the cost of digitization onto whoever does the final reconciliation.

Neither is acceptable. Walk-in packets are a primary intake channel, especially for older tenants and tenants without reliable internet access. The system must support digitizing a packet as a first-class workflow that produces the same downstream artifacts (versioned `application_documents` rows with provenance) as any other intake path.

A second problem is **off-template documents.** Packets routinely contain documents that aren't on the standard template — court orders, medical bills, asset statements the tenant volunteered, a HACH cover letter. The lifecycle PRD added per-row Upload but not the ability to create a new row on the fly. Intake needs the ability to create custom document rows that are stored, versioned, and reviewable but do not count toward required-document completeness.

A third problem is **the empty placeholder application.** `/admin/pbv/full-applications/<placeholder-id>` currently shows zero document rows because it was inserted directly into the DB rather than going through any seeding path. PRD-01 delivers the application-keyed seeding endpoint; this PRD's intake flow can also seed-on-demand. After PRD-01 is merged and that endpoint is hit once against the placeholder, the page populates.

---

## Goals

1. **Packet intake mode** as a distinct route with distinct ergonomics: upload one or more multi-page files, view all pages as a grid, classify each page to a document row, save the whole packet atomically.
2. **OCR-assisted classification from day one.** Each page extracted, matched against doc-type signatures (HUD form numbers, paystub phrases, bank statement headers, etc.), suggestions pre-filled with confidence indicators.
3. **Multi-page document grouping.** Paystubs are typically 4 pages, bank statements 2–3. The classify UI lets staff group consecutive or non-consecutive pages into a single document submission before commit.
4. **Custom documents.** Pages can be assigned to a "Custom — Not on Template" target. These create `application_documents` rows that do not count toward completeness gating and do not block Send-to-HACH, but are versioned, reviewable, and visible in the workspace.
5. **Atomic commit.** Either the whole packet is committed (all assigned pages become document rows + revisions; the batch is marked imported) or nothing is committed. No half-imported state.
6. **Audit trail.** Every packet intake writes to `application_events` (already polymorphic; this PRD adds new `event_type` values).
7. **Resume mid-classify** without losing work. Staged assignments persist on every interaction.

---

## Non-Goals

- Mobile / camera-based scanning. Staff scans with the office MFP and uploads PDFs.
- Auto-routing of pages to person slots without human confirmation. OCR suggests a slot when the page itself names a member; staff always confirms.
- Tenant-facing packet uploads. Tenants continue using the per-document portal flow.
- Backfilling historical applications that pre-date templates. The seeding extraction handles new and existing PBV applications; historical migration of other form types is out of scope.
- Cross-application packet intake (one batch attached to multiple applications). Each batch is per-application.

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

### 1. Packet Intake route

New route: `/admin/pbv/full-applications/[id]/intake`.

Reached from `StantonReviewSurface` via a new toolbar button **"Intake Packet."** Always visible to any staff role. Independent of whether documents have already been seeded — the intake flow seeds on demand if needed.

The intake route is its own page, not a modal, because the ergonomics differ fundamentally from the review surface (multi-page grid, drag-classify, OCR confirmation flows). The lifecycle PRD's per-row Upload modal continues to handle single-document staff uploads.

### 2. Three phases

Step header at the top: **Upload → Classify → Commit.**

**Phase A: Upload**

- Drag-and-drop or file picker. Accepts multiple files. PDF, JPG, PNG, HEIC (HEIC converts to JPG via `sharp` server-side, same as `scan-upload`).
- On submit, files post to `POST /api/admin/intake/[anchor_type]/[anchor_id]/upload`. For PBV, the UI resolves anchor from the application — `anchor_type='pbv_full_application'`, `anchor_id=<pbv_full_applications.id>`.
- The endpoint creates an `intake_batches` row, splits each PDF into per-page images using `pdfjs-dist` (extracted to `lib/scan/splitPdf.ts`), saves each page to Supabase Storage at `intake-staging/{batch_id}/{global_index}.jpg`, runs OCR synchronously per page, classifies.
- OCR runs synchronously per page during upload (acceptable for ≤30 pages — typical packet size). For larger batches, the batch is marked `processing` and OCR runs in a background job (deferred until needed).
- Returns the batch ID. Page redirects to `?batch={id}` and enters Phase B.

**Phase B: Classify**

Two-column layout:

- **Left:** vertical scrolling list of all pages as thumbnails. Each shows: page number within source file, source file name, OCR-suggested `doc_type` (with confidence: high / medium / low / none), suggested `person_slot` if OCR detected a member name on the page.
- **Right:** the application's document rows, grouped exactly as `StantonReviewSurface` groups them. Each row is a drop target.

Interactions:

- **Drag a page to a row** → page assigned to that row's `doc_type` and `person_slot`.
- **Shift-click multiple pages** → assign as one multi-page document (all pages go to the same target row; they become a single document submission with `page_count > 1`).
- **Click a row's "+" handle** → next selected pages assign there.
- **"Custom" target** (always available at the bottom) → on-drop label prompt; creates a new `application_documents` row with `doc_type='custom'`, `required=false`, `display_order` after the highest template row, `original_doc_type=null`.
- **"Discard" target** → pages assigned here are deleted from staging storage on commit. Useful for blank pages, scan separators, duplicates.
- **Unassigned** pages stay highlighted; Commit is disabled while any pages remain unassigned (discards count as explicit assignment).

State for the entire classify session lives in `intake_pages.staged_assignment` JSONB until commit. Staff can leave and resume — no lost work.

**Phase C: Commit**

Click **"Commit Packet."** Confirmation modal shows:

- Total pages assigned.
- Breakdown: N pages → M template documents, K pages → L custom documents, P pages → discarded.
- Person-slot summary: which adults received which docs.

On confirm, the commit endpoint runs in a single DB transaction:

1. For each grouped assignment, insert an `application_documents` row (or new revision of an existing row, per the lifecycle PRD revision model) with `anchor_type='pbv_full_application'`, `anchor_id=<id>`, `uploaded_by_role='staff'`, `uploaded_by_display_name=<current user>`, `upload_source='packet_intake'`, `staff_upload_note=<batch label if provided>`.
2. Move page files from staging to canonical document storage path.
3. Write one `application_events` row per committed document (`event_type='document_uploaded'`).
4. Write one summary `application_events` row (`event_type='packet_intake_committed'`) with counts.
5. Mark `intake_batches.status='committed'`, set `committed_at`, `committed_document_count`.

If any step fails, the DB transaction rolls back. Storage moves happen after DB commit (best-effort with retry — not transactional). On DB-transaction failure, batch untouched, no storage moves attempted.

### 3. OCR-assisted classification

Each page goes through OCR (Claude API vision endpoint) before being shown in Phase B.

Classifier matches extracted text against `doc_type_signatures`, a new table keyed by `form_id`:

| Column | Type | Notes |
|---|---|---|
| `doc_type` | text | the doc_type within that form |
| `signature_kind` | text | `regex`, `phrase`, `form_number` |
| `pattern` | text | the regex or literal |
| `weight` | float | default 1.0 |
| `negative` | boolean | if true, presence reduces score |
| `min_score_for_match` | float | per-(form_id, doc_type) threshold |

Seeded with high-precision signatures for the canonical PBV doc types:

- `hud_9886a` ← phrase "HUD-9886-A" or "Authorization for Release of Information"
- `paystubs` ← phrases "Pay Period", "Earnings", "Gross Pay" (weight 0.3 each; ≥2 to match)
- `bank_statement_checking` ← phrase "Statement Period" + ("Checking" or "Checking Account")
- `criminal_background_release` ← phrase "Criminal Background" + ("Authorization" or "Release")
- (full list maintained alongside the migration)

Person-slot detection: extracted text searched for each household member's last name + first initial. Exactly one match → suggest that slot. Otherwise no suggestion.

Confidence buckets:

- **High:** single doc_type matches above threshold by a wide margin (>50% headroom). Green badge, pre-filled.
- **Medium:** matches above threshold but within 20% of a competing doc_type. Yellow badge, pre-filled.
- **Low:** matches but barely. Gray badge, pre-filled, staff prompted to confirm.
- **None:** no signatures matched. No suggestion; staff classifies manually.

Staff always retains override. Suggestions never auto-commit.

### 4. Custom documents (not on template)

Land in `application_documents` with:

- `anchor_type='pbv_full_application'`, `anchor_id=<id>`
- `doc_type='custom'`
- `label=<staff-entered name>`
- `required=false`
- `requires_signature=false`
- `display_order` = max existing + 10
- `original_doc_type=null`

Custom docs:

- Appear in `StantonReviewSurface` in a separate visual group ("Additional Documents") below standard categories.
- Do **not** count toward the `Docs Approved: N/N req` tile.
- Do **not** gate Send-to-HACH.
- Versioned, reviewable, downloadable, re-categorizable (lifecycle PRD) like any other doc.
- Can be re-categorized to a standard `doc_type` later if it turns out they belong on the template.

### 5. Re-running intake

An application can have intake run multiple times — a tenant may bring an initial packet, then follow up with missing docs. Each batch is independent. Assignments either create new revisions of existing rows or new rows for previously-unsubmitted slots. "Packet History" expander on the intake route shows prior batches.

---

## Data Model

### `intake_batches` (form-agnostic, polymorphic anchor)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `anchor_type` | text | NOT NULL. `'pbv_full_application'` for now. CHECK constraint allows future anchor types. |
| `anchor_id` | uuid | NOT NULL. The application's ID. No DB-level FK (polymorphic; application-enforced). |
| `created_at` | timestamptz | DEFAULT now() |
| `created_by_user_id` | uuid | nullable for system seeds; required for staff intake |
| `status` | text | `uploading`, `classifying`, `committing`, `committed`, `abandoned` |
| `source_label` | text | optional, e.g., "Walk-in 5/13" |
| `total_pages` | integer | populated after split |
| `committed_at` | timestamptz | nullable |
| `committed_document_count` | integer | nullable |

Indexes:
- `(anchor_type, anchor_id, created_at DESC)` — Packet History queries
- `status` — pending-batch reports

### `intake_pages` (form-agnostic)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `batch_id` | uuid | FK `intake_batches(id)` on delete cascade |
| `source_file_name` | text | original upload filename |
| `page_index` | integer | 1-based within source file |
| `global_index` | integer | 1-based across batch |
| `image_path` | text | Supabase Storage path |
| `extracted_text` | text | OCR result |
| `ocr_confidence` | text | `high`, `medium`, `low`, `none` |
| `suggested_doc_type` | text | nullable |
| `suggested_person_slot` | integer | nullable |
| `suggested_score` | float | for ranking equally-confident matches |
| `staged_assignment` | jsonb | `{ target: 'doc_row' \| 'custom' \| 'discard', doc_row_id?, group_id?, custom_label? }` |
| `committed_document_id` | uuid | FK `application_documents(id)` set on commit, nullable |

### `doc_type_signatures` (form-agnostic, form_id-keyed)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `form_id` | text | which form (e.g., `'pbv-full-application'`). Indexed. |
| `doc_type` | text | the doc_type within that form |
| `signature_kind` | text | `regex`, `phrase`, `form_number` |
| `pattern` | text | the regex or literal |
| `weight` | float | DEFAULT 1.0 |
| `negative` | boolean | DEFAULT false. If true, presence reduces score. |
| `min_score_for_match` | float | per-(form_id, doc_type) threshold |

UNIQUE `(form_id, doc_type, signature_kind, pattern)`. Seeded per-form in dedicated migrations (PBV signatures in this build; refi signatures when refi ships).

### Schema impacts on existing tables

**`application_documents`** (delivered in PRD-01): no schema change. Value-only additions:
- New `doc_type` value: `'custom'` (with `original_doc_type` always null).
- New `upload_source` value: `'packet_intake'`. Confirm enum membership; add if missing.

**`application_events`** (already polymorphic): no schema change. New `event_type` values: `packet_intake_started`, `packet_intake_committed`, `packet_intake_abandoned`.

### Relationship to existing `scan_batches` / `scan_extractions`

Existing tables at `supabase/migrations/create_scan_tables.sql` belong to the tenant-assessment scan flow. Untouched. New parallel tables (`intake_batches`, `intake_pages`) as designed above.

---

## Integration Points

### `application_documents` (PRD-01)

The commit destination. PRD-01 must be merged before this build starts. Writes use the anchor pair, not `form_submission_id`.

### `application_events` (already polymorphic)

Writes one `document_uploaded` event per committed document and one `packet_intake_committed` summary event per batch. All events use `anchor_type='pbv_full_application'`, `anchor_id=<id>`.

### `form_document_templates`

Read-only. The classifier's doc-type universe comes from this table for `form_id='pbv-full-application'`.

### `lib/scan/splitPdf.ts` (extracted from existing code)

`app/api/admin/scan-upload/route.ts` has PDF-splitting logic using `pdfjs-dist` and `sharp`. Extract to `lib/scan/splitPdf.ts` so packet intake and the existing scan flow share it. Existing scan-upload tests must continue passing.

### `StantonReviewSurface`

- Add "Intake Packet" toolbar button linking to `/admin/pbv/full-applications/[id]/intake`.
- Add "Additional Documents" visual group for `doc_type='custom'` rows.
- Confirm completeness counter (`Docs Approved: N/N req`) operates on `required=true` rows only; custom docs are excluded.

### OCR provider — Claude API (closed)

Per the prior PRD's closed decision. Vision endpoint. Per-page calls return `{ text, confidence }`. Confidence derived from response heuristics (length, structure, error markers), not provided by the API directly. OCR client wrapper (`lib/intake/ocr.ts`) reads model and rate-limit settings from environment variables. On API failure, page inserted with `ocr_confidence='none'` and no suggestion — batch not blocked.

### Storage layout

- `intake-staging/{batch_id}/{global_index}.jpg` — pages during classify (form-agnostic bucket).
- `pbv-documents/{application_id}/{document_id}/{revision}.{ext}` — final committed documents (existing convention from lifecycle PRD, confirm).

On commit, files move from staging to final. Staging auto-purged 7 days after batch reaches `committed` or `abandoned` (cron-scheduled cleanup, scope of this build).

---

## Implementation Phases

### Phase 1 — Intake substrate

**Deliverable:** Migration `supabase/migrations/<ts>_packet_intake_substrate.sql` with `intake_batches`, `intake_pages`, `doc_type_signatures`. Seed `doc_type_signatures` for all PBV doc types. Extract `lib/scan/splitPdf.ts` from `app/api/admin/scan-upload/route.ts`.

**Done when:**
- Tables exist with correct shape, indexes, constraints, RLS.
- `doc_type_signatures` seeded for every PBV doc_type from `form_document_templates WHERE form_id='pbv-full-application'`.
- Existing scan-upload tests pass against the extracted splitter.

### Phase 2 — Upload endpoint

**Deliverable:** `POST /api/admin/intake/[anchor_type]/[anchor_id]/upload` accepts multipart form-data (PDF, JPG, PNG, HEIC). Creates `intake_batches` row with the polymorphic anchor, splits files via `lib/scan/splitPdf.ts`, saves pages to `intake-staging/{batch_id}/{global_index}.jpg`, inserts `intake_pages` rows. No OCR yet.

**Done when:**
- A 30-page test PDF round-trips end-to-end: upload → 30 page rows → 30 image files in staging.
- A mixed batch (1 PDF + 3 JPG + 1 HEIC) produces the right number of pages, all images as JPG.
- Existing scan-upload tests still pass.

### Phase 3 — OCR + classifier

**Deliverable:** `lib/intake/ocr.ts` (Claude API vision). `lib/intake/classifier.ts` (signature-based scoring, confidence buckets, person-slot detection). Upload endpoint extended to call OCR + classification synchronously per page.

**Done when:**
- Fixture set in `__tests__/fixtures/intake-packets/` (≥10 pages covering canonical doc types) produces ≥80% correct doc_type suggestions at high or medium confidence.
- Person-slot suggestions correct when exactly one household member's name is on the page.
- OCR/classifier failures logged; page row still inserted with `ocr_confidence='none'`; batch not blocked.

### Phase 4 — Classify UI

**Deliverable:** Route `/admin/pbv/full-applications/[id]/intake` at `app/admin/pbv/full-applications/[id]/intake/page.tsx`. Three phases (Upload → Classify → Commit). Two-column drag-classify view. Custom and Discard targets. Multi-page grouping (shift-click). Persistent `staged_assignment` JSONB. "Intake Packet" button on `StantonReviewSurface`.

**Done when:**
- Manual test: staff classifies a 20-page batch end-to-end without losing work after refresh.
- All page assignments persist across reload.
- Custom prompts for label, accepts it.
- Discard target removes pages from unassigned count without committing.

### Phase 5 — Commit + audit

**Deliverable:** `POST /api/admin/intake/[anchor_type]/[anchor_id]/commit/[batch_id]`. Transactional `application_documents` inserts/revisions, post-commit storage moves with retry, `application_events` writes, batch status transitions. Confirmation modal. Packet History expander. `StantonReviewSurface` renders `doc_type='custom'` rows in their own group, excluded from completeness tile and Send-to-HACH gate.

**Done when:**
- Committing a packet produces the expected `application_documents` rows + revisions with correct provenance fields.
- Rollback test: force a storage failure mid-commit. DB and storage end in a consistent state (no half-imported rows, no orphaned storage objects).
- `application_events` shows the expected entries.
- Custom docs appear in their own visual group; completeness counter and Send-to-HACH gate unchanged by their presence.
- `intake_batches.status` transitions correctly across the commit lifecycle.

### Phase 6 — Polish

**Deliverable:** Empty states for every phase. Error states (OCR provider failure, storage failure, unauthorized access, batch belongs to a different application). Packet History expander showing prior batches with status, page count, committed doc count, timestamp. Storage cleanup script `scripts/cleanup-abandoned-intake-batches.ts` for staging files older than 7 days in `abandoned` or `committed` status (scheduled via Vercel cron after merge).

---

## Closed decisions

1. **OCR provider:** Claude API vision.
2. **`scan_batches` reuse:** New parallel intake tables; existing `scan_batches` untouched.
3. **UI route placement:** PBV UI at `/admin/pbv/full-applications/[id]/intake`. Generic API at `/api/admin/intake/[anchor_type]/[anchor_id]/...`.
4. **Anchor model:** polymorphic `(anchor_type, anchor_id)` matching `application_events`. PBV writes `'pbv_full_application'`.
5. **Document destination:** `application_documents` (PRD-01). No writes to `form_submission_documents`.
6. **Storage staging bucket:** form-agnostic. `intake-staging/`.
7. **Templates:** stay generic in `form_document_templates` keyed by `form_id`.

---

## Open questions for Windsurf

1. **Revision contract.** When packet intake writes a document to a slot that already has rows, the lifecycle PRD's revision model applies via `application_documents` (delivered by PRD-01). Confirm the exact revision-creation semantics in PRD-01's migration before coding the commit endpoint. The candidate unique constraint is `(anchor_type, anchor_id, doc_type, person_slot, revision)`.
2. **OCR provider env vars.** Confirm env var names, model name, rate limits exist in `.env` and the deploy config. If missing, stop and report.
3. **`upload_source = 'packet_intake'` enum membership on `application_documents`.** Confirm PRD-01 added it. If not, this PRD's migration extends the CHECK.

---

## Out of Scope

- Email-to-intake (forward email + attachments → batch). Separate PRD.
- Auto-rotation correction on upside-down scans.
- Bulk re-categorization across documents already committed (lifecycle PRD handles single-document re-categorization).
- Tenant-facing packet upload via the portal.
- Cross-application packet intake.
- Anything that would write to `form_submission_documents` for PBV. Explicitly forbidden.

---

## Success Criteria

- Staff can take a walk-in tenant's packet (15–25 documents across multiple files) from paper to fully classified, person-attributed, committed `application_documents` rows in under 10 minutes of staff time.
- ≥80% of pages get a correct high- or medium-confidence `doc_type` suggestion on first OCR pass.
- No half-committed batches in production. Either all pages land or none do.
- Custom documents never gate Send-to-HACH.
- Zero references to `form_submission_documents` in new code paths.
- Substrate (`intake_batches`, `intake_pages`, `doc_type_signatures`, `intake-staging/` bucket) is callable by refi or other workflows with a different `anchor_type` and no schema change.
