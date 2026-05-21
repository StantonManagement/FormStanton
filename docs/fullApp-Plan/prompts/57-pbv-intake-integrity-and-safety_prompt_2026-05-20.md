# Windsurf Build Prompt — PRD-57: Intake Integrity & Tenant-Safety

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/57-pbv-intake-integrity-and-safety_prd_2026-05-20.md`. Read it next.

PRD-57 fixes the intake defects from the 2026-05-17 tenant journey, several of which are **tenant-safety** issues. The highest-severity item: on the domestic-violence, felony/criminal-history, homelessness, and reasonable-accommodation questions, **"No" must not be pre-selected** — a DV or accommodation-needing tenant who taps Next on a pre-checked "No" silently forfeits a protected-status claim. Treat this as a safety fix, not intake polish.

**Important — much of the 05-17 list is already fixed in code.** The current tree (read it) already has: neutral `null` defaults + Next-gating on DV/criminal, `formatEnumLabel`/`formatPhone` on review, and a single Submit button (F7). Your job is to **confirm those hold + lock the safety ones with a test**, then close the genuinely-open gaps. Do not rebuild what's done.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (already created off `main` for this batch). Do **not** create a per-PRD branch.
- One commit when done: `PRD-57: intake integrity & tenant-safety`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD is UI/schema-only. Intake data is JSONB (`pbv_full_applications.intake_data`) — adding `pets`/`vehicle` keys needs **no** DB migration. If you find a reason one is needed, write + commit it, do NOT apply to prod, and list it under "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`.

---

## Current code status (verify before editing — see PRD table for line refs)

- **Already neutral + gated:** `SectionDvHomelessRa.tsx`, `SectionCriminalHistory.tsx`, `isSectionComplete` in `lib/pbv/intake-schema.ts`. Confirm, add a lock test, don't regress.
- **Already formatted on review:** `components/pbv/IntakeDataDisplay.tsx` + `lib/pbv/format.ts`. Single Submit via `IntakeShell.tsx` F7. Confirm, don't regress.
- **Still open:** manual annual-income field (`SectionIncome.tsx`), missing pets/vehicle capture (absent from `intake-schema.ts`), unmarked contact fields (`SectionContact.tsx`), floating section numerator (`intake/[section]/page.tsx`), single asset-total field (`SectionAssets.tsx`).

---

## Step-by-step

### Step 0 — Read the tree, confirm status
Open the files in the PRD's findings table and confirm each "current status" tag still matches reality (the tree may have moved again). If a "verified" item has regressed, fix it; if an "open" item is now done, note it and move on.

### Step 1 — Lock protected-status safety (Phase 1)
Confirm DV/criminal sections default to neutral `null` (not "No") and `isSectionComplete` blocks Next until a boolean is set. Add `lib/pbv/__tests__/intake-schema.test.ts` (vitest, mirror `__tests__/conditional-rules.test.ts`): assert `isSectionComplete('dv_homeless_ra', …)` and `('criminal_history', …)` are `false` when any protected-status answer is `null`/undefined and `true` only when all are explicit booleans. This is the single most important deliverable — it stops a future edit silently re-introducing a pre-selected default.

### Step 2 — Required-field markers (Phase 2)
Pass `required` to `FormField` for the inputs that actually gate `isSectionComplete` (the contact phone group first). Keep the `*` consistent with what blocks Next — mark the at-least-one-phone group, not every individual phone. Don't mark non-gating optional fields.

