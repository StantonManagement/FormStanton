# PRP-005 — Functional-Correctness Verification — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `88fb2e9f8847a41f2cd8f19e42c71c5235c6cc70`
**Findings:** open-items audit Pass 2 — items **#5, #6, #7, #8, #9**

## Files changed
- `lib/pbv/signing/completeForm.ts` — exported `loadFieldMapForSigning` and `buildSignatureFieldData` (test-only surface; behaviour unchanged).
- `lib/pbv/__tests__/prp005-functional-correctness.test.ts` *(new)* — 9 regression tests covering every item.

## Per-item evidence
| Item | Status | Evidence (file:line) |
|------|--------|---|
| #5 per-signer image | **VERIFIED CORRECT** | `lib/pbv/signing/completeForm.ts:210-219` builds `sigImageMap` keyed by `signer_member_id`; `:251-258` `imageResolver` maps `__sig__:${memberId}` → that buffer; `:392-403` `buildSignatureFieldData` emits `__row_pattern:${data_key}:signature:${rowIndex} = __sig__:${memberId}` per adult row. |
| #6 each_adult signer union | **VERIFIED CORRECT** | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:128` iteration is a single `[{slot:1, allAdultIds:true}]` for each_adult/individual; `:278-280` `requiredSignerIds = members.filter(>=18).map(m => m.id)` (full union); `:288-310` upsert uses `onConflict: 'full_application_id,form_id,language'` → one row per `(form_id, language)`. |
| #7 review CTA | **VERIFIED CORRECT** | `components/pbv/intake/SectionReview.tsx:115` `router.push('/pbv-full-app/' + token + '/dashboard')`. No `/review` push anywhere in the file. |
| #8 null fieldMap | **VERIFIED CORRECT** | `lib/pbv/signing/completeForm.ts:195-197` returns `errorCode: 'field_map_missing'` *before* the `formDocUpdate.status = 'signed'` assignment at `:298`. The member-token sign-form route maps any non-`not_found` errorCode → 422. |
| #9 row_patterns plural | **VERIFIED CORRECT** | `grep -l '"row_pattern"' scripts/field-maps/*.json` returns nothing; the four multi-row maps (`citizenship-declaration-en/es.json`, `main-application-en/es.json`) all use `"row_patterns"`. |

## Path taken
- **No behavioural fixes.** Every item is already correct in this branch base (PRDs 62 + 66 + 76 + 77 + 82 + 83 + 84 collectively closed them). The PRP's "verify-first; don't 'fix' what is already correct" instruction was the right call.
- **Exported two private helpers** from `completeForm.ts` (`loadFieldMapForSigning`, `buildSignatureFieldData`) so the regression tests can exercise them directly without standing up a full supabase mock. Comments mark them as PRP-005 test surface.
- **No new lib files** (PRP Outputs forbid that); the #6 test mirrors the route's inline union expression and pins its shape.
- **Static scan for #9** is a true regression bar: a future map written with the singular key fails the suite.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/pbv/__tests__/prp005-functional-correctness.test.ts` — **9 pass / 0 fail / 3.52 s.**
- Existing `lib/pbv/__tests__/completeForm.test.ts` — **4 pass / 0 fail** (confirms the helper-export refactor did not regress).

## Migration
- **None.** PRP allowed one iff #6 needed a backfill of already-collapsed rows; #6 is correct in current code so no rows are collapsed → no backfill.

## Deferred runtime gates
- 3-adult household: generate-forms → 2 signatures finalize-blocks → 3rd unblocks (proves #6 in production).
- `citizenship_declaration` with 2 adults: each adult's own image renders in their slot row (proves #5 against real PDFs).
- Intake → review → submit lands on `/dashboard` (proves #7 in the real router).
