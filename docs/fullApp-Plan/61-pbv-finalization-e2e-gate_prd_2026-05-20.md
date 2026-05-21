# PRD-61 — End-to-End Finalization Gate (Closeout)

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization` (one cumulative batch branch — no per-PRD branch)
**Status:** Draft — ready for build
**Severity:** P1 — closeout gate (this is the acceptance evidence that the whole tenant lane is "done"; a gap here means the lane shipped on faith)
**Depends on:** PRD-55 (form generation), PRD-56 (signing/submit), PRD-57 (intake safety), PRD-58 (documents), PRD-59 (trilingual), PRD-60 (scanner) — **all of them.** This is the last PRD of the batch.
**Blocks:** Nothing. This is the closeout. Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`).

---

## Problem Statement

The batch (PRDs 55–60) fixes the lane one surface at a time, each with its own static gates and its own deferred runtime gate. Nobody has proven the **whole** lane holds together in one walk. The roadmap's "Definition of Done (the lane)" is a single sentence:

> **A real applicant can go from the SMS link to a complete, correct, submitted, signed packet — on their own phone, in their own language — without calling Stanton, and without hitting a tenant-safety defect.**

That sentence decomposes into 7 concrete criteria (roadmap §"Definition of Done"). No single PRD verifies it end-to-end across representative households, and the trilingual runtime walk (PRD-59) can only run on a deployed build with the whole batch merged — which does not exist mid-batch.

PRD-61 builds the **acceptance evidence** for that definition. Most of the inline work is **test code + a checklist/recipe doc**; the actual full multilingual walk is **deferred** to the post-run verification pass (it needs a Vercel preview with PRDs 55–60 merged and the prod test tokens). This PRD also doubles as the batch's closeout: it rolls every deferred runtime gate from build-reports 55–60 into one post-run checklist and opens the single PR.

---

## What "done" decomposes into (roadmap §Definition of Done)

| # | Criterion | Owning PRD | Proof PRD-61 builds |
|---|---|---|---|
| DoD-1 | Intake completable without confusing/unsafe defaults, EN/ES/PT | 57 | acceptance-suite intake assertions + recipe step |
| DoD-2 | Documents step asks only what answers imply, plain language | 58 | intake-gated doc-set assertion per profile |
| DoD-3 | Every required form generates, data stamped, no silent skips | 55 | exactly-correct generated-form-set assertion per profile |
| DoD-4 | One signature applies to every form the signer owns; additional adults sign | 56 | signing-completion assertion (multi-adult profile) |
| DoD-5 | Submit → locked → tenant downloads copy | 56 | submit + lock + packet assertion |
| DoD-6 | All of the above works EN/ES/PT | 59 | **deferred** trilingual runtime walk (recipe) |
| DoD-7 | Scanner captures on real phones + tells tenant why when it can't | 60 | **deferred** device-matrix walk (recipe; cross-ref PRD-60 gates) |

DoD-1 through DoD-5 get **automated acceptance assertions** (static). DoD-6 and DoD-7 are **inherently runtime/device** and are documented in the recipe as the deferred gate — they cannot run in-session.

---

## Current state (verified in code 2026-05-20)

| Item | Where | Notes |
|---|---|---|
| Playwright config | `playwright.config.ts` | `testDir: ./tests/e2e`, serial (`workers: 1`), projects `chromium-desktop` + `chromium-mobile` (iPhone SE 375×667), `baseURL` from `TEST_BASE_URL` |
| Vitest config | `vitest.config.ts` | node env, globs `lib/**/*.test.ts` + `components/**/__tests__/**`; **does not** pick up `tests/e2e` — package-integrity specs run under Vitest separately (PRD-30 pattern) |
| Existing E2E happy path | `tests/e2e/pbv-form-execution-happy-path.spec.ts` | 11-step Maria (PT) journey: lang → intake (API) → generate → sign → submit → package-hash. The template to extend. |
| Existing package-integrity | `tests/e2e/pbv-form-execution-package-integrity.spec.ts` | Vitest, 12 DB assertions against the submitted app (form count, signer/ceremony, hashes, language) |
| Test helpers | `tests/e2e/helpers/` | `createMariaApplication`, `createTestApplication(WithIntake)`, `fillMariaIntake`, `triggerGenerateForms`, `signSummary`, `signAllFormsForMember`, `triggerAndExtractMagicLink`, `exportSubmissionPackage`, `supabaseTestClient`, `cleanupTestData`, `adminRejectDocument` — re-exported from `helpers/index.ts` |
| Fixtures | `tests/fixtures/` | `maria-household.json` (5-person, PT, `expected_forms`/`expected_signers` blocks), real PDFs/JPEGs for uploads |
| Conditional-form rules | `lib/pbv/conditional-rules.ts` | `intakeHasPets` (`intake_data.pets.has_pets`), `intakeHasVehicle` (`intake_data.vehicle.has_vehicle`), `householdHasSelfEmployment` (member `has_self_employment`), child-support pair via `isMutuallyExclusivePair` |
| Generate-forms endpoint | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | `triggerGenerateForms` POSTs here; returns `application_id`, writes `pbv_form_documents` |
| Walkthrough recipe | `tasks/WALKTHROUGH_RECIPE.md` | the team's manual-walk methodology (Chrome DevTools, happy-path-first, defect template). PRD-61 **extends** it with a finalization-acceptance section. |
| Verification methodology | `docs/verification-methodology_2026-05-13.md` | save-path test standards (no mocks, real PGlite/Supabase, drift check) |

