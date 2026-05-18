# Prompt — PRD-45: Live-Preview Document Scanner

**Date:** 2026-05-18
**Pairs with:** `docs/fullApp-Plan/45-pbv-live-camera-scanner_prd_2026-05-18.md`
**Target branch:** `feat/pbv-live-camera-scanner-45`

---

## Read first

In this order. Do not skip.

1. The PRD: `docs/fullApp-Plan/45-pbv-live-camera-scanner_prd_2026-05-18.md`
2. The Path 1 build note (just shipped): `tasks/path-1-ios-native-scanner_2026-05-18.md`
3. The existing scanner: `components/DocumentScanner/DocumentScanner.tsx` — read the whole file. Understand the `Stage` state machine and the existing pipeline.
4. The active mobile caller: `components/pbv/cards/DocumentCard.tsx` lines 1-50 and the lines around `<DocumentScanner` (grep for it). Do NOT modify this file — `DocumentScanner`'s public API does not change.
5. The compliance-portal caller: `components/portal/FileUploadTask.tsx` — same reason. Do NOT modify.
6. The PRD-41 build report for the project's evidence/grep convention: `docs/build-reports/41-pbv-tenant-upload-ux-build-report_2026-05-17.md`
7. The jscanify entrypoint we already use: `node_modules/jscanify/src/jscanify.js`. Find `findPaperContour` and confirm its return shape before writing code that consumes it.

---

## What you're building

Five features per PRD-45:

- **F1** — Camera permission UX + live video plumbing
- **F2** — Per-frame jscanify detection + quad overlay
- **F3** — Stability tracking + auto-snap
- **F4** — Multi-page integration (Add page routes to live preview)
- **F5** — Fallback + browser-support + verification polish

All in `components/DocumentScanner/`. No backend changes. No schema changes. No new dependencies.

Total target: 3-4 working days.

---

## Order of operations

Build in phase order — each phase is functional and verifiable on its own:

**Phase 1 → 2 → 3 → 4 → 5**

Do not jump phases. Each phase must compile cleanly and run on a real device before you start the next.

---

## Pre-flight (answer in build report)

Before writing any feature code, answer the three Open Questions from the PRD with raw evidence:

### Q1 — TenantDocumentUpload.tsx orphan check
```
grep -rn "import.*TenantDocumentUpload" app components --include="*.tsx" --include="*.ts"
```
Post raw output. If zero hits → component is orphaned. Note for follow-up PR (do not delete in this PRD).

### Q2 — jscanify.findPaperContour return shape
Write a one-off scratch test that loads a fixture image (use `tests/fixtures/id-drivers-license.jpg` if present, else any image you have), instantiates jscanify, calls `findPaperContour`, and console.logs the result. Post the raw object shape in the build report. Confirms `{ topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner }` with `.x` / `.y` fields, or surfaces whatever the real shape is so the rest of the code uses correct field names. **Delete the scratch test before commit.**

### Q3 — getUserMedia track settings
After Phase 1 lands, on a real Android device, after `getUserMedia` resolves:
```js
const settings = stream.getVideoTracks()[0].getSettings();
console.log(JSON.stringify(settings, null, 2));
```
Post the JSON. Confirms we're actually getting the requested resolution and rear camera.

---

## Phase 1 — Camera plumbing + permission UX (4-6 hrs)

### Files

**New:**
- `components/DocumentScanner/usePermissionPrompt.ts`
- `components/DocumentScanner/LivePreviewStage.tsx`
- `components/DocumentScanner/FirstScanTooltip.tsx`

**Modify:**
- `components/DocumentScanner/DocumentScanner.tsx` — extend `Stage` union with `'live_preview'`; add entry-stage conditional routing. **No `isIOSDevice()` check** in `liveSupported` — iOS gets the same primary scanner path as Android.
- `components/DocumentScanner/translations.ts` — new strings (see below).

### `usePermissionPrompt.ts` contract

