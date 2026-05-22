# PRP-016 — Scanner & Camera Mobile Correctness + Bundle Cost — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `d188b23a4edae0ad1c88cc6919790d9fb5dc647a`
**Findings closed:** Angle-2 **B1**, **B2**, **H2**; mobile review §2.4, §9, §11.7.

## Files changed
- `components/DocumentScanner/DocumentScanner.tsx` — `pdf-lib` is now lazy (`import type` + `await import('pdf-lib')` inside `buildPdf`); `makePreviewBlob` downsamples the preview-only blob to 1200 px long-edge; `Stage` union adds `converting_heic` with a dedicated UI region; `max-h-[50vh]` → `max-h-[50dvh]`.
- `components/DocumentScanner/usePermissionPrompt.ts` — `facingMode` is now `{ ideal: 'environment' }` (soft constraint).
- `components/DocumentScanner/__tests__/prp016-scanner.test.ts` *(new)* — 9 tests.

## Path taken (defaults logged)
- **HEIC loading message** is hard-coded English. `translations.ts` is not in PRP-016's Outputs allowlist; the i18n variants land in a follow-up. The string is in a `role="status" aria-live="polite"` region so SR users still hear it.
- **`previewUrl` is downsampled only; `blob` stays full-resolution.** This means PDF assembly still gets the high-res input (already capped at 2400 px long-edge inside `buildPdf`), and only the on-screen preview gets the small bitmap.
- **`facingMode: { ideal: 'environment' }`** rather than `{ exact: 'environment' }` — exact would NotFoundError on devices without a rear camera. Soft constraint is the safer default; production telemetry should confirm cellular users still get the rear lens.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/DocumentScanner/__tests__/prp016-scanner.test.ts` — **9 pass / 0 fail / 3.93 s.**

## Boundary build expectation
- The Batch 04 boundary build will confirm `pdf-lib` is in a lazy chunk (recorded in the batch summary).

## Deferred runtime gates
- Samsung Internet on a Galaxy device → tap "Take a photo" → rear camera opens (not a "no camera" error).
- Low-RAM device (older Android) scans a 12 MP photo → preview opens crisply; no OOM; review/discard works.
- Bundle analyzer: `pdf-lib` appears only in the lazy assembly chunk, not in the main scanner bundle.
- HEIC upload from iPhone → "Converting photo…" announces and then transitions to the standard preview.

## Follow-ups
- Translate the "Converting photo…" message — add `convertingHeic` to `ScannerStrings` + EN/ES/PT and replace the hard-coded literal.
