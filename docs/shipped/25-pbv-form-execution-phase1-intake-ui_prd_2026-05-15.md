# PRD-25 — PBV Form Execution: Phase 1 Sectioned Intake UI

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md`, `docs/fullApp-Plan/pbv-field-inventory.md`
**Depends on:** PRD-24 complete (schema + API in place)

---

## Problem Statement

A tenant gets the magic link and needs to fill one continuous intake organized into sections. They never see form names. They never type anything twice. Their answers will eventually map to 13 federal forms — but the tenant only sees sections.

PRD-24 built the API. PRD-25 builds the UI that consumes it.

## Evidence baseline (verified 2026-05-15)

- `app/pbv-full-app/[token]/page.tsx` exists and is the current tenant entry. It already routes by language landing, supports TenantDocumentUpload, has resume behavior.
- Existing UI primitives in `components/form/`: `FormField`, `FormButton`, `FormSection`, `FormLayout`, `LanguageLanding`, `FormPhoneInput`, `SuccessScreen`.
- Existing translations: `lib/pbvFullAppTranslations.ts`. Will need extension for new copy.
- Three languages supported in existing flow: en, es. PT to be added.
- Auto-save pattern exists elsewhere in the codebase — find and reuse.

## Tenant journey (this PRD's scope)

```
Magic link tapped
  ↓
LanguageLanding (existing — pick language; persisted to preferred_language)
  ↓