**[Unverified] — must be confirmed by this build:**
- Whether the helpers expose a single-adult and a multi-adult builder, or whether they assume the Maria fixture shape. `createTestApplicationWithIntake` takes an arbitrary `members[]` array, so new profile fixtures are likely buildable without new helpers — confirm.
- Whether intake actually captures `pets.has_pets` / `vehicle.has_vehicle` / member `has_self_employment` (PRD-55/57 surface). If a conditional input isn't collected, the conditional-forms profile can't trigger it via the real intake path — the profile must then seed `intake_data` directly and the gap is logged (cross-ref PRD-55/57).
- Whether ES/PT summary content exists or is still placeholder (PRD-59 dependency: Alex+Dan+translator author it). The trilingual recipe runs against whatever content is deployed; PRD-61 does not author content.

---

## Goals

1. An automated acceptance suite (Playwright happy-path + Vitest package-integrity, matching the PRD-30 pattern) covering **three representative household profiles**, each asserting the correct generated-form set, signing completion, and successful submission + lock.
2. A documented **manual runtime walkthrough recipe** (extends `tasks/WALKTHROUGH_RECIPE.md`) for EN/ES/PT × the three profiles, run on a deploy with the two prod test tokens, using the Chrome DevTools method (read the `generate-forms` response, walk to submit). This is the **DEFERRED** runtime gate.
3. An **acceptance checklist** mapping each "Definition of Done" criterion (DoD-1…DoD-7) to its proof, with a place to log every residual defect as either **fixed** or explicitly **OUT-OF-LANE** (staff/HACH side, source-pending forms).
4. The batch closeout: a single **post-run verification checklist** consolidating the deferred runtime gates from build-reports 55–60 into one place, plus opening the single PR.

## Non-goals

- No new app code, no schema change, no migration. PRD-61 is tests + docs + the PR. (If a test surfaces a real defect, log it as a residual defect for the checklist; do not expand scope to fix product code here.)
- Does not author EN/ES/PT summary content (PRD-59 dependency on Alex+Dan).
- Does not run the deployed multilingual walk or the device-matrix walk in-session — those are the deferred gate (no deploy mid-batch).
- Does not re-test surfaces already covered by PRDs 55–60's own static gates; PRD-61 asserts the **composite** behavior, not each unit.
- Does not test staff/admin/HACH review surfaces (out of lane).

---

## The three representative profiles

