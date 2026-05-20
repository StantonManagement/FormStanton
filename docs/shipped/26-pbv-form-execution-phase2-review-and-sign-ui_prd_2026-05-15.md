# PRD-26 — PBV Form Execution: Phase 2 Review-and-Sign UI

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md`, `docs/fullApp-Plan/25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md`
**Depends on:** PRD-24 (API) + PRD-25 (intake UI) complete

---

## Problem Statement

After intake is complete and forms are generated, the HOH tenant needs to:
1. Read and sign the plain-language summary doc in their preferred language
2. Review each generated federal form (in submission_language: en or es) with their data already stamped
3. Confirm intent to sign each form (per-form tap-to-confirm)

The signing flow uses the hybrid pattern: **one signature image captured + per-form intent confirmation**. The tenant draws their signature once; for each form, they tap "Sign this form" — each tap creates its own `pbv_signature_events` row with timestamp + document hash for the audit trail.

This PRD also delivers the **post-intake dashboard** that orchestrates the multiple parallel tasks (sign, upload documents, additional adults sign) before submit.

## Tenant journey

```
Intake complete
  ↓
"Forms generated" loading state (~5–10s, calls POST /generate-forms)
  ↓
TENANT DASHBOARD (this PRD)
  ┌──────────────────────────────────┐
  │ ☐ Review and sign your summary   │  ← Required first
  │ ☐ Review and sign 9 forms        │  ← Blocked until summary signed
  │ ☐ Upload 7 required documents    │  ← Independent (existing flow)
  │ ☐ Other adults need to sign      │  ← PRD-27
  │                                  │
  │ [Submit my application]          │  ← Disabled until all checked
  └──────────────────────────────────┘
  ↓
Summary doc screen → sign → returns to dashboard
  ↓
Forms stack → per-form tap-to-confirm signing → returns to dashboard
  ↓
Existing document upload flow → returns to dashboard
  ↓
PRD-27 additional-signer flow (if HOH chose same-device or magic-link-per-adult)
  ↓
Submit → existing finalize endpoint
  ↓
