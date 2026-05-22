# PRP-018 — Consent-Version Integrity & Log Hygiene

**Assigned batch (per BATCH_PLAN.md):** 05
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **G1** (High), **G2** (High), **D5** (Medium).
**Depends on:** None — operates on current `main`. (Touches only the consent-version region of `sign-summary`; leaves its existing assisted-by/summary-signing logic intact.)
**Inputs (read before editing):** `lib/pbv/consent-text.ts` (~10 `CONSENT_TEXT_VERSION`), `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` (the consent-version write region), `app/api/log/client-error/route.ts` (~34 `x-forwarded-for`), and the upload/tenant log lines the audit named (`documents/[doc_row_id]/upload/route.ts:84,252`, `pbv-full-app/route.ts:296`).
**Outputs (write — the ONLY files this PRP may modify/create):** new `consent_versions` migration (commit-only), `lib/pbv/consent-text.ts`, `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` (consent-version region only), new `lib/log/redact.ts`, `app/api/log/client-error/route.ts`, new test(s).
**Acceptance criteria:**
- A `consent_versions` table (unique version + active flag) exists (migration committed, not applied); `sign-summary` validates the version against it and rejects unknown versions.
- A redaction util strips `tenant_access_token`/`magic_link_token` (URLs + bodies) and known PII keys before logging; applied in `client-error` (+ the named upload/tenant lines).
- `client-error` derives client IP from `x-vercel-ip`/leftmost-non-private `x-forwarded-for`, not the raw header.

## Context (self-contained)
Consent version is a TS constant (`CONSENT_TEXT_VERSION`) stored into `pbv_signature_events.consent_text_version` with no DB integrity check, so a code bump leaves old rows unverifiable. Server logs (esp. `client-error`, which logs full URLs containing the `tenant_access_token`) can leak tokens/PII. `client-error` reads `x-forwarded-for` directly (spoofable behind a misconfigured proxy). This is a HACH-bound flow, so audit-trail integrity + privacy matter.

## Problem
- **G1:** consent version not DB-enforced. **G2:** PII/token in logs. **D5:** `X-Forwarded-For` trusted.

## Goals
1. **G1:** `consent_versions` table (unique `version`, `active`, `effective_from`) seeded with known versions; `sign-summary` validates the submitted/constant version against it and rejects unknown (migration commit-only).
2. **G2:** `lib/log/redact.ts` `redact(input)` removing token query-params/keys + PII keys; apply in `client-error` and the named upload/tenant log lines.
3. **D5:** IP via `x-vercel-ip` / leftmost-non-private `x-forwarded-for` helper in `client-error`.

## Non-goals
- No full `console.*` sweep of the whole codebase (record remaining sites as a follow-up; this PRP ships the util + fixes the worst offender). No change to assisted-by/summary-signing logic beyond the consent check. No new logging framework. Do not edit files outside the Outputs list.

## Implementation
1. `consent_versions` migration + seed; validate in `sign-summary` (consent region only).
2. `lib/log/redact.ts`; apply in `client-error` + named lines.
3. IP-derivation helper in `client-error`.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run lib/log/__tests__/redact* lib/pbv/__tests__/consent*` — `redact` strips a token from a URL + a PII key from a body; unknown consent version rejected, valid passes; IP helper prefers `x-vercel-ip`.
- **No full build per PRP** unless the migration changes a typed table the app reads (then build).
- **Deferred runtime gates:** apply the `consent_versions` migration on a preview → unknown version blocked; trigger a client-error → no token/PII in the Vercel log.

**Default for ambiguity:** reject unknown consent version at sign-time (cleaner); confirm no legacy flow submits an unseeded version. Remaining log sites → follow-up.
