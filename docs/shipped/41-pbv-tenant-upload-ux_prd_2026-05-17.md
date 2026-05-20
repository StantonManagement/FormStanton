# PRD-41 — Tenant Upload UX

**Date:** 2026-05-17
**Author:** Claude (post-PRD-39 backlog capture)
**Branch:** `feat/pbv-tenant-upload-ux-41`
**Status:** Draft — not for immediate build. Capture now, ship after PRD-40 polish lands and #12/#13 server-side 500s are fixed.
**Depends on:** PRD-39 (uploads working end-to-end), PRD-40 (polish defects resolved)

---

## Problem Statement

After PRD-39 shipped the tenant-side "Upload file" path, the upload UX is functional but still high-friction. Three patterns hurt the most:

1. **The same document satisfies multiple required slots, but the tenant has to upload it once per slot.** A single bank statement PDF might be needed for both savings and checking. A single paystub PDF with four weeks bundled satisfies the entire paystub requirement. Today the tenant clicks Upload, picks the file, waits, clicks Upload on the next row, picks the same file again. For a 22-required-doc application, this is dozens of redundant interactions.

2. **The documents page is a wall of 31 rows.** No grouping by what the tenant actually has on hand, no bulk action, no drag-drop. Mobile tenants tap through one row at a time.

3. **The tenant doesn't know what some of these documents are.** Labels like "HUD-9886-A Authorization for Release of Information" are opaque. There's no inline explanation of what it is, where to get it, or what it looks like.

This PRD addresses the three patterns with a focused set of changes. It does NOT attempt the big-ticket transformative work (auto-classify, pre-app carry-forward, live AMI feedback) — those go in their own future PRDs.

---

## Users & Roles

- **Tenants completing their PBV application** — primary beneficiary. Should be able to upload faster, with less confusion, and not have to repeat work.
- **Stanton staff** — secondary. When tenants finish faster and with less staff intervention, staff queue stays cleaner.
- **No admin-facing UI changes in this PRD.**

---

## Closed decisions

- **Scope is the four features below. Hard cap.** Resist additions during build.
- **No new data-model migrations** beyond a `file_hash` column on `application_documents`. Everything else is read-side or UI.
- **No OCR.** Auto-classification is a separate PRD when it's the right time.
- **No pre-app carry-forward** in this PRD. Separate effort.
- **No mobile-specific re-layout** in this PRD. The existing responsive design handles the new components.
- **Hash-based dedup is opt-in via UI prompt**, not silent auto-apply. Tenants confirm "yes, use this file for those other slots too."

---

## Decisions resolved (Alex confirmed 2026-05-17)

- **Same-file detection key:** SHA-256 content hash of uploaded file. Exact match only. Don't try fuzzy / OCR / image-similarity in this PRD.
- **Dedup UX:** After a successful upload, if the hash matches an already-uploaded file on the same application, show a toast/modal: "This is the same file as <other doc label>. Apply to other similar slots too?" with a checkbox list of compatible slots. Tenant confirms; system creates additional `application_documents` rows pointing to the same `storage_path` (or copies bytes — implementation detail).
- **Compatible slot logic:** Two slots are "compatible" if they have the same `category` (e.g., Income Verification) and the same `person_slot`. Don't suggest applying a paystub to the Citizenship Declaration slot.
- **Drag-drop:** A single drop zone at the top of `/documents`. Multiple files dropped at once → each file gets a row in a "pending assignment" panel where tenant assigns it to a slot via dropdown (filtered by category if hash matches existing). Confirm-all button uploads all of them.
- **Per-doc help:** Collapsible "What is this?" expander on each doc row. Body text is per-doc-type, en/es/pt. Sourced from a new `doc_type_help` content file (markdown or JSON) — not a DB column, to keep edits easy.
- **Progress bar:** Visual progress bar on `/dashboard` task card for documents. Shows "12 of 22 required uploaded" with a filled bar. Optional badge for "+3 optional uploaded too."

---

## Core Features

