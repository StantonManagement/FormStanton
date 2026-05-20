# Cursor/Windsurf Prompt — PRD-25: Phase 1 Sectioned Intake UI

## Context

The tenant gets a magic link and needs to fill an 11-section intake. They never see form names; their answers will map to 13 federal forms on the back end (PRD-26's job). This pass builds the mobile-first SPA intake.

## Required reading before you start

1. `docs/fullApp-Plan/25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` — § API surface, especially intake/[section] and intake/complete
3. `docs/build-reports/24-pbv-form-execution-data-model-and-api-build-report_2026-05-15.md` — any API contract clarifications
4. `docs/fullApp-Plan/pbv-field-inventory.md` — `## main_application` field list (per-section field mapping comes from here)
5. `app/pbv-full-app/[token]/page.tsx` — existing tenant entry that you're refactoring into a dispatcher
6. `lib/pbvFullAppTranslations.ts` — translation pattern to extend
7. `components/form/FormField.tsx` + `FormButton.tsx` + `FormSection.tsx` + `FormLayout.tsx` + `LanguageLanding.tsx` — primitives to reuse
8. `lib/pbv/conditional-rules.ts` (built in PRD-24) — predicate functions you'll call from `useSectionVisibility`

## Closed decisions (do not relitigate)

- Mobile-first, single-column, vertical layout
- Auto-save on every change (debounce 600ms), no explicit Save button
- 11 sections per PRD-25 §4 table; section slugs match
- Conditional sections (4, 7, 10) appear/disappear dynamically based on `lib/pbv/conditional-rules.ts`
- Three languages: en, es, pt
- Existing FormField/FormButton/FormSection primitives are the building blocks
- Per-adult repeating sections (income, criminal, citizenship) use a one-adult-at-a-time wizard pattern
- Magic-link tenant_access_token unchanged — resume drops at last incomplete section
- Bootstrap GET on app entry returns intake_status, signing_status, language, intake_data shape
- "Pick up later" surfaces SMS resume link via existing PRD-24 `resume` endpoint

## Decisions still open — pick during build, document in build report

- **One file per section vs `[section]/page.tsx` dispatching client components.** Default: `[section]/page.tsx` does the dispatch, individual section components live under `components/pbv/intake/Section*.tsx`. Document choice.
- **SSN field input style** (single masked vs 3 mini-fields). Default: single masked.
- **Whether to show the form-count preview on the intake landing.** Default: do NOT.
- **PT translation source.** Best-effort by Cascade for first pass; professional translation commissioned later. Mark uncertain strings with a code comment `// PT: tentative — review`.

## Build this pass

### Commit 1 — Shell + dispatcher + bootstrap

- Refactor `app/pbv-full-app/[token]/page.tsx` into a dispatcher:
  - Bootstrap fetch on mount
  - Routes to `intake_status` → landing or section
  - Routes to `signing_status` → PRD-26 entry (stub for now: redirect to `/pbv-full-app/[token]/review` which is a 404 placeholder)
  - Routes to existing upload/finalize flow if past signing
- `IntakeShell.tsx` component:
  - Header with section number, progress bar, save status, language switcher, "Pick up later"
  - Children slot for section content
  - Footer with Next/Back buttons
- `SaveStatusIndicator.tsx`
- `PickUpLaterButton.tsx`
- `useIntakeBootstrap.ts`, `useSectionVisibility.ts` hooks
- Commit: `feat(pbv-intake): dispatcher + shell + save indicator`

### Commit 2 — Sections 1-3 (always rendered)

- SectionHousehold:
  - HOH details (name, DOB, SSN masked, race, ethnicity, marital)
  - Household roster builder: add adults one at a time, then minors
  - Per-adult: name, DOB, SSN, relationship, disability, student, citizen
  - Per-minor: name, DOB, SSN, relationship, disability, student, citizen
- SectionContact: phones (home/work/cell with FormPhoneInput), email, alternate contact
- SectionIncome:
  - Per-adult wizard (AdultWizard.tsx primitive)
  - For each adult: 14 income source toggles + amounts where yes
  - Computes the `zero_income_yes` flag for downstream conditional gating
- `useSectionAutoSave.ts` with idempotency-key per save, debounced
- Tests for the hooks and SectionHousehold's roster builder
- Commit: `feat(pbv-intake): sections 1-3 (household, contact, income)`

### Commit 3 — Sections 4-7

- SectionZeroIncomeDecl:
  - Renders only if any adult flagged zero income
  - One declaration block per zero-income adult: how are you supporting yourself + outside contributions
- SectionAssets:
  - Per-asset-type rows (real estate, savings, checking, stocks, CDs, trusts, bonds, life insurance, insurance settlement, asset disposal-last-2yr)
- SectionChildcareDisability:
  - Care4Kids cert toggle
  - Paid-to-relative toggle
  - Disability-assistance care expenses
- SectionMedical:
  - Renders only if HOH/spouse disabled OR 62+
  - Insurance, doctor visits, prescriptions, other
- Tests for conditional rendering
- Commit: `feat(pbv-intake): sections 4-7 (zero-income, assets, childcare/disability, medical)`

### Commit 4 — Sections 8-11

- SectionCriminalHistory:
  - Per-adult yes/no + details
- SectionDvHomelessRa:
  - Q8 VAWA, Q9 homeless-at-admission, Q10 reasonable accommodation
- SectionHouseholdExpenses:
  - Renders only if all-adult zero income
- SectionReview:
  - Read-only summary, grouped by section
  - Each section has an "Edit" link → routes back to that section, returns to review on Next
  - "Submit my answers" button → POST `intake/complete`
- Tests
- Commit: `feat(pbv-intake): sections 8-11 (criminal, DV/RA, household expenses, review)`

### Commit 5 — Translations + polish

- Add PT to `pbvFullAppTranslations.ts` for every existing string + new intake strings
- Validation messages in three languages
- Add PT to LanguageLanding options
- Mobile UX pass — iPhone SE viewport in browser dev tools, no horizontal scroll, all tap targets ≥44px
- Commit: `feat(pbv-intake): PT translations + validation polish`

### Commit 6 — Integration test

- Vitest + msw test that mocks the PRD-24 API and walks the Maria household through every section (including conditional ones that her household triggers)
- Snapshot of intake_data after each section
- Snapshot of final state at intake/complete
- Commit: `test(pbv-intake): happy-path integration test`

## Verification

After each commit:
- Component renders without runtime errors
- Auto-save fires on field change and stops on completed save
- Conditional sections appear/disappear correctly
- Resume link drops at expected section

After all commits:
- Full intake → review → submit walkthrough works against local PRD-24 backend
- Maria integration test passes
- `npm run build` clean (PowerShell, no `Select-Object`)
- All component/hook tests pass

## Anti-patterns — do NOT

- Do not duplicate FormField/FormButton/FormSection — extend, don't replace
- Do not surface federal form names in the intake UI
- Do not block "Next" on optional fields
- Do not call PRD-24's API endpoints other than: bootstrap GET, intake/[section] POST, intake/complete POST, resume POST
- Do not write to `pbv_form_documents`, `pbv_signature_events`, or anything beyond intake state — those are PRD-26's
- Do not capture signatures — PRD-26
- Do not implement document uploads — already exists
- Do not skip auto-save retry on flaky networks
- Do not hard-code section ordering — driven by `useSectionVisibility`
- Do not use `npm run build | Select-Object`
- Do not commit untranslated strings without the `// PT: tentative` marker

## Build report

`docs/build-reports/25-pbv-form-execution-phase1-intake-build-report_2026-05-15.md`:

1. **Components shipped** (file list)
2. **Translation coverage** — what's done, what's marked tentative
3. **Conditional rendering verified** — which combinations of intake answers trigger which section visibility
4. **Auto-save behavior** — debounce window, retry logic, idempotency
5. **Mobile testing** — viewports tested, anything that needed tweaking
6. **Open-decision resolutions** (per-section file pattern, SSN style, etc.)
7. **Open questions for Alex**
8. **Recommendations for PRD-26** — anything you noticed about the data shape that affects review-and-sign

## When you're done

- All 6 commits on `feature/pbv-form-execution`
- Build report committed
- Clean working tree
- Surface report path to Alex; wait for sign-off before PRD-26
