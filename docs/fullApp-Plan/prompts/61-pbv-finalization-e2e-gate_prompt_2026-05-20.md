# Windsurf Build Prompt — PRD-61: End-to-End Finalization Gate (Closeout)

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/61-pbv-finalization-e2e-gate_prd_2026-05-20.md`. Read it next.

**This is the LAST PRD of the batch.** PRDs 55–60 fixed the lane one surface at a time. PRD-61 proves the whole lane holds together: it builds the acceptance evidence for the roadmap's "Definition of Done" (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md` §Definition of Done — read it). Most of the inline work is **test code + a checklist/recipe doc**. The full multilingual walk is **deferred** to the post-run pass (it needs a deployed merged batch + the prod test tokens). PRD-61 adds **no app code, no schema, no migration** — tests + docs + the PR only.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (already created off `main`; already carries the PRD-55…60 commits). Do **not** create a per-PRD branch.
- One commit when done: `PRD-61: end-to-end finalization gate (closeout)`.
- **Depends on PRD-55–60** — they are all already committed on this branch. Read their build reports (`docs/build-reports/55…60-*_build-report_2026-05-20.md`) before starting; that's where the deferred runtime gates you must consolidate live.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- **No product migration in this PRD.** Tests use the existing test DB via `tests/e2e/helpers/supabaseTestClient.ts` (no mocks — `docs/verification-methodology_2026-05-13.md`). Do not apply or write any prod migration. No DROP/DELETE/TRUNCATE/un-WHERE'd UPDATE.
- `.git/config` is **not** broken (verified 2026-05-20) — don't "fix" line 23. If git genuinely errors, log a BLOCKER.

---

## What you're proving (read the PRD DoD table for the full mapping)

The lane is "done" when a real applicant goes SMS link → intake → upload → sign → submit a complete, correct, signed packet, on their own phone, in their own language, **without calling Stanton** and **without a tenant-safety defect.** That decomposes into DoD-1…DoD-7. You build:

- **Automated acceptance** (static) for DoD-1…DoD-5 across three household profiles.
- A **documented manual recipe** (deferred runtime gate) for DoD-6 (trilingual) and DoD-7 (scanner).
- An **acceptance checklist** + **consolidated post-run gate list** for the whole batch.

---

## The infra you extend (confirmed in code 2026-05-20)

- `playwright.config.ts` — `testDir: ./tests/e2e`, serial (`workers: 1`), projects `chromium-desktop` + `chromium-mobile` (iPhone SE), `baseURL` from `TEST_BASE_URL`.
- `tests/e2e/pbv-form-execution-happy-path.spec.ts` — the 11-step Maria (PT) journey. **Mirror this shape**, one describe-block per profile.
- `tests/e2e/pbv-form-execution-package-integrity.spec.ts` — Vitest, 12 DB assertions on the submitted app. **Mirror this** for per-profile integrity.
- Helpers in `tests/e2e/helpers/` (re-exported from `index.ts`): `createTestApplicationWithIntake` (arbitrary `members[]` — build profiles with this), `fillMariaIntake`, `triggerGenerateForms`, `signSummary`, `signAllFormsForMember`, `triggerAndExtractMagicLink`, `exportSubmissionPackage`, `supabaseTestClient`, `cleanupTestData`.
- `tests/fixtures/maria-household.json` — the fixture shape to copy (`application`, `members[]`, `conditionals`, `expected_forms`, `expected_signers`).
- `lib/pbv/conditional-rules.ts` — the rule predicates: `intakeHasPets` (`intake_data.pets.has_pets`), `intakeHasVehicle` (`intake_data.vehicle.has_vehicle`), `householdHasSelfEmployment` (member `has_self_employment`), child-support pair via `isMutuallyExclusivePair`.
- `tasks/WALKTHROUGH_RECIPE.md` — the team's manual-walk methodology; **append** to it, don't rewrite.

---

## Step-by-step