### F1 — Hash-based dedup and apply-to-similar

**Files:**
- New: `lib/pbv/computeFileHash.ts` — client-side SHA-256 of File blob (Web Crypto API)
- Modify: `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` — compute and persist hash on upload
- New migration: `ALTER TABLE application_documents ADD COLUMN file_hash TEXT NULL` + index
- New: `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts` — GET endpoint that returns sibling slots with the same hash on the same application
- New: `components/pbv/DedupApplyDialog.tsx` — post-upload modal listing compatible slots with checkboxes
- New: `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts` — POST endpoint that creates additional `application_documents` rows for the selected slots, pointing at the same storage path

**Flow:**
1. Tenant uploads File A to Slot X. Upload route computes SHA-256, stores `file_hash` on the row.
2. Client receives success response.
3. Client calls `GET /documents/by-hash?hash=<hash>&exclude_doc_id=<X>` to find other slots that could accept this file (same category, same person_slot, currently MISSING).
4. If matches exist, render DedupApplyDialog with checkboxes pre-checked for all matches.
5. Tenant confirms (or unchecks some). Client calls POST `/bulk-apply` with the file hash + selected slot IDs.
6. Server creates new `application_documents` rows for selected slots, all referencing the same `storage_path`.

**Edge cases:**
- If hash already exists across applications (not just this one), do NOT suggest cross-application matches. Privacy.
- If a tenant uploads File A then File A again to a different slot, the second upload is also detected as dedup. Same flow.
- File replaces: hash recomputed on each upload. Old hash detached from row.

**Acceptance:** Upload `paystub-week1.pdf` (from `tests/fixtures/`) to "Paystubs" slot. Then upload the same file via tenant or admin to "Insurance Settlement" slot — should NOT suggest (different category). Now upload to a different doc within Income Verification category (none in current schema, but if there were) — would suggest. Better acceptance test: use `tests/fixtures/paystub-week1.pdf` + `paystub-week1-COPY.pdf` (same hash, different filenames) — second upload detects dedup with the first.

### F2 — Drag-drop multi-file upload zone

**Files:**
- Modify: `app/pbv-full-app/[token]/documents/page.tsx` — add drop zone at top of page
- New: `components/pbv/MultiFileDropZone.tsx` — drag-drop receiver, pending-files panel, slot assignment dropdowns

**UI:**
- Top of documents page: a dashed-border drop area with copy "Drop files here or click to select multiple"
- On drop / select: each file appears as a row in a pending panel below the drop zone
- Each pending row: filename, thumbnail (if image) or PDF icon, file size, MIME type, dropdown to assign to a slot, remove button
- Dropdown options: all currently MISSING slots, grouped by category. If a slot is already pending assignment from another pending row, mark it disabled in the dropdown.
- Bottom of pending panel: "Upload all (N)" button — fires N upload requests in parallel (with reasonable concurrency cap).

**After upload:**
- Each successful upload triggers F1's dedup flow individually.
- If multiple drop-zone uploads have the same hash, ONE post-upload dedup dialog is shown that batches the suggestion.

**Mobile behavior:**
- Drop zone still works as "click to select files" (mobile file picker). Multi-select via OS file picker.
- Pending panel scrolls on small screens.

**Acceptance:** Drop `paystub-week1.pdf`, `bank-statement-checking.pdf`, `ssi-award-letter.pdf` at once. All three appear in pending panel with auto-suggested slots (Paystubs, Checking Bank Statement, SSI Award Letter — name-matching heuristic; if no match, user picks manually). Click "Upload all (3)" → three docs land, status flips to Uploaded/Submitted, dedup dialog appears if any hash matches existing.

### F3 — Per-doc plain-language help

**Files:**
- New: `lib/pbv/docTypeHelp.ts` — exports a Record<doc_type, { en: string; es: string; pt: string }> with one paragraph per doc type explaining what it is, where to get it, what it usually looks like
- Modify: `components/pbv/TenantDocumentUpload.tsx` — add collapsible "What is this?" expander next to doc title

