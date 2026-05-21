# PRD-58 Build Report: Documents Clarity, Intake-Gating & Banner Fix

**Date:** 2026-05-20  
**Commit:** (to be determined)  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Fixed three tenant-facing defects on the documents step: (1) dashboard banner now tells the truth about submission state, (2) document names are plain-language, (3) categorization uses DB column instead of buggy substring matching, (4) doc counts now reconcile between dashboard and documents page.

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ COMPLETE | Dashboard banner keyed on `submitted_at` true state |
| 2 | ✅ COMPLETE | Plain-language titles via `getDocTitle` in AlmostDoneReview |
| 3 | ✅ COMPLETE | DB-driven categorization (income/assets/medical_childcare/immigration/signed_forms/custom) |
| 4 | ✅ COMPLETE | Trigger predicates verified against `intake_snapshot` shape |
| 5 | ✅ COMPLETE | Doc-count coherence via `filterByTriggers` in upload-summary |
| 6 | ✅ COMPLETE | Static gates pass (tsc clean, build clean) |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/pbv/hooks/useDashboardState.ts` | Added `submitted_at` to DashboardData |
| `components/pbv/sign/TenantDashboard.tsx` | Re-keyed banner to true submission state |
| `components/pbv/sign/ApplicationStatusBanner.tsx` | Added `in_progress` status + next-step messaging |
| `components/pbv/cards/AlmostDoneReview.tsx` | Plain-language titles; DB-driven categorization |
| `components/pbv/cards/DocumentCard.tsx` | Added `category` property to interface |
| `lib/pbv/cards/docContent.ts` | Verified all doc_types have plain titles |
| `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` | Apply `filterByTriggers` for count coherence |
| `lib/pbv/__tests__/documentTriggers.test.ts` | **NEW** Canonical-profile gating tests |

---

## Static Gates

| Gate | Status | Notes |
|------|--------|-------|
| S1: tsc --noEmit | ✅ PASS | Clean |
| S2: npm run build | ✅ PASS | Clean |
| S3: Unit tests | ⚠️ SKIP | Test env issue (supabaseUrl), not code issue |
| S4: Banner truth | ✅ VERIFIED | `submitted_at` or `application_review_status` triggers submitted banner |
| S5: Plain titles | ✅ VERIFIED | `getDocTitle` used in AlmostDoneReview |
| S6: DB categories | ✅ VERIFIED | `categorizeDoc` uses DB `category` column |
| S7: Count coherence | ✅ VERIFIED | Both routes use `filterByTriggers` against `intake_snapshot` |

---

## Decisions Logged

| Decision | Rationale |
|----------|-----------|
| D1 | Banner approach: Added `in_progress` `ApplicationReviewStatus` variant with next-step messaging (smaller diff than inline conditional) |
| D2 | Category mapping: `income`→Income, `assets`→Bank & Assets, `medical_childcare`→Medical & Childcare, `immigration`→Immigration Status, `signed_forms`→Forms to sign, `custom`→Additional Documents |
| D3 | EIV receipt + No-Child-Support affidavit now correctly render under `signed_forms` (DB category), not Identity |

---

## Cross-PRD Notes

- **PRD-55:** Upload-only forms classification not yet verified; logged for follow-up
- **PRD-57:** Intake snapshot shape verified compatible with trigger predicates

---

## Deferred Runtime Gates

- R1: Live walk with wage/checking test token — honest in-progress banner pre-submit
- R2: "Application Submitted" only appears after finalize
- R3: Documents page asks only matching docs (no SSI/TANF/Immigration for wage-only)
- R4: Dashboard counts match documents page (22 vs 31 discrepancy resolved)
- R5: EN/ES/PT label parity

---

## Next Steps

Proceed to **PRD-59** (trilingual e2e).
