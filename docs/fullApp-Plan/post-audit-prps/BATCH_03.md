# BATCH 03 — Resilience & State Correctness (PRP-010 … PRP-013)

You are an autonomous Claude Code session running **Batch 03** of a 5-batch PBV remediation: unsaved-work guards, fetch retry/partial-failure/offline, autosave + ceremony recovery, and idempotency/finalize/error-surfacing. Run the four PRPs **in order**, one git commit each, no sign-off. Clean context; everything is in this file and the named PRP files.

## Working directory & branch
- Run from the repo root.
- Ensure branch **`feat/pbv-post-audit-remediation`** is checked out (create off `main` if missing). Shared branch across all batches. No PR (Batch 05 does).

## Shell rules (inlined)
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`.**
- Tests: `node ./node_modules/.bin/vitest run <path>`. **Never `npx vitest`.** Targeted only.
- **No `npm run build` per PRP** — exception: **PRP-013** only if its finalize-atomicity SQL-function path changes a typed RPC signature (then build that one). Otherwise build is the batch-boundary gate.
- Migrations write+commit only; no prod apply; no destructive SQL.

## PRPs in execution order
1. **PRP-010** (`PRP-010_unsaved-work-guards.md`) — `beforeunload` guards on intake + signing. *Depends on: none.* (Prefer hosting the intake guard in the layout so it doesn't touch the intake `[section]` page that Batch 04 edits.)
2. **PRP-011** (`PRP-011_fetch-retry-partial-failure-and-offline.md`) — `tenantFetch` backoff + custom idempotency-key support + `Promise.allSettled` dashboard + offline provider. *Depends on: none.*
3. **PRP-012** (`PRP-012_autosave-and-ceremony-recovery.md`) — localStorage intake backup + sessionStorage ceremony recovery + dirty-flag dep. *Depends on: **PRP-011*** (uses its `tenantFetch` idempotency-key support; 011 is earlier in this batch).
4. **PRP-013** (`PRP-013_idempotency-finalize-atomicity-and-error-surfacing.md`) — `application_id`-scoped idempotency, atomic finalize event, real-error logging in the PDF loader. *Depends on: none.*

No two PRPs in this batch write the same file. **Cross-batch note:** if PRP-010 hosts its guard in the intake `[section]` page (instead of the layout), that file is also edited by Batch 04 (PRP-015) — Batch 03 runs first, so Batch 04 layers on it; the loop guarantees order. Prefer the layout host to avoid the overlap.

## Per-PRP loop
1. Read the PRP; note **Outputs** + **Acceptance criteria**.
2. Implement only those files; default-and-note on ambiguity. (PRP-012: if PRP-011 didn't land, the idempotency-key passthrough no-ops harmlessly — note it.)
3. Per-PRP gates: `tsc --noEmit` clean; targeted `vitest` green (PRP-013: build only if the SQL-fn path changes a typed RPC).
4. Commit `PRP-0NN: <slug>` (push if git healthy).
5. Build report `docs/build-reports/PRP-0NN_<slug>_build-report_2026-05-21.md` (files+SHA, path, gates, any #10 migration, deferred runtime gates).
6. Next PRP.

## Batch-boundary gates (after PRP-013)
- One full `npm run build` → clean.
- Pattern-sweep for other `Promise.all` fail-all-on-one spots and other unscoped idempotency lookups. Record findings.

## Done when
Four commits `PRP-010:`…`PRP-013:`; per-PRP gates green; boundary build clean; four build reports; any finalize-atomicity migration commit-only + listed; deferred runtime gates (network-throttle, offline toggle, refresh-recovery, finalize atomicity) enumerated. No PR.
