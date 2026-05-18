# Cursor/Windsurf Prompt — PRD-37: Printable / Downloadable Application Copy

## Context

Tenants currently have no way to keep a copy of what they submitted. This PRD adds a print-friendly HTML view at `/pbv-full-app/[token]/print` and a downloadable PDF endpoint. Both read from the immutable `intake_snapshot` (PRD-34) so the tenant always sees the version they signed, even if staff later edits normalized data.

PRD-33 must land first (for the rebuilt summary render component, which is reused here). PRD-34 must land first (for `intake_snapshot`).

## Required reading before you start

1. `docs/fullApp-Plan/37-pbv-printable-application-copy_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/33-pbv-intake-flow-fixes_prd_2026-05-15.md` F5 — the rebuilt section render component to reuse
3. `docs/fullApp-Plan/34-pbv-intake-data-snapshot-pattern_prd_2026-05-15.md` — snapshot semantics
4. `app/api/t/[token]/pbv-full-app/route.ts` — bootstrap data shape
5. `pbv_signature_audit_log` schema — signatures to render
6. `application_documents` schema — documents list to render
7. Existing `pdf-lib` usage for HUD form generation (reference only — we may not use it)
8. `app/globals.css` print CSS patterns if any

## Closed decisions

- PDF generated on demand, not stored
- Print view is HTML; PDF rendered from the HTML
- No PII redaction
- Available only when `intake_status = 'complete'`

## Decisions still open — resolve during build, document in build report

- **PDF generator**: `puppeteer` / `playwright` (HTML→PDF), or `pdf-lib` (programmatic)? Recommend HTML→PDF. Already have `playwright` in devDependencies; reuse for runtime PDF generation OR add `puppeteer-core` + `@sparticuz/chromium` for serverless. Pick whichever works in the deploy target; document.
- **Include signed summary as appendix**: yes if straightforward; defer if complex. Recommend yes — load the summary PDF and merge.
- **File naming**: `<HOH lastname sanitized>-PBV-application-<YYYY-MM-DD>.pdf`. Sanitize for cross-platform filename safety.
- **Pagination**: page numbers in footer, "Page X of Y". Confirm renderer supports it.
- **Signatures content**: typed name + timestamp from `pbv_signature_audit_log`. NOT signature image.

## Build this pass

### Phase 1 — Print view (HTML)

1. **Extract shared section render** — From PRD-33 F5's rebuilt `buildSummary`, extract the per-section render blocks into `components/pbv/IntakeDataDisplay.tsx`. Props: `intakeData: IntakeData`, `language: PreferredLanguage`, optional `mode: 'review' | 'print'` (controls compact vs. spacious layout). Update `SectionReview.tsx` to use the new component. No behavior change for Review.
   Commit: `refactor(pbv-review): extract IntakeDataDisplay component for reuse (Phase 1 prep)`

2. **F1** — Create `app/pbv-full-app/[token]/print/page.tsx`. Server component. Fetch bootstrap, snapshot, documents, signatures via existing endpoints (or direct DB read with token validation). Render:
   - Header: tenant name, building address + unit, submission date
   - `<IntakeDataDisplay mode="print" />`
   - Documents section: table with filename, status, uploaded_at
   - Signatures section: table with signer name, document, signed_at
   Add a `print.css` file with `@media print` rules for page breaks, hide nav chrome, paper margins.
   Commit: `feat(pbv-print): /print HTML view of submitted application (F1)`

3. **F4** — Error states: snapshot missing → friendly message + office contact. PDF generation later — stub here, fully wired in F2.
   Commit: `feat(pbv-print): error states for missing snapshot (F4)`

### Phase 2 — Download endpoint

4. **F2** — Create `app/api/t/[token]/pbv-full-app/print/download/route.ts`. GET handler:
   - Validate token (`withTenantContext` or matching pattern)
   - Resolve the print view URL (probably the same `/print` route)
   - Render to PDF via the chosen renderer
   - Optionally append the signed summary PDF (per open decision)
   - Return as `application/pdf` with Content-Disposition filename per closed decisions
   - Log generation time; alert if >10s
   Commit: `feat(pbv-print): GET /print/download returns application copy as PDF (F2)`

5. **F3** — `components/pbv/sign/TenantDashboard.tsx`: when `intake_status === 'complete'`, add a "Download my application copy" link below the task cards. Secondary styling. Translations en/es/pt (mark pt tentative).
   Commit: `feat(pbv-dashboard): download-my-application-copy link (F3)`

6. **E2E test** — Add a test that:
   - Provisions a completed test application
   - Hits `/print/download`
   - Asserts PDF mime type, non-zero size
   - Optionally: parses the PDF text and asserts key fields appear (HOH name, building, at least one income amount)
   Commit: `test(pbv-print): E2E PDF download smoke (Phase 2)`

## Verification

- Visit `/print` on a completed token; review page in browser print preview; confirm pagination, no broken layout
- Click dashboard download link; PDF downloads with correct filename
- Open PDF: every section visible, signatures table populated, documents table populated
- If appendix decision = yes: confirm signed summary appears at the end

## Build report requirements

- PDF renderer chosen and why
- Sample PDF attached or path documented
- Generation time on a representative application
- Any sections that don't render cleanly in print and known limitations
