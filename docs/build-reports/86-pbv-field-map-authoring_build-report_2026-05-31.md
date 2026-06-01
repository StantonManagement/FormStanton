# Build Report — PRD-86 Phase A: Field-Map Authoring & Preview/Validate Tool

**Date:** 2026-05-31
**Branch:** suggested `feat/field-map-authoring`
**Scope:** Phase A only (standalone tool + apply to the live PBV forms). Phase B (in-app admin route + DB) not built.

---

## Summary

Built the standalone field-map authoring/preview/validate tool in `lib/field-map-authoring/**` plus a dev harness, ran all 24 live PBV field maps through it, and committed the corrections it could verify. The tool renders both previews through the production `stampForm` path (Preview B == production), runs geometric validators, and an OCR round-trip behind a pluggable rasterizer/engine.

**Honest outcome on the 24 maps:** after fixing a false-positive in the rect model, the geometric validators found **one real defect class** — `eiv-guide-receipt` (en + es) was authored against a declared `1224×612` page while the actual source PDF is `792×612`, leaving `signature_date` off the right edge. The tool flagged and auto-corrected it (x 700→688). The other 22 maps are geometrically clean (their coordinates fit their real media boxes). Any remaining defects the operator observed are sub-overlap/visual (baseline shifts, cramping, wrong-region) — these are **not** machine-caught in this environment because PDF rasterization is unavailable here (so the OCR round-trip reports `skipped`); they are surfaced via the generated Preview-B PDFs for human review (which is what PRD-87 is for).

---

## What changed

### New module `lib/field-map-authoring/`
- `types.ts` — re-exports the `stamper.ts` `FieldMap` shape (the output contract) + tool types; tolerance/size constants.
- `ingest.ts` — load source PDF, page count + media boxes (pdf-lib), the bounds all placement validates against.
- `propose.ts` — the "few passes" for NEW documents: text-layer anchor detection (pdfjs-dist), label→data-key mapping via convention dictionary, width fit; unmapped → `fresh_input` (blank, not guessed). Best-effort scaffolding.
- `geometric.ts` — rect extraction (`fieldMapToRects`) + validators: out-of-bounds, overlap (point tolerance), row-overflow. Row-column widths are inferred (explicit width → checkbox=glyph-width → text=gap-to-next-column), which is the fix for the false-positive described below.
- `autocorrect.ts` — **bounded, deterministic** corrections only: clamp out-of-bounds boxes inside the media box, nudge overlapping flat fields apart, reduce a row pattern's `max_rows` to stop overflow. Never invents placements; returns a new map (input not mutated).
- `previewA.ts` — grayed-out spacing proof: translucent box per field/cell, overlaps/out-of-bounds tinted red + listed.
- `previewB.ts` — text-filled render via `stampForm` (the exact production path).
- `ocr.ts` — OCR round-trip behind a pluggable `Rasterizer` + `OcrEngine`. Default rasterizer = pdf-lib split + sharp (same as `lib/scan/splitPdf.ts`); default engine = the repo's Claude-vision OCR (`lib/intake/ocr.ts`). **Degrades gracefully**: if a page can't be rasterized it reports `skipped` rather than failing.
- `index.ts` — `reviewFieldMap()` (validate/auto-correct an existing map → previews + report) and re-exports `proposeFieldMap()`.

### Harness
- `scripts/field-map-authoring-harness.ts` — single-form mode (`<source.pdf> [field-map.json] <sample-data.json>`) and batch mode (`--all-pbv [--autocorrect] [--write]`). Emits `preview-A.pdf`, `preview-B.pdf`, `validation-report.json` per form to `.field-map-authoring-out/` (gitignored).
- `tests/fixtures/field-map-authoring/sample-data.json` — representative dataset for Preview B.

### Corrected maps (committed)
- `scripts/field-maps/eiv-guide-receipt-en.json` and `-es.json` — `signature_date.x` 700→688 (in-bounds on the real 792-wide page). Diff is 1 substantive line per file.
- Noted, not changed (informational only; the generator uses the real PDF media box): `eiv-guide-receipt` `page_dimensions` is declared `1224×612` but the PDF is `792×612` — likely the root cause of the authoring error. Recommend correcting the declared dims for future authors.

### Regen tooling (NOT executed — see below)
- `scripts/regen-applicant-forms.ts` — regenerates an applicant's docs via the **real** `/generate-forms` route (faithful: conditional rules, generation_version, storage path, the upsert). `--mia-santha` targets the two PRD-85 applicants. Does **not** notify.

