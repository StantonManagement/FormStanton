# PRD-03: PBV Tenant-Facing Packet Upload

**Date:** 2026-05-14 (amended same day — see Amendment block below)
**Status:** Draft — ready for build (Open Questions resolved during cross-PRD audit)
**Depends on:** PRD-01 (Documents Decoupling) merged. PRD-1.5 (Revisions Decoupling) merged. `stanton-workspace-document-lifecycle` merged.
**Coordinates with:** PRD-02 (Staff Packet Intake) — shares **nothing operationally**. PRD-03 does not use `intake_batches` / `intake_pages` / OCR substrate. They coexist; neither blocks the other.
**Anchor scope:** `pbv_full_application` only.
**Out of scope:** OCR, page-splitting, classifier UI on the tenant side. Tenants upload one file per required document. Power tools are staff-side (PRD-02).

---

## Amendment 2026-05-14 (mid-build cross-PRD audit)

Findings from the PRD-02 build session and the PRD-03 Open-Questions audit changed three things in this PRD:

1. **All four Open Questions are now answered** with grep evidence. The "Open Questions for Windsurf" section below has been replaced with answers + line references.
2. **Storage bucket is `form-submissions`, not `pbv-documents`.** PRD-02 work confirmed the live convention. All references in this PRD updated.
3. **There is no centralized revision-write helper.** PRD-1.5's revision creation is inlined per-route. PRD-03 mirrors the pattern from `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158`. Do not refactor; that's a separate PRD.
4. **Scope decision on the legacy `/t/[token]` portal:** Option B with TokenRouter redirect. New endpoints live under `/api/pbv-full-app/[token]/...`. The existing `SubmissionStatusPortal` component and `/api/t/[token]/documents/[documentId]` route are **not modified** — they serve non-PBV workflows. A new redirect in `TokenRouter` sends PBV tokens hitting `/t/[token]` to the new path so existing SMS links keep working.

---

## Problem Statement

The PBV full-application packet requires 15–25 supporting documents per household (paystubs, bank statements, citizenship docs, signed HUD forms, etc. — see `pbv-campaign-planning.md`). Today the tenant has two paths to deliver these:

1. **Walk into the office** — staff digitizes via PRD-02 (when shipped).
2. **Magic-link portal** — `/pbv-full-app/[token]/page.tsx`. The current portal is a 1500-line form collecting application *data* (household composition, income sources, citizenship, etc.). It does **not** have a file-upload surface tied to the application's required document rows. The "Resume document uploads" CTA in the portal points at an interface that does not yet exist in the codebase.

The walk-in path is staff-bottlenecked. Tenants who *can* upload their own documents — younger members, family helpers, anyone with a phone camera — currently have no path to do it. Every such tenant becomes an office visit Stanton has to absorb.

PRD-03 closes that gap. It adds a mobile-first tenant document upload surface to the existing magic-link portal, tied to the application's required document rows in `application_documents`. Tenants upload one file per row. No OCR, no classification UI, no page-splitting — those are staff tools (PRD-02).

---

## Goals

1. Tenant can open `/pbv-full-app/[token]` on a phone, see a list of required documents for their application, and upload one file per row.
2. Each upload lands as a new row (or new revision) in `application_documents` with `anchor_type='pbv_full_application'`, `uploaded_by_role='tenant'`, full provenance.
3. Atomicity: a single upload that fails leaves no orphaned rows or partial state.
4. Trilingual (EN / ES / PT) — matching the existing portal's language toggle.
5. Mobile-first — 100% of expected traffic is phones. Touch targets ≥44px. Body text ≥16px.
6. Tenant can re-upload to replace a previous version. The replacement creates a new revision via the PRD-1.5 revision path; prior version is preserved.
7. Every upload writes a `document.uploaded_by_tenant` event via `writePbvApplicationEvent`. New event type added to `ApplicationEventType` in `lib/events/application-events.ts`.
8. Every code claim in the build report is backed by a grep command + raw output.

## Non-Goals

- **No OCR / no classifier.** Tenant selects which document row a file is for — system does not infer.
- **No page-level intake.** Each uploaded file maps to exactly one document row. Multi-page PDFs are stored as one file, one document row.
- **No multi-anchor generalization.** Endpoint accepts `anchor_type` but the route validates `anchor_type === 'pbv_full_application'`. Other values return 400.
- **No tenant deletion of documents.** Once uploaded, tenant cannot delete. They can replace (which creates a new revision). Staff can delete or waive via the existing admin surface.
- **No tenant editing of application data via this PRD.** This PRD ships only the document-upload surface. Application-form editing (the existing 1500-line form) stays as-is.
- **No tenant-facing custom document creation.** "Custom — not on template" is a staff-only concept (PRD-02). Tenants upload only into pre-seeded rows.
- **No upload of files for documents marked `status='approved'` or `status='waived'`.** Approved/waived rows are read-only on the tenant surface.
- **No signing capture.** Signing flows are owned by `post-approval-execution` and `in-app-signature-capture`.

