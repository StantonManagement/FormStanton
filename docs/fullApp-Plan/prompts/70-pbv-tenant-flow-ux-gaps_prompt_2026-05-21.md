# Windsurf Build Prompt — PRD-70: Tenant Flow UX Gaps (non-blocking polish)

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first (branch, default-and-log, static-vs-deferred gates). If running the 68→70 batch, also read `docs/fullApp-Plan/prompts/68-70-launch-hardening-batch-run_prompt_2026-05-21.md`.

Build from `docs/fullApp-Plan/70-pbv-tenant-flow-ux-gaps_prd_2026-05-21.md`. Read it next.

## Precondition — confirm against the audit + the PRD-67 conflict (do not skip)

This is **P3 polish** — the lowest-value PRD in the batch. Two gaps; one is partially a reversal of a shipped PRD-67 decision.

1. Confirm the two findings still hold in code: `intake/page.tsx` `handleStart` `console.error`s a failed unit PATCH then navigates anyway (`:144-156`); `documents/page.tsx` error fallback uses `window.location.reload()` (`:241`). Line numbers may have drifted — follow the code.
2. **Read the PRD-67 conflict (PRD §"Cross-PRD conflict").** PRD-67 deliberately KEPT `window.location.reload()` in the documents fallback as "an intentional retry, not navigation." Do **not** blanket-reverse it. Gap B is conditional and surgical.
3. The dead magic-link "contact office" button is **intentional and out of scope** — do not add it.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening`. No per-PRD branch.
- One commit: `PRD-70: tenant flow UX gaps (unit-save feedback; conditional documents refetch)`.
- **Push after commit.**

## Shell

- `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; `npx vitest run <new spec>` green. Never `npx tsc` (hangs on Windows — `docs/SHELL-PROTOCOL.md`).
- No DB change. No migration.

---

## Step-by-step

### Step 0 — Read ground truth
Read `intake/page.tsx` (`handleStart`, ~`:135-157`) and `documents/page.tsx` (error block, ~`:232-249`). Confirm whether a refetch fn (`fetchDocuments()` or equivalent) exists in the documents page and what error sources it can recover. Find the existing inline-error/toast pattern in the tenant flow (do NOT add a new toast library).

### Step 1 — Gap A (the real fix): unit-save failure feedback
In `intake/page.tsx` `handleStart`:
- Add an error state; on `!res.ok` and in `catch`, set a tenant-readable message ("We couldn't save your unit — please try again") and render it near the unit field / Start button using the existing pattern. Keep the `console.error`.
- **Do not navigate on failure** — move `router.push` so it runs only on success (or when there was no unit change). The tenant stays on the landing and can retry Start.

### Step 2 — Gap B (conditional, surgical, lowest value): documents error recovery
- If **no** clean refetch fn exists, or it can't reliably recover the data-fetch error: **make no change**, keep PRD-67's `reload()`, and say so in the build report. Done.
- If a clean refetch exists: split "Try again" by error source — data-fetch `error` branch → call the refetch; `state.status==='error'` (bootstrap) and `pageView.kind==='error'` → keep `window.location.reload()` (PRD-67's intentional behavior). Do not touch the bootstrap path.

### Step 3 — Static gates + build report + commit + push
Gates below. Build report at `docs/build-reports/70-pbv-tenant-flow-ux-gaps_build-report_2026-05-21.md` — explicitly record whether Gap B was implemented or skipped, and why. Commit `PRD-70: …`. **Push.**

---

## Files to modify

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/intake/page.tsx` | Gap A — failed unit save surfaces an inline error; navigate only on success |
| `app/pbv-full-app/[token]/documents/page.tsx` | Gap B *(conditional)* — data-fetch error → refetch; keep `reload()` for bootstrap errors |
| tests (new) | Gates 1–2 (vitest/component) |

## Files NOT to touch

- The documents-flow nav/view-all structure PRD-67 built (beyond the surgical Gap B change).
- The dead magic-link screen (no contact-office button — intentional).
- `tests/e2e/**`, `.github/workflows/**` — no Playwright/e2e.
- `.git/config` — leave it; log a BLOCKER if git genuinely errors.

---

## Verification gates (per PRD-70)

**Static (must pass before commit):**
- **Gate 1:** unit PATCH `!ok`/throw → error message renders AND `router.push` is NOT called; success → `router.push` IS called.
- **Gate 2 (only if Gap B implemented):** data-fetch error "Try again" calls the refetch (not `reload`); bootstrap error still uses `reload()`. If skipped, state so in the report — no test needed.
- **Gate 3:** `tsc --noEmit` + `npm run build` clean; new vitest tests green.

**Deferred to the post-run verification pass (manual Chrome walk — NOT Playwright; list in build report, do NOT block):**
- **Gate R1:** force a unit PATCH failure; tenant sees the error and is not navigated onward.
- **Gate R2 (if Gap B done):** documents data-fetch error recovers via refetch (no full reload); bootstrap error still hard-reloads.

## What "done" looks like

1. `PRD-70: …` commit on `feat/pbv-launch-hardening`, **pushed**.
2. Static gates green; no Playwright/e2e added or run.
3. Unit-save failure is visible to the tenant and never silently carried into intake.
4. Gap B either implemented surgically (data-fetch branch only) or deliberately skipped — with the reason in the build report. PRD-67's intentional `reload()` for bootstrap errors is preserved.

## What NOT to do

- **Do not stop to ask** — default-and-log.
- Do not blanket-replace `window.location.reload()` — PRD-67 kept it on purpose; change only the data-fetch branch, and only if it's a clean win.
- Do not add a new toast library. Do not add the dead-magic-link contact button.
- Do not refactor the documents flow or intake landing beyond the two findings.
- **Do not add or run Playwright/e2e; do not touch `tests/e2e/**` or `.github/workflows/**`.**
- Do not use `npx tsc`. Do not "fix" `.git/config`.

## Reporting back (in the build report)

- Commit SHA; pushed.
- Gap A: the error-surfacing + navigate-only-on-success change.
- Gap B: implemented (how the branches were split) or skipped (why) — explicitly note PRD-67's reload was preserved for bootstrap errors.
- Decisions/defaults logged to OPEN-DECISIONS (O1–O2).
- Deferred runtime gates (R1–R2) for the post-run manual pass.
