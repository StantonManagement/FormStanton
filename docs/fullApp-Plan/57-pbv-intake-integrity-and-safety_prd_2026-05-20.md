# PRD-57 — Intake Integrity & Tenant-Safety

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization`
**Status:** Draft — ready for build
**Severity:** P1 — tenant-safety. A DV / reasonable-accommodation survivor who clicks past a pre-selected "No" silently forfeits a protected-status claim. This is not a cosmetic intake-polish PRD.
**Depends on:** nothing (parallel-safe). Improves the data quality consumed by PRD-55 (form generation) and PRD-56 (signing). Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`, gap G5).
**Blocks:** PRD-58 (documents gating reads these intake answers). PRD-55 has a hard cross-dependency on the pets/vehicle capture added here.

---

## Problem Statement

The 2026-05-17 tenant journey (`tasks/TENANT_JOURNEY_2026-05-17.md`, "Intake (7 sections)" + "Review page" + "Defect rollup") found a cluster of intake defects, several of them **tenant-safety** issues, the highest-severity being:

> "No" pre-selected by default on the felony and domestic-violence questions. "A DV survivor could click Next and miss her chance to claim protected status. **Serious defect for tenant safety.**"

Since that walk, code has moved. Grounding in the current tree (read 2026-05-20) shows **several of the 05-17 defects already have fixes in code** that were not yet verified end-to-end on prod. This PRD's job is to **confirm those fixes hold, harden the safety-critical ones, and close the genuinely-open gaps** — not to re-introduce work already done. Each item below is tagged with its current code status.

The genuinely-open work, in priority order: a still-redundant manual annual-income field (the surface behind the historical `annual = 0` bug), missing pets/vehicle capture (a hard PRD-55 cross-dependency — those conditional forms can never trigger today), required-field markers, the fluctuating section count, and asset-value clarity.

---

## Root cause / findings (confirmed in code 2026-05-20)

| Item | Current code status | Where |
|---|---|---|
| Neutral defaults on DV / felony / RA / homeless | **[Verified — already neutral]** `null` initial state, not pre-selected "No" | `components/pbv/intake/SectionDvHomelessRa.tsx:90-97`, `SectionCriminalHistory.tsx:65-69` |
| Next blocked until protected-status answered | **[Verified — gated]** `isSectionComplete` requires a real boolean for `dv_homeless_ra` + `criminal_history` | `lib/pbv/intake-schema.ts:235-246` |
| Review page human-readable enums | **[Verified — formatted]** uses `formatEnumLabel` + `RACE_LABELS`/`ETHNICITY_LABELS`/`MARITAL_STATUS_LABELS`/`INCOME_TYPE_LABELS` | `components/pbv/IntakeDataDisplay.tsx:154-165`, `lib/pbv/format.ts` |
| Review page formatted phone | **[Verified — formatted]** `formatPhone()` | `IntakeDataDisplay.tsx:180-185`, `format.ts:78-88` |
| Single Submit button on review | **[Verified — single]** F7 already removes the footer nav on review | `IntakeShell.tsx:156-158` (footer hidden when `isReviewSection`); `SectionReview.tsx:149-156` (sole button) |
| Annual income auto-computed | **[Partial]** auto-calc on blur exists, but the **manual editable annual field is still rendered** (`annual_was_manually_edited` override path), so the redundant question — the `annual = 0` surface — persists | `SectionIncome.tsx:155-173, 248-265` |
| Pets / vehicle capture | **[Missing — OPEN]** no `pets` / `vehicle` field in `intake-schema.ts` and no section collects them; `intakeHasPets` / `intakeHasVehicle` read `intakeData.pets.has_pets` / `intakeData.vehicle.has_vehicle` which are never set → those forms can never generate | `conditional-rules.ts:55-62`; absent from `intake-schema.ts` + section components |
| Self-employment capture | **[Verified — captured]** derived from the `self_employment` income source per member | `useSectionVisibility.ts:49-52`; income type at `SectionIncome.tsx:39` |
| Required-field markers | **[Partial]** `FormField` supports a `required` asterisk, but `SectionContact` passes none — phones/email show no `*` (a `*`-prefixed note exists but fields are unmarked) | `components/form/FormField.tsx:25-27`; `SectionContact.tsx:92-122` |
| Section count fluctuation | **[Partial]** F9 fixed the denominator (`SECTION_SLUGS` minus review = fixed 10) but the **numerator floats**: `sectionNumber` is `visibleSections.indexOf(slug)+1` over the *visible* list (conditionals excluded), so the displayed N shifts as conditional sections appear/disappear while the total stays 10 | `app/pbv-full-app/[token]/intake/[section]/page.tsx:76-82, 157` |
| Asset value clarity | **[Open — single field]** one "Estimated total asset value" field regardless of how many asset types are checked | `SectionAssets.tsx:117-135` |

