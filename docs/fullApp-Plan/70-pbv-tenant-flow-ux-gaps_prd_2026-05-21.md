# PRD-70 — Tenant Flow UX Gaps (non-blocking polish)

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (continues the launch-hardening batch after PRD-69)
**Status:** Draft — ready for build
**Severity:** P3 — non-blocking UX polish. No data-integrity or dead-end risk. Lowest priority in the batch.
**Depends on:** PRD-67 (built the documents-flow nav + the error fallback this PRD reconsiders). Runs **after** 67/68/69.
**Source:** Tenant-facing code-level audit 2026-05-21 ("Minor UX gaps (non-blocking)"). Confirmed in code 2026-05-21.

---

## Problem Statement

The audit's non-blocking UX inventory surfaced two real gaps and one intentional non-issue:

1. **Silent unit-save failure (Gap A).** On the intake landing, if the unit `PATCH` fails, navigation proceeds and the user sees nothing — the error is `console.error`'d only (`app/pbv-full-app/[token]/intake/page.tsx:144-152`). A tenant whose unit didn't save has no idea; they continue into intake believing their unit is set. [Confirmed in code 2026-05-21]

2. **Full-reload error recovery (Gap B).** The documents page error fallback's "Try again" button calls `window.location.reload()` (`app/pbv-full-app/[token]/documents/page.tsx:241`), a full document reload, where a targeted refetch could recover without discarding SPA state. The audit notes this as **"acceptable but could `fetchDocuments()` instead."** [Confirmed in code 2026-05-21]

3. **Dead magic-link has no "contact office" button — intentional, NOT in scope.** The expired/not-found magic-link screen has no contact-office affordance because the link is dead by design. Excluded as a non-goal.

### ⚠ Cross-PRD conflict (read before touching Gap B)

