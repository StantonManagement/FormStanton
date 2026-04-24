# PRD — PBV Application Layer

**Date:** April 23, 2026
**Owner:** Alex
**System:** FormStanton (standalone Supabase project)
**Status:** Draft — ready for Windsurf execution
**Depends on:** Foundation Review Layer (`foundation-review_prd_2026-04-23.md`) Phase 2 minimum
**Supersedes:** Original PBV PRD (Phase 1 pre-app work already shipped; documented below)

---

## Problem Statement

Stanton Management can award Section 8 Project-Based Vouchers (PBV) directly to existing tenants. Round 1 awards are targeted for ~July 1, 2026; Round 2 for ~September 1, 2026. The program has two stages:

1. **Pre-application** — short qualification screen. Tenants submit; Stanton and the housing authority review together. Output: likely qualifies / does not qualify. **Already built (Phase 1).**
2. **Full application** — invited tenants only. Structured intake (household composition, income, assets, expenses, criminal history) plus 15–20 supporting documents per household, plus ~10 signed HUD/HACH forms per adult. **Not yet built. This PRD.**

The full application cannot be built on the existing atomic-review workflow because individual documents need per-document approve/reject/resubmit with reasons. That foundation is being built in a parallel PRD (`foundation-review_prd_2026-04-23.md`). This PRD depends on it.

## Goals

Deliver the PBV Full Application on top of the Foundation Review Layer, plus the two gaps remaining from Phase 1 (summary PDF, thresholds admin).

Deliverables:
1. PBV Full Application intake form (structured data + signatures)
2. Document collection for all required HCV application items
3. Multi-signer support for the ~10 HUD/HACH forms each adult must sign
4. HHA (HC application) auto-fill via docxtemplater when package is complete
5. SSN and sensitive-data access controls (data classification, access logging)
6. PBV Phase 1 completion: summary PDF generation + thresholds admin API/UI

## Non-Goals

- Rebuilding the pre-application. Phase 1 delivered the pre-app; only the two gaps (PDF + thresholds admin) are in scope here.
- Rebuilding the review workflow. Use the foundation.
- Section 8 annual recertification. Separate future PRD.
- Main-DB integration (AppFolio write-back of PBV enrollment). Flag as out of scope; address in a later PRD once HACH contract terms are known.
- ESA, VAWA, or Reasonable Accommodation intake forms. These are conditional forms referenced in the packet; handle via per-document upload with staff flagging, not custom intake.

## Users & Roles

| Role | What they do |
|---|---|
| Head of household (tenant) | Completes pre-app (done), receives full-app invite, completes intake form, uploads docs, collects signatures from other adults on shared device, tracks status |
| Other adults in household | Sign required HUD/HACH forms on same device as head of household |
| Staff reviewer (Tess, Christine) | Reviews each document per foundation workflow, approves/rejects/waives, runs qualification math, generates PDF summary, packages for HACH |
| Alex / Dan | Reviews qualification decisions, signs off on Stanton-side approval before advancing to HACH |
| HACH | Receives summary PDF + HHA application + document package |

## Design Principles

1. **Sit on the foundation.** Do not duplicate review logic, file naming, revision tracking, or bulk export from the foundation PRD. If something feels like duplication, it is.
2. **Sensitive data is different.** SSNs, income, criminal history, citizenship docs. Access logging, encryption at rest, role-gated reads. Not optional.
3. **Multi-signer on one device.** Head of household drives the session. Other adults sign on the same device. No per-adult magic links.
4. **Auto-fill HHA, don't replace it.** The Hartford Housing Authority HC application is the artifact HACH receives. We collect data in our shape and render it into their form via docxtemplater.
5. **HC form versions matter.** Some HUD forms in the packet have expired OMB numbers. Use whatever HACH says is current; do not ship with expired versions.

## Phase 1 Gaps to Close First

Before the full application work begins, close the two open items from Phase 1:

1. **Summary PDF generation** — admin detail drawer on `pbv_preapplications` needs a "Generate Summary PDF" button. Output: PDF containing pre-app form data, qualification math, household member table, citizenship detail, reviewer decision. Format must be HACH-presentable (Stanton header, clean layout).
2. **Thresholds admin** — `/api/admin/pbv/thresholds` GET/POST and a simple admin UI page for Dan to update the income threshold table by household size. Today values are seeded directly in DB.

