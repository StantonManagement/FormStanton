# PRD-61 Build Report: End-to-End Finalization Gate (Closeout)

**Date:** 2026-05-21 (run alongside PRD-55b for the closeout pass)
**Commit:** (filled at commit time — `PRD-61: end-to-end finalization gate (closeout)`)
**Branch:** feat/pbv-full-finalization

This is the **FINAL** report for the PBV Full-App Finalization batch (PRDs 55, 55b, 56, 57, 58, 59, 60, 61). It is intentionally the consolidation point: it links every PRD's build report and rolls every batch-level deferred runtime gate into one post-run checklist for Alex.

---

## Summary

PRD-61 adds **no app code, no schema, no migration**. It delivers:

1. Three representative household profile fixtures (Profile A — single adult; Profile B — 2 adults; Profile C — pet + vehicle + self-employment + child-support).
2. A Playwright acceptance spec (`tests/e2e/pbv-finalization-acceptance.spec.ts`) that creates each profile, generates forms, signs, finalizes, and asserts the package shape.
3. A Vitest package-integrity spec (`tests/e2e/pbv-finalization-acceptance-integrity.spec.ts`) that asserts DB-level invariants per submitted profile (form count, ceremony grouping, `document_hash`, post-submit lock).
4. A new helper `createProfileApplication` that seeds a rich profile (member flags + `intake_data`) so conditional rules in `lib/pbv/conditional-rules.ts` evaluate against real, profile-driven data.
5. A new "PBV Finalization Acceptance" section in `tasks/WALKTHROUGH_RECIPE.md` — the EN/ES/PT × profile matrix, the DoD-1…DoD-7 → proof mapping, and the residual-defect log.
6. This report — the consolidated post-run verification checklist for the whole batch.

---

## Files Changed (PRD-61)

| File | Change |
|---|---|
| `tests/fixtures/profile-a-single-adult.json` | NEW — single-adult control profile |
| `tests/fixtures/profile-b-multi-adult.json` | NEW — multi-adult signer profile |
| `tests/fixtures/profile-c-conditional.json` | NEW — pet/vehicle/self-emp/child-support triggers |
| `tests/e2e/helpers/createProfileApplication.ts` | NEW — rich-member helper that seeds `intake_data` |
| `tests/e2e/helpers/index.ts` | export `createProfileApplication` + types |
| `tests/e2e/pbv-finalization-acceptance.spec.ts` | NEW — Playwright acceptance (one describe per profile, mirrors PRD-30 shape) |
| `tests/e2e/pbv-finalization-acceptance-integrity.spec.ts` | NEW — Vitest DB-level integrity per submitted profile |
| `tasks/WALKTHROUGH_RECIPE.md` | appended "PBV Finalization Acceptance" section |
| `docs/build-reports/61-pbv-finalization-e2e-gate_build-report_2026-05-20.md` | THIS report — FINAL + consolidated batch checklist |

No product code touched. No `lib/pbv/*` changes. No schema. No migration.

---

## Conditional-form IDs confirmed against the canonical set (Step 0)

Per-form keys (after PRD-55 + PRD-55b reconciliation):

| Trigger | Form `form_id` | `generation_enabled` (target post-batch) |
|---|---|---|
| `intake_has_pets` | `pet_addendum` | **FALSE** (Alex deferred — source PDF missing) |
| `intake_has_vehicle` | `vehicle_addendum` | **FALSE** (Alex deferred — source PDF missing) |
| `household_has_self_employment` | `self_employment_worksheet` | **FALSE** (Alex deferred — source PDF missing) |
| `household_has_child_support` | `child_support_affidavit` | TRUE |
| `household_no_child_support` | `no_child_support_affidavit` | TRUE |

So Profile C's `intake_data.pets.has_pets`, `intake_data.vehicle.has_vehicle`, and member `has_self_employment` all fire their conditional rules, but the addenda still do NOT appear in `generated[]` because the templates are disabled. This is the expected (Alex-confirmed) state for v1 and is encoded in the fixture as `would_generate_if_sources_present_currently_disabled`.

