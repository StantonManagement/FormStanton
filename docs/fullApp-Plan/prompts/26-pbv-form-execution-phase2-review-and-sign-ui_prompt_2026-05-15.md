# Cursor/Windsurf Prompt — PRD-26: Phase 2 Review-and-Sign UI

## Context

After intake (PRD-25) finishes, the tenant lands on a dashboard with parallel tasks: sign summary doc, sign federal forms, upload documents, additional adults sign. This pass builds the dashboard, the summary sign experience, and the per-form sign experience.

Hybrid signing: tenant draws their signature once, then taps to confirm each individual form. Each tap creates its own `pbv_signature_events` row for audit.

## Required reading before you start

1. `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` — § signing API, § signature application pipeline
3. `docs/build-reports/24-pbv-form-execution-data-model-and-api-build-report_2026-05-15.md` — final API shape after build
4. `components/SignatureCanvas.tsx` — finger-draw primitive to reuse
5. `components/portal/SignatureTask.tsx` — existing signing flow pattern in another part of the app, useful reference
6. `components/pbv/TenantDocumentUpload.tsx` — for understanding the upload card linkage (do NOT modify)
7. `lib/tenantFetch.ts` — resilience wrapper, use everywhere
8. `app/pbv-full-app/[token]/page.tsx` — dispatcher you'll extend

## Closed decisions (do not relitigate)

- Hybrid signing: one signature capture + per-form tap-to-confirm
- Summary doc signed before any federal form (UI + API both enforce)
- Dashboard is a single route showing parallel task cards
- Upload card links to existing TenantDocumentUpload — do not duplicate the upload UI
- `ceremony_id` is a client-generated UUID per session, passed to all sign-form calls in that session
- Per-form audit: ceremony_id + document_hash + typed_name + consent_text_version
- Idempotency-Key on every sign-form call (compose from ceremony_id + form_document_id)
- Three languages: en, es, pt. Summary doc in preferred_language; federal forms in submission_language.
- PDF rendering: try inline (PDF.js), fall back to iframe — pick during build

## Decisions still open — pick during build, document in build report

- **PDF render approach** — inline PDF.js vs iframe. Default: PDF.js if bundle size acceptable; otherwise iframe.
- **"Sign all my forms" UX** — single confirm covering all (defeats the hybrid intent) vs stepper through each form's modal. Default: stepper; the tenant still gets per-form intent confirmation but with momentum.
- **Per-form consent text** — first draft by Cascade in three languages, mark uncertain with `// CONSENT: tentative — review`.
- **Whether to show signing progress as a step bar in the modal** — default yes if "Sign all" used; helpful for tenant.

## Build this pass

### Commit 1 — Dashboard shell

- `app/pbv-full-app/[token]/dashboard/page.tsx` route
- `components/pbv/sign/TenantDashboard.tsx` with 4 cards
- `components/pbv/sign/DashboardCard.tsx` primitive (icon + title + status + action button)
- `lib/pbv/hooks/useDashboardState.ts` — bootstraps from existing GET endpoint, derives card states
- Submit button disabled until all cards complete
- Update dispatcher in `[token]/page.tsx` to route post-intake tenants to `/dashboard`
- Commit: `feat(pbv-sign): dashboard shell + cards`

### Commit 2 — Summary doc sign

- `app/pbv-full-app/[token]/sign/summary/page.tsx` route
- `components/pbv/sign/SummaryDocReviewSign.tsx`:
  - Renders the generated summary PDF inline (PDF.js attempt; iframe fallback)
  - "I have read this and I understand" checkbox + "Sign summary" button
  - Tap → SignaturePadGate opens
- `components/pbv/sign/SignaturePadGate.tsx`:
  - Wraps `SignatureCanvas` + consent text + Cancel/Submit
  - On Submit: calls `signature/capture` then `sign-summary`
- On success: return to dashboard with `signing_status = 'summary_signed'`
- Commit: `feat(pbv-sign): summary doc review-and-sign`

### Commit 3 — Federal forms stack + per-form sign

