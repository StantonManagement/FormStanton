# Income Eligibility Engine — PRD

**Status:** Draft — ready for build
**Depends on:** None (can build in parallel with `hach-auth`)
**Used by:** hach-reviewer-portal, stanton-pipeline-dashboard

---

## Problem Statement

Today, income qualification math gets done twice — once by Stanton staff before submission, again by HACH reviewers during review. Both are manual, error-prone, and time-consuming. Paystubs get multiplied by the wrong period, SSI amounts are miscounted, AMI limits are looked up from memory or a printout.

We need a single income engine: given documented income sources for a household, produce the annualized household income, compare it to the applicable HUD AMI limit, and flag any discrepancy with the tenant's self-reported claim. Both Stanton (pre-submission) and HACH (during review) see the same math.

This is also the "wow moment" of the reviewer portal — the thing that converts a skeptical HACH reviewer into a user. Previously 10 minutes of arithmetic per packet; now they verify our math instead of doing it.

---

## Users & Roles

| Role | What they see |
|---|---|
| HACH Reviewer | Read-only income panel on every packet; verifies math against source documents |
| Stanton Staff | Same panel on Stanton side before submission — knows if household will likely qualify |
| Stanton Admin (Alex) | Manages HUD AMI limits table (annual updates) |

---

## Core Features

### 1. Income source catalog
Supported source types:
- `employment` (weekly, bi-weekly, semi-monthly, monthly paystubs)
- `ssi` (monthly)
- `ss` (monthly)
- `pension` (monthly or annual)
- `railroad_retirement` (monthly)
- `child_support` (monthly)
- `alimony` (monthly)
- `tanf` (monthly)
- `food_stamps` (monthly — tracked but typically excluded from income)
- `unemployment` (weekly)
- `workers_comp` (weekly or monthly)
- `self_employment` (annual net)
- `training_income` (weekly or monthly)
- `grants_scholarships` (per term or annual)
- `rental_income` (monthly)
- `gifts_contributions` (monthly)
- `other` (with description)

Each source links to the supporting document (`form_submission_documents.id`).

### 2. Annualization logic
| Frequency | Multiplier |
|---|---|
| weekly | × 52 |
| bi_weekly | × 26 |
| semi_monthly | × 24 |
| monthly | × 12 |
| quarterly | × 4 |
| annual | × 1 |

Paystub-specific: if 4 weekly stubs provided, average them and × 52. If 2 bi-weekly, average × 26.

### 3. Household income calculation
- Sum all member income sources
- Output: `documented_annual`
- Per-source breakdown preserved for display

### 4. AMI limit lookup
- Inputs: MSA code (Hartford CT = `25540`), household size, AMI band (default `50` for PBV)
- Source: HUD income limits table, updated annually
- Output: `annual_limit`

