# PRD-47 — PBV Scanner Multi-Page Review, Contrast Feedback, and Debug Overlay Gating

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-scanner-multipage-review-47`
**Status:** Draft — ready for build
**Depends on:** PRD-46 shipped on `dev`. Files this PRD modifies all exist on dev.
**Blocks:** Nothing currently in flight.

---

## Problem Statement

Three issues surfaced from real-device testing of the live-preview scanner on the deployed `dev` build. All three are user-visible, all three damage trust in the flow, and none are fixed by tuning the detection algorithm.

1. **"Use this image" bounces the tenant out of the scanner.** For documents the server treats as single-file (`supportsMultiFile === false`), `commitCurrentPage` immediately calls `finalizeSubmit`, which fires `onComplete`, which uploads and exits the scanner. The tenant never gets a confirmation moment, never sees what they just submitted, and can't add more pages even if the document needs them. From the user's perspective, the flow "jumps back to home" the moment they confirm a capture. This is the worst of the three because it makes the scanner feel broken even when the capture itself succeeded.

2. **No feedback when low contrast is silently breaking detection.** White paper on a light wood floor produces no usable Canny edge — `findPaperContour` returns nothing, `isValidQuad` rejects every frame, the stability tracker never arms, auto-capture never fires. The tenant sees amber corners flash sporadically and assumes the app is broken. The scanner has *no* state where it says "I can see the camera is working but I can't find the document edges — try better contrast or tap to capture anyway." This problem is invisible to staff, blameable on the app by the tenant, and unfixable by the tenant without guidance.

3. **Debug overlay visible to end users.** `DebugErrorOverlay` is gated behind `?debug=1` but the URL parameter can survive across sessions/redirects, and the component renders a green-bordered panel pinned to the bottom of the viewport. Tenants who land on a URL with the flag set see "DEBUG OVERLAY (0)" and three buttons. The component's own comment says "Remove this component once the underlying bug is identified." We're past that point; it should be invisible to anyone outside a dev environment.

Mission-critical context: this scanner is the primary intake path for 77 active applicants this cycle. Most applicants are on phones, many are not technical, many are scanning multi-page documents (court orders, tax returns, lease packets) on whatever surface they have at home. Each rejected scan is a Tess/Kristine phone call. The detection algorithm is the right scope for a future round; this PRD makes the *flow* survive the algorithm's failure modes.

---

## Current state (confirmed 2026-05-19 against `dev`)

| Surface | Path | Notes |
|---|---|---|
| Scanner orchestrator | `components/DocumentScanner/DocumentScanner.tsx` | 712 lines. `multiPage` prop defaults to `true` (line 186), `isSingleMode = !multiPage` (line 204). `commitCurrentPage` (line 337) auto-finalizes when single (line 344-347). Stages already include `review_pages`. |
| Live preview stage | `components/DocumentScanner/LivePreviewStage.tsx` | 280 lines. Has `stabilityState` already exposed by tracker, has `onLowLight` for brightness — but no signal for "stuck in seeking." `performCapture` records `documentDetected: time-since-last-valid-quad < 1.5s` (line 200). |
| Detection loop | `components/DocumentScanner/edgeDetectionLoop.ts` | 260 lines. Off-limits per PRD-46 architecture rule. We add the stuck-timer signal in LivePreviewStage, not here. |
| Stability tracker | `components/DocumentScanner/stabilityTracker.ts` | 103 lines. State shape: `seeking | warming | armed`. We derive "stuck" from time-in-seeking. |
| DocumentCard caller | `components/pbv/cards/DocumentCard.tsx` | Sets `multiPage={supportsMultiFile}` (line 309). `handleScannerComplete` (line ~192) does the upload + advance — *this is what makes the bounce visible*, but the trigger lives in `commitCurrentPage`. |
| Debug overlay | `components/pbv/DebugErrorOverlay.tsx` | 60 lines. Gated by `?debug=1` query param (line 57). Renders as `fixed bottom` panel. Self-described as "remove once bug identified." |
| Translations | `components/DocumentScanner/translations.ts` | Add `stuckHint`, `addPage`, `uploadNPages`, `reviewTitle`, etc. en/es/pt. |

---

## Goals

1. **Always confirm before finalize.** No tenant ever leaves the scanner without an explicit "Upload" action against a visible representation of what they're about to upload — single page or many.
2. **Multi-page review tray.** Tenants scanning long documents (10, 20, 30+ pages) can see their progress, retake bad pages, delete pages, reorder if simple, and only commit when explicitly done.
3. **Contrast/stuck feedback within 8 seconds.** If the scanner can't find a stable document edge for 8 continuous seconds, surface a hint that points to the likely cause (contrast, lighting) and offers a "Capture anyway" path.
4. **Debug overlay invisible to tenants.** Suppress unconditionally in production builds. Keep available in dev when `?debug=1` is set.
5. **No regression to PRD-45 detection pipeline, PRD-46 polish, or existing translations.** Edge detection, stability tracker, FirstScanTooltip, viewport sizing, large-text reflow — all stay.

## Non-Goals

- **No changes to edge detection, stability tracker, or quality gate.** Algorithm-level work is a separate scope (see "Future work" below).
- **No new commercial SDK.** No Scanbot, no Dynamsoft.
- **No page reordering by drag.** Reorder by delete-and-rescan if needed. Phase 2 if real users request it.
- **No swap of `jscanify` for `scanic`.** Library swap is a separate scoped decision; not bundled here.
- **No telemetry / analytics events.** Diagnostic instrumentation (per-frame logging behind `?debug=1`) is out of scope here.
- **No change to server-side document validation.** PDF output from a single-file field is assumed acceptable today (single-page-PDF is a degenerate case of multi-page PDF). If server rejects, gate "Add page" behind `supportsMultiFile` instead — see Open Question O1.

---

## Users & Roles

| Role | What changes |
|---|---|
| Tenant scanning a single-page document (paystub, ID) | Lands on review stage after "Use this image" instead of being bounced. Sees thumbnail + "Upload 1 page" button. One extra tap, but flow is now legible. |
| Tenant scanning a long multi-page document (lease, tax return, court order) | Can add 20+ pages, see each thumbnail, delete bad pages, only finalize when explicitly done. |
| Tenant in a low-contrast scene (white paper, light surface) | Sees a hint within 8 seconds: "Having trouble finding the edges of the document. Try a darker surface or better light, or tap Capture to take the photo manually." Capture-now button (already present) becomes the obvious next move. |
| Tenant on a URL with stale `?debug=1` query param (prod) | No longer sees the debug overlay. |
| Alex / staff debugging on dev with `?debug=1` | Overlay still appears, same behavior as today. |
| Stanton staff | No staff-side UI change. Inbound documents continue to arrive via the same upload path. Multi-page PDFs become more common — already supported by current viewer. |
| HACH reviewers | No change. |

---

## Closed Decisions

1. **Single-mode always goes through `review_pages`.** Removing the `isSingleMode` shortcut in `commitCurrentPage`. Tenants always get a confirmation moment with a visible thumbnail before finalizing. The extra tap is worth the legibility.

2. **"Add page" is always shown in `review_pages`, but only commits multi-page output when supported.** If `supportsMultiFile === true`, "Add page" is enabled and the final upload is a PDF. If `supportsMultiFile === false`, "Add page" is *hidden* — tenant sees only the captured page, "Retake," and "Upload 1 page." This avoids producing PDFs for fields the server may not accept them on. See Open Question O1.

3. **Stuck-timer threshold: 8 seconds in seeking state.** User-confirmed. Resets if any valid quad is detected. Long enough to avoid false positives from normal "moving the phone into position" motion; short enough to surface before the tenant gives up.

4. **Stuck hint is a non-blocking banner, not a modal.** Same visual treatment as the existing `lowLightWarning` banner (amber-on-amber, top of viewport). Disappears when a valid quad is detected again. Tenant can ignore it and keep trying, or use the existing Capture-now button to manually capture.

5. **Stuck hint copy is contrast-focused, not algorithm-focused.** Tenant doesn't need to know what Canny edge detection is; they need to know how to fix the scene. Copy: "Having trouble finding the edges. Try a darker surface or better light." Followed by: "Or tap Capture to take the photo anyway."

6. **Debug overlay double-gated: `?debug=1` AND `NODE_ENV !== 'production'`.** Keeps Alex's dev workflow intact; removes any path for tenants on prod to see it via a stale URL parameter.

7. **Review stage uses a vertical list of thumbnails on mobile, not a horizontal tray.** Mobile-first; horizontal scrolling thumbnail rails are awkward on phones at large text. Vertical list with delete + retake per row. Switch to a grid only on `sm:` breakpoint and up if needed; MVP is vertical list.

8. **No "retake this page" inside review stage in MVP.** Retake = delete + scan again. Adds complexity for a case that's identical to delete + add-page. Revisit if real-user testing shows confusion.

9. **Auto-advance to next document on Upload stays as-is.** PRD-46 / DocumentCard's existing post-success behavior is correct — once the tenant explicitly taps Upload, the flow advances. The bug isn't auto-advance; the bug is *implicit* finalize.

---

## Detailed Changes

### F1 — Always land on `review_pages` after capture commit

**File:** `components/DocumentScanner/DocumentScanner.tsx`

**Change:** Remove the `isSingleMode` shortcut in `commitCurrentPage`. All commits route to `review_pages`.

```tsx
// Before (lines 337-350)
const commitCurrentPage = async () => {
  if (!currentPage) return;
  setPages((prev) => [...prev, currentPage]);
  setCurrentPage(null);
  setQualityOverride(false);
  if (isSingleMode) {
    await finalizeSubmit([...pages, currentPage]);
    return;
  }
  setStage('review_pages');
};