Each is a fixture in `tests/fixtures/` (mirroring `maria-household.json`'s shape: `application`, `members[]`, `conditionals`, `expected_forms`, `expected_signers`) plus assertions in the acceptance specs. Built via `createTestApplicationWithIntake` (arbitrary `members[]`) — no new core app code.

| Profile | Household | Triggers | Asserts |
|---|---|---|---|
| **A — single adult, wage income** | 1 adult, employment income, EN | none conditional; child-support pair → `no_child_support_affidavit` only | minimal correct form set (core forms + no-child-support, no pet/vehicle/self-emp); HOH signs every form once; submit → lock; downloadable packet |
| **B — multi-adult household** | 2+ adults (HOH + additional signer), EN | additional-signer path (same-device + member-token) | both adults' signatures collected (`collected_signer_member_ids ⊇ required_signer_member_ids` per form, per PRD-56 model); `device_owner` correct (`hoh_device` vs `self`); submit blocked until all required signers complete, then locks |
| **C — conditional forms** | household with **pet + vehicle + self-employment** | `intake_has_pets`, `intake_has_vehicle`, `household_has_self_employment` all fire | `pet_addendum`, `vehicle_addendum`, `self_employment_worksheet` all present in the generated set AND signable AND in the submitted packet; a non-triggering control (Profile A) does **not** generate them |

**[Inference]** Profile C's exact `form_id` strings (`pet_addendum` / `vehicle_addendum` / `self_employment_worksheet`) follow the conditional-rule keys in `conditional-rules.ts`; the build must confirm them against the DB `pbv_form_templates.form_id` (canonical per PRD-55 D2) and against whatever PRD-55 reconciled. If a key differs, align the fixture to the DB and note it.

---

## Implementation phases

### Phase 1 — Profile fixtures
- Author three fixtures: `tests/fixtures/profile-a-single-adult.json`, `profile-b-multi-adult.json`, `profile-c-conditional.json`, each in the `maria-household.json` shape with an `expected_forms` block (generated set + `not_generated` set) and an `expected_signers` block.
- Profile C's `conditionals` block sets `pets.has_pets`, `vehicle.has_vehicle`, and a member `has_self_employment` so the three conditional rules fire. If real intake doesn't collect one of these (per the [Unverified] above), the fixture seeds `intake_data` directly via the helper and the gap is logged for PRD-55/57.

### Phase 2 — Acceptance Playwright spec
- `tests/e2e/pbv-finalization-acceptance.spec.ts`: one serial describe-block per profile, each mirroring the PRD-30 happy-path shape (create app → fill/seed intake → `triggerGenerateForms` → assert generated set vs fixture → sign via `signSummary` + `signAllFormsForMember` → finalize → assert `signing_status='complete'` + `submitted_at`).
- Profile B exercises the multi-adult path: HOH same-device sign (`device_owner='hoh_device'`) + a member-token signer via `triggerAndExtractMagicLink` (`device_owner='self'`), asserting `collected ⊇ required` per form before submit succeeds.
- Run at the mobile project (iPhone SE) for at least the happy-path of each profile — production is mobile (PRD-21 D4).

### Phase 3 — Vitest package-integrity per profile
- `tests/e2e/pbv-finalization-acceptance-integrity.spec.ts` (Vitest, PRD-30 pattern): for each submitted profile, assert exact form count vs fixture, the conditional forms present/absent as expected, every `pbv_signature_events` row has `document_hash`, ceremony grouping per signer, `signing_status='complete'`, post-submit lock holds (a mutation endpoint returns 409 `submitted_locked`).
- Reuse `exportSubmissionPackage` + `supabaseTestClient`; no mocks (per `docs/verification-methodology_2026-05-13.md`).

### Phase 4 — Acceptance checklist + extended walkthrough recipe (the deferred gate)
- Append a **"PBV Finalization Acceptance"** section to `tasks/WALKTHROUGH_RECIPE.md`: the EN/ES/PT × Profile-A/B/C matrix, run on a deploy with the prod test tokens, via the Chrome DevTools method (navigate `/pbv-full-app/<token>`, read the `generate-forms` response body for the form set, walk through to submit, confirm packet download). Include the DoD-1…DoD-7 → proof mapping and a residual-defect log table (fixed / OUT-OF-LANE).
- Test tokens for the runtime walk (read-only happy-path observation; do not submit a prod app destructively):
  - `222-224-maple-ave-unit-2n-fa62844782fa4266b5cc1697bfbf734c` — 11/11 docs, clean happy path.
  - `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` — 1/13 docs (partial state).

### Phase 5 — Batch closeout
- Write the final build report (it consolidates all deferred runtime gates from build-reports 55–60 into one post-run checklist — see Verification).
- Confirm `OPEN-DECISIONS.md` is complete for Alex (all logged decisions, all migrations-to-apply listed).
- Open the **single** PR: `feat/pbv-full-finalization` → `main`, Ready for Review. **Do not merge.**

---

## Verification / test plan

**Static (run inline, before commit — these are the new tests + the build):**

- **Gate 1 (suite compiles + integrity passes):** the new acceptance specs type-check (`node ./node_modules/typescript/bin/tsc --noEmit`) and the **Vitest package-integrity** portion passes against a reachable test DB (PRD-30 pattern — the Vitest assertions run without a browser). If the full Playwright UI walk needs a running dev server not available in-session, the **Playwright** portion compiles + is wired but its live execution is part of the deferred pass; the Vitest integrity assertions are the static proof. Label which is which in the build report.
- **Gate 2 (profiles correct):** each fixture's `expected_forms` set matches what `triggerGenerateForms` returns; Profile C generates the three conditional forms; Profile A (control) does not.
- **Gate 3 (build clean):** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean.
- **Gate 4 (recipe + checklist exist):** `tasks/WALKTHROUGH_RECIPE.md` has the finalization-acceptance section with the EN/ES/PT × profile matrix, the DoD→proof mapping, and the residual-defect log.

**Deferred to the post-run verification pass (list in the build report; do NOT block — needs a deploy of the merged batch + the prod test tokens):**

- **Gate 5 (DoD-6 trilingual walk):** SMS-link → submit walk in **each** of EN, ES, PT for the three profiles, via Chrome DevTools, reading the live `generate-forms` response. Confirms no i18n placeholder leakage and the packet is correct per language.
- **Gate 6 (DoD-7 scanner):** the PRD-60 device-matrix + low-contrast-hint walk on real iOS + Android (cross-ref PRD-60's own deferred gates; not re-specified here).
- **Gate 7 (consolidated batch gates):** every deferred runtime gate from build-reports 55–60, executed on the deployed merged batch, with each criterion checked off or logged as a residual defect.

---

## Acceptance checklist (DoD → proof)

Lives in the extended `tasks/WALKTHROUGH_RECIPE.md` and is summarized in the final build report. Each row resolves to **fixed** or **OUT-OF-LANE**:

- DoD-1…DoD-5 → green via the automated acceptance suite (Gate 2) + the deferred trilingual walk (Gate 5).
- DoD-6 → deferred trilingual walk (Gate 5).
- DoD-7 → deferred scanner walk (Gate 6, PRD-60).
- **OUT-OF-LANE (logged, not a lane failure):** source-pending forms (VAWA, Reasonable Accommodation, healthcare-provider release — externally blocked per roadmap); staff/admin list-view accuracy, HACH reviewer portal, HACH handoff/print posture; `tenant_lookup` retroactive migration; Scanic detector swap (PRD-52).

---

## Open questions

- **O1:** Do the three profiles cover the acceptance bar, or does Alex want a fourth (e.g. zero-income-only household, or eligible-non-citizen immigration-doc path)? Default: the three named profiles; log if a fourth is wanted.
- **O2:** Should the trilingual runtime walk submit a test application on prod, or observe read-only (read `generate-forms`, walk UI, stop before destructive submit)? Default: **observe read-only** on the prod tokens; full submit only against a fresh non-prod test app on the preview.
- **O3:** ES/PT summary content may still be placeholder at deploy time (PRD-59 dependency). Default: run Gate 5 against whatever is deployed and log placeholder leakage as a residual defect (fixed-later, not a lane blocker), not as a hard failure.

## Decisions

- **D1:** PRD-61 adds **no app code, no schema, no migration** — tests + docs + the PR only. Residual product defects are logged for the checklist, not fixed inline. (Keeps the closeout from becoming an open-ended fix pass.)
- **D2:** The automated suite is the **static** acceptance proof (DoD-1…DoD-5); the trilingual + scanner walks are **deferred** runtime gates (DoD-6, DoD-7) — they need a deployed merged batch and real devices. [Inference] consistent with BATCH-RUN-PROTOCOL's static-now/runtime-later split.
- **D3:** Profiles are built on the existing `createTestApplicationWithIntake` helper (arbitrary `members[]`) and the `maria-household.json` fixture shape — no new harness, per PRD-21 D5 ("match the existing harness").

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `tests/fixtures/profile-a-single-adult.json` | 1 | new — single adult, wage income, expected form set |
| `tests/fixtures/profile-b-multi-adult.json` | 1 | new — multi-adult, additional-signer expectations |
| `tests/fixtures/profile-c-conditional.json` | 1 | new — pet + vehicle + self-employment triggers + conditional form set |
| `tests/e2e/pbv-finalization-acceptance.spec.ts` | 2 | new — Playwright, one describe per profile (PRD-30 shape) |
| `tests/e2e/pbv-finalization-acceptance-integrity.spec.ts` | 3 | new — Vitest, package integrity per profile |
| `tasks/WALKTHROUGH_RECIPE.md` | 4 | append "PBV Finalization Acceptance" section: EN/ES/PT × profile matrix, DoD→proof checklist, residual-defect log |
| `docs/build-reports/61-pbv-finalization-e2e-gate_build-report_2026-05-20.md` | 5 | new — FINAL report + consolidated post-run checklist for the whole batch |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | 5 | confirm complete (O1–O3 logged if defaults taken); no new product migration from this PRD |

If a profile needs a new helper because `createTestApplicationWithIntake` can't express it, add only that helper under `tests/e2e/helpers/` and re-export from `helpers/index.ts`. Anything beyond tests + docs + the PR → stop and log a residual defect rather than expanding scope.
