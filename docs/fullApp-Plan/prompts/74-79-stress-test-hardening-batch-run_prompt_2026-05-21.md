# Build Prompt — Stress-Test Hardening Batch (PRDs 74–79)

You are running an **autonomous batch** of six PRDs that remediate the findings in
`docs/audits/pbv-stress-test-report_2026-05-21.md`. Work through them in order, one commit each, without stopping for sign-off.

**Read first, in this order:**
1. `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` — the rules below extend it; it governs default-and-log, prod-migration safety, static-vs-deferred gates, and the `.git/config` non-issue. The same rules apply to this batch (74–79).
2. This prompt (the run order + the file-ownership map + the audit corrections).
3. Each PRD, immediately before you build it.

---

## Why this is structured as six PRDs

Each PRD owns a **disjoint set of files** — no two PRDs edit the same file. This is deliberate: it keeps each step self-contained so you never have to reconcile two PRDs' edits to one file. Stay inside your current PRD's file set; if you think you need a file owned by another PRD, default-and-log instead of reaching across.

**File-ownership map (do not cross these lines):**

| PRD | Owns (edits) |
|---|---|
| 74 — Cron security & idempotency | `app/api/cron/pbv-deferred-reminders/route.ts`, `app/api/cron/cleanup-idempotency-keys/route.ts`, `app/api/cron/notifications/scheduled-sends/route.ts`, new `lib/cron/auth.ts`, new `lib/cron/runLock.ts`, new `cron_run_locks` migration |
| 75 — RLS lockdown & finalize index | new migrations only: `*_pbv_rls_lockdown.sql`, `*_pbv_signature_events_hash_index.sql` |
| 76 — Tenant storage write-race | `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`, `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`, optional `*_generate_form_claim_fn.sql` |
| 77 — Tenant endpoint lock & input guards | `lib/pbv/tenantEndpoint.ts`, `app/api/t/[token]/pbv-full-app/sign-form/route.ts`, new `lib/pbv/signing/validateSignFormBody.ts` |
| 78 — Magic-link signer route hardening | `app/api/pbv-full-app/signer/[member_token]/route.ts`, `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`, new `lib/pbv/magicLinkExpiry.ts` |
| 79 — Review-suite test stabilization | test files + test config only (non-PBV) |

**Cross-PRD dependencies (run order respects them):**
- **78 depends on 77** — PRD-77 creates `lib/pbv/signing/validateSignFormBody.ts`, which 78 imports. If for any reason 77 didn't land, create the helper in 78 per PRD-77's spec and note the reorder.
- **77 layers on 76 (behavioral, no file overlap)** — 76 edits the `generate-forms` body; 77 adds the `packet_locked` gate centrally in `withTenantContext`, which `generate-forms` then inherits. Running 76 before 77 keeps this clean.

---

## Run order

**74 → 75 → 76 → 77 → 78 → 79.**