```ts
type PermissionState =
  | { kind: 'idle' }
  | { kind: 'pre_prompt' }                   // show soft modal
  | { kind: 'requesting' }                   // getUserMedia in flight
  | { kind: 'granted'; stream: MediaStream } // live, attach to video
  | { kind: 'denied'; reason: string };      // fall back

interface UsePermissionPromptOptions {
  onGranted: (stream: MediaStream) => void;
  onDenied: (reason: string) => void;
}

export function usePermissionPrompt(opts: UsePermissionPromptOptions): {
  state: PermissionState;
  openPrePrompt: () => void;
  acceptPrePrompt: () => Promise<void>;
  cancel: () => void;
};
```

- `acceptPrePrompt` invokes `getUserMedia` with the constraints from PRD §F1. On `NotAllowedError` → `denied`. On `NotFoundError` → `denied` with reason "no_camera". On any other error → `denied` with reason "unknown".
- `cancel` stops any active stream via `stream.getTracks().forEach(t => t.stop())` and returns state to `idle`.
- Cleanup on unmount: same stop-tracks logic.

### `LivePreviewStage.tsx` skeleton (Phase 1 only)

- Mounts the pre-prompt modal when state is `pre_prompt`.
- Mounts `<video autoPlay playsInline muted>` with `srcObject = stream` when state is `granted`.
- Cancel button always visible.
- No overlay yet. No detection yet. Just video + cancel.

### `DocumentScanner.tsx` changes

- Extend `Stage`: `'entry' | 'live_preview' | 'processing' | 'warning' | 'preview' | 'review_pages' | 'submitting'`.
- Entry-stage render: at top, compute `const liveSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;`. Cache via `useMemo`. **Do not include `isIOSDevice()` in this expression.** iOS gets the same primary path as every other supported device — that's the deliberate design per PRD-45 Closed Decision #2 (v2).
- If `liveSupported`: render **one** primary CTA "Scan document" full-width primary brand color, with two small secondary text-links below "Take photo · Choose file" (dot separator, `text-sm text-muted`). The discoverability win is having a single obvious action.
- If NOT `liveSupported`: render today's entry stage unchanged (two equal buttons). No regression.
- **Path 1 stays.** The existing `<input>` `capture` conditional on `isIOSDevice()` is preserved. Do not touch it.

### `FirstScanTooltip.tsx` contract

```tsx
interface FirstScanTooltipProps {
  language: ScannerLanguage;
  onDismiss: () => void; // called on tap, timeout (~3s), or first successful capture
}
```

- Reads `localStorage.pbv_scanner_tooltip_seen`. If truthy, renders nothing.
- Otherwise, renders a semi-transparent overlay positioned over the live video with `t.firstScanTooltip` copy.
- Auto-dismisses after 3000ms. On dismissal sets `localStorage.pbv_scanner_tooltip_seen = '1'`.
- Mounted by `LivePreviewStage` immediately after stream attach.

### Translations (`translations.ts`)

Add to each of `en`, `es`, `pt`:
```
scanDocumentBtn      : "Scan document" / "Escanear documento" / "Digitalizar documento"
secondaryTakePhoto   : "Take photo" / "Tomar foto" / "Tirar foto"
secondaryChooseFile  : "Choose file" / "Elegir archivo" / "Escolher arquivo"
permissionPromptTitle: "Use your camera?" / "¿Usar tu cámara?" / "Usar sua câmera?"
permissionPromptBody : "We'll use your camera to scan this document. The image stays on your phone until you tap Submit." / (translated) / (translated)
permissionAllow      : "Allow camera" / "Permitir cámara" / "Permitir câmera"
permissionDenied     : "Camera access blocked. Using photo upload instead. To enable the scanner, allow camera in browser settings." / (translated) / (translated)
permissionNoCamera   : "No camera detected. Using photo upload instead." / (translated) / (translated)
captureNow           : "Capture now" / "Capturar ahora" / "Capturar agora"
holdSteady           : "Hold steady" / "Mantener firme" / "Manter firme"
noDocumentDetected   : "Position the document in the frame" / "Coloca el documento en el marco" / "Posicione o documento no quadro"
lowLightWarning      : "It's dark — try moving to better light" / "Está oscuro — intenta mejor luz" / "Está escuro — tente melhor luz"
firstScanTooltip     : "Hold the document flat in the frame. We'll capture automatically when steady." / (translated) / (translated)
```

