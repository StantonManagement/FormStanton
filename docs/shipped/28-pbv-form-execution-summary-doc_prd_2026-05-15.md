# PRD-28 — PBV Form Execution: Summary Doc Generation Pipeline

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md` §7, `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md`
**Depends on:** PRD-24 (`pbv_summary_documents` table, `sign-summary` endpoint) complete

---

## Problem Statement

Before HOH signs any federal form, they sign a plain-language summary doc in their preferred language (en, es, or pt) that explains what they're applying for, lists the package contents, names the language-of-record (Spanish for PT-speakers), and provides defensive evidence of informed consent.

The content is human-authored work in the long run (Alex + Dan, with professional translation). This PRD lands the **pipeline** with **best-effort first-draft content**, marked tentative, refined later.

## Evidence baseline

- `pbv_summary_documents` table exists (PRD-24 §5).
- `lib/pbv/form-generation/stamper.ts` exists (PRD-24 §9 port of stamp-form.mjs).
- `sign-summary` API endpoint exists (PRD-24 §7).
- PRD-26's UI flow renders the summary, awaits sign, transitions to federal forms.
- No source PDF for the summary doc exists yet — must be authored as part of this PRD.

## Key decisions

### 1. Generate the summary as a programmatic PDF, not a template

Rather than author a fixed source PDF and stamp variable fields onto it (the federal-form pattern), generate the summary directly with pdf-lib from a structured content tree. Why:

- Content is dynamic per application (list of forms in this household's package, list of upload categories required).
- Language and content both vary — three languages × dynamic content = a lot of fixed-template variants.
- The summary is *Stanton-authored*, not HACH-authored — no fidelity-to-source-PDF requirement.

Module: `lib/pbv/summary-doc/generate-summary.ts`. Input: application + members + language + form-set + upload-set. Output: PDF Buffer.

### 2. Content structure (the rendered PDF)

```
[Stanton Management letterhead]

PBV Application Summary
For: {HOH name}, {address}

