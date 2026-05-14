# PBV Documents Decoupling — Session Handoff

**Date:** 2026-05-14
**Purpose:** Resume PRD-02 (Packet Intake) draft without rebuilding context.

---

## PRD Sequence Status

| PRD | Title | Status | Primary doc |
|-----|-------|--------|-------------|
| 01 | PBV Documents Decoupling | Functionally complete; verification partial | `docs/build-reports/pbv-01-documents-decoupling-build-report_2026-05-14.md` |
| 1.5 | PBV Revisions Decoupling | Functionally complete; Model B confirmed | `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md` + `docs/build-reports/pbv-1.5-revisions-decoupling-build-report_2026-05-14.md` |
| 02 | Packet Intake | Not started — next build | (to be drafted) |

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

## PRD-02 — Open questions (collected mid-session, not yet answered)

User started answering an AskUserQuestion block but the answers didn't come through. The four questions to re-ask in the next session:

1. **Scope** — which of these?
   - Ingest external packets → new docs only
   - Same + classifier/routing (auto doc-type classification, required-doc matching)
   - Same + multi-anchor support (generalize beyond `pbv_full_application`)

2. **Source for v1** (multi-select):
   - Staff manual upload (UI)
   - Email-to-intake
   - AppFolio / external feed (note: `app/admin/appfolio-queue/page.tsx` already exists — may be related)
   - API endpoint only (UI = Phase 2)

3. **Dedup handling** — does PRD-02 own it?
   - Yes, first-class — define skip / mark / route-to-revisions behavior
   - Flag and defer to Phase 2
   - Out of scope; intake always creates new docs

4. **Evidence gates to bake into the PRD** (multi-select):
   - SQL output for every schema/data claim (command + raw output)
   - Grep command + output for every code claim
   - Build log excerpt per phase (raw, not summarized)
   - Git diff of every touched file — directly addresses the untracked-file gap

---

## PRD-02 — What the prompt will need (skeleton, pending answers above)

When drafting, mirror PRD-01 / PRD-1.5 structure:

- **Problem Statement** — packet intake currently undefined; need a path to create new `application_documents` from incoming packets.
- **Users & Roles** — intake staff, app leads, document owners.
- **Core Features** — driven by scope answer.
- **Data Model** — polymorphic anchor (`anchor_type`, `anchor_id`) per project standard; reuse `application_documents`, no new revision behavior.
- **Integration Points** — `application_events` writes via `writePbvApplicationEvent` (no direct inserts); review surface UI already supports new docs.
- **Implementation Phases** — concrete deliverables per phase, with explicit evidence gates.
- **Verification Gate Structure** — mirror PRD-1.5's; tighten per evidence-gate answer.
- **Non-goals** — explicitly call out revision handling (owned by PRD-1.5) and any deferred scope.

### Constraints to surface in the prompt
- Polymorphic anchor pattern is the standard — no PBV-specific FKs.
- All event writes go through `writePbvApplicationEvent` (or a new typed wrapper if a new anchor type is added). Never call `writeApplicationEvent` directly from a route. Never insert into `application_events` outside `lib/events/application-events.ts`. (Per Event Substrate Generalization report, save-path standard.)
- New event types must be added to `ApplicationEventType` in `lib/events/application-events.ts`.
- Schema-contract test (`lib/__tests__/schema-contract.test.ts`) must be extended for any new columns.
- Save-path integration test (`lib/__tests__/save-path-integration.test.ts`) must cover every new event type.

---

## Resume checklist for next session

1. [ ] Read this handoff.
2. [ ] Read `docs/pbv-01-documents-decoupling-prd_2026-05-14.md` and `docs/pbv-1.5-revisions-decoupling-prd_2026-05-14.md` for structure to mirror.
3. [ ] Confirm/commit working tree state — decide whether to commit before PRD-02 or accept the untracked baseline.
4. [ ] Get answers to the four PRD-02 questions above.
5. [ ] Draft PRD-02 prompt and PRD doc.
6. [ ] Loop back on PRD-01 Phase 5 items 8 & 9 (manual UI walkthroughs) and item 5 (npm test pg dep error) when convenient — not blocking PRD-02.
