# BATCH_PLAN — PBV Post-Audit Remediation (22 PRPs, 5 batches)

**Date:** 2026-05-21
**This is the single thing to review before any run starts.** It maps every PRP to a batch, shows dependencies and cross-batch shared files, proves coverage of every audit finding, and gives the exact set-and-forget run command.

**Companion docs:** `AUTONOMOUS-BUILD-LESSONS.md` (repo root — why the audit pile-up happened), `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` + `docs/SHELL-PROTOCOL.md` (gate model / shell rules). The five `BATCH_0N.md` files in this folder are the actual batch prompts; the `PRP-0NN_*.md` files are the self-contained units.

---

## How this is structured
- **22 PRPs**, numbered `PRP-001`…`PRP-022`, **zero-padded, decoupled from batch** (the filename has no batch number, so reassigning a PRP to another batch needs no rename).
- **5 batches**, sizes **5 / 4 / 4 / 4 / 5** (within 2 of each other; each ≈ one context window / ≤ ~50 min).
- Every PRP is **fully self-contained**: it states its inputs (paths to read), outputs (the only files it may modify), acceptance criteria, and a one-line **Depends on:** — and never references another PRP's prose. A batch can run in a fresh session with no prior context.
- **Run batches strictly in order 01 → 05.** They share three files across batches (below), so they must **not** be parallelized.

---

## Batch assignment

| Batch | Manifest | PRPs | Theme | Gate role |
|---|---|---|---|---|
| 01 | `BATCH_01.md` | PRP-001 … PRP-005 | Security headers/CSP, rate limiting, file validation, env/health, functional correctness | **Deploy gate** (001–004 cross the deploy-blocker line) |
| 02 | `BATCH_02.md` | PRP-006 … PRP-009 | Accessibility | First post-launch patch |
| 03 | `BATCH_03.md` | PRP-010 … PRP-013 | Resilience & state correctness | First/second patch |
| 04 | `BATCH_04.md` | PRP-014 … PRP-017 | Mobile/cross-browser & performance | First/second patch |
| 05 | `BATCH_05.md` | PRP-018 … PRP-022 | Compliance, operations, test coverage | Second/third patch + opens the PR |

| PRP | Title | Batch | Depends on |
|---|---|---|---|
| 001 | Security headers & CSP | 01 | — |
| 002 | Rate limiting & brute-force resistance | 01 | — (⚠ backend decision) |
| 003 | Magic-bytes file validation | 01 | — |
| 004 | Env validation, health, runtime bootstrap | 01 | — |
| 005 | Functional-correctness verification | 01 | — |
| 006 | Signature-pad keyboard fallback & a11y | 02 | — |
| 007 | Signing-modal focus & announcements | 02 | — |
| 008 | FormsStack stepper announcements | 02 | — |
| 009 | Landmarks, skip-link, status a11y | 02 | — |
| 010 | Unsaved-work guards | 03 | — |
| 011 | Fetch retry, partial-failure, offline | 03 | — |
| 012 | Auto-save & ceremony recovery | 03 | **PRP-011** (same batch, earlier) |
| 013 | Idempotency/finalize/error surfacing | 03 | — |
| 014 | Dynamic viewport height sweep | 04 | — |
| 015 | Intake navigation & deep-link integrity | 04 | **PRP-010** (Batch 03) |
| 016 | Scanner & camera mobile correctness | 04 | — |
| 017 | Render-path performance & motion | 04 | **PRP-005** (Batch 01) |
| 018 | Consent-version integrity & log hygiene | 05 | — |
| 019 | Data lifecycle & audit tamper-evidence | 05 | — |
| 020 | In-app browser & CSRF | 05 | **PRP-002** (Batch 01) |
| 021 | Operational readiness (runbook + migrations) | 05 | — |
| 022 | Test-coverage backfill | 05 | — (run last) |

**No dependency points to a higher-numbered batch.** ✅

---

## Cross-batch shared files (why batches must run in order, not in parallel)

Three files are touched in more than one batch. Within each batch all files are disjoint; across batches the lower-numbered batch always runs first (the loop guarantees it), and the later PRP layers on a different region:

| File | Earlier PRP (region) | Later PRP (region) | Resolution |
|---|---|---|---|
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | PRP-005 (B01) — required-signer logic | PRP-017 (B04) — stamping/duration | B01 before B04; different regions |
| `lib/pbv/tenantEndpoint.ts` | PRP-002 (B01) — rate limiter | PRP-020 (B05) — CSRF | B01 before B05; layer CSRF after limiter |
| `app/pbv-full-app/[token]/intake/[section]/page.tsx` | PRP-010 (B03) — `beforeunload` guard* | PRP-015 (B04) — navigation | B03 before B04; *PRP-010 prefers the layout, avoiding this overlap entirely |

**Therefore: run 01 → 02 → 03 → 04 → 05 sequentially. Do not parallelize.**

---

## How to run (headless "set and forget")

Each batch manifest is a complete prompt; each `claude -p` invocation is a **fresh, isolated session** (no memory of the previous one) — which is exactly why the PRPs are self-contained. Run them sequentially in one sitting from the repo root.