**Deploy-blocker line:** the three CRITICAL findings are cleared once **74 (Phase 1), 75 (Phase 1), and 76 (Phase 1)** are committed — that is the minimum to unblock deploy (#1 cron auth, #3 RLS lockdown, #2 upload race). 77–79 are post-launch hardening. Run the whole batch, but make the build report flag clearly when the deploy-blocker line is crossed (after 76).

---

## Corrections to the audit (the PRDs already bake these in — do not re-derive from the audit text)

- **#3 / PRD-75 is drift, not a bad migration.** `pbv_rejection_reason_templates`'s migration is already correct (`service_role`/`authenticated`); `pbv_document_requirements` has **no migration at all**. The remediation is a forward, idempotent corrective migration, and you must **introspect prod (Supabase MCP, read-only) before writing it** to get real policy names + columns. Do not edit the existing `20260514220000` migration.
- **#11 / PRD-75 index already half-exists.** An index on `(form_document_id)` exists; the new `(form_document_id, document_hash)` is a covering-index optimization, framed as such — not a missing-index fix.
- **#8 / PRD-78 may already be UTC-correct.** Confirm `magic_link_expires_at` is `timestamptz`; if so, #8 is consistency hardening, and the helper is the deliverable. If not, log a type-conversion migration (commit-only).

---

## Per-PRD loop

For each PRD `NN` in order:
1. Read `docs/fullApp-Plan/NN-pbv-…_prd_2026-05-21.md`.
2. Implement only that PRD's file set. Take the **preferred** path; if it can't be validated in-session, take the PRD's documented **fallback** and log the choice in `docs/fullApp-Plan/OPEN-DECISIONS.md` (use the `### [PRD-NN] <title> — <DECISION|BLOCKER|MIGRATION-TO-APPLY>` format).
3. Pass the PRD's **static gates** (see global gates below) before committing.
4. **One commit:** `PRD-NN: <slug>` (e.g. `PRD-74: cron security & idempotency`). **Push after commit.**
5. Write `docs/build-reports/NN-pbv-…_build-report_2026-05-21.md`: files changed + SHA, which preferred/fallback path you took and why, static gates pass/fail, deferred runtime gates, and any OPEN-DECISIONS entries.
6. Move to the next PRD.

---

## Global rules

**Branch:** one cumulative branch off `main`: **`feat/pbv-stress-test-hardening`**. One commit per PRD so individual PRDs can be reverted/cherry-picked. Open **one** PR at the end (Ready for Review, do **not** merge — Alex reviews).

**Shell / type-check (see `docs/SHELL-PROTOCOL.md`):**
- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`** — it hangs on Windows.
- Build with `npm run build`.
- Tests with `npx vitest run` (targeted: `npx vitest run <path>`).
- Do **not** "fix" `.git/config` — it is fine.

**Static gates (every PRD, before its commit):** `tsc --noEmit` clean, `npm run build` clean, the PRD's new unit/integration tests green, and (PRD-79) the full `vitest run` green.

**Deferred gates (do NOT block on these — list them in the build report):** anything needing a deployed preview or a live DB — RLS-applied checks, advisory-lock concurrency under real connections, cron Bearer round-trips, magic-link/expiry walks. You cannot deploy or apply migrations mid-run.

**No Playwright / e2e gates.** Do not add or run Playwright/e2e as a gate (they account for the bulk of CI flakiness). Static gates only; runtime verification is a manual post-run pass.

**Migrations:** write + commit; **do NOT apply to the prod Supabase project (`lieeeqqvshobnqofcdac`)**. Add every migration to OPEN-DECISIONS as a `MIGRATION-TO-APPLY`. Never run a destructive statement (DROP TABLE/DELETE/TRUNCATE, or UPDATE without a tight WHERE) against any DB. The corrective RLS migration (PRD-75) uses `DROP POLICY IF EXISTS` / `CREATE … IF NOT EXISTS` only — that is allowed (idempotent policy/index DDL), but still commit-only.

**Supabase MCP** may be used **read-only** for introspection (PRD-75 policy/column names, PRD-78 column type). Do not mutate prod through it.

---

## What "done" looks like

1. Branch `feat/pbv-stress-test-hardening` with six commits `PRD-74:` … `PRD-79:`, pushed; one PR open (not merged).
2. Static gates green on every PRD; `vitest run` exits 0 after PRD-79.
3. The three CRITICAL findings (#1, #2, #3) are remediated by 74/75/76 and the build report marks the deploy-blocker line as crossed.
4. All new migrations committed + listed in OPEN-DECISIONS (none applied to prod).
5. Six build reports written; every default/fallback/skip logged in OPEN-DECISIONS; deferred runtime gates enumerated for the manual pass.

## What NOT to do

- Do **not** stop to ask — default-and-log per BATCH-RUN-PROTOCOL.
- Do **not** edit a file outside the current PRD's ownership row.
- Do **not** apply migrations to prod or run destructive SQL.
- Do **not** use `npx tsc`; do **not** add/run Playwright gates; do **not** "fix" `.git/config`.
- Do **not** leave the fail-open cron auth in place (PRD-74 #1) — that is the deploy blocker.
- Do **not** ship `upsert:true` on a fixed first-gen path (PRD-76 #4) or skip the affected-row count check (PRD-76 #2).
- Do **not** make production code change just to turn a test green (PRD-79) — if a test exposed a real bug, log it as a new finding.

## Reporting back (per build report + a final summary)

- Per PRD: commit SHA, preferred-vs-fallback path taken + why, migration paths (in OPEN-DECISIONS), static gates, deferred runtime gates.
- Final: confirmation the deploy-blocker line (74/75/76) is crossed, the PR URL, and the consolidated OPEN-DECISIONS list (decisions, blockers, migrations-to-apply) for Alex's post-run review.
