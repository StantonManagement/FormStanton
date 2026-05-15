# PBV Form Execution System — PRD

**Date:** May 14, 2026
**Author:** Alex
**Status:** Active — architecture validated, build pending
**Supersedes:** `form-html-rendering-pilot_prd_2026-05-14.md` (abandoned), `form-pdf-overlay-pilot_prd_2026-05-14.md` (completed, pilot pass)
**Reads with:** `form-execution-plan_2026-05-14.md` (strategic context)
**Suggested branch:** `feature/pbv-form-execution`

---

## 1. Context

The PDF-overlay pilot proved the architecture works. This PRD specifies the system that uses it: how tenants flow from intake to signed submission, how their data maps to forms, how signatures are captured and applied, how the package gets to HACH.

This is a build spec, not a strategy doc. For the strategic narrative and tenant journey, see `form-execution-plan_2026-05-14.md`.

For decisions awaiting Dan/HACH input, see `dan-hach-decision-log_2026-05-14.md`. Some items in this PRD are noted as "pending decision" — they have working defaults that can be changed once Dan answers.

---

## 2. Architecture (Locked)

```
Tenant (Portuguese/Spanish/English UI)
        ↓
Phase 1: Sectioned intake → answers stored in unified data model
        ↓
Phase 2: System generates filled PDFs (stamp via pdf-lib on source PDFs)
        ↓
Tenant reviews stack of generated PDFs + Portuguese/Spanish/English summary doc
        ↓
Tenant signs once → signature stamped on every form they're authorized to sign
        ↓
Phase 3: Other adults sign (same device default, magic-link fallback)
        ↓
Submission package: 11–14 stamped PDFs + summary doc + audit trail → HACH
```

Stack:
- Next.js App Router (existing)
- Supabase (existing) — Postgres + Storage
- pdf-lib (already installed, validated in pilot) — PDF stamping
- pdfminer.six (Python, already installed) — coordinate extraction
- pymupdf (Python, **to install**) — visual verification of stamped output
- react-signature-canvas (existing) — signature capture
- Twilio (in progress) — magic links + SMS resume notifications
- Resend (existing) — email fallback

No new SaaS dependencies. No hosted form-rendering services.

---

## 3. Three-Phase Tenant Experience

### 3.1 Phase 1 — Sectioned Intake

The tenant fills one continuous intake organized into sections. Form names are not surfaced. Sections:

1. **About your household** — names, DOBs, SSNs, relationships, disability/student flags, citizenship status
2. **Your contact info** — phones, email, alternate contact
3. **Income** — per-adult employment, benefits (SSI, SS, TANF, food stamps, unemployment, workers comp, child support, self-employment), Cash App/Zelle/Venmo
4. **Zero-income declaration** — only shown if any adult declared zero income
5. **Assets** — real estate, accounts, CDs, trusts, bonds, life insurance, asset disposal in last 2 years
6. **Childcare and disability expenses** — Care 4 Kids, paid relative, etc.
7. **Medical expenses** — only shown if HOH or spouse is 62+ or disabled
8. **Criminal history** — per household member
9. **Domestic violence / homeless / accommodation status** — gates VAWA and Reasonable Accommodation forms
10. **Household expenses** — only shown if household declared zero income
11. **Review** — tenant sees their answers summarized in plain language, can edit any section

Rules:
- Each section is its own page. Mobile-first. One-question-at-a-time within complex sections.
- Auto-save on every field change. No "save" button to remember.
- Progress indicator shows section completion + estimated time remaining ("3 sections left, about 12 minutes").
- Conditional sections (4, 7, 10) only appear if prior answers triggered them.
- Tenant can leave and resume via SMS link (see §6 Save-and-Resume).

### 3.2 Phase 2 — Review and Sign

When intake is complete, the system:

1. Determines which forms the tenant needs to sign as HOH and as an adult household member
2. Resolves conditional forms based on intake answers (VAWA shown only if intake question 8 = yes; Reasonable Accommodation only if question 10 = yes; child support affidavit = `child_support_affidavit` OR `no_child_support_affidavit` based on income section)
3. Generates each form as a stamped PDF using the tenant's data + the field map for that form + the source PDF in the tenant's submission language
4. Generates the plain-language summary document in the tenant's preferred language

The tenant sees:

- **Top of screen:** the Portuguese/Spanish/English summary document. Required reading. They sign this first.
- **Stack below:** each generated form as a thumbnail with a plain-language one-line description in their language. Tap to view the full PDF.
- **Bottom:** a single "Sign all of these" button. Tapping opens the signature canvas.

The tenant draws their signature once. The system:
- Saves the signature as a PNG
- Stamps that signature image onto every form where the tenant is the required signer
- Captures audit trail: timestamp, IP, user agent, typed name confirmation, document hashes

If HACH requires per-form signing (pending decision in decision log), this UX shifts to "Sign each document" — same screen, but the tenant taps "Sign" on each form individually before submission. Default is bulk-sign; switch is a config flag.

### 3.3 Phase 3 — Additional Adults Sign

For each non-HOH adult in the household, the system determines which forms they're a required signer for. Two flows:

**Default — Same-device signing:**
After HOH (Maria) signs, the portal asks: "Your husband and adult son also need to sign some documents. They can sign on this phone now, or we can send them their own links."

If "now on this phone":
- For each additional adult, the portal generates their personal review-and-sign screen
- Each adult sees: short Portuguese/Spanish/English summary ("You are signing as an adult household member of [HOH name]'s PBV application"), the forms they need to sign with [HOH name]'s data pre-filled, and a signature capture
- Each adult types their full name (confirming identity) + draws their signature
- The system captures: typed name, signature image, timestamp, IP, user agent, the fact that signing happened on HOH's device (logged for audit)

**Fallback — Magic-link-per-adult:**
If "send them their own links" or if any adult lives elsewhere, the portal sends an SMS link to each. They sign on their own device. Same review-and-sign UX, but in their own session.

Identity verification standard: pending decision in decision log. Default is typed name + signature + IP + timestamp. If Dan/HACH require more (phone number OTP, photo ID upload), we add it.

---

## 4. Data Model

```sql
-- Tenant profile (existing table, additions)
tenant_profiles (
  -- existing fields...
  preferred_language text not null,  -- 'en' | 'es' | 'pt' — drives UI
  submission_language text not null  -- 'en' | 'es' — drives which source PDFs used as canvas
                                      -- pt tenants get submission_language='es' by policy
)

-- PBV application (top-level container)
pbv_applications (
  id uuid primary key,
  tenant_profile_id uuid references tenant_profiles(id),
  status text default 'intake_in_progress',  -- 'intake_in_progress' | 'intake_complete' | 'signing_in_progress' | 'submitted' | 'hach_reviewing' | 'approved' | 'rejected'
  started_at timestamp default now(),
  submitted_at timestamp,
  preferred_language text not null,
  submission_language text not null,
  intake_data jsonb,                          -- structured tenant answers
  resume_token text unique,                   -- SMS link resume
  resume_token_expires_at timestamp
)

-- Household members (one per person)
pbv_household_members (
  id uuid primary key,
  application_id uuid references pbv_applications(id),
  is_head_of_household boolean default false,
  full_name text not null,
  date_of_birth date,
  ssn_encrypted text,                         -- encrypted at rest
  relationship text,                          -- 'self' | 'spouse' | 'child' | 'other'
  is_adult boolean,                           -- 18+, computed
  is_disabled boolean default false,
  is_student boolean default false,
  citizenship_status text,                    -- 'citizen' | 'eligible_non_citizen' | 'not_declared'
  required_to_sign boolean default false      -- computed from intake
)

-- Generated form documents (one per form per application)
pbv_form_documents (
  id uuid primary key,
  application_id uuid references pbv_applications(id),
  form_id text not null,                      -- e.g. 'briefing-cert', 'hud-9886a', 'obligations-family'
  language text not null,                     -- 'en' | 'es' — what's in the file
  pdf_storage_path text,                      -- supabase storage path
  status text default 'pending_generation',   -- 'pending_generation' | 'generated' | 'signed' | 'finalized'
  generated_at timestamp,
  field_data jsonb,                           -- the exact data stamped onto this form (for audit)
  source_pdf_path text,                       -- which source PDF was used as canvas
  field_map_version text                      -- which field map version was used
)

-- Signature events (one per signer per document)
pbv_signature_events (
  id uuid primary key,
  form_document_id uuid references pbv_form_documents(id),
  signer_member_id uuid references pbv_household_members(id),
  signature_image_path text not null,         -- supabase storage path
  typed_name text not null,                   -- identity confirmation
  signed_at timestamp default now(),
  ip_address text,
  user_agent text,
  device_owner text,                          -- 'self' | 'hoh' — was this signed on the signer's device or the HOH's
  document_hash text not null                 -- SHA-256 of the form being signed at moment of signing
)

-- Summary document (one per application, signed by HOH)
pbv_summary_documents (
  id uuid primary key,
  application_id uuid references pbv_applications(id),
  language text not null,                     -- 'en' | 'es' | 'pt'
  template_version text not null,             -- which version of the summary template
  pdf_storage_path text,
  signed_at timestamp,
  signature_event_id uuid references pbv_signature_events(id)
)
```

