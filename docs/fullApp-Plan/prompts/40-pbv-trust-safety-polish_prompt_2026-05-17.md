# Prompt — PRD-40: Tenant Trust, Safety & Polish

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/40-pbv-trust-safety-polish_prd_2026-05-17.md`
**Target branch:** `feat/pbv-trust-safety-polish-40`

---

## Status: ready to build

This PRD is orthogonal to Defects #12 (generate-forms 500) and #13 (upload 500). It does NOT depend on those being fixed first. Build it now in parallel with the #12/#13 stack-trace investigation. End-to-end acceptance assumes #12/#13 are fixed by the time you walk it — if they aren't, do all the steps you can and skip the post-summary parts.

---

## Read first

1. The PRD: `docs/fullApp-Plan/40-pbv-trust-safety-polish_prd_2026-05-17.md`
2. The source audit (every defect this PRD addresses): `tasks/TENANT_JOURNEY_2026-05-17.md`
3. The PRD-39 build report (for what was already wired during intake → bridge → dashboard): `docs/build-reports/39-pbv-accept-apps-blockers-build-report_2026-05-17.md`
4. The handoff context from the prior chat: `tasks/HANDOFF_2026-05-17_tenant-verification.md`
5. List the intake section components: `ls components/pbv/intake/` (the PRD's file paths are `[inference]` — verify before editing)

---

## Before you touch code — three questions for Alex

Stop and ask these before starting. Don't guess.

1. **F4 (doc gating) — what happens to previously-uploaded docs if a tenant changes intake?** Example: tenant uploads TANF letter, then goes back to Section 3 and unchecks TANF. Options: (a) hard-delete the doc, (b) soft-detach (keep file in storage, mark `status = 'no_longer_required'`), (c) refuse to let them uncheck. Recommend (b) but confirm.

2. **F5 (ApplicationStatusBanner) translations — pull from existing translation file or add new strings?** Check `lib/i18n` or wherever EN/ES/PT lives. If a system exists, use it. If not, ship EN-only with TODOs for ES/PT.

3. **F9 (section indicator) — max-denominator or lock-at-start?** Max-denominator means "Section X of 9" always shows 9 even if some sections are conditional. Lock-at-start computes the count once on intake entry and freezes it. Recommend max-denominator (honest, no surprises). Confirm.

---

## What you're building

13 features across 5 phases, addressing tenant-safety, intake correctness, tenant-trust polish, routing, and bookkeeping. Full feature list and acceptance criteria in the PRD. This prompt walks through build order.

Total target: 4-6 days if no surprises. Phase 1 + Phase 4 alone are 2-3 days and have the highest user-protection value if you have to ship in waves.

---

## Order of operations

**Build in this order: Phase 1 → Phase 4 → Phase 3 → Phase 2 → Phase 5.**

Rationale:
- **Phase 1 (F1, F2, F3)** is small, isolated, and tenant-safety critical. Ship first.
- **Phase 4 (F10, F11)** is routing — small surface area, big tenant-trust impact, no schema work. Knock it out next.
- **Phase 3 (F5-F9)** is polish — moderate effort, no risk.
- **Phase 2 (F4)** is the biggest lift — doc gating by intake. Save for when you have a clear runway.
- **Phase 5 (F12)** is a TODO comment + ticket open. Five minutes.

Each phase produces a working commit. Don't bundle phases into one PR; ship them in sequence so review and rollback are clean.

---

## Phase 1 — Tenant safety

### Step 1 — F1 — Required-field markers

**Goal:** Every gated field has a visible `*` and an accessible "(required)" suffix.

**Files (verify before editing):**
- `components/pbv/intake/*Section.tsx` — every intake section component
- Look for a shared `FormField` / `LabeledInput` wrapper. If one exists, change it once. If not, add `*` inline per field and consider extracting a wrapper as part of this work.

**Implementation:**
- Audit each section component. For every input where the Next button is gated, add `*` to the label and `(required)` to the accessible name (`aria-label` or visible-but-screen-reader text).
- Confirmed gated fields from the audit: Section 1 — name, DOB (last-4 SSN is optional per current behavior — flag for Alex whether to make required). Section 2 — cell phone + email.
- Walk every section yourself and find the rest.

**Verify:** Walk all 7+ sections in the browser. Every gated field has `*`. Use screen reader (or VoiceOver) to confirm "required" announces.

### Step 2 — F2 — Neutral defaults on sensitive radios

**Goal:** No radio is pre-selected on DV, felony, homeless, or reasonable-accommodation questions.

**Files (verify):**
- `components/pbv/intake/CriminalHistorySection.tsx` (route: `/intake/criminal_history`)
- `components/pbv/intake/DvHomelessRaSection.tsx` (route: `/intake/dv_homeless_ra`)

**Implementation:**
- Change radio default from `"No"` to `null` / unselected.
- Confirm Next button stays disabled until user picks an option.
- Add helper copy under each sensitive question explaining why the question is asked and confirming confidentiality. Per-question copy is fine to author yourself; flag for translation later.

**Verify:**
- Land on `/intake/criminal_history` as a fresh tenant. No radio selected. Next disabled.
- Pick "No". Next enables. Submit, go back, confirm "No" persisted (not auto-defaulted on reload).
- Same for `/intake/dv_homeless_ra` — three questions, all neutral on load.

### Step 3 — F3 — Annual income auto-compute

**Goal:** When tenant enters monthly amount in any income row, the "Estimated annual income ($)" field auto-fills to `sum(monthly) * 12`. Tenant can override; if they do, future monthly edits don't clobber the manual value.

**Files (verify):**
- `components/pbv/intake/IncomeSection.tsx`
- `app/api/t/[token]/pbv-full-app/intake/income/route.ts` (if any state mutation server-side)

**Implementation:**
- On `onBlur` of any monthly amount input, read all monthly fields and recompute `annual = sum * 12`.
- If `intake_data.income.annual_was_manually_edited === false` (or undefined), update the annual field state with the computed value.
- When the user types directly into the annual field, set `annual_was_manually_edited: true` in persisted state.
- Display caption under the annual field: "Auto-calculated from monthly. Edit to override."
- Persistence: `intake_data.income.annual_was_manually_edited: boolean`. This is JSONB so no migration. Confirm the column type before assuming.

**Verify with the audit's test data:**
- Maria-equivalent tenant: check Wages, enter 2500 monthly, blur. Annual reads 30000.
- Add Child Support row, enter 500 monthly, blur. Annual reads 36000.
- Manually edit annual to 35000. Edit monthly Wages to 3000. Annual stays at 35000 (manually edited).
- Reload page. Annual still shows 35000. `annual_was_manually_edited` still true.

**Check in with Alex when Phase 1 is done.** Provide a short summary: verified file paths, any deviations from the PRD's inferred paths, anything caught during build worth knowing before Phase 4.

---

## Phase 4 — Routing fixes

### Step 4 — F10 — Magic-link routing precedence

**Goal:** Tenant with `intake_status === 'not_started'` lands on `/intake`, period. Don't read `intake_submitted` for routing.

**Files (verify):**
- `app/pbv-full-app/[token]/page.tsx` — the magic-link landing handler
- Any middleware involved in the redirect chain

**Implementation:**
- Routing precedence:
  1. `intake_status === 'not_started'` → redirect to `/pbv-full-app/[token]/intake`
  2. `intake_status === 'in_progress'` → redirect to `/intake/{resume_section}`
  3. `intake_status === 'complete'` → redirect to `/dashboard`
  4. Fallback: `/intake`
- Do NOT check `intake_submitted`, `signatures_complete`, `next_step`, or `resume_section` for the top-level routing decision. Those are downstream fields.

**Verify:**
- Provision fresh tenant (`intake_status: not_started`). Click magic link. Lands on `/intake`. ✓
- Force-set application to `intake_status: complete` via SQL or admin. Click magic link. Lands on `/dashboard`. ✓
- The audit's scenario (where stale `intake_submitted: true` co-existed with `intake_status: not_started` after a partial reset) should now route to `/intake`. ✓

### Step 5 — F11 — Helpful redirects from gated `/sign/forms` and `/sign/additional-signers`

**Goal:** Replace silent `redirect()` calls with a one-screen explainer.

**Files (verify):**
- `app/pbv-full-app/[token]/sign/forms/page.tsx`
- `app/pbv-full-app/[token]/sign/additional-signers/page.tsx`

**Implementation:**
- Where current code calls `redirect('/dashboard')` or `redirect('/sign/summary')` for a gated state, instead render a small client component:
  - Heading: "You need to complete [step] first"
  - Body: one sentence — "Sign your application summary first, then we'll prepare your forms" / "Finish your intake first, then we'll check household signers"
  - Primary button: "Go to [step]" linking to the right URL
- Match existing Stanton styling. No auto-redirect — manual button only (the silent redirect is the exact behavior we're getting rid of).

**Verify:**
- Direct nav to `/sign/forms` before summary signed → explainer page renders. Click button → goes to `/sign/summary`.
- Direct nav to `/sign/additional-signers` when intake incomplete → explainer page renders. Click button → goes to `/intake/{section}`.

**Check in with Alex when Phase 4 is done.**

---

## Phase 3 — Tenant-trust polish

### Step 6 — F5 — ApplicationStatusBanner diagnosis

**Goal:** The banner from PRD-36 actually renders on `/dashboard` post-intake.

**Files (verify):**
- `components/pbv/sign/TenantDashboard.tsx` — where the banner should mount
- `components/pbv/ApplicationStatusBanner.tsx` (or wherever PRD-36 placed it)
- Whatever data fetch / hook feeds dashboard state

**Implementation:**
- This is a diagnosis-first task. Don't rewrite the component — find why the existing one doesn't render.
- Step through with React DevTools or console logs: is the component mounting? Is the conditional false? Is the prop the conditional checks even getting passed?
- Likely culprits: (a) prop not destructured from state, (b) conditional checks `application_review_status === 'submitted'` instead of `intake_status === 'complete'`, (c) component imported but never used.
- Fix the actual bug. Update the conditional to:
  - `intake_status === 'complete'` AND `application_review_status === null` → "Thanks, [Name]. We received your intake on [date]. Next: complete the tasks below."
  - `application_review_status === 'under_review'` → "Your application is under review. We'll reach out if anything is missing."
  - Etc. — match the PRD-36 spec if one exists.

**Verify:**
- Fresh tenant submits intake. Lands on `/dashboard`. Banner renders at top with submission acknowledgment.
- Banner does NOT render on `/intake/*` pages.

### Step 7 — F6 — Single doc count source of truth

**Goal:** Dashboard and `/documents` show the same number.

**Files (verify):**
- `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` (observed in audit network capture)
- `components/pbv/sign/TenantDashboard.tsx`
- `app/pbv-full-app/[token]/documents/page.tsx` (or its component)

**Implementation:**
- `upload-summary` endpoint returns `{ required_total, required_uploaded, optional_total, optional_uploaded }`.
- Dashboard reads `required_uploaded / required_total` → "X of Y uploaded". Match the documents page text exactly.
- Documents page header reads the same fields. Show optional count as a sub-text: "+N optional uploaded".
- After F4 ships, both `required_total` values drop dynamically per tenant — both surfaces stay synced because they read the same endpoint.

**Verify:**
- Pre-F4: both surfaces show "0 of 22" (or whatever the current total is).
- Post-F4 wage-earner: both show "0 of 13" (or whatever the gated total is).
- Upload one doc. Both surfaces update to "1 of 13" without a manual refresh.

### Step 8 — F7 — Single Submit button on Review

**Goal:** Remove the disabled footer twin on `/intake/review`.

**Files (verify):**
- `app/pbv-full-app/[token]/intake/review/page.tsx`

**Implementation:**
- Find the two "Submit my answers" buttons. The audit confirmed one in the main content (enabled) and one in the footer/contentinfo (disabled). Delete the footer one.
- If the footer button was serving any purpose (sticky mobile reference, accessibility shortcut), verify on mobile that removing it doesn't break the flow. Otherwise, just delete.

**Verify:**
- Land on `/intake/review`. One Submit button visible.
- Mobile: still reachable without absurd scrolling.

### Step 9 — F8 — Review page human-readable values

**Goal:** Race shows "Black / African American" (not `"black"`), phone shows "(860) 555-7777" (not `"8605557777"`), etc.

**Files (verify):**
- `components/pbv/intake/ReviewSection.tsx` (or wherever review rows render)
- Look for shared utilities — `formatLabel`, `humanize`, `prettifyEnum`. If one exists, extend it. If not, create `lib/pbv/format.ts` with `formatEnumLabel(value, mapping)` and `formatPhone(value)`.

**Implementation:**
- Enum mappings should match the labels shown in the input sections. Source those from the same place that renders the dropdown options — don't duplicate. Example:
  ```ts
  export const RACE_LABELS = {
    white: "White",
    black: "Black / African American",
    asian: "Asian",
    // ...
  };
  ```
  Then the dropdown component and the review component both import `RACE_LABELS`.
- `formatPhone("8605557777")` → `"(860) 555-7777"`. Use a tiny formatter; don't pull in libphonenumber for this.
- Apply consistently to: race, ethnicity, marital status, income type, phone (all phones — cell, home, work, alternate).

**Verify:**
- Submit intake with Maria-equivalent data. Land on `/intake/review`. Race reads "Black / African American". Phone reads "(860) 555-7777". Income type reads "Wages / Salary", not "employment".

### Step 10 — F9 — Section indicator stable count

**Goal:** "Section X of N" stays at a consistent N for the whole intake.

**Files (verify):**
- `components/pbv/intake/IntakeStepIndicator.tsx` (or wherever the "Section X of N" header lives)
- Whatever computes `totalSections`

**Implementation:**
- Default recommendation (confirm with Alex per question 3): max-denominator. Hardcode or compute the max possible sections at the route-config level (likely 9 — count from the audit). Always display the max.
- Conditional sections (if a section only appears for certain household configurations) display normally when their turn arrives.
- Alternative if Alex prefers lock-at-start: compute total once when intake is first entered and store in `intake_data.section_count_at_start`. Use that for the denominator throughout.

**Verify:**
- Walk a fresh intake start-to-finish. The "Section X of N" denominator never changes.

**Check in with Alex when Phase 3 is done.**

---

## Phase 2 — Intake correctness (the big one)

### Step 11 — F4 — Documents gated by intake responses

**Goal:** The documents page shows ONLY docs that are relevant to the tenant's declared income, assets, household composition, and citizenship.

**This is the biggest lift in the PRD. Plan for ~1-2 days.**

#### 11a — Build the DocumentTrigger config

**File:** `lib/pbv/documentRequirements.ts` (or wherever the doc-type registry lives — find it first)

Define a typed config mapping doc-types to trigger predicates:

```ts
export type DocumentTrigger = {
  docType: string;
  predicate: (intake: IntakeData, member: HouseholdMember) => boolean;
  defaultState: 'required' | 'optional';
};

export const DOCUMENT_TRIGGERS: DocumentTrigger[] = [
  { docType: 'paystubs', predicate: (_, m) => m.income?.has_wages === true, defaultState: 'required' },
  { docType: 'ssi_award_letter', predicate: (_, m) => m.income?.has_ssi === true, defaultState: 'required' },
  // ... full matrix from the PRD's table
];
```

Use the PRD's trigger matrix as the source. Add unit tests covering each row.

#### 11b — Wire into `upload-summary` and the documents endpoint

The endpoint(s) currently return all 31 doc types unconditionally. Change them to:
1. Load `intake_data` and `intake_snapshot` for the application.
2. For each doc type in the registry, check the predicate against the relevant household member(s).
3. Return only doc rows for triggered doc types.
4. Optional docs show as optional, not required.

#### 11c — Handle intake changes after docs uploaded

Per Alex's answer to pre-build question #1 (likely soft-detach):
- When intake changes such that a previously-required doc is no longer triggered, mark the doc row `status = 'no_longer_required'`.
- The file stays in storage. Admin can still see it on the application detail page.
- Document this behavior in the build report.

#### 11d — Citizenship Declaration is always required

Don't gate this one — every adult signs a citizenship declaration regardless of citizenship status. Hardcode as always-required.

#### 11e — Immigration Documents

Required only if any household member has `citizenship_status !== 'citizen'`. If intake doesn't currently capture citizenship status per member, this PRD adds that question to Section 1 (head of household) and any "Add adult" form. Default value: `citizen` (most common).

**Verify with the audit's expected counts:**
- Wage-earner with Checking, no kids, citizen, no medical: required total ≈ 13 (Paystubs, Checking Statement, Citizenship Declaration, 11 signed forms — confirm exact count).
- SSI recipient with Savings, citizen: ≈ 13 (SSI letter, Savings Statement, Citizenship Declaration, 11 signed forms).
- Immigrant family with kids in daycare: Immigration Docs added, Care 4 Kids optional appears.
- Zero-income tenant: no income-source docs required, but other categories unchanged.

**Check in with Alex when Phase 2 is done.** Confirm the trigger matrix as actually built matches the PRD table.

---

## Phase 5 — Bookkeeping

### Step 12 — F12 — HACH portal TODO

Add a TODO comment in the admin component that surfaces HACH data:

```ts
// TODO(PRD-40 carve-out): HACH portal data ingestion gap.
// See follow-up ticket: <link>
// Decision deferred: automated ingestion vs manual entry workflow.
```

Open a tracking ticket / issue (whichever system Alex uses) with title: "Investigate HACH portal data ingestion gap" linking back to PRD-40.

Five minutes. Don't overthink it.

---

## End-to-end verification

Use chrome-devtools-mcp. Provision a fresh `not_started` token (or coordinate with Alex / Windsurf to reset cleanly). Walk the 12-step acceptance from the PRD:

1. Magic link → `/intake` (F10).
2. Section 1 fields show `*` (F1). Next disabled until filled.
3. Section 3: enter monthly, blur → annual auto-fills (F3).
4. Section 6: no radio pre-selected (F2). Pick to enable Next.
5. Section 7: no radios pre-selected. Pick all three.
6. Section indicator stable throughout (F9).
7. Review: human-readable values + one Submit button (F7, F8).
8. Submit. Dashboard.
9. ApplicationStatusBanner visible (F5).
10. Dashboard shows correct gated count (F4, F6).
11. Documents page matches dashboard count and lists only relevant docs.
12. Direct nav to `/sign/forms` → explainer page (F11).

All 12 pass = PRD-40 ships. Take screenshots of each step.

---

## What to deliver

- Branch `feat/pbv-trust-safety-polish-40`
- Phase 1 commit, Phase 4 commit, Phase 3 commit, Phase 2 commit, Phase 5 commit (separate PRs preferred, or one PR with clear phase commits if reviewer prefers)
- Unit tests for F4 trigger matrix (every row covered)
- Build report at `docs/build-reports/40-pbv-trust-safety-polish-build-report_<ship-date>.md` covering:
  - Each feature: what was changed, file paths corrected from `[inference]` to verified, edge cases caught during build, decisions that diverged from the PRD with rationale.
  - F4 trigger matrix as actually built (might differ from PRD table after schema verification).
  - F5 root-cause diagnosis: why the banner wasn't rendering.
  - Translation status for any new strings.
- PRD-40 status updated from "Draft" to "Shipped" at the top of the PRD file.
- Ping Alex for end-to-end walkthrough using chrome-devtools-mcp.

---

## Gotchas

- **F1 (markers) is repetitive.** Don't skip sections because the change is mechanical. Walk every section; the audit only verified Section 1 and Section 2.
- **F2 (defaults) — DO NOT just blank the radio prop.** Confirm the form schema's "required" validation still triggers when nothing is selected. If the form treats unselected as null and lets Next enable, the bug got worse.
- **F3 (annual income) — beware of race conditions.** Multiple onBlur events can fire simultaneously when a tenant tabs through fields. Use a debounce or recompute on every blur from a single computed function.
- **F4 (doc gating) — schema verification first.** Before building the trigger matrix, verify that `application_documents` actually has the doc rows you can mark as gated. Some doc rows may not exist yet (created lazily on first upload). If lazy, the trigger logic lives in the endpoint that returns the doc list, not on row creation.
- **F4 — don't lose docs on intake change.** Soft-detach (status = 'no_longer_required'), don't hard-delete.
- **F5 (banner) — diagnose, don't reimplement.** If the banner exists but doesn't render, find the conditional bug. Don't write a new component.
- **F8 (review labels) — single source of truth.** If you scatter enum→label maps across 10 components, the next person to add a race option will forget one. Use a shared map.
- **F10 (routing) — don't break resume.** The `in_progress` resume to `/intake/{resume_section}` is existing behavior. Don't accidentally regress it while fixing the `not_started` case.
- **F11 (helpful redirects) — gating logic might be server-side `redirect()`.** Convert to client-rendered explainer; otherwise the navigation never lands at the explainer URL.

---

## When something is ambiguous

Stop and ask. Specifically:
- If the inferred file paths in the PRD are wrong, update the PRD with the correct paths before continuing. The PRD's `[inference]` markers are starting points, not facts.
- If a section component is too tangled to add `*` markers cleanly, factor it first but flag the refactor in the build report.
- If `application_documents` lacks a column the trigger logic needs (e.g., `category` lives on the template, not the row), reconcile and adjust the query.
- If a migration is needed beyond what the PRD predicts (none currently planned), stop and ask before writing it.
- If anywhere the PRD says `[inference]` and the reality is significantly different, update the PRD and tell Alex what changed.