---

## Users & Roles

| Role | What they do here |
|---|---|
| Tenant (authenticated via magic-link token) | Views their required document rows. Uploads one file per row. Replaces (creates new revision) if needed. Sees status: missing / submitted / approved / waived. |
| Staff (downstream) | Sees tenant-uploaded documents in the review surface unchanged. PRD-03 does not change staff UX. |

No new permission introduced. Tenant access is gated by the existing magic-link token mechanism (`app/api/admin/pbv/full-applications/[id]/token/route.ts`).

---

## Closed Decisions

1. **Scope:** Per-document file upload. One file → one document row. No page-splitting, no OCR, no classifier UI on the tenant side.
2. **Anchor:** `pbv_full_application` only at the route boundary. Other values → 400.
3. **Event substrate:** All event writes via `writePbvApplicationEvent`. Never call `writeApplicationEvent` directly. Never insert into `application_events` outside `lib/events/application-events.ts`.
4. **New event type:** `DOCUMENT_UPLOADED_BY_TENANT: 'document.uploaded_by_tenant'`. Added to `ApplicationEventType` in `lib/events/application-events.ts`. Payload mirrors `DOCUMENT_UPLOADED_BY_STAFF` minus staff-specific fields.
5. **Revision behavior:** Re-upload to a row that already has a submitted file creates a new revision via the PRD-1.5 revision write path. Tenant never sees revision numbers — UI just says "Replace file."
6. **Upload primitive:** Each upload is a single HTTP request: `POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload`. Multipart. One file. No batch primitive — atomicity is per-row.
7. **File constraints:** Max 25 MB per file. Accepted types: PDF, JPG, PNG, HEIC. HEIC converts to JPG server-side via `sharp` (same pattern as existing scan-upload).
8. **Authentication:** Magic-link token in URL. Token resolution reuses the existing PBV token guard at `app/api/admin/pbv/full-applications/[id]/token/route.ts`. No session cookie.
9. **Storage:** Final committed files write to bucket `form-submissions`, path `{application_id}/{doc_type}/{document_id}.{ext}` (confirmed from PRD-02 storage audit). No staging bucket — tenant uploads commit atomically per-row, no classification window.
10. **Evidence standard:** Every code-claim in the build report is backed by a grep command + raw output.
11. **Legacy `/t/[token]` portal not modified.** `SubmissionStatusPortal` and `/api/t/[token]/documents/[documentId]` continue serving non-PBV workflows. New PBV-only routes under `/api/pbv-full-app/[token]/...`. `TokenRouter` adds a redirect for PBV tokens.

---

## Open Questions — Answered (2026-05-14 cross-PRD audit)

All four open questions were resolved during the PRD-02 build session via grep audit. Answers below; Windsurf does **not** need to re-investigate.

1. **`uploaded_by_role` accepts `'tenant'`.**
   - Evidence: `supabase/migrations/20260514120000_application_documents.sql:91-92`
   - `CONSTRAINT ad_uploaded_by_role_check CHECK (uploaded_by_role IS NULL OR uploaded_by_role IN ('tenant', 'staff'))`
   - **No migration action needed for this column.** Phase 1 schema change is limited to `pbv_document_label_translations`.

2. **Token validation entry point: `app/api/t/[token]/pbv-full-app/route.ts:26-31`.**
   - Resolves token via `pbv_full_applications.tenant_access_token`. Reuse this lookup pattern; do not re-implement.
   - Also referenced in admin token route at `app/api/admin/pbv/full-applications/[id]/token/route.ts:69-73`.

3. **Revision write path is inlined per-route. No centralized helper exists.**
   - Pattern to mirror: `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158`.
   - Insert directly into `application_document_revisions` from the tenant upload route. Do **not** refactor to a shared helper — that's a separate PRD.

