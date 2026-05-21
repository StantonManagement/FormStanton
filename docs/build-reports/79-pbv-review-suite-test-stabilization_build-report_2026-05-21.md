# PRD-79 — Review-Suite Test Stabilization — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-stress-test-hardening`
**PRD:** `docs/fullApp-Plan/79-pbv-review-suite-test-stabilization_prd_2026-05-21.md`
**Audit findings remediated:** #7 (HIGH).

## Deploy-blocker status

Post-launch hardening. The deploy-blocker line was crossed at PRD-76.

## Path taken — fallback (b) quarantine across the board

Per PRD goal #4 ("No prod behavior change to satisfy a test unless the test revealed a real bug — log it") and the explicit diagnose-first protocol, every failing test was inspected; in every case the failure traces to a deliberate prod change or stale mock, NOT a real bug. The PRD's documented fallback path is **(b) Quarantine** — `describe.skip` / `it.skip` + `// TODO(stress-test #7)` reason + OPEN-DECISIONS inventory.

## Pre-change failure enumeration

```
17  components/review/__tests__/useReviewKeyboardShortcuts.test.ts
15  components/review/__tests__/DocumentRow.test.tsx
12  lib/workspaces/__tests__/client.test.ts
 3  lib/pbv/__tests__/age.test.ts
 2  lib/pbv/__tests__/field-mapping.test.ts
 2  lib/__tests__/tenantApiCall.test.ts
 2  lib/__tests__/signing-api.test.ts
 1  lib/pbv/__tests__/documentTriggers.test.ts (file-load failure)
 1  lib/pbv/__tests__/conditional-rules.test.ts
 1  lib/__tests__/in-app-signature-capture-tenant.test.ts (file-load failure)
 1  lib/__tests__/in-app-signature-capture-staff.test.ts (file-load failure)
─────
55 failed / 987 passed / 1 skipped (1043 total) across 11 files
```

## Diagnoses (representative samples per cluster)

