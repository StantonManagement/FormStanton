# PBV Application Layer — Phase 1 Reconnaissance Audit

**Date:** April 23, 2026  
**Phase:** 1 — Reconnaissance (no code written)  
**Deliverable:** This file

---

## 1. Pre-App Code — Reusable Pieces

### 1.1 Main Form Component

**File:** `components/portal/PbvPreappForm.tsx` (622 lines)

**Reusable patterns (file:line):**

- **`PageState` discriminated union** — `loading | error | form | already_submitted | confirmed` (lines 46–51). Full-app form uses the same pattern with additional states for draft/signature steps.
- **Language resolution** — `const t = pbvFormTranslations[language] ?? pbvFormTranslations['en']` (line 54). Copy exactly.
- **`emptyMember()` factory** — (lines 32–34). Full-app extends `HouseholdMember` but can keep the same factory shape.
- **HoH → member[0] sync useEffect** — (lines 101–110). Prevents name drift between HoH fields and the repeating group's first row.
- **`updateMember()` / `addMember()` / `removeMember()`** — (lines 117–131). Copy into full-app form with no changes needed.
- **`toggleIncomeSource()` with none-mutual-exclusion** — (lines 133–150). Pre-app and full-app both need this. Copy directly.
- **`validate()` pattern** — builds `errs: Record<string, string>`, sets via `setErrors`, returns boolean (lines 152–182). Full-app validation is much larger but same structure.
- **`handleSubmit()` skeleton** — fetch POST with loading/error state, transitions pageState on success (lines 184–217). Copy structure.
- **`handleSignatureEnd()` / `clearSignature()`** — (lines 219–229). Exact reuse in multi-signer flow.
- **Section layout markup** — `<section>` with `<h3 className="font-serif text-base text-[var(--primary)] mb-4 pb-2 border-b border-[var(--divider)]">` (lines 265–268, 316–318, 352–354, 415–417). All sections in full-app use this pattern.
- **Error display** — `{errors['key'] && <p className="text-xs text-[var(--error)] mt-1">{errors['key']}</p>}` (lines 281, 295, etc.). Copy exactly.
- **Currency input pattern** — dollar prefix via `absolute left-3` span + `pl-7` input (lines 583–594).
- **`formatCurrency()`** — (lines 114–116).

**`MemberCard` sub-component** (lines 482–621) — Extends into full-app's repeating member group. Full-app version adds: SSN (last-4 display only), disability, student, citizenship_status per member, criminal history checkbox. The card shell (header strip + body grid) and remove button (lines 504–517) reuse directly.

**Cannot reuse without modification:**
- `TaskComponentProps` import (line 7) — full-app form is not driven by a task_completion; it uses a dedicated invitation token
- `form.certChecked` / single signature — full-app has per-adult signature flow; certification checkbox becomes per-signer attestation

---

### 1.2 Trilingual i18n Pattern

**File:** `lib/pbvFormTranslations.ts` (321 lines)

**Pattern:**

```typescript
// 1. Define a typed interface for all strings
export interface PbvFormStrings { ... }  // lines 3–90

// 2. Export a Record keyed by PreferredLanguage
export const pbvFormTranslations: Record<PreferredLanguage, PbvFormStrings> = {
  en: { ... },   // lines 93–167
  es: { ... },   // lines 169–243
  pt: { ... },   // lines 245–319
};

// 3. In component:
const t = pbvFormTranslations[language] ?? pbvFormTranslations['en'];
```

**Function-valued strings** (closures that take runtime args):
- `income_total_display: (amount: string) => string` (line 29)
- `err_member_name: (n: number) => string` (lines 72–73)

**`PreferredLanguage` type:** `'en' | 'es' | 'pt'` — defined in `types/compliance.ts`.

**Full-app translations file:** `lib/pbvFullAppTranslations.ts` — new file following identical structure. Does **not** extend `PbvFormStrings`; it is a separate, larger interface covering all full-app sections (income detail, assets, expenses, criminal history, signature handoff screens).

**Known gap in pre-app:** `cert_checkbox_label` in ES and PT still shows English text (lines 217, 293). Flag for fix before full-app launch but not in scope for Phase 1.

---

### 1.3 Signature Canvas Integration

**Package:** `react-signature-canvas` (already in `package.json` — installed for pre-app)

**Usage pattern** (from `components/portal/PbvPreappForm.tsx`):

