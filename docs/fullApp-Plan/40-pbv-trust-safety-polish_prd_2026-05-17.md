# PRD-40 — Tenant Trust, Safety & Polish

**Date:** 2026-05-17
**Author:** Claude (post-tenant-journey audit, same day)
**Branch:** `feat/pbv-trust-safety-polish-40`
**Status:** Draft — ready for build. Does NOT depend on #12/#13 being fixed first; the work below is orthogonal to the two server-side 500s.
**Source audit:** `tasks/TENANT_JOURNEY_2026-05-17.md`
**Blocks:** PRD-41 (tenant upload UX) — that one ships after this.

---

## Out of scope (called out explicitly)

- **Defect #12 `generate-forms` 500** and **Defect #13 `upload` 500** are NOT in this PRD. They are single-bug fixes that need the dev-server stack trace, not a multi-feature PRD. They are blockers for end-to-end testing but orthogonal to the tenant-trust / safety / polish work below.
- No new authentication, no new tables. One small migration on `application_documents` is the only schema change.
- No multi-language re-test as part of acceptance. EN walked; ES/PT deferred to a separate verification pass once this lands.

---

## Problem Statement

The 2026-05-17 tenant walkthrough of Maria Test Tenant surfaced a stack of defects that, taken individually, look like polish — but taken together, they form three coherent risks:

1. **Tenant-safety risk.** Sensitive yes/no questions (domestic violence, criminal history, homelessness, reasonable accommodation) pre-select "No". A real DV survivor or someone needing accommodation could click Next and miss her chance to claim protected status. Required fields in Section 2 (Contact) have no `*` marker, so tenants don't know what's mandatory until the Next button silently refuses to advance.

2. **Tenant-trust risk.** After Maria submits intake, the dashboard gives her no acknowledgment that anything happened — no "we got your submission" banner. The dashboard says she needs to upload "0 of 22" documents; the documents page says "0 of 31". Two "Submit my answers" buttons appear on Review (one enabled, one disabled). Race appears as `"black"`, Ethnicity as `"not_hispanic"`, Marital as `"single"`, Income type as `"employment"`. Cell phone reads `"8605557777"`. The Review page is supposed to be the tenant's chance to validate her own answers; it currently looks like a developer console.

3. **Intake-correctness risk.** Maria declared Wages only and Checking only, but the documents page demands SSI, TANF, Social Security, Pension, Self-Employment, Immigration, and Savings docs — all marked "Required." She would panic and call Stanton. The annual-income field doesn't auto-compute from monthly, so tenants either do mental math (and make mistakes) or leave it blank (the surface that fed the historical `annual_income=0` admin defect).

This PRD addresses all three in a single coordinated pass. Bundling them is the right call because the same review/integration work — re-walking the tenant flow page by page — gets done once instead of three times.

---

## Users & Roles

- **Tenants completing their PBV application** — primary beneficiary across all three risk categories.
- **Stanton staff** — secondary. Fewer "help, what does HUD-9886-A mean" / "the form keeps asking me about SSI but I don't have any" support calls. Cleaner admin list status column.
- **Devs / QA** — tertiary. Reset script that actually resets is a quality-of-life win for testing.

No new permission roles, no new admin UI features in this PRD.

---

## Closed decisions

