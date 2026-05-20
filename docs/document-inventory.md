# Document Inventory — PBV Full Application

_Last updated: 2026-05-14_

> Source of truth for what the tenant has to produce, what handling each item gets in the app today, and what it should get. Use this to drive the "deeply flawed but so close" rework.

**Single source in code:** `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql` seeds `form_document_templates` for `form_id = 'pbv-full-application'`. 33 template rows.

## Two kinds of items, often conflated

| Kind | Definition | Tenant action | Examples |
|---|---|---|---|
| **Evidence upload** | An existing external document the tenant already has. Tenant uploads a photo or PDF. | Upload file. | Paystubs, bank statement, I-551 card, doctor bill |
| **Fill-in form** | A blank HACH/HUD form the tenant fills out and signs. Tenant should not have to acquire a paper copy. | Read → fill fields → sign in-app → submit. | HUD-9886-A, Obligations of Family, Citizenship Declaration |

**Current app reality:** every item — both kinds — is rendered as upload-only by `components/pbv/TenantDocumentUpload.tsx`. The 14 fill-in forms are treated identically to the 18 evidence uploads. Status states are `missing | submitted | approved | rejected | waived`. There is no fill-in UI surface. This is the core flaw.

**What partially exists** (the "so close" part):
- `form_document_templates.requires_signature` and `signer_scope` columns.
- `signature_capture_audit` table (migration `20260513180000_in_app_signature_capture.sql`) — full e-sign legal substrate (consent, identity verification, document hashes, IP, immutable).
- `components/signing/SignatureCanvas.tsx`, `UploadSignedDialog.tsx`.
- No wiring from the tenant flow to render any of the 14 forms in-app. [Inference based on grep of TenantDocumentUpload.tsx — full trace not performed]

## Full inventory

Legend: **Handling today** column = `upload-only` for every row. **Target handling** = what it should be.

### Income (10 rows · evidence)

| # | doc_type | Label | Required | Scope | Condition | Today | Target |
|---|---|---|---|---|---|---|---|
| 10 | `paystubs` | Paystubs (4 weekly or 2 bi-weekly per employed person) | ✓ | per employed member | `employed = true` | upload-only | upload-only ✓ |
| 20 | `pension_letter` | Pension or Railroad Retirement Award Letter | ✓ | per member | `has_pension = true` | upload-only | upload-only ✓ |
| 30 | `ssi_award_letter` | SSI Award Letter | ✓ | per member | `has_ssi = true` | upload-only | upload-only ✓ |
| 40 | `ss_award_letter` | Social Security Award Letter | ✓ | per member | `has_ss = true` | upload-only | upload-only ✓ |
| 50 | `child_support_docs` | Child Support Order or Payment History (12 mo) | ✓ | per member | `has_child_support = true` | upload-only | upload-only ✓ |
| 60 | `tanf_letter` | TANF, Food Stamps, or Public Assistance Award Letter | ✓ | per member | `has_tanf = true` | upload-only | upload-only ✓ |
| 70 | `unemployment_letter` | Unemployment or Workers Compensation Award Letter | ✓ | per member | `has_unemployment = true` | upload-only | upload-only ✓ |
| 80 | `self_employment_docs` | Self-Employment Contract and Earnings Statement | ✓ | per member | `has_self_employment = true` | upload-only | upload-only ✓ |
| 90 | `training_letter` | Training Program / Grant Documentation | — | per member | `has_other_income = true` | upload-only | upload-only ✓ |
| 100 | `digital_payment_statements` | Cash App / Zelle / Venmo / PayPal — 2 mo statements | — | per member | `has_other_income = true` | upload-only | upload-only ✓ |

### Assets (5 rows · evidence)

