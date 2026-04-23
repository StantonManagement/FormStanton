# Foundation Review Layer — Task Tracking

---

## Phase 0 — Reconnaissance ✅ COMPLETE

**Deliverable:** `tasks/foundation-review-audit.md`  
**Status:** Approved by Alex — Phase 0 checkpoint passed.

### What was established:
- Full `form_submissions` schema audited (live DB + migrations)
- All integration points located with file paths and line numbers
- Identified 6 atomic-review assumptions that need guarding in later phases
- Identified that workflow migration (`20260314220000`) was **never applied to live DB**
- Identified that `pbv-document-tracker.jsx` does not exist in the codebase
- Identified that no tenant-facing submission status page exists for `form_submissions`
- Identified storage buckets (no `form-submissions` bucket exists)
- Documented i18n pattern from `lib/portalTranslations.ts`

### Resolutions (Phase 0 checkpoint):
- **[A1 → resolved]** Filename convention: `{AssetID}_{Unit} - {DocType} - {LastName} - {YYYYMMDD} - v{N}.{ext}`. Extends existing compliance dash format.
- **[A2 → resolved]** Phase 4 builds a new tenant page at `/t/[token]`. Token stored as `tenant_access_token` on `form_submissions`. Magic-link only, no account.
- **[A3 → resolved]** New `form-submissions` storage bucket created in Phase 2 migration.
- **[A4 → resolved]** Workflow migration `20260314220000` applied as Phase 2's first step. If it fails, stop and flag.
- **[ref file]** Alex will place `pbv-document-tracker.jsx` at `tasks/reference/pbv-document-tracker.jsx` before Phase 3. If absent when Phase 3 starts, stop and flag.

---

## Phase 1 — Schema Design ✅ COMPLETE

**Deliverables:**
- [x] `tasks/foundation-review-schema-decision.md` — 3 alternatives evaluated, child table model selected
- [x] `supabase/migrations/20260423180000_foundation_review_per_document.sql` — written, not applied