Intake landing screen (1-page intro: what you'll do, est. time, save-and-resume)
  ↓
Section 1 — About your household
  ↓ (auto-save on every change; "Next" button bottom of section)
Section 2 — Contact info
  ↓
Section 3 — Income
  ↓
[Section 4 — Zero-income declaration, conditional]
  ↓
Section 5 — Assets
  ↓
Section 6 — Childcare / disability expenses
  ↓
[Section 7 — Medical expenses, conditional on HOH/spouse 62+ or disabled]
  ↓
Section 8 — Criminal history
  ↓
Section 9 — DV / Homeless / Reasonable Accommodation status
  ↓
[Section 10 — Household expenses, conditional on all-adult zero-income]
  ↓
Section 11 — Review (read-only summary, edit-by-section)
  ↓
"Submit my answers" button → POST intake/complete → triggers form generation
  ↓
[Phase 2 — PRD-26]
```

Scope of this PRD ends at "Submit my answers." Document upload, form review, and signing live in later PRDs.

## Key decisions

### 1. New top-level route layer

The existing `app/pbv-full-app/[token]/page.tsx` becomes a router/dispatcher based on `intake_status` and `signing_status` from the bootstrap API. It dispatches to:

- `not_started` → landing intro screen
- `in_progress` → current section page (resume to last section in `intake_data._resume_section`)
- `complete` AND `signing_status = 'not_started'` → PRD-26 review-and-sign entry
- `signing_status = 'in_progress'` → PRD-26 mid-sign
- `signing_status = 'complete'` → existing document upload + finalize flow
- `submitted` → existing already-submitted re-entry screen

Each phase has its own sub-route under `app/pbv-full-app/[token]/`:

- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — one component per section, dispatched by URL slug

### 2. Section component contract

Each section is its own client component with this contract:

- Loads its slice of `intake_data` on mount via GET `/api/t/[token]/pbv-full-app/` (bootstrap)
- Renders fields per section spec (below)
- Calls `POST /api/t/[token]/pbv-full-app/intake/[section]` on every meaningful change (debounced 600ms; mobile-friendly)
- Shows save status indicator (`Saving…` / `Saved`)
- "Next" button advances; only enabled when section's required fields are valid
- "Back" allowed; auto-save protects against data loss
- Top of every section shows: section number / total, progress bar, "Pick up later" button (closes session; magic link still works)

### 3. Conditional sections

Sections 4, 7, 10 only appear in the section navigation when their condition is true. Conditional logic lives in `lib/pbv/conditional-rules.ts` (PRD-24). Client calls a `useSectionVisibility(intakeData, members)` hook that returns the ordered list of visible section slugs.

If a tenant changes an earlier answer that adds a conditional section, the new section appears in the nav after auto-save returns. If a tenant changes an answer that REMOVES a conditional section that already had data: keep the data in `intake_data` (don't destroy answered work) but stop rendering the section. Re-rendered if condition flips back.

### 4. Section field set is derived from inventory

For each section, the field set is the union of `prefill_source` keys in the inventory's `## main_application` table that fall in that section, plus any extras the section needs (e.g., zero_income_name list lives in Section III by inventory).

The intake UI does not need to mirror the federal form layout. The intake is mobile-first, vertical, one-question-at-a-time. The federal form layout happens at stamp time on the backend.

Section schema reference table (build canonical schema in `lib/pbv/intake-schema.ts` consumed by both the section components and PRD-24's API validators):

| Section | Slug | Field set (high level) | Required to submit | Conditional? |
|---|---|---|---|---|
| 1 | `household` | HOH details, household roster (adults + minors), citizenship, disability, student | yes | always |
| 2 | `contact` | phones, email, alternate contact | yes | always |
| 3 | `income` | per-adult employment, SSI, SS, pension, child support, TANF, SNAP, unemployment, workers comp, self-employment, rental, gifts, digital wallet | yes | always |
| 4 | `zero_income_decl` | per-zero-income-adult declaration | yes if section visible | any adult with no income |
| 5 | `assets` | real estate, accounts, CDs, trusts, bonds, life insurance, asset disposal in last 2 years | yes | always |
| 6 | `childcare_disability` | Care 4 Kids, paid relative, disability-assistance care expenses | yes (zero answer allowed) | always |
| 7 | `medical` | medical insurance, doctor visits, prescriptions, other | yes if section visible | HOH/spouse disabled OR 62+ |
| 8 | `criminal_history` | per-adult yes/no with details if yes | yes | always |
| 9 | `dv_homeless_ra` | VAWA flag, homeless at admission flag, reasonable accommodation flag | yes | always |
| 10 | `household_expenses` | expense detail for zero-income households | yes if section visible | all adults zero income |
| 11 | `review` | read-only summary with edit links | n/a | always (rendered last) |

### 5. Three languages

Add Portuguese alongside existing EN/ES:
- `pbvFullAppTranslations.ts` gets `pt` keys for every existing en/es entry plus new intake-flow copy
- LanguageLanding offers PT as a third option for tenants who haven't picked yet
- Tenant's selection writes to `pbv_full_applications.preferred_language` AND sets `submission_language` per policy: `pt → es`, otherwise mirror.

### 6. Save status + resume UX

- Top-right of every section header: `Saved · 12:04` or `Saving…` indicator
- Save failure: toast "Saved locally. We'll retry." then retry queue; if persistent failure, the section's "Next" button becomes "Tap to retry save."
- "Pick up later" button: surfaces SMS resume link with the existing token; logs `resume_token_last_sent_at`; closes the session
- Re-entry via SMS link: dispatcher inspects `intake_data._resume_section` and routes to that section

### 7. Mobile-first

- Single-column layout, full-width inputs
- Tap targets ≥44px
- Number keyboard on currency / phone / SSN fields
- SSN field masks input
- Date fields use native date picker
- No horizontal scrolling
- Bottom-sticky Next button on screens with long form lists

### 8. Validation

- Inline per-field validation on blur
- Required fields highlighted before "Next" enables
- Section-level cross-field validation runs server-side on `intake/[section]` POST; client mirrors the rules to avoid surprising blocks
- Cross-section consistency (e.g., zero-income roster matches adults who answered "no income") computed at `intake/complete` time, with errors surfaced as a final review banner

### 9. Existing component reuse

Use `components/form/FormField`, `FormButton`, `FormSection`, `FormLayout`, `FormPhoneInput`, `SectionHeader`. Extend translations and styles as needed; do NOT recreate primitives.

Existing tenant route file (`app/pbv-full-app/[token]/page.tsx`) becomes a dispatcher; sections live in new files under `app/pbv-full-app/[token]/intake/`.

### 10. Per-adult repeating sections

Income, criminal history, and citizenship questions repeat per adult. Render as a one-adult-at-a-time wizard within the section, with progress dots ("Adult 1 of 3"). Saves to the adult's row in `pbv_household_members` plus the relevant intake_data.

## Scope

### What this PRD does

- Builds 11 section components (10 data sections + 1 review)
- Builds the intake dispatcher in `app/pbv-full-app/[token]/page.tsx`
- Adds PT translations
- Wires auto-save against PRD-24's API
- Surfaces resume token via "Pick up later"
- Surfaces conditional sections per `lib/pbv/conditional-rules.ts`
- Generates final review screen with edit-by-section
- Triggers `intake/complete` on submit

### What this PRD does NOT do

- Does not render the federal forms (PRD-26)
- Does not capture signatures (PRD-26)
- Does not handle document uploads (existing flow handles these — Phase 2 of the tenant journey beyond this PRD)
- Does not modify backend schema (PRD-24)
- Does not implement staff-assisted mode (PRD-29)

## Affected files

### New components
- `app/pbv-full-app/[token]/intake/page.tsx` — intake landing intro
- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — section page dispatch (or one file per section, Cascade's call)
- `components/pbv/intake/IntakeShell.tsx` — header + progress + Next/Back chrome
- `components/pbv/intake/SectionHousehold.tsx`
- `components/pbv/intake/SectionContact.tsx`
- `components/pbv/intake/SectionIncome.tsx`
- `components/pbv/intake/SectionZeroIncomeDecl.tsx`
- `components/pbv/intake/SectionAssets.tsx`
- `components/pbv/intake/SectionChildcareDisability.tsx`
- `components/pbv/intake/SectionMedical.tsx`
- `components/pbv/intake/SectionCriminalHistory.tsx`
- `components/pbv/intake/SectionDvHomelessRa.tsx`
- `components/pbv/intake/SectionHouseholdExpenses.tsx`
- `components/pbv/intake/SectionReview.tsx`
- `components/pbv/intake/PickUpLaterButton.tsx`
- `components/pbv/intake/SaveStatusIndicator.tsx`
- `components/pbv/intake/AdultWizard.tsx` — reusable per-adult repeating shell

### Modified
- `app/pbv-full-app/[token]/page.tsx` — becomes dispatcher
- `lib/pbvFullAppTranslations.ts` — add PT, add intake copy
- `lib/portalTranslations.ts` if any shared copy
- `lib/pbv/intake-schema.ts` — NEW, the canonical schema (read by both this PRD's UI and PRD-24's API)

### New hooks
- `lib/pbv/hooks/useIntakeBootstrap.ts`
- `lib/pbv/hooks/useSectionAutoSave.ts`
- `lib/pbv/hooks/useSectionVisibility.ts`
- `lib/pbv/hooks/useResumeLink.ts`

### Tests
- Component tests for each section: render, fill, save flow
- Hook tests for auto-save (debounce, retry, idempotency-key)
- Integration test: full happy-path intake fill for Maria household (Vitest + msw, no real backend)

## Phases

### Phase 1 — Shell and dispatcher
- IntakeShell + dispatcher in `[token]/page.tsx`
- Save status indicator
- Resume link button
- Bootstrap hook + section visibility hook
- Commit: `feat(pbv-intake): dispatcher + shell + save indicator`

### Phase 2 — First three sections (always-rendered)
- SectionHousehold (with member roster builder)
- SectionContact
- SectionIncome (per-adult wizard inside)
- Tests
- Commit: `feat(pbv-intake): sections 1-3 (household, contact, income)`

### Phase 3 — Conditional sections + assets
- SectionZeroIncomeDecl
- SectionAssets
- SectionChildcareDisability
- SectionMedical
- Tests
- Commit: `feat(pbv-intake): sections 4-7 (zero-income, assets, childcare/disability, medical)`

### Phase 4 — Remaining sections
- SectionCriminalHistory
- SectionDvHomelessRa
- SectionHouseholdExpenses
- SectionReview
- Tests
- Commit: `feat(pbv-intake): sections 8-11 (criminal, DV/RA, household expenses, review)`

### Phase 5 — Translations + polish
- Complete PT translation set
- Validation messages tightened
- Mobile usability pass
- Commit: `feat(pbv-intake): PT translations + validation polish`

### Phase 6 — Integration test + verification
- Happy-path Maria intake via Vitest + msw
- `npm run build` clean
- Manual smoke against local dev DB
- Commit: `test(pbv-intake): happy-path integration test`

### Phase 7 — Build report

`docs/build-reports/25-pbv-form-execution-phase1-intake-build-report_2026-05-15.md`.

## Out of scope

- Form review, signing (PRD-26)
- Additional-adults (PRD-27)
- Summary doc (PRD-28)
- Staff-assisted mode (PRD-29)
- E2E browser test (PRD-30)

## Acceptance criteria

- Tenant can navigate from magic link to a completed intake without leaving the SPA shell
- All required fields validated; can't proceed past a section with missing required data
- Conditional sections appear/disappear based on prior answers
- Auto-save survives mid-section navigation away and back
- "Pick up later" re-sends the magic link and closes the session; reopening drops at the last incomplete section
- Three languages live and complete for new intake copy
- Mobile viewport tests on iPhone SE and Android Galaxy-class show no horizontal scroll
- All component + hook tests pass; integration test for Maria happy-path passes
- Clean `npm run build`

## Open questions

- Whether the intake should hand off to PRD-26 within the same SPA or navigate to a new route. Default: same SPA, route-based phase switching, browser back works.
- Whether to surface the eventual form list to the tenant on the intake landing ("you'll fill ~9 forms"). Default: do NOT surface; keep section-focused. Could add if user research suggests anxiety reduction.
- Whether SSN entry should split into 3 mini-fields (`XXX-XX-XXXX`) or one masked field. Default: one masked field; minimize friction.