- `app/pbv-full-app/[token]/sign/forms/page.tsx`
- `components/pbv/sign/FormsStack.tsx`:
  - Lists all generated `pbv_form_documents` with per-form sign status
  - Sort: unsigned first, signed last
  - "Sign this form" button per row; "Sign all my forms" header button
- `components/pbv/sign/FormReviewSignModal.tsx`:
  - Opens on per-form tap
  - PDF preview (PDF.js / iframe)
  - Consent text (`ConsentText.tsx` reads consent_text_version from a constant in `lib/pbv/consent-text.ts`)
  - "I confirm" + "Sign this form" button
- `lib/pbv/hooks/useSigningCeremony.ts`:
  - Initializes ceremony_id (UUID) on first form sign of a session
  - Holds signature_image_ref (from `signature/capture`)
  - First form tap: opens signature pad (SignaturePadGate); on submit, calls `signature/capture` then `sign-form` for the active form
  - Subsequent taps: reuses ref, calls `sign-form` only
- `lib/pbv/hooks/useFormStack.ts`:
  - Fetches `forms` list and updates after each sign
- "Sign all my forms" runs a stepper: opens each form's modal in sequence, advances on confirm
- Commit: `feat(pbv-sign): federal forms per-form tap-to-confirm`

### Commit 4 — Upload summary card

- `app/api/t/[token]/pbv-full-app/upload-summary/route.ts`:
  - GET — returns `{ total, complete }` counts of required uploads for this application, grouped by category
  - Reads from `application_documents` joined to whatever defines "required for this app"
- `lib/pbv/hooks/useUploadSummary.ts`
- Wire dashboard upload card to display these counts
- Link target: existing TenantDocumentUpload route
- Commit: `feat(pbv-sign): upload summary card`

### Commit 5 — Translations + polish

- Dashboard, sign, modal copy in EN/ES/PT
- Per-form consent text in EN/ES/PT (mark tentative)
- Mobile UX pass
- Commit: `feat(pbv-sign): translations + mobile polish`

### Commit 6 — Integration test

- Vitest + msw walkthrough for Maria:
  - Bootstrap with intake_complete state
  - Render dashboard, summary card actionable, forms card blocked
  - Sign summary
  - Forms card actionable, sign each (~9 forms including VAWA + RA + zero-income)
  - Dashboard shows 2 of 4 cards complete (uploads + additional-signers pending)
  - Submit disabled
- Commit: `test(pbv-sign): integration coverage`

## Verification

After each commit:
- Component renders without error
- API calls fire to PRD-24 endpoints with correct shape

After all commits:
- Maria integration test passes
- `npm run build` clean
- All component/hook tests pass
- Manual smoke: walk through full flow against local PRD-24 + PRD-25 stack

## Anti-patterns — do NOT

- Do not capture the signature image more than once per ceremony
- Do not allow federal-form sign before summary signed
- Do not modify TenantDocumentUpload — link to it, don't refactor it
- Do not duplicate signing-event audit logic on the client — server is the source of truth, client just calls
- Do not skip the per-form consent confirmation UX (it's the whole point of the hybrid pattern)
- Do not use bulk-sign (one ceremony covering all forms with no per-form confirmation) — explicitly out
- Do not store signature image in localStorage or sessionStorage — server only, image_ref token in memory
- Do not modify the schema
- Do not implement additional-adults flow
- Do not author the real summary doc content here — placeholder text only

## Build report

`docs/build-reports/26-pbv-form-execution-phase2-review-and-sign-build-report_2026-05-15.md`:

1. **Components shipped**
2. **PDF render approach picked** (PDF.js or iframe) and why
3. **Per-form consent text drafted** — list of consent_text_version keys with EN copy
4. **Ceremony lifecycle observations**
5. **Integration test coverage**
6. **Mobile testing**
7. **Open questions for Alex**
8. **Recommendations for PRD-27** — anything that affects additional-signer UX

## When you're done

- All 6 commits on `feature/pbv-form-execution`
- Build report committed
- Clean `npm run build`
- Surface report to Alex; wait for sign-off before PRD-27
