# PBV Full-App Stress Test Report

**Date:** 2026-05-21  
**Reviewer:** Cascade  
**Scope:** Full PBV tenant-facing lane, admin API, cron jobs, database schema, build/test suite  
**Method:** Static code analysis, schema inspection (Supabase MCP), test execution, build verification, audit report cross-reference.

---

## CRITICAL — Fix Before Launch

### 1. Cron routes are unprotected when `CRON_SECRET` is unset
- **Where:** `@/app/api/cron/pbv-deferred-reminders/route.ts:111-118`, `@/app/api/cron/cleanup-idempotency-keys/route.ts`, `@/app/api/cron/notifications/scheduled-sends/route.ts`
- **What's wrong:** All three use `if (secret) { check Bearer }` — if the env var is missing, the entire auth block is skipped and **anyone can trigger the cron**.
- **Attack:** A bot could spam deferred reminders, flood tenants with SMS/email, or trigger idempotency cleanup mid-ceremony.
- **Fix:** Change to mandatory auth — return 401 if `CRON_SECRET` is unset, not just if the header mismatches.

### 2. Document upload race condition creates orphan storage files
- **Where:** `@/app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:147-157`
- **What's wrong:** The non-replace path adds `.eq('status', 'missing')` to the UPDATE, but does not check how many rows were affected. If two concurrent uploads race for the same doc, both read `status='missing'`, both increment revision, both try storage upload with `upsert: false`. One storage upload fails with 409, rolls back its DB update. The other succeeds. But the "loser" already incremented revision in its local variable — the DB is in an inconsistent state relative to the storage path.
- **Fix:** Check `count` on the update response. If 0 rows affected, abort before storage upload.

### 3. Two PBV tables have wide-open RLS
- **Where:** Database policies on `pbv_document_requirements` and `pbv_rejection_reason_templates`
- **What's wrong:** Both grant `public` role `ALL` access with `qual=true` — any anonymous client can read/write.
- **Fix:** Replace with `service_role` only (mirrors every other PBV table).

---

## HIGH — Fix in First Post-Launch Patch

### 4. `generate-forms` first-generation race condition
- **Where:** `@/app/api/t/[token]/pbv-full-app/generate-forms/route.ts:181-211`
- **What's wrong:** Two concurrent first-generation requests read `existingVersion=null`, both choose `version=1, upsertOnUpload=true`, both upload to the same path. The second silently overwrites the first's unsigned PDF. Signers of the overwritten bytes will hash a different PDF than what's stored.
- **Current mitigation:** PRD-66 versioning handles the `>=1 signer` case well. The **zero-signer first-generation** case is still exposed.
- **Fix:** Use a `uuid` suffix or timestamp on the first-generation path, or wrap the read-decide-upload in a DB advisory lock keyed by `(appId, formId, language)`.

### 5. Tenant can sign/finalize while staff has packet locked
- **Where:** `@/lib/pbv/tenantEndpoint.ts:42-47`
- **What's wrong:** `withTenantContext` only checks `submitted_at`. It does **not** check `packet_locked`. The document upload route checks it locally, but `sign-form`, `generate-forms`, `finalize`, and `intake/complete` do not. If staff locks a packet mid-tenant-flow, the tenant can still sign and submit.
- **Fix:** Add `packet_locked` to the `withTenantContext` select and return 409 `packet_locked` when true.

### 6. Missing input validation on sign-form routes
- **Where:** `@/app/api/t/[token]/pbv-full-app/sign-form/route.ts:38-57` and `@/app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:45-58`
- **What's wrong:** No validation that `form_document_id`, `signer_member_id`, `ceremony_id` are valid UUIDs. No validation that `device_owner` is one of `['self','hoh_device','staff_assisted']`.
- **Impact:** Invalid UUIDs propagate to Supabase and fail with opaque errors. A crafted `device_owner` value bypasses the `CHECK` constraint and gets stored as-is (the DB constraint catches it, but the error is ugly).
- **Fix:** Add `zod` or manual regex validation before processing.

### 7. 55 pre-existing test failures
- **Where:** `components/review/__tests__/useReviewKeyboardShortcuts.test.ts` (majority of failures)
- **Status:** Confirmed pre-existing by the PRD-62 build report. The PBV-specific tests all pass.
- **Impact:** Red CI masks real regressions.
- **Fix:** Stabilize or skip the failing review-suite tests.

---

## MEDIUM — Known Risks, Monitor

### 8. Magic-link expiry uses server-local `new Date()`
- **Where:** `@/app/api/pbv-full-app/signer/[member_token]/route.ts:35` and `@/app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:40`
- **What's wrong:** Expiry comparison uses `new Date()` on the server. If the server clock drifts or the tenant is in a distant timezone, expiry could behave unexpectedly.
- **Fix:** Use `Date.now()` consistently and store expiry in UTC with explicit timezone handling.

### 9. Cron reminder date drifts from application creation
- **Where:** `@/app/api/cron/pbv-deferred-reminders/route.ts:35-48`
- **What's wrong:** `getNextReminderDate` uses `new Date()` as the base, not the application's `intake_submitted_at` or `created_at`. If the cron job is delayed or restarts, the cadence slips relative to the tenant's actual start date.
- **Fix:** Compute days-since-intake from `app.intake_submitted_at`.

### 10. No distributed lock on cron jobs
- **Where:** `@/app/api/cron/pbv-deferred-reminders/route.ts`
- **What's wrong:** Vercel can invoke the cron from multiple regions simultaneously. No `pg_advisory_lock` or `SELECT … FOR UPDATE` prevents duplicate runs.
- **Fix:** Acquire a DB advisory lock at the start of the handler; skip if lock unavailable.

