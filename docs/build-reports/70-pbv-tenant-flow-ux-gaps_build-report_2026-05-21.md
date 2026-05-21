# Build Report — PRD-70: Tenant Flow UX Gaps (non-blocking polish)

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening` (continues 62–69)
**Commit:** `4c43cfe` (pushed to `origin/feat/pbv-launch-hardening`)
**Status:** ✅ Static gates green. Gap A built. **Gap B built (clean refetch exists)** — see decision below.

---

## Premise — confirmed in code (no live-DB audit needed for P3 UX-only work)

Both findings still hold (line numbers drifted slightly from the PRD; followed
the code per the prompt):

- **Gap A — `intake/page.tsx:135-157`:** `handleStart` PATCHes the unit; on
  `!res.ok` only `console.error`s (`:144-147`), in `catch` only `console.error`s
  (`:148-150`), and unconditionally calls `router.push` at `:156`. Confirmed.
- **Gap B — `documents/page.tsx:232-249`:** error block at `:232` covers
  `state.status === 'error'` (bootstrap), `error` (data-fetch), and
  `pageView.kind === 'error'`. "Try again" at `:241` uses
  `window.location.reload()` (PRD-67's intentional retry).
- **Refetch-availability check (Gap B precondition):** `fetchDocuments` is
  defined at `documents/page.tsx:68`; clears local `error` state at `:71` and
  re-runs the documents fetch. It cleanly recovers data-fetch errors → Gap B
  IS a clean win, so implemented.
- **Dead magic-link "contact office" button:** intentionally out of scope.
  Not touched.

PRD-67's intentional reload behavior preserved exactly for bootstrap and
`pageView.kind === 'error'` paths.

---

## What changed

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/intake/page.tsx` | **Gap A.** Added `unitError` state + EN/ES/PT `save_failed` copy in `unitCopy`. Refactored `handleStart` to delegate the navigate-vs-error decision to `attemptUnitSaveAndDecide`. On failure: sets `unitError`, leaves the tenant on the landing (no `router.push`), re-enables the Start button. On success or no-change: navigates as before. Inline error rendered above the Start button in the footer with `role="alert"`. |
| `app/pbv-full-app/[token]/documents/page.tsx` | **Gap B.** Added `chooseDocumentsRetryAction` import. Split the "Try again" handler by error source — data-fetch-only errors call `fetchDocuments(language)`; bootstrap + `pageView.kind === 'error'` keep `window.location.reload()` (PRD-67's intentional retry, preserved verbatim). Bootstrap wins over data-fetch when both are set. |
| `lib/pbv/tenant-flow-handlers.ts` (new) | Two pure decision helpers (no DOM, no router): `attemptUnitSaveAndDecide` (Gap A) and `chooseDocumentsRetryAction` (Gap B). Extracted so the decisions are unit-testable without component setup. |
| `lib/pbv/__tests__/tenant-flow-handlers.test.ts` (new) | 11 vitest unit tests — 5 for Gap A (ok/!ok/throw/no-change/empty), 6 for Gap B (each branch + multi-source priority). |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | Appended O1 (Gap A halt+inline-error default) and O2 (Gap B implemented surgically; PRD-67 reload preserved for bootstrap). |

**No new toast library.** The error renders via an inline `<p role="alert">`
matching the same inline-error pattern already used elsewhere in the tenant
flow (e.g. the bootstrap error branch in `intake/page.tsx:167-172` uses the
identical `text-sm text-[var(--error)]` style).

**No DB changes. No migration.**

---

## Static gates — all green ✅

| Gate | Result | Notes |
|---|---|---|
| Gate 1: unit PATCH `!ok`/throw → error rendered AND `router.push` NOT called; success → `router.push` IS called | ✅ | 5 vitest tests in `attemptUnitSaveAndDecide` block cover ok / !ok / throw / no-change / empty paths; the handler wires the helper's `navigate` flag directly to whether `router.push` runs |
| Gate 2 (Gap B implemented): data-fetch error → refetch (not `reload`); bootstrap error still uses `reload()` | ✅ | 6 vitest tests in `chooseDocumentsRetryAction` block covering every branch + multi-source priority (bootstrap and pageView always win over data-fetch) |
| Gate 3: `node ./node_modules/typescript/bin/tsc --noEmit` clean | ✅ | exit 0, no output |
| Gate 3: `npm run build` clean | ✅ | Next.js production build completed; manifest unchanged |
| Gate 3: new vitest spec green | ✅ | `npx vitest run lib/pbv/__tests__/tenant-flow-handlers.test.ts` → 1 file, 11 tests passed |

No Playwright/e2e added or run. `tests/e2e/**` and `.github/workflows/**`
untouched.

---

## Deferred runtime gates (manual Chrome walk — NOT Playwright)

Listed for the post-run verification pass. **Do not block on these in-session.**

- **Gate R1 (Gap A):** force a unit PATCH failure (offline / 500 / DevTools
  network override) on the intake landing; confirm
  (a) the EN/ES/PT error message renders above the Start button,
  (b) the Start button is re-enabled and the tenant remains on the landing,
  (c) on a successful retry, navigation proceeds to the resume section /
  `household`.
- **Gate R2 (Gap B):** trigger a documents data-fetch error (e.g. block the
  `/api/t/{token}/pbv-full-app/documents?language=…` request);
  (a) confirm "Try again" recovers via refetch (no full reload — SPA state
  preserved, search params intact),
  (b) trigger a bootstrap error (kill the bootstrap endpoint instead);
  confirm "Try again" still triggers a full `window.location.reload()` per
  PRD-67's intentional behavior.

---

## Decisions logged to OPEN-DECISIONS

- **O1 — Gap A halt+inline-error:** failure halts navigation and surfaces a
  tenant-readable EN/ES/PT message. Reversible by flipping the early return.
- **O2 — Gap B implemented surgically:** PRD-67's `reload()` is preserved
  for bootstrap and pageView errors; only the data-fetch-only branch is now
  a refetch. `chooseDocumentsRetryAction` makes the routing explicit and
  testable.

---

## Cross-PRD flags

PRD-67's intentional `window.location.reload()` for bootstrap errors is
**preserved exactly** — the only behavior change is in the data-fetch-only
branch, which PRD-67's audit explicitly tagged as "acceptable but could
`fetchDocuments()` instead." This implementation follows that audit
recommendation surgically without reversing the load-bearing PRD-67 decision.

No interaction with PRD-68 (signer forms route) or PRD-69 (storage bucket
migration). All three PRDs in this batch are independent and the final
commit history is one commit per PRD on `feat/pbv-launch-hardening`.
