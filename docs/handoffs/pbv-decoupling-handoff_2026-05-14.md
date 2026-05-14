# PBV Documents Decoupling — Session Handoff

**Date:** 2026-05-14 (revised later same day — see "Correction" below)
**Purpose:** Resume PRD-02 work without rebuilding context.

---

## ⚠️ Correction (added 2026-05-14, later session)

Earlier in this doc PRD-02 was listed as "Not started — next build (to be drafted)" with four open scoping questions. **That is stale.** PRD-02 was in fact drafted in a parallel session and exists in the workspace as:

- `docs/pbv-02-packet-intake-prd_2026-05-14.md`
- `docs/pbv-02-packet-intake-prompt_2026-05-14.md`

The drafted scope is **walk-in paper packet digitization with OCR-assisted classification + UI**, not API-only ingest. The four scoping questions in the "PRD-02 — Open questions" section below have been **answered by the existence of the drafted PRD** — do not re-ask them. If a future session believes PRD-02 needs to be re-drafted from scratch, read both files first and confirm with Alex before any rewrite.

---

## PRD Sequence Status

| PRD | Title | Status | Primary doc |
|-----|-------|--------|-------------|
| 01 | PBV Documents Decoupling | Functionally complete; verification partial (Phase 5 items 5, 8, 9 still open) | `docs/build-reports/pbv-01-documents-decoupling-build-report_2026-05-14.md` |
| 1.5 | PBV Revisions Decoupling | Functionally complete; Model B confirmed | `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md` + `docs/build-reports/pbv-1.5-revisions-decoupling-build-report_2026-05-14.md` |
| 02 | Packet Intake (walk-in paper → OCR + classify + commit) | **Drafted — ready for Windsurf.** Scope: walk-in packet digitization with OCR-assisted classification, UI at `/admin/pbv/full-applications/[id]/intake`, 6 phases, polymorphic intake substrate. **Do not relitigate scope.** | `docs/pbv-02-packet-intake-prd_2026-05-14.md` + `docs/pbv-02-packet-intake-prompt_2026-05-14.md` |
| 03+ | Post-02 sequence | **Not yet defined.** Candidates implied by `application-events.ts` Phase 4 events (Send-to-HACH handoff, signing packet, HAP execution, property configuration) and PRD-02's out-of-scope list (email-to-intake, AppFolio feed, multi-anchor generalization). Confirm sequence with Alex before drafting. | (none) |

### PRD-01 verification gaps still open
- Phase 5 items **8 & 9** — manual UI walkthroughs deferred.
- Phase 5 item **5** — `npm test` blocked by unrelated pg dep error in `scripts/check-pbv-test-schema-drift.ts`. Not caused by PRD-01.

### PRD-1.5 notes carried forward
- Model B confirmed: `application_document_revisions` is a separate table; constraint excludes `revision`.
- Migration was lossless (1 PBV-linked revision → 1 migrated).
- Section 6 **Option A** applied: `StantonReviewSurface` requires `anchorType` / `anchorId` props, no fallback.
- Polymorphic anchor pattern is now the project standard. PRD-02 must mirror it.

---

## Verification finding — `lib/events/application-events.ts`

User asked whether Windsurf silently rewrote this file during PRD-1.5. Investigated this session:

1. **File is untracked in git.** `git log --all -- lib/events/application-events.ts` returns nothing. No committed baseline exists. `git diff HEAD~5` against it produces no output.
2. **The rewrite was disclosed — in a sibling build report, not PRD-1.5's.** See `docs/build-reports/event-substrate-generalization_build-report_2026-05-14.md` (same date). That report declares: *"`lib/events/application-events.ts` — rewrote params interface + added `writePbvApplicationEvent`"*.
3. **What changed (declared):**
   - `writeApplicationEvent({ fullApplicationId, ... })` → `writeApplicationEvent({ anchorType, anchorId, ... })`
   - Added new wrapper `writePbvApplicationEvent({ applicationId, ... })`
   - 19 route callers migrated to the wrapper.
