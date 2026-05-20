# PRD-48 — PBV Scanner: Scanic Detection-Library Pilot

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-scanner-scanic-pilot-48`
**Status:** Draft — exploratory pilot, ready for build
**Depends on:** None directly; branches off `dev` in parallel to PRD-47. The two PRDs touch overlapping files (`LivePreviewStage.tsx`, `DocumentScanner.tsx`) so the merge order matters — see "Branch strategy" below.
**Blocks:** Nothing. This is a parallel exploration; outcome informs a later go/no-go decision.

---

## Problem Statement

The current scanner pipeline uses [`jscanify`](https://github.com/puffinsoft/jscanify) (a hobby OpenCV.js wrapper) over a remote-loaded 9-30MB OpenCV.js bundle from `docs.opencv.org`. Two structural problems:

1. **Low-contrast detection failure.** jscanify uses Canny edge detection without adaptive thresholding. On real-world surfaces (white paper on light wood floor, the actual home environment of half the applicant pool), Canny fails to find usable edges → `findPaperContour` returns nothing → tenant sees flashing amber corners and the scanner never auto-captures. PRD-47 addresses this at the *flow* level (stuck banner, manual capture). PRD-48 addresses it at the *algorithm* level by piloting a library that claims robust detection in low-contrast environments.

2. **9MB+ OpenCV.js download on every first scan.** Even with browser cache, cellular tenants hit a multi-second blank screen before detection becomes available. The dependency lives on a third-party CDN we don't control and have no fallback for.

[Scanic](https://github.com/marquaye/scanic) is a maintained alternative explicitly built as a jscanify replacement: Rust+WebAssembly core, ~100KB total gzipped (vs ~9MB OpenCV.js), Promise-based TypeScript API, GPU-accelerated perspective transform, and (per the README) "robust document contour detection even in low-contrast environments." It is inspired by jscanify and solves the same problem with a different engine.

This PRD is a **pilot**, not a commitment. We integrate Scanic on a parallel branch, leave the jscanify path intact, and compare side-by-side on real test scenes before deciding which to merge to `dev`. The outcome of the pilot is a build report with measured comparisons, not a finished migration.

---

## Why a pilot, not a swap

- **Algorithm risk:** Scanic claims better low-contrast performance, but we have not verified on our scenes (wood floors, indoor lighting, multilingual tenant phones). The cost of swapping wholesale without measurement is high — we could end up with a different broken detector and no fallback.
- **Maturity risk:** Scanic has 24 GitHub stars, 3 forks, single maintainer (marquaye), released v1.0.6 in Jan 2026. The library is well-engineered but small. Bus-factor is real. We want to confirm the swap is worth taking on that risk profile.
- **Side-by-side, not before/after:** A pilot branch makes it possible to demo the same test scenes on both implementations to Tess/Kristine and decide on evidence.
- **Reversibility:** if Scanic regresses on something jscanify gets right (e.g., specific edge cases, mobile Safari behavior, certain phone cameras), we keep the old branch and don't merge.

---

## Current state (confirmed 2026-05-19 against `dev`)

| Surface | Path | Notes |
|---|---|---|
| OpenCV.js loader | `LivePreviewStage.ensureOpenCvLoaded` (lines 22-52) | Loads from `https://docs.opencv.org/4.x/opencv.js`, attaches as script tag. ~9MB. |
| jscanify loader | `LivePreviewStage.ensureJscanifyLoaded` (lines 54-68) | Dynamic `import('jscanify/client')`. Caches instance globally on `window.__jscanifyInstance`. |
| Live detection loop | `edgeDetectionLoop.startDetectionLoop` (260 lines) | RAF-driven, 8fps. Calls `jscanify.findPaperContour` + `getCornerPoints` per frame. Synchronous. |
| Still-image extraction | `DocumentScanner.processImageBlob` (lines 263-272) | Calls `jscanify.extractPaper(image, w, h)` on the captured still. |
| Quality evaluation | `DocumentScanner/quality.ts` | **Pure canvas/ImageData — no OpenCV dependency.** Good news; quality eval survives any swap. |
| Quad type | `edgeDetectionLoop.Quad` (lines 3-8) | `{ topLeft, topRight, bottomLeft, bottomRight }` — same shape Scanic returns. Trivial mapping. |
| `isValidQuad` filter | `edgeDetectionLoop.isValidQuad` (lines 47-89) | Keeps: aspect ratio, area ratio, edge proximity, opposing-side symmetry. Library-agnostic — survives the swap unchanged. |