```typescript
// Import
import SignatureCanvas from 'react-signature-canvas';

// Ref
const sigCanvasRef = useRef<SignatureCanvas>(null);

// JSX
<SignatureCanvas
  ref={sigCanvasRef}
  canvasProps={{
    className: 'w-full',
    style: { width: '100%', height: '140px', touchAction: 'none' },
  }}
  backgroundColor="white"
  onEnd={handleSignatureEnd}
/>

// Capture (onEnd handler)
const dataUrl = sigCanvasRef.current.toDataURL('image/png');

// Clear
sigCanvasRef.current?.clear();
```

**Full-app multi-signer difference:** Phase 4 renders one `<SignatureCanvas>` per form per adult in sequence. Each canvas gets its own `useRef`. The `toDataURL()` capture and clear pattern is identical. Storage target changes: signature images saved as `storage_path` on `pbv_household_members.signature_image` per member.

**Container markup** (lines 436–453):
```tsx
<div className="border border-[var(--border)] bg-white overflow-hidden">
  <SignatureCanvas ... />
</div>
<button type="button" onClick={clearSignature}
  className="mt-2 text-xs text-[var(--muted)] hover:text-[var(--ink)] transition-colors duration-200 underline">
  {t.clear_signature}
</button>
```

---

### 1.4 Qualification Logic — Pre-App

**Location:** `app/api/t/[token]/pbv-preapp/route.ts` lines 164–186 (magic-link path)  
**Also:** `app/api/forms/pbv-preapp/route.ts` (open-enrollment path, same logic inlined)

**Pre-app qualification is income + citizenship only:**

```typescript
// Threshold lookup (line 164–172)
const { data: thresholdRow } = await supabaseAdmin
  .from('pbv_income_thresholds')
  .select('income_limit')
  .eq('household_size', Math.min(household_size, 8))
  .order('effective_date', { ascending: false })
  .limit(1)
  .maybeSingle();

const citizenship_ok = hoh_is_citizen === true || other_adult_citizen === true;
const income_ok = income_limit === null || total_household_income <= income_limit;

// Maps to: likely_qualifies | over_income | citizenship_issue | over_income_and_citizenship
```

**Full-app qualification is different** — no auto-denial; staff-assisted review. The full-app admin panel shows claimed vs. documented income delta (PRD Phase 6). No qualification logic needed in intake routes; qualification lives in the admin detail view's data panel.

---

### 1.5 Admin Detail Drawer Pattern

**File:** `app/admin/pbv/preapps/page.tsx` (769 lines)

- **Split-pane layout** — table left + drawer right (lines 248–356): `flex-1` table + `w-[480px] xl:w-[520px]` drawer
- **Drawer shell** — header with close button, scrollable body (lines 319–355)
- **`DetailContent` component** — accepts props, handles PDF button and review panel inline (lines 528–751)
- **Row + StatusPill helpers** — (lines 753–769) reusable label/value display and green/red pill
- **`ThresholdsPanel`** — inline editable grid (lines 371–526)

Full-app admin detail view will be a **separate page** (`app/admin/pbv/full-applications/[id]/page.tsx`), not a drawer, because the content volume is too large for a 480px panel. [ASSUMPTION: full-app detail is a full page rather than a drawer — consistent with the PRD "New admin detail page" language in Phase 6. Flagged for Alex to confirm.]

---

## 2. Pre-App Tables and Schema

**Migration:** `supabase/migrations/20260423000000_add_pbv_preapp_tables.sql`

Tables:
- `pbv_income_thresholds` (id, household_size, income_limit, effective_date)
- `unit_bedroom_map` (id, building_address, unit_number, bedroom_count, UNIQUE(building_address, unit_number))
- `pbv_preapplications` — full schema, 19 columns; key ones:
  - `project_unit_id uuid references project_units(id)` — nullable (open-enrollment rows have no project_unit)
  - `task_completion_id uuid references task_completions(id)` — nullable
  - `household_members jsonb NOT NULL` — array of `HouseholdMember` objects
  - `qualification_result text CHECK ('likely_qualifies' | 'over_income' | 'citizenship_issue' | 'over_income_and_citizenship')`
  - `stanton_review_status text DEFAULT 'pending' CHECK (...)`

**Open-enrollment additions** (`20260423100000`):
- `unit_not_in_canonical_list boolean DEFAULT false`
- `submission_source text CHECK ('magic_link' | 'open_enrollment')`

**TypeScript interface:** `PbvPreapplication` at `types/compliance.ts` lines 486–514.  
**Supporting types:** `HouseholdMember` (lines 470–476), `QualificationResult` (lines 478–482), `PbvReviewStatus` (line 484).

---

## 3. Pre-App API Routes

