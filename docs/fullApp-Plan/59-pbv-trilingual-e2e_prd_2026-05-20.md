# PRD-59 — Trilingual EN / ES / PT End-to-End

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization`
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane (the value prop is trilingual; an English-fallback string on a federal-paperwork surface is a tenant who can't safely complete the flow in their own language)
**Depends on:** PRD-55 (form generation), PRD-56 (signing), PRD-57 (intake), PRD-58 (documents) — this PRD verifies all four surfaces in three languages. Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`, PRD-59 entry / gap G7).

---

## Problem Statement

Only the English path has been walked end-to-end (roadmap G7). The flow is *fundamentally* trilingual — a tenant gets the UI in their `preferred_language` (`en` / `es` / `pt`), but the stamped federal forms come out in **Spanish for both `es` and `pt`** tenants (HACH accepts Spanish federal forms), and the **summary doc the tenant signs is in their own language including `pt`**. None of that has been verified across every surface the sibling PRDs (55–58) touch.

The translation plumbing is mostly present and mostly balanced across EN/ES/PT. But it was assembled piecemeal across many independent string tables, and the earlier translation pass left at least one tenant-facing surface holding **literal English placeholders prefixed `TODO:`** that will render to ES/PT tenants. This is a verify-and-fix pass: inventory every string surface for EN/ES/PT coverage, fill the gaps that are mechanical, confirm the language-routing logic matches spec, confirm the ES assets resolve, and log the summary/consent *content* (authored by Alex + Dan + a translator, not Windsurf) as a standing dependency.

This PRD runs **late** (after 55–58) because it verifies their surfaces in three languages; running it earlier would re-verify surfaces that are still changing.

---

## Findings (confirmed in code 2026-05-20)

### Translation coverage — mostly balanced, one real gap

| Surface | Where | EN/ES/PT status |
|---|---|---|
| Dashboard string table | `lib/pbvFullAppTranslations.ts` (consumed only by `app/pbv-full-app/[token]/page.tsx`) | **Full EN/ES/PT.** Every `PbvFullAppStrings` key present in all three blocks. |
| Intake section components | `components/pbv/intake/Section*.tsx`, `AdultWizard.tsx`, `IntakeShell.tsx` | Balanced `Record<PreferredLanguage>` copy objects — en/es/pt key counts match per file. |
| Intake section titles | `app/pbv-full-app/[token]/intake/[section]/page.tsx` (`SECTION_TITLES`) | Full EN/ES/PT inline. |
| Signing components | `components/pbv/sign/*.tsx` | Balanced en/es/pt; legal strings delegate to `lib/pbv/consent-text.ts`. |
| Consent text | `lib/pbv/consent-text.ts` (`SUMMARY_CONSENT`, `FORM_CONSENT_TEMPLATE`) | EN/ES/PT present; ES/PT marked `// CONSENT: tentative` (content dependency, below). |
| Document **card** content | `lib/pbv/cards/docContent.ts` | **Actually translated** (0 placeholder strings) despite a stale `TODO: Complete es and pt` header comment — verify, then update/remove the comment. |
| Document **help** content | `lib/pbv/docTypeHelp.ts` → `DOC_TYPE_HELP`, consumed by `components/pbv/TenantDocumentUpload.tsx` | **GAP — 68 placeholder strings.** The `es` and `pt` values for ~34 doc types are literal English text prefixed `"TODO: …"`. These render to ES/PT tenants on the document-upload help surface. |

[Inference] `docTypeHelp.ts` is the principal "English-fallback string" the earlier translation agent flagged. `docContent.ts`'s header comment is stale (the body is translated) — confirm and correct so the grep-able TODO is meaningful.

### Language routing — present; confirm against spec

Spec (`form-execution-plan_2026-05-14.md`, "Maria's Journey"): UI follows `preferred_language` (incl. `pt`); **form OUTPUT** is `es` for `es`/`pt`, `en` for `en`; the **signed summary doc** is in the tenant's own language (incl. `pt`).

