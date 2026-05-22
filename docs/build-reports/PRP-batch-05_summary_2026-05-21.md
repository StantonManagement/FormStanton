# Batch 05 — Compliance, Operations & Test Coverage Summary (PRP-018..022)

**Date:** 2026-05-21 / 2026-05-22 (boundary build)
**Branch:** `feat/pbv-post-audit-remediation`

## Per-PRP commits
| PRP | Slug | Commit | Per-PRP gates |
|-----|------|--------|---------------|
| 018 | consent-version-integrity-and-log-hygiene | `2618ad9` | tsc ✅ ; vitest 21/21 ✅ |
| 019 | data-lifecycle-and-audit-tamper-evidence | `cf8e83d` | tsc ✅ ; vitest 14/14 ✅ |
| 020 | in-app-browser-detection-and-csrf | `f070b12` | tsc ✅ ; vitest 15/15 ✅ |
| 021 | operational-readiness-runbook-and-migrations | `73e66ed` | tsc ✅ (docs+SQL only) |
| 022 | test-coverage-backfill | `8a7a176` | tsc ✅ ; vitest 5/5 ✅ (hook unit tests) |

## Batch-boundary gates
- **Full `npm run build`** — **clean.**
- **Critical-path smoke** = DEFERRED. No preview deploy is available in this environment; the smoke (intake → generate-forms → sign → finalize) lands as the first deferred gate. Owner: Alex / next preview deploy.

## Pattern sweep (PII/token log sites the redaction util should cover)
- `app/api/t/[token]/pbv-full-app/route.ts:296,588` — generic catch-all `console.error('PBV full-app GET/POST error:', error)`. `error` may carry tokens transitively if Supabase surfaces the URL. **Follow-up:** wrap with `redact(serializeError(error))`.
- `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts:85,244` — `[pbv-upload] start doc=… size=… mime=… revision=…` and `[pbv-upload] failed doc=… ms=… reason=…`. These don't carry tokens directly but the `reason` field is a storage-SDK message that may surface paths. **Follow-up:** wrap in `redact()`.
- `app/api/log/client-error/route.ts` — already redacted (PRP-018).

## Decisions logged (in OPEN-DECISIONS.md or in build reports)
- PRP-018: consent-version registry table seeded; `consent_text_version` rejected if not in DB allow-list (default per PRP).
- PRP-019: G4 audit hash chain DOCUMENTED as v1.1 gap per scope call; G3 endpoint + G5 policy doc shipped. `anonymized_at` column not added (sentinel-based idempotency).
- PRP-020: CSRF is in WARN mode (Phase 1). Phase 2 strict-403 flip + `tenantFetch` header forwarding = follow-up.
- PRP-021: `tenant_lookup` column set is INFERRED, not introspected. Migration is `IF NOT EXISTS`; prod unaffected.
- PRP-022: `KNOWN_PACKAGE_HASH` still `'UPDATE_ME'` (requires live preview run); refresh procedure documented in `docs/TESTING.md`.

## Cross-batch invariants preserved
- PRP-002 rate limiter on `tenantEndpoint.ts` — still present after PRP-020 layered CSRF logic. Confirmed via source-grep test in `prp020-csrf-inapp.test.ts`.

## Migrations to apply (committed only)
1. **`20260521110000_consent_versions.sql`** (PRP-018) — registry table + seed. Idempotent. Apply on prod via Supabase dashboard after review.
2. **`20260521120000_tenant_lookup_create_if_not_exists.sql`** (PRP-021) — LOW priority; prod is already in this state. Apply only on fresh clones.

## Deferred runtime gates (need a preview)
- Critical-path smoke (intake → generate-forms → sign → finalize).
- `consent_text_version: '2099-…'` POST → 400 `unknown_consent_version`.
- DELETE `/api/admin/pbv/full-applications/[id]/data` flow (RBAC, 400 confirm_required, 200 scrub, 200 idempotent re-run).
- Magic link inside Instagram → in-app warning shows; dismiss → continues.
- Mutating POST without `X-CSRF-Token` → still 200 (Phase 1) + `[csrf]` log line.
- All J2..J5 e2e/axe/load/visual specs once CI plumbing lands.

## Done
- Five commits `PRP-018:`…`PRP-022:` + their build reports on `feat/pbv-post-audit-remediation`.
- All per-PRP gates green.
- Boundary build clean.
- Two migrations committed only (listed above).
- Single PR opens next (per protocol).
