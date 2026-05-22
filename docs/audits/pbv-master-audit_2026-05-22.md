# PBV Master Audit — Open Findings Only

**Date:** 2026-05-22
**Migrations applied today:**
- `finalize_pbv_application` RPC — applied
- `pbv_rls_lockdown` on `pbv_document_requirements` + `pbv_rejection_reason_templates` — applied

---

## Critical (Deploy-Blockers or Data-Integrity Loss)

| # | ID | Finding | File |
|---|---|---|---|
| 1 | **L1** | **Nine tenant endpoints bypass `withTenantContext`** — no rate limit, no `packet_locked`, no `submitted_at`, no CSRF, no idempotency | `forms/route.ts`, `documents/route.ts`, `upload-summary/route.ts`, `additional-signers/route.ts`, `action-items/route.ts`, `resume/route.ts`, `signer-completed/route.ts`, `summary-pdf/route.ts`, bootstrap `route.ts` |
| 2 | **L2** | `completeFormSigning` dead state on crash: event inserted but `collected_signer_member_ids` not updated → retry hits UNIQUE constraint, signer permanently stuck | `lib/pbv/signing/completeForm.ts:159-178` |
| 3 | **L3** | `intake/complete` bridge wipes uploaded docs on retry: `seedApplicationDocuments` → `DELETE application_documents` runs even if members already exist | `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:150-314` |
| 4 | **L4** | `ON DELETE CASCADE` on `pbv_signature_events` destroys audit trail when member or form doc is deleted | `20260515020000_pbv_signature_events.sql:8-11` |
| 5 | **L5** | Dashboard `canSubmit` broken by conditionally-skipped forms: `formsTotal` counts skipped, `formsSigned` does not, so `canSubmit = false` forever | `lib/pbv/hooks/useDashboardState.ts:139-145` + `forms/route.ts:69-74` |
| 6 | **D1** | No Content-Security-Policy header on tenant routes | `middleware.ts:168-177`, `next.config.js:40-64` |
| 7 | **D2** | No rate limiting on any tenant-facing endpoint | All `/api/t/[token]/pbv-full-app/*` |

---

## High (Compliance, Security, or Significant UX Failure)

