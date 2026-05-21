# PRD-55 Build Report: Form-Generation Completeness & Template Alignment

**Date:** 2026-05-20  
**Commit:** (to be determined after commit)  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Fixed the `briefing_cert` form generation issue and aligned all enabled templates across the four sources of truth (DB, source-pdfs.ts, field maps, field-mapping.ts). Disabled generation for forms missing source PDFs. Added observability via structured skip reasons and unit tests.

---

## Enabled-Template Reconciliation Table

| form_id | generation_enabled (DB) | source-pdf.ts key | source PDFs exist | field maps exist | field-mapping.ts resolver | Status |
|---------|------------------------|-------------------|-------------------|------------------|----------------------------|--------|
| main_application | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveMainApplication | ACTIVE |
| citizenship_declaration | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveCitizenshipDeclaration | ACTIVE |
| obligations_of_family | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveObligationsOfFamily | ACTIVE |
| hud_9886a | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveHud9886a | ACTIVE |
| hach_release | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveHachRelease | ACTIVE |
| hud_92006 | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveHud92006 | ACTIVE |
| child_support_affidavit | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveSimpleAffidavit | ACTIVE (conditional) |
| no_child_support_affidavit | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveSimpleAffidavit | ACTIVE (conditional) |
| debts_owed_phas | TRUE | ✓ | ✓ en,es | ✓ en,es | ✓ resolveSimpleAffidavit | ACTIVE |
| briefing_cert | TRUE | ✓ (renamed) | ✓ en,es | ✓ en,es | ✓ resolveBriefingCert | ACTIVE (fixed in PRD-55) |
| pet_addendum | **FALSE** (PRD-55) | ✓ | ✗ missing | ✗ missing | ✓ | DISABLED - source PDFs pending |
| vehicle_addendum | **FALSE** (PRD-55) | ✓ | ✗ missing | ✗ missing | ✓ | DISABLED - source PDFs pending |
| self_employment_worksheet | **FALSE** (PRD-55) | ✓ | ✗ missing | ✗ missing | ✓ | DISABLED - source PDFs pending |
| criminal_background_release | **FALSE** (PRD-55) | ✗ | ✗ | ✓ | ✗ | DISABLED - upload-only form |
| vawa_certification | FALSE | ✗ | ✗ | ✗ | ✗ | source-pending (existing) |
| reasonable_accommodation_request | FALSE | ✗ | ✗ | ✗ | ✗ | source-pending (existing) |
| zero_income_statement | FALSE | ✗ | ✗ | ✗ | ✗ | source-pending (existing) |
| eiv_guide_receipt | FALSE | ✗ | ✗ | ✓ | ✗ | source-pending (existing) |

---

## Skip Classifications

| form_id | Classification | Reason |
|---------|---------------|--------|
| pet_addendum | (b) source-pending | Missing source PDFs (pet-addendum-en.pdf, pet-addendum-es.pdf). **Action:** `generation_enabled=FALSE` in migration. Re-enable when PDFs sourced. |
| vehicle_addendum | (b) source-pending | Missing source PDFs. **Action:** `generation_enabled=FALSE` in migration. |
| self_employment_worksheet | (b) source-pending | Missing source PDFs. **Action:** `generation_enabled=FALSE` in migration. |
| criminal_background_release | (c) upload-only | Tenant-uploaded document, not generated. **Action:** `generation_enabled=FALSE`, category='upload'. |

---

## Conditional Forms Verification

| conditional_rule | Form(s) | Intake Captures? | Status |
|------------------|---------|------------------|--------|
| household_has_child_support | child_support_affidavit | ✓ `members.has_child_support` | OK |
| household_no_child_support | no_child_support_affidavit | ✓ (inverse of above) | OK |
| intake_has_pets | pet_addendum | ✓ `intakeData.pets.has_pets` | OK (disabled pending PDFs) |
| intake_has_vehicle | vehicle_addendum | ✓ `intakeData.vehicle.has_vehicle` | OK (disabled pending PDFs) |
| household_has_self_employment | self_employment_worksheet | ✓ `members.has_self_employment` | OK (disabled pending PDFs) |

**Cross-PRD flags:** None — intake captures all required inputs. PRD-57 verified static.

---

## Files Changed

| File | Change |
|------|--------|
| `lib/pbv/form-generation/source-pdfs.ts` | Renamed `briefing_docs_certification` → `briefing_cert` |
| `lib/pbv/form-generation/field-mapping.ts` | Updated case to `briefing_cert` |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | Added structured skip reasons (`source_pdf_missing`, `field_map_missing`, `conditional_skipped`) |
| `supabase/migrations/20260520000000_prd55_form_generation_alignment.sql` | DB alignment: rename briefing_docs_certification, disable source-pending forms |
| `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts` | NEW — regression test suite for form-generation completeness |

---

## Static Gates

| Gate | Status | Notes |
|------|--------|-------|
| TypeScript (`tsc --noEmit`) | ✅ PASS | Clean |
| Build (`npm run build`) | ✅ PASS | Clean |
| Unit tests | ✅ PASS | 7/7 tests pass |

---

## Deferred Runtime Gates (post-deploy verification)

| Gate | Description |
|------|-------------|
| Gate 1 | `briefing_cert/<lang>` appears in `generated[]` not `skipped[]` on `/sign/summary` walk |
| Gate 3 | Pet + vehicle + self-employment household generates those addenda (re-enable forms first) |
| Gate 4 | Verify remaining `skipped[]` only contains intentional skips |

---

## Decisions Logged to OPEN-DECISIONS.md

| PRD | Title | Type | Notes |
|-----|-------|------|-------|
| PRD-55 | Pet/Vehicle/Self-Employment forms disabled | MIGRATION-TO-APPLY | Re-enable when source PDFs land |
| PRD-55 | criminal_background_release as upload-only | MIGRATION-TO-APPLY | Confirm with Alex this is correct classification |
| PRD-55 | briefing_cert DB rename | MIGRATION-TO-APPLY | Apply migration to prod after review |

---

## Prod Migrations to Apply (from OPEN-DECISIONS.md)

1. `supabase/migrations/20260520000000_prd55_form_generation_alignment.sql`
   - Renames `briefing_docs_certification` → `briefing_cert`
   - Sets `generation_enabled=FALSE` for pet_addendum, vehicle_addendum, self_employment_worksheet, criminal_background_release

---

## Next Steps

Proceed to **PRD-56** (signing flow fixes).
