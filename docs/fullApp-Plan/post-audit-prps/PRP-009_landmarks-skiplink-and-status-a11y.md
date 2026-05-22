# PRP-009 — Page Landmarks, Skip-Link, Progress & Status Accessibility

**Assigned batch (per BATCH_PLAN.md):** 02
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **A7** (Medium, landmarks/skip-link), **A6** (Low, progress announce), **A5** (Low, status color-alone).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `app/pbv-full-app/[token]/layout.tsx` (to host the landmark/skip-link), `components/pbv/intake/IntakeShell.tsx` (~126–137 progress bar), `components/pbv/TenantDocumentUpload.tsx` (~535 status dot).
**Outputs (write — the ONLY files this PRP may modify/create):** `app/pbv-full-app/[token]/layout.tsx`, `components/pbv/intake/IntakeShell.tsx`, `components/pbv/TenantDocumentUpload.tsx`, new test(s).
**Acceptance criteria:**
- A `<main>` (or `role="main"`) wraps tenant page content and a visually-hidden "Skip to main content" link is the first focusable element targeting it.
- Intake section progress changes are announced via a live region.
- The document-status dot has an accessible name (not color-only).

## Context (self-contained)
Tenant pages use generic `<div>` wrappers with no `<main>` landmark and no skip-link, so screen-reader users tab through the header on every load. The intake progress bar has correct `role`/`aria-*` but its `aria-valuenow` updates aren't in a live region (some SRs don't announce section changes). Document status dots use color; text labels exist but the dot isn't programmatically tied to them. Adding the landmark at the **layout** level keeps the page body files untouched (the main tenant `page.tsx` is modified by a different effort for SSR/motion — do not edit it here).

## Problem
- **A7:** no `<main>`/skip-link.
- **A6:** progress change not announced.
- **A5:** status conveyed partly by color alone.

## Goals
1. **A7:** add `<main id="main">` around the page slot in the layout + a visually-hidden focusable skip-link (first focusable element) targeting `#main`.
2. **A6:** announce "Section X of Y" on change via a live region (add `aria-live="polite"` to the progress container or an offscreen live region); keep the existing `role="progressbar"`/`aria-*`.
3. **A5:** give the status dot an `aria-label` matching its label (Missing/Submitted/Approved/Rejected), or wrap dot+label so the accessible name includes the text.

## Non-goals
- Do **not** edit the tenant `page.tsx` body (SSR/motion is handled elsewhere) — host the landmark in the layout. No design-system landmark overhaul. Do not edit files outside the Outputs list.

## Implementation
1. Layout: `<main>` + visually-hidden skip-link.
2. IntakeShell: live region announcing section progress.
3. TenantDocumentUpload: status dot accessible name.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` — skip-link is the first focusable element and targets `#main`; `<main>` present; progress region is `aria-live`; status dot has an accessible name.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** axe + SR — skip-link works; section change announced; status conveyed without color (grayscale/SR check).
