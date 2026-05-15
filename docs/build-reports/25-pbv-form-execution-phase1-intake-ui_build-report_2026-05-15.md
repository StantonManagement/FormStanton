# Build Report — PRD-25: PBV Form Execution Phase 1 Intake UI
**Date:** 2026-05-15  
**Branch:** `feature/pbv-form-execution`  
**Status:** ✅ Complete — all 6 commits merged

---

## What Was Built

### Commit 1 — Shell + Dispatcher + Hooks
- `lib/pbv/intake-schema.ts` — canonical `IntakeData` type, 11 section interfaces, `isSectionComplete` validator
- `lib/pbv/hooks/useIntakeBootstrap.ts` — fetches bootstrap data from `GET /api/t/[token]/pbv-full-app`
- `lib/pbv/hooks/useSectionVisibility.ts` — derives ordered visible section list from conditional rules
- `lib/pbv/hooks/useSectionAutoSave.ts` — debounced (600ms) auto-save with idempotency + 1 retry
- `lib/pbv/hooks/useResumeLink.ts` — "Pick up later" SMS re-send with 60-min rate-limit UX
- `components/pbv/intake/SaveStatusIndicator.tsx` — `idle | saving | saved | error` indicator (EN/ES/PT)
- `components/pbv/intake/PickUpLaterButton.tsx` — "Pick up later" button with rate-limit copy
- `components/pbv/intake/IntakeShell.tsx` — sticky header (progress bar, save status, language switcher, pick-up-later), sticky footer (Back / Next)
- `app/pbv-full-app/[token]/intake/page.tsx` — intake landing / intro screen
- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — section dispatcher with language override state
- `app/pbv-full-app/[token]/review/page.tsx` — PRD-26 stub (redirected to once intake complete)
- `app/pbv-full-app/[token]/page.tsx` — dispatcher patch: routes by `intake_status` / `signing_status`

### Commit 2 — Sections 1–3
- `components/pbv/intake/AdultWizard.tsx` — per-adult pagination wizard (progress dots, Previous/Next adult)
- `components/pbv/intake/SectionHousehold.tsx` — HOH details + household roster (add adult / add minor)
- `components/pbv/intake/SectionContact.tsx` — phones + email + alternate contact
- `components/pbv/intake/SectionIncome.tsx` — per-adult income wizard, 14 source types, zero-income flag

### Commit 3 — Sections 4–7
- `components/pbv/intake/SectionZeroIncomeDecl.tsx` — per-zero-income-adult support/contributions explanation
- `components/pbv/intake/SectionAssets.tsx` — 10 asset toggles + disposed value + total asset value
- `components/pbv/intake/SectionChildcareDisability.tsx` — Care4Kids / paid relative / disability care amounts
- `components/pbv/intake/SectionMedical.tsx` — insurance + doctor/prescription/other monthly costs

### Commit 4 — Sections 8–11
- `components/pbv/intake/SectionCriminalHistory.tsx` — per-adult criminal history Y/N + details textarea
- `components/pbv/intake/SectionDvHomelessRa.tsx` — DV / homeless / RA with description textarea
- `components/pbv/intake/SectionHouseholdExpenses.tsx` — rent/utilities/food/transportation/other + explanation
- `components/pbv/intake/SectionReview.tsx` — read-only summary, edit links, `POST intake/complete` on submit

### Commit 5 — Language Switcher + Polish
- `components/pbv/intake/LanguageSwitcher.tsx` — EN/ES/PT toggle, wired into `IntakeShell`
- Language override state in section dispatcher (does not overwrite DB preference; session-only)
- PT strings marked `// PT: tentative — review` throughout all section `copy` objects

### Commit 6 — Build Report

---

## Dispatcher Logic (page.tsx patch)

| `intake_status` | `signing_status` | Route |
|---|---|---|
| `not_started` | any | `/intake` (landing) |
| `in_progress` | any | `/intake/{_resume_section}` |
| `complete` | `not_started` or undefined | `/review` (PRD-26 stub) |
| `complete` | `in_progress` or `summary_signed` | `/review` |
| `complete` | `complete` | Falls through to legacy docs/finalize flow |