### Step 0 — Read the DB truth + the prior build reports
Query `pbv_form_templates` for the canonical `form_id` set (PRD-55 may have reconciled keys — use what's now in the DB). Confirm the conditional-form `form_id`s (`pet_addendum` / `vehicle_addendum` / `self_employment_worksheet` are the [Inference] names — align fixtures to the actual DB rows). Read build-reports 55–60 for their deferred runtime gates (you consolidate them in Step 5).

### Step 1 — Three profile fixtures
Author `tests/fixtures/profile-a-single-adult.json`, `profile-b-multi-adult.json`, `profile-c-conditional.json` in the `maria-household.json` shape, each with `expected_forms` (generated + `not_generated`) and `expected_signers`:
- **A** — single adult, employment income, EN. No conditional triggers; child-support pair → `no_child_support_affidavit` only. This is also the **control** for Profile C (no pet/vehicle/self-emp forms).
- **B** — 2+ adults (HOH + one additional signer), EN. Sets up the multi-signer path.
- **C** — household with `pets.has_pets`, `vehicle.has_vehicle`, and a member `has_self_employment` so all three conditional rules fire.

If real intake doesn't collect one of C's inputs (check PRD-55/57 surface), seed `intake_data` directly via the helper and **log the gap as a cross-PRD flag** (PRD-55/57) in the build report and OPEN-DECISIONS. Do not stop.

### Step 2 — Acceptance Playwright spec
`tests/e2e/pbv-finalization-acceptance.spec.ts`: one serial describe per profile, mirroring the PRD-30 happy-path (create via `createTestApplicationWithIntake` → fill/seed intake → `triggerGenerateForms` → assert generated set == fixture `expected_forms` → `signSummary` + `signAllFormsForMember` → finalize → assert `signing_status='complete'` + `submitted_at`). Profile B adds a member-token signer via `triggerAndExtractMagicLink` and asserts `device_owner` (`hoh_device` vs `self`) and `collected_signer_member_ids ⊇ required_signer_member_ids` per form before submit succeeds (PRD-56 canonical model). Run the happy-path of each profile at the `chromium-mobile` project too (production is mobile).

### Step 3 — Vitest package-integrity per profile
`tests/e2e/pbv-finalization-acceptance-integrity.spec.ts` (Vitest, no browser): per submitted profile assert exact form count vs fixture, conditional forms present/absent as expected (C present, A absent), every `pbv_signature_events` row has `document_hash`, ceremony grouping per signer, `signing_status='complete'`, and the post-submit lock (a mutation endpoint returns 409 `submitted_locked`). Reuse `exportSubmissionPackage` + `supabaseTestClient`; **no mocks**.

### Step 4 — Acceptance checklist + extended recipe (the deferred gate)
Append a **"PBV Finalization Acceptance"** section to `tasks/WALKTHROUGH_RECIPE.md`:
- The EN/ES/PT × Profile-A/B/C matrix, run on a deploy with the prod test tokens, via the Chrome DevTools method (navigate `/pbv-full-app/<token>`, read the live `generate-forms` response body for the form set, walk to submit, confirm packet download).
- The DoD-1…DoD-7 → proof mapping.
- A residual-defect log table: each defect is **fixed** or **OUT-OF-LANE** (source-pending forms, staff/HACH side, `tenant_lookup`, Scanic).
- Prod test tokens: `222-224-maple-ave-unit-2n-fa62844782fa4266b5cc1697bfbf734c` (11/11, clean) and `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` (1/13, partial). Walk **read-only** on prod (read `generate-forms`, walk UI, stop before destructive submit); full submit only against a fresh non-prod app on the preview (default O2).

### Step 5 — Batch closeout: final build report + PR
- Build report at `docs/build-reports/61-pbv-finalization-e2e-gate_build-report_2026-05-20.md`. This is the **FINAL** report — it must also **consolidate every deferred runtime gate from build-reports 55–60 into one post-run verification checklist** (so Alex has a single list to execute after deploy).
- Confirm `docs/fullApp-Plan/OPEN-DECISIONS.md` is **complete**: every default logged (incl. O1–O3 here), every committed-but-unapplied migration from the batch listed under "Prod migrations to apply."
- Commit `PRD-61: …`.
- **Open the single PR:** `feat/pbv-full-finalization` → `main`, **Ready for Review, do NOT merge.** Alex reviews.

---

## Files to create / modify

| File | Change |
|---|---|
| `tests/fixtures/profile-a-single-adult.json` | new — single adult, wage income, expected form set |
| `tests/fixtures/profile-b-multi-adult.json` | new — multi-adult, additional-signer expectations |
| `tests/fixtures/profile-c-conditional.json` | new — pet + vehicle + self-employment triggers + conditional forms |
| `tests/e2e/pbv-finalization-acceptance.spec.ts` | new — Playwright, one describe per profile (PRD-30 shape) |
| `tests/e2e/pbv-finalization-acceptance-integrity.spec.ts` | new — Vitest, package integrity per profile |
| `tasks/WALKTHROUGH_RECIPE.md` | append "PBV Finalization Acceptance" section (matrix + DoD checklist + residual-defect log) |
| `tests/e2e/helpers/*` + `helpers/index.ts` | only if `createTestApplicationWithIntake` can't express a profile — add the minimal helper + re-export |
| `docs/build-reports/61-…_build-report_2026-05-20.md` | FINAL report + consolidated post-run checklist |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | confirm complete; log O1–O3 if defaults taken |

## Files NOT to touch

- Any **product code** — app routes, components, `lib/pbv/*`, schema. PRD-61 is tests + docs + the PR. If a test surfaces a real defect, **log it as a residual defect** for the checklist; do not fix product code here.
- The conditional-rule logic (`conditional-rules.ts`) — read it to align fixtures; don't change it.
- EN/ES/PT summary content (PRD-59 / Alex+Dan dependency) — the recipe runs against whatever is deployed; do not author content.
- The existing PRD-30 specs (`pbv-form-execution-*`) — extend the pattern in new files, don't edit them.

---

## Verification gates (per PRD-61)

**Static (must pass in-session before commit):**
- **Gate 1:** new acceptance specs type-check (`tsc --noEmit`); the **Vitest** package-integrity portion passes against the test DB. The **Playwright** UI portion compiles + is wired; if a running dev server isn't available in-session, its live execution is part of the deferred pass — say which is which in the build report.
- **Gate 2:** each fixture's `expected_forms` matches `triggerGenerateForms` output; Profile C generates the three conditional forms; Profile A (control) does not.
- **Gate 3:** `tsc --noEmit` + `npm run build` clean.
- **Gate 4:** `tasks/WALKTHROUGH_RECIPE.md` has the finalization-acceptance section with the EN/ES/PT × profile matrix, the DoD→proof mapping, and the residual-defect log.

**Deferred to the post-run runtime pass (list in the build report, do NOT block — needs a deploy of the merged batch + prod test tokens):**
- **Gate 5 (DoD-6):** SMS-link → submit walk in each of EN/ES/PT for the three profiles, via Chrome DevTools, reading the live `generate-forms` response; no i18n placeholder leakage; packet correct per language.
- **Gate 6 (DoD-7):** the PRD-60 device-matrix + low-contrast-hint walk on real iOS + Android (cross-ref PRD-60's deferred gates).
- **Gate 7:** every deferred runtime gate from build-reports 55–60, executed on the deployed merged batch — the consolidated closeout checklist.

---

## What "done" looks like

1. `PRD-61: …` commit on `feat/pbv-full-finalization`. No product migration.
2. Static gates 1–4 green.
3. Three profile fixtures + an acceptance Playwright spec + a Vitest integrity spec, asserting correct generated-form set, signing completion, and submit + lock per profile.
4. `WALKTHROUGH_RECIPE.md` extended with the EN/ES/PT × profile acceptance matrix, the DoD→proof checklist, and the residual-defect log.
5. Final build report written, with the consolidated post-run gate checklist for the whole batch (55–61).
6. `OPEN-DECISIONS.md` complete for Alex.
7. **Single PR opened** (`feat/pbv-full-finalization` → `main`, Ready for Review, **not merged**).

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (O1–O3 are pre-framed defaults).
- Do not add product code, schema, or a migration. Do not fix product defects inline — log them as residual defects.
- Do not run the deployed multilingual or device-matrix walk in-session — defer Gates 5–7 to the build report.
- Do not submit a destructive prod application on the test tokens — observe read-only on prod (default O2).
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23.
- **Do not merge the PR.** Open it Ready for Review and stop.

## Reporting back (in the FINAL build report)

- Commit SHA. (No migration from this PRD.)
- The three profiles + what each acceptance assertion covers; which gates ran static vs. were wired-but-deferred (Playwright UI).
- Conditional-form `form_id`s confirmed against the DB (Step 0); any fixture realignment.
- Any PRD-55/57 intake-capture gaps found while wiring Profile C.
- Decisions logged to OPEN-DECISIONS (O1 fourth profile, O2 read-only-vs-submit on prod, O3 ES/PT placeholder).
- **The consolidated post-run verification checklist** rolling up the deferred runtime gates from build-reports 55–60 + Gates 5–7 here — one list for Alex to execute after deploy.
- Confirmation the single PR is open (Ready for Review, not merged) and OPEN-DECISIONS is complete.
