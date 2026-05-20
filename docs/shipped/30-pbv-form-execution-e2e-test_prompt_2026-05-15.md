# Cursor/Windsurf Prompt — PRD-30: End-to-End Test

## Context

PRDs 22–29 built the PBV form-execution stack. This pass writes the E2E test that walks the Maria Garcia-Rodriguez household through the full flow and asserts the submission package shape. Two specs: Playwright (UI flow) and Vitest (package integrity).

## Required reading

1. `docs/fullApp-Plan/30-pbv-form-execution-e2e-test_prd_2026-05-15.md`
2. `tests/e2e/pbv-tenant-flow.spec.ts` — existing E2E pattern to follow
3. `tests/e2e/helpers/*` — existing helpers to extend
4. All PRD-24/26/27 endpoint shapes (for helper construction)
5. `docs/build-reports/24-` through `29-` — final API + UI shapes

## Closed decisions

- Playwright for UI flow, Vitest for package integrity
- Maria household per PRD-30 §2 table
- 4 source-pending forms feature-flagged off; assertion checks they're NOT in package
- Magic link tested by extracting from queued send (Twilio stubbed)
- Snapshot hash committed; full snapshots gitignored
- Document uploads inserted directly (skip the UI for this spec — covered separately)

## Build this pass

### Commit 1 — Fixtures + helpers

- `tests/fixtures/maria-household.json` matching PRD-22's scripts sample with E2E-specific fields (resume_token expected, etc.)
- 7 helpers per PRD §Affected files
- Commit: `test(pbv-form-execution): e2e helpers + fixtures`

### Commit 2 — Playwright happy-path

- Spec file
- Walk Maria through full flow: link → intake (with pick-up-later mid-flow) → sign summary → sign forms → same-device-handoff Carlos → magic-link Diego → upload (helper-inserted) → submit
- Assert UI state at each major transition
- Assert API state at end
- Commit: `test(pbv-form-execution): playwright happy-path spec`

### Commit 3 — Vitest package-integrity

- After happy-path completes, extract submission package
- Validate:
  - 13 signed PDFs present (12 sourced + zero_income_statement IF mapped in PRD-23, else 12)
  - 4 source-pending forms NOT in package
  - Signature events: counts per signer, ceremony grouping, device_owner correctness
  - Document hashes match PDF state at sign time
  - Summary doc in PT, signed
  - Language flag = PT on package metadata
- Snapshot hash assertion
- Commit: `test(pbv-form-execution): package integrity spec`

### Commit 4 — CI

- Update `.github/workflows/e2e-tenant-flow.yml` to include new specs
- Run locally; verify passes
- Commit: `ci: pbv-form-execution e2e in CI`

## Verification

- Both specs pass locally
- CI workflow runs and passes
- Snapshot artifacts written to expected location
- `npm run build` clean

## Anti-patterns — do NOT

- Do not implement new app code in this PRD — pure test work
- Do not skip the pick-up-later mid-flow step (validates save-and-resume)
- Do not use real SMS / real Twilio
- Do not commit full PDF snapshots — only hash assertion + one representative PNG per form
- Do not skip assertions on the 4 source-pending forms (must verify they're feature-flagged off)
- Do not use `npm run build | Select-Object`

## Build report

`docs/build-reports/30-pbv-form-execution-e2e-build-report_2026-05-15.md`:

1. Specs shipped
2. Helpers shipped
3. Package shape captured at snapshot time (form count, signature event count, language flag)
4. CI runtime
5. Open questions
6. **Sign-off recommendation:** is the PBV form-execution build production-ready?

## When you're done

- 4 commits, build report, clean CI
- Surface package artifacts path so Dan / HACH can review
- This is the final PRD in the sweep — after sign-off, ready for HACH-blocking decisions resolution + production deploy
