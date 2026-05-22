# Build Prompt — PBV Adjacent-Errors Hardening Batch (PRDs 80–84) — Claude Code

You are **Claude Code** running an **autonomous batch** of five PRDs that remediate the findings in
`docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (findings **A1–A12**). Work through them in order, one commit each, without stopping for sign-off.

**Read first, in this order:**
1. `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` — governs default-and-log, prod-migration safety, static-vs-deferred gates, the `.git/config` non-issue. The rules below extend it; the same rules apply to this batch.
2. `docs/SHELL-PROTOCOL.md` — shell rules. Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, **never `npx tsc`** (hangs on Windows).
3. This prompt (run order + file-ownership map + the prerequisites + the baked-in corrections).
4. Each PRD, immediately before you build it.

---

## ⛔ Prerequisites — do not start until these are in your base branch

This batch **builds on top of** earlier work and edits some of the **same files**. Before the first PRD, confirm your base branch already contains:

- **The double-wrap idempotency fix** (`prompts/signing-capture-idempotency-doublewrap_prompt_2026-05-21.md`): `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` must already call `withTenantContext` directly (no outer `withIdempotency`). PRD-80 adds validation **inside** that corrected handler.
- **PRDs 74–79** (`feat/pbv-stress-test-hardening`): in particular
  - **PRD-76** edits `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` — PRD-83 (A11) edits a *different region* of that same file and must layer on PRD-76's version.
  - **PRD-77** creates `lib/pbv/signing/validateSignFormBody.ts` — PRD-80 reuses its UUID/enum primitives.
  - **PRD-78** edits `app/api/pbv-full-app/signer/[member_token]/route.ts` and `…/sign-form/route.ts` — PRD-82 layers `packet_locked` + typed-error changes on PRD-78's version.

**Verify, then act:** open the three shared files and confirm they already carry the prior changes (single-wrap signature/capture; PRD-76's generate-forms edits; PRD-78's signer edits; PRD-77's `validateSignFormBody.ts` exists). **If they do not, halt and tell Alex — do not re-implement 74–79 or the double-wrap fix here.** This batch assumes they are present.

**Branch:** create one cumulative branch off the base that contains the prerequisites above:
**`feat/pbv-adjacent-errors-hardening`**. One commit per PRD (`PRD-NN: …`) so each can be reverted/cherry-picked. Open **one** PR at the end (Ready for Review, **do not merge** — Alex reviews).

---

## Why this is five PRDs (file-ownership — do not cross these lines)

Each PRD owns a **disjoint set of files**; no two PRDs in this batch edit the same file. Stay inside your current PRD's set. If you think you need a file owned by another PRD (or by 74–79 / the double-wrap fix), **default-and-log** instead of reaching across.

| PRD | Owns (edits) | Findings |
|---|---|---|
| 80 — Summary-signing ceremony hardening | `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`, `app/api/t/[token]/pbv-full-app/signature/capture/route.ts`, (iff it shares the gap) `app/api/pbv-full-app/signer/[member_token]/signature/capture/route.ts` | A1, A5, A6 |
| 81 — Storage write-races round 2 | `app/api/t/[token]/pbv-full-app/signatures/route.ts`, `app/api/t/[token]/documents/[documentId]/route.ts` | A2, A3 |
| 82 — Member-token signer round 2 | `app/api/pbv-full-app/signer/[member_token]/route.ts`, `…/sign-form/route.ts`, `…/forms/route.ts`, `lib/pbv/signing/completeForm.ts` | A4, A12 |
| 83 — Concurrency & clock correctness | `lib/idempotency.ts`, `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts`, **summary-PDF region only of** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | A7, A10, A11 |
| 84 — Observability & path-safety | `app/api/t/[token]/pbv-full-app/events/route.ts`, `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts` | A8, A9 |

**Cross-PRD / cross-batch dependencies (run order respects them):**
- **80 after the double-wrap fix** — it adds validation inside the corrected single-wrap `signature/capture` handler. Do not re-introduce the outer `withIdempotency`.
- **82 after PRD-78** — layers `packet_locked` + typed-error on PRD-78's version of the two signer files. `completeForm.ts` change is **additive** (`errorCode`) so the tenant `sign-form` route (PRD-77) keeps compiling — verify it does.
- **83 after PRD-76** — A11 edits the summary-PDF region of `generate-forms`, a different region from PRD-76's form-document logic. Do **not** touch PRD-76's region.
- **80 reuses PRD-77's `validateSignFormBody` primitives** — import, do not duplicate a divergent regex.

---

## Run order

**80 → 81 → 82 → 83 → 84.**

**Deploy-blocker line:** the before-deploy findings from the new audit are cleared once **80 (A1) and 81 (A2/A3)** are committed. 82–84 are post-launch hardening. Run the whole batch, but make the build report **flag clearly when the deploy-blocker line is crossed (after 81)**.

> **A2 severity conflict — surface, don't silently decide.** The audit's findings section tags A2 (signatures POST race) CRITICAL; its Launch Decision Matrix demotes it to v1.1. PRD-81 builds the fix regardless. In the build report, flag the A2 deploy-gate question for Alex — do not assert one or the other as settled.

---

## Corrections baked into the PRDs (do not re-derive from the audit text)

- **A2 vs A3 phasing** — both built in PRD-81; A3 is the matrix's before-deploy "legacy paths" item, A2 is the CRITICAL-vs-v1.1 conflict above.
- **A6 second route** — PRD-80 checks the member-token `signature/capture` route too; apply the guard only **iff** it shares the gap, and log the finding.
- **A12 additive** — `completeFormSigning` gets an *added* `errorCode`; the existing `error` string stays so PRD-77's tenant caller is unaffected. Confirm every call site before changing the return type.
- **A7 / A11 are clock/race analogues** of PRD-78 #8 and PRD-76 #4 respectively — reuse that reasoning; A7 is a one-line epoch comparison, not a `withIdempotency` refactor.
- **No migrations expected** in this batch — these are code-only fixes. If you conclude a migration is genuinely required, **stop and log it** as a `MIGRATION-TO-APPLY` in OPEN-DECISIONS (commit-only, never applied); do not add one silently.

---

## Per-PRD loop

For each PRD `NN` in `80 81 82 83 84`:
1. Read `docs/fullApp-Plan/NN-pbv-…_prd_2026-05-21.md`.
2. Confirm the prerequisite files for that PRD carry their prior-batch changes (see dependencies). If not, halt-and-log.
3. Implement **only** that PRD's file set. Take the PRD's **preferred** path; if it can't be validated in-session, take its documented **fallback** and log the choice in `docs/fullApp-Plan/OPEN-DECISIONS.md` (format: `### [PRD-NN] <title> — <DECISION|BLOCKER|MIGRATION-TO-APPLY>`).
4. Pass the PRD's **static gates** before committing (global gates below).
5. **One commit:** `PRD-NN: <slug>` (e.g. `PRD-80: summary-signing ceremony hardening`). Push after commit if the git index is healthy; if `git` errors in the sandbox, leave the commit for Alex's native Windows terminal and note it (the index corrupts from the sandbox — see memory/INFLIGHT).
6. Write `docs/build-reports/NN-pbv-…_build-report_2026-05-21.md`: files changed + SHA, preferred-vs-fallback path taken + why, static gates pass/fail, deferred runtime gates, OPEN-DECISIONS entries.
7. Move to the next PRD.

