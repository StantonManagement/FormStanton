# PBV Signing Flow (PRD-54) — Session Handoff

**Date:** 2026-05-20
**Purpose:** Resume the PRD-54 launch-blocker work without rebuilding context. The previous chat got long; this is the clean pickup point.

---

## TL;DR — the one thing left

**Push commit `1dc4477`, let Vercel deploy, then runtime-verify Bug C.** That is the only thing standing between the current state and a working tenant signature flow. Everything else in PRD-54 is shipped and verified.

---

## What PRD-54 is

Discovered 2026-05-20 in a live end-to-end test of the tenant PBV full-app. Document upload works; the flow breaks in the document → signing transition. Three bugs:

| Bug | What | Status |
|---|---|---|
| A — `/sign` 404 | `app/pbv-full-app/[token]/documents/page.tsx:122` CTA navigated to `/sign` (no route). Now `/sign/summary`. | ✅ shipped + verified live |
| B — infinite loop | `sign/summary/page.tsx` re-fired `POST generate-forms` forever (100+ calls, intermittent 503s) because `reload()` churned `state`. Fix = `useRef` one-shot guard + terminal "couldn't prepare your forms" state. | ✅ shipped + verified live (one POST, no loop, confirmed on two apps) |
| C — zero forms | `generate-forms` returns `total_generated: 0`, every form skipped → `/forms` empty → summary never renders → tenant cannot sign or submit. | ⚠ **fix committed `1dc4477`, NOT pushed/deployed** |

Current production deploy `dpl_CW82PZcWGofHmaMcGn4dVuxFGFix` has A + B but **not** C.

---

## Bug C — root cause + the committed fix

**Root cause (confirmed via the live `generate-forms` response):** source PDFs are loaded in `lib/pbv/form-generation/source-pdfs.ts` from `docs/templates/*.pdf` via `process.cwd()` + `fs`. `.vercelignore` excludes `docs/`, so those PDFs are absent in the deployed serverless function → `getSourcePdf()` returns `null` for every form → `generate-forms` skips them all (the source-PDF check at `generate-forms/route.ts:112` runs before the field-map check). The earlier Bug C attempt only added `scripts/field-maps/**` to tracing, which did not cover the source PDFs.

**The fix (`1dc4477`, by Claude Code, committed not pushed):**
- Copied the 20 needed source PDFs (en/es × 10 forms with current sources) into a new, non-ignored dir `assets/pbv-source-pdfs/`.
- Repointed `lib/pbv/form-generation/source-pdfs.ts` to load from `assets/pbv-source-pdfs/<file>` (copied, not moved — local dev scripts under `scripts/` still reference `docs/templates/`).
- Added `'./assets/pbv-source-pdfs/**'` to `outputFileTracingIncludes` for the generate-forms route in `next.config.js` (next to the existing `scripts/field-maps/**`).
- `tsc --noEmit` + `npm run build` clean; the route's `.nft.json` lists all 20 PDFs + 24 field-map JSONs (so the trace will pack them into the Vercel function).

---

## Do this next (resume here)

1. **Push `1dc4477`** to the deploy branch and let Vercel build. (Confirm which branch deploys to production — prior A/B fix reached `form-stanton.vercel.app`.)
2. **Runtime-verify** on the deploy. Open `/pbv-full-app/<token>/sign/summary`, read the `generate-forms` response body.
   - **PASS:** `total_generated > 0`; `skipped` contains **only** conditional/source-pending forms (`criminal_background_release`, `eiv_guide_receipt`, `reasonable_accommodation`, `insurance_settlement`, `cd_trust_bond`, pet/vehicle/self-employment) — **not** `main_application/en` or the other core forms. Then `/sign/summary` renders the summary and is signable; "Review and sign required forms" unlocks; "Submit my application" enables once everything's signed.
   - **FAIL:** if `main_application/en` is still in `skipped`, the assets still aren't resolving at runtime (check the deploy actually carried `1dc4477`, and that `assets/pbv-source-pdfs/` is git-tracked and bundled).
3. Update `docs/IN-FLIGHT.md` PRD-54 entry to "shipped" once green.

**Test tokens (prod):**
- `222-224-maple-ave-unit-2n-fa62844782fa4266b5cc1697bfbf734c` — 11/11 docs uploaded (cleanest for the full happy path).
- `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` — 1/13 docs.

**How to verify:** the live page is public, so the Chrome DevTools MCP browser works without the user's extension — `new_page` → `/sign/summary` → `list_network_requests` (fetch/xhr) → `get_network_request` on the `generate-forms` POST to read the body.

---

## Gotchas / corrections carried forward

- **`.git/config` is NOT actually broken.** Earlier docs (PRD-53, PRD-54 prompt) said to "fix `.git/config` line 23 first." Claude Code checked: git runs fine in both shells; line 23 is a harmless tab-only line; the `fatal` did not reproduce. Stop treating it as a blocker.
- **Next 16 Turbopack vs webpack:** local `next dev` won't start (Turbopack default conflicts with the `webpack()` OpenCV config). For this work it's irrelevant — `next dev` doesn't exercise the file-tracing fix anyway (dev reads files straight from disk). If dev is needed, `next dev --webpack`. Do **not** add `turbopack: {}` or fold it into a hotfix. Separate post-launch task: confirm `next build` still pins webpack, else the OpenCV config gets ignored in prod.
- **Source-pending forms are expected to skip.** pet/vehicle/self-employment (and `reasonable_accommodation`, `insurance_settlement`, `cd_trust_bond`, `criminal_background_release`, `eiv_guide_receipt`) have no current source PDF and/or are conditional — `null`/skip is correct behavior, not a regression.
- **Cleanup:** a `_qa_test_docs/` folder was left in the repo root from the first test session (couldn't be removed from the agent side — permission). Safe to delete.
- **`summary.generated` is already `true`** in the `generate-forms` response — the summary PDF itself builds fine. The blocker is purely the signable forms count being 0; the page requires ≥1 form to proceed.

---

## Key files

- `app/pbv-full-app/[token]/documents/page.tsx` (Bug A) — done
- `app/pbv-full-app/[token]/sign/summary/page.tsx` (Bug B) — done
- `lib/pbv/form-generation/source-pdfs.ts` + `assets/pbv-source-pdfs/` + `next.config.js` (Bug C) — in `1dc4477`, pending deploy
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` — generation logic (skip-if-source-or-fieldmap-missing)
- `app/api/t/[token]/pbv-full-app/forms/route.ts` — reads `pbv_form_documents` (empty ⇒ zero rows generated)
- PRD `docs/fullApp-Plan/54-pbv-summary-sign-loop-and-route-fix_prd_2026-05-20.md`; build report `docs/build-reports/54-...build-report_2026-05-20.md`