### 11. Missing DB index on `pbv_signature_events.document_hash`
- **What's wrong:** `finalizeValidation.ts` Check 5 queries `document_hash` by `form_document_id`, but there's no index covering `(form_document_id, document_hash)`. At scale, finalize becomes slow.
- **Fix:** `CREATE INDEX idx_pbv_signature_events_hash ON pbv_signature_events(form_document_id, document_hash);`

---

## POSITIVE FINDINGS — What's Hardened Well

| Item | Status | Evidence |
|---|---|---|
| `finalize_pbv_application` SQL function is race-safe | ✅ | `WHERE submitted_at IS NULL` guard prevents double-submit |
| `send-to-hach` atomic lock | ✅ | `.eq('packet_locked', false)` on UPDATE |
| `reopen` atomic unlock | ✅ | `.eq('packet_locked', true)` on UPDATE |
| Admin routes check RBAC | ✅ | `userHasPermission(sessionUser, 'pbv-full-applications', 'send_to_hach')` |
| `X-Assisted-By` session verification | ✅ | PRD-64 fixed audit #4 — verifies against `getSession()` |
| `completeFormSigning` deduplication | ✅ | DB unique constraint `(form_document_id, signer_member_id)` |
| Unsigned PDF versioning | ✅ | PRD-66 `generation_version` + `-vN.pdf` paths |
| Hash mismatch blocks finalize | ✅ | PRD-62 Check 5 in `finalizeValidation.ts` |
| TypeScript compilation | ✅ | `tsc --noEmit` exit 0, clean |
| PBV-specific unit tests | ✅ | All PBV tests pass (47/47 in the lane) |

---

## Launch Decision Matrix

| Gate | Status | Blocker? |
|---|---|---|
| TypeScript compiles | ✅ Clean | No |
| PBV unit tests | ✅ 47/47 green | No |
| Full test suite | ⚠️ 55 pre-existing failures in non-PBV code | No (but fix soon) |
| `tsc` + build | ✅ Clean | No |
| CRON_SECRET protection | ❌ Missing on all cron routes | **YES — before deploy** |
| RLS on `pbv_document_requirements` | ❌ Wide open | **YES — before deploy** |
| Document upload race | ❌ Orphan file risk | **YES — before deploy** |
| `packet_locked` tenant gate | ❌ Not enforced in `withTenantContext` | Fix in v1.1 |
| `generate-forms` first-gen race | ❌ Edge case, rare | Fix in v1.1 |

---

## Immediate Action Items

1. **Set `CRON_SECRET`** in prod + preview env, and make the check mandatory (remove the `if (secret)` guard).
2. **Fix RLS** on `pbv_document_requirements` and `pbv_rejection_reason_templates` — change `public` to `service_role`.
3. **Harden document upload** — check affected-row count on the guarded UPDATE before storage upload.
4. **Add `packet_locked` check** to `withTenantContext`.
5. **Validate UUIDs and enums** in both sign-form routes.

---

## Files Examined

- `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md`
- `docs/build-reports/62-pbv-signing-unification-and-audit-integrity_build-report_2026-05-21.md`
- `docs/build-reports/63-pbv-failclosed-generation-defaults_build-report_2026-05-21.md`
- `docs/build-reports/64-pbv-compliance-and-finalize-hardening_build-report_2026-05-21.md`
- `docs/build-reports/65-pbv-government-id-required-first_build-report_2026-05-21.md`
- `docs/build-reports/66-pbv-regenerate-lock-and-hardening_build-report_2026-05-21.md`
- `docs/build-reports/67-pbv-tenant-review-edit-and-document-management_build-report_2026-05-21.md`
- `docs/build-reports/68-pbv-member-signer-forms-route-fix_build-report_2026-05-21.md`
- `docs/build-reports/69-pbv-storage-bucket-creation-migrations_build-report_2026-05-21.md`
- `docs/build-reports/70-pbv-tenant-flow-ux-gaps_build-report_2026-05-21.md`
- `docs/build-reports/72-pbv-pt-display-name-parity_build-report_2026-05-21.md`
- `docs/build-reports/73-pbv-tenant-flow-polish_build-report_2026-05-21.md`
- `docs/build-reports/61-pbv-finalization-e2e-gate_build-report_2026-05-20.md`
- `docs/build-reports/59-pbv-trilingual-e2e_build-report_2026-05-20.md`
- `docs/build-reports/58-pbv-documents-clarity-and-gating_build-report_2026-05-20.md`
- `lib/pbv/finalizeValidation.ts`
- `lib/pbv/tenantEndpoint.ts`
- `lib/pbv/signing/completeForm.ts`
- `lib/idempotency.ts`
- `app/api/t/[token]/pbv-full-app/sign-form/route.ts`
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- `app/api/t/[token]/pbv-full-app/finalize/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`
- `app/api/pbv-full-app/signer/[member_token]/route.ts`
- `app/api/admin/pbv/full-applications/[id]/assisted-session/route.ts`
- `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`
- `app/api/admin/pbv/full-applications/[id]/reopen/route.ts`
- `app/api/cron/pbv-deferred-reminders/route.ts`
- `tests/e2e/pbv-finalization-acceptance.spec.ts`
- Supabase schema: all `pbv_*` tables, indexes, RLS policies (via MCP)
- `docs/fullApp-Plan/OPEN-DECISIONS.md`