Post all 39 strings (13 × 3 languages) in the build report.

### Phase 1 done when

- Tap "Scan document" on Android Chrome AND iPhone Safari AND desktop Chrome with webcam → soft pre-prompt → Allow → live video.
- Tap Cancel → stream stops (verify camera indicator goes away within 1s).
- Permission denied path → falls back to entry stage with denied message + fallback buttons.
- First-scan tooltip shows once per device (verify via DevTools localStorage), dismisses cleanly.
- Unsupported browser (no `getUserMedia`): entry stage shows today's two-button layout. No regression.
- `npm run build` zero errors.

---

## Phase 2 — Edge detection + overlay (6-8 hrs)

### Files

**New:**
- `components/DocumentScanner/edgeDetectionLoop.ts`
- `components/DocumentScanner/QuadOverlay.tsx`

**Modify:**
- `components/DocumentScanner/LivePreviewStage.tsx` — mount overlay, wire detection loop.

### `edgeDetectionLoop.ts` contract

```ts
interface Quad {
  topLeft: { x: number; y: number };
  topRight: { x: number; y: number };
  bottomLeft: { x: number; y: number };
  bottomRight: { x: number; y: number };
}

interface DetectionLoopOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  jscanify: any;        // jscanify instance (lazy-loaded)
  targetFps: number;    // default 8
  onQuad: (quad: Quad | null) => void;
  onPerfWarn?: (detectionMs: number) => void; // adaptive throttle hook
}

export function startDetectionLoop(opts: DetectionLoopOptions): () => void; // returns stop()
```

- rAF-driven. On each frame: check if `now - lastDetection >= 1000 / targetFps`.
- If so: draw `videoRef.current` to an off-screen `<canvas>` (downsample to max 1280px wide for perf), call `jscanify.findPaperContour(canvas)`.
- Convert jscanify result into the `Quad` shape (use the field names confirmed in Pre-flight Q2).
- Call `onQuad(quad | null)`.
- Adaptive throttle: track rolling avg of detection wall time. If avg > 150ms → decrement `targetFps` (floor 4). If avg < 80ms for 30 frames → increment (ceiling 10).
- Return a `stop()` that cancels the rAF and nulls refs.

### `QuadOverlay.tsx` contract

```tsx
interface QuadOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  quad: Quad | null;
  color: 'red' | 'amber' | 'green'; // F3 will drive this; default amber when quad present
}
```

- Render a `<canvas>` positioned absolutely over the video (`position: absolute; inset: 0`).
- Use `ResizeObserver` on the video element to keep canvas in sync.
- Map video coordinates → canvas display coordinates (accounting for `object-fit: contain` letterboxing).
- Draw stroked polygon connecting the 4 corners. 3px stroke. Color per prop.
- If `quad === null`: clear canvas (no overlay).

### Phase 2 done when

- Hold a real paystub on a desk under Android Chrome: green/amber quad outlines the doc within 250ms.
- Move doc: quad follows.
- Block doc: overlay clears.
- Detection loop stops cleanly when `LivePreviewStage` unmounts (no zombie console logs).
- Console log in dev mode shows detection wall time on each tick (will be removed in Phase 5 polish).

---

## Phase 3 — Stability + auto-snap (4-6 hrs)

### Files

**New:**
- `components/DocumentScanner/stabilityTracker.ts`
- `components/DocumentScanner/__tests__/stabilityTracker.test.ts`

