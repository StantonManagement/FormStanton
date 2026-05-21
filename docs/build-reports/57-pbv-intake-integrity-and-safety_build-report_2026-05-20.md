# PRD-57 Build Report: Intake Integrity & Tenant-Safety

**Date:** 2026-05-20  
**Commit:** (to be determined after commit)  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Fixed intake defects from the 2026-05-17 tenant journey, with highest priority on tenant-safety issues (neutral defaults on protected-status questions). Confirmed existing fixes hold, removed manual annual-income field, stabilized section count, added pets/vehicle capture, improved asset clarity, and added required-field markers.

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ COMPLETE | Protected-status safety test (12 regression tests) |
| 2 | ✅ COMPLETE | Required-field markers on contact phones |
| 3 | ✅ COMPLETE | Stable section count (ALWAYS_SECTIONS numerator) |
| 4 | ✅ COMPLETE | Removed manual annual income; always derived |
| 5 | ✅ COMPLETE | Asset-value clarity (checked types inline) |
| 6 | ✅ COMPLETE | Pets/vehicle capture (PRD-55 cross-dependency) |
| 7 | ✅ COMPLETE | Review page formatting confirmed |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/pbv/intake-schema.ts` | Removed `annual_was_manually_edited`; added `IntakePets`/`IntakeVehicle` interfaces |
| `lib/pbv/__tests__/intake-schema.test.ts` | **NEW** 12 regression tests for protected-status gating |
| `components/pbv/intake/SectionContact.tsx` | Added `required` prop to phone fields (Phase 2) |
| `app/pbv-full-app/[token]/intake/[section]/page.tsx` | Stable numerator using `ALWAYS_SECTIONS` (Phase 3) |
| `components/pbv/intake/SectionIncome.tsx` | Removed manual annual input; read-only derived display (Phase 4) |
| `components/pbv/intake/SectionAssets.tsx` | Asset clarity + pets/vehicle capture (Phases 5 & 6) |
| `components/pbv/IntakeDataDisplay.tsx` | Added pets/vehicle to review page (Phase 6) |

---

## Static Gates

| Gate | Status | Notes |
|------|--------|-------|
| S1: tsc --noEmit | ✅ PASS | Clean |
| S2: vitest (intake-schema) | ✅ PASS | 12/12 tests pass |
| S3: vitest (finalizeValidation) | ✅ PASS | 6/6 tests pass |
| S4: npm run build | ✅ PASS | Clean |
| S5: Protected-status neutral defaults | ✅ VERIFIED | `null` initial state |
| S6: Next-gating on DV/criminal | ✅ VERIFIED | `isSectionComplete` requires explicit boolean |
| S7: Manual annual removed | ✅ VERIFIED | Input removed; derived only |
| S8: Pets/vehicle in schema | ✅ VERIFIED | `intakeData.pets.has_pets` / `vehicle.has_vehicle` |
| S9: Review formatting | ✅ VERIFIED | `formatEnumLabel`, `formatPhone`, single Submit |

---

## Decisions Logged

| Decision | Rationale |
|----------|-----------|
| D1 | Pets/vehicle placed inside Assets section (not new sections) to keep section count stable |
| D2 | Single combined asset total (not per-asset values) — relabeled for clarity with checked types shown inline |
| D3 | Stable section count uses ALWAYS_SECTIONS for numerator; conditional sections appear but don't shift numbering |

---

## Prod Migrations

None — PRD-57 changes are UI/schema-only. Intake data is JSONB; adding `pets`/`vehicle` keys requires no migration.

---

## Deferred Runtime Gates (post-deploy verification)

| Gate | Description |
|------|-------------|
| R1 | Tenant device walk: no pre-selected protected-status answers |
| R2 | Section number stable as conditional sections appear/disappear |
| R3 | Pets/vehicle answers flow through to PRD-55 conditional form generation |
| R4 | Annual income matches between intake and review for same monthly inputs |

---

## Next Steps

Proceed to **PRD-58** (documents gating).