**Verified flag notes (Claude Code):**
- `--permission-mode acceptEdits` only auto-accepts *file edits* — it still prompts for Bash (`npm run build`, `git commit`), so an unattended run **would hang**. Use **`--permission-mode bypassPermissions`** (alias `--dangerously-skip-permissions`) for true set-and-forget. Your prompt guardrails (no destructive SQL, commit-only migrations, no prod apply) are the safety net, so only run this in your trusted local repo.
- Use **`--verbose`** so the log shows *where* a run is (streaming), not just the final message — this is how you'd diagnose any hang.
- Set **`--max-turns`** high (e.g. 300); a multi-PRP batch needs many turns, and you don't want a low default to cut it off mid-batch.
- Each iteration exits 0 on success / nonzero on failure — the `||` below stops the loop if a batch fails, so a later batch never builds on a broken base.

```bash
cd /path/to/FormStanton            # repo root — the agent inherits this cwd
PRP_DIR=docs/fullApp-Plan/post-audit-prps

for n in 01 02 03 04 05; do
  echo "=== BATCH $n started $(date) ==="
  claude -p "$(cat $PRP_DIR/BATCH_$n.md)" \
    --permission-mode bypassPermissions \
    --verbose \
    --max-turns 300 \
    > out-batch-$n.log 2>&1 \
    || { echo "Batch $n FAILED at $(date) — stopping (see out-batch-$n.log)"; exit 1; }
  echo "=== BATCH $n finished $(date) ==="
done
echo "All batches complete."
```

In the morning: skim `out-batch-0N.log` for each batch, then review the one PR (opened by Batch 05) and the per-PRP build reports in `docs/build-reports/`.

**Notes / caveats:**
- All five commit to one branch, **`feat/pbv-post-audit-remediation`**; Batch 01 creates it, 02–05 reuse it, Batch 05 opens the single PR. The loop never switches branches.
- If you'd rather gate each batch on a clean build before the next starts, the `||`/`exit 1` already does that at the process level; for finer control you can split the run and inspect a log before continuing.
- If a batch's context still feels heavy, every PRP is independently runnable — `claude -p "$(cat $PRP_DIR/PRP-0NN_*.md)"` works on a single PRP with the same flags.

---

## Coverage matrix (every finding → PRP)

**Angle-2 audit (A–J):**

| Finding | PRP | Finding | PRP | Finding | PRP |
|---|---|---|---|---|---|
| A1 | 006 | C1 | 010 | F1 | 015 |
| A2 | 007 | C2 | 011 | F2 | 015 |
| A3 | 006/007/008 | C3 | 011 | F3 | 020 |
| A4 | 006/007/017 | C4 | 011 | F4 | 015 |
| A5 | 009 | C5 | 012 | G1 | 018 |
| A6 | 009 | C6 | 012 | G2 | 018 |
| A7 | 009 | C7 | — (verified safe; no-op) | G3 | 019 |
| A8 | 008 | D1 | 001 | G4 | 019 |
| B1 | 016 | D2 | 002 | G5 | 019 |
| B2 | 016 | D3 | 002 | H1 | 017 |
| B3 | 007 | D4 | 003 | H2 | 016 |
| B4 | 017 | D5 | 018 | H3 | — (speculative; monitor only) |
| B5 | 017 | D6 | 001 | H4 | 017 |
| B6 | 017 | D7 | 020 | I1 | 004 |
| E1 | 015 | D8 | 001 | I2 | 004 |
| E2 | 012 | | | I3 | 004 |
| E3 | 011/012 | | | I4 | 021 |
| E4 | 008 | | | I5 | 021 |
| E5 | 012 | | | J1–J6 | 022 |

**Mobile/cross-browser:** dvh → 014 (+ modal dvh in 007, page-shell dvh in 017, scanner dvh in 016); iframe scroll-trap → 007; scroll-to-top → 015; canvas resize → 006; date font-size → 014; facingMode → 016; heic2any state → 016; iPad layout → deferred (low value, logged here).

**Open-items #5–#11:** #5–#9 → 005; #10 (`canGoNext` gate) and #11 (`AssistedHandoffPrompt` reset) → deferred (audit tagged "Future sprint"). The 4 unapplied migrations in open-items Pass 1 are **Alex-applies**, tracked in `OPEN-DECISIONS.md` — not PRPs.

**Workflow-audit residuals:** #9, #10, #13 → 013. (#1–#8, #11, #12, #14 already closed by prior PRDs 62/63/64/66 — out of scope here.)

---

## Open decisions / routing flags (resolve before or during the run)
1. **PRP-002 rate-limit backend** — Upstash/Redis vs Vercel KV vs (insufficient) in-memory. If no shared store is provisioned, the PRP builds behind an interface and logs this — you provision the store before it's truly live.
2. **PRP-001 CSP** — ships **report-only**; a later, separate effort flips to enforcing after reviewing violations.
3. **PRP-019 G4 audit hash-chain** — implement now vs document as a v1.1 gap (default: document + design, ship G3+G5). Your call.
4. **PRP-019 / PRP-021 retention period & `tenant_lookup` schema** — stated as "confirm with HACH/program" / introspected read-only; verify before applying any migration.
5. **PRP-015 F4 back-button UX** — ambiguous; default keeps current behavior + logs. Confirm if you have a preference.

No ClickUp tasks are created by this plan (per instruction). If any routing destination is genuinely unclear during a run, the agent logs it here / in `OPEN-DECISIONS.md` rather than guessing.

---

## Re-balancing note (if the PRP count changes)
If PRPs are added/removed, keep 5 batches with sizes within 2 of each other and each ≤ ~50 min of work, and **preserve dependency order** (no dep into a higher batch) and **file-conflict co-location** (same-file PRPs in the same batch, or the owning batches flagged sequential as above). If 5 even batches becomes impossible under those constraints, stop and report rather than forcing an uneven split.
