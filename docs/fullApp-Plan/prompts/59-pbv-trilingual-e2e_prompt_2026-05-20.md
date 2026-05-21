# Windsurf Build Prompt — PRD-59: Trilingual EN / ES / PT End-to-End

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/59-pbv-trilingual-e2e_prd_2026-05-20.md`. Read it next.

This is a verify-and-fix pass over EN / ES / PT across every surface PRD-55/56/57/58 touch. The flow is trilingual: UI follows `preferred_language` (incl. `pt`); stamped federal forms come out in **Spanish for `es` and `pt`** tenants; the signed summary doc is in the tenant's **own** language (incl. `pt`). Most of the translation plumbing is present and balanced — but `lib/pbv/docTypeHelp.ts` holds 68 literal `"TODO:"`-prefixed English placeholders that render to ES/PT tenants on the document-help surface, and the routing logic needs to be confirmed-and-locked, not rewritten.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (the cumulative batch branch). Do **not** create a per-PRD branch. This PRD assumes PRD-55/56/57/58 are already committed on this branch — it verifies their surfaces in three languages.
- One commit when done: `PRD-59: trilingual EN/ES/PT end-to-end`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD is **code + string-table only** — no DB migration. (The one DB-adjacent fact, `submission_language`/`preferred_language`, is read-only here.)

---

## The language model (see PRD for full detail)

| Channel | Driven by | Values |
|---|---|---|
| UI strings | `preferred_language` | `en` / `es` / `pt` |
| Stamped form OUTPUT | `submission_language ?? preferred_language` | `es` for `es`/`pt`, `en` for `en` (never `pt` — no `-pt` assets) |
| Signed summary doc | `preferred_language` | tenant's own language incl. `pt` |

Confirmed in `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:62-63` (form output) and `:204-206` (summary). These are correct — **confirm and lock with tests, do not change behavior.**

---

## Step-by-step

### Step 0 — Read the surfaces
Enumerate the tenant-facing string tables across the four sibling-PRD surfaces:
- Dashboard: `lib/pbvFullAppTranslations.ts` (consumed by `app/pbv-full-app/[token]/page.tsx`).
- Intake: `components/pbv/intake/Section*.tsx`, `AdultWizard.tsx`, `IntakeShell.tsx`, and `SECTION_TITLES` in `app/pbv-full-app/[token]/intake/[section]/page.tsx`.
- Documents: `lib/pbv/cards/docContent.ts`, `lib/pbv/docTypeHelp.ts` (consumed by `components/pbv/TenantDocumentUpload.tsx`).
- Signing: `components/pbv/sign/*.tsx`, `lib/pbv/consent-text.ts`.
- Summary doc: `lib/pbv/summary-doc/content.ts`, `descriptions.ts`.

### Step 1 — Coverage inventory (the audit)
For each table, compare the `en` keys against `es` and `pt`. Flag (a) missing keys, (b) values where `es`/`pt` equals `en` or starts with `TODO:`. Build a coverage matrix for the build report. Per the PRD's Findings the known balanced surfaces are intake / dashboard / signing / `docContent.ts`; the known gap is `docTypeHelp.ts`. Confirm and surface anything else.

### Step 2 — Fill the mechanical gaps
- `lib/pbv/docTypeHelp.ts`: replace all 68 `"TODO:"`-prefixed ES/PT values with real Spanish/Portuguese, modeled on the already-translated `docContent.ts` strings for the same doc types (consistent tone + terminology). Remove the `TODO:` prefixes.
- `lib/pbv/cards/docContent.ts`: the body is translated but the header comment still says `TODO: Complete es and pt`. Confirm completeness; fill anything genuinely missing; correct the comment.
- **If you cannot translate a string with confidence, do NOT leave a rendered `TODO:`.** Write a best-effort draft and mark it `// CONTENT: tentative — review with Dan + translator` so it stays grep-able, then keep going.

### Step 3 — Lock routing + coverage with tests
- Add `lib/pbv/__tests__/language-routing.test.ts` (or similar) asserting the derivation for all inputs: `en → form en / summary en`, `es → form es / summary es`, `pt → form es / summary pt`, plus the `submission_language` override beating `preferred_language` for form output. If the logic is inline in `route.ts:62-63` / `:204-206`, extract it into a small pure helper (no behavior change) so it's testable.
- Add a coverage test that, for every key in each audited table's `en` block, asserts `es` and `pt` have a non-empty value not beginning with `TODO:`. This is the fail-loud drift guard.

### Step 4 — Confirm ES assets resolve (static)
For the enabled, generating template set (per PRD-55), assert `getSourcePdf(formId, 'es')` and the `*-es.json` field map both resolve, and that no code path requests a `-pt` asset (none exist; pt → es output). Extend PRD-55's reconciliation/asset guard to assert `es` explicitly rather than duplicating it. Do **not** re-run PRD-55's full reconciliation.

### Step 5 — Log the content dependency + static gates + build report + commit
- Log to `OPEN-DECISIONS.md`: real EN/ES/PT **summary + consent prose** is authored by Alex + Dan + a translator, not this build; built against current `// CONTENT: tentative` / `// CONSENT: tentative` drafts. Add O1 (mark docTypeHelp fills tentative?) and O2 (tentative summary/consent acceptable to ship behind?).
- `node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green; existing summary/content tests still green.
- Build report at `docs/build-reports/59-pbv-trilingual-e2e_build-report_2026-05-20.md`. Commit `PRD-59: …`. Then proceed to the PRD-60 prompt.

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/docTypeHelp.ts` | replace 68 `TODO:` ES/PT placeholders with real translations |
| `lib/pbv/cards/docContent.ts` | correct the stale `TODO: Complete es and pt` header comment; fill any genuine gap |
| new `lib/pbv/__tests__/language-routing.test.ts` | assert form-output / summary-lang mapping for en/es/pt |
| new `lib/pbv/__tests__/translation-coverage.test.ts` | assert no `en`-only / `TODO:` ES/PT keys in audited tables |
| `generate-forms/route.ts` *(only if extraction is needed for testing)* | extract language derivation into a pure helper — **no behavior change** |
| shared reconciliation/asset guard (with PRD-55) | extend to assert `es` resolves for the enabled set |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | log the summary/consent content dependency + O1/O2 |

## Files NOT to touch

- Signing logic (PRD-56), intake validation (PRD-57), document gating/categorization logic (PRD-58) — only *strings* on those surfaces.
- PRD-55's template reconciliation — only *confirm* `es` resolves for the already-reconciled set.
- Source PDFs / field maps — no new assets, no `-pt` files (pt tenants get `es` output by design).
- The summary/consent **prose** — do not author it. Leave tentative drafts; just verify the per-language plumbing renders.
- The form-output / summary-lang **behavior** in `route.ts` — confirm and test it; do not change the mapping.

---

## Verification gates (per PRD-59)

**Static (must pass in-session before commit):**
- **Gate 1:** build report has the full per-table EN/ES/PT coverage matrix; only remaining ES/PT gaps are tentative-marked content (summary/consent prose), not rendered `TODO:`.
- **Gate 2:** zero `"TODO:"` strings remain in `lib/pbv/docTypeHelp.ts`.
- **Gate 3:** routing unit tests green (`en → en/en`, `es → es/es`, `pt → es/pt`).
- **Gate 4:** coverage test fails when an `es`/`pt` value is deliberately blanked or `TODO:`-prefixed in a scratch run.
- **Gate 5:** static assertion that the enabled set resolves `es` source PDF + field map; no `-pt` request.
- **Gate 6:** `tsc --noEmit` + `npm run build` clean; existing summary/content tests green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate 7:** SMS-link → submit walked in EN, ES, PT on a deploy — UI in `preferred_language`, ES stamped forms for `es`/`pt`, summary in own language incl. `pt` (needs a deploy + `es`/`pt` test tokens).
- **Gate 8:** `es` stamped-form fidelity (pymupdf visual check on a deploy).

---

## What "done" looks like

1. `PRD-59: …` commit on `feat/pbv-full-finalization`.
2. Static gates green.
3. `docTypeHelp.ts` placeholders filled; coverage matrix proves no rendered `TODO:` on any tenant surface.
4. Routing locked by unit tests; ES assets confirmed resolvable; no `-pt` requested.
5. Summary/consent content dependency logged in OPEN-DECISIONS; tentative strings grep-able.
6. Build report written, deferred runtime gates listed. Proceed to the PRD-60 prompt.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not leave any `TODO:`-prefixed string rendered to an ES/PT tenant.
- Do not author the summary/consent prose, and do not change the form-output/summary-lang routing behavior.
- Do not create `-pt` source PDFs or field maps. Do not re-do PRD-55's reconciliation.
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23 — it is not broken. Do not touch signing/intake/gating logic.
- Do not block on deploy-only gates (the multilingual walk) — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA.
- The EN/ES/PT coverage matrix across all audited tables, with per-table gap counts before/after.
- Confirmation that `docTypeHelp.ts` has zero rendered `TODO:` and the routing tests pass.
- ES asset-resolution result for the enabled set.
- Decisions logged to OPEN-DECISIONS (incl. the summary/consent content dependency).
- Deferred runtime gates (multilingual walk, ES stamp fidelity) for the post-run pass.
