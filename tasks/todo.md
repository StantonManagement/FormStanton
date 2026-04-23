# Foundation Review Layer — Task Tracking

---

## Phase 0 — Reconnaissance ✅ COMPLETE

**Deliverable:** `tasks/foundation-review-audit.md`  
**Status:** Written. Awaiting Alex's review.

### What was established:
- Full `form_submissions` schema audited (live DB + migrations)
- All integration points located with file paths and line numbers
- Identified 6 atomic-review assumptions that need guarding in later phases
- Identified that workflow migration (`20260314220000`) was **never applied to live DB**
- Identified that `pbv-document-tracker.jsx` does not exist in the codebase
- Identified that no tenant-facing submission status page exists for `form_submissions`
- Identified storage buckets (no `form-submissions` bucket exists)
- Documented i18n pattern from `lib/portalTranslations.ts`

### Assumptions requiring Alex's approval before Phase 1:
- **[A1]** Per-document filename convention confirmed as PRD's underscore format
- **[A2]** Phase 4 will CREATE a new tenant status page (no existing one to extend)
- **[A3]** New `form-submissions` storage bucket to be created in Phase 2
- **[A4]** Workflow migration must be applied in Phase 2 before new columns

---

## Phase 1 — Schema Design ⏳ WAITING (awaiting Phase 0 approval)

**Deliverables:**
- [ ] `tasks/foundation-review-schema-decision.md` — 3 alternatives + recommendation
- [ ] Migration file in `supabase/migrations/` — written, not applied

**Scope:**
- Evaluate: child table model (PRD proposal) vs. JSONB-per-submission vs. polymorphic reviewable_items
- Analyze: query ergonomics, indexing, RLS complexity, bulk export difficulty, future Section 8 reuse
- Write migration for chosen approach (includes workflow fields catch-up + new tables)
- Include rollback instructions

---

## Phase 2 — Schema Execution + API Layer ⏳ WAITING

**Deliverables:**
- [ ] Migration applied to live DB
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
