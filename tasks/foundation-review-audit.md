# Phase 0 Audit — Foundation Review Layer
**Date:** April 23, 2026  
**Phase:** 0 — Reconnaissance (no code written)

---

## 1. `form_submissions` Schema (live DB: `lieeeqqvshobnqofcdac`)

### Confirmed columns (queried live):
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| created_at | timestamptz | |
| form_type | text NOT NULL | non-empty check |
| tenant_name | text | |
| building_address | text | |
| unit_number | text | |
| form_data | jsonb NOT NULL | |
| photo_urls | text[] | default '{}' |
| signature_url | text | |
| language | text | |
| submitted_at | timestamptz | |
| reviewed | boolean | default false |
| reviewed_by | text | |
| reviewed_at | timestamptz | |
| admin_notes | text | |
| exemption_reason | text | |
| exemption_documents | text[] | default '{}' |
| exemption_status | text | default 'pending' |
| exemption_reviewed_by | text | |
| exemption_reviewed_at | timestamptz | |
| exemption_notes | text | |
| pdf_url | text | |

### CRITICAL: Workflow columns NOT in live DB
The following columns are defined in `supabase/migrations/20260314220000_add_submission_workflow_fields.sql` but are **not applied** to the live database (confirmed via information_schema query):

- `status` (text, default 'pending_review')
- `assigned_to` (text)
- `priority` (text, default 'medium')
- `status_history` (jsonb, default '[]')
- `denial_reason` (text)
- `revision_notes` (text)
- `sent_to_appfolio_at` (timestamptz)
- `sent_to_appfolio_by` (text)

The admin form-submissions list and detail pages reference these columns. The pages render without crashing (SELECT * silently omits missing columns), but status badges and workflow actions are non-functional on the live DB.

**Phase 2 must apply the workflow migration before adding new columns.**

Migration file (not yet applied): `supabase/migrations/20260314220000_add_submission_workflow_fields.sql`

---

## 2. Admin List Page

**File:** `app/admin/form-submissions/page.tsx` (576 lines)

- Fetches from `GET /api/admin/form-submissions` with filter params
- Renders `FormSubmissionQuickViewModal` on row click (`components/FormSubmissionQuickViewModal.tsx`)
- Quick-view tabs (lines 247–253): all, needs_action, approved_not_sent, ready_for_appfolio, waiting_on_tenant — all filter on `status` column
- Bulk actions (lines 126–177): assign, mark_sent_to_appfolio — both write to `status`

**Where atomic assumption lives:** The status filter UI (lines 300–315) and quick-view tab logic (lines 247–253) treat `status` as the single source of truth. For per-document submissions, parent status will be derived from child states, so these filters continue to work without change.

**No breakage risk here** — the list view will work correctly with `review_granularity` added, since parent status still exists.

---

## 3. Admin Detail Page

**File:** `app/admin/form-submissions/[id]/page.tsx` (612 lines)

### Atomic-review assumptions that would break or need branching:

| Location | What it does | Breakage risk |
|---|---|---|
| Lines 458–565 | Edit panel: single `status` dropdown + `denial_reason` + `revision_notes` textareas | Must be hidden/replaced when `review_granularity = 'per_document'` |
| Lines 397–414 | Renders `photo_urls` as image grid | Per-document submissions will not use `photo_urls` — safe to leave, will render empty |
| Lines 384–395 | Renders `form_data` key-value — purely display | Safe — no action taken |
| Lines 427–454 | Renders `status_history` JSONB array | Safe — per-document submissions still get parent status history entries |

**Status transition logic** (lines 218–261, `handleUpdate`):  
- PATCH to `/api/admin/form-submissions/${id}` sends `status`, `denial_reason`, `revision_notes`  
- For per-document submissions, status must be derived from children, not set directly  
- The edit panel must be replaced/suppressed for `review_granularity = 'per_document'`

**Phase 3 extension point:** The detail page needs a conditional branch at line 350 (`<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">`) — when `review_granularity = 'per_document'`, replace left column content with per-document table.

---

## 4. FormSubmissionQuickViewModal

**File:** `components/FormSubmissionQuickViewModal.tsx` (227 lines)

- Status dropdown (lines 191–204): unguarded — allows any status change on any submission
- "Assign to Me" button (lines 69–89): writes `assigned_to` — safe for per-document
- PATCH call at line 50: sends `status` directly

**Breakage:** If a per-document submission is opened in the QuickViewModal, staff can set parent status manually — bypassing the derived-status rule.  
**Fix:** Check `submission.review_granularity` and suppress the status dropdown when `'per_document'`. The `FormSubmission` interface (line 13) will need `review_granularity` added.

---

## 5. API Routes — `form-submissions`

### `GET /api/admin/form-submissions`
**File:** `app/api/admin/form-submissions/route.ts` (156 lines)