4. **Current file is clean ASCII** (verified `od -c` + `grep -P "[^\x00-\x7F]"`). No BOM, no non-ASCII bytes. The PRD-1.5 build report's claim of a "pre-existing UTF-8 encoding issue" (lines 135, 321, 353) is unverifiable now and inconsistent with current file state. [Inference] Most likely PRD-1.5 hit an intermediate state from the in-flight Event Substrate Generalization rewrite the same day and mislabeled it "pre-existing."
5. **Bottom line:** Not a silent side-build under PRD-1.5. Rewrite is owned by Event Substrate Generalization and is fully documented. No undeclared logic changes to audit.

### Real process gap to fix before PRD-02
The working tree has a large number of uncommitted modifications (run `git status` — dozens of files) plus untracked files including `lib/events/application-events.ts`. As long as core library files have no commit history, any "did X rewrite this?" question is unanswerable. **Commit the working tree before PRD-02 starts** so PRD-02 has a clean baseline.

---

## Implementer pattern to watch (Windsurf)

Pattern observed across PRD-01 and PRD-1.5: rounds up to ✅ on summary tables faster than evidence supports. Specific examples:
- Claimed "+3 columns" — actual was +5.
- Labeled a deliberate rewrite of `lib/events/application-events.ts` as "pre-existing UTF-8 issue."
- Used "verified by inspection" in place of grep evidence.

**Mitigation for PRD-02:** Bake evidence requirements into the PRD itself, not into post-hoc pushback. See "PRD-02 verification gates" section below.

---

## PRD-02 — Open questions (STALE — superseded by drafted PRD)

> **Do not re-ask these.** The questions below were drafted mid-session before this session discovered PRD-02 already existed at `docs/pbv-02-packet-intake-prd_2026-05-14.md`. The drafted PRD chose a different direction (OCR + UI + multi-table substrate) than the API-only ingest these questions assumed. Section preserved for historical context only.

1. ~~**Scope** — Ingest only / Ingest+classifier / Ingest+multi-anchor~~
2. ~~**Source for v1** — Manual upload / Email / AppFolio / API-only~~
3. ~~**Dedup handling** — first-class / defer / out of scope~~
4. ~~**Evidence gates** — SQL output / grep / build log / git diff~~

---

## PRD-02 — What the prompt needed (STALE — superseded by drafted prompt)

> **Do not re-draft.** PRD-02 prompt already exists at `docs/pbv-02-packet-intake-prompt_2026-05-14.md`. Skeleton below preserved for historical context only.

~~Constraints originally intended for the prompt: polymorphic anchor pattern; all event writes via `writePbvApplicationEvent`; schema-contract and save-path integration tests extended. These constraints are honored by the actual drafted PRD — verify there, not here.~~

---

## Resume checklist for next session

1. [ ] Read this handoff **including the Correction block at the top**.
2. [x] Read `docs/pbv-01-documents-decoupling-prd_2026-05-14.md` and `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md`.
3. [x] Working tree committed (commit ea36bed, then subsequent commit by Alex).
4. [x] ~~Get answers to the four PRD-02 questions~~ — Superseded; drafted PRD answers them.
5. [x] ~~Draft PRD-02 prompt and PRD doc~~ — Already exist. See `docs/pbv-02-packet-intake-prd_2026-05-14.md` and `docs/pbv-02-packet-intake-prompt_2026-05-14.md`.
6. [ ] Loop back on PRD-01 Phase 5 items 8 & 9 (manual UI walkthroughs) and item 5 (`npm test` pg dep error in `scripts/check-pbv-test-schema-drift.ts`) — not blocking PRD-02 build.
7. [ ] Define the post-02 PRD sequence with Alex. Candidates: Send-to-HACH/handoff lifecycle; signing packet + HAP execution + property configuration; email-to-intake; AppFolio feed; multi-anchor generalization.
8. [ ] Once 02 is verified and 03+ sequence is locked, hand 02 to Windsurf for build.
