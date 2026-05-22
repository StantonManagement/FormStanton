# Batch 03 — Resilience & State Correctness Summary (PRP-010..013)

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`

## Per-PRP commits
| PRP | Slug | Commit | Per-PRP gates |
|-----|------|--------|---------------|
| 010 | unsaved-work-guards | `5bb35b2` | tsc ✅ ; vitest 6/6 ✅ |
| 011 | fetch-retry-partial-failure-and-offline | `a3186bf` | tsc ✅ ; vitest 23/23 ✅ |
| 012 | autosave-and-ceremony-recovery | `2f9265a` | tsc ✅ ; vitest 11/11 ✅ |
| 013 | idempotency-finalize-atomicity-and-error-surfacing | `92289ad` | tsc ✅ ; vitest 9/9 ✅ |

## Batch-boundary gates
- **Full `npm run build`** — **clean.** (`CRON_SECRET` dummy env in use.)
- Pattern-sweep results below.

## Pattern sweep
- **Other `Promise.all` fail-all-on-one spots** beyond `useDashboardState`:
  - `app/api/t/[token]/pbv-full-app/documents/route.ts:152` — signed-URL `Promise.all` over per-document storage requests. A single signed-URL failure rejects the whole list. Follow-up: `Promise.allSettled` + per-document null on failure.
  - `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts:38` — similar shape. PRD-84 already converted this to skip + log per failure but kept `Promise.all`; worth converting to `allSettled` so the "failed" count is observable.
- **Unscoped idempotency lookups:** none found — `lib/idempotency.ts` is the single caller of `tenant_idempotency_keys` and is already scoped (#9).

## Decisions logged (in OPEN-DECISIONS or in build reports)
- PRP-010 hosted the intake guard at the section page (PRP allowed either; layout host would require new context plumbing). Documented + Batch 04's PRP-015 will layer on without removing.
- PRP-010 signing-page guard wires the listener for `pbv:signing-in-flight` but the dispatchers in `SummaryDocReviewSign` / `useSigningCeremony` are a follow-up since those files are out of Outputs.
- PRP-011 `slices` field made optional to preserve type compat with `stepGates.ts`.
- PRP-011 `OnlineStatusProvider` mount + dashboard banner are follow-ups (layout / dashboard pages out of Outputs).
- PRP-012 surfaces `restoredFromBackup` rather than auto-applying — page-side merge is a follow-up.
- PRP-013 all three items verified-correct; no migration.

## Deferred runtime gates (need a preview)
- Type intake → close tab → native dialog; wait for `saved` → close → no dialog.
- Trigger network blip mid-`sign-form` → backoff retries with the SAME idempotency key → server side collapses (one signature event).
- Toggle offline → banner visible (once follow-up wires it) + submit disabled.
- Refresh the signing modal mid-ceremony → no re-capture required (signatureImagePath rehydrates).
- Simulate event-write failure mid-finalize → application stays unsubmitted.
- Replace a source PDF with an unreadable file → ERROR log appears (not silent).