// After
const commitCurrentPage = () => {
  if (!currentPage) return;
  setPages((prev) => [...prev, currentPage]);
  setCurrentPage(null);
  setQualityOverride(false);
  setStage('review_pages');
};
```

`isSingleMode` is still referenced elsewhere (e.g., the button-label switch at line 701, the review_pages "Add page" gating in F2). Don't delete the constant.

**Verification:** capture a page in single mode → land on `review_pages` (not bounced out). Capture a page in multi mode → land on `review_pages` (no change).

---

### F2 — `review_pages` stage: thumbnail list, conditional Add-page, explicit Upload

**File:** `components/DocumentScanner/DocumentScanner.tsx`, `review_pages` stage block.

**Structure:**

```tsx
{stage === 'review_pages' && (
  <div className="space-y-4">
    <h2 className="font-serif text-xl text-[var(--ink)]">
      {t.reviewTitle(pages.length)}
    </h2>
    <p className="text-sm text-[var(--ink-secondary)]">
      {t.reviewHint}
    </p>

    {/* Vertical list of captured pages */}
    <ul className="space-y-3">
      {pages.map((page, idx) => (
        <li key={page.id} className="flex gap-3 items-start border border-[var(--border)] p-3">
          <img
            src={page.previewUrl}
            alt={t.pageNumber(idx + 1)}
            className="w-24 h-32 object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none"
          />
          <div className="flex-1 flex flex-col gap-2">
            <span className="text-sm font-medium">{t.pageNumber(idx + 1)}</span>
            {page.qualityFlags.length > 0 && (
              <span className="text-xs text-amber-700">{t.qualityWarning}</span>
            )}
            <button
              type="button"
              onClick={() => deletePage(page.id)}
              className="text-sm text-[var(--danger)] underline text-left w-fit min-h-12 h-auto py-2"
            >
              {t.deletePage}
            </button>
          </div>
        </li>
      ))}
    </ul>

    {/* Add another page — only when supportsMultiFile */}
    {!isSingleMode && pages.length < (maxPages ?? 30) && (
      <button
        type="button"
        onClick={() => setStage('entry')}
        className="w-full min-h-12 h-auto py-3 border border-[var(--border)] text-[var(--ink)] rounded-none"
      >
        {t.addPage}
      </button>
    )}

    {/* Upload N pages — always shown */}
    <button
      type="button"
      onClick={() => finalizeSubmit(pages)}
      disabled={pages.length === 0}
      className="w-full min-h-12 h-auto py-3 bg-[var(--primary)] text-white rounded-none disabled:opacity-50"
    >
      {pages.length === 1 ? t.uploadOnePage : t.uploadNPages(pages.length)}
    </button>

    {/* Cancel — returns to entry, discards pages */}
    <button
      type="button"
      onClick={() => {
        pages.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        setPages([]);
        setStage('entry');
      }}
      className="w-full min-h-12 h-auto py-3 text-[var(--ink-secondary)] underline rounded-none"
    >
      {t.cancelAndStartOver}
    </button>
  </div>
)}
```

**Notes:**
- If `review_pages` stage already exists in the file, replace it with this structure. The existing implementation likely assumes `multiPage === true`; here we accommodate both.
- "Add page" routes back to `entry` (not directly to `live_preview`) so the tenant gets the permission-prompt fallback path if camera was revoked between captures. The entry stage's primary CTA takes them straight to capture.

---

### F3 — Stuck-detection signal in LivePreviewStage

**File:** `components/DocumentScanner/LivePreviewStage.tsx`

**Change:** Add a "stuck" derived state. The stability tracker already exposes `kind: 'seeking' | 'warming' | 'armed'`. We track the timestamp of the last non-seeking state. If `Date.now() - lastNonSeekingAt > 8000`, we're stuck.

```tsx
// Add near other refs (near line 95)
const lastNonSeekingAtRef = useRef<number>(Date.now());
const [isStuck, setIsStuck] = useState(false);