Notes:
- SSNs encrypted at rest. Access logged.
- `field_data jsonb` snapshot on each form document captures exactly what was stamped, for audit. Source-of-truth in case the intake data is later edited.
- `document_hash` on each signature event captures what the signer was actually shown — anti-tampering.

---

## 5. Form Generation Pipeline

For each form in a tenant's submission set:

1. **Resolve form_id and language.** Form set is determined by intake answers (e.g., VAWA only if question 8 = yes). Language = `submission_language` from tenant profile.
2. **Load source PDF.** From `docs/templates/{form_id}-{language}.pdf`.
3. **Load field map.** From `scripts/field-maps/{form_id}-{language}.json`.
4. **Prepare field_data.** Map intake data to form field names (e.g., intake `head_of_household.full_name` → field `hoh_printed_name`).
5. **Generate stamped PDF.** Via existing `scripts/stamp-form.mjs` (validated in pilot). Output: unsigned PDF with tenant data, no signatures yet.
6. **Save to Supabase storage.** Path: `pbv/{application_id}/forms/{form_id}-{language}-unsigned.pdf`.
7. **Insert row in `pbv_form_documents`.** Status: `generated`.

At signing time:
- For each signature event on the form, stamp the signature image onto the unsigned PDF at the signature coordinate
- Save signed version: `pbv/{application_id}/forms/{form_id}-{language}-signed.pdf`
- Update `pbv_form_documents.status` to `signed`
- Hash the final PDF, store in `document_hash` on the signature event

For multi-signer forms, accumulate signatures: HOH signs first → stamped → spouse signs → stamped → etc. Each signature event hashes the document state it saw before signing.

---

## 6. Save-and-Resume

The tenant must be able to leave at any point in Phase 1 or Phase 2 and resume exactly where they left off.

**Mechanism:**
- Every PBV application has a `resume_token` — unique, opaque, in URL path: `/pbv/{token}`
- Token sent via SMS at intake start, with text: "Continue your application: {short_url}. You can return any time before {deadline}."
- Token expires at `resume_token_expires_at` (default: application deadline + 30 days)
- Tapping the link loads the portal in the tenant's `preferred_language` and drops them at their last incomplete section (or at the review-and-sign screen if intake is complete)
- Auto-save on every field change means zero data loss

**Re-send token:**
- Tenant or staff can request a token re-send at any time
- Each re-send is logged

**Cross-device:**
- Token works on any device. If the tenant started on phone and finishes on a borrowed laptop, the link still works
- Sessions are bound to token, not to device

---

## 7. Summary Document

A plain-language summary, in the tenant's `preferred_language`, generated and signed by the tenant before they sign the federal forms.