**Modify:**
- `components/DocumentScanner/LivePreviewStage.tsx` — consume stability, drive overlay color, trigger capture on stable, add manual button.

### `stabilityTracker.ts` contract

```ts
type StabilityState =
  | { kind: 'seeking' }
  | { kind: 'unstable' }
  | { kind: 'warming'; ticksRemaining: number } // 1..11
  | { kind: 'armed' };

interface StabilityTracker {
  push(quad: Quad | null): StabilityState;
  reset(): void;
}

export function createStabilityTracker(opts?: {
  bufferSize?: number;      // default 12
  toleranceLInf?: number;   // default 12 (px)
}): StabilityTracker;
```

- Pure function/class. No DOM. No side effects.
- `push(null)` → `{ kind: 'seeking' }`, clears buffer.
- `push(quad)` → adds to buffer, computes max corner L∞ delta vs. all buffered quads.
  - If delta > tolerance → `{ kind: 'unstable' }`.
  - Else if buffer not yet full → `{ kind: 'warming', ticksRemaining: bufferSize - buffer.length }`.
  - Else (buffer full and stable) → `{ kind: 'armed' }`.

### Tests (`stabilityTracker.test.ts`)

Cover at minimum:
- Seeking when null pushed.
- Unstable when quad jumps > tolerance.
- Warming → armed transition over `bufferSize` stable pushes.
- Reset clears buffer.
- Tolerance respected at exact boundary.

### `LivePreviewStage.tsx` wiring

- On each `onQuad` from the detection loop, push into the tracker, derive state, derive overlay color:
  - `seeking` → no overlay (`quad={null}`).
  - `unstable` → amber.
  - `warming` → amber (later: amber with countdown ticks — Phase 5 polish).
  - `armed` → green AND immediately trigger capture.
- Trigger capture:
  1. Stop detection loop.
  2. Stop tracks via stream cleanup.
  3. Draw current video frame to canvas at native resolution.
  4. Call `canvasToJpegBlob(canvas)` (already exists in DocumentScanner.tsx — export or hoist).
  5. Hand blob to `processImageBlob(blob, 'scanner', false)` (already exists — hoist or thread via prop).
- Manual capture button: persistent, full-width, min-height 48px. Tapping calls the same capture path regardless of stability state.

### Phase 3 done when

- Hold doc steady on a desk: snaps within ~1.5s.
- Wobble: never snaps.
- Tap "Capture now": snaps immediately.
- After snap, existing preview stage renders with the captured image.
- Existing "Retake" / "Use this" buttons on preview stage work as today.
- Unit tests pass.

---

## Phase 4 — Multi-page routing (2-3 hrs)

### Files

**Modify:**
- `components/DocumentScanner/DocumentScanner.tsx` — `review_pages` stage "Add page" button.

### Change

Currently:
```tsx
<button onClick={() => setStage('entry')}>{t.addPage}</button>
```

New:
```tsx
<button onClick={() => setStage(liveSupported ? 'live_preview' : 'entry')}>{t.addPage}</button>
```

(Use the `liveSupported` memo already in scope from Phase 1.)

### Phase 4 done when

- Scan page 1 via live preview → use this page → review_pages shows page 1.
- Tap "Add another page" → goes back into live preview.
- Repeat for pages 2-4.
- Tap "Submit" → existing `finalizeSubmit` bundles all into one PDF.
- iOS Safari: "Add another page" routes to `live_preview` (same as Android) since `liveSupported` is true there too.
- On unsupported browsers: "Add another page" still goes to entry stage. Verify no regression.

---

## Phase 5 — Fallback polish + verification (3-4 hrs)

### Build

- Low-light toast: in the detection loop callback, compute frame luminance (mean Y over the downsampled canvas). If below threshold for 3 consecutive seconds, surface `t.lowLightWarning` as a non-blocking toast above the video. Threshold: empirically tune; start at mean Y < 60 (out of 255).
- Remove dev-only console.logs from Phase 2.
- Cached `liveSupported` memo: verify it's computed once on mount, not on every render.

