# PRD-87 — PBV Pre-Send Document Review UI (operator approval gate before signing handoff)

**Date:** 2026-05-31
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-pre-send-review` (suggested)
**Status:** Draft — ready for build
**Severity:** P1. Without this, the operator cannot confirm an applicant's documents render correctly before the signing prompt goes out — exactly the failure mode that produced defective walk-test PDFs.
**Source:** Cowork session 2026-05-31. "Make sure we have a UI so I can review if the PDFs are going to come out right before I send them to Mia for signing."
**Scope guard:** New admin route under `app/admin/pbv/**` + a read-only render endpoint. Imports `lib/pbv/form-generation/stamper.ts` and the form-generation pipeline READ-ONLY. Adds one gate on the `pbv_preflight_checklist` send. No change to the signing ceremony or to document generation logic.
**Dependencies:** Renders correctly only once PRD-86 Phase A has corrected the field maps. Gates PRD-85 Phase 4 (the Mia/Santha backfill resend). Self-contained otherwise.

---

## Problem Statement

When an applicant finishes intake, the system generates their document package (11 forms for a single-member PBV household) and is meant to send the `pbv_preflight_checklist` SMS that links them into signing. There is currently **no operator surface that shows the rendered documents before that prompt goes out.** The operator cannot answer "are Mia's PDFs going to come out right?" without digging into storage by hand.

The operator needs a per-applicant review screen: see each generated document as it will actually render, see the automated validation status, and explicitly approve before the signing handoff sends. Approve gates the send; nothing reaches the applicant until a human has looked.

---

## What already exists (build on it)

| Asset | Where | Role |
|---|---|---|
| Render engine | `lib/pbv/form-generation/stamper.ts` (`stampForm`) | Renders each form with the applicant's data — the same path production uses. |
| Generated docs + metadata | `pbv_form_documents` (`unsigned_pdf_path`, `status`, `required_signer_member_ids`, `field_data_snapshot`) | The package to display per application. |
| Field-map validators | PRD-86 `lib/field-map-authoring/**` (geometric + OCR round-trip) | Per-document pass/flag status surfaced in the review UI. |
| Handoff send | `lib/notifications/send.ts` + `intake/complete/route.ts:96-98` | The `pbv_preflight_checklist` send this PRD gates. |
| Operator surface | PRD-85 Phase 3 pipeline-dashboard indicator | Where the "review documents" entry point lives. |

---

## Users & Roles

- **Stanton staff (Tess, Kristine, Dan, Alex)** — open an applicant, review the rendered package, see validation flags, approve & send (or send back for fixes). **Resolved: any authenticated Stanton staff may approve a pre-send review for now** — this gate is pre-HACH and Stanton-internal. Wire the check through a single named authorization seam (see decision #1 below) so it can later be tightened to a named permission (e.g. the `send_to_hach` permission Tess + Kristine hold) without touching call sites.
- **System** — blocks the `pbv_preflight_checklist` send until an approval exists; records who approved and when.
- **Tenant** — receives the signing prompt only after approval. Never sees this UI.
- HACH — no role (pre-submission).

---

## Core Features

### 1. Per-applicant review screen
From the pipeline dashboard "intake complete / handoff not sent" indicator (PRD-85), open a review screen for an application. Show the applicant, household size, language, and the full document list from `pbv_form_documents`.

### 2. Rendered document viewer
For each document, render the actual PDF the applicant will sign — the `unsigned_pdf_path` already in storage, or re-rendered on demand via `stampForm` with the stored `field_data_snapshot` so the preview is the production artifact, not an approximation. Inline PDF viewer with per-form navigation; the operator can flip through all 11 without downloading.

### 3. Validation status per document
Surface the PRD-86 validator result per form: pass, or a list of flagged fields (overlap / out-of-bounds / truncation / OCR mismatch) with the field name and page. The operator sees at a glance which forms need a second look rather than reading every page.

### 4. Approve & send (the gate)
- **Approve & send** → records an approval (who, when, package revision) and triggers the `pbv_preflight_checklist` send in the applicant's language. This is the ONLY path that releases the handoff.
- **Hold / needs fix** → leaves the application in "review pending," no send. Optional note for what's wrong (feeds back to a PRD-86 field-map fix).
- The send path refuses to fire `pbv_preflight_checklist` for an application that has no current approval.

### 5. Re-review on regeneration
If documents are regenerated (e.g. after a field-map correction), any prior approval is invalidated and the application returns to "review pending," so a stale approval can never release a freshly-changed package.

---

## Data Model

Add (write migration file only; Alex applies):
- `pbv_document_review_approvals` — `id, application_id, package_revision, approved_by, approved_at, status (approved|held), note, created_at`. One current approval per application; superseded on regeneration.
- `package_revision`: **a content hash over the rendered output the operator actually saw** — specifically `hash( sorted list of (form_id, unsigned_pdf_hash) )` using the existing per-document `unsigned_pdf_hash` column. This binds the approval to the exact PDF bytes that get signed (the tenant signs the *stored* `unsigned_pdf`, not a fresh render). Regeneration recomputes `unsigned_pdf_hash` → revision changes → approval no longer matches → send blocked.

  **Decision: hash rendered bytes, not inputs.** An inputs-based hash (field-map version + `field_data_snapshot`) is rejected: if a deploy changes the renderer and documents are regenerated with identical inputs, an inputs-hash would not change, the stale approval would still match, and a visually-changed package would ship without operator review. The bytes-based hash voids the approval in exactly that case. The accepted cost is extra re-approvals when a renderer/deploy change triggers regeneration — which is the intended behavior, since the operator should re-confirm any package whose rendered output changed. A renderer change that does **not** regenerate documents leaves the stored, already-reviewed bytes untouched, so no spurious void occurs.

No change to `pbv_form_documents` schema; read its existing columns.

---

## Integration Points

- `lib/notifications/send.ts` / the preflight trigger — add an approval check before `pbv_preflight_checklist` is sent. (Coordinate with PRD-85, which also touches this send; land in agreed order to avoid a merge conflict.)
- `lib/pbv/form-generation/stamper.ts` + generation pipeline — on-demand re-render for the viewer (read-only).
- PRD-86 validators — per-document status.
- PRD-85 Phase 3 dashboard — entry point + the resend action routes through this approval.
- Storage (`pbv-applications` bucket) — signed-URL reads of `unsigned_pdf_path` for the viewer.

---

## Implementation phases

### Phase 1 — Review screen + viewer (read-only)
Admin route rendering the package for an application: document list from `pbv_form_documents`, inline PDF viewer (storage read or on-demand `stampForm` re-render), applicant header. No write, no gate yet — pure visibility.

### Phase 2 — Validation status
Surface PRD-86 validator results per document (pass/flagged-fields). If PRD-86 is not yet merged, show document status from `pbv_form_documents` and leave a typed slot for validator output.

### Phase 3 — Approval gate
Migration for `pbv_document_review_approvals`; "Approve & send" / "Hold" actions; bind approval to `package_revision`; make the `pbv_preflight_checklist` send require a current approval; invalidate approval on regeneration.

### Phase 4 — Wire the Mia/Santha path
After PRD-86 Phase A regenerates their corrected documents: operator opens each in this UI, confirms validation passes, approves & sends. This is the concrete execution of PRD-85 Phase 4.

---

## Acceptance / verification

- Opening an application shows all its generated documents rendered exactly as production would render them (confirm by diffing a viewer render against a pipeline-generated PDF for the same data).
- The `pbv_preflight_checklist` send does not fire for an application with no current approval; it fires on "Approve & send."
- Regenerating an application's documents invalidates a prior approval and returns it to "review pending" (a stale approval cannot release the new package).
- Validation flags from PRD-86 appear per document; a form with a deliberately misplaced field shows flagged, a clean form shows pass.
- Mia and Santha: each package reviewed, validation clean, approved, and `notification.sent` for `pbv_preflight_checklist` recorded — only after PRD-86 regeneration.

## Non-goals

- No change to the signing ceremony, intake, or what the documents contain.
- No auto-approval — a human always approves.
- No HACH-facing review (this is pre-submission, Stanton-internal).
- No field-map editing in this UI (that is PRD-86's tool); this UI reviews output and gates the send.

## Open questions / decisions to log

1. ~~Which staff role may approve a pre-send review (any staff vs. a named permission).~~ **RESOLVED: any authenticated Stanton staff may approve for now.** Implement behind a single named authorization seam — a `canApprovePreSendReview(user): boolean` helper (returns true for any non-HACH Stanton staff today) used by *both* the API route guard and the UI button's enabled state — so a future tightening to a named permission (e.g. `requirePermission('pbv_pre_send_review','approve')`, or reusing `send_to_hach`) is a one-line change with no call-site churn. Do not scatter the role check.
2. ~~`package_revision` as counter vs. content hash~~ **RESOLVED:** content hash over rendered bytes — `hash(sorted (form_id, unsigned_pdf_hash))`. Inputs-based hash rejected (see Data Model rationale).
3. Viewer source: serve stored `unsigned_pdf_path` vs. always re-render via `stampForm` (default: serve stored — it is the exact bytes the approval is bound to and the tenant signs; re-render only as a fallback if the stored object is missing/hash-mismatched).
4. Land order vs. PRD-85 on the shared send path.