---

## Conditional Section Rules

These sections are hidden unless their predicate fires:

| Section | Condition |
|---|---|
| `zero_income_decl` | ≥1 adult with `has_any_income = false` |
| `medical` | HOH is disabled OR aged 62+ (from conditional-rules.ts) |
| `household_expenses` | ALL adults have zero income |

---

## Auto-Save Contract

- Debounce: 600ms after last field change
- Idempotency: per-save UUID via `crypto.randomUUID()`
- Retry: 1 retry on network error after 2000ms
- `_resume_section` stored in intake_data so re-entry lands at the right section

---

## PT Translation Status

All Portuguese strings in the new section components are marked `// PT: tentative — review`. The `pbvFullAppTranslations.ts` `pt` block (legacy flow) was already complete. PT is functional but requires native-speaker review.

---

## Acceptance Criteria Check

| Criterion | Status |
|---|---|
| New SPA route `/intake/[section]` | ✅ |
| Dispatcher routes by `intake_status` | ✅ |
| 11 section components | ✅ |
| Auto-save with debounce + idempotency | ✅ |
| Conditional sections (medical, zero-income, household-expenses) | ✅ |
| Language switcher (EN/ES/PT) | ✅ |
| "Pick up later" resume link | ✅ |
| Mobile-first min-h-[44px] touch targets | ✅ |
| No hardcoded hex colors | ✅ |
| `rounded-none` on all inputs/buttons | ✅ |
| Serif headers only | ✅ |
| No duplicated primitives | ✅ |
| PRD-26 stub preventing 404 | ✅ |
| Legacy flow unchanged for `intake_status = null` | ✅ |

---

## Known Issues / Open Items

1. **PT translations** need native-speaker review — all marked tentative
2. **Section validation** — `isSectionComplete` is wired in schema but `canGoNext` in `IntakeShell` is not yet gating on it (set to `!isReviewSection` unconditionally); per-section validation gates are a PRD-25 polish item or PRD-26 prereq
3. **Household sync to income section** — `SectionIncome` reads `household.members` from `intakeData`; if the user edits household after entering income, the per-member income list may have stale member names (cosmetic only, slots are stable)
4. **PRD-26 review page** is a stub — will be replaced by full signing flow

---

## Files Modified (New)

```
lib/pbv/intake-schema.ts
lib/pbv/hooks/useIntakeBootstrap.ts
lib/pbv/hooks/useSectionVisibility.ts
lib/pbv/hooks/useSectionAutoSave.ts
lib/pbv/hooks/useResumeLink.ts
components/pbv/intake/AdultWizard.tsx
components/pbv/intake/IntakeShell.tsx
components/pbv/intake/LanguageSwitcher.tsx
components/pbv/intake/PickUpLaterButton.tsx
components/pbv/intake/SaveStatusIndicator.tsx
components/pbv/intake/SectionHousehold.tsx
components/pbv/intake/SectionContact.tsx
components/pbv/intake/SectionIncome.tsx
components/pbv/intake/SectionZeroIncomeDecl.tsx
components/pbv/intake/SectionAssets.tsx
components/pbv/intake/SectionChildcareDisability.tsx
components/pbv/intake/SectionMedical.tsx
components/pbv/intake/SectionCriminalHistory.tsx
components/pbv/intake/SectionDvHomelessRa.tsx
components/pbv/intake/SectionHouseholdExpenses.tsx
components/pbv/intake/SectionReview.tsx
app/pbv-full-app/[token]/intake/page.tsx
app/pbv-full-app/[token]/intake/[section]/page.tsx
app/pbv-full-app/[token]/review/page.tsx
```

## Files Modified (Existing)

```
app/pbv-full-app/[token]/page.tsx — dispatcher routing patch (~30 lines)
```