### Step 3 — Stable section count (Phase 3)
The number must not jump as conditional sections toggle ("1 of 7" → "1 of 9" → "4 of 7"). Make `sectionNumber` and `totalSections` share one denominator basis in `intake/[section]/page.tsx` + `IntakeShell.tsx`. **Default (don't stop to ask):** fixed max-denominator (the F9 approach already in place) with the numerator computed against the **same fixed list**, so it's monotonic and stable. Log the scheme under the PRD-57 entry in `OPEN-DECISIONS.md`.

### Step 4 — Derived annual income (Phase 4)
Remove the manual, editable "Estimated annual income ($)" input and the `annual_was_manually_edited` override from `SectionIncome.tsx`. Keep `annual_income` derived (sum of monthly × 12), recomputed on amount change, shown read-only/as a caption. This kills the surface behind the historical `annual = 0` bug. Confirm intake's derived annual equals the review page's computed annual (`IntakeDataDisplay.tsx:212-217`).

### Step 5 — Asset-value clarity (Phase 5)
**Default:** keep one total field but relabel it "Estimated total value of all checked assets ($)" and show the checked asset types inline so the tenant knows what the single number covers. (Per-asset value inputs are a bigger change — only if you go that way, log it.) Don't break the existing `total_asset_value` key the review page reads.

### Step 6 — Pets / vehicle capture (Phase 6 — PRD-55 cross-dependency)
Add `pets: { has_pets: boolean }` and `vehicle: { has_vehicle: boolean }` to `IntakeData` in `intake-schema.ts`, neutral defaults (no pre-selected answer). Add minimal intake inputs writing **exactly** `intakeData.pets.has_pets` / `intakeData.vehicle.has_vehicle` (the keys `intakeHasPets`/`intakeHasVehicle` in `conditional-rules.ts:55-62` read). **Default placement:** a small block inside an existing section (e.g. assets) so the section count is unaffected — log if you add a new section instead. Render both on the review page (`IntakeDataDisplay.tsx`). Self-employment is already captured via the `self_employment` income source (`useSectionVisibility.ts:49-52`) — **confirm only, add no new input.**

### Step 7 — Static gates + build report + commit
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; the new test green; existing tests stay green. Build report at `docs/build-reports/57-pbv-intake-integrity-and-safety_build-report_2026-05-20.md`. Commit `PRD-57: …`. Then proceed to the PRD-58 prompt.

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/intake-schema.ts` | add `pets`/`vehicle` to `IntakeData`; extend `isSectionComplete` only if a new slug is added |
| `lib/pbv/__tests__/intake-schema.test.ts` (new) | vitest locking protected-status gating |
| `components/pbv/intake/SectionContact.tsx` | `required` markers matching gating |
| `app/pbv-full-app/[token]/intake/[section]/page.tsx` | stable numerator/denominator |
| `components/pbv/intake/IntakeShell.tsx` | consume the stable count |
| `components/pbv/intake/SectionIncome.tsx` | remove manual annual input + override; keep derived annual |
| `components/pbv/intake/SectionAssets.tsx` | asset-total clarity |
| `components/pbv/intake/Section*` (pets/vehicle host) | neutral pets/vehicle inputs |
| `components/pbv/IntakeDataDisplay.tsx` | render pets/vehicle on review |

## Files NOT to touch

- Documents page, its gating, the dashboard banner (PRD-58).
- Signing flow, summary, form generation (PRD-55 / PRD-56).
- The conditional-rule predicates in `conditional-rules.ts` (read the keys; do not rewrite them).
- Existing ES/PT copy — add EN + `// PT: tentative — review` placeholders for new strings; do not regress translations (PRD-59 verifies languages).

---

## Verification gates (per PRD-57)

**Static (must pass in-session before commit):**
- **Gate 1:** new vitest — `isSectionComplete` `false` for `dv_homeless_ra`/`criminal_history` with any `null` answer, `true` only when all booleans explicit. Green.
- **Gate 2:** contact phone group renders `*`, consistent with what blocks Next.
- **Gate 4:** manual annual input gone; annual derived; intake-computed annual == review-computed annual.
- **Gate 5:** `pets.has_pets`/`vehicle.has_vehicle` in schema; inputs write those exact keys; `intakeHasPets`/`intakeHasVehicle` read them; both on review.
- **Gate 6:** `tsc --noEmit` + `npm run build` clean; existing tests green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate 3:** on-device, the section number never jumps as conditional sections toggle (reason it through statically now; confirm on a deploy later).
- Tenant intake walk: no pre-selected protected-status answers on a real device; pets/vehicle answers flow through to PRD-55 form generation on a deployed preview.

---

## What "done" looks like

1. `PRD-57: …` commit on `feat/pbv-full-finalization`.
2. Static gates green; new safety test locks the neutral-default + gating behavior.
3. Manual annual-income field removed; annual always derived.
4. Pets/vehicle captured at intake (PRD-55 cross-dependency closed); self-employment confirmed.
5. Required markers, stable section count, asset clarity, review legibility all confirmed and not regressed.
6. Build report written, deferred device gates listed, decisions logged to OPEN-DECISIONS. Proceed to PRD-58.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (section scheme, asset layout, pets/vehicle placement all have defaults above).
- Do not pre-select any answer on a protected-status question, and do not weaken the Next-gating on DV/criminal.
- Do not rebuild the review formatting or the single-Submit-button fix — confirm, don't regress.
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23 — it is not broken. Do not touch documents/signing/forms internals.
- Do not block on deploy-only gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; files changed.
- Confirmation that protected-status defaults are neutral + gated, with the new test green.
- The section-count scheme chosen; asset-layout + pets/vehicle-placement decisions — logged to OPEN-DECISIONS.
- Confirmation pets/vehicle now captured (PRD-55 cross-dependency) + self-employment still captured.
- Static gates pass/fail; deferred device gates for the post-run pass.
