# Batch Run Prompt — PRDs 68 → 70 (tenant-audit hardening)

**Date:** 2026-05-21
**For:** a single Windsurf/Cascade session running PRDs 68, 69, 70 one after another, autonomously, no stopping for sign-off.
**Base rules:** `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` governs everything (branch, default-and-log, write-not-apply migrations, static-vs-deferred gates). Read it once before PRD-68. This prompt adds the run order, the audit-gating, and the **no-Playwright** rule for this batch.

---

## Source

These three PRDs come from the tenant-facing audit (2026-05-21): one P0 code bug, one P1 migration-drift fix, one P3 UX-polish. Each PRD + prompt is self-contained:

| PRD | Sev | What | Prompt |
|---|---|---|---|
| 68 | P0 | Member-token signer forms route selects 3 non-existent columns → every magic-link signer load 500s | `prompts/68-pbv-member-signer-forms-route-fix_prompt_2026-05-21.md` |
| 69 | P1 | `pbv-signatures` / `form-submissions` / `pbv-applications` have no creation migration (drift; fresh env 404s) | `prompts/69-pbv-storage-bucket-creation-migrations_prompt_2026-05-21.md` |
| 70 | P3 | Silent unit-save failure; conditional documents error-refetch | `prompts/70-pbv-tenant-flow-ux-gaps_prompt_2026-05-21.md` |

## Run order

Ascending, by severity and independence: **68 → 69 → 70.** They are independent (no PRD depends on another's output), but 68 is the P0 and goes first; 70 is P3 polish and goes last. PRD-70 depends on PRD-67's already-shipped documents flow (not on 68/69).

## Branch / commits

- One branch: **`feat/pbv-launch-hardening`** (continues PRDs 62–67 — do NOT start a new branch; verify it's checked out and ahead per the PRD-62 OPEN-DECISIONS entry).
- **One commit per PRD**, prefixed `PRD-NN: …`. **Push after each.**
- No PR open/merge in this prompt — Alex decides. (If the batch protocol's "one PR at the end" is wanted, open it Ready-for-Review, do not merge.)

## ⚠ Audit-gating — every PRD confirms the finding before building

A **live-DB verification audit** (Supabase MCP, project `lieeeqqvshobnqofcdac`) is/was running in a separate session, read-only. Before each PRD, **confirm its premise against the audit report**, then build:

- **PRD-68:** audit Section 1 confirms the 3 columns are absent from `pbv_form_documents` and the select 500s. If the audit says the columns exist or the route was already fixed → **STOP**, log, skip.
- **PRD-69:** audit Section 2 gives the live `storage.buckets` config + policies. The migration **reproduces the live config** — do not invent values. A bucket genuinely **missing on prod** is a **BLOCKER** (real prod gap), not a write-a-migration task → stop + log.
- **PRD-70:** code-level; confirm the two findings still hold and respect PRD-67's intentional `reload()` (do not blanket-reverse). 

If the audit report isn't available, each PRD says how to confirm directly from code/migrations — do that instead of guessing. Never build on an unconfirmed premise.

## ⚠ Verification — STATIC ONLY. No Playwright / no e2e for this batch.

Per Alex (2026-05-21): **do not run, add, or modify Playwright/e2e tests in this batch** — that suite is the source of most workflow/CI failures and is not the bar here.

- **Gates that count:** `node ./node_modules/typescript/bin/tsc --noEmit` clean, `npm run build` clean, and the **vitest unit/component** tests each PRD specifies. Use `node ./node_modules/typescript/bin/tsc`, never `npx tsc` (hangs on Windows — `docs/SHELL-PROTOCOL.md`).
- **Do NOT** run `npm run test:e2e`. **Do NOT** add specs under `tests/e2e/**`. **Do NOT** edit `.github/workflows/**` (including `e2e-tenant-flow.yml`).
- The **`E2E Tenant Flow` GitHub check is known-failing / Playwright-flaky** and is **not** the merge bar for this batch. Do not try to "fix" it, do not chase its red X, do not let it block. (It also carries a Node-20-action deprecation — a separate, tracked item; out of scope here.)
- **Runtime verification = a manual Chrome walk in the post-run pass** (Cowork/Alex), not Playwright. Each PRD lists its deferred runtime gates (R1/R2) in its build report; do not block on them.

## Prod DB safety

- PRD-69 writes a migration. **Write + commit; do NOT apply to prod.** It's a no-op on prod anyway (`ON CONFLICT DO NOTHING`). Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md` with the "no-op on existing prod; required for fresh environments" note.
- PRDs 68 and 70 are **code-only — no migration.**
- Never run a destructive statement against any DB. The audit session is read-only; this build session writes no SQL to prod.

## Decisions & blockers

- Default-and-log per `BATCH-RUN-PROTOCOL.md` — never stop to ask. Append to `OPEN-DECISIONS.md`.
- Hard-stop-and-log (BLOCKER) only if: a build won't compile and you can't resolve it, a change would require deleting/overwriting tenant data, or the audit shows a bucket genuinely missing on prod (PRD-69).

## Build report per PRD

After each: `docs/build-reports/NN-<slug>_build-report_2026-05-21.md` — files + commit SHA, static gates pass/fail, deferred runtime (Chrome-walk) gates, decisions logged, and for PRD-70 whether Gap B was implemented or skipped.

---

## TL;DR for the session

1. Confirm `feat/pbv-launch-hardening` is checked out (continues 62–67).
2. For each PRD **68 → 69 → 70**: read its prompt + PRD → **confirm the finding against the audit** → implement → default-and-log on anything ambiguous → **static gates only (tsc + build + vitest; NO Playwright)** → commit `PRD-NN: …` → **push** → write the build report → next.
3. PRD-69's migration: write + commit, **do not apply**, list in OPEN-DECISIONS.
4. Ignore the `E2E Tenant Flow` red check — not the bar; don't touch `tests/e2e/**` or `.github/workflows/**`.
5. Defer all runtime checks to the post-run manual Chrome walk. Don't block on them.