| # | doc_type | Label | Required | Scope | Condition | Today | Target |
|---|---|---|---|---|---|---|---|
| 110 | `bank_statement_savings` | Savings Account Statement (most recent month) | ✓ | each adult | — | upload-only | upload-only ✓ |
| 120 | `bank_statement_checking` | Checking Account Statement (most recent month) | ✓ | each adult | — | upload-only | upload-only ✓ |
| 130 | `insurance_settlement` | Insurance Settlement Letter | — | submission | `has_insurance_settlement = true` | upload-only | upload-only ✓ |
| 140 | `cd_trust_bond` | CD, Trust, or Bond Statements | — | submission | `has_cd_trust_bond = true` | upload-only | upload-only ✓ |
| 150 | `life_insurance_policy` | Life Insurance Policy w/ Cash Value | — | submission | `has_life_insurance = true` | upload-only | upload-only ✓ |

### Medical / Childcare (3 rows · evidence)

| # | doc_type | Label | Required | Scope | Condition | Today | Target |
|---|---|---|---|---|---|---|---|
| 200 | `medical_bills` | Doctor Bills (12 mo) | — | submission | `claiming_medical_deduction = true` | upload-only | upload-only ✓ |
| 210 | `pharmacy_statements` | Pharmacy Statements (12 mo) | — | submission | `claiming_medical_deduction = true` | upload-only | upload-only ✓ |
| 220 | `care4kids_certificate` | Care 4 Kids / Childcare Documentation | — | submission | `has_childcare_expense = true` | upload-only | upload-only ✓ |

### Immigration (2 rows · evidence)

| # | doc_type | Label | Required | Scope | Condition | Today | Target |
|---|---|---|---|---|---|---|---|
| 300 | `immigration_docs` | Immigration Documents (I-551, I-94, I-688, I-688B) | ✓ | per member | `citizenship_status = eligible_non_citizen` | upload-only | upload-only ✓ |
| 310 | `proof_of_age_noncitizen` | Proof of Age — Non-Citizen 62+ | — | per member | non-citizen + age ≥ 62 | upload-only | upload-only ✓ |

### Signed Forms (14 rows · **fill-in, not evidence**) — the gap

Every row in this section is mis-handled today as upload-only. Target = render the form, capture fields + signature in-app, generate signed PDF, write to `signature_capture_audit`.

**Source PDF** column refers to pages in `uploads/Full Application Package (5-28-2025 bilingual).pdf` (EN/ES alternating). PT not present in this package.

| # | doc_type | Label | Required | Scope | Condition | Source PDF (EN / ES) | Today | Target |
|---|---|---|---|---|---|---|---|---|
| 400 | `main_application` | Main Application and Attestation | ✓ | each adult | — | 1,3,5,7,9 / 2,4,6,8,10 | upload-only | **fill + sign in-app** |
| 410 | `criminal_background_release` | Criminal Background Release Authorization | ✓ | each adult | — | 39 / 40 | upload-only | **fill + sign in-app** |
| 420 | `child_support_affidavit` | Child Support Affidavit (paid or received) | ✓ | each adult | `has_child_support = true` | 17 / 18 | upload-only | **fill + sign in-app** |
| 425 | `no_child_support_affidavit` | No Child Support Affidavit | ✓ | each adult | `any_member_has_child_support = false` | 17 / 18 _(same page, alt. text)_ | upload-only | **fill + sign in-app** |
| 430 | `hud_9886a` | HUD-9886-A Authorization for Release of Information | ✓ | each adult | — | 11,13 / 12,14 | upload-only | **fill + sign in-app** |
| 440 | `hach_release` | HACH Authorization for Release of Information | ✓ | each adult | — | 15 / 16 | upload-only | **fill + sign in-app** |
| 450 | `obligations_of_family` | Obligations of Family | ✓ | each adult | — | 23 / 24 | upload-only | **acknowledge + sign in-app** |
| 460 | `briefing_docs_certification` | Family Certification of Briefing Documents Received | ✓ | each adult | — | 37 / 38 | upload-only | **acknowledge + sign in-app** |
| 470 | `debts_owed_phas` | Debts Owed to PHAs (HUD-52675) | ✓ | each adult | — | 29,31 / 30,32 | upload-only | **acknowledge + sign in-app** |
| 480 | `citizenship_declaration` | Citizenship Declaration | ✓ | each adult | — | 19,21 / 20,22 _(decl. + immigration instructions)_ | upload-only | **fill + sign in-app** |
| 490 | `eiv_guide_receipt` | EIV Guide Receipt | ✓ | each adult | — | 25,27 / 26,28 | upload-only | **acknowledge + sign in-app** |
| 500 | `hud_92006` | HUD-92006 Supplemental Contact Form | ✓ | each adult | — | 33,35 / 34,36 | upload-only | **fill + sign in-app** |
| 510 | `vawa_certification` | VAWA Certification (HUD-5382) | — | each adult | `dv_status = true` | _not in package_ | upload-only | **fill + sign in-app** |
| 520 | `reasonable_accommodation_request` | Reasonable Accommodation Request | — | each adult | `reasonable_accommodation_requested = true` | _not in package_ | upload-only | **fill + sign in-app** |

