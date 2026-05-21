# PRD-56 Build Report: Signing & Submission End-to-End Correctness

**Date:** 2026-05-20  
**Commit:** 2e33ede  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Fixed the three disconnected signature stores (F1), brought member-token sign-form to parity with HOH route using shared completion logic (F2), fixed per-form has_signed check (F3), added summary audit row (F4), added idempotency to HOH sign-form (F5), fixed download to use pdf-lib instead of Playwright (F6/F7), and confirmed submission lock (F8).

---

## F-Table Status

| Finding | Status | Fix Description |
|---------|--------|-----------------|
| F1: Three signature stores not synced | **FIXED** | finalizeValidation now reads pbv_form_documents + pbv_signature_events (canonical model) |
| F2: Magic-link sign-form is stub | **FIXED** | Now uses shared completeFormSigning() from lib/pbv/signing/completeForm.ts |
| F3: additional-signers has_signed wrong | **FIXED** | Now checks per-required-form (collected ⊇ required) instead of any event |
| F4: sign-summary writes no audit row | **FIXED** | Creates pbv_signature_event with hash/IP/UA/ceremony and links to summary |
| F5: HOH sign-form not idempotent | **FIXED** | withTenantContext now accepts custom idempotencyKey (ceremony_id + form_document_id) |
| F6/F7: Download uses Playwright | **FIXED** | Now uses pdf-lib to merge signed PDFs (serverless-safe) |
| F8: Lock check missing for member-token | **FIXED** | Added submitted_at check to member-token sign-form route |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/pbv/finalizeValidation.ts` | Rewrote to use pbv_form_documents canonical model (F1) |
| `lib/pbv/signing/completeForm.ts` | **NEW** Shared completion logic used by both sign-form routes |
| `lib/pbv/tenantEndpoint.ts` | Added idempotencyKey parameter to withTenantContext (F5) |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | Uses custom idempotency key (F5) |
| `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | Adds summary audit row with signature_event (F4) |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | Uses shared logic + lock check (F2, F8) |
| `app/api/t/[token]/pbv-full-app/additional-signers/route.ts` | Per-form has_signed check (F3) |
| `app/api/t/[token]/pbv-full-app/print/download/route.ts` | pdf-lib merge instead of Playwright (F6/F7) |
| `app/pbv-full-app/[token]/print/page.tsx` | Uses pbv_signature_events instead of audit_log (F6) |
| `lib/pbv/__tests__/finalizeValidation.test.ts` | Updated for canonical model (S1) |

---

## Static Gates

| Gate | Status | Notes |
|------|--------|-------|
| S1: finalize unit test | ✅ PASS | 6/6 tests pass |
| S2: HOH sign-form idempotency | ✅ PASS | Custom key implemented |
| S3: member-token parity | ✅ PASS | Uses shared completeForm.ts |
| S4: has_signed per-form | ✅ PASS | New logic implemented |
| S5: member-token lock | ✅ PASS | submitted_at check added |
| S6: tsc + build | ✅ PASS | Clean |

---

## Deferred Runtime Gates (post-deploy verification)

| Gate | Description |
|------|-------------|
| R1 | Deployed walk: single adult completes summary → all forms → submit; verify event rows with hash/IP/ceremony |
| R2 | 2-adult household via same-device and member-token; both reach signed; device_owner correct |
| R3 | After submit, reload is read-only; mutation endpoints return 409; finalize replay returns 200 |
| R4 | "Download my application copy" returns packet with signed forms + summary + signatures table |

---

## Decisions Logged to OPEN-DECISIONS.md

None for PRD-56 — all fixes were straightforward code changes without ambiguous decisions.

---

## Prod Migrations to Apply

None for PRD-56 — no DB schema changes required.

---

## Next Steps

Proceed to **PRD-57** (intake integrity and safety).