These are small. Do them as Phase 0 of this PRD.

## Data Model

The PBV application layer adds two tables and reuses foundation tables for documents.

### `pbv_full_applications`

```sql
create table pbv_full_applications (
  id uuid primary key default gen_random_uuid(),
  preapp_id uuid references pbv_preapplications(id) not null,
  form_submission_id uuid references form_submissions(id) not null,  -- foundation review row
  unit_id uuid,  -- links to canonical unit if available
  head_of_household_name text not null,
  household_size integer not null,
  bedroom_count integer not null,
  total_annual_income numeric,
  citizenship_status text,
  dv_status boolean default false,
  homeless_at_admission boolean default false,
  reasonable_accommodation_requested boolean default false,
  stanton_review_status text default 'pending',  -- 'pending' | 'approved' | 'denied' | 'needs_info'
  stanton_review_notes text,
  hha_review_status text default 'pending',
  hha_review_notes text,
  hha_application_file text,  -- generated HC application filename (storage path)
  summary_pdf_file text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);
```

### `pbv_household_members`

```sql
create table pbv_household_members (
  id uuid primary key default gen_random_uuid(),
  full_application_id uuid references pbv_full_applications(id) on delete cascade,
  name text not null,
  date_of_birth date,
  ssn_encrypted text,                  -- encrypted at rest; see SSN Handling section
  ssn_last_four text,                  -- for display/search; plaintext OK
  relationship text,                   -- 'head' | 'spouse' | 'child' | 'other'
  age integer,
  annual_income numeric default 0,
  disability boolean default false,
  student boolean default false,
  citizenship_status text,             -- 'citizen' | 'eligible_non_citizen' | 'ineligible' | 'not_reported'
  signature_required boolean default false,  -- true for adults 18+
  signature_image text,                -- storage path to signature PNG
  signature_date date,
  created_at timestamp default now()
);
```

### Foundation Tables Used

- `form_submissions` — one row per PBV full application, `review_granularity = 'per_document'`
- `form_submission_documents` — one row per required document (seeded from `form_document_templates` for `form_id = 'pbv-full-application'`)
- `form_submission_document_revisions` — resubmit history
- `form_document_templates` — seeded with PBV document list (paystubs, HUD-9886-A, HACH release, etc.)

## Document List (seeded into `form_document_templates`)

See `pbv-campaign-planning.md` for full list. Categorized:

**Income verification** (per employed/benefit-receiving adult):
- Paystubs (4 weekly / 2 bi-weekly)
- Pension / SSI / SS / Railroad retirement award letters
- Child support order or payment history
- TANF / food stamps / unemployment / workers comp benefit letters
- Self-employment contract + earnings
- Training program letter / grant documentation
- Cash App / Zelle / Venmo / PayPal — 2 months statements

**Banking & assets** (per adult):
- Bank statement — savings (last month)
- Bank statement — checking (last months)
- Insurance settlement letter
- CD / trust / bond statements
- Life insurance policy showing value

**Medical / childcare** (conditional):
- Doctor's bills (last year) — if claiming medical deduction
- Pharmacy statements — if claiming prescription deduction
- Care 4 Kids certificate

**Citizenship / immigration** (per non-citizen):
- I-551, I-94, I-688, I-688B as applicable
- Proof of age — non-citizens 62+

**Signed forms** (per adult):
- Main application attestation
- Criminal background release
- Child support OR no-child-support affidavit
- HUD-9886-A (Release of Information)
- HACH Authorization for Release of Information
- Obligations of Family
- Family Certification of Briefing Documents Received
- Debts Owed to PHAs acknowledgment (HUD-52675)
- Citizenship Declaration
- EIV Guide receipt
- HUD-92006 Supplemental Contact
- VAWA Certification (HUD-5382) — conditional
- Reasonable Accommodation request — conditional

Conditional documents use the `conditional_on` JSONB column on `form_document_templates` to express visibility rules based on intake form data.

## Multi-Signer Handoff

One magic link per unit. Head of household opens it. After intake form, they reach the signature section. UI:

1. Lists every adult 18+ in the household (pulled from `pbv_household_members`)
2. For each adult, shows which forms they need to sign
3. Head of household taps "Pass device to [name]"
4. Device shows a brief handoff screen asking that person to confirm their name
5. That person signs their required forms
6. Device returns to head of household for next signer
7. All signatures captured before submission

No per-adult login. Identity is self-attested; forgery risk is mitigated by the legal weight of the signed forms themselves, not by the portal.

## Qualification Logic Hook

Full application qualification is more nuanced than pre-app (pre-app is income thresholds + citizenship; full app must match documented income against claimed income).

Staff-assisted review, not automated denial. The foundation review workflow drives the document-by-document cycle. This PRD adds a panel in the admin detail view that shows:

- Claimed income per member (from intake)
- Documented income per member (sum of verified paystubs, benefit letters, etc. for that member)
- Delta highlighted if >10% off
- Asset totals
- Expense totals (for deduction calculations)

Staff uses this panel to decide whether to advance to HACH. No auto-denial.

## HHA Auto-Fill

When Stanton review status is `approved` and all required documents are `approved` or `waived`:

1. Data from `pbv_full_applications` + `pbv_household_members` + selected form answers flows into a docxtemplater template of the current HC application
2. Generated .docx saved to storage, filename stored on `pbv_full_applications.hha_application_file`
3. Included in the HACH handoff package

Template is version-controlled. When HACH releases a new HC application version, we update the template file, not the code.

## SSN Handling

SSNs go in `pbv_household_members.ssn_encrypted`. Requirements:

- Column-level encryption (Supabase `pgsodium` or application-level AES-GCM with key in environment, not in DB)
- Only `ssn_last_four` visible in list views and general admin UI
- Full SSN visible only on detail drawer, and only to users with `pbv_reviewer` role
- Every read of full SSN logged to `pbv_access_log` table: who, when, which application, action
- Full SSN never rendered to the tenant after submission (they submitted it; confirmation screen shows last 4 only)
- Full SSN never included in the summary PDF; last 4 only

```sql
create table pbv_access_log (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  action text not null,       -- 'view_full_ssn' | 'export_application' | etc.
  resource_type text not null,
  resource_id uuid not null,
  accessed_at timestamp default now(),
  notes text
);
```

## HACH Handoff Package

When an application is approved by both Stanton and HACH review pipelines, staff can generate the handoff package:

- Summary PDF (household, income, qualification math, reviewer decisions)
- Completed HHA application (from template)
- All approved documents (from `form_submission_document_revisions`, latest approved revision of each)
- Manifest CSV

This uses the foundation's bulk export endpoint with PBV-specific metadata added to the manifest.

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| Foundation review layer | Consume | Per-document review, revision tracking, file naming, bulk export |
| `pbv_preapplications` (Phase 1) | Read | Link full app back to pre-app |
| FormStanton form library | Register | PBV full application registered as `form_id = 'pbv-full-application'` with `review_granularity = 'per_document'` |
| Supabase Storage | Write | Documents via foundation; generated HHA + summary PDF |
| Existing signature canvas | Reuse | Multi-signer uses same react-signature-canvas used in pre-app |
| docxtemplater | Generate | HHA application + summary PDF |

## Implementation Phases

**All phases checkpoint at end. Do not self-advance.**

### Phase 0 — Close Phase 1 Gaps
- Build summary PDF generation for `pbv_preapplications` (button + API route + docxtemplater template)
- Build `/api/admin/pbv/thresholds` GET/POST + admin UI page
- **Checkpoint:** Alex confirms both work.

### Phase 1 — Reconnaissance
- Read the shipped pre-app code (`PbvPreappForm.tsx`, admin detail drawer, pre-app API routes) to understand existing patterns
- Read the Foundation Review Layer output (after its Phase 2 is approved) to understand the review API and document template seeding
- Identify every reusable piece from pre-app (signature canvas, trilingual i18n, form section patterns)
- Output: `tasks/pbv-app-audit.md`

**Checkpoint:** Alex approves Phase 2.

### Phase 2 — Data Layer + Form Templates
- Migration: `pbv_full_applications`, `pbv_household_members`, `pbv_access_log`
- SSN encryption implementation + tests
- Seed `form_document_templates` with the full PBV document list (conditional rules included)
- Migration: rollback included