---

## Scanic API (confirmed 2026-05-19 from README)

```ts
import { Scanner } from 'scanic';

const scanner = new Scanner();
await scanner.initialize(); // pre-loads WASM, optional but recommended

const result = await scanner.scan(imageOrCanvas, {
  mode: 'detect' | 'extract',
  output: 'canvas' | 'imagedata' | 'dataurl',
  maxProcessingDimension: 800,
  lowThreshold: 75,
  highThreshold: 200,
  minArea: 1000,
});

// result shape:
// {
//   success: boolean,
//   corners: { topLeft, topRight, bottomRight, bottomLeft },
//   output: HTMLCanvasElement | ImageData | string,
//   contour: Array<{x, y}>,
//   timings: Array<{name, ms}>,
//   message: string,
// }
```

**Key properties:**
- `Scanner` class maintains a persistent WASM instance — recommended for real-time / batch.
- `scan` is async (Promise). Cannot be called synchronously in a RAF loop without flow-control.
- `corners` shape matches our existing `Quad` interface (different naming: `bottomRight` vs jscanify's `bottomRightCorner`).
- Bundle: ~100KB gzipped including WASM blob. Loaded via `npm install scanic`.

---

## Goals

1. **Add Scanic as a peer detector to jscanify.** Both implementations live in the codebase, behind a flag. Pilot branch defaults to Scanic; main `dev` (after PRD-47) defaults to jscanify.
2. **Measurable comparison on real scenes.** Build report includes side-by-side detection results on at least 5 test scenes: high-contrast (paper on dark desk), low-contrast (paper on wood/light surface), uneven lighting (window behind document), busy background (paper on patterned tablecloth), and the worst real-world scene Alex can reproduce.
3. **Eliminate OpenCV.js entirely on the Scanic branch.** No remote 9MB script load, no `docs.opencv.org` dependency. Scanic ships its own WASM.
4. **No regression to PRD-47's review-stage or stuck-timer behavior.** PRD-47 changes are orthogonal to detection — both should compose cleanly with either detector.
5. **Build report drives the decision.** Acceptance for this PRD is "we have enough data to choose." Not "we ship Scanic." Whether to merge is a separate decision after we see the results.

## Non-Goals

- **No commitment to ship Scanic.** Outcome may be "Scanic is worse on our scenes, keep jscanify, archive the branch."
- **No removal of jscanify code on this branch.** Keep both pathways in source. We can prune after the decision.
- **No detection-loop architecture rewrite.** Same RAF cadence, same `isValidQuad` filter, same stability tracker. Only the per-frame "ask the library for corners" call changes.
- **No quality.ts changes.** It's library-agnostic already.
- **No PRD-47 work on this branch.** That stacks on a separate branch and merges to `dev` independently. The post-merge order will determine which gets the rebase pain.
- **No automated regression tests on test images.** Scanic ships with one internally; we don't add ours here. Manual A/B suffices for pilot scope.
- **No new dependencies beyond Scanic.** No `jsdom`, no `node-canvas` — the Node.js usage path is irrelevant for our browser-only app.
- **No bundle-analyzer rework.** Just confirm via `npm run build` output that the OpenCV.js script tag is gone and bundle size dropped.

---

## Users & Roles

| Role | What changes on the pilot branch |
|---|---|
| Tenant on cellular, fresh visit | First scanner open is dramatically faster (no 9MB OpenCV.js fetch). Detection may be more reliable on low-contrast scenes. |
| Tenant in low-contrast scene | If Scanic claims hold, detection actually fires and auto-captures. PRD-47's stuck banner appears later or not at all. |
| Tenant in high-contrast scene | Should see no regression. Same auto-capture experience. |
| Alex / staff doing the A/B comparison | Can flip a query parameter or env flag to switch detectors on the same build, capture screenshots / videos for the build report. |
| Stanton staff | No user-facing change. Same uploads, same review flow. |
| HACH reviewers | No change. |

---

## Closed Decisions

1. **Branch parallel to PRD-47, both off `dev`.** Not stacked. The two PRDs touch overlapping files; whichever lands second will rebase. If PRD-47 lands first (more likely — it's smaller and lower-risk), PRD-48 rebases onto the post-PRD-47 `dev`. PRD-48's review-stage edits are limited to a small section of `LivePreviewStage.tsx` and `DocumentScanner.tsx.processImageBlob` — rebase should be straightforward.

2. **Detector swap is in `LivePreviewStage.tsx` + `edgeDetectionLoop.ts` + `DocumentScanner.processImageBlob`.** These are the only three surfaces touching jscanify/OpenCV. quality.ts is library-agnostic; we leave it.

3. **Keep both paths in source, gated by env flag.** Read `NEXT_PUBLIC_SCANNER_DETECTOR` (or fall back to a query parameter `?scanner=scanic` for ad-hoc testing). Default on the pilot branch: `scanic`. Default on `dev`: `jscanify`. This makes the A/B switchable without redeploys, and the cleanup-by-deletion happens after the decision.

4. **`new Scanner()` is a module-level singleton.** Same shape as the existing `window.__jscanifyInstance` cache. One initialization per page load, shared across mount/unmount of the scanner UI. Avoids re-fetching WASM on every camera-open.

5. **RAF loop handles async detection with an `inFlight` gate.** When the current `scanner.scan()` Promise has not resolved, we skip queuing another one — drop the frame. Keeps the RAF cadence reasonable without stacking promises. Same target 8fps; expect actual achieved fps lower for the first 1-2 frames while WASM warms.

6. **Detection mode for live loop: `mode: 'detect'`.** We only need corners during the live loop. Extraction happens once on the captured still in `processImageBlob`. Saves per-frame work.

7. **maxProcessingDimension stays at the default (800).** Scanic downscales internally; matches the ~1280px downscale the current `edgeDetectionLoop` does in `drawImage`. We can skip the manual downscale on the Scanic path (Scanic does it).

8. **`isValidQuad` filter stays on.** Even with a different detector, we want to reject background-spanning, tiny, or skewed quads. The same heuristics apply.

9. **No "fallback to jscanify on Scanic failure" at runtime.** If Scanic fails to load on the pilot branch, we fall back to file-picker mode (same as today's "detection unavailable" path). Adding a runtime detector-fallback complicates the comparison without serving the pilot goal.

10. **The A/B switch is binary, build-time-default + URL-override.** Not a per-session-remembered preference. We don't need a UI toggle; this is for staff testing, not tenant-facing.

---

## Detailed Changes

### F1 — Add Scanic dependency

**File:** `package.json`

Add: `"scanic": "^1.0.6"` (or current latest stable) to `dependencies`.

Run `npm install scanic` once locally to lock to a specific version in `package-lock.json`. Do not run multiple times in CI — see shell protocol in the build prompt.

---

### F2 — Detector abstraction

**New (logical, not necessarily a new file) — inline in `edgeDetectionLoop.ts`:**

Introduce a `DetectorAdapter` interface that both implementations conform to. The detection loop talks to the adapter, not the underlying library.

```ts
export interface DetectorAdapter {
  detect: (canvasOrVideo: HTMLCanvasElement | HTMLVideoElement) => Promise<Quad | null>;
  extract: (image: HTMLImageElement) => Promise<HTMLCanvasElement | null>;
  /** Tells the loop whether per-frame `detect` is synchronous (jscanify) or async (scanic) */
  isAsync: boolean;
}
```

Two implementations:
- `createJscanifyAdapter(jscanify, openCvMat)` — wraps the existing logic.
- `createScanicAdapter(scanner)` — wraps `scanner.scan(input, { mode: 'detect' })` and maps `result.corners` → `Quad`.

**Inline both in `edgeDetectionLoop.ts`** to keep the file count flat. The RAF loop branches on `adapter.isAsync`:
- Async (Scanic): if `inFlight === true`, skip; else set `inFlight = true`, await `adapter.detect(...)`, then call `onQuad`, then `inFlight = false`.
- Sync (jscanify): existing synchronous path.

This keeps both detectors operational, swappable by which adapter the loop receives.

---

### F3 — `LivePreviewStage.tsx` detector selection + load

**File:** `components/DocumentScanner/LivePreviewStage.tsx`

Replace `ensureOpenCvLoaded` + `ensureJscanifyLoaded` with a single `ensureDetectorLoaded` that returns a `DetectorAdapter`:

```ts
async function getDetectorChoice(): Promise<'scanic' | 'jscanify'> {
  // 1. URL param overrides everything (staff testing)
  if (typeof window !== 'undefined') {
    const search = new URL(window.location.href).searchParams;
    const param = search.get('scanner');
    if (param === 'scanic' || param === 'jscanify') return param;
  }
  // 2. Build-time env default
  const envDefault = process.env.NEXT_PUBLIC_SCANNER_DETECTOR;
  if (envDefault === 'scanic') return 'scanic';
  return 'jscanify'; // default
}

async function ensureDetectorLoaded(): Promise<DetectorAdapter> {
  const choice = await getDetectorChoice();
  if (choice === 'scanic') {
    const { Scanner } = await import('scanic');
    // Module-level singleton on window
    const w = window as unknown as { __scanicInstance?: InstanceType<typeof Scanner> };
    if (!w.__scanicInstance) {
      w.__scanicInstance = new Scanner();
      await w.__scanicInstance.initialize();
    }
    return createScanicAdapter(w.__scanicInstance);
  }
  // existing jscanify path
  await ensureOpenCvLoaded();
  const jscanify = await ensureJscanifyLoaded();
  return createJscanifyAdapter(jscanify);
}
```

The detection-loop call signature changes from passing `jscanify` to passing the adapter.

---

### F4 — `edgeDetectionLoop.ts` async path

**File:** `components/DocumentScanner/edgeDetectionLoop.ts`

Add an `inFlight` flag scoped to the loop. Inside the RAF callback, branch:

```ts
if (adapter.isAsync) {
  if (inFlight) return;
  inFlight = true;
  adapter.detect(offscreenCanvas)
    .then((quad) => {
      if (!state.isRunning) return;
      const validated = quad && isValidQuad(quad, offscreenCanvas.width, offscreenCanvas.height) ? quad : null;
      const scaled = validated ? scaleQuadBack(validated, scale) : null;
      onQuad(scaled);
    })
    .finally(() => {
      inFlight = false;
    });
} else {
  // existing synchronous jscanify path
}
```

Important: `inFlight` must not be conflated with the per-frame brightness / low-light check, which stays synchronous and runs every frame regardless.

---

### F5 — `DocumentScanner.processImageBlob` still extraction

**File:** `components/DocumentScanner/DocumentScanner.tsx`, lines 254-305.

Replace the inline `jscanify.extractPaper` call with the adapter's `extract` method:

```ts
const adapter = await ensureDetectorLoaded();
const extracted = await adapter.extract(image);
finalCanvas = extracted ?? (() => {
  const c = document.createElement('canvas');
  c.width = image.naturalWidth;
  c.height = image.naturalHeight;
  c.getContext('2d')?.drawImage(image, 0, 0);
  return c;
})();
```

Use the same fallback logic the file currently has — if extract returns null/throws, draw the raw image to the canvas and proceed. The quality flag `no_document_detected` already covers this case downstream.

---

### F6 — Remove `<script src="https://docs.opencv.org/4.x/opencv.js">` injection when Scanic is the active detector

The injection happens lazily inside `ensureOpenCvLoaded`. As long as `ensureOpenCvLoaded` is never called on the Scanic branch (it isn't — the adapter selection bypasses it), no script tag is inserted. Verify in the build report by:
1. Opening the scanner with Scanic active
2. Confirming no network request to `docs.opencv.org` in DevTools network tab

If, contrary to expectations, OpenCV.js still loads (because some other code path imports it eagerly), open an issue and document — do not silently work around.

---

### F7 — Build report: side-by-side comparison

**File:** `docs/build-reports/48-pbv-scanner-scanic-pilot_build-report_2026-05-19.md`

The build report for this PRD is the deliverable. It must include:

1. **Same-scene comparison** at 5 scenes, both detectors. For each scene:
   - Screenshot of the live preview with both detectors active in turn (`?scanner=jscanify` then `?scanner=scanic`).
   - Whether auto-capture fired, how many seconds it took, whether the final captured image is well-cropped.
2. **Bundle size delta.** `npm run build` output with each detector default, byte-for-byte comparison of the relevant chunks. Estimated network bytes saved per first-time scanner open.
3. **First-paint to detection-ready latency** on a throttled "Fast 3G" Chrome profile. Both detectors.
4. **Failure modes observed.** Scenes where Scanic fails but jscanify succeeds, and vice versa. Honest.
5. **Recommendation.** "Merge Scanic to dev, defaults to Scanic" / "Keep jscanify as default, archive the branch" / "Both, with runtime fallback (a follow-up PRD)."

---

## Architecture Rules

1. **All Scanic usage goes through `DetectorAdapter`.** No direct `scanner.scan(...)` calls in `LivePreviewStage.tsx`, `DocumentScanner.tsx`, or anywhere else. Easier to swap, easier to mock.
2. **The detection loop is still off-limits for non-detector changes.** Stability tracker, FirstScanTooltip, quality eval, QuadOverlay — untouched.
3. **No new files.** Adapters live inline in `edgeDetectionLoop.ts`. Detector-selection helper lives inline in `LivePreviewStage.tsx`.
4. **No `localStorage` / `sessionStorage`.** The URL-param-or-env-default pattern is stateless.
5. **TypeScript:** Scanic ships types — use them, don't `as any`. Add `unknown`/`as` only at the very boundary between Scanic's result and our `Quad` interface, and even there prefer a narrow cast.
6. **No analytics / telemetry.** The build report is the only data capture for this pilot.

---

## Verification Gates

### Gate 1 — Both detectors load and render the live preview

- `?scanner=jscanify` → existing behavior, OpenCV.js + jscanify load.
- `?scanner=scanic` → Scanic loads via dynamic import, OpenCV.js does NOT load (verify in Network tab — no request to `docs.opencv.org`).
- Both modes show the live video feed with the amber/green quad overlay when a document is in frame.

### Gate 2 — Auto-capture fires on a clean scene with both detectors

- Same physical document on a dark desk, well-lit.
- `?scanner=jscanify` → auto-capture fires within ~3-5s. Screenshot before, screenshot after.
- `?scanner=scanic` → auto-capture fires within ~3-5s. Screenshot before, screenshot after.
- Both produce a reasonably-cropped output image. Compare side-by-side.

### Gate 3 — Low-contrast comparison

- Same physical document on a light wood floor (or whatever the worst real-world scene Alex can reproduce).
- Both detectors. Record:
  - Seconds to first valid quad.
  - Whether auto-capture fired at all within 30 seconds.
  - Quality of the final crop.
- This is the main signal. If Scanic substantially outperforms jscanify here, the pilot validates. If it doesn't, the pilot is still useful (we know).

### Gate 4 — Bundle size

- `npm run build` with `NEXT_PUBLIC_SCANNER_DETECTOR=jscanify`, capture the relevant chunk sizes.
- `npm run build` with `NEXT_PUBLIC_SCANNER_DETECTOR=scanic`, capture again.
- Note in build report: total bytes shipped to the client for the scanner code path, including dynamic-imported chunks.
- Separately note the *runtime* network savings: ~9MB OpenCV.js does NOT download on the Scanic path. This is the bigger win for cellular tenants and won't show in the build output.

### Gate 5 — Throttled-network first-paint to detection-ready

- Chrome DevTools → Network → Fast 3G throttling.
- Cold open of the scanner with `?scanner=jscanify` — measure time from "Scan document" tap to first quad overlay drawn.
- Cold open with `?scanner=scanic` — same measurement.
- Record both in build report.

### Gate 6 — Still-image extraction (post-capture)

- Capture any document with each detector.
- The `processImageBlob` path should produce a cropped/warped canvas with either adapter. Verify the preview stage shows a cropped image, not the raw frame.

### Gate 7 — No regression to existing translations / UI

- Spanish + Portuguese walkthroughs unchanged with both detectors.
- FirstScanTooltip still fires.
- Quality flags (blur/dark/low-res) still surface — quality.ts is library-agnostic.

### Gate 8 — Type check and build

- `npx tsc --noEmit` passes cleanly with the new adapter shapes and Scanic types.
- `npm run build` passes cleanly.

### Gate 9 — PRD-47 composability

- Apply (or rebase from) PRD-47's changes (multi-page review, stuck timer, debug overlay gate). With Scanic active, verify:
  - Review stage works after capture.
  - Stuck timer still fires when detection genuinely stalls (test on an extreme low-contrast scene Scanic can't handle either).
  - Debug overlay still gated.

---

## Out of Scope (do not touch)

- `stabilityTracker.ts`
- `QuadOverlay.tsx`
- `usePermissionPrompt.ts`
- `FirstScanTooltip.tsx`
- `quality.ts`
- `FormPhotoUpload.tsx`
- Any file under `app/`
- Any migration file
- `DocumentCard.tsx`
- Server-side processing
- Removing jscanify code (post-decision cleanup is a future PRD if Scanic wins)

---

## Branch strategy

| Branch | Base | Purpose |
|---|---|---|
| `feat/pbv-scanner-multipage-review-47` | `dev` | PRD-47 work (flow + review tray + stuck banner + debug gate) |
| `feat/pbv-scanner-scanic-pilot-48` | `dev` | This PRD — Scanic detector adapter pilot |

The two branches diverge at `dev`'s current tip. Both modify `LivePreviewStage.tsx` and `DocumentScanner.tsx`. Recommended merge order: PRD-47 first (smaller, lower risk, ready to ship). PRD-48 rebases onto the post-47 `dev`. Conflict resolution focuses on:
- `LivePreviewStage.tsx`: PRD-47 adds stuck-timer state; PRD-48 changes the loader and detection-call shape. Keep PRD-47's stuck state, splice in PRD-48's adapter wiring.
- `DocumentScanner.tsx`: PRD-47 changes `commitCurrentPage` and `review_pages` stage; PRD-48 changes `processImageBlob`. Different sections of the file. Should be a clean rebase.

---

## Phasing

**Single phase, single branch.** All five code changes (F1-F5) plus the build report (F7) compose into one PR. The PR is *not* automatically merged — its purpose is to land the pilot for review. Merge-or-not is a follow-up decision based on the build report.

Estimated Windsurf time: 6-10 hours including the build report comparison work. The bulk of the time is the side-by-side comparison and bundle measurement, not the code change.

---

## Open Questions

| ID | Question | Owner | Blocker? |
|---|---|---|---|
| O1 | Is Scanic's `Scanner.initialize()` cheap enough to call eagerly on page load (improves first-scanner-open latency), or should we only initialize when the scanner is actually opened (lazier, but adds 1-2s to first scan)? | Build agent — pick one and document in the build report. Likely lazy is fine for MVP. | No |
| O2 | Does Scanic's WASM blob get cached cleanly across navigations within Next.js? If it re-downloads on every route change, that's a regression we'd need to address before merging. | Build agent — verify via Network tab. | No |
| O3 | Should the URL parameter `?scanner=scanic` survive page navigations or be one-shot? | Alex | No — one-shot, set by staff for testing only. Tenant URLs never include it. |
| O4 | If Scanic outperforms jscanify but only marginally, is the dependency-swap worth the 24-stars / single-maintainer risk? | Alex (post-build) | No — decision after seeing the build report. |
| O5 | Does `npm install scanic` succeed in the Windsurf shell environment without timeouts? (Newer packages occasionally have heavy postinstall steps.) | Build agent — note in build report if `npm install` requires retries. | No — has fallback per shell protocol. |

---

## Decision criteria (post-pilot)

After the build report lands, evaluate against these criteria for the merge-or-not call:

1. **Low-contrast scene performance:** does Scanic auto-capture on scenes where jscanify silently fails? *This is the primary criterion.* If yes → strong merge signal. If no → keep jscanify.
2. **First-paint-to-detection latency on Fast 3G:** Scanic should be substantially faster (no 9MB OpenCV.js). If it's within 10% of jscanify, the bundle-size argument alone isn't enough to merge.
3. **No regression in high-contrast scenes:** Scanic must perform at least as well as jscanify on the cases jscanify already handles.
4. **Stability over a 5-minute live preview:** Scanic's WASM doesn't crash, leak, or degrade. Run the live preview for 5 minutes pointed at a document and verify the framerate doesn't drop and the page doesn't OOM.
5. **Type-check + build clean across both detectors.** Already a verification gate, but specifically relevant for the decision.

If all five hold → merge Scanic, default to Scanic, plan a follow-up PRD to remove jscanify + OpenCV.js entirely.
If only 1, 3, 5 hold and 2 doesn't → still likely merge, but keep jscanify as a runtime fallback (follow-up PRD).
If 1 fails → archive the branch, keep jscanify, revisit when Scanic has a stronger track record.