`app/api/t/[token]/pbv-full-app/generate-forms/route.ts`:
- `route.ts:62-63` — `rawLang = submission_language ?? preferred_language ?? 'en'`; `language = (rawLang === 'es' || rawLang === 'pt') ? 'es' : 'en'`. **Matches spec** (pt → es form output).
- `route.ts:204-206` — `summaryLang = preferredLang === 'pt' ? 'pt' : preferredLang === 'es' ? 'es' : 'en'`. **Matches spec** (summary in tenant's own language). Note it keys on `preferred_language`, *not* `submission_language` — by design.
- `forms/route.ts:21` selects `submission_language, preferred_language` similarly.

These are pure functions of two columns and are **unit-testable without a deploy** — extract/assert the mapping rather than walking a live flow.

### ES form-output assets — resolve for the generated set

`assets/pbv-source-pdfs/` and `scripts/field-maps/` ship in **`en`/`es` pairs only — no `-pt`** (correct: pt tenants get `es` output). The forms that currently generate (per PRD-55) have both `*-es.pdf` and `*-es.json`. `loadFieldMap(formId, language)` (`generate-forms/route.ts:337-351`) and `getSourcePdf(formId, language)` are called with the derived `'en' | 'es'`, never `'pt'` — so no pt asset is ever requested. [Inference] ES output is resolvable for the same enabled set PRD-55 reconciled; this PRD confirms it for `language='es'`, it does not re-do PRD-55's reconciliation.

### Summary / consent CONTENT — Alex + Dan dependency (NOT Windsurf)

`lib/pbv/summary-doc/content.ts`, `descriptions.ts`, and `lib/pbv/consent-text.ts` carry ES/PT strings marked `// CONTENT: tentative — review with Dan + translator` and `// CONSENT: tentative — review`. The **pipeline** (per-language render, `summaryLang` selection, `getFormDescription`/`getUploadDescription` fallback, `pbv_summary_documents` upsert keyed by `summaryLang`) is wired for all three languages and is in-scope to verify. The **prose** is authored by Alex + Dan + a translator and is out of scope for the build — it stays against the current tentative drafts, kept grep-able for the translator.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| English-placeholder ES/PT strings | `lib/pbv/docTypeHelp.ts` (68 `"TODO:"` strings, ~34 doc types) | tenant-facing via `components/pbv/TenantDocumentUpload.tsx` |
| Stale TODO header | `lib/pbv/cards/docContent.ts:27-29` | body is translated; comment is misleading |
| Tentative summary content | `lib/pbv/summary-doc/content.ts`, `descriptions.ts` | `// CONTENT: tentative` — Alex/Dan + translator |
| Tentative consent content | `lib/pbv/consent-text.ts` | `// CONSENT: tentative` — Alex/Dan |
| Form-output routing | `generate-forms/route.ts:62-63` | `es`/`pt` → `es`, `en` → `en` |
| Summary-doc routing | `generate-forms/route.ts:204-206` | `pt` → `pt`, `es` → `es`, else `en` |
| ES assets | `assets/pbv-source-pdfs/*-es.pdf`, `scripts/field-maps/*-es.json` | en/es pairs only; no pt (correct) |
| Existing tests | `lib/pbv/summary-doc/__tests__/`, `lib/pbv/__tests__/` | summary + content tests exist; no dedicated language-routing or key-coverage test yet |

---

## Goals

1. Every tenant-facing string surface in the PBV full-app renders real EN, ES, and PT — no `TODO:`-prefixed or English-fallback strings shown to ES/PT tenants.
2. The `docTypeHelp.ts` ES/PT placeholders are filled with real translations (mechanical translation work, in scope).
3. A grep-able convention marks any string still pending professional review (`// CONTENT: tentative` / `// CONSENT: tentative`), and a coverage check fails loudly if a key exists in `en` but is missing or placeholder in `es`/`pt`.
4. Language routing is confirmed correct against spec and locked by unit tests: UI = `preferred_language`; form output = `es` for `es`/`pt`, `en` for `en`; summary = tenant's own language incl. `pt`.
5. ES form output resolves for the enabled set (source PDF + field map for `language='es'`), confirmed statically.
6. The summary/consent **content** dependency (real EN/ES/PT prose from Alex + Dan + translator) is logged in `OPEN-DECISIONS.md`; the build runs against current tentative content and does not author prose.

## Non-goals

- No re-doing PRD-55's template reconciliation (only confirm `es` resolves for the already-reconciled enabled set).
- No change to signing logic (PRD-56), intake validation (PRD-57), or document gating/categorization logic (PRD-58) — only the *strings* on those surfaces.
- No authoring of summary/consent prose — that is the Alex + Dan + translator dependency.
- No new source PDFs and no `-pt` assets (pt tenants get `es` output by design).
- No runtime multilingual walk in-session (deferred — requires a deploy).

---

## Implementation phases

### Phase 1 — Coverage inventory (the audit)
- Enumerate every tenant-facing string table on the intake / dashboard / documents / signing surfaces (the tables listed under Findings, plus any the build discovers). For each, compare `en` keys against `es` and `pt`: report (a) missing keys, (b) keys whose `es`/`pt` value equals the `en` value or begins with `TODO:`. Produce a coverage table in the build report.
- This is the inventory the earlier translation agent's gap-flag asked for. It must be exhaustive across the four sibling-PRD surfaces, not just the two known-bad files.

### Phase 2 — Fill mechanical gaps
- Translate the 68 `docTypeHelp.ts` ES/PT placeholders into real Spanish/Portuguese, modeled on the already-translated `docContent.ts` strings for the same doc types (tone + terminology consistency). Remove the `TODO:` prefixes.
- Fix the stale `docContent.ts` header comment (it claims es/pt are incomplete; confirm they are complete and correct the comment, or fill whatever is genuinely missing).
- Any string the build is not confident translating professionally: fill a best-effort draft and mark it `// CONTENT: tentative — review with Dan + translator` so it is grep-able for the translator. Do not leave a literal `TODO:` rendered to a tenant.

### Phase 3 — Routing correctness (unit-testable)
- Extract the form-output and summary-doc language derivation into a small pure helper (or assert it in place if extraction is risky) and add unit tests covering all three `preferred_language` inputs × the `submission_language` override: `en → en/en`, `es → es/es`, `pt → es/pt`. Confirm `summaryLang` keys on `preferred_language` and form `language` keys on the `submission_language ?? preferred_language` fallback, per `route.ts:62-63` and `:204-206`.
- Add a coverage test: for every key in the `en` block of each audited table, assert the `es` and `pt` blocks have a non-empty value that does not begin with `TODO:`. This is the fail-loud guard for future drift.

### Phase 4 — ES asset resolution (static)
- For the enabled, generating template set (per PRD-55), assert `getSourcePdf(formId, 'es')` and the `*-es.json` field map both resolve. Confirm no code path requests a `-pt` asset. This overlaps PRD-55's reconciliation guard — extend it to assert the `es` language explicitly rather than duplicating it.

### Phase 5 — Summary/consent content dependency
- Confirm the summary pipeline renders for `summaryLang ∈ {en, es, pt}` (the `SUMMARY_CONTENT[language] ?? SUMMARY_CONTENT.en` path and `getFormDescription`/`getUploadDescription` per-language lookups). Leave the tentative prose in place.
- Log the content dependency in `OPEN-DECISIONS.md` (real EN/ES/PT summary + consent prose pending from Alex + Dan + translator). Keep all tentative strings grep-able via the existing `// CONTENT: tentative` / `// CONSENT: tentative` markers.

---

## Verification / test plan

**Static (in-session, before commit):**
- **Gate 1 (coverage inventory):** the build report contains the full per-table EN/ES/PT coverage matrix; the only remaining ES/PT gaps are tentative-marked content (summary/consent prose), not `TODO:` placeholders rendered to tenants.
- **Gate 2 (docTypeHelp fixed):** zero `"TODO:"` strings remain in `lib/pbv/docTypeHelp.ts`; ES/PT values are real translations.
- **Gate 3 (routing):** unit tests green for `en → en/en`, `es → es/es`, `pt → es/pt` (form-output / summary-lang).
- **Gate 4 (key coverage guard):** the new coverage test fails when an `es`/`pt` value is deliberately blanked or `TODO:`-prefixed in a scratch run.
- **Gate 5 (ES assets):** static assertion that the enabled set resolves `es` source PDF + field map; no `-pt` asset requested.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; existing summary/content tests stay green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate 7 (multilingual walk):** SMS-link → submit walked in each of EN, ES, PT on a deployed preview — UI in `preferred_language`, ES stamped forms for `es`/`pt`, summary in own language incl. `pt`. Requires a deploy + a `pt` and an `es` test token.
- **Gate 8 (ES stamp fidelity):** render an `es` stamped form to confirm data lands in the Spanish form's boxes (pymupdf visual check on a deploy).

---

## Open questions

- **O1:** Should the `docTypeHelp.ts` ES/PT fills be treated as final, or also marked `// CONTENT: tentative` pending translator review? Default: best-effort fill + tentative-mark, so the translator has one grep target across summary, consent, and doc-help. (Logged.)
- **O2:** The summary/consent prose is the standing Alex + Dan + translator dependency — confirm the current tentative drafts are acceptable to ship behind until real content lands. (Logged.)

## Decisions

- **D1:** PT tenants get **ES form output** + a **PT summary doc**; no `-pt` source PDFs or field maps are created. (Resolved from `form-execution-plan_2026-05-14.md`.)
- **D2:** `preferred_language` drives UI + summary language; `submission_language ?? preferred_language` drives form-output language with `pt → es`. (Confirmed in `generate-forms/route.ts`.)
- **D3:** Summary/consent **prose** is authored by Alex + Dan + a translator, not the build; the build verifies plumbing and keeps tentative strings grep-able.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/docTypeHelp.ts` | 2 | replace 68 `TODO:` ES/PT placeholders with real translations |
| `lib/pbv/cards/docContent.ts` | 2 | correct the stale `TODO: Complete es and pt` header comment |
| new unit test (e.g. `lib/pbv/__tests__/language-routing.test.ts`) | 3 | assert form-output / summary-lang mapping for en/es/pt |
| new coverage test (e.g. `lib/pbv/__tests__/translation-coverage.test.ts`) | 3 | assert no `en`-only / `TODO:` keys in audited tables |
| `generate-forms/route.ts` *(only if extraction is needed)* | 3 | extract language derivation into a testable helper — no behavior change |
| reconciliation/asset guard (shared with PRD-55) | 4 | extend to assert `es` resolves for the enabled set |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | 5 | log the summary/consent content dependency + O1/O2 |

If anything outside this list needs changing (signing logic, intake validation, document gating, new assets), stop and report rather than expanding scope.