**[Inference]** the DV/criminal neutral-default + gating fixes are the most important to *confirm still hold* after this build's edits; do not regress them.

---

## Goals

1. **Tenant safety (highest):** no protected-status question (DV, felony/criminal-history, homelessness, reasonable accommodation) is pre-selected; Next stays blocked until each is explicitly answered. Confirm the current neutral-default + gating behavior holds, and add a regression test so a future edit can't silently re-introduce a default.
2. Required fields are visually marked (asterisk via `FormField required`), and validation is consistent with the marker — the contact phones in particular.
3. The section indicator is stable: a tenant never sees the number jump around as conditional sections appear (e.g. no "1 of 7" → "1 of 9" → "4 of 7").
4. Annual income is derived from monthly; the redundant manual annual-income input is removed so a tenant can no longer leave it at 0.
5. Asset entry is unambiguous when multiple asset types are checked.
6. The review page shows human-readable values and a single Submit button — confirm the in-code fixes render correctly and don't regress.
7. **PRD-55 cross-dependency:** intake collects `pets.has_pets` and `vehicle.has_vehicle` so the pet/vehicle conditional forms can trigger. Self-employment is already captured — confirm only.

## Non-goals

- No change to the documents page, its gating, or the dashboard banner (PRD-58).
- No change to signing, summary, or form generation (PRD-55 / PRD-56) — only the *intake fields* those consume.
- No full ES/PT verification (PRD-59). New copy added here gets EN + best-effort ES/PT placeholders following the existing `// PT: tentative — review` convention; do not regress existing translations.
- No change to the conditional-rule predicates themselves — only the intake fields that feed them.

---

## Implementation phases

### Phase 1 — Protected-status safety (confirm + harden)
- Confirm `SectionDvHomelessRa` and `SectionCriminalHistory` initialize to neutral (`null`), not "No", and that `isSectionComplete('dv_homeless_ra' | 'criminal_history', …)` keeps Next disabled until a boolean is chosen. These are in code today — verify, don't rebuild.
- Add a unit test (vitest, mirror `lib/pbv/__tests__/conditional-rules.test.ts`) asserting `isSectionComplete` returns `false` for `dv_homeless_ra` and `criminal_history` when any protected-status answer is `null`/undefined, and `true` only when all are explicit booleans. This locks the safety behavior against future regression.
- Keep the existing confidentiality copy beneath each question.

### Phase 2 — Required-field markers + consistent validation
- Pass `required` to `FormField` for the inputs that gate `isSectionComplete` (notably the contact phone group — at-least-one-phone). Keep the marker consistent with what actually blocks Next; don't mark fields that don't gate.
- Where a group is "at least one of N required" (phones), mark the group, not each field, matching the existing note pattern in `SectionContact`.

### Phase 3 — Stable section count
- Make the displayed `sectionNumber` and `totalSections` use the same denominator basis so the number can't jump as conditional sections toggle. Pick the most reasonable stable scheme — number within the **always-visible** ordered set with conditional sections shown as sub-steps, OR a fixed max-denominator with the numerator computed against the same fixed list — and apply it consistently in `intake/[section]/page.tsx` + `IntakeShell`. If two reasonable schemes exist, default to the fixed max-denominator (already half-implemented via F9) and align the numerator to it; log the choice in OPEN-DECISIONS.

### Phase 4 — Annual income derived (kill the manual field)
- Remove the manual, editable "Estimated annual income ($)" input from `SectionIncome` and the `annual_was_manually_edited` override path. Keep `annual_income` as a derived value (sum of monthly × 12) computed on amount change, and display it read-only (or as a caption) so the tenant sees the computed figure but cannot set it to 0.
- The review page already computes annual from monthly (`IntakeDataDisplay.tsx:212-217`) — confirm intake and review agree.

### Phase 5 — Asset-value clarity
- Make the asset total unambiguous when multiple asset types are checked. The most reasonable default: keep a single "Estimated total value of all checked assets ($)" field but relabel it to state it's the combined total and show the list of checked asset types inline, so the tenant knows what the one number covers. (Per-asset value inputs are a larger change — if chosen, log it; the single-relabeled-total is the default.)