What you are applying for:
{plain-language paragraph in tenant's preferred language}

What's in your application package:
- {form 1 title in tenant's language, with one-line description}
- {form 2 ...}
- ... (one bullet per federal form being submitted)

What documents you'll need to upload:
- {upload 1 category, plain-language}
- {upload 2 ...}

Language note:
The federal forms in your application are in {submission_language}. This is the language HACH uses for these federal forms. If your preferred language is Portuguese, you are reading this summary in Portuguese to demonstrate that you understood what you are signing, even though the federal forms themselves are in Spanish.

How HACH will contact you:
Your preferred language for any future contact is {preferred_language}. We have flagged this for HACH's reviewer.

Your acknowledgement:
By signing below, you confirm that you have read this summary, you understand what you are applying for, and you intend to be bound by your signatures on the federal forms in this package.

{Signature line: Head of Household}
{Date: auto-filled}
```

All sections in the tenant's `preferred_language`. The form list and upload list use the inventory's plain-language descriptions (PRD-25 introduced these for the intake UI; reuse).

### 3. Three languages — best-effort drafts

Author all three (en, es, pt) inline in `lib/pbv/summary-doc/content.ts` as a typed object:

```ts
export const SUMMARY_CONTENT: Record<Language, SummaryContent> = {
  en: { ... },
  es: { ... },  // CONTENT: tentative — review with Dan + translator
  pt: { ... },  // CONTENT: tentative — review with Dan + translator
};
```

EN draft by Cascade, ES/PT marked tentative for review. Strings flagged with `// CONTENT: tentative — review` so they're searchable when Dan + translator review.

### 4. Storage + audit

- Generated summary PDF saved to Supabase Storage: `pbv/{application_id}/summary-{language}-unsigned.pdf`
- After signing: `pbv/{application_id}/summary-{language}-signed.pdf`
- Row in `pbv_summary_documents` with `template_version` set to the content version (start at `'1.0.0'`)

### 5. Template versioning

`pbv_summary_documents.template_version` records which version of the content the tenant signed. When Dan reviews and we update content, bump to `'1.1.0'`. The audit trail then proves what content the tenant actually saw.

### 6. Plain-language form/upload descriptions

The inventory has per-form notes but not necessarily one-line plain-language descriptions. Build a lookup table in `lib/pbv/summary-doc/descriptions.ts`:

```ts
export const FORM_DESCRIPTIONS_EN: Record<FormId, string> = {
  'briefing_docs_certification': 'Certification that you received and read 8 federal documents about your rights and responsibilities.',
  'hud_9886a': 'Authorization for HUD to verify income information from third parties.',
  // ...
};
// Same structure for ES, PT.
```

Cascade drafts EN by reading inventory headers + form names. ES/PT machine-aided drafts, marked tentative.

### 7. Generation timing

The summary doc is generated at the same time as the federal forms — within `POST /api/t/[token]/pbv-full-app/generate-forms` (PRD-24 wires this). Idempotent: re-generating produces the same PDF byte-for-byte if inputs are unchanged.

### 8. Signing reuses PRD-26

PRD-26 already handles summary-doc signing UX. This PRD only delivers the generated PDF that PRD-26 displays.

## Scope

### What this PRD does

- `lib/pbv/summary-doc/generate-summary.ts` — pdf-lib generator
- `lib/pbv/summary-doc/content.ts` — text content in EN/ES/PT (EN best-effort first draft; ES/PT marked tentative)
- `lib/pbv/summary-doc/descriptions.ts` — per-form and per-upload-category descriptions in 3 languages
- Wires summary generation into PRD-24's `generate-forms` flow
- Persistence of generated PDF to storage and `pbv_summary_documents` row

### What this PRD does NOT do

- Does not commission professional translations — Alex + translator post-launch
- Does not modify PRD-26's signing UX
- Does not modify the schema
- Does not introduce new dependencies beyond pdf-lib (already present)
- Does not implement HACH-facing display of the summary (separate, in HACH portal)

## Affected files

### New library
- `lib/pbv/summary-doc/generate-summary.ts`
- `lib/pbv/summary-doc/content.ts`
- `lib/pbv/summary-doc/descriptions.ts`

### Modified
- `lib/pbv/form-generation/` — if the generate-forms route in PRD-24 didn't include summary doc generation, wire it in here
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (if modification needed)

### Tests
- `lib/pbv/summary-doc/__tests__/generate-summary.test.ts` — generates summary for Maria in PT, asserts byte-stable output, asserts text strings render correctly
- `lib/pbv/summary-doc/__tests__/content.test.ts` — confirms all three languages have all keys defined

## Phases

### Phase 1 — Content + descriptions

- Author EN content for the summary
- Author EN descriptions for all 13 sourced + 4 source-pending forms + all upload categories from inventory
- Machine-translate ES and PT, mark tentative
- Commit: `feat(pbv-summary): EN+ES+PT content scaffolds (tentative ES/PT)`

### Phase 2 — Generator

- pdf-lib generator that lays out the summary content in a single-page PDF
- Letterhead styled (use existing Stanton brand colors / typography if any in repo; fall back to clean default)
- Unit test: generates valid PDF, contains expected text strings
- Commit: `feat(pbv-summary): pdf-lib summary doc generator`

### Phase 3 — Wire into generate-forms

- Extend (or create) the summary generation step in the generate-forms server flow
- Save to storage, insert `pbv_summary_documents` row
- Re-generation idempotency
- Commit: `feat(pbv-summary): wire into form generation pipeline`

### Phase 4 — Verification

- Generate summary for Maria PT, render via PRD-22 toolchain to PNG, visually inspect
- Verify text wraps correctly on mobile preview width
- Confirm PRD-26's signing flow displays and signs successfully end-to-end
- Commit: `test(pbv-summary): generator coverage`

### Phase 5 — Build report

`docs/build-reports/28-pbv-form-execution-summary-doc-build-report_2026-05-15.md`.

## Out of scope

- Professional translation
- HACH-facing summary display in the reviewer portal
- Schema changes
- Bulk re-generation of summaries after a content update (template_version captures what was signed; updates apply going forward)

## Acceptance criteria

- Summary doc generates in EN/ES/PT for Maria's household and renders as a clean one-page PDF
- All `// CONTENT: tentative` markers grep-searchable
- `pbv_summary_documents` row created with correct language + template_version
- PRD-26's summary review-and-sign UI displays the generated PDF and the tenant can sign it
- Re-generation is idempotent
- Tests pass; `npm run build` clean

## Open questions

- Whether to use a hand-authored PDF template (more design control) or programmatic pdf-lib generation. Default: programmatic for v1.0.0; revisit if design fidelity matters more once Dan reviews.
- Whether to include the HOH's children's names in the summary or only the HOH. Default: only HOH name in the salutation; household member roster is implicit.
- Whether the summary should reference the HACH application ID / reference number. Default: yes if available; omit if not yet assigned.
