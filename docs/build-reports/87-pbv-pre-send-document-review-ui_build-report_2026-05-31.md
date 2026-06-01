# Build Report — PRD-87: Pre-Send Document Review UI (operator approval gate)

**Date:** 2026-05-31
**Branch:** suggested `feat/pbv-pre-send-review`
**Status:** Code complete. Migration written (unapplied).

---

## Summary

An operator now reviews an applicant's generated document package — rendered exactly as the applicant will sign — and explicitly **Approve & sends** before the `pbv_preflight_checklist` signing handoff goes out. Approval is bound to a **package_revision** (content hash over the rendered bytes); regenerating documents voids a prior approval automatically. Nothing reaches the applicant until a human has looked.

The gate composes with PRD-85: at intake completion / in the retry sweep / on operator resend, the preflight send is now held unless the current package is approved.

---

## What changed

### Authorization seam (single point)
- `lib/auth.ts` — `canApprovePreSendReview(user)` (pure) + `requirePreSendReviewApproval()` (route guard). **Resolved decision:** any authenticated Stanton staff may approve for now (super admins always; HACH users never). Both the API guard and the UI button's enabled state go through this one predicate — tightening to a named permission later (e.g. reuse `send_to_hach`) is a one-line change here.

### package_revision + approval gate
- `lib/pbv/preSendReview.ts`:
  - `computePackageRevision(docs)` — **content hash over rendered bytes**: `sha256(sorted "form_id:unsigned_pdf_hash")`. Order-independent; empty for an ungenerated package. (Inputs-based hashing was rejected per PRD — a renderer-change regen with identical inputs would ship a visually-changed package on a stale approval.)
  - `approvalReleasesPackage(approval, currentRevision)` — pure: releases only an `approved` decision whose bound revision equals the current one.
  - `isHandoffApproved(appId)` — the gate every preflight send site consults. **Fails closed** (false on any error) so a handoff is never released without a verified, matching approval. Regeneration → new revision → prior approval no longer matches → send blocked. No DB trigger needed; it's a comparison at send time.
  - `getPackageDocs`, `getCurrentPackageRevision`, `getLatestApproval`, `recordReviewDecision`.

### Gate wired into the three preflight send sites (composes with PRD-85)
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — preflight send now held unless approved (normally true at intake → shows "handoff not sent" until reviewed).
- `app/api/cron/pbv-handoff-retry/route.ts` — the retry sweep skips any app whose current package isn't approved (keeps un-reviewed apps, incl. Mia/Santha, out of auto-send).
- `app/api/admin/pbv/applications/[id]/resend-handoff/route.ts` (PRD-85) — refuses (409) unless the current package is approved; a resend only re-sends an already-approved package.

### Review API
- `GET  /api/admin/pbv/applications/[id]/review` — applicant header, every generated doc (status + **signed viewer URL** of the exact stored unsigned PDF from the `pbv-forms` bucket), current `packageRevision`, approval state (`approved` / `held` / stale-after-regen / none), `canApprove`. Includes a typed `validation` slot per doc for PRD-86 validator output (null until Phase B persists it).
- `POST /api/admin/pbv/applications/[id]/review/approve` — guarded by `requirePreSendReviewApproval`; records the approval bound to the current revision, then sends the preflight in the applicant's language. The only first-release path. Audit-logged. Refuses an empty (ungenerated) package.
- `POST /api/admin/pbv/applications/[id]/review/hold` — records a held decision (+ note); sends nothing.

### Review UI
- `app/admin/pbv/pipeline/[id]/review/page.tsx` — document list + inline PDF viewer (iframe over the signed URL), approval-status banner (incl. "regenerated → re-review" state), per-doc validation-flag area, **Approve & send** / **Hold** with an optional note. Approve/Hold disabled when `canApprove` is false.
- `app/admin/pbv/pipeline/page.tsx` (PRD-85) — the "Handoff not sent" indicator now links to **Review & approve →** (replacing the bare resend button, since a resend now requires a prior approval).

### Migration (unapplied)
- `supabase/migrations/20260531130000_prd87_pbv_document_review_approvals.sql` — `pbv_document_review_approvals` (`id, application_id, package_revision, status[approved|held], approved_by, approved_by_name, approved_at, note, created_at`), RLS service-role policy, indexes on `(application_id, created_at desc)` and `(application_id, package_revision)`. Append-only; latest row authoritative.

---

## Gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ clean (exit 0) |
| Unit tests | `node ./node_modules/vitest/vitest.mjs run lib/pbv/__tests__/preSendReview.test.ts` | ✅ 11/11 |
| Lint | `npm run lint` | ⚠️ Not run — ESLint not installed in sandbox; `npx next lint` triggers an interactive install (Windows hang per SHELL-PROTOCOL). Verified by inspection (hook deps exhaustive; no new `any`). |
| Visual/runtime | manual Chrome walk of the review screen | out of gate, pending operator |

Test coverage maps to the PRD's required assertions: send refuses without a current approval (`approvalReleasesPackage` false → `isHandoffApproved` false); send fires with one (true when revisions match); regeneration invalidates a prior approval (revision changes → no match); `canApprovePreSendReview` true for Stanton staff, false for HACH. (DB wrappers are thin over the tested pure helpers.)

> Note: `preSendReview.test.ts` mocks `@/lib/supabase` + `@/lib/server-env` (they initialize at import time with no env in the vitest process) — same pattern as the existing `lib/__tests__/notifications.test.ts`.

---

## Migration to apply (by Alex / Windsurf — not from this environment)
`supabase/migrations/20260531130000_prd87_pbv_document_review_approvals.sql` via Supabase MCP / `db push`.

---

## Coordinate with PRD-85 (shared send path)
The approval check is additive and composes with PRD-85's retry/observability: a failed template (PRD-85) is retried; an unapproved package (PRD-87) is held. Both checks are independent — `isHandoffApproved` gates *whether* to attempt; the PRD-85 send path handles *how* an attempt succeeds/fails. PRD-85's `resend-handoff` and cron sweep were updated in place to consult the gate.

---

## Behavior change to flag
Intake completion **no longer auto-sends** the preflight handoff — it is held until an operator approves the package in the review UI. This is the intended PRD-87 gate ("nothing reaches the applicant until a human has looked"), and it surfaces via the existing PRD-85 "handoff not sent" indicator. If any non-PBV flow relied on intake-completion auto-sending the preflight, confirm before deploy.

---

## Mia / Santha (Phase 4 — still gated, unchanged)
Execution order is now enforceable in-product: **PRD-86 corrects maps → regenerate docs → open each in this review UI → Approve & send (PRD-85 Phase 4)**. The cron sweep will not auto-send them (no approval), and a resend is refused until approval. The operator approves only after eyeballing the rendered package here.

## Not built
- PRD-86 validator output is not yet persisted to DB (Phase B), so the per-doc `validation` slot is null today — the viewer + status + approval gate stand on their own.
- No auto-approval; a human always approves.