4. **Legacy `/t/[token]` portal is live and writes to `form_submission_documents`.**
   - The CTA at `app/pbv-full-app/[token]/page.tsx:610-614` links to `/t/${formSubmissionToken}`.
   - `TokenRouter` branches based on token type and renders `SubmissionStatusPortal` for non-PBV workflows.
   - Legacy tenant upload endpoint `app/api/t/[token]/documents/[documentId]/route.ts` writes to `form_submission_documents`.
   - **Scope decision (Option B with redirect):** New PBV upload routes under `/api/pbv-full-app/[token]/...`. `SubmissionStatusPortal` is **not modified**. The `docs_portal_btn` link (line 610-614) is updated to the new path. `TokenRouter` adds a PBV-token redirect to the new path so existing SMS links keep working. Old `/api/t/[token]/documents/[documentId]` route stays for non-PBV; implicit-deprecated for PBV. Cleanup of dead PBV paths is a separate follow-up PRD.

---

## Core Features

### 1. Tenant document-upload surface

New route component or section under `/pbv-full-app/[token]` showing:

- **Document list** — one row per `application_documents` row where `anchor_type='pbv_full_application'`, `anchor_id=<resolved from token>`, and `status IN ('missing', 'submitted', 'rejected')`. Sorted by `display_order`.
- **Per-row state:**
  - `missing` → "Upload" button + supported file types hint.
  - `submitted` → "Replace file" button + thumbnail/filename + "Pending review" badge.
  - `rejected` → "Re-upload" button + rejection reason text + supported types hint. Visual emphasis (e.g., amber border).
- **Read-only rows** (`approved`, `waived`) — shown in a collapsed "Already complete" group below the active list. No upload button. Status badge only.
- **Progress indicator** — "X of Y required documents uploaded." Counts `submitted + approved + waived` against `required=true` rows.
- **Language toggle** — same component already in the portal. Persists selection.

### 2. Upload endpoint

`POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload`

**Auth:** Validates magic-link token. Validates that `doc_row_id` belongs to the application anchored to that token. 404 otherwise. 403 if token expired.

**Request:** Multipart with one `file` field. Optional `file_name` override.

**Validation, in order:**
1. File present? If not, 400.
2. MIME / extension allowed (PDF, JPG, PNG, HEIC)? If not, 415.
3. File size ≤ 25 MB? If not, 413.
4. `doc_row_id` exists, belongs to this application, `status NOT IN ('approved', 'waived')`? If not, 409 with clear message.
5. Application not packet-locked (`packet_locked = false` on `pbv_full_applications`)? If locked, 409 with message ("Packet already submitted to HACH").

**Action sequence (single DB transaction):**
1. Write `packet_intake_started` event with `packet_id=<generated>`, `actor_role='tenant'`, `actor_anonymous=true` payload. (Reuses existing event type from PRD-02.)
2. If HEIC, convert to JPG via `sharp`. Otherwise pass through.
3. Compute `content_sha256`.
4. Look up existing row(s) for `(anchor_type, anchor_id, doc_type, person_slot)`:
   - If current row has no committed file (`status='missing'`): write new `application_documents` row contents in place (or update existing row with file fields — match existing staff upload behavior, confirm in Phase 1).
   - If current row already has a file (`status='submitted'` or `'rejected'`): call the PRD-1.5 revision write path to append a new revision. The parent row's `status` resets to `'submitted'` and `current_revision` updates.
5. Upload file to bucket `form-submissions` at path `{application_id}/{doc_type}/{document_id}.{ext}` (single-page; tenant uploads are always single-file per row).
6. Write `document.uploaded_by_tenant` event with payload `{ doc_type, label, file_name, revision }`.
7. Write `packet_intake_committed` event with `packet_id` and the single-row result.

**Response (200):**
```
{
  document_id: string,
  revision: number,
  status: 'submitted',
  file_name: string
}
```

**Failure path:** Any step fails → tx rolls back → `packet_intake_abandoned` written with `packet_id` and error class outside the tx → HTTP 5xx or 4xx with descriptive message.

### 3. Replace flow

UI "Replace file" button on `status='submitted'` or `status='rejected'` rows. Hits the same upload endpoint. Backend detects the existing row and routes to the revision path automatically. Tenant does not see revision numbers.

### 4. Read endpoint

`GET /api/pbv-full-app/[token]/documents` returns the list of `application_documents` rows the tenant should see, with the same state model the UI consumes. Used by the portal on load and after every upload to refresh state.

