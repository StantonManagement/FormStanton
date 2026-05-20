# Build Report — PRD-47: PBV Scanner Multi-Page Review, Contrast Feedback, Debug Overlay Gating

**Date:** 2026-05-19  
**Branch:** `feat/pbv-scanner-multipage-review-47`  
**PRD:** `docs/fullApp-Plan/47-pbv-scanner-multipage-review-and-feedback_prd_2026-05-19.md`

---

## Changes delivered

| Feature | File | Status |
|---|---|---|
| F1 — `commitCurrentPage` always routes to `review_pages` | `components/DocumentScanner/DocumentScanner.tsx` | ✅ Done |
| F2 — New `review_pages` block: thumbnail list + conditional Add-page + explicit Upload | `components/DocumentScanner/DocumentScanner.tsx` | ✅ Done |
| F3 — `isStuck` state, polling effect, stuck banner | `components/DocumentScanner/LivePreviewStage.tsx` | ✅ Done |
| F4 — Debug overlay double-gated: `?debug=1` AND `NODE_ENV !== 'production'` | `components/pbv/DebugErrorOverlay.tsx` | ✅ Done |
| F5 — Translation keys: `reviewTitle`, `reviewHint`, `pageNumber`, `uploadOnePage`, `uploadNPages`, `cancelAndStartOver`, `qualityWarning`, `stuckHint`, `stuckHintSecondary` added to en/es/pt | `components/DocumentScanner/translations.ts` | ✅ Done |

---

## Translation key checklist

All keys confirmed present in en / es / pt:

- [x] `reviewTitle(n)` (function)
- [x] `reviewHint`
- [x] `pageNumber(n)` (function)
- [x] `deletePage` (already existed; unchanged)
- [x] `addPage` (already existed; unchanged)
- [x] `uploadOnePage`
- [x] `uploadNPages(n)` (function)
- [x] `cancelAndStartOver`
- [x] `qualityWarning`
- [x] `stuckHint`
- [x] `stuckHintSecondary`

---

## Implementation notes

### F1 — `commitCurrentPage` shortcut removal
- Removed `isSingleMode` branch and `async`/`await finalizeSubmit` call.
- `isSingleMode` constant preserved — still used at line ~694 (button label) and in review_pages Add-page gate.
- `canAddMorePages` derived variable removed (was only referenced in old `review_pages` block; now inlined as `!isSingleMode && pages.length < (maxPages ?? 30)`).

### F2 — `review_pages` replacement
- Old block: 2-column grid, generic `t.submit` button, `t.cancel` routes to `onCancel`.
- New block: vertical `<ul>` with per-row thumbnail + quality flag note + delete link; conditional Add-page (hidden when `isSingleMode`); Upload button with dynamic label; Cancel-and-start-over (revokes all preview URLs, clears pages, returns to `entry`).
- "Add page" uses `setStage('entry')` directly (no `resetCurrentPage()` needed since there's no `currentPage` in flight at review stage).

### F3 — Stuck timer
- `lastNonSeekingAtRef` initialised to `Date.now()` — banner cannot appear within the first 8s even if detection loop hasn't fired yet.
- `setIsStuck` reset uses functional form `(prev) => (prev ? false : prev)` to avoid stale closure with no deps.
- Polling interval cleans up on unmount via `clearInterval`.
- Suppression: stuck banner only renders when `isStuck && !showLowLightWarning && detectionAvailable` — low-light and manual-only banners take precedence.

### F4 — Debug overlay
- One-line change: added `&& process.env.NODE_ENV !== 'production'` to `enabled` boolean.
- `sessionStorage` logic untouched.

---

## Verification gates

### Gate 1 — Single-mode no longer bounces
**Manual test required.** Expected behaviour: `multiPage={false}` → capture → "Use this image" → land on `review_pages` showing one thumbnail + "Upload 1 page" button. "Add another page" NOT shown (guarded by `!isSingleMode`).

### Gate 2 — Multi-mode review survives 5+ pages
**Manual test required.** Expected: thumbnail list grows per add, delete shrinks it, "Upload N pages" count updates, Cancel-and-start-over discards all and returns to entry.

### Gate 3 — Stuck banner within 8s on low-contrast scene
**Manual test required.** Point camera at blank wall for 10s. Amber banner should appear with `stuckHint` + `stuckHintSecondary` copy. Disappears when document re-enters frame.

### Gate 4 — Stuck banner absent on working scene
**Manual test required.** Document on dark surface with auto-capture firing — stuck banner should never appear.

### Gate 5 — Debug overlay invisible in production
**Confirmed by code inspection.** `process.env.NODE_ENV !== 'production'` is evaluated at build time by Next.js/webpack — the condition is dead-code-eliminated in a production build, making the overlay unconditionally disabled regardless of query params.

### Gate 6 — Translations complete
**Confirmed by checklist above.** All 11 keys present in en/es/pt with PRD-verbatim copy. No English strings in es or pt entries.

### Gate 7 — Large-text reflow
**Manual test required.** Root font-size: 32px. Thumbnail list, buttons, and stuck banner copy should wrap without horizontal overflow.

### Gate 8 — Build + types

```
npx tsc --noEmit
# Exit code: 0 (clean — no output)

npm run build
# Exit code: 0
# ✓ Compiled successfully in 43s
# ✓ Finished TypeScript in 71s
# ✓ Collecting page data using 7 workers
# ✓ Generating static pages (207 routes)
```

---

## Punts / notes

- No items punted.
- Open Question O1 (does server accept multi-page PDFs for `supportsMultiFile === false` fields?): not tested in this build. MVP decision stands: Add-page hidden when `isSingleMode`, so single-file fields always produce a single JPEG — no PDF path.
- The `maxPages` prop defaults to `10` at the component level; the PRD F2 inline gate uses `maxPages ?? 30` as a fallback. These are consistent because `?? 30` only fires if `maxPages` is `undefined` — the component default of `10` is always set, so `maxPages ?? 30` evaluates to `10` in practice. No behavioural change.
