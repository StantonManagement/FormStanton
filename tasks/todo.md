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

## Phase 2 — Schema Execution + API Layer ⏳ WAITING

**Deliverables:**
- [ ] **PREREQUISITE:** Apply `20260314220000_add_submission_workflow_fields.sql` to live DB (never applied). Stop and flag if it fails.
- [ ] Apply new per-document migration to live DB
- [ ] Create `form-submissions` storage bucket
- [ ] `POST /api/forms/[form_id]/submissions` — extended (init document rows)
- [ ] `POST /api/t/[token]/submissions/[submission_id]/documents/[doc_type]` — tenant upload
- [ ] `POST /api/admin/submissions/[submission_id]/documents/[document_id]/review` — staff action
- [ ] `GET /api/admin/submissions/[submission_id]/documents` — list + revision history
- [ ] `GET /api/admin/submissions/[submission_id]/export` — ZIP
- [ ] Integration tests for each route
- [ ] Guard on `PATCH /api/admin/form-submissions/[id]` — reject direct status write for per-document submissions
- [ ] `form-submissions` storage bucket created

---

## Phase 3 — Admin UI ⏳ WAITING

**Deliverables:**
- [ ] `app/admin/form-submissions/[id]/page.tsx` — branch on `review_granularity`
- [ ] Per-document table component (doc label, status badge, file, reviewer, revision, rejection reason, actions)
- [ ] Approve/reject/waive action per row with rejection-reason input
- [ ] Rollup summary at top (X/Y approved, Z rejected, W missing)
- [ ] Regression: atomic-review submissions still render correctly
- [ ] Guard on `FormSubmissionQuickViewModal` — suppress status dropdown for per-document

**Note:** `pbv-document-tracker.jsx` visual reference does not exist — Alex must provide or clarify before Phase 3.

---

## Phase 4 — Tenant UI ⏳ WAITING

**Deliverables:**
- [ ] New tenant-facing page for per-document submission status
- [ ] Per-document status display (EN/ES/PT)
- [ ] Upload button per document (enabled only for `rejected` or `missing`)
- [ ] Rejection reason visible to tenant
- [ ] Approved documents read-only
- [ ] Trilingual via `lib/submissionStatusTranslations.ts` (to create, following `portalTranslations` pattern)

**Blocked on:** Alex's decision on tenant access mechanism (A2)

---

## Phase 5 — Bulk Export ⏳ WAITING

**Deliverables:**
- [ ] Export button wired on admin detail page (Phase 2 delivers API)
- [ ] Per-form bulk export: select N submissions → single ZIP
- [ ] Manifest.csv at ZIP root
- [ ] Files use Stanton naming (already at rest from Phase 2 uploads)

---

## Schema Amendment Requests

_None yet. Any mid-phase schema conflicts go here before continuing._

---

## Deferred Items

_None yet._
