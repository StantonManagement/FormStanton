# PRD-52 — Ship Scanic as the Document Detector (Replace jscanify + OpenCV.js)

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-scanner-scanic-ship-52`
**Status:** Draft — ready for build
**Depends on:** `main` post-launch-merge (`7200a25` or later).
**Blocks:** Nothing. Supersedes PRD-48 (Scanic pilot) — pilot is replaced by this commit-and-ship PRD.

---

## Problem Statement

The current document scanner depends on:

1. **OpenCV.js** loaded from `https://docs.opencv.org/4.x/opencv.js` — a ~9MB download from a third-party CDN, fetched on every first scanner-open per device. For applicants on cellular this is the single worst network hit in the flow: blank screen for 5-10+ seconds before the camera even appears.
2. **jscanify** — a thin OpenCV.js wrapper, 24-star single-maintainer project with no active maintenance. Uses plain Canny edge detection (no adaptive thresholding), so low-contrast scenes (white paper on light wood floor, the actual home environment for half the applicant pool) silently fail.

PRD-48 piloted [`scanic`](https://github.com/marquaye/scanic) as a replacement. Pilot findings (PRD-48 build path):
- Detector adapter abstraction works (`createScanicAdapter` was successfully built and type-checks).
- Scanic claims ~100KB gzipped (vs OpenCV.js ~9MB), ~10ms perspective transforms (vs jscanify ~200ms), GPU-accelerated canvas, TypeScript-native, robust low-contrast detection, active maintenance (v1.0.6 January 2026).
- The blocker was Next.js webpack bundling of Scanic's WASM blob, not the library itself — a known Next.js + wasm-bindgen integration pattern with documented solutions.

This PRD commits to Scanic, removes jscanify and the OpenCV.js CDN dependency, configures Next.js to bundle the WASM properly, and ships the result as the single detector with manual-capture as the only fallback. No A/B flag. No "Phase 2 / revisit later." Build robust, move on.

---

## Current state (confirmed 2026-05-19 against `main` @ `7200a25`)

| Surface | Path | Notes |
|---|---|---|
| OpenCV.js loader | `LivePreviewStage.ensureOpenCvLoaded` | Injects `<script src="https://docs.opencv.org/4.x/opencv.js">`. ~9MB. To be removed entirely. |
| jscanify loader | `LivePreviewStage.ensureJscanifyLoaded` | Dynamic `import('jscanify/client')`. Cached on `window.__jscanifyInstance`. To be removed entirely. |
| Detection loop | `edgeDetectionLoop.ts` (~260 lines, PRD-48 adapter pattern may be partially present) | RAF loop, 8fps. The `DetectorAdapter` abstraction stays; the jscanify adapter implementation is removed; the Scanic adapter becomes the only implementation. The `isAsync` branching collapses since there's only one detector. |
| Still-image extraction | `DocumentScanner.processImageBlob` | Calls `jscanify.extractPaper` today. Switches to Scanic's `scanner.scan(image, { mode: 'extract' })`. |
| `package.json` | `dependencies.jscanify` exists. `dependencies.scanic` may already be present from PRD-48 work; if not, added in F1. | jscanify removed. Scanic pinned. |
| `next.config.js` | Per PRD-48 build report, was reverted to "fallback-only" after failed bundling attempts. | F2 adds proper WASM bundling config. |
| WASM handling | None currently. Scanic ships `.wasm` from wasm-bindgen output. | F2 configures Next.js to bundle and serve the WASM. |
| Manual capture fallback | Exists today as the `detectionAvailable = false` path in `LivePreviewStage.tsx`. Surfaced when OpenCV/jscanify fail to load. | Stays as-is. Trigger condition changes: now fires if Scanic fails to load. |

---

## Goals

1. **Scanic is the only document detector.** No jscanify code path, no OpenCV.js download.
2. **Webpack bundles the Scanic WASM correctly in Next.js.** WASM ships from our own origin (Vercel), no third-party CDN, no script-tag injection at runtime.
3. **First scanner open on cellular drops from 9MB+ to ~100KB.** Measured, not asserted.
4. **Detection works on the worst-case real-world scene** (white paper on light wood floor) without manual capture. If it doesn't, that's a regression and we fix it before merging.
5. **Manual-capture fallback remains** for the case where Scanic genuinely fails to load (network error, WASM disabled browser, ancient device).
6. **Build is robust** against the failure modes that bit PRD-48: WASM module resolution, minifier crashes, hydration errors. The "build robustly and move on" mandate applies — no "ship as-is" / "Phase 2."

## Non-Goals

- **No A/B flag.** Pilot is over. Single detector, no `?scanner=` parameter, no `NEXT_PUBLIC_SCANNER_DETECTOR` env var.
- **No jscanify-fallback-on-runtime-failure.** Manual capture is the only fallback. Adding a second library back as a fallback recreates the maintenance burden we're getting rid of.
- **No detection-loop architectural rewrite beyond removing the dual-adapter switching.** RAF cadence, stability tracker, `isValidQuad` filter all stay.
- **No quality.ts changes.** Library-agnostic, no dependency on either detector.
- **No new translation strings.** Manual-capture fallback messaging already exists.
- **No detection-parameter tuning beyond Scanic's defaults.** If defaults fail on a real scene, that's a finding worth documenting and possibly a future tuning PRD — but MVP ships defaults.

---

## Closed Decisions

1. **Commit to Scanic, remove jscanify and OpenCV.js entirely.** This is the headline. No `DetectorAdapter` dual-implementation; the abstraction stays as a thin interface but has one implementation. Easier to test and swap later if needed, but no library switching at runtime.

2. **WASM via Next.js standard webpack experiments.** Use `experiments.asyncWebAssembly: true` in `next.config.js`. Configure `output.webassemblyModuleFilename` if Next.js doesn't handle it automatically. WASM ships in the static chunk output and is served from `/_next/static/wasm/` (or equivalent) on the same origin.

3. **`Scanner` class as a module-level singleton.** One initialization per page load, cached on `window.__scanicInstance`. Same pattern jscanify used.

4. **Lazy `await scanner.initialize()`** — runs on first scanner open, not on page mount. Adds ~1-2s to first scan but saves the WASM download for users who never open the scanner.

5. **`detect` mode only in the live loop, `extract` mode in `processImageBlob`.** Same as PRD-48's design.

6. **`isValidQuad` filter stays.** Library-agnostic; the heuristic of "reject background-spanning / tiny / skewed quads" is still useful regardless of detector.

7. **Scanic version pinned in `package-lock.json`.** No floating dependency.

8. **Self-hosted WASM, not CDN-loaded.** Vercel serves the WASM from the same origin. No `unpkg.com` dependency at runtime. Eliminates the same third-party-CDN risk we just removed from OpenCV.js.

9. **Branch is feature branch, never `dev`.** PRD-48 build accidentally landed on `dev`. This PRD lives on `feat/pbv-scanner-scanic-ship-52` until the PR is approved and merged.

---

## Detailed Changes

### F1 — `package.json` dependency swap

- Add `scanic` (latest stable, ~v1.0.6).
- Remove `jscanify` from `dependencies`. If anything else imports it, search and remove those imports too.
- `npm install` once locally to lock the version in `package-lock.json`.

### F2 — Loading Scanic robustly (two acceptable paths)

The constraint is: **(a)** Scanic loads in a Next.js production build without crashing the minifier, **(b)** WASM is served from our own origin (no third-party CDN at runtime), and **(c)** the choice is durable — no "revisit if it breaks" framing per [[feedback-ship-done-not-iterate]].

Two paths satisfy this. The first is more "Next.js native"; the second is more battle-tested in this codebase. Pick whichever lands the build cleanly with the least fragility.

**Path A — Next.js webpack WASM experiments (preferred if it works cleanly):**

```js
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    config.experiments = { ...config.experiments, asyncWebAssembly: true, layers: true };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ scanic: 'commonjs scanic' });
    }
    return config;
  },
};
```

If this builds cleanly + Scanic loads at runtime: ship it. Reference patterns: Vercel's Next.js WASM example, Next.js GitHub issue #29362.

**Path B — Self-hosted UMD bundle in `/public/scanic/` (fallback if Path A fails after ~half a day of focused config work):**

This is the pattern this codebase already uses for OpenCV.js — a script tag loads a same-origin asset, the library attaches itself to `window`. The difference here is we self-host (no `unpkg.com` runtime dep) and auto-sync via a postinstall script.

1. Add a `postinstall` script in `package.json`:
   ```json
   "scripts": {
     "postinstall": "node scripts/sync-scanic-public.js"
   }
   ```
2. `scripts/sync-scanic-public.js` copies `node_modules/scanic/dist/scanic.umd.cjs` (and any required `.wasm` files) to `public/scanic/`. Fails loudly if the source files moved (Scanic version mismatch).
3. `ensureScanicLoaded()` in `LivePreviewStage.tsx` injects a `<script src="/scanic/scanic.umd.cjs">` if not already present, waits for the global Scanic export on `window`, returns the adapter. Same pattern as the current OpenCV.js loader, but pointing at our own origin.
4. WASM file (if it loads separately from the UMD bundle) ships from `public/scanic/` too — same origin, no third-party fetch.

Path B is not "scrappy" — it's the same loading pattern that ships in production today for OpenCV.js. The postinstall sync keeps it auto-current with npm; no manual maintenance burden.

**Critical:** if you take Path B, the npm `scanic` dep stays in `package.json` — the postinstall script reads from `node_modules/scanic/dist/`. That's how the version stays pinned and auto-sync happens. Do not delete the npm dep and treat `public/scanic/` as the sole source of truth — that creates a manual sync burden.

**Decision authority during the build:** Windsurf picks Path A first. If after a focused half-day Path A is still crashing the minifier, switch to Path B and document the Path A failure mode in the build report. Both paths satisfy the PRD's same-origin + no-third-party-CDN constraint. Either is acceptable. The build report names which one was used and why.

### F3 — `LivePreviewStage.tsx` — Replace loaders

- Remove `ensureOpenCvLoaded`, `ensureJscanifyLoaded`, and the `<script>` injection logic.
- Add `ensureScanicLoaded()` that does a dynamic `import('scanic')`, instantiates `new Scanner()` if not cached on `window.__scanicInstance`, calls `await scanner.initialize()`, returns the adapter.
- Detection-loop useEffect calls `ensureScanicLoaded()` and passes the adapter to `startDetectionLoop`. On failure, set `detectionAvailable = false` (existing manual-capture path).
- Remove the `?scanner=` URL parameter handling. Remove the env-var fallback. The detector choice is hardcoded.

### F4 — `edgeDetectionLoop.ts` — Single-detector simplification

- Keep `DetectorAdapter` interface — useful for future swaps, useful for testing.
- Remove `createJscanifyAdapter` factory entirely.
- `createScanicAdapter` stays as the only implementation.
- The RAF loop's `isAsync` branching can collapse to always-async (Scanic is async), or stay as a defensive switch. Either is fine; prefer "always-async with an inFlight guard" for cleanest code.

### F5 — `DocumentScanner.tsx` — `processImageBlob`

- Replace the inline `jscanify.extractPaper` call with `adapter.extract(image)` where `adapter` comes from `ensureScanicLoaded()`.
- Same fallback logic if extraction returns null (draw raw image to canvas).

### F6 — Remove unused files / code

- Any helper that only existed to load OpenCV.js or wrap jscanify.
- Any test fixtures specifically for jscanify behavior.
- Any documentation referencing OpenCV.js or jscanify as the detection library (update to reference Scanic).

### F7 — Verification matrix

The PRD-48 verification gates were oriented around comparison. This PRD's gates are oriented around production-readiness. See "Verification Gates" below.

---

## Architecture Rules

1. **No jscanify imports anywhere.** Grep verification: `grep -r jscanify components/ lib/ app/ → no matches`.
2. **No `docs.opencv.org` references anywhere.** Same grep, no matches.
3. **No `?scanner=` URL handling, no `NEXT_PUBLIC_SCANNER_DETECTOR` env var.** Removed.
4. **No `localStorage` / `sessionStorage`** introduced by this PRD. WASM caching is browser/CDN-level, no app-level cache needed.
5. **No new TypeScript `any`** in the detection path. Scanic ships types.
6. **TypeScript-strict for the adapter.** No `unknown` casts beyond the immediate `result.corners → Quad` boundary.
7. **No new dependencies beyond `scanic`.** No `@webassembly/...`, no copy-webpack-plugin, no custom loaders. Use Next.js's native WASM support.
8. **Branch is `feat/pbv-scanner-scanic-ship-52`.** Never push to `dev` or `main` directly.

---

## Verification Gates

Build is not done until every gate passes. The bar is higher than PRD-48 because this is a commit-and-ship, not a pilot.

### Gate 1 — Build and types

- `npx tsc --noEmit` clean.
- `npm run build` clean, **with no minifier warnings or errors related to WASM**. Past PRD-48 attempts crashed the minifier; this gate explicitly fails if anything similar shows up.
- Confirm `.next/static/` contains the Scanic WASM file (`grep -r scanic .next/static/` or look for a `.wasm` chunk).

### Gate 2 — Scanic loads, no OpenCV.js fetch

- Open the scanner in dev and on a Vercel preview.
- Network tab: NO request to `docs.opencv.org` (it should be gone from the codebase entirely — grep verifies, network tab confirms at runtime).
- A `.wasm` request appears in the network tab, loaded from `/_next/static/` on the same origin.

### Gate 3 — High-contrast scene works

- Point camera at a document on a dark surface, well-lit.
- Auto-capture fires within ~3-5s.
- Captured image is reasonably cropped (extraction works).

### Gate 4 — Low-contrast scene works (THE original reason)

- Point camera at a document on a light wood floor, indoor lighting.
- Either auto-capture fires (success) OR the PRD-47 stuck banner appears within 8s (acceptable — manual capture path works).
- This is the scene that jscanify silently failed on. Scanic claim is "robust in low-contrast environments" — verify or document that the default thresholds aren't enough.

### Gate 5 — Cellular load time (THE bundle-size payoff)

- Chrome DevTools → Network → Fast 3G + Disable cache.
- Cold-load the tenant flow, tap "Scan document."
- Time from tap to first quad overlay drawn. Should be substantially under the ~10s baseline jscanify+OpenCV produced.
- Document the actual number in the build report. The bundle-size argument lives or dies on this measurement.

### Gate 6 — Failure path: WASM disabled

- Open Chrome DevTools → Settings → "Disable JavaScript" → don't actually disable JS, but block WASM via an extension or by manipulating the request.
- Alternative: throttle network to "Offline" after the page loads but before opening the scanner.
- Verify the existing "Auto-detect unavailable — tap Capture" manual-capture banner appears.
- Verify manual capture works (canvas drawImage of the raw video frame).

### Gate 7 — Mobile device matrix

Real device or accurate emulation. Don't shortcut this. Document what was tested in the build report:
- iPhone (iOS Safari, current version + iOS 16).
- Android Chrome.
- Narrow viewport (iPhone SE form factor — 375px).
- Large-text mode (200% root font size, PRD-46 territory).

Every combination must: load Scanic, fire detection on a high-contrast scene, capture, advance to review.

### Gate 8 — PRD-47 + PRD-51 composability

- PRD-47 (multi-page review, stuck banner, debug-overlay gate) still works with Scanic active.
- PRD-51 (combined Approve-and-Send Invitation, if merged by this point) still works.

### Gate 9 — No jscanify residue

- `grep -r jscanify .` returns 0 matches in `components/`, `lib/`, `app/`, `package.json`, `package-lock.json`.
- Same for `docs.opencv.org`.

### Gate 10 — Memory / leak check

- Open the scanner, point at a scene for 5 minutes continuously.
- DevTools → Performance → Memory: heap should not grow unboundedly.
- WASM instance should be reused across mount/unmount of LivePreviewStage (singleton on `window.__scanicInstance`).

### Gate 11 — Rollback rehearsal

- Confirm we have a tag at `launch-prep-full-2026-05-19` (per PRD-50) — that's the rollback point if this PRD breaks production.
- Document the rollback procedure in the build report: revert to the tag, redeploy, scanner reverts to jscanify+OpenCV.

---

## Out of Scope (do not touch)

- `stabilityTracker.ts`
- `QuadOverlay.tsx`
- `usePermissionPrompt.ts`
- `FirstScanTooltip.tsx`
- `quality.ts`
- Translation files (no new strings)
- `DocumentCard.tsx`, `DocumentCardStack.tsx` (PRD-47 and PRD-51 territory)
- Any HACH-facing surface
- Any migration
- Any `app/api/` route
- Server-side image processing

---

## Phasing

**Single phase, single PR, single merge.** All seven changes (F1-F7) ship together. Verification is comprehensive; rollback is via tag revert. Estimated Windsurf time: 1-2 focused days, dominated by the webpack config work and the device matrix verification.

---

## Decision-already-made: why no pilot / A/B this time

PRD-48 was the pilot. The pilot already produced:
- The adapter abstraction (sound).
- Scanic API compatibility verification (works).
- Build report blocker on WASM bundling (a known Next.js issue, not a Scanic issue).

The decision to commit-and-ship rather than re-pilot is made on three grounds:
1. **Bundle size affects every applicant on every first scan, not just the worst-case low-contrast cases.** 9MB → 100KB is the headline win, independent of detection quality.
2. **Maintenance posture.** OpenCV.js is loaded from a CDN we don't control. jscanify has no active maintainer. Scanic shipped v1.0.6 in January 2026. The dependency-risk math favors Scanic.
3. **The pilot's "decision criteria" were a hedge against unknown low-contrast performance.** That can be verified in Gate 4 of this PRD without resurrecting an A/B switching surface.

If Gate 4 fails (Scanic can't handle our actual scenes), the response is: tune Scanic's thresholds (it exposes them), not revert to jscanify. If even tuning fails, that's an "Inconclusive" build report and we re-open the question. But the default expectation is: ship it.

---

## Open Questions

| ID | Question | Owner | Blocker? |
|---|---|---|---|
| O1 | Does `next.config.js` need `output.webassemblyModuleFilename` set explicitly, or does Next.js 14+ handle it via `asyncWebAssembly` alone? | Build agent — document the working config in the build report. | No |
| O2 | Does Vercel serve the bundled `.wasm` with the correct `application/wasm` MIME type by default, or does it need a custom header in `vercel.json` or middleware? | Build agent — verify by inspecting the Network tab response headers on a Vercel preview. | No |
| O3 | Does Scanic's `Scanner.initialize()` need to run on every page mount, or does the `window.__scanicInstance` singleton survive Next.js client-side route changes? | Build agent — test by navigating away from the scanner and back, watch for WASM re-fetch. | No |
| O4 | Are Scanic's default thresholds adequate for the actual indoor low-contrast scenes (white paper on light wood floor), or do they need tuning? | Build agent — Gate 4. | If "yes need tuning," a tuning sub-task can ship under this PRD or as a follow-up; either way, this PRD does not merge until Gate 4 passes. |
