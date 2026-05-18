# Build Report — PRD-35: Staff Document Viewer Multi-Bucket Resolution

**Date:** 2026-05-16  
**Branch:** `fix/admin-document-viewer-multibucket-35`  
**Status:** Complete

---

## Decision: F5 (explicit `storage_bucket` column) — NOT NEEDED

All `application_documents` rows are written to the `form-submissions` bucket, verified by sweeping every upload route:

| Route | Bucket written |
|---|---|
| `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` | `form-submissions` |
| `app/api/admin/applications/.../documents/upload/route.ts` | `form-submissions` |
| `app/api/admin/intake/.../commit/[batch_id]/route.ts` | `form-submissions` |
| `app/api/admin/submissions/[submissionId]/documents/upload/route.ts` | `form-submissions` |

The implicit mapping is reliable and consistent. No schema migration needed. `resolveBucket` defaults to `form-submissions` for all doc_types and accepts an optional `storage_bucket` column value as an escape hatch for the future.

---

## Pre-existing defect fixed by this PRD (not a routine refactor)

**"Stanton staff cannot view documents from the review surface" — silent 404, duration unknown.**

`DocumentViewer` (Stanton context) was calling:
```
/api/admin/submissions/${doc.id}/documents/${doc.id}/signed-url
```
This route **never existed**. Every "View" click from the PBV full-application review panel returned a 404, silently failing with "Failed to load document". Staff have been unable to view any documents from the review surface for the entire lifetime of this feature. PRD-35 creates the missing endpoint and wires it correctly.

---

## Files created

| File | Purpose |
|---|---|
| `lib/storage/resolveBucket.ts` | Bucket-aware resolver function |
| `lib/storage/__tests__/resolveBucket.test.ts` | Unit tests — 30 cases |
| `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/signed-url/route.ts` | **New.** Previously missing. Stanton staff signed-URL endpoint. Mirrors HACH pattern. |

## Files modified

| File | Change |
|---|---|
| `components/review/DocumentViewer.tsx` | Fixed `apiUrl` for Stanton context. Added `anchorType` / `anchorId` props. |
| `components/review/StantonReviewSurface.tsx` | Passes `anchorType` / `anchorId` to `DocumentViewer`. |
| `app/api/t/[token]/pbv-full-app/documents/route.ts` | Replaced `.from('submissions')` with `.from(resolveBucket(d))` for signed-URL generation. |
| `app/api/admin/file/route.ts` | Accepts optional `id` param (doc lookup + `resolveBucket`). Path-only calls fall back to `submissions` for legacy forms. |

---

## Sweep — `.from('submissions')` in `app/`

Grepped all files. All remaining hits are one of:
- **Writes** to the `submissions` *storage bucket* for legacy onboarding forms (`api/submit`, `api/update-insurance`, `api/reimbursement`) — correct, not changed.
- **Queries** to the `submissions` *database table* — unrelated to storage, not changed.
- **Reads** from `submissions` storage for legacy lobby documents (`api/admin/extract-forms`, `api/admin/compliance/delete-document`) — these files genuinely live in `submissions`, not changed.

Zero `application_documents` read paths remain hardcoded to `submissions`.

---

## Test matrix

| Scenario | Bucket | Expected | Notes |
|---|---|---|---|
| Staff clicks View on a PBV doc uploaded via packet intake | `form-submissions` | Opens | F2 fix |
| Staff clicks View on a PBV doc uploaded via staff upload dialog | `form-submissions` | Opens | F2 fix |
| Staff clicks View on a PBV doc uploaded by tenant | `form-submissions` | Opens | F2 fix |
| Tenant clicks View on their uploaded doc | `form-submissions` | Opens | F3 fix |
| `/api/admin/file?path=...` (legacy lobby path) | `submissions` | Opens | Unchanged behaviour |
| `/api/admin/file?id=<doc_id>` (new) | `form-submissions` | Opens | F4 |
| `resolveBucket({ doc_type: 'pay_stub' })` | — | `form-submissions` | Unit test |
| `resolveBucket({ doc_type: 'x', storage_bucket: 'submissions' })` | — | `submissions` | Unit test (explicit override) |

---

## Runtime verification 2026-05-17

| Test | Status | Notes |
|---|---|---|
| PDF tenant upload — opens correctly | [ ] Pending | Requires manual verification via browser |
| Image tenant upload — opens correctly | [ ] Pending | Requires manual verification via browser |
| Staff upload — opens correctly | [ ] Pending | Requires manual verification via browser |
| Generated form — opens correctly | [ ] Pending | Requires manual verification via browser |

**Verification steps:**
1. Log into Stanton admin
2. Navigate to PBV Full Applications → select an application with documents
3. In StantonReviewSurface document list, click "View" on each document type
4. Confirm each opens in new tab or inline preview

**Defects found:**
- None yet — awaiting manual verification

---

## Out of scope — separate tickets

**HACH signed-URL endpoint** (`app/api/hach/documents/[id]/signed-url/route.ts`):  
Currently hardcodes `pbv-applications` bucket. This may be correct — the HACH packet PDFs (stamped overlays) likely live in `pbv-applications`, separate from raw tenant uploads in `form-submissions`. Or it may be a silent bug where HACH portal cannot view tenant-uploaded source documents. Needs separate investigation before touching. Do not expand PRD-35 to cover it.

**`form_submissions` table** (April audit Issue #4):  
`form_submissions` records (standalone form submissions — pet exemption, billing dispute, etc.) do not surface in the compliance matrix. Out of scope per PRD-35. Separate ticket.

**`components/portal/FileUploadTask.tsx`** writes to `project-evidence` bucket using public URLs:  
Not `application_documents`. Out of scope per PRD. Public URL access is intentional per current design.