| Route | File | Method(s) |
|---|---|---|
| `/api/t/[token]/pbv-preapp` | `app/api/t/[token]/pbv-preapp/route.ts` | GET (load form), POST (submit) |
| `/api/forms/pbv-preapp` | `app/api/forms/pbv-preapp/route.ts` | POST (open-enrollment submit, rate-limited) |
| `/api/admin/pbv/preapps` | `app/api/admin/pbv/preapps/route.ts` | GET (list with filters) |
| `/api/admin/pbv/preapps/[id]` | `app/api/admin/pbv/preapps/[id]/route.ts` | GET (detail) |
| `/api/admin/pbv/preapps/[id]/review` | `app/api/admin/pbv/preapps/[id]/review/route.ts` | POST (approve/deny/needs_info) |
| `/api/admin/pbv/preapps/[id]/summary-pdf` | `app/api/admin/pbv/preapps/[id]/summary-pdf/route.ts` | POST (stream PDF) |
| `/api/admin/pbv/thresholds` | `app/api/admin/pbv/thresholds/route.ts` | GET, POST |

**Open-enrollment tenant form:** `app/pbv-preapp/page.tsx` — standalone tenant page with building dropdown + unit text input. Registered in forms library as Form 28 at path `/pbv-preapp` (`lib/formsData.ts`).

---

## 4. Foundation API Endpoints (to consume in Phase 3+)

Foundation Phase 2 is complete. These routes exist and are ready to consume:

| Route | File | Purpose for Full App |
|---|---|---|
| `POST /api/forms/[formId]/submissions` | `app/api/forms/[formId]/submissions/route.ts` | Create `form_submissions` row for `pbv-full-application` + seed document slots |
| `GET /api/t/[token]/status` | `app/api/t/[token]/status/route.ts` | Tenant views submission + document list (Phase 5) |
| `POST /api/t/[token]/documents/[documentId]` | `app/api/t/[token]/documents/[documentId]/route.ts` | Tenant uploads file per document (Phase 5) |
| `POST /api/admin/submissions/[submissionId]/documents/[documentId]/review` | (Phase 2 output) | Staff approve/reject/waive per document (Phase 6) |
| `GET /api/admin/submissions/[submissionId]/documents` | (Phase 2 output) | List documents + revision history (Phase 6) |
| `GET /api/admin/submissions/[submissionId]/export` | (Phase 2 output) | ZIP export for HACH handoff (Phase 6) |
| `POST /api/admin/form-submissions/[id]/regenerate-token` | `app/api/admin/form-submissions/[id]/regenerate-token/route.ts` | Regenerate tenant access token (Phase 6 admin UI) |

**Tenant upload pattern** (from `app/api/t/[token]/documents/[documentId]/route.ts` lines 1–156):
- Resolves `tenant_access_token` → `form_submissions` row
- Verifies `documentId` belongs to that submission
- Rejects if status is `approved` or `waived` (409)
- Uploads to `form-submissions/{submission_id}/{doc_type}/{stanton_filename}` in Supabase storage
- Appends row to `form_submission_document_revisions`
- Updates `form_submission_documents` status → `submitted`
- Recomputes parent `form_submissions.status` and `document_review_summary`

Full-app Phase 5 consumes this endpoint directly. The full-app form registers as `form_id = 'pbv-full-application'`; seeding happens via `form_document_templates`.

---

## 5. Foundation Document Template Shape

**Table:** `form_document_templates` (confirmed applied in Phase 2)

```sql
id uuid PK
form_id text NOT NULL           -- 'pbv-full-application'
doc_type text NOT NULL          -- stable slug, e.g. 'paystubs'
label text NOT NULL             -- e.g. 'Paystubs (last 4 weeks)'
label_es text
label_pt text
required boolean DEFAULT true
conditional_on jsonb            -- nullable; shape TBD per conditional rule
display_order integer DEFAULT 0
per_person boolean DEFAULT false
applies_to text DEFAULT 'submission'
                                -- 'submission' | 'each_member' | 'each_adult'
                                -- | 'each_member_matching_rule'
member_filter jsonb             -- evaluated when applies_to = 'each_member_matching_rule'
created_at timestamp
UNIQUE(form_id, doc_type)
```

**Seeding behavior** (from Phase 2 submission creation route): When `POST /api/forms/[formId]/submissions` creates a row with `review_granularity = 'per_document'`, it immediately inserts one `form_submission_documents` row per template row for that `form_id`, expanding per-person rows N times based on `applies_to` + `member_filter`.

**Phase 2 dependency for PBV full app:** The `form_document_templates` seed for `form_id = 'pbv-full-application'` is the Phase 2 deliverable of this PRD. It must be in place before a full-app submission can be created. See document list below.