**PRD-67 deliberately KEPT `window.location.reload()` in this exact fallback as "an intentional retry, not navigation"** (PRD-67 prompt Step 1; PRD-67 PRD Phase 1: *"Keep `window.location.reload()` in the error fallback — that's an intentional retry, not navigation."*). The line moved from `:193` (PRD-67's reference) to `:241` after PRD-67 shipped its view-all/nav work — same code, drifted line number.

So Gap B is **partially a reversal of a shipped, deliberate decision.** It is the lowest-value item here and must be handled surgically (see Implementation), not as a blanket "replace reload with refetch." If switching is not a clean win, **leave PRD-67's reload as-is** and say so in the build report.

---

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) | Fix shape |
|---|---|---|---|
| A | Unit PATCH failure is silent (console-only); navigation proceeds | `intake/page.tsx:144-152` (`handleStart`: `if (!res.ok) { … console.error }`, then `router.push` at `:156` regardless) | surface an inline error/toast; **do not** auto-navigate on failure (let the tenant retry) |
| B | Error fallback uses `window.location.reload()` where a refetch could recover | `documents/page.tsx:240-245` ("Try again" → `window.location.reload()`); error branch at `:232-249` covers both `state.status==='error'` (bootstrap) and a data-fetch `error` | for the **data-fetch** error branch only, wire to a refetch fn **if one exists and cleanly recovers**; keep `reload()` for the bootstrap/`state` error branch (PRD-67's intentional behavior) |

The documents error branch (`:232`) is a single block covering three sources: `state.status==='error'` (bootstrap/auth), a `error` string (data fetch), and `pageView.kind==='error'`. A blanket refetch can't recover a bootstrap failure — which is exactly why PRD-67 kept the full reload. The surgical move is to split the recovery action by error source, not to globally swap `reload()` for `fetchDocuments()`.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Intake landing `handleStart` | `intake/page.tsx:135-157` | PATCHes unit; on `!res.ok` or catch, `console.error` only; `router.push` to the section runs unconditionally at `:156` |
| Documents error fallback | `documents/page.tsx:232-249` | one block; "Try again" → `window.location.reload()` (`:241`); PRD-67 intentionally kept it |
| Refetch availability | `documents/page.tsx` | confirm whether a `fetchDocuments()` (or equivalent) exists and what it recovers; **Gap B depends on this** |
| Toast/inline-error pattern | tenant flow components | confirm the existing pattern before adding UI (do NOT introduce a new toast library) |

---

## Goals

1. A failed unit save **surfaces to the tenant** (inline error or existing-pattern toast) instead of being silent, and does **not** silently navigate the tenant onward as if it succeeded.
2. *(Conditional — only if a clean win)* documents **data-fetch** errors recover via a targeted refetch instead of a full page reload, **without** reversing PRD-67's intentional `reload()` for bootstrap-level errors.

## Non-goals

- **No** "contact office" button on the dead magic-link screen (intentional — the link is dead).
- **No** new toast/notification library — reuse the existing pattern or a minimal inline message.
- **No** broader refactor of the documents flow or the intake landing (PRD-67 owns the documents flow; only the two findings above are in scope).
- **No** blanket replacement of `window.location.reload()` — PRD-67's reload stays for bootstrap errors.
- **No** Playwright/e2e; no change to `tests/e2e/**` or `.github/workflows/**`.

---

## Implementation phases

### Phase 1 — Unit-save failure feedback (Gap A) — the real fix

In `intake/page.tsx` `handleStart` (`:135-157`):
- Add an error state (e.g. `unitError`). On `!res.ok` (and in the `catch`), set a tenant-readable message ("We couldn't save your unit — please try again") and render it near the unit field / Start button using the **existing** inline-error or toast pattern in the codebase. Keep the `console.error` for diagnostics.
- **Do not `router.push` when the save failed.** Move the navigation so it runs only on success (or when there was no unit change to save). The tenant stays on the landing with the error and can retry Start. (Default per D1/O1.)
- Keep `unitSaving` UX as-is (the button already reflects saving state via `:138,151`).

### Phase 2 — Documents error recovery (Gap B) — conditional, surgical, lowest value

**Only if it's a clean win.** In `documents/page.tsx` error block (`:232-249`):
- First confirm a refetch function exists (e.g. `fetchDocuments()`) and determine which error sources it can recover. If there is **no** clean refetch, or it can't recover the data-fetch error reliably, **make no change** — leave PRD-67's `reload()` and record the decision in the build report. (D2)
- If there is a clean refetch: split the "Try again" action by error source — for the **data-fetch** `error` branch, call the refetch; for `state.status==='error'` (bootstrap) and `pageView.kind==='error'`, keep `window.location.reload()` (PRD-67's intentional behavior). Do not change the bootstrap path.

---

## Verification / test plan

Static only. **No Playwright, no e2e — do not run `npm run test:e2e`, do not add specs under `tests/e2e/**`.**

### Static (must pass before commit)
- **Gate 1 (unit-save failure surfaces + no nav):** a component/unit test of the intake landing asserts that when the unit PATCH returns `!ok` (or throws), an error message renders **and** `router.push` is **not** called. On success, `router.push` **is** called.
- **Gate 2 (Gap B, only if implemented):** a test asserts the data-fetch error "Try again" calls the refetch fn (not `window.location.reload`), while the bootstrap (`state.status==='error'`) branch still uses `reload()`. If Gap B is skipped, state so in the build report; no test required.
- **Gate 3 (build):** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; `vitest run` green for the new test(s). Use `node ./node_modules/typescript/bin/tsc`, never `npx tsc`.

### Deferred to the post-run verification pass (manual Chrome walk — NOT Playwright; list in build report, do NOT block)
- **Gate R1:** force a unit PATCH failure (e.g. offline / 500) on the landing; confirm the tenant sees the error and is not navigated onward.
- **Gate R2 (if Gap B done):** trigger a documents data-fetch error; confirm "Try again" recovers via refetch without a full reload; confirm a bootstrap error still hard-reloads.

---

## Open questions

- **O1 (Gap A — halt vs proceed):** On unit-save failure, **halt** navigation with an inline error + retry (default) vs proceed-with-toast (warn but continue). Default: **halt + inline error** — a wrong/unsaved unit shouldn't be carried silently into intake. Reversible. [Inference]
- **O2 (Gap B — touch it at all?):** PRD-67 kept the reload intentionally. Default: make the **surgical, data-fetch-only** change **only if** a clean refetch exists; otherwise **skip** and keep PRD-67's behavior. Log either way. [Inference]

## Decisions

- **D1:** Unit-save failure shows an inline error and does **not** auto-navigate (tenant retries Start). Reversible.
- **D2:** Gap B is conditional and surgical — change only the data-fetch error branch, keep `window.location.reload()` for bootstrap errors (PRD-67's intentional retry); **skip entirely** if no clean refetch exists. Do not reverse PRD-67 wholesale.
- **D3:** No new toast library; reuse the existing inline-error/toast pattern.
- **D4:** Dead magic-link "contact office" button stays out of scope (intentional).

---

## Files expected to change

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/intake/page.tsx` | Gap A — unit-save failure surfaces an inline error; navigation only on success |
| `app/pbv-full-app/[token]/documents/page.tsx` | Gap B *(conditional)* — data-fetch error "Try again" → refetch; keep `reload()` for bootstrap errors |
| tests (new) | Gates 1–2 (vitest/component; **not** Playwright) |

If anything outside this list needs changing, take the safe default and log it rather than expanding scope.
