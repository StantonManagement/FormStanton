# PRP-013 — Workflow-Audit Residuals (#9, #10, #13) — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `92289ad72f0b6dd3269310d98331772054577fb2`
**Findings (all verified-correct):** workflow-audit #9, #10, #13.

## Files changed
- `lib/__tests__/prp013-workflow-residuals.test.ts` *(new)* — 9 regression tests.

## Per-item evidence
| Item | Status | Evidence |
|------|--------|----------|
| #9 idempotency lookup scoped by application_id | **VERIFIED CORRECT** (PRD-66) | `lib/idempotency.ts:28` `.eq('application_id', applicationId)` in the lookup WHERE; upsert payload at `:44-51` writes the column. |
| #10 finalize atomicity | **VERIFIED CORRECT** (PRD-64) | `app/api/t/[token]/pbv-full-app/finalize/route.ts:55` calls the `finalize_pbv_application` RPC (single SQL transaction). No `.update({ submitted_at:` in the route; `rpcError → 500` with the app left unsubmitted. |
| #13 tryLoadPdf error logging | **VERIFIED CORRECT** (PRD-66) | `lib/pbv/form-generation/source-pdfs.ts:45-52` branches on `code === 'ENOENT'` / "Source PDF not found" message; non-not-found errors log at `console.error` with the file name. Returns null in both branches (Buffer\|null contract). |

## Path taken
- **No behavioural changes.** Every item is already closed on this branch base. The PRP's verify-first contract applied.
- **No migration shipped.** PRP allowed one iff #10 needed an SQL function; that function already exists (`20260521020000`).
- **Source-grep tests** rather than supabase-mocked integration tests — narrower scope (PRP only asks the invariants be pinned) and zero new infrastructure.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/__tests__/prp013-workflow-residuals.test.ts` — **9 pass / 0 fail / 2.35 s.**

## Deferred runtime gates
- Apply a hypothetical event-write failure on a preview (simulate by revoking insert on `application_events` mid-finalize) → verify the route returns 500 and `pbv_full_applications.submitted_at` stays null.
- Replace one of the source PDFs with an unreadable file (chmod 000) on a preview → confirm a `[source-pdfs] Failed to load …` ERROR shows up in the logs (not a silent skip).

## Notes
- Adjacent code paths in the same files were not touched. Future regressions (e.g. someone reverting the application_id scoping or removing the RPC call) will fail the tests here.