---

## 6. Document Seed Planning (Phase 2 input)

The following is the PRD document list mapped to `form_document_templates` rows. `[ASSUMPTION]` flags mark where `applies_to` or `conditional_on` logic requires a Phase 2 decision.

**Income verification:**

| doc_type | label | applies_to | member_filter / conditional_on |
|---|---|---|---|
| `paystubs` | Paystubs (last 4 weekly / 2 bi-weekly) | `each_member_matching_rule` | `{ "income_sources": { "contains": "employment" } }` |
| `pension_letter` | Pension / Railroad Retirement Award Letter | `each_member_matching_rule` | `{ "income_sources": { "contains": "pension" } }` |
| `ssi_award_letter` | SSI Award Letter | `each_member_matching_rule` | `{ "income_sources": { "contains": "ssi" } }` |
| `ss_award_letter` | Social Security Award Letter | `each_member_matching_rule` | `{ "income_sources": { "contains": "ss" } }` |
| `child_support_docs` | Child Support Order or Payment History | `each_member_matching_rule` | `{ "income_sources": { "contains": "child_support" } }` |
| `tanf_letter` | TANF / Food Stamps / Unemployment / Workers Comp Letter | `each_member_matching_rule` | `{ "income_sources": { "contains_any": ["tanf","unemployment"] } }` |
| `self_employment_docs` | Self-Employment Contract + Earnings | `each_member_matching_rule` | `{ "income_sources": { "contains": "self_employment" } }` |
| `training_letter` | Training Program Letter / Grant Documentation | `each_member_matching_rule` | `{ "income_sources": { "contains": "other" } }` [ASSUMPTION: 'other' covers training] |
| `digital_payment_statements` | Cash App / Zelle / Venmo / PayPal — 2 months | `each_member_matching_rule` | `{ "income_sources": { "contains": "other" } }` [ASSUMPTION] |

**Banking & assets (per adult):**

| doc_type | label | applies_to |
|---|---|---|
| `bank_statement_savings` | Bank Statement — Savings (last month) | `each_adult` |
| `bank_statement_checking` | Bank Statement — Checking (last month) | `each_adult` |
| `insurance_settlement` | Insurance Settlement Letter | `submission` |
| `cd_trust_bond` | CD / Trust / Bond Statements | `submission` |
| `life_insurance_policy` | Life Insurance Policy (showing value) | `submission` |

**Medical / childcare (conditional):**

| doc_type | label | applies_to | conditional_on |
|---|---|---|---|
| `medical_bills` | Doctor's Bills (last year) | `submission` | `{ "claiming_medical_deduction": true }` |
| `pharmacy_statements` | Pharmacy Statements | `submission` | `{ "claiming_medical_deduction": true }` |
| `care4kids_certificate` | Care 4 Kids Certificate | `submission` | `{ "has_childcare_expense": true }` |

**Citizenship / immigration (conditional, per non-citizen):**

| doc_type | label | applies_to | conditional_on / member_filter |
|---|---|---|---|
| `immigration_docs` | Immigration Documents (I-551 / I-94 / I-688 / I-688B) | `each_member_matching_rule` | `{ "citizenship_status": "eligible_non_citizen" }` |
| `proof_of_age_noncitizen` | Proof of Age (non-citizens 62+) | `each_member_matching_rule` | `{ "citizenship_status": "eligible_non_citizen", "age_gte": 62 }` |

**Signed forms (per adult):**

| doc_type | label | applies_to |
|---|---|---|
| `main_application` | Main Application Attestation | `each_adult` |
| `criminal_background_release` | Criminal Background Release | `each_adult` |
| `child_support_affidavit` | Child Support or No-Child-Support Affidavit | `each_adult` |
| `hud_9886a` | HUD-9886-A (Release of Information) | `each_adult` |
| `hach_release` | HACH Authorization for Release of Information | `each_adult` |
| `obligations_of_family` | Obligations of Family | `each_adult` |
| `briefing_docs_certification` | Family Certification of Briefing Documents Received | `each_adult` |
| `debts_owed_phas` | Debts Owed to PHAs (HUD-52675) | `each_adult` |
| `citizenship_declaration` | Citizenship Declaration | `each_adult` |
| `eiv_guide_receipt` | EIV Guide Receipt | `each_adult` |
| `hud_92006` | HUD-92006 Supplemental Contact | `each_adult` |
| `vawa_certification` | VAWA Certification (HUD-5382) | `each_adult` | [ASSUMPTION: conditional_on DV status — needs schema decision before seed] |
| `reasonable_accommodation_request` | Reasonable Accommodation Request | `each_adult` | [ASSUMPTION: conditional_on reasonable_accommodation_requested flag] |