**Checkpoint:** Alex reviews schema + encryption approach.

### Phase 3 — Intake Form (structured data)
- Tenant-facing full application intake form
- Household composition repeating group
- Income section per adult (all sources)
- Assets section
- Expenses section
- Criminal history section (per member)
- DV / homelessness / reasonable accommodation flags
- Trilingual
- Reuses visual patterns from `PbvPreappForm.tsx`
- Saves to `pbv_full_applications` + `pbv_household_members`
- Does not yet collect signatures (Phase 4)
- Does not yet collect documents (Phase 5)



### Phase 4 — Multi-Signer Signature Flow
- After intake form, signature section
- Per-adult signer handoff UI
- Per-form signature capture for required HUD/HACH forms
- Saves signature images, dates, and attestation flags
- Creates `form_submission_documents` rows for each signed form (status: `submitted`)


### Phase 5 — Document Collection
- Integrates with foundation per-document upload flow
- Document list renders from `form_document_templates` with conditional rules applied based on Phase 3 intake answers
- Tenant uploads per document
- Tenant sees per-document status (handled by foundation)



### Phase 6 — Admin: Qualification Math Panel + HHA Generation
- Admin detail view for `pbv_full_applications` (separate from pre-app)
- Panel showing claimed vs. documented income
- HHA application generation button (disabled until all required docs approved)
- HACH handoff package generation button (bulk export wrapper)


### Phase 7 — Access Controls + Audit Log
- Role-based read access for full SSN
- `pbv_access_log` writes on every sensitive read
- Admin audit log viewer

**Checkpoint:** Alex confirms access logs populate correctly.

## Anti-Slop Guardrails

Same as Foundation PRD:

- No inventing files, routes, components, tables
- Cite existing code before claiming reuse
- No placeholder code
- No marketing language
- `[ASSUMPTION]` flags inline for review
- No JSONB-hacking around schema; request amendment instead
- Extend existing components before creating new ones
- `tasks/todo.md` updated at end of every phase

## Sensitive Data Checklist (gate for Phase 7 sign-off)

- [ ] SSNs encrypted at rest
- [ ] Full SSN visible only to `pbv_reviewer` role
- [ ] Every full SSN read logged
- [ ] SSNs redacted in all PDF outputs except where legally required
- [ ] SSNs redacted in all log output
- [ ] Document upload routes require authentication (tenant via token, staff via session)
- [ ] Sensitive documents (citizenship, criminal history) follow same access log as SSN

## Decisions Made

| Decision | Rationale |
|---|---|
| Build on foundation, not parallel | Duplicating review logic is the failure mode we just spent a PRD avoiding |
| Multi-signer on one device, not per-adult links | Matches real workflow; reduces complexity; legal weight sits in the signed form itself |
| Staff-assisted qualification, not auto-denial at full-app stage | Too much nuance; documented income almost never matches claimed perfectly |
| SSN encryption column-level, not table-level | Need search by SSN last four; can't encrypt the searchable column |
| HHA form version in template file, not code | Decouples code deploys from regulatory form updates |
| Access logging on sensitive reads | Required by FormStanton's role in handling HUD-covered data |

## Open Questions

| Question | Owner | Blocks |
|---|---|---|
| Which HC application version is current per HACH? | Alex / HACH | Phase 6 template |
| Which HUD form versions are current (several in packet show expired OMB numbers)? | Alex / HACH | Phase 4 signature forms |
| Role definitions: who gets `pbv_reviewer` exactly? | Alex / Dan | Phase 7 |
| Does Stanton review need Dan's sign-off separately from Tess/Christine, or is one layer enough? | Alex / Dan | Phase 6 admin panel |
| Briefing documents distribution — digital confirmation sufficient, or physical distribution required? | Alex / HACH | Phase 5 |
| Data retention policy for rejected applications? | Dan | Post-launch |

## Success Criteria

- Pre-app Phase 1 gaps closed (summary PDF + thresholds admin)
- A head of household can complete intake, collect signatures from all adults on one device, upload all required documents, and submit
- Staff can review each document individually via foundation workflow
- Staff can generate HHA application and handoff package when complete
- No SSN appears in any PDF, log, or UI outside the role-gated detail drawer
- Every sensitive read is logged
- Phase 1 pre-app still works unchanged
