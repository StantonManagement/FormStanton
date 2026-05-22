# Batch-Run Protocol — PBV Full-App Finalization (PRDs 55–61)

**Date:** 2026-05-20
**For:** a single Cascade/Windsurf session (adaptive mode, Opus 4.7) running PRDs 55–61 **one after another, autonomously, without stopping for human sign-off.**

**Read this once at the start of the session, before the first PRD prompt.** Every PRD prompt in this batch assumes these rules. They override the "wait for sign-off between PRDs" and "stop and ask" conventions used in earlier one-off PRDs.

---

## The prime directive: never block the chain

This is a continuous run. Alex will review decisions **after** the batch, not during it. So:

- **Never stop to ask a question.** When a PRD says a decision is ambiguous, **pick the most reasonable default, implement it, and log it** to `docs/fullApp-Plan/OPEN-DECISIONS.md` (see format below). Then keep going.
- **Never wait for sign-off** before starting the next PRD. Finish one (build + build report + commit), then start the next.
- The one exception — **hard stop and log, do not work around** — is if you cannot proceed safely (e.g. a build won't compile and you can't resolve it, or a change would require deleting/overwriting tenant data). In that case: commit what compiles, write the build report with the blocker, add it to OPEN-DECISIONS as a **BLOCKER**, and move to the next independent PRD.

## Run order

Run ascending: **55 → 56 → 57 → 58 → 59 → 60 → 61.** Dependencies are satisfied by this order (56 builds on 55; 58 on 57; 59 verifies 55/56/57/58; 61 is the closeout). PRD-60 (scanner) is independent and can run anytime, but ascending is fine.

## Branch strategy: ONE cumulative branch

- Work on a single branch off `main`: **`feat/pbv-full-finalization`**.
- **One commit per PRD**, message prefixed `PRD-NN: …`, so the branch history is per-PRD and individual PRDs can be reverted/cherry-picked.
- Do **not** branch each PRD off `main` separately — dependent PRDs (56 needs 55, 59 needs everything) must build on the accumulated work in this session.
- Open **one** PR at the end (`feat/pbv-full-finalization` → `main`, Ready for Review). Do not merge — Alex reviews.

## Prod database safety

- Several PRDs write data/schema changes (e.g. PRD-55 sets `pbv_form_templates.generation_enabled=false` for source-pending forms). **Write the migration/seed file and commit it. Do NOT apply it to the prod Supabase project (`lieeeqqvshobnqofcdac`) automatically.**
- Add every migration that needs applying to the **"Prod migrations to apply"** section of `OPEN-DECISIONS.md` so Alex applies them deliberately after review.
- Never run a destructive statement (DROP, DELETE, TRUNCATE, or an UPDATE without a tight WHERE) against any database in this run.

## Verification: three tiers — per-PRD, batch-boundary, deferred

**This replaces the old "build after every PRD" rule.** Running a full `npm run build` per PRD was the dominant cause of ~50-minute batches and gave false confidence (a clean build certifies "compiles + bundles," not "works"). The gate model now has three tiers:

- **Per-PRD gates (inline, before each commit — fast):**
  - `node ./node_modules/typescript/bin/tsc --noEmit` clean. (Never `npx tsc` — it hangs on Windows. See `docs/SHELL-PROTOCOL.md`.)
  - The PRD's **targeted** tests: `node ./node_modules/.bin/vitest run <path>`. (Never `npx vitest` — same Windows hang risk.) Targeted paths only, not the full suite.
  - **No full `npm run build` per PRD** — *unless* the PRD touches build-affecting surface (`next.config.js`, `middleware.ts`, a new top-level import, a server/client boundary). If it does, build that PRD and note why.

- **Batch-boundary gates (once, after the last PRD of the batch — before opening the PR):**
  - One full `npm run build` — clean.
  - One full `node ./node_modules/.bin/vitest run` if the batch's goal includes suite-wide stability.
  - **A thin critical-path smoke** on a preview deploy where one can be stood up: walk intake → generate-forms → sign → finalize and confirm no integration-seam break (the kind of defect unit tests can't see — e.g. the double-idempotency-wrap that returned 200 `{}`). If no preview is available in-session, list it as the first deferred gate with an explicit owner + date.
  - **A pattern-sweep:** before declaring the batch done, grep the touched files for the batch's own defect shapes (races, fail-open defaults, trusted input) to catch clones the per-PRD isolation missed. Log findings.

- **Deferred gates (do NOT block on these):** anything needing a deployed Vercel preview or a live device/browser walk beyond the smoke (iOS/Android camera matrix, RLS-applied checks, magic-link expiry walks). **List these in the build report under "Deferred runtime gates"** with an owner. Do not fail a PRD because a deploy-only gate couldn't run in-session.

**What each gate certifies (state it; don't over-trust green):** `tsc` = types. Targeted vitest = the touched files behave. Full build = compiles + bundles. Smoke = the critical path is wired correctly end-to-end. None of them certify accessibility, security headers, rate limiting, or adversarial-input handling — those are covered by the relevant PRD's own checks and the launch definition-of-done, not by these gates.

## Build report per PRD (this is the memory between PRDs)

After each PRD, before starting the next, write `docs/build-reports/NN-<slug>_build-report_2026-05-20.md` containing: what changed (files + commit SHA), static gates pass/fail, deferred runtime gates to verify later, decisions logged, and any PRD-57-style cross-PRD flags. This is how later PRDs (and Alex) recover context without re-reading the whole session.

## OPEN-DECISIONS.md format

Append an entry whenever you take a default on an ambiguous call, or hit a blocker:

```
### [PRD-NN] <short title>   — <DECISION | BLOCKER | MIGRATION-TO-APPLY>
- **Context:** what was ambiguous / what's needed.
- **Default taken:** what you did and why (or "none — blocked").
- **Reversible?** yes/no + how to change it later.
- **Needs Alex:** the specific question to resolve post-run.
```

## .git/config

It is **not** broken (verified 2026-05-20 — line 23 is a harmless tab line; git runs fine in both shells). If git genuinely errors, log it as a BLOCKER — do not "fix" config line 23.

---

## TL;DR for the session

1. Branch off `main` (one cumulative branch per batch).
2. For each PRD: read its prompt + PRD, implement, take-default-and-log on anything ambiguous, pass **per-PRD gates** (`tsc --noEmit` + targeted `vitest`, both via the direct binary — no `npx`, no full build unless build-surface touched), commit `PRD-NN: …`, write the build report, move on.
3. Write migrations but don't apply to prod — list them in OPEN-DECISIONS.
4. Defer deploy/device gates to the build report; don't block on them.
5. At the end (batch boundary): one full `npm run build`, the critical-path smoke + pattern-sweep, then one PR (don't merge) + a complete `OPEN-DECISIONS.md` for Alex.