**Response:**
```
{
  application_id: string,
  required_count: number,
  uploaded_count: number,
  documents: [
    {
      id: string,
      doc_type: string,
      label: string,                    // translated to current language
      person_slot: string | null,
      person_slot_label: string | null, // e.g., "John Smith (head of household)"
      status: 'missing' | 'submitted' | 'approved' | 'rejected' | 'waived',
      required: boolean,
      current_file_name: string | null,
      rejection_reason: string | null,
      display_order: number
    }
  ]
}
```

### 5. Label translation

Document labels in `application_documents` are stored in English (per existing data). The read endpoint returns translated labels using a lookup table keyed by `doc_type` and language. Translation table seeded for all PBV doc types. Translation is read-only; staff sees English in admin.

### 6. Atomicity guarantee

Each upload is its own transaction. There is no multi-file batch primitive on the tenant side — atomicity is per row. If a tenant uploads 10 files and the 6th fails, the first 5 are committed, the 6th rolls back, the remaining 4 are not attempted. The UI surfaces the failure clearly so the tenant knows which file to retry.

---

## Data Model

### No new tables.

### Modified table: `application_documents`

- **No schema change.** `uploaded_by_role` already accepts `'tenant'` per `supabase/migrations/20260514120000_application_documents.sql:91-92`. Phase 1 does not touch this column.

### New event type

In `lib/events/application-events.ts`:
```
DOCUMENT_UPLOADED_BY_TENANT: 'document.uploaded_by_tenant',
```

With payload type:
```
'document.uploaded_by_tenant': {
  doc_type: string;
  label: string;
  file_name: string;
  revision: number;
};
```

### New table: `pbv_document_label_translations`

| Column | Type | Notes |
|---|---|---|
| `doc_type` | text | NOT NULL |
| `language` | text | NOT NULL. CHECK in (`'en'`, `'es'`, `'pt'`) |
| `label` | text | NOT NULL |

Primary key: `(doc_type, language)`. Seeded for all PBV doc types in EN/ES/PT.

---

## Integration Points

- `lib/events/application-events.ts`: adds `DOCUMENT_UPLOADED_BY_TENANT`. Existing `PACKET_INTAKE_*` reused for the wrapper events. `writePbvApplicationEvent` handles all writes.
- PRD-1.5 revision write path: **inlined** (no centralized helper). Mirror the pattern at `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158` — insert directly into `application_document_revisions` from the tenant upload route.
- PRD-01 `application_documents` write path: tenant upload to a `missing` row updates the existing row in place (matches the staff upload pattern). No new-row creation in the tenant flow.
- Token resolution: `app/api/t/[token]/pbv-full-app/route.ts:26-31` — reuse the lookup against `pbv_full_applications.tenant_access_token`.
- Storage: bucket `form-submissions`, path `{application_id}/{doc_type}/{document_id}.{ext}` for committed files. Revisions use `{application_id}/{doc_type}/{document_id}-r{revision}.{ext}`.
- **TokenRouter redirect:** add a branch that detects PBV tokens and redirects from `/t/[token]` to `/pbv-full-app/[token]` (or wherever the new tenant doc-upload UI lives). Existing SMS links keep working.
- **Untouched:** `SubmissionStatusPortal` component, `app/api/t/[token]/documents/[documentId]/route.ts`. These serve non-PBV workflows.
- Schema-contract test (`lib/__tests__/schema-contract.test.ts`): extended for the new translation table and the new event type.
- Save-path integration test (`lib/__tests__/save-path-integration.test.ts`): extended to cover the tenant upload happy path, replace path, locked-packet path, expired-token path, and the abandoned/failure path.

---

## Implementation Phases

Five phases. Each is its own merge gate.

### Phase 1 — Schema + event type

**Build:**
- Migration `supabase/migrations/<ts>_tenant_packet_upload.sql`:
  - Create `pbv_document_label_translations` table.
  - Seed translations for all PBV `doc_type` values (read from `form_document_templates WHERE form_id='pbv-full-application'`).
  - **Note:** `uploaded_by_role` already accepts `'tenant'` per `20260514120000_application_documents.sql:91-92`. Do not modify the CHECK.
- Add `DOCUMENT_UPLOADED_BY_TENANT` to `ApplicationEventType` in `lib/events/application-events.ts`. Add payload type. No new wrapper — uses existing `writePbvApplicationEvent`.

**Done when:**
- Migration applies clean. `\d application_documents` posted. `\d pbv_document_label_translations` posted with row count by language.
- `grep -n "DOCUMENT_UPLOADED_BY_TENANT" lib/events/application-events.ts` returns the definition. Raw output in build report.
- `grep -rn "DOCUMENT_UPLOADED_BY_TENANT" lib app` returns the definition + zero call sites (call sites land in Phase 3).
- Schema-contract test extended; passes.