**Sub-types of "fill-in form":**

- **Fill + sign** (8 rows) — has data fields the tenant must complete (name, addresses, amounts, household members, attestations). Examples: `main_application`, `child_support_affidavit`, `hud_92006`, `citizenship_declaration`.
- **Acknowledge + sign** (4 rows) — body is informational/legal text the tenant must read and sign to acknowledge. No fields beyond identity. Examples: `obligations_of_family`, `briefing_docs_certification`, `debts_owed_phas`, `eiv_guide_receipt`.
- **Hybrid** (2 rows) — `hud_9886a` (consent + signature, minor fields), `criminal_background_release` (name + address + signature).

This distinction matters for the rework: acknowledge-only forms can ship as "show PDF → consent + signature" with no form-building work. Fill+sign forms need a field-by-field UI.

## Language coverage

- **Inventory has labels in:** EN, ES, PT.
- **Source PDFs available:** EN + ES only (in the package linked above).
- **PT gap:** No bilingual PT forms in the repo or uploads as of this writing. [Inference — not confirmed by exhaustive search.]

Decision needed: do we (a) source PT PDFs from HACH / HUD, (b) accept PT UI labels but keep submitted forms in EN, or (c) defer PT until later.

## What "so close" means concretely

To turn the 14-form gap into shipped work, the missing layer is roughly:

1. **A renderer per form** that can be either a PDF overlay (for HUD-numbered forms that must match the federal template) or a native React form that generates a PDF on submit (for HACH-internal forms where layout flexibility is allowed).
2. **A field-to-form_data mapping** so name, DOB, addresses, household members already collected in the application don't have to be re-entered on every form.
3. **A signature step** wired to the existing `signature_capture_audit` substrate. The plumbing is built; the tenant-flow integration is missing.
4. **A status state beyond `missing | submitted`** to represent "ready to sign" vs "signed in-app" vs "uploaded externally." Today everything collapses to `submitted`.

Whether this is incremental polish or a deeper rework depends on (1) — if HACH requires the federal PDFs to match HUD layouts exactly, PDF overlay is the only path and that's substantial work per form. If they accept a HACH-generated PDF that captures the same data, the native-React path is much faster.

## Next steps

- [ ] Split `uploads/Full Application Package (5-28-2025 bilingual).pdf` into 12 per-form, per-language PDFs. Target: `public/forms/pbv/<doc_type>_<lang>.pdf` or similar. _Path TBD._
- [ ] Acquire source PDFs for `vawa_certification` and `reasonable_accommodation_request`.
- [ ] Decision on PT (above).
- [ ] Decision on PDF-overlay vs native-form generation per form.
- [ ] Write PRD for the fill-in form rework.

## Pointers

- Inventory source: `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`
- Tenant upload UI (current upload-only path): `components/pbv/TenantDocumentUpload.tsx`
- Signature substrate: `supabase/migrations/20260513180000_in_app_signature_capture.sql`, `components/signing/SignatureCanvas.tsx`
- Categorization order: `lib/pbv/categories.ts` _(or duplicated in `StantonReviewSurface.tsx:390` / `TenantDocumentUpload.tsx:142` — see CURRENT_STATE open items)_
- Bilingual PDF: `uploads/Full Application Package (5-28-2025 bilingual).pdf` (40 pages, EN/ES alternating)