---

## Global rules

**Shell / type-check (see `docs/SHELL-PROTOCOL.md`):**
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`.**
- Build: `npm run build`.
- Tests: `npx vitest run` (targeted: `npx vitest run <path>`).
- Do **not** "fix" `.git/config`.

**Static gates (every PRD, before its commit):** `tsc --noEmit` clean, `npm run build` clean, the PRD's new unit tests green. These must pass before you commit.

**No Playwright / e2e gates.** Do not add or run Playwright/e2e as a gate, do not touch `tests/e2e/**` or `.github/workflows/**`. The `E2E Tenant Flow` CI check being red is expected — ignore it, do not fix it. Runtime verification is a manual post-run Chrome walk by Alex/Cowork.

**Deferred gates (do NOT block — list in the build report):** anything needing a deployed preview or a live DB — assisted-by spoof replay, packet-locked walk on a magic link, concurrency walks, thumbnail render. You cannot deploy mid-run.

**Migrations:** none expected. If one becomes necessary, write + commit it and add a `MIGRATION-TO-APPLY` to OPEN-DECISIONS — **do NOT apply it to the prod Supabase project (`lieeeqqvshobnqofcdac`)**. Never run a destructive statement against any DB.

**Supabase MCP** may be used **read-only** for introspection (e.g. confirming a column type for A7, or a status-guard column for A2/A3). Do not mutate prod through it.

---

## What "done" looks like

1. Branch `feat/pbv-adjacent-errors-hardening` with five commits `PRD-80:` … `PRD-84:` on a base that contains 74–79 + the double-wrap fix; one PR open (not merged).
2. Static gates green on every PRD; the touched-path unit tests green.
3. The new-audit before-deploy findings (A1, A3, and A2 pending Alex's gate call) are remediated by 80 + 81, and the build report marks the deploy-blocker line crossed after 81.
4. No file edited by two PRDs; no prior-batch file reverted; `completeForm.ts` change additive (tenant caller unaffected).
5. Five build reports written; every default/fallback logged in OPEN-DECISIONS; deferred runtime gates enumerated for the manual pass.

## What NOT to do

- Do **not** start before the prerequisites (74–79 + double-wrap fix) are in the base branch — halt-and-tell-Alex instead of re-implementing them.
- Do **not** stop to ask — default-and-log per BATCH-RUN-PROTOCOL.
- Do **not** edit a file outside the current PRD's ownership row, and do **not** re-touch PRD-76's generate-forms region or the double-wrap-fixed wrapping.
- Do **not** remove `completeFormSigning`'s existing `error` string (A12 is additive).
- Do **not** apply migrations to prod or run destructive SQL.
- Do **not** use `npx tsc`; do **not** add/run Playwright gates; do **not** "fix" `.git/config`.

## Reporting back (per build report + a final summary)

- Per PRD: commit SHA, preferred-vs-fallback path + why, static gates, deferred runtime gates, OPEN-DECISIONS entries.
- Final: confirmation the deploy-blocker line (80 + 81) is crossed, the A2 deploy-gate question surfaced for Alex, the PR URL, and the consolidated OPEN-DECISIONS list for Alex's post-run review.
