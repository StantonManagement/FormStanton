# Handoff — PBV PRD Sequence (01 → 1.5 → 02)

**Date:** 2026-05-14
**Source session:** "PBV tool progress and UI issues" (local_34016f60)

---

## Where things stand

Three PRDs in flight on the PBV documents decoupling effort. Sequence is **01 → 1.5 → 02**. Currently blocked on a schema question that Windsurf must answer before PRD-1.5 implementation starts.

### PRD-01 — PBV Documents Decoupling
- **Status:** Windsurf reported Phases 3–4 complete. Audit pushed back. Not yet verified.
- **Files:**
  - `docs/pbv-01-documents-decoupling-prd_*.md`
  - Build report: `pbv-documents-decoupling_build-report_2026-05-14.md` (filename needs rename to convention)
- **Open items blocking declaration of done:**
  1. **Bulk-assign route unmigrated.** `StantonReviewSurface.tsx:273` still calls `/api/admin/submissions/documents/bulk-assign`. Needs new route at `/api/admin/applications/[anchor_type]/[anchor_id]/documents/bulk-assign` + client update.
  2. **Fallback footgun in `StantonReviewSurface.tsx`.** `anchorType && anchorId ? new_url : /api/admin/submissions/...` silently routes PBV writes to the old surface if anchor props missing. **Decision: Option A** — make props required, remove fallback entirely.
  3. **Token-route guard at `app/api/admin/pbv/full-applications/[id]/token/route.ts:41`** still queries `form_submission_documents`. Windsurf called it "intentional pre-intake guard." Needs evidence-based confirmation: does the tenant magic-link upload path still write to `form_submission_documents` or to `application_documents`? Windsurf to answer with code refs.
  4. **Phase 2 verification missing:** row count diff, idempotency, rollback, `application_events.document_id` resolution check.
  5. **Phase 5 verification (12 items)** not reported yet.
  6. **Filename rename:** `pbv-documents-decoupling_build-report_*.md` → `pbv-01-documents-decoupling-build-report_*.md`.

### PRD-1.5 — PBV Document Revisions Decoupling (insertional)
- **Status:** Drafted. Implementation blocked.
- **Files:**
  - `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md`
  - `docs/pbv-1.5-revisions-decoupling-prompt_2026-05-14.md`
- **Pre-build analysis Windsurf completed:**
  - Column inventory of `form_submission_document_revisions` — zero deviations.
  - `_migration_pbv_documents_map` exists, 34 rows in production.
  - Triggers/RLS/indexes inventoried.
  - **Critical finding:** No centralized revision-creation helper exists. Revision logic is inlined per-route in submission-keyed routes. **PBV application routes from PRD-01 are NOT creating revisions at all** — they update `application_documents` but never write to any revisions table. PRD-1.5 must ADD revision creation to PBV routes, not just retarget existing writes.
- **Blocking question — Windsurf must answer before coding:**

  > Does `form_submission_documents` allow multiple rows per `(form_submission_id, doc_type, person_slot)` with different `revision` values (**Model A**), or is `(form_submission_id, doc_type, person_slot)` unique without `revision` and history lives in the separate revisions table (**Model B**)?

  - **If Model A:** PRD-1.5 gets redrafted — no new table, PBV routes INSERT new `application_documents` rows on revision-incrementing ops, migration converts legacy revisions into additional rows. Also fix PRD-01's unique constraint if it currently mis-allows Model A.
  - **If Model B:** PRD-1.5 as drafted stands. Windsurf adds revision-table writes to PBV routes (insert new revision row on upload; update existing revision `status_at_review` on approve/reject/waive). `categorize/route.ts` does NOT need revision handling — it's a metadata change on the parent doc, same physical file, same revision number.

- **Sign-offs already given:** Section 6 Option A confirmed (required `anchorType`/`anchorId` props on `StantonReviewSurface`, no fallback).

### PRD-02 — Packet Intake
- **Status:** Queued. Not started.
- **Sequencing note:** Packet intake creates new docs (not revisions of existing ones), so technically not blocked by 1.5. But the review surface UI (PriorVersionsExpander) is incomplete for PBV until 1.5 lands. **Don't ship 02 before 1.5 is verified.**

---

## Immediate next action

Hand Windsurf this question:

> Query the source schema. Is `form_submission_documents` uniqueness `(form_submission_id, doc_type, person_slot)` alone, or does it include `revision`? Post the actual unique constraint definition. Don't start PRD-1.5 coding until I confirm Model A vs Model B based on your answer.

Once that answer lands, either confirm PRD-1.5 as drafted or redraft it.

---

## Memory state at end of session

- `feedback_prd_naming.md` updated to allow fractional notation for insertional PRDs (`1.5`).
- State memory reflects sequence: 01 → 1.5 → 02.
