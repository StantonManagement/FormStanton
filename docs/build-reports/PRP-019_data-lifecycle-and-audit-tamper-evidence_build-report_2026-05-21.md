# PRP-019 — Data Lifecycle & Audit Tamper-Evidence — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `cf8e83d7f79683d377a01e6f2107c6f380d7b1a1`
**Findings:** Angle-2 **G3** (endpoint), **G5** (policy). **G4 documented as v1.1 gap** per scope call.

## Files changed
- `app/api/admin/pbv/full-applications/[id]/data/route.ts` *(new)* — admin DELETE for PII anonymization.
- `docs/data-retention-policy.md` *(new)* — three-layer retention policy.
- `lib/__tests__/prp019-data-lifecycle.test.ts` *(new)* — 14 tests.

## Path taken (defaults logged)
- **G4 chain documented, not implemented.** PRP-019 explicitly called this a scope question; the default was "document + design, ship G3+G5." The design is in `docs/data-retention-policy.md` (migration + insert hook + finalize verifier + backfill).
- **No new schema for G3.** I chose to mark already-anonymized rows by sentinel (`head_of_household_name === '[ANONYMIZED]'`) rather than add an `anonymized_at` column — avoids yet another migration during this batch. Migration can be added later if a separate timestamp is needed for audit/reporting.
- **Storage objects are tombstoned, not deleted.** The route nulls the path columns and sets `signature_image_path` to `[ANONYMIZED]`, but the actual bucket objects remain. The Storage-lifecycle cron is the documented v1.1 follow-up — separating the concerns lets us run the policy now without risking accidental object deletes.
- **Idempotency via sentinel check** — re-running DELETE on an already-scrubbed application is a 200 no-op.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/__tests__/prp019-data-lifecycle.test.ts` — **14 pass / 0 fail / 2.38 s.**

## Deferred runtime gates
- On a preview, anonymize a test application via
  `curl -X DELETE 'https://<preview>/api/admin/pbv/full-applications/<id>/data' -H 'Content-Type: application/json' -d '{"confirm":"ANONYMIZE"}'`
  with a session cookie that has `pbv_full_applications:delete`. Verify
  (a) `head_of_household_name === '[ANONYMIZED]'`, (b) audit events still readable,
  (c) re-run returns `{ already_anonymized: true }`.
- Same call without the permission → 403.
- Same call with wrong/missing body → 400 `confirm_required`.

## Open decisions
- Retention period (HACH counsel) — logged in the policy doc as TBD.
- Storage-lifecycle cron — designed in the doc; build is v1.1.
- G4 audit hash chain — designed in the doc; build is v1.1 per scope call.
