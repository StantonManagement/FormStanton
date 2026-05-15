# Audit Correction Addendum: PRDs 22-30 Build Reports

**Date:** 2026-05-15  
**Reference:** `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md`  

## Purpose

This addendum corrects false claims in the original PRD 22-30 build reports and documents what was actually fixed in PRD-31 (the hotfix bundle).

---

## False Claim Corrections

### 1. Server-Side Idempotency (M2)

**Original Claim (PRD-24 build report):**
> "All POST endpoints are idempotent via `withTenantContext` + `withIdempotency`"

**Truth:** The client code (`tenantFetch`) generates and sends `Idempotency-Key` headers, but the server-side `withIdempotency` wrapper was **not actually applied** to any PBV routes. The build report falsely claimed this was implemented.

**Status after PRD-31:**
- ✅ `intake/[section]` — NOW wired with `withIdempotency`
- ✅ `signature/capture` — NOW wired with `withIdempotency`
- ❌ `sign-form` — NOT wired (complex multi-stage logic, client still sends key but server doesn't dedupe)

### 2. PRD-27 Test Count Discrepancy

**Original Claim (PRD-27 build report):**
> "17/17 soft-match tests pass"

**Truth:** The actual test file `lib/__tests__/pbv-assisted-mode.test.ts` contains **8 tests**, not 17. The count 17 may have included integration tests or was a typo.

**Actual test distribution:**
- `pbv-assisted-mode.test.ts`: 8 tests (name soft-match + assisted mode)
- E2E flow tests: 11 Playwright steps (not unit tests)

### 3. PRD-30 Route Name Claim

**Original Claim (implied by test structure):**
> "Submit endpoint exists at `/api/t/[token]/pbv-full-app/submit`"

**Truth:** The actual route is at `/finalize`, not `/submit`. The E2E test was calling the wrong endpoint.

**Fix in PRD-31:** E2E test updated to call `/finalize` (B1).

---

## What Was Fixed in PRD-31

| Audit Item | Severity | Fix Summary |
|------------|----------|-------------|
| C1 | Critical | `summary-pdf` route now queries `tenant_access_token` (was `access_token`) |
| C2 | Critical | Magic-link `sign-form` no longer inserts non-existent `full_application_id` column |
| C3 | Critical | `intake/[section]` now accepts all 11 canonical section slugs from PRD-25 |
| C4 | Critical | `intake/complete` now validates `ALWAYS_SECTIONS` (was hardcoded legacy slugs) |
| H1 | High | Signature stamping now searches `row_patterns[].columns` for image fields |
| H2 | High | Multi-signer final stamp now includes all signatures (not just current signer) |
| H3 | High | Magic-link flow now stores signature image in Storage via new `signature/capture` endpoint |
| H4 | High | Bootstrap GET now returns `signing_status`, `intake_status`, `submission_language`, `hoh_member_id` |
| M2 | Medium | Server-side idempotency wired into `intake/[section]` and `signature/capture` |
| M3 | Medium | `sign-form` now returns 422 when `fieldMap` is null (was silently marking as signed) |
| L2 | Low | Intake Next button now gated on `isSectionComplete()` |
| L5 | Low | Field maps normalized: `citizenship-declaration-{en,es}` now use `row_patterns` plural |
| B1 | Medium | E2E test endpoint corrected: `/submit` → `/finalize` |

## What Was NOT Fixed (Deferred)

| Audit Item | Reason |
|------------|--------|
| M4 | Requires refactoring `useSigningCeremony` hook — UX polish only |
| L4 | Requires schema change (synthetic `pbv_form_documents` row for summary) — out of PRD-31 scope |
| L1 | `KNOWN_PACKAGE_HASH` requires first green E2E run to capture actual hash value |

---

## Files Modified in PRD-31

### Critical Fixes (C1-C4, H3-H4)
- `app/api/t/[token]/pbv-full-app/summary-pdf/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- `app/api/t/[token]/pbv-full-app/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` (new)
- `components/pbv/sign/MagicLinkSigningFlow.tsx`

### High Fixes (H1-H2, M3)
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts`

### Medium/Low Fixes (M2, L2, L5, B1)
- `app/api/t/[token]/pbv-full-app/signature/capture/route.ts`
- `app/pbv-full-app/[token]/intake/[section]/page.tsx`
- `scripts/field-maps/citizenship-declaration-en.json`
- `scripts/field-maps/citizenship-declaration-es.json`
- `tests/e2e/pbv-form-execution-happy-path.spec.ts`

---

## Verification Commands

```bash
# Type check
npx tsc --noEmit

# Unit tests
npm test

# E2E tests (requires dev server)
npm run test:e2e

# Build
npm run build
```

---

## Sign-off

This addendum confirms the corrections made to PRDs 22-30 build reports and documents the actual state of the PBV form-execution system after PRD-31 hotfixes.

**Addendum Author:** Cascade  
**Date:** 2026-05-15  
**Path:** `docs/build-reports/22-30-audit-correction-addendum_2026-05-15.md`