### 5. Qualification determination
- `qualifies = documented_annual <= annual_limit`
- `claimed_annual` comes from intake form
- `delta = documented_annual - claimed_annual`
- `within_tolerance = abs(delta) < 2400 AND abs(delta / claimed_annual) < 0.10`
  - (Matches HUD's EIV $2,400 discrepancy threshold)
- If NOT within tolerance → flag for reviewer attention with dollar delta

### 6. Output payload
```json
{
  "household_size": 3,
  "bedroom_count": 2,
  "msa_code": "25540",
  "ami_band": 50,
  "claimed_annual": 42000,
  "documented_annual": 42180,
  "annual_limit": 50400,
  "qualifies": true,
  "delta": 180,
  "delta_pct": 0.43,
  "within_tolerance": true,
  "breakdown": [
    {
      "member": "Maria Garcia",
      "member_id": "uuid",
      "source_type": "employment",
      "source_label": "Hartford Hospital",
      "frequency": "weekly",
      "amount_per_period": 720,
      "annualized": 37440,
      "document_id": "uuid",
      "document_label": "Paystubs (4 weekly)"
    }
  ],
  "computed_at": "2026-04-24T14:22:00Z"
}
```

### 7. AMI limits admin UI
- Located at `/admin/settings/ami-limits` (Stanton-side only, super admin permission)
- Table view: MSA × household size × AMI band → annual limit
- Manual entry or CSV upload
- Effective date per row (new limits published annually by HUD)
- Historical limits preserved — computations against a historical application use the limit effective at submission time

### 8. API
- `GET /api/pbv/applications/[id]/income-eligibility` — returns full payload above
- Accessible to both Stanton staff and HACH reviewers (scoped via auth)

---

## Data Model

```sql
-- HUD AMI limits (seed annually)
CREATE TABLE hud_ami_limits (
  id uuid primary key default gen_random_uuid(),
  msa_code text not null,
  msa_name text not null,
  household_size int not null,
  ami_band int not null,              -- 30, 50, 80
  annual_limit integer not null,      -- whole dollars
  effective_date date not null,
  source text,                        -- link or citation
  created_at timestamptz default now(),
  UNIQUE(msa_code, household_size, ami_band, effective_date)
);

CREATE INDEX hud_ami_lookup ON hud_ami_limits(msa_code, household_size, ami_band, effective_date desc);

-- Normalized income sources per application
CREATE TABLE pbv_income_sources (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  member_id uuid references pbv_application_members(id) on delete cascade,
  source_type text not null,
  source_label text,                  -- e.g. "Hartford Hospital" or "SSI for Diego"
  amount_per_period numeric(10,2) not null,
  frequency text not null,            -- weekly, bi_weekly, semi_monthly, monthly, quarterly, annual
  document_id uuid references form_submission_documents(id),
  notes text,
  created_at timestamptz default now()
);

CREATE INDEX income_sources_app_idx ON pbv_income_sources(application_id);
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `pbv_full_applications` | Read | Get household, claimed income, MSA |
| `pbv_application_members` | Read | Household members for size count |
| `form_submission_documents` | Read | Link income sources to supporting docs |
| Intake form submissions | Read | Extract reported income sources into `pbv_income_sources` |

---

## Implementation Phases

### Phase 1 — Schema + seed
- Create `hud_ami_limits` and `pbv_income_sources` tables
- Seed Hartford MSA (25540) 2024 limits for household sizes 1–8 at 30/50/80 AMI bands
- [Unverified] Source figures from HUD's annual release — Dan or Alex confirms current table

### Phase 2 — Source normalization
- Migration script: walk existing intake submissions, extract income data, populate `pbv_income_sources`
- For applications already submitted, best-effort parse from stored JSONB

### Phase 3 — Computation function
- Pure function `computeHouseholdIncome(applicationId): EligibilityPayload`
- Annualization rules per frequency
- AMI lookup with effective-date filter
- Tolerance check

### Phase 4 — API endpoint
- `GET /api/pbv/applications/[id]/income-eligibility`
- Auth-scoped (Stanton staff OR HACH user where application is in their scope)

### Phase 5 — AMI limits admin UI
- `/admin/settings/ami-limits` CRUD
- CSV import/export
- Historical view

---

## Out of Scope

- Direct EIV integration (HUD's Enterprise Income Verification system — would require HACH credential integration and is out of our access)
- Automatic paystub OCR (manual data entry by tenant or staff, validated against uploaded doc)
- Asset income calculation (separate from regular income; handled by HACH directly per their rules — v2)
- Deductions (childcare, medical for elderly/disabled) — v2
- Interim recertification math (annual reexam — v2)

---

## Open Questions

| Question | Owner |
|---|---|
| Confirm 2024 HUD AMI figures for Hartford MSA at 50% band | Dan / Alex |
| Do we use adjusted gross income or gross income for PBV qualification? (matters for deductions) | Dan |
| For self-employment, which doc is authoritative — tax return, profit/loss statement, or both? | Dan |
| Food stamps: typically excluded from income per HUD — confirm for PBV | Dan |
| How do we handle a household where income is $0 (declared zero income)? — different form flow | Dan |