---

## Dependency added
- `tsx` (devDependency) — to run the TS harness/regen scripts. The repo already invoked `npx tsx` (e.g. `check:buildings`); installed it locally (one install) so the harness is runnable without npx cold-start. No runtime/app dependency added. **OCR engine: no new dependency** — reused the existing Claude-vision path per the chosen option.

---

## Per-form validation results (batch, after the rect-model fix)

| Result | Forms |
|---|---|
| Geometrically clean (`geom=0`) | all 24 |
| Auto-corrected | `eiv-guide-receipt-en`, `eiv-guide-receipt-es` (1 each: out-of-bounds clamp) |
| OCR round-trip | `skipped` where text needed verifying (no PDF rasterization in this env); `pass` (trivially) where the sample data matched no fields |

A deliberately-broken map (overlapping boxes, a box past the edge, an overflowing row pattern) is flagged by the validators and auto-corrected — covered by unit tests.

---

## Gates

| Gate | Command | Result |
|---|---|---|
| Typecheck | `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ clean (exit 0) |
| Unit tests | `node ./node_modules/vitest/vitest.mjs run lib/field-map-authoring/__tests__/` | ✅ 16/16 (geometric overlap/oob/row-overflow flag + clean pass; autocorrect clamp/nudge/reduce-rows + no-mutation; OCR round-trip flag/pass/skip) |
| Lint | `npm run lint` | ⚠️ Not run — ESLint isn't installed in this sandbox and `npx next lint` triggers an interactive install (Windows hang per SHELL-PROTOCOL). Conformance verified by inspection. |
| WYSIWYG | Preview B uses `stampForm` directly — same code path as the generator (`generate-forms/route.ts` calls the same `stampForm`). | ✅ by construction (shared engine) |
| Visual review of previews | out of gate | pending operator (`.field-map-authoring-out/<slug>/preview-{A,B}.pdf`) |

---

## Regeneration of Mia & Santha — NOT executed (deploy-gated)

The chosen option was "auto-correct + auto-regen prod," but during execution I hit a hard constraint and stopped rather than do something incorrect:

- The faithful regen path is the real `/generate-forms` route, which runs the field maps **bundled in the deployed build**. POSTing to the live endpoint now would regenerate with the **old (defective) eiv map**, not the committed correction — reproducing the defect.
- I cannot run a local dev server (SHELL-PROTOCOL forbids `npm run dev` from agents) to exercise the route with the local corrected maps.
- Re-implementing the ~500-line generation route (conditional rules, generation_version/signer handling, storage upload, upsert) in a standalone prod-writing script is error-prone against two real applicants' records, and was not done.

**Operator step (after deploying the corrected maps):**
```
npx tsx scripts/regen-applicant-forms.ts --mia-santha
```
Then review the regenerated docs in the PRD-87 UI and approve. Only then does PRD-85 Phase 4 send the signing prompt. **No notification is sent by the regen.** This preserves the sequencing: PRD-86 (maps) → deploy → regen → PRD-87 review → PRD-85 Phase 4.

> Candor: the geometric pass corrected the one machine-detectable defect (eiv). It does **not** certify that all 11 of Mia/Santha's forms are visually clean — that certification is the human review in PRD-87, which gates the send regardless. The subtle/visual defects the operator originally saw should be confirmed there (or re-run the harness in a rasterization-capable env to get the OCR round-trip).

---

## Open questions / decisions logged
1. **OCR dependency** — reused Claude-vision (`lib/intake/ocr.ts`), pluggable; no new dep. Rasterization via sharp is unavailable in this env (libvips without PDF support) → OCR round-trip reports `skipped` here. To run it, use an env with PDF rasterization or swap in a rasterizer (e.g. node-canvas/pdfium) via the `Rasterizer` interface.
2. **Field-map storage** — confirmed: `scripts/field-maps/{slug}-{lang}.json`, loaded by `loadFieldMap` in `generate-forms/route.ts`. Corrected maps written there.
3. **Sample dataset** — a sanitized fixture (`tests/fixtures/field-map-authoring/sample-data.json`); no tenant data in repo.
4. **Overlap tolerance** — default 2 pts (`DEFAULT_OVERLAP_TOLERANCE`), configurable.

## Not built (Phase B)
- No `document_field_maps` table/migration, no admin route, no storage — Phase B, per the prompt.