**Cross-PRD flag (residual defect #1):** Profile C cannot fully validate DoD-3 for conditional addenda until pet/vehicle/self-employment PDFs are sourced. Listed in the residual-defect log in `WALKTHROUGH_RECIPE.md` under "Deferred." The conditional-rule *predicates* are still verified (the inputs are gathered + the rule fires) — what's missing is the template output. When PDFs are sourced and templates re-enabled, update each fixture's `expected_forms.generated` to include the addenda and re-run.

---

## Intake-capture gap analysis (PRD-55 / PRD-57 cross-PRD)

The acceptance helper `createProfileApplication` seeds `intake_data` directly via `supabaseTestClient.update()` and writes member flags (`has_self_employment`, `has_child_support`) directly on `pbv_household_members`. This sidesteps the intake UI entirely.

Why: this is acceptance scaffolding, not an intake regression suite. PRD-57 covers intake. Seeding `intake_data` directly lets us verify the **conditional-rule + form-generation lane** without coupling the closeout to whatever the intake UI happens to ask. If the intake UI later drops a question that conditional rules depend on, PRD-57's gates catch it; PRD-61's profiles still describe the *expected* shape of `intake_data`.

No gaps that block this closeout. The fixtures' `intake_data` shape matches what `conditional-rules.ts` reads. If a future intake change renames a key (e.g. `pets.has_pets` → `pet_section.owns_any`), update the fixtures to match.

---

## Static Gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1a: TypeScript (`node ./node_modules/typescript/bin/tsc --noEmit`) | ✅ PASS | Clean — no errors in any of the new spec/fixture/helper files. |
| Gate 1b: `npm run build` | ✅ PASS | Clean. |
| Gate 2: PRD-55b completeness guard (regression check from this batch) | ✅ PASS | 7/7 tests pass with `criminal_background_release` + `eiv_guide_receipt` in the active set. |
| Gate 3: Playwright spec wired + types | ✅ PASS | Spec compiles; serial mode; one describe per profile. Live UI execution depends on a reachable `TEST_BASE_URL` + dev server; in-session execution is part of the deferred runtime gate (no dev server reachable from this run). |
| Gate 4: Vitest integrity spec wired | ✅ PASS | Compiles + types clean. Each describe-block defensively returns when the profile hasn't been submitted yet, so running the integrity spec without the Playwright spec first produces a clear skip rather than a noisy false failure. **Note:** the integrity specs live under `tests/e2e/`, which Vitest's default `include` does NOT cover — they run via the PRD-30 convention of `npx vitest run tests/e2e/pbv-finalization-acceptance-integrity.spec.ts`, not by the default `npx vitest` invocation. This matches the existing `pbv-form-execution-package-integrity.spec.ts` pattern. |
| Gate 5: Recipe + checklist exists | ✅ PASS | `tasks/WALKTHROUGH_RECIPE.md` has the "PBV Finalization Acceptance" section with the EN/ES/PT × profile matrix, the DoD-1…DoD-7 → proof mapping, and the residual-defect log. |

---

## Deferred Runtime Gates — Consolidated Batch Checklist

This is the single list Alex executes after deploying the merged batch. Each item references its originating PRD/build-report. Mark with ✅ / OUT-OF-LANE / Deferred as it's run.

### From PRD-55 + PRD-55b (form generation)

- [ ] **G-55.1** On a deploy with the PRD-55 migration applied: `briefing_cert/<lang>` appears in `generated[]` not `skipped[]` on `/sign/summary` walk.
- [ ] **G-55.2** Verify remaining `skipped[]` only contains intentional skips after applying both PRD-55 and PRD-55b migrations.
- [ ] **G-55b.1** Apply migration `20260521000000_prd55b_form_sourcing_corrections.sql` deliberately. Then walk an application that requires `criminal_background_release` and confirm it appears in `generated[]` with fields stamped. Visual compare against `docs/templates/criminal-background-release-en-filled.pdf`.
- [ ] **G-55b.2** Same deploy: `eiv_guide_receipt` in `generated[]` for both `en` and `es` (single-page receipt for ES; signature page only).
- [ ] **G-55b.3** Same deploy: `insurance_settlement` and `cd_trust_bond` do NOT appear in either `generated[]` or `skipped[]` (now `generation_enabled=FALSE`).
- [ ] **G-55b.4** Post-migration: query `pbv_form_templates` for those four rows and confirm the live state matches the inferred pre-state (Step 0 verification).

### From PRD-56 (signing + submission)

- [ ] **G-56.1 (R1)** Deployed walk: single adult completes summary → all forms → submit; `pbv_signature_events` rows have `document_hash`, IP, UA, ceremony.
- [ ] **G-56.2 (R2)** 2-adult household via same-device and member-token; both reach signed; `device_owner` correct.
- [ ] **G-56.3 (R3)** After submit, reload is read-only; mutation endpoints return 409; finalize replay returns 200.
- [ ] **G-56.4 (R4)** "Download my application copy" returns packet with signed forms + summary + signatures table.

### From PRD-57 (intake integrity)

- [ ] **G-57.1 (R1)** Tenant device walk: no pre-selected protected-status answers (race / ethnicity / disability / dv).
- [ ] **G-57.2 (R2)** Section number stable as conditional sections appear/disappear.

### From PRD-58 (documents clarity + gating)

- [ ] **G-58.1 (R1)** Live walk with wage/checking test token — honest in-progress banner pre-submit.
- [ ] **G-58.2 (R2)** "Application Submitted" badge only appears after finalize.
- [ ] **G-58.3 (R3)** Documents page asks only matching docs (no SSI/TANF/Immigration for wage-only).
- [ ] **G-58.4 (R4)** Dashboard counts match documents page (22 vs 31 discrepancy resolved).
- [ ] **G-58.5 (R5)** EN/ES/PT label parity on documents step.

### From PRD-59 (trilingual e2e)

- [ ] **G-59.1 (Gate 7)** SMS-link → submit walked in EN, ES, PT on a deploy — UI in `preferred_language`, ES stamped forms for `es`/`pt`, summary in own language incl. `pt`.
- [ ] **G-59.2 (Gate 8)** ES stamped-form visual fidelity check on a deploy.

### From PRD-60 (scanner + low-contrast hint)

- [ ] **G-60.1 (R1)** Hint fires within ~3.5s on real low-contrast scene.
- [ ] **G-60.2 (R2)** Hint clears instantly on quad lock.
- [ ] **G-60.3 (R3)** iOS Safari (current + iOS 16) — Scanic loads, detects, captures.
- [ ] **G-60.4 (R4)** Android Chrome — Scanic loads, detects, captures.
- [ ] **G-60.5 (R5)** Fast-3G cold-load time to first quad overlay.
- [ ] **G-60.6 (R6)** 5-min open heap stable, `window.__scanicInstance` reused.
- [ ] **G-60.7 (R7)** 375px width + 200% root font — hint + controls reflow.

### From PRD-61 (closeout — this report)

- [ ] **G-61.1 (Gate 5)** EN/ES/PT × Profile-A/B/C matrix in `tasks/WALKTHROUGH_RECIPE.md` completed against the deployed merged batch with prod test tokens (read-only on prod; submit only on preview). 9 cells total. No i18n placeholder leakage.
- [ ] **G-61.2 (Gate 6)** PRD-60 device-matrix walk completed (cross-ref G-60.3 / G-60.4).
- [ ] **G-61.3** Automated acceptance + integrity specs run green against the deployed preview (`TEST_BASE_URL=<preview-url>`).

---

## Decisions Logged to OPEN-DECISIONS.md (PRD-61)

| PRD | Title | Type | Default |
|---|---|---|---|
| PRD-61 | O1 — fourth profile (zero-income / eligible-non-citizen variant) | DECISION | Three profiles only. Logged for Alex if a fourth is wanted. |
| PRD-61 | O2 — prod-token walk submit vs read-only | DECISION | Read-only on prod tokens; full submit only against a fresh preview application. |
| PRD-61 | O3 — ES/PT placeholder leakage at deploy | DECISION | Run Gate 5 against whatever is deployed and log placeholder leakage as a residual defect (not a lane blocker). Aligns with Alex's 2026-05-21 "ship best-effort" resolution on summary/consent prose. |

---

## Prod Migrations to Apply (FROM THE WHOLE BATCH — re-emphasize for Alex)

These are listed in full in `docs/fullApp-Plan/OPEN-DECISIONS.md`. Recap:

1. ✅ **Applied 2026-05-20:** `supabase/migrations/20260520000000_prd55_form_generation_alignment.sql` (rename `briefing_docs_certification` → `briefing_cert`; disable pet/vehicle/self-emp/criminal_background_release).
2. ⏳ **Pending — apply deliberately after review:** `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql` (re-enable `criminal_background_release` + `eiv_guide_receipt`; disable `insurance_settlement` + `cd_trust_bond`). Partially reverses item 1.

PRD-61 itself adds no migration.

---

## PR

To open at commit time (per PRD-61 D1 / batch protocol): `feat/pbv-full-finalization` → `main`, **Ready for Review, do NOT merge.** PR body links to this report + `OPEN-DECISIONS.md`.

---

## What "done" looks like for the lane

The lane ships when (per `WALKTHROUGH_RECIPE.md` § Acceptance signoff):

1. Every checkbox in the consolidated checklist above is ✅ or has an OUT-OF-LANE / Deferred entry in the residual-defect log.
2. No residual defect is severity BLOCKER with status Open.
3. The automated acceptance + integrity specs pass against the deployed preview.

PRD-61 is the closeout — there's nothing after this in the batch.