**Purpose:** demonstrates informed consent in the tenant's actual language. Particularly important for Portuguese-speaking tenants who will be signing Spanish-language federal forms.

**Content:**
- Who the tenant is and what they're applying for
- Plain-language explanation of PBV
- List of every document in their submission package, with a one-sentence Portuguese/Spanish/English description of each
- Statement that the federal forms are in Spanish (for Portuguese-speakers) and HACH accepts this as an officially translated federal form
- Statement of preferred language for any future HACH contact
- Signature line

**Authoring:** Stanton (Alex + Dan) writes the master content in English. Dan reviews. Portuguese and Spanish translations commissioned from a professional translator. This is **not in scope for Cascade** — Cascade builds the generation pipeline; the content is human-authored.

**Generation:**
- Source template: `docs/templates/summary-doc-{language}.pdf` (human-authored, with `{{tenant_name}}` style merge fields rendered to specific coordinates)
- Same overlay mechanism as federal forms: source PDF as canvas, tenant data stamped on
- Output: `pbv/{application_id}/summary-{language}-signed.pdf`

**UX:**
- Required reading and signing *before* federal form review
- "Sign all forms" button on Phase 2 only enabled after summary doc is signed
- Tenant must explicitly check a box: "I have read this summary and I understand what I am applying for."

---

## 8. Staff-Assisted Mode

For tenants who come into the office or can't complete the digital flow alone, staff (Will, primarily) supports an assisted mode.

**Mechanism:**
- Staff logs into their own session
- Staff opens the tenant's PBV application by tenant lookup
- Staff sees the same Phase 1 / Phase 2 / Phase 3 UI the tenant would see, but with a banner: "Staff-assisted mode. You are filling on behalf of [tenant name]."
- Staff fills the intake answers as the tenant dictates
- At signature time, staff hands the device (iPad, kiosk, phone) to the tenant for the signature
- Audit trail captures: filled-by = staff user ID, signed-by = tenant signature, mode = `staff_assisted`

**Critical rule:** the signature must always be the tenant's. Staff never signs on the tenant's behalf, ever. This is the integrity boundary.

---

## 9. HACH Reviewer-Facing Display

When a PBV application reaches the HACH reviewer portal (built separately, exists), the reviewer sees:

- A clear language flag at the top: "Primary language: Portuguese. Spanish-speaking staff recommended for follow-up." (or whatever matches the tenant's `preferred_language`)
- The summary document, first in the document list
- All federal forms in the language they were submitted in (Spanish for PT-speakers, Spanish for ES-speakers, English for EN-speakers)
- Audit trail visible on request: who signed what, when, from where

This is a small UI addition to the existing reviewer portal. Spec: one banner element, one section in the document list.

---

## 10. Implementation Phases

**Phase A — Toolchain (1–2 hours).**
- Install pymupdf into Python environment
- Add visual-verification script: `scripts/render-stamped.mjs` that renders any stamped PDF to PNG for visual inspection
- Update pilot's NOTES.md to reflect this addition

**Phase B — Remaining field maps (~28 forms, est. 1–2 weeks).**
- Use the pdfminer playbook from the pilot
- One field map per form per language (en + es source PDFs)
- Cascade autonomous per form, Alex spot-checks
- Output: `scripts/field-maps/{form_id}-{language}.json` × 28

**Phase C — Data model and API (3–5 days).**
- Migrations for all tables in §4
- API routes for: start application, save section data, resume, generate forms, sign, submit
- No UI yet

**Phase D — Phase 1 intake UI (1 week).**
- Sectioned intake per §3.1
- Auto-save, progress indicator, conditional sections
- Three languages

**Phase E — Phase 2 review-and-sign UI (1 week).**
- Stack-of-forms display
- Summary document signing
- Bulk-sign ceremony (per-form flag as fallback)
- Signature capture and stamping

**Phase F — Phase 3 additional adults UI (3–5 days).**
- Same-device flow
- Magic-link-per-adult fallback
- Identity capture

**Phase G — Summary document content (2 weeks, parallel, Alex+Dan).**
- Write master English content
- Dan review
- Commission PT and ES translations
- Build into templates

**Phase H — End-to-end test (2–3 days).**
- Synthetic Maria-Garcia-Rodriguez through full flow
- HACH-side verify with sample reviewer
- Fix anything that breaks

**Phase I — Staff-assisted mode polish (2–3 days).**
- Will trains on staff workflow
- Edge cases catalogued and addressed

Total estimate: ~4 weeks engineering, with summary document content as the long pole.

---

## 11. Out of Scope (Explicit)

- PBV pre-application (Stage 3 in North Star) — already built
- HACH reviewer portal — exists, only the language-flag addition is in scope here
- Stage 6 post-approval signing packet — separate PRD (`docs/04-post-approval-execution_prd_2026-05-13.md`)
- HAP contract execution — Stage 7, downstream
- AppFolio integration — separate concern
- Real signature drawn-via-stylus vs typed-name-as-signature — using react-signature-canvas finger-drawing, no stylus requirement
- Identity verification beyond typed-name+IP — pending decision

---

## 12. Open Questions

Captured in `dan-hach-decision-log_2026-05-14.md`. Blocking-vs-non-blocking marked there. Summary of items relevant to this PRD:

- HACH formal acceptance of stamped-PDF output [blocking before production]
- HACH stance on Portuguese-UI / Spanish-submission [blocking before production]
- Bulk-sign vs per-form-sign requirement [blocking before sign UX build]
- Identity verification standard for non-HOH signers [non-blocking, has default]
- Whether summary doc needs HACH review [non-blocking]

---

## 13. File Manifest (Expected)

```
docs/
  05-pbv-form-execution_prd_2026-05-14.md           # This file
  templates/
    summary-doc-en.pdf                              # NEW, human-authored
    summary-doc-es.pdf                              # NEW, human-authored, translated
    summary-doc-pt.pdf                              # NEW, human-authored, translated
    {form_id}-en.pdf                                # 14 source forms × en
    {form_id}-es.pdf                                # 14 source forms × es

scripts/
  field-maps/
    {form_id}-{language}.json                       # 28 field maps
    {form_id}-{language}.NOTES.md                   # methodology notes per form
  stamp-form.mjs                                    # existing, validated
  render-stamped.mjs                                # NEW, pymupdf-based visual verify

app/
  pbv/
    [token]/
      page.tsx                                      # resume token entry
      intake/
        [section]/page.tsx                          # Phase 1 sections
      review/page.tsx                               # Phase 2 review-and-sign
      additional-signers/page.tsx                   # Phase 3
  admin/
    pbv/
      [application_id]/page.tsx                     # staff view, staff-assisted mode
  api/
    pbv/
      start/route.ts
      [application_id]/
        section/route.ts
        resume/route.ts
        generate-forms/route.ts
        sign/route.ts
        submit/route.ts

supabase/migrations/
  YYYYMMDD_pbv_applications.sql
  YYYYMMDD_pbv_household_members.sql
  YYYYMMDD_pbv_form_documents.sql
  YYYYMMDD_pbv_signature_events.sql
  YYYYMMDD_pbv_summary_documents.sql
```

---

## 14. Acceptance Criteria

The system is production-ready when:

1. A synthetic Maria-Garcia-Rodriguez household (HOH + spouse + adult son, Portuguese preferred, Spanish submission) can be walked through the full flow in under 60 minutes
2. The generated submission package contains all required federal forms with tenant data correctly stamped, all signatures applied to correct forms, and a signed Portuguese summary document
3. A HACH-side reviewer (Tess or external test reviewer) confirms the package is acceptable for processing
4. Dan has signed off on the three blocking decisions in the decision log
5. The summary document content is finalized in all three languages
6. End-to-end test covers: tenant abandonment and resume, intake editing, staff-assisted mode, magic-link-per-adult flow, conditional form generation (VAWA + Reasonable Accommodation triggered correctly)