### Manual device test matrix

Required:
- Android Chrome on a recent Pixel- or Samsung-class device.
- iPhone Safari on iOS 14.3+ (live preview is the primary path — verify it works, AND verify secondary "Choose file" text-link still routes to iOS picker so Path 1's fallback is intact).
- Desktop Chrome with webcam.
- Desktop Chrome without webcam OR with permission denied.

Nice-to-have if available:
- Low-end Android (Samsung A-series, Moto G) — verify adaptive throttle keeps UI responsive.
- iPhone Safari on iOS < 14.3 (no `getUserMedia`) — verify graceful fallback to today's two-button layout.

### Tenant comprehension test (new, required)

Send the staging link to ONE real tenant (or one staff member who has never seen the scanner) with NO instructions beyond "upload your paystub." Watch them or have them screen-record. Capture:
- Did they tap "Scan document"? (Y/N)
- Did they understand the permission pre-prompt? (Y/N)
- Did they hold the doc still long enough for auto-snap? (Y/N)
- Did they reach a successful upload without help? (Y/N + time elapsed)
- Any moments of visible confusion? (free-text notes)

Record in build report. If 3+ "N" answers, the discoverability work needs another pass before declaring done.

### Real-world capture quality test

- Photograph `tests/fixtures/paystub-week1.pdf` printed out, held at a 30° angle in normal indoor light, via the new live preview on Android.
- Attach the resulting captured image to the build report.
- It should be dewarped, edges aligned, text legible.

### Compliance portal smoke test

- Open the compliance portal task that uses `FileUploadTask.tsx` → upload a doc via the scanner → confirm it still produces a `task_completions` row with the same shape as before (no regression in the substrate).

### Build report

Use the PRD-41 build report as a structural template. Required sections:
1. Pre-flight answers (Q1, Q2, Q3) with raw output.
2. Files created / modified (one bullet per file).
3. Translation additions (post all 30 strings).
4. Grep audit per PRD Verification Gate §3 — raw output for each grep.
5. Device test matrix — one row per device, status + notes.
6. Capture quality before/after image.
7. Compliance portal smoke test result.
8. Build + test output (zero errors / passes).
9. Deviations from PRD (if any — flag and justify).

---

## Done definition

All seven Verification Gates from PRD-45 §"Verification Gates" pass with raw evidence in the build report. If any gate fails: **stop, post what you have, do not declare complete.**

---

## What NOT to do

- Do not modify `components/pbv/cards/DocumentCard.tsx` or `components/portal/FileUploadTask.tsx`. They consume `DocumentScanner` via its public API which does not change.
- Do not modify the upload API route or any backend code. This is a pure client-side PRD.
- Do not add new npm dependencies. jscanify + opencv.js + pdf-lib + heic2any only.
- Do not undo Path 1. The `<input>` `capture` attribute conditional on `isIOSDevice()` stays exactly as Path 1 left it. iOS tenants who tap the secondary "Choose file" text-link must still reach the iOS file picker (Files → ⋯ → Scan Documents is a valid Path 1 fallback for power users).
- Do not use `isIOSDevice()` anywhere in the new PRD-45 code. `liveSupported` is purely `!!navigator.mediaDevices?.getUserMedia`. iOS gets the same primary scanner UX as every other supported device — that is the deliberate design.
- Do not add telemetry, analytics events, or new event types. Deferred to a follow-up.
- Do not add a torch button in v1.
- Do not introduce a front/back camera toggle.
- Do not "improve" the existing post-capture jscanify `extractPaper` call in `DocumentScanner.tsx` — same pipeline downstream, same behavior.
- Do not declare done without a real-device test on BOTH iPhone Safari and Android Chrome. Browser dev-tools device emulation does NOT count — `getUserMedia` behavior, permission UX, and adaptive perf only emerge on real hardware. The tenant comprehension test is also non-negotiable.