- `select('*')` at line 29 — will pick up new columns automatically
- View filter logic (lines 97–118): filters on top-level `status` — correct, parent status still exists for per-document submissions
- `statusCounts` (lines 120–128): counts by top-level `status` — correct

**Extension needed:** When `review_granularity = 'per_document'`, the list view could show `document_review_summary` (the denormalized rollup). No changes needed for existing filter logic.

### `GET/PATCH /api/admin/form-submissions/[id]`
**File:** `app/api/admin/form-submissions/[id]/route.ts` (162 lines)

**GET handler** (lines 6–57):
- `select('*')` — will return new columns
- Related submissions lookup (lines 37–43): matches by `tenant_name` — safe

**PATCH handler** (lines 59–161):
- Accepts `status`, `assigned_to`, `priority`, `admin_notes`, `denial_reason`, `revision_notes` from body
- Lines 97–115: unconditionally sets `status` and appends to `status_history`
- **Breakage:** For per-document submissions, direct status writes must be rejected (status derives from children). Phase 2 adds a guard: if `review_granularity = 'per_document'` and `status` is in body, return 400.

### `POST /api/admin/form-submissions/bulk-action`
**File:** `app/api/admin/form-submissions/bulk-action/route.ts` (114 lines)

- `mark_sent_to_appfolio` (lines 43–65): writes `status = 'sent_to_appfolio'` directly
- For per-document submissions, `sent_to_appfolio` is a valid terminal status — safe to allow
- `assign` and `set_priority` actions: safe for any submission type

---

## 6. Existing Bulk Export

**File:** `app/api/admin/compliance/download-documents-zip/route.ts` (271 lines)

This route is for the **old `submissions` table** (compliance system), not `form_submissions`.

- Reads from: `submissions` table (line 88)
- Storage bucket: `submissions` (line 214)
- Naming convention: `{AssetID} - {DOCUMENT TYPE} - {Last, First} - {YYYY-MM-DD}.{ext}` (lines 44–56)

**This route does not touch `form_submissions` and will not be extended.** Phase 5 creates a new route for per-document exports.

**ASSUMPTION [A1]:** The PRD's naming convention (`{AssetID}_{Unit}_{DocType}_{LastName}_{YYYYMMDD}_v{Revision}.{ext}`) uses underscores and includes unit + revision, while the existing compliance export uses dashes and `Last, First` format. These are deliberately different (different systems). Phase 1 must confirm whether the PRD's convention is the intended one or whether alignment with the compliance export convention is preferred.

---

## 7. Tenant Portal

**File:** `app/t/[token]/page.tsx` → `components/TenantPortal.tsx` (443 lines)

This is the **compliance/projects tenant portal** (magic link → task list). It has no awareness of `form_submissions`.

**There is no existing tenant-facing submission status page for `form_submissions`.** Tenants submit forms (pet-approval, etc.) and receive a success message — they have no way to view submission status or resubmit individual documents.

**ASSUMPTION [A2]:** Phase 4 will CREATE a new tenant-facing page for per-document submission status, not extend TenantPortal. The likely route is `/submissions/[submission_id]?token=[tenant_access_token]` or similar. Phase 1/2 must define the tenant access mechanism (magic link? submission ID + last-name verification?). This needs Alex's input.

---

## 8. File Upload Flow (end-to-end, representative: Pet Approval)

1. Tenant submits `app/pet-approval/page.tsx` (not audited in depth; follows standard form pattern)
2. POST to `app/api/forms/pet-approval/route.ts` (218 lines)
3. Files uploaded to `form-photos` bucket, path `pet-approval/{timestamp}-{key}-{filename}`
4. Public URLs generated and stored in `photo_urls` (text array) on `form_submissions` row
5. Signature uploaded to `form-photos` bucket as PNG
6. PDF generated via `generatePetAddendumPdf` and stored in `form-photos`, URL stored in `pdf_url`
7. Row inserted into `form_submissions` via service-role client

**Storage bucket for form_submissions uploads:** `form-photos`  
**Path structure:** `{form-type}/{timestamp}-{key}-{filename}` — no structure, no naming convention

**For per-document uploads, the PRD requires:**
- Storage path: `form-submissions/{submission_id}/{doc_type}/{file_name}`
- Human-readable naming: `{AssetID}_{Unit}_{DocType}_{LastName}_{YYYYMMDD}_v{Revision}.{ext}`

**ASSUMPTION [A3]:** A new storage bucket `form-submissions` should be created for per-document uploads. Using `form-photos` would mix two storage patterns in one bucket. Phase 2 creates the bucket as part of migration.

---

## 9. Trilingual i18n Pattern

**File:** `lib/portalTranslations.ts` (118 lines)

