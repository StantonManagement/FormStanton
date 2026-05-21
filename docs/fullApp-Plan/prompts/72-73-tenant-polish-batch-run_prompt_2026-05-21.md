# Batch Run Prompt — PRDs 72 → 73 (tenant polish: PT names + hub UX)

**Date:** 2026-05-21
**For:** a single Claude Code session running PRDs 72 then 73 one after another, autonomously, no stopping for sign-off.
**Base rules:** `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` governs everything (default-and-log, write-not-apply migrations, static-vs-deferred gates). Read it once before PRD-72. This prompt sets the run order, the branch, and the **static-only / no-Playwright** rule for this batch.

> **Note on the dropped PRD-71.** A planned PRD-71 (insurance_settlement / cd_trust_bond tenant-attested prompt) was investigated and **dropped**: that behavior already ships — both doc types are already intake-attested (`SectionAssets.tsx:50-54`), seeded as conditional upload slots in `form_document_templates`, and gated by `lib/pbv/documentTriggers.ts:107-115`. PRD-55b's "disable generation" for these two is a no-op (they don't exist in `pbv_form_templates`). Do NOT build an attestation/upload feature for them. This batch is **72 + 73 only.**

---

## Source

| PRD | Sev | What | PRD file |
|---|---|---|---|
| 72 | P3 | Portuguese form display-name parity (en/es-only read sites + NULL `display_name_pt` backfill) | `docs/fullApp-Plan/72-pbv-pt-display-name-parity_prd_2026-05-21.md` |
| 73 | P3 | Hub progress indicator (U7) + leave-with-missing confirmation (U11) | `docs/fullApp-Plan/73-pbv-tenant-flow-polish_prd_2026-05-21.md` |

Both are self-contained and grounded in current code (file:line refs inside each PRD). They are independent of each other.

## Run order

Ascending: **72 → 73.** No dependency between them; ascending is fine.

## Branch / commits

- **One branch off `main`: `feat/pbv-tenant-polish`.** These build on the 55–70 stack, so branch off `main` **after** `feat/pbv-launch-hardening` has merged. If that branch is **not** yet merged when you start, branch off `feat/pbv-launch-hardening` instead and note it in the first build report.
- **One commit per PRD**, prefixed `PRD-NN: …`. Push after each.
- No PR open/merge in this prompt — Alex decides. (If you open one, Ready-for-Review, do not merge.)

## ⚠ Verification — STATIC ONLY. No Playwright / no e2e for this batch.

Per Alex (standing rule): **do not run, add, or modify Playwright/e2e tests.** That suite is the source of most CI failures and is not the bar here.

- **Gates that count:** `node ./node_modules/typescript/bin/tsc --noEmit` clean, `npm run build` clean, and the **vitest** unit tests each PRD specifies. Use `node ./node_modules/typescript/bin/tsc`, never `npx tsc` (hangs on Windows — `docs/SHELL-PROTOCOL.md`).
- **Do NOT** run `npm run test:e2e`, add specs under `tests/e2e/**`, or edit `.github/workflows/**`. The `E2E Tenant Flow` check is known-flaky and is not the merge bar — ignore its red X.
- **Runtime verification = a manual Chrome walk in the post-run pass** (Cowork/Alex), not Playwright. Each PRD lists its deferred R1/R2 gates; record them in the build report, do not block on them.

## Prod DB safety

- **PRD-72 writes a backfill migration** (`<ts>_prd72_form_display_name_pt_backfill.sql`, best-effort `display_name_pt`). **Write + commit; do NOT apply to prod.** Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`, and list every PT value there for native review (PRD-72 O1).
- **PRD-73 is code-only — no migration.**
- Never run a destructive statement against any DB. This session writes no SQL to prod.

## Decisions & blockers

- Default-and-log per `BATCH-RUN-PROTOCOL.md` — never stop to ask. Append to `OPEN-DECISIONS.md` using its entry format.
- The defaults are already chosen in each PRD's "Open questions" (72: best-effort PT, backfill all rows; 73: 4-task progress, `beforeunload`-based U11). Follow them; log if you diverge.
- Hard-stop-and-log (BLOCKER) only if a build won't compile and you can't resolve it, or a change would require deleting/overwriting tenant data.

## Build report per PRD

After each: `docs/build-reports/NN-<slug>_build-report_2026-05-21.md` — files + commit SHA, static gates pass/fail, deferred Chrome-walk gates, decisions logged. For PRD-72, include the full list of PT display-name values written (so Alex can route them for native review).

---

## TL;DR for the session

1. Branch `feat/pbv-tenant-polish` off `main` (or off `feat/pbv-launch-hardening` if that hasn't merged yet — note which).
2. For each PRD **72 → 73**: read its PRD → implement per its "Implementation" + "Files expected to change" → default-and-log anything ambiguous → **static gates only (tsc + build + vitest; NO Playwright)** → commit `PRD-NN: …` → push → write the build report → next.
3. PRD-72's backfill migration: write + commit, **do not apply**, list it (and every PT value) in OPEN-DECISIONS.
4. Ignore the `E2E Tenant Flow` red check; don't touch `tests/e2e/**` or `.github/workflows/**`.
5. Defer all runtime checks to the post-run manual Chrome walk. Don't block on them.