Success screen / already-submitted re-entry path
```

## Key decisions

### 1. The dashboard is the post-intake hub

A single `/pbv-full-app/[token]/dashboard` route. Cards for each parallel task; each card shows progress and links into the relevant sub-flow. Browser back from any sub-flow returns to dashboard.

### 2. Summary doc must be signed before any federal form

Enforced in the UI (federal-form sign button disabled) and on the API (`sign-form` returns 422 if summary not signed). Both sides for defense in depth.

### 3. One signature capture, per-form tap-to-confirm

UX:

- Summary doc signing: tenant taps "Sign summary" → reads doc → draws signature on canvas → submits → API call to `sign-summary` (which calls `signature/capture` internally, stores image, and creates the summary signature event)
- Federal forms signing: tenant taps "Sign all my forms" or "Sign this form" on a specific row
  - If no signature_image_ref in session state: open signature pad, capture, store ref
  - For each form being signed: call `sign-form` with the stored ref + ceremony_id + typed_name + consent_text_version
  - Show per-form confirmation modal: form thumbnail + "By tapping Sign, you confirm you read this document and agree to its contents. Apply your signature?" + [Cancel] [Sign]
  - On Sign: API call; row updates to "Signed ✓" with timestamp
  - One ceremony_id covers all forms signed in the same session (rolls over if session ends)

Per-form intent confirmation is what differentiates this from bulk-sign. Each form's audit row records explicit consent on that form's content.

### 4. Document upload card reuses existing flow

The dashboard card for uploads links to the existing `TenantDocumentUpload` component / route. No new code for the upload flow itself. The dashboard pulls upload counts from `application_documents` rows tied to this application.

Note: the upload requirements list is derived from intake answers via `trigger_upload` rules (PRD-24's conditional-rules + the existing `application_documents` doc_type seeding). The card surfaces "X of Y uploaded" — counts come from a `GET /api/t/[token]/pbv-full-app/upload-summary` endpoint (new — PRD-26 adds this as a thin wrapper around existing data).

### 5. Form preview is the actual stamped PDF

When the tenant taps a form to review it, they see the actual stamped PDF rendered in-browser (using PDF.js or browser native PDF viewer). Show the PDF's first page with a "View full document" expander. They scroll, they confirm, they sign.

The submission_language version is what's shown (es for PT-speakers, es for ES-speakers, en for EN-speakers). The summary doc is in `preferred_language` (which for PT-speakers may be pt, the only place pt appears).

### 6. Signing-status state machine

`pbv_full_applications.signing_status` values and transitions:

- `not_started` — dashboard entry, summary not signed
- `summary_signed` — summary done, federal forms pending
- `in_progress` — at least one federal form signed, not all
- `complete` — all forms signed by all required signers (HOH + additional adults)

The dashboard reads `signing_status` to determine which cards are checkable.

### 7. Ceremony grouping

A `ceremony_id` UUID is generated client-side at the start of each contiguous signing session and passed with every `sign-form` call within that session. If the tenant leaves and returns, a new ceremony_id starts. Audit-side use: "Maria signed 7 forms in one ceremony, then signed 2 more 3 hours later in a second ceremony."

### 8. Existing components

Reuse:
- `components/SignatureCanvas.tsx` for finger-drawing signature
- `components/pbv/TenantDocumentUpload.tsx` (linked from dashboard, not modified)
- `components/portal/SignatureTask.tsx` if its pattern applies — assess during build

### 9. Resilience

Per the standing rules (PRD-19 patterns):
- `tenantFetch` wrapper on all API calls (retry on `TypeError`, not on `AbortError`)
- Idempotency-Key header on every `sign-form` call (uses ceremony_id + form_document_id as the key)
- Network-loss mid-signing: dashboard shows what's already signed; tenant resumes per form

## Scope

### What this PRD does

- Dashboard route + component
- Summary doc review-and-sign screen
- Federal forms stack + per-form tap-to-confirm UX
- Signature capture flow (reused signature pad)
- Upload-summary endpoint (thin wrapper)
- Wires Submit button to existing `finalize` endpoint
- Adds dashboard copy in en / es / pt

### What this PRD does NOT do

- Does not implement additional-signer flow (PRD-27)
- Does not implement document upload UI (existing)
- Does not author summary doc content (PRD-28)
- Does not implement staff-assisted mode (PRD-29)
- Does not modify the signing API endpoints (built in PRD-24)
- Does not extend the schema

## Affected files

### New routes
- `app/pbv-full-app/[token]/dashboard/page.tsx`
- `app/pbv-full-app/[token]/sign/summary/page.tsx`
- `app/pbv-full-app/[token]/sign/forms/page.tsx`
- `app/pbv-full-app/[token]/sign/forms/[form_document_id]/page.tsx`

### New components
- `components/pbv/sign/TenantDashboard.tsx`
- `components/pbv/sign/DashboardCard.tsx`
- `components/pbv/sign/SummaryDocReviewSign.tsx`
- `components/pbv/sign/FormsStack.tsx`
- `components/pbv/sign/FormReviewSignModal.tsx`
- `components/pbv/sign/SignaturePadGate.tsx` (wraps SignatureCanvas with consent text)
- `components/pbv/sign/ConsentText.tsx` (renders the per-form consent in the right language, versioned)

### New hooks
- `lib/pbv/hooks/useSigningCeremony.ts`
- `lib/pbv/hooks/useFormStack.ts`
- `lib/pbv/hooks/useUploadSummary.ts`
- `lib/pbv/hooks/useDashboardState.ts`

### New API route (thin)
- `app/api/t/[token]/pbv-full-app/upload-summary/route.ts`

### Modified
- `app/pbv-full-app/[token]/page.tsx` — dispatcher updates to route post-intake tenants to dashboard
- `lib/pbvFullAppTranslations.ts` — dashboard, sign, consent copy in 3 langs
- Existing `finalize` endpoint — already covered by PRD-24; just consume from dashboard Submit

### Tests
- Component tests for dashboard, forms stack, modal, signature pad gate
- Hook tests for ceremony lifecycle, form-stack progress
- Integration test: Maria signs summary, signs all federal forms, dashboard reflects completion

## Phases

### Phase 1 — Dashboard shell

- Route, component, cards, state hook
- Bootstrap from existing GET endpoint
- Submit button (disabled state logic)
- Commit: `feat(pbv-sign): dashboard shell + cards`

### Phase 2 — Summary doc sign

- Summary doc review screen (renders the generated summary PDF)
- Signature pad gate with consent text
- Wires to `sign-summary` endpoint
- Returns to dashboard on success
- Commit: `feat(pbv-sign): summary doc review-and-sign`

### Phase 3 — Federal forms stack + per-form sign

- FormsStack component showing all generated forms with status
- Form review modal (per-form preview + per-form consent + Sign button)
- Ceremony hook (signature capture once, reuse across forms in session)
- Wires to `sign-form` endpoint
- "Sign all my forms" shortcut (still shows per-form modal in a stepper pattern; each tap is the per-form intent)
- Commit: `feat(pbv-sign): federal forms per-form tap-to-confirm`

### Phase 4 — Upload summary card

- Upload-summary endpoint (GET, returns counts grouped by doc_type for this application)
- Dashboard card links to existing TenantDocumentUpload route
- Commit: `feat(pbv-sign): upload summary card`

### Phase 5 — Translations + polish

- PT/ES/EN copy complete for all sign + dashboard flows
- Mobile UX pass
- Commit: `feat(pbv-sign): translations + mobile polish`

### Phase 6 — Integration test

- Maria walks dashboard → summary sign → federal forms (with conditional VAWA + RA included) → all signed → dashboard reflects completion → Submit (still disabled if uploads incomplete; we just verify the UI state)
- Commit: `test(pbv-sign): integration coverage`

### Phase 7 — Build report

`docs/build-reports/26-pbv-form-execution-phase2-review-and-sign-build-report_2026-05-15.md`.

## Out of scope

- Additional-signer flow (PRD-27)
- Document upload (existing)
- Summary doc content authoring (PRD-28)
- Staff-assisted mode (PRD-29)
- Browser E2E (PRD-30)

## Acceptance criteria

- HOH tenant can sign summary doc, then sign each federal form
- Cannot sign federal forms before summary is signed
- Cannot Submit until: summary signed + all required forms signed + all required uploads complete + (if any) all additional adults signed
- Each `sign-form` call creates a `pbv_signature_events` row with: ceremony_id, document_hash, typed_name, consent_text_version
- Network loss mid-ceremony: tenant returns to dashboard, sees what's already signed, resumes
- Dashboard counts (signed X of Y, uploaded X of Y) match server state
- Three languages live on all new copy
- Tests pass; `npm run build` clean

## Open questions

- Whether to render the PDF inline (PDF.js) or in an iframe (browser native). Inline is more controllable; iframe is simpler. Default: try inline first; fall back to iframe if PDF.js bundle size is problematic.
- Per-form consent text — best-effort first draft; refined later. Mark with `// CONSENT: tentative — review` comments.
- Whether "Sign all my forms" should batch the API calls or fire serially. Default: serial with progress UI; concurrency risks idempotency complications.
- Whether the dashboard should show estimated completion time. Default: no, keeps it crisp.
