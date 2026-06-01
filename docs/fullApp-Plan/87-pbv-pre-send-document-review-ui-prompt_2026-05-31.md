# Build Prompt — PRD-87 (PBV Pre-Send Document Review UI)

You are implementing **PRD-87**. Read it in full first:
`docs/fullApp-Plan/87-pbv-pre-send-document-review-ui_prd_2026-05-31.md`

Follow `docs/SHELL-PROTOCOL.md`. Typecheck with `node ./node_modules/typescript/bin/tsc --noEmit` — never `npx tsc`.

## Goal
An admin UI where staff review an applicant's generated document package exactly as it will render, see per-document validation status, and explicitly approve before the `pbv_preflight_checklist` signing prompt is sent. Approval gates the send.

## Scope guard
- New admin route under `app/admin/pbv/**` + a read-only render/preview endpoint
- One new migration (write only — Alex applies via Supabase MCP / `db push`)
- A minimal, additive approval check on the `pbv_preflight_checklist` send path
- Import `lib/pbv/form-generation/stamper.ts` and the generation pipeline READ-ONLY
Do not change the signing ceremony, intake, or document-generation logic. Do not modify `stamper.ts`.

## Build (per PRD-87 phases)
1. **Review screen + viewer (read-only):** admin route for an application showing applicant header (name, household size, language) and the document list from `pbv_form_documents`. Inline PDF viewer over each form — serve the stored `unsigned_pdf_path` via a signed URL from the `pbv-applications` bucket; re-render on demand via `stampForm` with the stored `field_data_snapshot` only if the stored hash doesn't match. Operator can flip through all forms without downloading.
2. **Validation status:** surface PRD-86 validator results per document (pass / flagged fields with name+page). If PRD-86 isn't merged yet, show `pbv_form_documents.status` and leave a typed slot for validator output — do not block on PRD-86.
3. **Approval gate:** migration for `pbv_document_review_approvals` (`id, application_id, package_revision, approved_by, approved_at, status, note, created_at`). **Authorization (resolved):** any authenticated Stanton staff may approve for now — guard the approve/hold API route with `requireStantonStaff()`. Route both the route guard AND the UI button's enabled state through ONE named seam, `canApprovePreSendReview(user): boolean` in `lib/auth.ts` (returns true for any non-HACH Stanton staff today), so tightening to a named permission later — e.g. `requirePermission('pbv_pre_send_review','approve')` or reusing the `send_to_hach` permission (Tess/Kristine) — is a one-line change with no call-site churn. Do not inline the role test at call sites. "Approve & send" records the approval bound to `package_revision` = `hash( sorted (form_id, unsigned_pdf_hash) )` — a **content hash over rendered bytes**, using the existing per-document `unsigned_pdf_hash`. Do NOT hash inputs (field-map + data): a renderer-change regen with identical inputs would leave an inputs-hash unchanged and ship a visually-changed package on a stale approval. Bytes-hash voids the approval in exactly that case (intended). "Approve & send" then triggers the preflight send in the applicant's language. "Hold" leaves it in review-pending with an optional note. The `pbv_preflight_checklist` send MUST refuse to fire without a current approval matching the current `package_revision`. Regenerating documents changes the revision → prior approval no longer matches → send blocked.
4. **Mia/Santha path:** leave as an operator-run step (no automated send in this build). Document it in the build report.

## Coordinate with PRD-85
PRD-85 also edits the `pbv_preflight_checklist` send path (`lib/notifications/send.ts`, `intake/complete/route.ts`). Land in the agreed order; the approval check here is additive — a failed/absent approval blocks the send, a failed template (PRD-85) is retried. Keep both checks composable.

## Gates (static only — no Playwright/e2e in the gate)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean
- Lint clean on touched files
- Unit tests: send refuses without a current approval; send fires with one; regeneration invalidates a prior approval (revision mismatch); viewer falls back to re-render only on hash mismatch; `canApprovePreSendReview` returns true for Stanton staff and false for HACH users
- Visual/runtime = manual Chrome walk of the review screen (out of gate)

## Deliverables
- The admin route + viewer + approval actions
- The migration file (unapplied)
- Build report at `docs/build-reports/87-pbv-pre-send-document-review-ui_build-report_2026-05-31.md`: what changed, the migration to apply, the chosen approver permission + `package_revision` strategy, and the operator steps to review→approve→send Mia and Santha after PRD-86 regeneration.

## Do NOT
- No auto-approval. A human always approves before any send.
- No field-map editing here (that's PRD-86). This UI reviews output and gates the send only.
- No migration applied from this environment.
```
Execution order for the Mia/Santha fix: PRD-86 Phase A  →  PRD-87  →  PRD-85 Phase 4.
```