- **Sensitive-question defaults are neutral (no radio pre-selected).** Tenant must affirmatively pick Yes or No. Next remains disabled until selected.
- **Required-field policy:** every required field gets a visual `*` marker AND has its label include "(required)" for screen-reader / multi-language clarity. Submit/Next stays disabled until all required fields are valid (current behavior — keeping it).
- **Document gating uses declared intake responses.** Income docs filter to declared income types. Asset docs filter to declared asset types. Citizenship/immigration is shown only if any household member is non-citizen (intake adds this question if it doesn't have it already).
- **Annual income auto-fills `monthly * 12` on blur, editable.** Tenant can override for irregular income. Override is persisted; if they later change monthly, annual auto-recomputes only if it was never manually edited (track an `annual_was_manually_edited` flag in `intake_data`).
- **Doc count is sourced from a single API endpoint.** Both dashboard and `/documents` page call the same endpoint and display the same numerator/denominator. Pick `required only` for both (denominator = 22 in Maria's case, not 31). Optional docs are visible in `/documents` but not counted in dashboard progress.
- **ApplicationStatusBanner reuses the existing PRD-36 component.** Investigate why it's not rendering on `/dashboard` despite migration being shipped. Likely a conditional render bug, not a missing component.
- **Submit button on Review:** the footer-disabled-twin is removed entirely. Only the main-content button remains.
- **Magic-link landing logic for `not_started`:** check `intake_status` FIRST, not `intake_submitted`. If `intake_status === 'not_started'`, route to `/intake`. Otherwise existing behavior.
- **`/sign/forms` and `/sign/additional-signers` redirects:** when gated, show a one-screen "you need to do X first" page with a button back to the gating step. No more silent redirect.
- **HACH portal data gap:** out of scope for this PRD's tenant work — admin-side investigation only. We add a TODO and ticket; we do not block this PRD on the HACH portal.
- **Reset script:** lives in the FormStanton repo or Windsurf's tooling — not in app code. Track separately. NOT in PRD-40 acceptance; carved out at the bottom.

---

## Decisions resolved (Alex confirmed 2026-05-17)

These are the three pre-build questions answered after Windsurf surveyed the codebase. **Do not re-open without explicit Alex sign-off.**

### F4 — Soft-detach mechanism for intake-de-triggered docs

**Decision:** Add `'no_longer_required'` to the `ad_status_check` CHECK constraint on `application_documents.status` via migration.

**Rationale:** Explicit status value beats a side-channel boolean. Admin queries and existing status-aware code paths see the change directly. The migration is small and contained.

**Implications:**
- New migration: `supabase/migrations/<date>_pbv_ad_status_no_longer_required.sql` that drops and re-adds `ad_status_check` with the additional enum value `'no_longer_required'`.
- When intake change de-triggers a previously-uploaded doc, transition the row to `status = 'no_longer_required'`. File stays in storage. `uploaded_at`, `storage_path`, `file_hash`, etc. are preserved.
- Required-count queries must now filter on `status != 'no_longer_required'` (or whitelist active statuses).
- Admin list views need to handle the new status — render as "no longer required" with a distinct visual treatment.
- Any existing status-machine logic (transitions, allowed-next-states) must be audited to permit transitions into `'no_longer_required'` from `'submitted'` and `'approved'`, and back out if intake changes again.

### F5 — ApplicationStatusBanner translations

**Decision:** Full EN + ES + PT inline at build time.

**Rationale:** This is user-facing tenant copy on the dashboard; shipping with placeholder ES/PT defeats the multi-language flow that already exists across intake. Match the inline-copy pattern in `SectionCriminalHistory`, `SectionDvHomelessRa`, `SectionIncome`, etc.

**Implications:**
- All new strings shipped in F5 must have EN + ES + PT values.
- Windsurf authors the translations. Uncertain phrasings get a `// PT: tentative — review` (or `// ES: tentative`) comment matching the existing convention, but the string itself is NOT empty.
- Build report lists every new string introduced and flags any tentative translations for a human review pass.

### F9 — Section indicator strategy

**Decision:** Lock-at-start per tenant.

**Rationale:** Max-denominator lies to tenants who only walk 7 sections. Always-rendered-only quirkily appends sections beyond the denominator. Lock-at-start is honest and stable.

**Implications:**
- On intake first entry (transition from `not_started` to first section load), compute the section count based on best-available signals at that moment: pre-app data, initial household composition, etc.
- Store result in `intake_data.section_count` (JSONB, no migration).
- Display "Section X of {intake_data.section_count}" throughout intake. **Do not recompute.**
- Constraint: the value of N **MUST NOT CHANGE** during a single intake session. If Windsurf's algorithm finds a case where N would change mid-intake (e.g., tenant unchecks an income source that hid the zero-income-declaration section), the lock takes precedence — the section appears or disappears under the same N.
- If Windsurf finds that the available data at first entry is too thin to predict accurately (e.g., no pre-app conditionals to read), default to the conservative max (10) and document the assumption in the build report.
- Walk every flow variant during verification and confirm N never changes.

---

## Core Features

### F1 — Required-field markers across all intake sections

**Problem:** Section 2 (Contact) has no `*` markers but the Next button is gated on cell phone + email. Confirmed in audit. Risk this is true for other sections too.

**Files (likely):**
- `components/pbv/intake/HouseholdSection.tsx` [inference — name unverified; find by route `/intake/household`]
- `components/pbv/intake/ContactSection.tsx` [inference — find by route `/intake/contact`]
- `components/pbv/intake/IncomeSection.tsx` etc.
- Shared label component (if one exists) — preferred change point.

**Implementation:**
- Audit every intake section for fields where the Next button is gated. Every gated field gets a `*` marker on the label.
- If a shared `FormField` wrapper exists, update it to render `*` when a `required` prop is true. Otherwise add `*` inline per field.
- Add an accessible label suffix `(required)` for screen readers.

**Acceptance:**
- Walk every intake section. For each gated field, confirm `*` is visible AND the accessible name includes "required".
- Confirmed gated fields needing `*`: cell phone, email (Section 2). Verify Section 1 fields too (DOB is gated; name is gated).

### F2 — Neutral defaults on sensitive radio questions

**Problem:** DV, felony, homeless, reasonable-accommodation questions all pre-select "No". Audit caught this.

**Files (likely):**
- `components/pbv/intake/CriminalHistorySection.tsx` [inference]
- `components/pbv/intake/DvHomelessRaSection.tsx` [inference — URL was `/intake/dv_homeless_ra`]

**Implementation:**
- Change radio default from `"No"` to neutral (nothing selected).
- Next button remains disabled until one option is picked.
- Add helper copy under each question: "This information helps protect your housing and assess priority. It will be kept confidential per Stanton policy." (Per-question copy might differ — see content file note below.)

**Acceptance:**
- Land on `/intake/criminal_history` and `/intake/dv_homeless_ra` — no radios pre-selected.
- Next disabled until each question is answered.
- Snapshot test or manual: each question shows the helper copy.

### F3 — Annual income auto-computes from monthly

**Problem:** Monthly amount and Estimated annual income are separate fields with no link. Tenant has to do 2500 × 12 manually. Surface for historical Defect #2.

**Files (likely):**
- `components/pbv/intake/IncomeSection.tsx` [inference]
- `app/api/t/[token]/pbv-full-app/intake/income/route.ts` [inference — verify path]

**Implementation:**
- On blur of any monthly amount field, recompute `annual = sum(all monthly amounts) * 12` and write to the annual field if `annual_was_manually_edited === false`.
- When the user edits the annual field directly, set `annual_was_manually_edited: true` in the section's persisted state.
- Display a small caption under the annual field: "Auto-calculated from monthly. Edit to override."
- Persisted state lives in `intake_data.income.annual_was_manually_edited` — no schema change needed since `intake_data` is JSONB [inference — verify].

**Acceptance:**
- Enter 2500 monthly Wages, blur. Annual field shows 30000.
- Add 500 monthly Child Support, blur. Annual auto-updates to 36000.
- Manually change annual to 35000. Edit monthly Wages to 3000. Annual stays at 35000 (manually edited).

### F4 — Documents gated by intake responses

**Problem:** Maria declared Wages only + Checking only. Documents page requires SSI, TANF, Social Security, Pension, Self-Employment, Immigration, Savings — all marked Required. Tenant panic.

**Files (likely):**
- `app/api/t/[token]/pbv-full-app/documents/route.ts` (or the `documents?language=en` endpoint observed in network) [verify]
- The doc-spec / requirements config that maps doc types to triggering intake responses. May already exist as `lib/pbv/documentRequirements.ts` [inference]. If not, create it.

**Implementation:**
- Define a `DocumentTrigger` config mapping each doc-type to:
  - Intake condition (e.g., `Paystubs` requires `income.has_wages === true`)
  - Default required/optional status when triggered
- Documents endpoint reads `intake_data` and `intake_snapshot` and returns only documents whose triggers fire.
- Optional documents (Insurance Settlement, CD/Trust) always appear but as Optional, not Required.
- "Immigration Documents" only required if any household member has `citizenship_status !== 'citizen'` (add this field to intake if missing, or use existing).
- Citizenship Declaration is required for every adult regardless. Don't gate that one.

**Triggering matrix (initial — refine in build):**

| Doc | Trigger condition | Default state |
|---|---|---|
| Paystubs | `income.has_wages === true` per adult | Required |
| SSI Award Letter | `income.has_ssi === true` | Required |
| Social Security Award Letter | `income.has_social_security === true` | Required |
| Pension / Railroad | `income.has_pension === true` | Required |
| Child Support Order | `income.has_child_support === true` | Required |
| TANF/Public Assistance | `income.has_tanf === true` | Required |
| Unemployment / WC | `income.has_unemployment === true OR income.has_workers_comp === true` | Required |
| Self-Employment | `income.has_self_employment === true` | Required |
| Training Program | always | Optional |
| Cash App/Zelle/Venmo | `income.has_digital_wallet === true` | Required |
| Savings Account Statement | `assets.has_savings === true` per adult | Required |
| Checking Account Statement | `assets.has_checking === true` per adult | Required |
| Insurance Settlement | `assets.has_insurance_settlement === true` | Required |
| CD/Trust/Bond | `assets.has_cd OR has_trust OR has_bonds === true` | Required |
| Life Insurance Cash Value | `assets.has_life_insurance === true` | Required |
| Doctor Bills | `expenses.has_medical_expenses === true` | Optional |
| Pharmacy Statements | `expenses.has_medical_expenses === true` | Optional |
| Care 4 Kids / Childcare | `expenses.has_childcare === true` | Optional |
| Immigration Docs | any member `citizenship_status !== 'citizen'` | Required |
| Proof of Age 62+ Non-Citizen | any non-citizen member age 62+ | Optional |
| Signed Forms (11) | always required | Required |

**Acceptance:**
- Submit intake as wage-earner with Checking only, no kids. Documents page shows: Paystubs, Checking Account Statement, Citizenship Declaration + signed forms (11). Total required ≈ 13, not 22.
- Submit intake as SSI recipient with Savings. Documents page shows: SSI Award Letter, Savings Account Statement, Citizenship Declaration + signed forms. No paystubs.
- Submit intake as immigrant family. Immigration Documents marked Required.
- Submit intake declaring nothing checked on Income (with "No income of any kind" checked). No income-source docs required.

### F5 — ApplicationStatusBanner renders on /dashboard

**Problem:** Defect #3. Banner ships per code review (PRD-36) but doesn't render. Tenant gets no "we got your submission" reassurance.

**Files (likely):**
- `components/pbv/sign/TenantDashboard.tsx`
- `components/pbv/ApplicationStatusBanner.tsx` [inference]
- Wherever the dashboard page composes these.

**Implementation:**
- Locate why the banner conditional is false for `intake_status === 'complete'` post-submit. Likely a prop / data fetch mismatch.
- Banner should render with copy:
  - When `application_review_status === null` and `intake_status === 'complete'`: "Thanks, [Name]. We received your intake on [date]. Next: complete the tasks below."
  - When `application_review_status === 'under_review'`: "Your application is under review. We'll reach out if anything is missing."
  - Etc. — match existing PRD-36 spec.

**Acceptance:**
- Complete intake as Maria. Land on `/dashboard`. Banner visible at top with submission-received copy.
- Banner does NOT render on `/intake` pages.

### F6 — Single doc count source of truth

**Problem:** Dashboard "0 of 22", documents page "0 of 31".

**Files (likely):**
- `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` [inference]
- `components/pbv/sign/TenantDashboard.tsx`
- `app/pbv-full-app/[token]/documents/page.tsx`

**Implementation:**
- Single endpoint (`upload-summary`) returns `{ required_total, required_uploaded, optional_total, optional_uploaded }`.
- Dashboard and documents page both call this endpoint.
- Both display the same numerator/denominator pair: `X of REQUIRED_TOTAL uploaded`. Optional shown only in `/documents` page as a separate sub-count.
- After F4 ships, REQUIRED_TOTAL drops dynamically per tenant — both surfaces stay in sync because they read the same number.

**Acceptance:**
- Wage-earner tenant post-F4 sees same count on both pages (e.g., "0 of 13" on both).
- Upload one doc. Both surfaces update to "1 of 13".

### F7 — Single Submit button on Review

**Problem:** Defect #7. Two "Submit my answers" buttons on `/intake/review`, one enabled, one disabled.

**Files (likely):**
- `app/pbv-full-app/[token]/intake/review/page.tsx` [inference]

**Implementation:**
- Remove the footer disabled-twin entirely. Keep only the in-content enabled button.
- Verify on mobile that the in-content button is still reachable / sticky if needed.

**Acceptance:**
- Land on `/intake/review`. Exactly one "Submit my answers" button visible.

### F8 — Review page human-readable values

**Problem:** Race shows `"black"`, Ethnicity `"not_hispanic"`, Marital `"single"`, Income type `"employment"`. Cell phone `"8605557777"`.

**Files (likely):**
- `components/pbv/intake/ReviewSection.tsx` [inference]
- Shared `formatLabel` / `humanize` utility — preferred change point.

**Implementation:**
- Map enum values to display labels for all fields. Reuse the same labels shown in the input sections (the source of truth — Black / African American, Not Hispanic / Latino, etc.).
- Format phone numbers as `(860) 555-7777`. Use a small `formatPhone` util.
- Apply consistently across Review page.

**Acceptance:**
- Land on `/intake/review` after filling. Race shows "Black / African American", not "black". Phone shows "(860) 555-7777".

### F9 — Section indicator stable count

**Problem:** "Section 1 of 7" → "Section 1 of 9" → "Section 4 of 7" depending on input.

**Files (likely):**
- `components/pbv/intake/IntakeStepIndicator.tsx` [inference]
- Whatever computes `totalSections` per section.

**Implementation:**
- Decide: total = max possible sections (8 or 9 — count what exists) OR total = base 7 + dynamic 2.
- Recommended: ALWAYS show the max (e.g., "Section X of 9") and label conditional sections clearly when they appear. Tenant sees a consistent denominator.
- Alternative: compute total once at intake start based on initial state and lock it. Less honest but more stable.

**Acceptance:**
- Walk all 7+ sections. The denominator in "Section X of N" never changes during a single intake session.

### F10 — Magic-link routing for `not_started`

**Problem:** Audit found magic link routes to `/dashboard` for tenants with `intake_status: not_started` when `intake_submitted` is stale-true. Won't reproduce for new tenants but is symptomatic of fragile routing.

**Files (likely):**
- `app/pbv-full-app/[token]/page.tsx` [inference — verify the magic-link landing handler]

**Implementation:**
- Routing precedence (top to bottom):
  1. If `intake_status === 'not_started'` → `/intake`
  2. Else if `intake_status === 'in_progress'` → `/intake/{resume_section}` (existing resume behavior)
  3. Else if `intake_status === 'complete'` → `/dashboard`
- Do NOT use `intake_submitted` boolean for routing.

**Acceptance:**
- Tenant with `intake_status: not_started` (and any combination of stale flags) lands on `/intake`.
- Tenant with `intake_status: complete` lands on `/dashboard`.

### F11 — Helpful redirects from gated `/sign/forms` and `/sign/additional-signers`

**Problem:** Defect #11. Both routes silently redirect when gated. No tenant feedback.

**Files (likely):**
- `app/pbv-full-app/[token]/sign/forms/page.tsx`
- `app/pbv-full-app/[token]/sign/additional-signers/page.tsx`

**Implementation:**
- Instead of `redirect()`, render a small explainer page:
  - Title: "You need to complete [step] first"
  - Body: one sentence explaining what's gating (e.g., "Sign your summary first, then we'll generate your forms")
  - Button: "Go to [gating step]" linking to the right URL
- Optional: auto-redirect after 5s with a countdown, OR just leave the button as a manual action.

**Acceptance:**
- Direct nav to `/sign/forms` before summary is signed. Lands on the explainer page, not a silent bounce.
- Same for `/sign/additional-signers` when intake isn't complete.

### F12 — HACH portal data gap (placeholder)

**Status:** Capture only — no implementation in PRD-40.

**Action:**
- Add a TODO comment in the admin component that surfaces HACH data, pointing to a follow-up ticket.
- Open a separate tracking issue: "Investigate HACH portal data ingestion gap — verify what data is missing, decide on automation vs manual entry."
- This stays out of PRD-40 acceptance; called out so it's not lost.

---

## Phasing

**Phase 1 — Tenant-safety (do not ship without):** F1, F2, F3
**Phase 2 — Intake correctness:** F4
**Phase 3 — Tenant-trust polish:** F5, F6, F7, F8, F9
**Phase 4 — Routing fixes:** F10, F11
**Phase 5 — Bookkeeping:** F12

Phases can ship together as one PR or in waves. Recommendation: Phase 1 + Phase 4 are the highest-stakes lifts; ship them first if splitting.

---

## Open questions

- **Should F3 (annual auto-compute) also retroactively repair Maria's existing row?** [inference: no — that's a one-off SQL by Alex, not application logic.]
- **Should F4 doc-gating respect a tenant's prior uploads?** If a tenant uploaded a TANF letter, then went back and unchecked TANF in Income, do we delete the doc? Recommendation: no, soft-detach (keep in storage, mark "no longer required"). Confirm with Alex during build.
- **F5 banner copy translations:** ES / PT translations needed. Sourced from existing translation file or new strings?
- **F9 section count:** does Alex prefer "max-denominator" or "lock-at-start"? Recommendation: max-denominator. Lock-at-start lies if data changes mid-intake.

---

## Acceptance summary (end-to-end test)

Walk a brand-new tenant through the full flow (assumes #12 and #13 are fixed):

1. Provision token. Click magic link → lands on `/intake` (F10).
2. Section 1: all required fields have `*` (F1). Next disabled until filled.
3. Section 3 (Income): check Wages, enter $2500/mo, blur → Annual auto-fills $30,000 (F3).
4. Section 6 (Criminal History): no radio pre-selected (F2). Pick "No". Next enables.
5. Section 7 (Special Circumstances): no radios pre-selected. Pick "No" for all three.
6. Section indicator stays at "Section X of N" with stable N throughout (F9).
7. Review page: Race shows "Black / African American", phone shows "(860) 555-7777", one Submit button only (F7, F8).
8. Submit intake. Land on `/dashboard`.
9. ApplicationStatusBanner visible with "we got your intake" copy (F5).
10. Dashboard shows "0 of 13" docs (F4 gated, F6 consistent).
11. Documents page shows 13 required docs matching declared income/assets — no SSI, no TANF, no Immigration (F4).
12. Try direct nav to `/sign/forms` → explainer page with "Sign summary first" message (F11).

If all 12 pass, PRD-40 ships. If any fail, fix before merge.

---

## Carved out (do NOT include in PRD-40)

- **Defect #12 generate-forms 500** — separate bug fix. Needs dev-server stack trace.
- **Defect #13 upload 500** — separate bug fix. Needs dev-server stack trace.
- **Defect #2 admin annual_income column for existing rows** — one-off SQL, not PRD work.
- **Defect #10 print view shows "Uploaded: <today>" for missing docs** — defer; gated by #13 being fixed before it can be re-tested.
- **HACH portal data ingestion automation** — F12 captures the TODO only.
- **Multi-language re-test (ES, PT)** — separate verification pass.
- **Reset script clearing all flags** — dev tooling fix, not app code. Track in FormStanton repo or Windsurf workflow.

---

## Build prompt

Paired implementation prompt: `docs/fullApp-Plan/prompts/40-pbv-trust-safety-polish_prompt_2026-05-17.md`