| # | ID | Finding | File |
|---|---|---|---|
| 8 | **A12** | Member-token `sign-form` returns wrong status for "not found" errors (string matching instead of typed code) | `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:93-98` |
| 9 | **L6** | `send-link` route lacks `packet_locked` check | `additional-signers/[member_id]/send-link/route.ts:18-149` |
| 10 | **L7** | `withIdempotency` race allows double-execution: two concurrent requests with same key both miss cache, both run handler | `lib/idempotency.ts:42-51` |
| 11 | **L8** | Language mismatch between form generation (`submission_language ?? preferred_language`) and display (`preferred_language` directly) | `generate-forms/route.ts:62-63` vs `forms/route.ts:48-57` |
| 12 | **L9** | `stamper.ts` `getPage` throws on missing page — one bad field map kills entire `generate-forms` request | `lib/pbv/form-generation/stamper.ts:75-80` |
| 13 | **A11** | `generate-forms` summary upload uses `upsert: true` without version guard | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:315-320` |
| 14 | **#1** | HOH `sign-form` route duplicates `completeForm.ts` instead of using it | `app/api/t/[token]/pbv-full-app/sign-form/route.ts:63-350` |
| 15 | **#2** | `pbv_household_members.signing_device` only gets set when all signers complete (HOH route) | `app/api/t/[token]/pbv-full-app/sign-form/route.ts:296-299` |
| 16 | **#3** | `completeFormSigning` discards signer's `typed_name`, writes DB `member.name` instead | `lib/pbv/signing/completeForm.ts:142` |
| 17 | **#4** | `X-Assisted-By` header trusted with only existence check (HOH path) | `app/api/t/[token]/pbv-full-app/sign-form/route.ts:69-78` |
| 18 | **#5** | `generate-forms` overwrites unsigned PDF used by in-flight signers | `generate-forms/route.ts:143-149` |
| 19 | **#6** | `finalize` doesn't verify `document_hash` matches current unsigned bytes | `lib/pbv/finalizeValidation.ts:38-136` |
| 20 | **A1-alt** | Signature pad has no keyboard fallback — users who cannot use mouse/touch are blocked | `components/pbv/sign/SignaturePadGate.tsx:134` |
| 21 | **D3** | Magic link token brute-force: no rate limiting on signer bootstrap, no failure lockout | `app/api/pbv-full-app/signer/[member_token]/route.ts:24-28` |
| 22 | **D4** | File upload validates MIME type (`file.type`) but not magic bytes | `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:86-91` |
| 23 | **D6** | Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) missing on tenant routes | `middleware.ts:170-175` |
| 24 | **G1** | `CONSENT_TEXT_VERSION` hardcoded, not enforced in database | `lib/pbv/consent-text.ts:10` |
| 25 | **G2** | Console logs may leak PII (tenant_access_token in URLs, full error payloads) | Multiple API routes |
| 26 | **I2** | No health check endpoint | None found |
| 27 | **J1** | `KNOWN_PACKAGE_HASH` is still `'UPDATE_ME'` | `tests/e2e/pbv-form-execution-happy-path.spec.ts:35` |
| 28 | **J2** | No E2E coverage of error branches (network failure, 409, 422, 410, 500) | `tests/e2e/` |

---

## Medium

| # | ID | Finding | File |
|---|---|---|---|
| 29 | **A8** | `events` route fire-and-forget without client feedback on persistence | `app/api/t/[token]/pbv-full-app/events/route.ts:151-157` |
| 30 | **L10** | `additional-signers` GET trusts `collected_signer_member_ids` over actual `pbv_signature_events` | `additional-signers/route.ts:40-67` |
| 31 | **L11** | `documents` GET returns `no_longer_required` through type cast even if DB says `submitted` | `documents/route.ts:198` |
| 32 | **L12** | `upload-summary` and `documents` use different trigger filtering logic — counts can diverge | `upload-summary/route.ts` + `documents/route.ts` |
| 33 | **L13** | `computeAge` inline duplication in `documentTriggers.ts` differs from `lib/pbv/age.ts` (leap-year drift) | `lib/pbv/documentTriggers.ts:43` |
| 34 | **#11** | `signed_pdf_path` uses `upsert: true`, re-signing overwrites prior signed PDF | `sign-form/route.ts:282-289`, `completeForm.ts:238-245` |
| 35 | **#12** | Member-token route builds fake `Request` object to call `completeFormSigning` | `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:80-89` |
| 36 | **#13** | `tryLoadPdf` empty catch swallows real load errors (permission denied, EMFILE) | `lib/pbv/form-generation/source-pdfs.ts:30-36` |
| 37 | **#14** | `resolveFieldData` falls through to single-signature default for unknown `formId`s | `lib/pbv/form-generation/field-mapping.ts:330-331` |
| 38 | **A2-alt** | Form review modal lacks focus trap and focus restoration | `components/pbv/sign/FormReviewSignModal.tsx:82` |
| 39 | **A3-alt** | Error messages not announced to screen readers | `components/pbv/sign/SignaturePadGate.tsx:140-141` |
| 40 | **C1** | No `beforeunload` guard on intake or signing flows | `intake/[section]/page.tsx`, `sign/summary/page.tsx` |
| 41 | **C2** | Hooks lack robust retry with exponential backoff | `lib/tenantFetch.ts:53-60` |
| 42 | **D5** | `X-Forwarded-For` trusted without proxy awareness | `app/api/log/client-error/route.ts:34` |
| 43 | **D7** | CSRF protection on state-changing POSTs is weak | All `/api/t/[token]/pbv-full-app/*` POST routes |
| 44 | **E1** | `IntakeSectionPage` `handleSectionChange` stale-closure risk | `app/pbv-full-app/[token]/intake/[section]/page.tsx:98-105` |
| 45 | **E3** | `tenantFetch` idempotency key is overwritten by auto-generated key | `lib/tenantFetch.ts:22-28` |
| 46 | **F1** | No validation of `?filter=` search parameter values | `app/pbv-full-app/[token]/documents/page.tsx:54-55` |
| 47 | **F2** | No deep-link guards preventing skipping intake sections | `app/pbv-full-app/[token]/intake/[section]/page.tsx` |
| 48 | **G3** | No tenant data-deletion mechanism (GDPR/CCPA right to deletion) | None found |
| 49 | **G4** | Audit logs are not tamper-evident (no hash chain) | `lib/events/application-events.ts` |
| 50 | **G5** | Signature images and signed PDFs have no retention policy | Supabase Storage buckets |
| 51 | **I3** | Build-time validation skipped on Vercel | `scripts/validate-env.ts:8-11` |
| 52 | **I4** | No runbook for common tenant support issues | `docs/` |
| 53 | **J3** | No visual regression tests for signature pad and scanner | None found |
| 54 | **J4** | No load test for `generate-forms` with 10+ household members | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` |
| 55 | **J5** | No accessibility tests (axe-core) | None found |

---

## Low

| # | ID | Finding | File |
|---|---|---|---|
| 56 | **A5-alt** | Document status relies partially on color alone (mitigated by text labels) | `components/pbv/TenantDocumentUpload.tsx:535` |
| 57 | **A6-alt** | Intake progress bar not announced on change | `components/pbv/intake/IntakeShell.tsx:126-137` |
| 58 | **A8-alt** | "Sign all" stepper progress not announced | `components/pbv/sign/FormsStack.tsx:208-211` |
| 59 | **B2** | Scanner preview images not optimized (full-resolution blob URLs) | `components/DocumentScanner/DocumentScanner.tsx:99-113` |
| 60 | **B3** | PDF iframe previews have no lazy loading | `components/pbv/sign/SummaryDocReviewSign.tsx:181-187` |
| 61 | **B4** | `generate-forms` heavy synchronous PDF stamping on serverless main thread | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:165-169` |
| 62 | **B5** | All tenant pages are `'use client'` — no SSR for initial content | `app/pbv-full-app/[token]/*` |
| 63 | **B6** | `framer-motion` animations run unconditionally (no `prefers-reduced-motion`) | `app/pbv-full-app/[token]/page.tsx:5` |
| 64 | **C4** | No offline/network-status awareness | All client-side hooks |
| 65 | **D8** | `URL.createObjectURL` safe but needs CSP `blob:` allowance | `components/DocumentScanner/DocumentScanner.tsx:99-113` |
| 66 | **E4** | `FormsStack` recreates sorted array on every render | `components/pbv/sign/FormsStack.tsx:107-111` |
| 67 | **F3** | Magic links may break in in-app browsers | `app/api/pbv-full-app/signer/[member_token]/route.ts` |
| 68 | **F4** | Browser Back button during intake creates confusing history stack | `app/pbv-full-app/[token]/intake/[section]/page.tsx:120` |
| 69 | **H1** | No `prefers-reduced-motion` handling for animations | `app/pbv-full-app/[token]/page.tsx:5` |
| 70 | **H2** | Samsung Internet `getUserMedia` quirks not handled | `components/DocumentScanner/usePermissionPrompt.ts` |
| 71 | **H3** | Desktop Safari WebGL/canvas performance for signature pad | `components/pbv/sign/SignaturePadGate.tsx:134` |
| 72 | **H4** | Firefox `type="date"` input behavior | `components/pbv/intake/SectionHousehold.tsx:239` |
| 73 | **I5** | Migrations may not be backward-compatible for new environments | `supabase/migrations/` |

---

## Recommended Fix Order

1. **CRITICAL #1** — Wrap all bypassed routes in `withTenantContext` (or add `packet_locked` + `submitted_at` + rate limit checks).
2. **CRITICAL #2** — Fix `completeFormSigning` dead state: query `pbv_signature_events` as source of truth.
3. **CRITICAL #4** — Change `ON DELETE CASCADE` to `RESTRICT` on `pbv_signature_events` FKs.
4. **CRITICAL #5** — Fix dashboard `canSubmit`: exclude skipped forms from `formsTotal` or mark them complete.
5. **HIGH #14** — Collapse HOH `sign-form` to use `completeFormSigning` (unification PR).
6. **HIGH #15-#16** — Fix `signing_device` and `typed_name` while unifying.
7. **HIGH #18-#19** — Add `unsigned_pdf_hash` to `pbv_form_documents` and validate at finalize.
8. **HIGH #6-#7** — Add CSP and rate limiting (tenant routes).
9. **MEDIUM #37** — Fix `resolveFieldData` to throw on unknown `formId`.
10. **MEDIUM #36** — Fix `tryLoadPdf` to distinguish `ENOENT` from operational errors.

---

## Files Examined (6-lens audit)

- `app/api/t/[token]/pbv-full-app/route.ts`
- `app/api/t/[token]/pbv-full-app/forms/route.ts`
- `app/api/t/[token]/pbv-full-app/upload-summary/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/route.ts`
- `app/api/t/[token]/pbv-full-app/assisted-mode/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/route.ts`
- `app/api/t/[token]/pbv-full-app/additional-signers/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`
- `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts`
- `app/api/t/[token]/pbv-full-app/resume/route.ts`
- `app/api/t/[token]/pbv-full-app/action-items/route.ts`
- `app/api/t/[token]/pbv-full-app/signer-completed/route.ts`
- `app/api/t/[token]/pbv-full-app/summary-pdf/route.ts`
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts`
- `app/api/t/[token]/pbv-full-app/finalize/route.ts`
- `lib/pbv/applyDocumentTriggers.ts`
- `lib/pbv/documentTriggers.ts`
- `lib/pbv/age.ts`
- `lib/pbv/signing/completeForm.ts`
- `lib/pbv/signing/validateSignFormBody.ts`
- `lib/pbv/conditional-rules.ts`
- `lib/pbv/form-generation/field-mapping.ts`
- `lib/pbv/form-generation/source-pdfs.ts`
- `lib/pbv/form-generation/stamper.ts`
- `lib/pbv/finalizeValidation.ts`
- `lib/pbv/consent-text.ts`
- `lib/pbv/tenantEndpoint.ts`
- `lib/pbv/hooks/useDashboardState.ts`
- `lib/pbv/hooks/useSectionAutoSave.ts`
- `lib/pbv/hooks/useSigningCeremony.ts`
- `lib/pbv/hooks/useIntakeBootstrap.ts`
- `lib/idempotency.ts`
- `lib/memberFilter.ts`
- `lib/tenantFetch.ts`
- `lib/rateLimit.ts`
- `lib/pbv/magicLinkExpiry.ts`
- `middleware.ts`
- `next.config.js`
- `scripts/validate-env.ts`
- `supabase/migrations/20260515010000_pbv_form_documents.sql`
- `supabase/migrations/20260515020000_pbv_signature_events.sql`
- `supabase/migrations/20260521020000_finalize_pbv_application_fn.sql`
- `supabase/migrations/20260521090000_pbv_rls_lockdown.sql`
