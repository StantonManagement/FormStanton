# Cursor/Windsurf Prompt — PRD-28: Summary Doc Generation Pipeline

## Context

Before the HOH signs federal forms, they sign a plain-language summary doc in their preferred language (en, es, pt). This PRD builds the pipeline (pdf-lib generator + content + integration with PRD-24's generate-forms flow). Content is best-effort first draft; Alex + Dan + professional translator will refine later.

## Required reading

1. `docs/fullApp-Plan/28-pbv-form-execution-summary-doc_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` — UX that consumes this output
3. `docs/fullApp-Plan/pbv-field-inventory.md` — form names + plain-language hints
4. `lib/pbv/form-generation/stamper.ts` (PRD-24) — pdf-lib patterns
5. `lib/pbvFullAppTranslations.ts` — translation conventions

## Closed decisions (do not relitigate)

- Programmatic pdf-lib generation, not a hand-authored source template
- Best-effort content in 3 languages, tentative markers on ES/PT
- Generated inside the existing `generate-forms` flow (PRD-24)
- One-page PDF
- Idempotent generation
- `template_version` versioned starting at `1.0.0`

## Decisions still open

- **Letterhead approach.** Default: text-based clean header in Stanton brand color. If a logo asset exists in `public/`, include it.
- **Whether to itemize uploads in the summary or just say "supporting documents listed separately."** Default: itemize if list ≤8; collapse to "supporting documents (see your portal for the full list)" if >8.

## Build this pass

### Commit 1 — Content scaffolds

- `lib/pbv/summary-doc/content.ts` — EN text content per PRD §2; ES/PT draft + `// CONTENT: tentative` markers
- `lib/pbv/summary-doc/descriptions.ts` — per-form + per-upload-category plain-language descriptions in 3 langs
- Commit: `feat(pbv-summary): EN+ES+PT content scaffolds (tentative ES/PT)`

### Commit 2 — Generator

- `lib/pbv/summary-doc/generate-summary.ts`:
  - Input: `{ application, members, language, formSet, uploadSet }`
  - Output: PDF Buffer
  - Layout: letterhead, sections per PRD §2 content tree
  - Unit test: generates valid PDF for Maria PT, asserts key text strings present
- Commit: `feat(pbv-summary): pdf-lib summary doc generator`

### Commit 3 — Wire into generate-forms

- Extend `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (or its underlying server module) to also generate the summary
- Save unsigned summary to Supabase Storage at `pbv/{application_id}/summary-{language}-unsigned.pdf`
- Insert/update `pbv_summary_documents` row with `template_version`
- Idempotency: re-running produces same path + same content (byte-stable)
- Commit: `feat(pbv-summary): wire into form generation pipeline`

### Commit 4 — Verification

- Run generate-forms for Maria PT manually; render output to PNG via PRD-22 toolchain; visually inspect
- Confirm PRD-26 summary review-and-sign displays and signs successfully
- Mobile viewport check
- Commit: `test(pbv-summary): generator coverage`

## Verification

- All three language outputs render as one-page PDFs
- Idempotency verified (rerun produces byte-identical PDF for same inputs)
- PRD-26 UI displays the generated PDF and sign flow completes
- Tests pass
- Clean build

## Anti-patterns — do NOT

- Do not commission translations from a paid service in this pass
- Do not modify PRD-26 UI flow
- Do not modify the schema
- Do not skip the tentative markers on ES/PT
- Do not introduce new dependencies
- Do not generate the summary outside the generate-forms flow

## Build report

`docs/build-reports/28-pbv-form-execution-summary-doc-build-report_2026-05-15.md`:

1. Content shipped (counts + tentative-marker counts per language)
2. Generator approach (any layout decisions)
3. Idempotency verification
4. PRD-26 integration verified
5. Open questions for Alex + Dan
6. Recommended translation handoff process for ES/PT

## When you're done

- 4 commits
- Build report
- Clean build
- Surface to Alex; wait for sign-off before PRD-29