[ASSUMPTION: `each_adult` resolves at seeding time to `applies_to = 'each_member_matching_rule'` with `member_filter = { "age_gte": 18 }`. The `member_filter` evaluator in `lib/memberFilter.ts` must support `age_gte` computed from `dob`. Need to confirm `lib/memberFilter.ts` supports this before Phase 2 seeds.]

---

## 7. PDF Generation Pattern

**File:** `lib/pbvPreappPdf.ts` (204 lines)

- Package: `pdf-lib` (already installed)
- Helper lib: `lib/pdfTemplates.ts` — exports `drawHeader`, `drawFooter`, `wrapText`, `drawTextBlock`
- Entry point: `generatePbvPreappSummaryPdf(app: PbvPreapplication): Promise<Uint8Array>`
- Pattern: `PDFDocument.create()` → embed fonts → draw sections with cursor tracking (y-coordinate decremented per element) → `pdfDoc.save()`
- Full-app summary PDF (Phase 6) follows same pattern; different data shape

**SSN rule in PDFs:** PRD requires last-4 only in all PDFs. The pre-app PDF does not handle SSNs (pre-app doesn't collect them). Full-app summary PDF must never render `ssn_encrypted` or any full SSN string; only `ssn_last_four` is permitted. This constraint is enforced in the PDF generation function, not in the route.

---

## 8. Gaps and Open Questions Surfaced

These are not blocking Phase 1 but must be resolved before the referenced phase:

| Item | Blocks | Note |
|---|---|---|
| `lib/memberFilter.ts` `age_gte` support | Phase 2 seed | Need to read `memberFilter.ts` to confirm before writing `each_adult` seed rows |
| `conditional_on` shape for VAWA / RA | Phase 2 seed | PRD says conditional on DV status and RA flag — those columns exist on `pbv_full_applications` but `conditional_on` is evaluated against `form_data`, so the intake form must write them into `form_data` in a matching shape |
| `form_id` for full app | Phase 2 | PRD specifies `'pbv-full-application'` — confirm no conflict with existing forms library entries |
| HCA form version | Phase 4 | Open question in PRD — HUD form versions with expired OMB numbers; Alex/HACH to resolve |
| `pbv_reviewer` role definition | Phase 7 | Open question in PRD — who exactly gets SSN read access |
| Tenant invitation flow for full app | Phase 3 | Pre-app has magic-link via `project_units.tenant_link_token`. Full app invitation is separate. PRD says "one magic link per unit" — this needs a token column on `pbv_full_applications` or a separate invitation table. Not pre-decided. Schema Amendment Request may be needed in Phase 2. |
| `form_submissions.summary_pdf_file` path field | Phase 6 | PRD puts `summary_pdf_file` on `pbv_full_applications`, not on `form_submissions`. The generated PDF is stored separately from the document review system. |

---

## 9. Files Not Found / Not Yet Existing

- `tasks/pbv-app-audit.md` — this file (now created)
- `lib/pbvFullAppTranslations.ts` — does not exist; to be created in Phase 3
- `supabase/migrations/20260423200000_pbv_full_application_tables.sql` — does not exist; Phase 2 deliverable
- `app/admin/pbv/full-applications/` — does not exist; Phase 6 deliverable
- `app/pbv-full-app/` — does not exist; Phase 3 deliverable

---

## 10. Assumption Register

| ID | Assumption | Phase Affected |
|---|---|---|
| A-1 | Full-app admin detail is a full page (`/admin/pbv/full-applications/[id]`), not a drawer — consistent with PRD "new admin detail page" | Phase 6 |
| A-2 | Tenant invitation for full app uses a new token column on `pbv_full_applications` (not reusing `project_units.tenant_link_token`) — full app is not a compliance project task | Phase 2 schema |
| A-3 | `each_adult` document rows use `applies_to = 'each_member_matching_rule'` with `member_filter = { "age_gte": 18 }` — requires `memberFilter.ts` to support `age_gte` computed from dob | Phase 2 seed |
| A-4 | `conditional_on` for VAWA and RA forms evaluated against `form_data` — intake form must serialize `dv_status` and `reasonable_accommodation_requested` into `form_data` under matching keys | Phase 3 form + Phase 2 seed |
| A-5 | Training program letter and digital payment statements (Cash App etc.) filed under `income_sources: 'other'` — needs Alex confirmation | Phase 2 seed |