**Decision:** Child table model. JSONB eliminated (no indexing, concurrent write collision risk, PRD anti-slop rule). Polymorphic eliminated (no FK enforcement, speculative generalization, Section 8 reuse doesn't need it).

**New tables:** `form_document_templates`, `form_submission_documents`, `form_submission_document_revisions`

**New columns on `form_submissions`:** `review_granularity`, `document_review_summary`, `tenant_access_token`

**Rollback:** Documented at bottom of migration file. Safe to run while new tables are empty.

---

## Phase 2 — Schema Execution + API Layer 🔄 IN PROGRESS

**Deliverables:**
- [x] **PREREQUISITE:** Apply `20260314220000_add_submission_workflow_fields.sql` to live DB ✓
- [x] Apply amended per-document migration to live DB ✓
- [x] Create `form-submissions` storage bucket (non-public) ✓
- [x] `POST /api/forms/[formId]/submissions` — seeds per-document submission + document slots from templates
- [x] `GET /api/t/[token]/status` — tenant views submission + document list
- [x] `POST /api/t/[token]/documents/[documentId]` — tenant uploads file to slot (route deviation from PRD: documentId > doc_type+slot)
- [x] `POST /api/admin/submissions/[submissionId]/documents/[documentId]/review` — approve/reject/waive
- [x] `GET /api/admin/submissions/[submissionId]/documents` — list + revision history
- [x] `GET /api/admin/submissions/[submissionId]/export` — ZIP of submitted/approved/waived docs + manifest.csv
- [x] `POST /api/admin/form-submissions/[id]/regenerate-token` — new tenant_access_token
- [x] Guard on `PATCH /api/admin/form-submissions/[id]` — blocks status/denial/revision_notes write for per_document submissions
- [x] `lib/stantonFilename.ts` — Stanton filename builder (P{slot} logic included)
- [x] `lib/memberFilter.ts` — applies_to / member_filter evaluator
- [x] `scripts/test-foundation-review.ts` — integration test script (T1–T10 coverage)

**Route deviation from PRD:** Tenant upload uses `[documentId]` (the UUID) rather than `[doc_type]` + person_slot. Rationale: `doc_type` alone is ambiguous with multiple per-person slots. The frontend already has document UUIDs from the status GET endpoint.

**Awaiting Phase 2 checkpoint:** Alex runs `scripts/test-foundation-review.ts` or verifies curl examples. Seed `form_document_templates` first.

---

## Phase 3 — Admin UI ✅ COMPLETE

**Deliverables:**
- [x] `components/form/PerDocumentReviewPanel.tsx` — new component: rollup summary, progress bar, tenant access link + regenerate, filter pills, per-document table with inline approve/reject/waive action panels and revision history toggle
- [x] `app/admin/form-submissions/[id]/page.tsx` — extended: `review_granularity`, `document_review_summary`, `tenant_access_token` added to interface; `PerDocumentReviewPanel` rendered full-width before the 2-col grid when `per_document`; status/denial/revision controls suppressed in edit sidebar for `per_document` (replaced with informational callout)
- [x] Regression: atomic-review submissions render identically — all changes are behind `review_granularity === 'per_document'` conditions
- [x] Guard on `FormSubmissionQuickViewModal` — `review_granularity` added to interface; status dropdown suppressed for `per_document` submissions (shows "Status derived from per-document review" label instead)
- [x] Export ZIP button wired from detail page (calls `GET /api/admin/submissions/[id]/export`)
- [x] Tenant access link with Copy + Regenerate (calls `POST /api/admin/form-submissions/[id]/regenerate-token`)

**Visual language:** Adapted from `tasks/reference/pbv-document-tracker.jsx` — segmented progress bar, status badges with colored dots, filter pills with count badges, rejected rows highlighted red.

**Awaiting Phase 3 checkpoint:** Alex reviews in browser. Approves Phase 4.

---

## Phase 4 — Tenant UI ✅ COMPLETE

**Deliverables:**
- [x] `lib/submissionStatusTranslations.ts` — EN/ES/PT strings following `portalTranslations` pattern
- [x] `components/SubmissionStatusPortal.tsx` — tenant-facing per-document status page: submission info card, progress bar + counts, per-doc list with status badges, rejection reason inline, upload button (rejected/missing only), read-only state for approved/waived
- [x] `components/TokenRouter.tsx` — detects token type by probing `/api/t/${token}/status`; routes to `SubmissionStatusPortal` (200) or `TenantPortal` (404/error)
- [x] `app/t/[token]/page.tsx` — updated to render `TokenRouter` instead of `TenantPortal` directly; existing compliance portal unchanged
- [x] Trilingual language switcher (EN/ES/PT) in `SubmissionStatusPortal` header; language seeded from `submission.language`
- [x] Upload via `POST /api/t/${token}/documents/${doc.id}` (multipart); per-doc upload state (idle/uploading/error/success); auto-refetch after success
- [x] Approved documents: read-only, no upload button; API also blocks (409) as second layer
- [x] Waived documents: "not required" note, no upload
- [x] All-done banner when all required docs are approved or waived

**Regression:** Compliance project portal unchanged — `TenantPortal` still rendered for project-unit tokens (compliance API returns 404 for submission tokens)

**Awaiting Phase 4 checkpoint:** Alex reviews in browser with a test per_document submission token.

---

## Phase 5 — Bulk Export ✅ COMPLETE

**Deliverables:**
- [x] Export ZIP button on admin detail page — wired in Phase 3 via `PerDocumentReviewPanel.tsx` (calls `GET /api/admin/submissions/[id]/export`)
- [x] `POST /api/admin/submissions/bulk-export` — accepts `submissionIds[]`, skips non-per_document rows, downloads all submitted/approved/waived files, organizes into per-submission subfolders `{TenantName}_{submissionId[0..8]}/`, returns ZIP
- [x] `manifest.csv` at ZIP root — columns: submission_id, tenant_name, doc_type, label, person_slot, revision, status, file_name, reviewer, reviewed_at, rejection_reason
- [x] Files use Stanton naming at rest (unchanged from Phase 2 uploads)
- [x] "Export ZIP" button in list page bulk toolbar — appears only when ≥1 selected submission is per_document; calls bulk-export endpoint and triggers browser download

**Regression:** Atomic submissions unaffected — bulk-export button is hidden when none of the selected submissions are per_document; existing bulk-assign and bulk-mark-sent-to-appfolio actions unchanged.

---

## Foundation Review Layer — COMPLETE

---

---

## PBV Application Layer (PRD 2) — Task Tracking

---

## Phase 0 — Close Phase 1 Gaps ✅ COMPLETE

**Deliverables:**
- [x] `lib/pbvPreappPdf.ts` — PDF generation using pdf-lib; Stanton header, HoH info, qualification math, household member table, citizenship, reviewer decision, signature line
- [x] `POST /api/admin/pbv/preapps/[id]/summary-pdf` — generates and streams PDF for download
- [x] `app/admin/pbv/preapps/page.tsx` — "Generate Summary PDF" button added to detail drawer (with loading + error states)
- [x] `GET /api/admin/pbv/thresholds` — returns all pbv_income_thresholds ordered by household_size
- [x] `POST /api/admin/pbv/thresholds` — accepts `{ thresholds: [...] }` array, validates, delete+inserts by household_size
- [x] `app/admin/pbv/thresholds/page.tsx` — inline-edit table for income limits + effective dates; save/discard; changed-row highlighting
- [x] `components/AdminSidebar.tsx` — "PBV Thresholds" link added under Audits

**Awaiting Phase 0 checkpoint:** Alex confirms PDF generation works and thresholds UI is editable.

### Phase 0 Addendum — Open Enrollment Pre-App ✅ COMPLETE

**Decision:** PBV pre-app is open enrollment, not magic-link-only. Standalone tenant URL added.

**Deliverables:**
- [x] Migration `20260423100000` — adds `unit_not_in_canonical_list boolean`, `submission_source text` to `pbv_preapplications`; back-fills existing rows as `magic_link`
- [x] `lib/rateLimiter.ts` — in-memory IP rate limiter (10 req / IP / hour)
- [x] `POST /api/forms/pbv-preapp` — open enrollment submission endpoint; validates building/unit vs canonical list; sets `unit_not_in_canonical_list` flag; rate-limited
- [x] `app/pbv-preapp/page.tsx` — standalone tenant form; building dropdown + unit text input with canonical hint; consent checkbox at top; full form (HoH, members, citizenship, cert, signature); posts to `/api/forms/pbv-preapp`
- [x] `lib/formsData.ts` Form 28 — path updated to `/pbv-preapp` (Copy Link now links to live tenant form)
- [x] `app/admin/pbv/preapps/page.tsx` — duplicate badge (orange) when multiple submissions share building+unit; "Unit?" badge (amber) when `unit_not_in_canonical_list = true`
- [x] `app/api/admin/pbv/preapps/route.ts` — select updated to include `unit_not_in_canonical_list` and `submission_source`

**Notes:**
- Consent text is a placeholder; final wording from Dan pending
- Language selector not yet added to open enrollment form (token-based form already handles multilingual via `preferred_language`; open enrollment defaults to `en`)
- No captcha for round 1; revisit if abuse appears
- Tenant access token work for per-document review (full app, recert) is separate; pre-app open enrollment does not generate or consume tokens

---

## Phase 1 — Reconnaissance

**Status:** Not started. Awaiting Phase 0 checkpoint approval.

---

## Schema Amendment Requests

_None yet. Any mid-phase schema conflicts go here before continuing._

---

## Deferred Items

_None yet._
