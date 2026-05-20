# Build Report — PRD-37: Printable Application Copy

**Date:** 2026-05-17  
**Branch:** `feat/pbv-printable-application-37`  
**Status:** Shipped 2026-05-16

---

## What shipped

- **F1** — `/pbv-full-app/[token]/print` page reads from `intake_snapshot`
- **F2** — Print view shows household data, income, assets, expenses, documents
- **F3** — Clean print styling via CSS `@media print`
- **F4** — Link from tenant dashboard (optional per PRD)

---

## What changed from PRD

- **HTML-to-PDF** — Deferred. Print view is HTML-only; downloadable PDF requires puppeteer-core or playwright (not implemented).
- **Admin access** — Added in PRD-38 via "View tenant copy" link on admin detail page.

---

## What was deferred

- **HTML-to-PDF generation** — Deferred to future PRD.
- **Appendix of signed summary** — Deferred from V1.

---

## Verification status

| Item | Status |
|---|---|
| Print view loads with snapshot data | [inference based on code review] |
| Print styling works | Pending runtime verification |
| Admin link works | Added in PRD-38 |

---

## Known issues / followups

- HTML-to-PDF deferred
- Runtime verification needed for print styling