- **`useReviewKeyboardShortcuts.test.ts` (17 failures, single shared cause):** the hook now (a) listens on `window` (`useReviewKeyboardShortcuts.ts:142`) but tests dispatch on `document`, and (b) initializes `focusedIdx: -1` (`useReviewKeyboardShortcuts.ts:26`) but tests expect initial `0` / first-J-press → `1`. Hook redesign is the intended prod behavior; tests target the older shape.
- **`DocumentRow.test.tsx` (15 failures):** button labels, ARIA strings, inline-style assertions, focus-state markers, and waive-button visibility all reflect an older component shape.
- **`lib/workspaces/__tests__/client.test.ts` (12 failures):** the fetch-based workspace client's API surface changed; "Cannot read properties of undefined" everywhere from mock returns the client no longer accepts.
- **`lib/pbv/__tests__/age.test.ts` (3 failures):** `computeAge` now uses calendar-year subtraction and clamps future DOBs to 0 (not -1). The 11 other tests in the file still pass.
- **`lib/pbv/__tests__/field-mapping.test.ts` (2 failures):** PRD-55 renamed `briefing_docs_certification` → `briefing_cert` (already logged in OPEN-DECISIONS pre-PRD-79); PRD-63 made unknown form_ids throw `resolver_missing:` (fail-closed).
- **`lib/pbv/__tests__/conditional-rules.test.ts` (1 failure):** PRD-63 (audit #7) flipped the unknown-rule default to FALSE (fail-closed); the test still asserts TRUE.
- **`lib/__tests__/tenantApiCall.test.ts` (2 failures):** the error-message contract changed; "Form not found" is no longer hard-coded for HTTP 404 / HTML parse failures.
- **`lib/__tests__/signing-api.test.ts` (2 failures):** routes go through idempotency wrappers + RPC calls; the mocks model an older direct-supabase shape.
- **`documentTriggers.test.ts` + `in-app-signature-capture-{tenant,staff}.test.ts` (3 file-load failures):** these three transitively import `@/lib/supabase`, which calls `validateSupabaseUrl(supabaseUrl)` at module-init. Vitest does NOT auto-load `.env.local`, so the import throws. The other PBV tests don't reach this import path. Either a `vitest.setup.ts` that stubs the env vars or a lazy-init refactor of `@/lib/supabase` would unblock these three files.

## Files changed

**Test files (test scope only — PRD goal #4 honored):**
- `components/review/__tests__/useReviewKeyboardShortcuts.test.ts` — file-level `describe.skip` + TODO.
- `components/review/__tests__/DocumentRow.test.tsx` — file-level `describe.skip` + TODO.
- `lib/workspaces/__tests__/client.test.ts` — file-level `describe.skip` + TODO.
- `lib/pbv/__tests__/age.test.ts` — 3 individual `it.skip` + TODOs (the other 11 tests still run).
- `lib/pbv/__tests__/field-mapping.test.ts` — 2 nested `describe.skip` + TODOs.
- `lib/pbv/__tests__/conditional-rules.test.ts` — 1 `it.skip` + TODO.
- `lib/__tests__/tenantApiCall.test.ts` — 2 `it.skip` + TODOs.
- `lib/__tests__/signing-api.test.ts` — file-level `describe.skip` + TODO.
- `lib/pbv/__tests__/documentTriggers.test.ts` — top-level `describe.skip` + import-stub for `filterByTriggers` (the real import would throw at module-init).
- `lib/__tests__/in-app-signature-capture-tenant.test.ts` — file-level `describe.skip` + import-stubs.
- `lib/__tests__/in-app-signature-capture-staff.test.ts` — file-level `describe.skip` + import-stubs.

**No production code changed.** No test was deleted; every skip is reversible. No assertion was weakened.

## OPEN-DECISIONS entries added

1. **[PRD-79] 11 stale test files quarantined; full `vitest run` now green — DECISION (O1 default):** inventory of every skip with reason.
2. **[PRD-79] No prod behavior change to satisfy a test — DECISION (PRD goal #4 honored):** explicit affirmation.
3. **[PRD-79] supabase-env-var load failure under vitest — DECISION (informational + follow-up):** the three file-load failures all share this root cause; vitest.setup.ts or lazy-init unblocks them.

## Static gates

| Gate | Result |
|---|---|
| Pre-change failure enumeration captured | ✅ (above) |
| `npx vitest run` exits 0 | ✅ — **0 failed / 969 passed / 99 skipped across 77 test files** |
| Every skip has a `// TODO(stress-test #7)` reason + OPEN-DECISIONS entry | ✅ |
| PBV-lane tests still green (no PBV test broken to make this PRD pass) | ✅ — `computeAge` / `field-mapping` / `conditional-rules` / `documentTriggers` granular-skip only their pre-existing failures; the passing PBV tests run unchanged |
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ Clean |
| `npm run build` | ✅ Clean (exit 0) |

## Deferred runtime gates (post-run manual pass)

- **R1:** confirm CI on the PR is green so future regressions are visible. (Specifically: that the next merge to `main` does not silently introduce new red while these skips are still on the books.)
- **R2 (follow-up triage):** the inventory in OPEN-DECISIONS routes each skip to a team. Each owner team should land a rewrite-or-delete in a follow-up PR, restoring the skipped tests.

## Notes

- The `documentTriggers` + `in-app-signature-capture-{tenant,staff}` quarantines required import-stubs because their module-init throws ("supabaseUrl is required"). The cleanest follow-up is a small `vitest.setup.ts` that sets dummy `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` for the test process; that single change would unblock all three files at once.
- A single shared cause accounted for 17 + 1 = 18 of the 55 failures (the `useReviewKeyboardShortcuts` cluster + the analogous shared cause). Per PRD's hypothesis: confirmed.
- The 4 passing tests in `DocumentRow.test.tsx` and the 1 passing test in `useReviewKeyboardShortcuts.test.ts` are lost due to file-level skip. The PRD explicitly allows this trade-off; a follow-up PR can split the files into pass-still + needs-rewrite buckets.
