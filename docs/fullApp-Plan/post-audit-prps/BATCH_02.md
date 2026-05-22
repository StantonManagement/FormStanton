# BATCH 02 — Accessibility (PRP-006 … PRP-009)

You are an autonomous Claude Code session running **Batch 02** of a 5-batch PBV remediation: accessibility (keyboard signature fallback, modal focus management, stepper announcements, page landmarks). Run the four PRPs **in order**, one git commit each, without stopping for sign-off. Clean context; everything you need is in this file and the PRP files it names.

## Working directory & branch
- Run from the repo root.
- Ensure branch **`feat/pbv-post-audit-remediation`** is checked out (created by an earlier batch; create off `main` if missing). All batches share this one branch. Do **not** open a PR (Batch 05 does).

## Shell rules (inlined)
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`.**
- Tests: `node ./node_modules/.bin/vitest run <path>`. **Never `npx vitest`.** Targeted paths only.
- **No `npm run build` per PRP** (batch-boundary gate). None of this batch's PRPs are build-surface.
- No prod migration apply; no destructive SQL.

## PRPs in execution order
1. **PRP-006** (`PRP-006_signature-pad-keyboard-fallback-and-a11y.md`) — keyboard/typed signature fallback + sig-pad aria + canvas resize/DPR. *Depends on: none.*
2. **PRP-007** (`PRP-007_signing-modal-focus-and-announcements.md`) — modal focus trap/restore + aria-live + iframe lazy + dvh + scroll cue. *Depends on: none.* (Owns the two signing-modal files completely.)
3. **PRP-008** (`PRP-008_formsstack-stepper-announcements.md`) — stepper aria-live progress/errors + memoized sort. *Depends on: none.*
4. **PRP-009** (`PRP-009_landmarks-skiplink-and-status-a11y.md`) — `<main>`/skip-link at the layout + intake progress live region + status accessible name. *Depends on: none.*

No two PRPs in this batch write the same file. No cross-batch shared files in this batch.

## Per-PRP loop
For each PRP in order:
1. Read the PRP; note its **Outputs** (only files you may modify) and **Acceptance criteria**.
2. Implement only those files; on ambiguity take the documented default + note it.
3. Per-PRP gates: `tsc --noEmit` clean; targeted `vitest` green.
4. Commit `PRP-0NN: <slug>` (push if git healthy).
5. Write `docs/build-reports/PRP-0NN_<slug>_build-report_2026-05-21.md` (files+SHA, path, gates, deferred a11y runtime gates).
6. Next PRP.

## Batch-boundary gates (after PRP-009)
- One full `npm run build` → clean.
- Pattern-sweep the touched files for other static-text errors that need an `aria-live` region and any other modal/dialog lacking focus management. Record findings.
- Note: axe-core / screen-reader / iOS-dvh checks are **deferred runtime gates** (a later test PRP authors the axe harness) — enumerate them, do not run e2e as a blocking gate here.

## Done when
Four commits `PRP-006:`…`PRP-009:`; per-PRP gates green; boundary build clean; four build reports with deferred a11y verification (axe + NVDA/VoiceOver + iOS) enumerated. No PR.