// Inside the onQuad callback (around line 142), after setStabilityState:
if (state.kind !== 'seeking') {
  lastNonSeekingAtRef.current = Date.now();
  if (isStuck) setIsStuck(false);
}

// Add a separate useEffect that polls the stuck condition once per second.
// We poll rather than derive from the per-frame quad callback because the
// "no quad found" case stops calling onQuad with a non-null quad, and we
// still need to surface the hint.
useEffect(() => {
  const id = setInterval(() => {
    if (Date.now() - lastNonSeekingAtRef.current > 8000) {
      setIsStuck(true);
    }
  }, 1000);
  return () => clearInterval(id);
}, []);
```

**Render the stuck banner** alongside the existing `showLowLightWarning` and `!detectionAvailable` banners (near line 223):

```tsx
{isStuck && !showLowLightWarning && (
  <div className="absolute top-4 left-4 right-4 z-40 bg-amber-100/95 border border-amber-300 px-4 py-3 rounded-none">
    <p className="text-sm text-amber-900 leading-snug">{t.stuckHint}</p>
    <p className="text-xs text-amber-900/80 mt-1 leading-snug">{t.stuckHintSecondary}</p>
  </div>
)}
```

**Suppression rules:**
- Don't show stuck banner if `showLowLightWarning` is already up (low light is a more specific signal and takes precedence).
- Don't show stuck banner if `!detectionAvailable` (we've fallen back to manual-only; the existing "Auto-detect unavailable" banner already covers it).
- Reset `isStuck` immediately when a valid quad arrives (already wired via `state.kind !== 'seeking'`).

**Translation strings** (en / es / pt):

| Key | en | es | pt |
|---|---|---|---|
| `stuckHint` | Having trouble finding the document edges. | No encuentro los bordes del documento. | Não consigo encontrar as bordas do documento. |
| `stuckHintSecondary` | Try a darker surface or better light. Or tap Capture below to take the photo anyway. | Intenta una superficie más oscura o mejor luz. O toca Capturar para tomar la foto de todos modos. | Tente uma superfície mais escura ou melhor iluminação. Ou toque em Capturar para tirar a foto mesmo assim. |

---

### F4 — Debug overlay: double-gate behind NODE_ENV

**File:** `components/pbv/DebugErrorOverlay.tsx`

**Change:** Add a second gate so the overlay is unconditionally off in production builds.

```tsx
// Inside DebugErrorOverlayInner, replace:
const enabled = search?.get('debug') === '1';

