# Build Report — PRD-33: Intake Flow Bug Fixes

**Date:** 2026-05-17  
**Branch:** `fix/pbv-intake-flow-33`  
**Status:** Shipped 2026-05-15

---

## What shipped

- **F1** — Bootstrap endpoint now selects `intake_data` (`app/api/t/[token]/pbv-full-app/route.ts:31-33`)
- **F2** — Header progress label fixed: Review step shows `"Review"` instead of `"Section 8 of 7"`
- **F3** — Dashboard document upload navigates to correct route
- **F4** — Summary signing redirect preserves token
- **F5** — `buildSummary` emits full household data (names, DOBs, income, assets, expenses)
- **F6** — Tenant document view with signed URLs; bucket hardcoded to `form-submissions`
- **F7** — Medical section age calculation fixed (`useSectionVisibility.ts`)
- **F8** — Flush-before-navigate for edit-from-summary

---

## What changed from PRD

- **F6 bucket** — PRD originally hardcoded `submissions`. Changed to `form-submissions` per PRD-35 sweep findings.
- **F2 label** — PRD suggested `"Review"` (qualitative); implemented as `"Review"`.
- **F5 display** — Full string fields rendered without truncation per decision.

---

## What was deferred

- None. All 8 defects resolved.

---

## Verification status

| Item | Status |
|---|---|
| Review summary shows data | Runtime verified 2026-05-15 |
| Header shows correct progress | Runtime verified 2026-05-15 |
| Dashboard navigation works | Runtime verified 2026-05-15 |
| Tenant can view uploaded docs | Runtime verified 2026-05-15 |

---

## Known issues / followups

- None. PRD-33 closes the audit findings.