**Help content examples (en):**
- `paystubs`: "Your most recent pay statements showing earnings, deductions, and YTD totals. Ask your employer for the last 4 weekly stubs or 2 bi-weekly stubs. Most employers can email these or print from your employee portal."
- `hach_release`: "A signed authorization letting HACH verify your income and household information directly with banks, employers, and government agencies. We'll provide the form for you to sign electronically."
- `ssi_award_letter`: "The letter from Social Security stating your monthly SSI benefit amount. Usually mailed each year in November. You can also download from ssa.gov/myaccount."

**UI:**
- Default state: collapsed, shows a small "?" icon next to the doc title.
- Click expands a 2-3 sentence explanation below the title, before the upload buttons.
- Translations from existing i18n hook.

**Acceptance:** Each of the 31 doc types in the seed templates has help text in en/es/pt. No empty fallbacks; if a doc type is added later without help, content team gets a clear warning.

### F4 — Visual progress bar on dashboard

**Files:**
- Modify: `components/pbv/sign/TenantDashboard.tsx` — replace plain text "0 of 22 uploaded" with a visual progress bar.

**UI:**
- Filled bar from 0% to 100% based on required docs uploaded.
- Numeric label "12 of 22 required documents uploaded" above or to the right of the bar.
- Optional secondary text below: "+3 optional uploaded" if any optional docs are uploaded.
- Color: green when 100%, amber when 50-99%, neutral when <50%.

**Acceptance:** With 0 docs uploaded, bar is empty. With 11/22 uploaded, bar is half-filled and amber. With 22/22 (regardless of optional state), bar is full and green.

---

## Data Model

One migration:
```sql
ALTER TABLE application_documents
  ADD COLUMN file_hash TEXT NULL;

CREATE INDEX idx_application_documents_file_hash
  ON application_documents (anchor_id, file_hash)
  WHERE file_hash IS NOT NULL;
```

No other schema changes.

---

## Integration Points

- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` — F1 hash computation on upload
- `app/api/t/[token]/pbv-full-app/documents/by-hash/route.ts` — F1 new endpoint
- `app/api/t/[token]/pbv-full-app/documents/bulk-apply/route.ts` — F1 new endpoint
- `app/pbv-full-app/[token]/documents/page.tsx` — F2 drop zone integration
- `components/pbv/TenantDocumentUpload.tsx` — F3 help expander
- `components/pbv/sign/TenantDashboard.tsx` — F4 progress bar
- `lib/pbv/computeFileHash.ts` — F1 client-side hash util
- `lib/pbv/docTypeHelp.ts` — F3 help text content
- `components/pbv/DedupApplyDialog.tsx` — F1 post-upload dedup modal
- `components/pbv/MultiFileDropZone.tsx` — F2 drop zone component
- Migration: `supabase/migrations/<date>_pbv_application_documents_file_hash.sql` — F1 schema

---

## Implementation Phases

**Phase 1 — Data primitive (target: half day)**
- F1 schema migration
- F1 hash computation on upload + persistence
- F1 by-hash endpoint
- Unit tests for hash collisions, replace flow

**Phase 2 — Dedup UX (target: 1 day)**
- F1 DedupApplyDialog component
- F1 bulk-apply endpoint
- Manual test using `tests/fixtures/paystub-week1.pdf` and `paystub-week1-COPY.pdf` (same hash)

**Phase 3 — Drag-drop (target: 1 day)**
- F2 MultiFileDropZone component
- F2 pending-panel UI with slot assignment
- F2 parallel upload orchestration
- Manual test with `tests/fixtures/{paystub-week1,bank-statement-checking,ssi-award-letter}.pdf` dropped at once

**Phase 4 — Help content + progress bar (target: half day)**
- F3 docTypeHelp.ts with all 31 doc types in en/es/pt
- F3 expander UI
- F4 progress bar component swap

**Phase 5 — End-to-end re-verification (target: half day)**
- Walk the tenant flow with multiple files via drop zone
- Confirm dedup suggestion fires for same-hash uploads
- Confirm progress bar reflects upload state
- Confirm help expander works in all three languages
- Update audit doc

---

## Acceptance — what "done" looks like

- A tenant on `/documents` can drag-drop multiple files at once and assign each to a slot via a single confirm.
- After uploading a file that matches another slot's content (by hash), the tenant sees a dialog suggesting "apply to these other slots too" with a checkbox list.
- The 31 doc types each have plain-language help available in en/es/pt via a collapsible expander.
- The dashboard shows a visual progress bar for required documents, with color reflecting completion state.
- `tests/fixtures/paystub-week1.pdf` and `paystub-week1-COPY.pdf` (same SHA-256 hash) trigger dedup detection.
- `tests/fixtures/paystub-week1.pdf` and `paystub-week2.pdf` (different hashes despite similar content) do NOT trigger dedup — fuzzy matching is explicitly out of scope.

---

## Test fixtures available

Generated at `tests/fixtures/` for this PRD's verification:

| File | Purpose |
|---|---|
| `paystub-week1.pdf` | Base paystub |
| `paystub-week1-COPY.pdf` | Exact byte copy of week1 — different filename, **same SHA-256** (tests F1 dedup detection) |
| `income-verification.pdf` | Another exact byte copy of week1 — tests three-way dedup |
| `paystub-week2.pdf` | Same template, different content — different hash (tests negative case) |
| `paystub-4weeks.pdf` | Multi-page paystub PDF (4 pages) — tests "single file covers multiple weeks" semantics |
| `bank-statement-checking.pdf` | Bank statement, checking account |
| `bank-statement-savings.pdf` | Bank statement, savings account |
| `ssi-award-letter.pdf` | SSI award letter |
| `tanf-award-letter.pdf` | TANF award letter |
| `id-drivers-license.jpg` | Image (JPEG) |
| `id-passport.png` | Image (PNG) |
| `signed-citizenship-declaration.pdf` | Signed-form replacement |
| `oversized-30mb.pdf` | 30MB file — tests size-limit rejection (existing 25MB cap) |
| `oversized-1mb.pdf` | 1MB file — small enough to accept, larger than typical |
| `unsupported-document.txt` | Plain text — tests MIME type rejection |
| `empty.pdf` | Minimal valid PDF — edge case |

---

## Out of scope — explicitly deferred to future PRDs

- **OCR auto-classify** — tenant uploads loose files, system reads + auto-assigns to slots. Big lift, big payoff, separate PRD.
- **Pre-app carry-forward** — anything captured in pre-app pre-fills full app. Separate PRD.
- **Live income vs AMI feedback during intake** — show running qualification estimate. Separate PRD.
- **Cross-application document reuse** — if tenant reapplies later, prior uploads carry forward. Legal retention questions, separate effort.
- **Per-doc deep-link help (videos, screenshots)** — F3 is text-only. Richer help media is a follow-up.
- **Auto-OCR documented_income prefill for staff** — staff-facing, separate effort.
- **Drag-drop dedup pre-suggestion** — when files drop in, suggest slots based on hash match BEFORE assignment. F2 only suggests slots based on name heuristic. Hash-based suggestion in drop zone is a follow-up enhancement.

---

## Notes

- This PRD does NOT ship until PRD-40 polish lands AND Defects #12 (generate-forms 500) and #13 (tenant upload 500) are fixed. Ordering matters: if uploads are broken, dedup is moot.
- The fixtures listed above already exist in `tests/fixtures/` (generated 2026-05-17). No need to recreate them during build.
- Hash detection deliberately stops at exact-match. Fuzzy matching opens a usability rabbit hole (what threshold? what if a tenant scans a paystub twice and gets different bytes?) — defer.
- Dedup is opt-in (tenant confirms) rather than silent auto-apply. This avoids "I uploaded something to Slot A and it mysteriously also appeared in Slot B."