### Phase 6 — Pets / vehicle capture (PRD-55 cross-dependency)
- Add `pets: { has_pets: boolean }` and `vehicle: { has_vehicle: boolean }` to `IntakeData` in `intake-schema.ts`, with neutral defaults (no pre-selected answer) consistent with the safety pattern.
- Add the inputs to intake. Most reasonable home: a small block in the assets/household area (or a lightweight extra section) — pick one, keep it minimal, and ensure `intakeHasPets`/`intakeHasVehicle` read exactly the keys written (`intakeData.pets.has_pets` / `intakeData.vehicle.has_vehicle`).
- Render both on the review page (`IntakeDataDisplay`).
- Confirm self-employment remains captured via the income source (no new input needed).

### Phase 7 — Review-page confirmation (no regression)
- Confirm enums render via `formatEnumLabel`, phone via `formatPhone`, and exactly one Submit button shows. These are in code; the goal is to not regress them while editing adjacent components.

---

## Verification / test plan

Static gates run in-session; a tenant device walk is deferred to the post-run pass (see batch protocol).

- **Gate 1 (safety — static):** new vitest asserts `isSectionComplete` is `false` for `dv_homeless_ra`/`criminal_history` with any `null` answer and `true` only when all booleans are explicit. Green.
- **Gate 2 (markers — static):** the contact phone group renders a `*`; the marked requirement matches what blocks Next.
- **Gate 3 (section count — static):** for a household with 0 conditional sections and one with all conditional sections, the numerator/denominator scheme yields a non-decreasing, non-jumping display (reason it through; no live walk needed).
- **Gate 4 (annual income — static):** the manual annual input is gone; `annual_income` is derived; intake-computed annual equals review-computed annual for the same monthly inputs.
- **Gate 5 (pets/vehicle — static):** `intake-schema` has `pets.has_pets`/`vehicle.has_vehicle`; the intake inputs write those exact keys; `intakeHasPets`/`intakeHasVehicle` read them; both appear on review.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` clean; existing tests stay green.
- **Deferred (build report, do NOT block):** a real tenant intake walk confirming no pre-selected protected-status answers on device, the section number never jumps, and pets/vehicle answers flow through to PRD-55 form generation on a deployed preview.

---

## Open questions

- **O1:** Section-count scheme — number-within-always-visible-with-sub-steps vs fixed max-denominator. Default to fixed max-denominator (aligns with F9). Log for Alex.
- **O2:** Asset value — single relabeled combined-total (default) vs per-asset value inputs. Default to the relabeled combined total; log if per-asset is wanted later.
- **O3:** Pets/vehicle input placement — extra mini-section vs a block inside an existing section. Default to a minimal block inside an existing section to avoid changing the section count; log.

## Decisions

- **D1:** The neutral-default + gating behavior on protected-status questions is the single highest-priority outcome; it is locked by a regression test, not just left as current behavior. (Resolved 2026-05-20.)
- **D2:** The manual annual-income input is removed (not merely defaulted); annual is always derived from monthly. The historical `annual = 0` bug came from the manual field, so the field goes. (Resolved 2026-05-20.)
- **D3:** Pets/vehicle capture is in scope for PRD-57 (it is an intake field), unblocking PRD-55's pet/vehicle conditional forms. Self-employment is already captured and needs no new input. (Resolved 2026-05-20.)

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/intake-schema.ts` | 1, 6 | add `pets`/`vehicle` to `IntakeData`; add `isSectionComplete` coverage if a new section slug is introduced |
| `lib/pbv/__tests__/intake-schema.test.ts` (new) | 1 | vitest locking protected-status gating |
| `components/pbv/intake/SectionContact.tsx` | 2 | `required` markers consistent with gating |
| `app/pbv-full-app/[token]/intake/[section]/page.tsx` | 3 | stable section numerator/denominator |
| `components/pbv/intake/IntakeShell.tsx` | 3 | consume the stable count |
| `components/pbv/intake/SectionIncome.tsx` | 4 | remove manual annual input + override; keep derived annual |
| `components/pbv/intake/SectionAssets.tsx` | 5 | asset-total clarity (relabel + checked-type context) |
| `components/pbv/intake/Section*` (pets/vehicle) | 6 | add neutral pets/vehicle inputs writing `pets.has_pets`/`vehicle.has_vehicle` |
| `components/pbv/IntakeDataDisplay.tsx` | 6 | render pets/vehicle on review |

If anything outside this list needs changing (documents page, signing, conditional-rule predicates), stop and report rather than expanding scope.