### Phase 2 — Read endpoint + TokenRouter redirect

**Build:**
- `GET /api/pbv-full-app/[token]/documents/route.ts`:
  - Resolve token via the `pbv_full_applications.tenant_access_token` lookup pattern at `app/api/t/[token]/pbv-full-app/route.ts:26-31`.
  - Reads `application_documents` rows with the anchor pair, filters by `status` and `required`, joins to `pbv_document_label_translations` for the requested language.
  - Returns the shape documented in Core Features §4.
- Add a redirect branch in `components/TokenRouter.tsx`: when a token resolves to a PBV application, redirect to the new PBV tenant doc-upload UI path. Non-PBV branches unchanged. Existing SMS links pointing at `/t/[token]` keep working transparently.
- Update `app/pbv-full-app/[token]/page.tsx` line 610-614: the `docs_portal_btn` CTA href changes from `/t/${formSubmissionToken}` to the new PBV-namespaced path.

**Done when:**
- Endpoint returns 200 + correct shape for a valid token. Raw curl output in build report.
- Returns 404 for unknown token, 403 for expired token, 400 for missing language param.
- `grep -rn "pbv_document_label_translations" app/api/pbv-full-app` returns exactly one file (the new route).

### Phase 3 — Upload endpoint (single tx, no replace yet)

**Build:**
- `POST /api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts`:
  - Validates token, file, size, MIME, doc_row ownership, application not locked.
  - Single tx: write file content into target `application_documents` row (in-place for `status='missing'` rows only — Phase 4 adds the revision path for re-upload).
  - Storage upload to `form-submissions` bucket at `{application_id}/{doc_type}/{document_id}.{ext}` inside the tx try/catch; failure rolls back tx. **Mirror the storage-path contract from PRD-02's fixed commit route — `storage_path` written to the DB row must exactly match where the file lands.**
  - Emits `packet_intake_started`, `document.uploaded_by_tenant`, `packet_intake_committed` events via `writePbvApplicationEvent`. On failure, `packet_intake_abandoned` outside tx.
- HEIC handling: convert to JPG via `sharp` before storage write. Reuse `lib/scan/splitPdf.ts` patterns or whatever helper PRD-02 settled on; do not re-implement HEIC conversion.

**Done when:**
- Happy path: tenant uploads a PDF to a `missing` row → row goes to `status='submitted'`, file stored, three events written. Raw curl + SQL output in build report.
- Locked-packet: upload to an application with `packet_locked=true` returns 409. Raw evidence.
- Oversize: 26MB file returns 413. Raw evidence.
- Wrong MIME: `.exe` returns 415. Raw evidence.
- Wrong doc_row: 404. Raw evidence.
- `grep -rn "writePbvApplicationEvent" app/api/pbv-full-app` returns exactly three call sites in the upload route (started, uploaded_by_tenant, committed) plus one in the abandoned-error branch. Raw output.
- `grep -rn "writeApplicationEvent\b" app/api/pbv-full-app` returns zero hits.
- `grep -rn "INSERT INTO application_events" app/api/pbv-full-app` returns zero hits.

### Phase 4 — Replace path (revision)

**Build:**
- Upload endpoint extended: when target row's `status IN ('submitted', 'rejected')`, **inline the revision insert** following the pattern at `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/upload/route.ts:143-158`. Do not refactor to a shared helper.
- Storage path: `{application_id}/{doc_type}/{document_id}-r{revision}.{ext}` in the `form-submissions` bucket.
- Parent row's `status` resets to `'submitted'`, `rejection_reason` clears (if present), `current_revision` increments.
- `application_document_revisions` insert includes: `application_document_id`, `revision`, `file_name`, `storage_path`, `uploaded_by='tenant:anonymous'` (or similar — match the inlined pattern; tenant has no user ID), `uploaded_at`, with review fields null.

**Done when:**
- Replace happy path: upload to a `submitted` row → new revision appended in `application_document_revisions`, parent `current_revision` increments, parent `status` stays/returns to `'submitted'`. Raw SQL output.
- Replace to a `rejected` row clears `rejection_reason`. Raw evidence.
- Old revision file remains in storage (no delete). Confirm via storage `ls`.
- `grep -rn "application_document_revisions" app/api/pbv-full-app` returns the new revision-path call site only.

### Phase 5 — UI + verification

**Build:**
- New section/component in `/pbv-full-app/[token]/page.tsx` or sib