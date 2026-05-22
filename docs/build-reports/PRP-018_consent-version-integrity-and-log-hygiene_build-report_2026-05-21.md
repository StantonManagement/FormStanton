# PRP-018 — Consent-Version Integrity & Log Hygiene — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `2618ad9a7fcfa4931b103dbda5def942a6ccbb54`
**Findings closed:** Angle-2 **G1**, **G2** (primitive + worst-offender), **D5**.

## Files changed
- `supabase/migrations/20260521110000_consent_versions.sql` *(new, MIGRATION-TO-APPLY)* — registry table + seed.
- `lib/pbv/consent-text.ts` — `KNOWN_CONSENT_VERSIONS` + `isKnownConsentVersion`.
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` — consent-version guard (consent region only; assisted-by + summary-signing logic untouched).
- `lib/log/redact.ts` *(new)* — `redact()`, `redactUrlString()`, `clientIpFromHeaders()`.
- `app/api/log/client-error/route.ts` — payload through `redact()`; IP via the new helper.
- `lib/log/__tests__/redact.test.ts` *(new)* — 13 tests.
- `lib/pbv/__tests__/prp018-consent-version.test.ts` *(new)* — 8 tests.

## MIGRATION-TO-APPLY
- `supabase/migrations/20260521110000_consent_versions.sql` — committed only. Idempotent (`ON CONFLICT (version) DO NOTHING`). Alex applies on prod (`lieeeqqvshobnqofcdac`) via Supabase dashboard / CLI after review.

## Path taken (defaults logged)
- **Reject unknown consent version at sign-time** (the PRP's documented default). No legacy submitter exists today: every code path uses the `CONSENT_TEXT_VERSION` constant which is in the seed.
- **App-side allow-list mirrors the DB table** rather than calling Supabase from `sign-summary` to verify on every request. The allow-list is a fast local short-circuit; the table is the canonical source-of-truth long-term. Bump procedure documented in the file header.
- **Redaction is conservative.** Replaces known sensitive keys + URL query-params; does NOT free-text scan (no NLP). PRP allowed either approach.
- **`client-error` is the worst-offender wrap site.** Other named lines (`documents/[doc_row_id]/upload/route.ts:84,252`, `pbv-full-app/route.ts:296`) — the util is available; wrapping each call site is a small follow-up that keeps this PRP in-scope.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/log/__tests__/redact.test.ts lib/pbv/__tests__/prp018-consent-version.test.ts` — **21 pass / 0 fail / 2.55 s.**

## Deferred runtime gates
- Apply the migration on preview → `SELECT * FROM consent_versions` returns the seeded row.
- POST `sign-summary` with `consent_text_version: '2099-01-01-vx'` → 400 `{ code: 'unknown_consent_version' }`.
- Trigger a client-error with a `url` containing `?tenant_access_token=abc` → Vercel log line shows `tenant_access_token=%5BREDACTED%5D`.
- `curl -H 'x-vercel-forwarded-for: 1.2.3.4, 9.9.9.9'` to `/api/log/client-error` → log line records `ip: '1.2.3.4'`.

## Follow-ups
- Wrap the other named log sites (`pbv-full-app/route.ts:296`, `documents/[doc_row_id]/upload/route.ts:84,252`) with `redact()` to silence any token / PII leak there.
- When `CONSENT_TEXT_VERSION` is bumped: (1) add row to consent_versions migration, (2) add to `KNOWN_CONSENT_VERSIONS`, (3) bump the constant.