Pattern:
```typescript
export const portalTranslations: Record<PreferredLanguage, PortalStrings> = {
  en: { key: 'English string', ... },
  es: { key: 'Spanish string', ... },
  pt: { key: 'Portuguese string', ... },
};
```

`PreferredLanguage` = `'en' | 'es' | 'pt'` (from `types/compliance.ts`)

Each form also has its own file (e.g., `lib/petApprovalTranslations.ts`, `lib/pbvFormTranslations.ts`).

**Phase 4 i18n plan:** Create `lib/submissionStatusTranslations.ts` following the `portalTranslations` pattern. Keys needed: document status labels, rejection reason display, upload button labels, section headings. `form_document_templates` already has `label_es` and `label_pt` columns for per-document labels.

---

## 10. `pbv-document-tracker.jsx` — Missing Reference

The PRD (Phase 3 guidance) references `pbv-document-tracker.jsx` as a visual reference file "in the project files." **This file does not exist anywhere in the codebase.**

A search across all directories found zero results. No JSX or TSX file matching that pattern exists.

**Action required:** Alex must provide this file before Phase 3 begins, or clarify the visual reference. Phase 3 cannot rely on it until it exists.

---

## 11. Storage Buckets (live)

| Bucket | Used by |
|---|---|
| `submissions` | Old compliance system (pets, vehicles, insurance) |
| `form-photos` | `form_submissions` uploads (all form types) |
| `signatures` | Signature captures |
| `project-evidence` | Multi-project compliance task evidence |

**No `form-submissions` bucket exists.** Phase 2 creates it for per-document uploads.

---

## 12. Places That Assume Atomic Review

Exhaustive list — every location that would break or need guarding if passed a per-document submission:

| File | Lines | What breaks |
|---|---|---|
| `app/admin/form-submissions/[id]/page.tsx` | 458–565 | Edit panel writes `status`, `denial_reason`, `revision_notes` directly |
| `app/admin/form-submissions/[id]/page.tsx` | 177–181 | `selectedStatus` initialized from `submission.status` without granularity check |
| `components/FormSubmissionQuickViewModal.tsx` | 191–204 | Status dropdown writes status without granularity check |
| `components/FormSubmissionQuickViewModal.tsx` | 47–67 | `handleStatusChange` calls PATCH with raw status |
| `app/api/admin/form-submissions/[id]/route.ts` | 97–115 | PATCH handler writes `status` + `status_history` unconditionally |
| `app/api/admin/form-submissions/[id]/route.ts` | 129–135 | PATCH handler writes `denial_reason`, `revision_notes` unconditionally |

---

## 13. `EvidenceViewer.tsx`

**File:** `components/compliance/EvidenceViewer.tsx` (234 lines)

This component renders evidence for the compliance/projects system. It accepts `DynamicColumn` and `ProjectMatrixRow` types — both specific to the compliance system.

**Not directly reusable for per-document review.** Phase 3 will need a new, simpler component (or extracted sub-component) for rendering a single document file (PDF iframe / image / download link). The rendering logic (lines 102–143) is portable — the type signatures are not.

---

## 14. What the Form Submission Flow Does NOT Have

- No `review_granularity` column (to be added in Phase 2)
- No `document_review_summary` column (to be added in Phase 2)
- No `form_submission_documents` table
- No `form_submission_document_revisions` table
- No `form_document_templates` table
- No tenant-facing status page for `form_submissions`
- No per-submission export endpoint
- No `form-submissions` storage bucket

---

## Assumptions Requiring Alex's Confirmation

| ID | Assumption | Blocks |
|---|---|---|
| A1 | Per-document filename convention (`{AssetID}_{Unit}_{DocType}_{LastName}_{YYYYMMDD}_v{Revision}.{ext}`) is intentionally different from compliance export convention (`{AssetID} - {DOCUMENT TYPE} - {Last, First} - {YYYY-MM-DD}.{ext}`) | Phase 1 schema + Phase 2 upload logic |
| A2 | There is no existing tenant-facing submission status page; Phase 4 creates one. The tenant access mechanism (magic link? submission token?) is undefined and needs Alex's direction | Phase 4 design |
| A3 | A new `form-submissions` storage bucket is created in Phase 2 for per-document uploads, separate from `form-photos` | Phase 2 migration |
| A4 | The workflow migration (`20260314220000_add_submission_workflow_fields.sql`) was never applied to the live DB and must be applied as part of Phase 2's migration | Phase 2 execution |

---

## Open Questions from PRD (Phase 0 additions)

| Question | Impact |
|---|---|
| `pbv-document-tracker.jsx` does not exist in the repo. What visual reference should Phase 3 use? | Phase 3 UI |
| What is the tenant access mechanism for the per-document status page (Phase 4)? Magic link? Submission ID + verification? | Phase 4 API design |
| Should the `sent_to_appfolio` bulk action be blocked for per-document submissions that are not fully approved? | Phase 2 API guard |
