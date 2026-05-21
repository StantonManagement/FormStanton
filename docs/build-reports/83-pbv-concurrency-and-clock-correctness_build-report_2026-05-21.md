# PRD-83 — Concurrency & Clock Correctness — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Commit SHA:** `a600202`
**Audit source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` (A7, A10, A11)

---

## What changed (files)

| File | Finding | Change |
|---|---|---|
| `lib/idempotency.ts` | A7 | epoch-ms expiry compare: `new Date(existing.expires_at).getTime() > Date.now()` + comment |
| `app/api/t/[token]/pbv-full-app/additional-signers/[member_id]/send-link/route.ts` | A10 | optimistic-lock the token UPDATE on `member.magic_link_token`; on 0 rows re-read + return winning token with `regenerated:false, race:true` |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (summary region only) | A11 | summary path now `…-v${SUMMARY_TEMPLATE_VERSION}-unsigned.pdf` and uploaded with `upsert:false`; 409/"exists"/"duplicate" surfaces are treated as benign replay (logged, fall through to the row upsert) |
| `lib/pbv/__tests__/prd83-concurrency-and-clock.test.ts` | A7, A10, A11 | new — Gates 1–4 |

## Path taken (preferred vs. fallback) + why

- **A7 — preferred (epoch-ms one-line + comment).** Mirrors PRD-78's `isMagicLinkExpired` shape (`Date.parse`/`Date.now`). The pre-PRD-83 `new Date(existing.expires_at) > new Date()` was OK on a UTC-clean host but ambiguous if a server-local Date construction ever drifted. Null/unparseable `expires_at` → NaN, which is not greater than `Date.now()`, so the cache is bypassed fail-safe and the handler re-runs (matches the function's prior intent).
- **A10 — preferred (optimistic-lock via `.eq('magic_link_token', read-value).select('id')` count check).** The audit suggested gating on `updateError`, but supabase-js does NOT surface a 0-row guarded UPDATE as an error — it returns `data:[]` with `error:null`. So the race signal must come from the affected-row count. Same pattern as PRD-81's claim/race logic.
- **A11 — preferred (versioned path + `upsert:false` + benign-409).** Both options the PRD names, combined. The path now embeds `SUMMARY_TEMPLATE_VERSION` ('1.0.0' today), so two different template versions cannot collide. For the same template version, `upsert:false` plus benign-409 means the loser of a concurrent first-generation reuses the winning summary instead of silently clobbering it. `generateSummaryPdf` embeds a per-call `generatedAt`, so the bytes differ across calls — making the silent-clobber a real concern that this fix closes. Stays inside PRD-83's scope guard (does NOT touch PRD-76's form-document region of the same file).

## Static gates

- `node ./node_modules/typescript/bin/tsc --noEmit` → **clean** (no output).
- `npm run build` → **clean** (only pre-existing route warnings).
- `npx vitest run lib/pbv/__tests__/prd83-concurrency-and-clock.test.ts` → **12/12 passed**.

## Gates (PRD-83 plan map)

| Gate | Status | Notes |
|---|---|---|
| G1 (A7) | ✅ static — asserts `.getTime() > Date.now()`; pre-PRD-83 `> new Date()` gone | |
| G2 (A10 race-loser) | ✅ static — asserts `updateRows`+`select('id')` + race-loss re-read returns `race:true, regenerated:false` | runtime walk deferred (R1) |
| G3 (A10 happy path) | ✅ static — asserts `regenerated:true` + `magic_link_token: newToken` round-trip | |
| G4 (A11) | ✅ static — asserts versioned path includes `SUMMARY_TEMPLATE_VERSION`, `upsert:false`, single guarded throw, benign-replay log | |
| G5 (tsc/build/tests) | ✅ all green | |

## Deferred runtime gates (post-run pass)

- **R1:** on a preview deploy:
  - Fire two concurrent `send-link` requests for the same `member_id` → exactly one valid token in `pbv_household_members`; both callers see the same token (one gets `regenerated:true`, the other `regenerated:false, race:true`).
  - Fire two concurrent `generate-forms` calls → exactly one summary object at the versioned path; the loser logs `generate_forms_summary_benign_replay` and the `pbv_summary_documents` row points at the same path.
- **R2:** verify idempotency cache hits and misses on a route that uses `withIdempotency` (any tenant write endpoint) — confirm the cached response is returned when the key is live and the handler re-runs when expired or null.

## OPEN-DECISIONS entries (appended)

- `[PRD-83] A10 race signal — count-based, not error-based — DECISION` (supabase-js doesn't surface 0-row guarded UPDATEs as errors; we gate on `data.length` per PRD-81 precedent).
- `[PRD-83] A11 summary path migration leaves old objects orphaned — DECISION` (no cleanup script; downstream code reads `pbv_summary_documents.pdf_storage_path`, not the legacy path; orphan storage is a cosmetic concern).

## Notes / cross-PRD flags

- No prior-batch file reverted. PRD-76's form-document first-gen race region (lines ~192–274 in `generate-forms/route.ts`) is intentionally untouched; PRD-83's A11 change is only in the summary region (~lines 360–410).
- PRD-78's `isMagicLinkExpired` is the analogue pattern for A7; consistent with that helper now.
- No migrations.