// With:
const enabled =
  search?.get('debug') === '1' &&
  process.env.NODE_ENV !== 'production';
```

**Rationale:** keeps Alex's dev workflow intact; eliminates any path for tenants on prod to surface it via a stale URL parameter. The component code stays in the tree for the next time a device-side error capture is needed — turning it back on is a one-line revert plus a redeploy to a non-prod env.

**Note on the existing `sessionStorage` entries:** if a tenant has stale entries from a prior session where the overlay was visible, those entries remain in `sessionStorage` but are now never rendered. They'll be cleared next time the tab is closed. No migration needed.

---

### F5 — Translation strings for review stage

**File:** `components/DocumentScanner/translations.ts`

**Add** the following keys to en / es / pt. Some are functions for pluralization.

| Key | en | es | pt |
|---|---|---|---|
| `reviewTitle(n)` | `Review your ${n} page${n===1?'':'s'}` | `Revisa tu${n===1?'':'s'} ${n} página${n===1?'':'s'}` | `Revise sua${n===1?'':'s'} ${n} página${n===1?'':'s'}` |
| `reviewHint` | Tap Upload when you're done. Add more pages if the document continues. | Toca Subir cuando termines. Agrega más páginas si el documento continúa. | Toque em Enviar quando terminar. Adicione mais páginas se o documento continuar. |
| `pageNumber(n)` | `Page ${n}` | `Página ${n}` | `Página ${n}` |
| `deletePage` | Delete this page | Eliminar esta página | Excluir esta página |
| `addPage` | Add another page | Agregar otra página | Adicionar outra página |
| `uploadOnePage` | Upload 1 page | Subir 1 página | Enviar 1 página |
| `uploadNPages(n)` | `Upload ${n} pages` | `Subir ${n} páginas` | `Enviar ${n} páginas` |
| `cancelAndStartOver` | Cancel and start over | Cancelar y empezar de nuevo | Cancelar e começar de novo |
| `qualityWarning` | Photo may be hard to read. Consider retaking. | La foto puede ser difícil de leer. Considera volver a tomarla. | A foto pode estar difícil de ler. Considere refazer. |
| `stuckHint` | Having trouble finding the document edges. | No encuentro los bordes del documento. | Não consigo encontrar as bordas do documento. |
| `stuckHintSecondary` | Try a darker surface or better light. Or tap Capture below to take the photo anyway. | Intenta una superficie más oscura o mejor luz. O toca Capturar para tomar la foto de todos modos. | Tente uma superfície mais escura ou melhor iluminação. Ou toque em Capturar para tirar a foto mesmo assim. |

**Existing keys to verify / reuse:** `cancel`, `useThis`, `useThisPage`, `retake`, `lowLightWarning`. These were added in PRD-45/46 — leave them alone.

---

## Architecture Rules

1. **No detection-pipeline changes.** `edgeDetectionLoop.ts`, `stabilityTracker.ts`, `QuadOverlay.tsx`, `usePermissionPrompt.ts`, `quality.ts` are off-limits.
2. **No new dependencies.**
3. **All new user-facing strings via `translations.ts`.** Zero hardcoded English.
4. **No `localStorage` / `sessionStorage` introduced by this PRD.** (The existing `sessionStorage` in `DebugErrorOverlay.tsx` stays as-is — it's gated dead code in prod after F4.)
5. **Tailwind only, no custom CSS.** Match PRD-46's style (`rounded-none`, var-based colors, stacked buttons at narrow viewports).
6. **No new files.** All changes in existing files. The review stage block lives inline in `DocumentScanner.tsx`.
7. **Polling interval in F3 must clean up on unmount.** The `setInterval` for the stuck timer must be cleared in the effect cleanup. Memory leaks during repeated mount/unmount of LivePreviewStage are a real concern at the volume Tess/Kristine see.

---

## Verification Gates

Build is not done until all of the following pass. Chrome devtools mobile emulation acceptable for Gates 1-5; Gate 6 requires a real iPhone test or staging URL.

### Gate 1 — Single-mode no longer bounces

- Set `multiPage={false}` on the scanner (or pick a doc field with `supportsMultiFile === false`).
- Walk: entry → capture → preview → tap "Use this image."
- **Pass:** land on `review_pages` stage showing one thumbnail. Buttons visible: "Upload 1 page" and "Cancel and start over." "Add page" NOT shown.
- Tap "Upload 1 page" → finalizeSubmit fires → `onComplete` fires → existing post-upload flow (which is what bounces back to home). That's expected.

### Gate 2 — Multi-mode review survives 5+ pages

- Set `multiPage={true}`.
- Walk: capture page 1 → review → Add page → capture page 2 → ... up to 5 pages.
- **Pass:** thumbnail list grows. Each thumbnail tappable area has delete-this-page link. "Upload 5 pages" button works → finalizeSubmit produces a PDF → upload succeeds.
- Delete a page → list shrinks → Upload N pages count updates.
- Cancel-and-start-over → all pages discarded, return to entry.

### Gate 3 — Stuck banner appears within 8s on a low-contrast scene

- Point camera at a low-contrast surface (white paper on white desk, or just blank wall).
- **Pass:** within 8-10 seconds, amber banner appears with `stuckHint` and `stuckHintSecondary` copy. Manual Capture-now button still visible and functional. Tapping it captures a frame.
- Move camera over a high-contrast document → banner disappears within ~1s.

### Gate 4 — Stuck banner does not appear on a working scene

- Point camera at a document on a dark surface, with corners visible and stable.
- **Pass:** detection loop arms within ~2-3s, auto-capture fires. Stuck banner never appears. (If it did, `isStuck` reset logic is broken.)

### Gate 5 — Debug overlay invisible in production

- Build the app with `NODE_ENV=production` (or check on the prod Vercel URL).
- Navigate to a tenant URL with `?debug=1` appended.
- **Pass:** no green-bordered "DEBUG OVERLAY" panel anywhere on the page. Page renders as if the query parameter were absent.
- Sanity check the other direction: in dev (`npm run dev`), with `?debug=1`, the overlay is still visible.

### Gate 6 — Translations complete

- Set scanner `language` prop to `es` and `pt` in turn.
- Walk: capture → review_pages with 2 pages → stuck scene (or trigger the stuck banner manually by holding camera at a wall).
- **Pass:** all new strings localized. No English text in either Spanish or Portuguese walk.

### Gate 7 — Large-text reflow (regression check)

- Set root font-size: 32px (200%).
- Walk: capture → review with 3 pages → delete page → upload.
- **Pass:** thumbnails legible, buttons not overlapping, delete-page links tappable, no horizontal overflow. Stuck banner copy wraps cleanly when triggered.

### Gate 8 — Build + types

- `npx tsc --noEmit` passes.
- `npm run build` passes.
- No new lint errors.

---

## Out of Scope (do not touch)

- Edge detection algorithm tuning (Canny params, adaptive threshold, morphology).
- Swapping jscanify for an alternative library (Scanic, OpenCV.js direct).
- Per-frame diagnostic logging (`?debug=1` instrumentation in the detection loop).
- `FormPhotoUpload.tsx` — different component, different forms.
- Server-side multi-page PDF validation. If a field is rejecting PDFs it shouldn't, that's a separate fix; see Open Question O1.
- Auto-advance behavior between documents (PRD-46 scope, working as designed).
- FirstScanTooltip behavior.
- Any change to the PBV full app form (`app/pbv-full-app/[token]/page.tsx`).
- HACH reviewer surfaces, staff workspace surfaces.

---

## Phasing

**Single phase, single merge.** All five changes are scoped to four files; verification surface is shared. F1-F2 (multi-page review) are coupled. F3 (stuck timer) is independent. F4 (debug gate) is one line. F5 (translations) supports F1-F3.

Estimated Windsurf time: 4-7 hours including verification gates.

---

## Open Questions

| ID | Question | Owner | Blocker? |
|---|---|---|---|
| O1 | Does the server accept multi-page PDFs for fields where `supportsMultiFile === false`? If not, the F2 "Add page hidden when isSingleMode" decision is sufficient. If it does, we could reconsider always showing "Add page." | Alex | No — MVP hides Add-page when single. Safer default. |
| O2 | Should `maxPages` default move from 30 to something higher? Some PBV documents legitimately approach 50 pages (full lease packets with addenda). | Alex | No — 30 stays as MVP cap, raise later if real submissions hit it. |
| O3 | Should "Cancel and start over" from `review_pages` require confirmation, given a tenant might have captured 20 pages? | Alex | No — MVP no confirmation. Add a `confirm()` modal if real users hit "lost all my pages" once. |
| O4 | Should the stuck banner timeout be configurable per environment (e.g., shorter on dev for testing)? | Build agent | No — 8s hardcoded as agreed. |
| O5 | Should DebugErrorOverlay be removed entirely rather than double-gated? | Alex | No — keep it gated for the next device-side bug we can't reproduce in DevTools. Cost of keeping the file is near zero. |

---

## Future work (out of scope here, but documented for the next PRD)

- **Detection algorithm rework.** The real fix for low-contrast scenes is adaptive thresholding + morphology, not Canny. Two paths: (a) replace jscanify with a custom OpenCV.js pipeline, or (b) swap to `marquaye/scanic` (Rust/WASM, ~100KB vs OpenCV's 9MB, maintained). Either is a multi-day scope and benefits from per-frame instrumentation first.
- **Per-frame diagnostic logging behind `?debug=1`.** Log every frame whether jscanify returned a contour, the raw quad, the validation result. Currently we're guessing which failure mode the algorithm hits on a real scene.
- **Retake-this-page from review stage.** Single-action retake without delete-then-rescan. Surface depends on user feedback after MVP ships.
- **High-contrast "trace your document" guide overlay.** Render a dashed rectangle hint at the expected document position. Helps tenants frame the shot before the algorithm sees it.
