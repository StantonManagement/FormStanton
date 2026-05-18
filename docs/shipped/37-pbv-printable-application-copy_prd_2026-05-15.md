# PRD-37 — Printable / Downloadable Application Copy

**Date:** 2026-05-15
**Author:** Claude (audit follow-up)
**Branch:** `feat/pbv-printable-application-37`
**Status:** Shipped 2026-05-16. Tenant `/print` view reads from `intake_snapshot`. HTML-to-PDF deferred. Admin access added in PRD-38.
**Depends on:** PRD-34 (snapshot pattern — printable reads from snapshot)

---

## Problem Statement

After a tenant completes the PBV application, they have no way to keep a copy of what they submitted. The generated PDFs (HUD forms, signed summary) are produced and stored server-side for the office; the tenant sees them only briefly during the signing flow. Once they close the link, the only record they have is in the office's filing system.

This matters because:
- Housing applicants frequently need their own paperwork for benefits coordinators, lawyers, social workers, and re-applications elsewhere.
- The population skews older and lower-bandwidth — many cannot easily request copies later.
- A printable record reduces follow-up calls to the office ("can you send me what I submitted?").
- It's a low-cost trust signal — the tenant has tangible proof of their submission.

This PRD adds two things: a "Download my application" PDF generated on demand from the immutable snapshot (PRD-34), and a "Printable view" HTML page that reflows for paper.

---

## Users & Roles

- **Tenant** — downloads or prints their own copy.
- **Tenant's social worker / advocate / lawyer** — receives the copy from the tenant for any external coordination.
- **Office staff** — no new responsibility.

---

## Closed decisions

- **PDF is generated on demand**, not stored. Generated from `intake_snapshot` + the existing summary doc. No new storage row.
- **Print view is HTML**, not a separate template. Single source of truth for the data; CSS handles paper layout.
- **No PII redaction.** This is the tenant's own data; they are entitled to the full record. Includes SSN last-four if it was captured.
- **Available only when `intake_status = 'complete'`.** If intake is in progress, no download — would be a partial record.

---

## Decisions still open — resolve during build

- **PDF generator**: reuse the existing `pdf-lib` setup that powers HUD form generation, or use a simpler HTML-to-PDF (e.g., `puppeteer` or `playwright`)? Recommendation: HTML-to-PDF. Simpler to maintain, matches the print-view content. The HUD-form pdf-lib pipeline is fragile and overkill for a clean prose document.
- **What goes in the printable copy**:
  - Always: header (tenant name, building/unit, submission date), full Section-by-Section data summary (matching PRD-33 F5's rebuilt Review)
  - Always: list of uploaded documents (filenames, status, upload date)
  - Always: list of generated/signed forms (filenames, who signed, when)
  - Optional: include the actual signed summary PDF as appendix? Recommendation: yes, append as last pages
- **File naming**: `<HOH last name>-PBV-application-<YYYY-MM-DD>.pdf`. Tested for spaces and special chars.
- **Pagination + page numbers**: yes. "Page X of Y" footer.
- **Signature display**: include the typed name and signed-at timestamp from `pbv_signature_audit_log`, but do not include the signature image (legal artifact stays with the office).

---

## Core Features

### F1: Print view (HTML)

- New route: `app/pbv-full-app/[token]/print/page.tsx`
- Server component. Reads the bootstrap data + intake_snapshot + documents + signatures from the existing endpoints.
- Renders a long-form HTML document optimized for print:
  - Header block: tenant name, address, unit, submission date
  - Section-by-section data display (same render logic as PRD-33 F5's `buildSummary` rebuild — extract into a shared component)
  - Documents table
  - Signatures table
- Print CSS: `@media print` rules for page breaks, no header chrome, etc.
- Visible in browser at the URL; user can use browser's "Print" → "Save as PDF" as a backup if the F2 download is broken.

### F2: PDF download endpoint

- New route: `app/api/t/[token]/pbv-full-app/print/download/route.ts`
- GET. Renders the print view server-side, converts to PDF via the chosen renderer (see open decision), returns as `application/pdf` with a sensible Content-Disposition filename.
- TTL on signed URL not needed — this is a session-bound tenant-scoped route.
- Acceptance: returns a valid PDF in <5s for an average application.

### F3: Dashboard link

- File: `components/pbv/sign/TenantDashboard.tsx`
- When `intake_status = 'complete'`: add a "Download my application copy" link below the task cards. Secondary styling — not a primary action.
- Translations en, es, pt.

### F4: Empty / error states

- If snapshot is missing (shouldn't happen post-PRD-34, but defensively): render an error page with "We're preparing your copy. Please check back later or contact the office."
- If PDF generation fails: surface a clear error in the dashboard and log the failure for monitoring.

---

## Data Model

No schema changes. Reads:
- `pbv_full_applications.intake_snapshot` (PRD-34)
- `application_documents` (filenames, status, upload date)
- `pbv_signature_audit_log` (typed names, timestamps)

---

## Integration Points

- `intake_snapshot` (PRD-34) — primary read source
- Documents and signatures tables — read-only
- Existing `tenantFetch` / token-scoped routing — no new auth
- Print CSS → reuse from existing public-facing CSS variables (`--paper`, `--ink`, etc.)

---

## Open Questions

See "Decisions still open." Plus:
1. Should the print view also be reachable from the office admin? Recommendation: yes, low-cost addition. Surface on the application detail page.
2. Should the "Download" link be available even mid-intake (with an "in-progress copy" watermark)? Recommendation: no for V1. Adds complexity, low value.

---

## Implementation Phases

**Phase 1 — Print view (target: half day)**
- F1: print route + shared section-render component (extracted from PRD-33 F5 work)
- F4: error states
- Manual visual QA in browser print preview

**Phase 2 — Download endpoint (target: half day)**
- F2: server-side renderer + PDF response
- F3: dashboard link
- E2E test: download an application copy, validate the PDF opens and contains expected sections

---

## Acceptance — what "done" looks like

- A tenant on a completed application sees a "Download my application copy" link on the dashboard.
- Clicking it produces a PDF named like `Smith-PBV-application-2026-05-15.pdf` containing every section the tenant submitted, the document list, the signature record, and (if open decision agrees) the signed summary as appendix.
- Visiting `/pbv-full-app/<token>/print` renders the same content as a print-friendly HTML page.
- Translations work for es and pt.
