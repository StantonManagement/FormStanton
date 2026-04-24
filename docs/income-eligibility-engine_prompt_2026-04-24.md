# Windsurf Prompt — Income Eligibility Engine

**PRD:** `income-eligibility-engine_prd_2026-04-24.md` (read it first)

---

## Context

Our PBV application flow collects household income from tenants (claimed amounts + source types) and supporting documents (paystubs, SSI letters, etc.). Currently there's no systematic way to compute the actual documented household income and compare it against HUD AMI limits for qualification.

We need a reusable income engine: given an application, return the annualized household income, the applicable income limit, whether it qualifies, and the delta from the claimed amount — all with a per-source breakdown tied back to the supporting documents.

This engine powers the "Income & Eligibility" panel in both the Stanton admin view and the HACH reviewer portal.

---

## Build this pass

All five phases from the PRD.

### Specific scope

1. **Migration** creating `hud_ami_limits` and `pbv_income_sources` tables per PRD schema.

2. **Seed data** for `hud_ami_limits`:
   - MSA: Hartford-East Hartford-Middletown CT MSA (code 25540)
   - Household sizes 1 through 8
   - AMI bands 30%, 50%, 80%
   - Effective date: most recent HUD publication [unverified — confirm figures with Alex before hardcoding]
   - Use a placeholder comment in the seed file noting the figures need Dan's confirmation

3. **Computation function** in `lib/pbv/income-eligibility.ts`:
   ```ts
   export async function computeHouseholdIncome(
     applicationId: string,
     asOfDate?: Date
   ): Promise<EligibilityPayload>
   ```
   - Pure function (takes Supabase client as dependency for testability)
   - Annualizes each source per PRD frequency multipliers
   - Sums household total
   - Looks up AMI limit based on household size + MSA + effective date
   - Computes delta, within_tolerance flag (HUD EIV rule: `abs(delta) < 2400 AND abs(delta_pct) < 0.10`)

4. **API endpoint** at `/api/pbv/applications/[id]/income-eligibility`:
   - GET only
   - Auth: Stanton staff OR HACH user with this app in scope (use `requireAnyOf()` pattern)
   - Returns `EligibilityPayload` JSON

5. **Admin UI** at `/admin/settings/ami-limits`:
   - Table view of all limits (MSA × household size × band × effective date)
   - Add new row form
   - CSV upload (paste a HUD table, parse, preview, commit)
   - Permission-gated to `admin.settings.manage` (super admin only)
   - Match existing admin UI style (see `/admin/settings/` if any exist, else follow `/admin/pbv` aesthetic)

6. **Ingestion helper** in `lib/pbv/income-sources.ts`:
   ```ts
   export async function syncIncomeSourcesFromIntake(applicationId: string)
   ```
   - Reads the raw intake submission JSONB for an application
   - Normalizes income fields into `pbv_income_sources` rows
   - Idempotent — deletes existing rows for the app and reinserts
   - Called automatically when intake form is submitted AND exposed as a manual "recompute" button on the Stanton app detail page

---

## Tech constraints

- Next.js App Router
- Supabase server-side (service role for reads that cross user scope boundaries, e.g., AMI limits are global)
- TypeScript; define `EligibilityPayload` type and export it from `lib/pbv/income-eligibility.ts`
- Pure functions for the math — no side effects in `computeHouseholdIncome` beyond DB reads
- Write unit tests for annualization logic (frequency × amount → annualized) — use Vitest or whatever test framework is already in the project

---

## Acceptance criteria

- [ ] Migration runs cleanly
- [ ] AMI limits seed populates 24 rows (8 sizes × 3 bands × 1 effective date) for Hartford MSA
- [ ] Existing application with tenant-claimed $42,000 and 4-weekly paystubs at $720 each + SSI $515/mo returns documented annual of $43,620 [$720 × 52 + $515 × 12]
- [ ] Same scenario with claimed $42,000 returns `within_tolerance: true` (delta $1,620 < $2,400 AND 3.86% < 10%)
- [ ] Scenario with claimed $40,000 but documented $50,000 returns `within_tolerance: false`, flags for review
- [ ] AMI lookup: Hartford MSA, household size 3, 50% band → returns correct 2024 limit [verify figure with Dan]
- [ ] API endpoint returns 403 to a HACH user whose scope doesn't include the application
- [ ] Admin UI can add a new AMI row and it's immediately used by the next computation call

---

## Do NOT in this pass

- Build the reviewer-portal UI panel that *displays* the eligibility payload (that's in `hach-reviewer-portal`)
- Build the Stanton dashboard display (that's in `stanton-pipeline-dashboard`)
- Wire up EIV API integration (out of scope entirely)
- Build asset income, deductions, or interim recertification logic (v2)
- Touch the intake form UI — only the backend normalization helper
