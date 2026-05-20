# PRD-45 — Live-Preview Document Scanner (all supported devices)

**Date:** 2026-05-18 (revised same-day after iOS discoverability correction)
**Author:** Claude (cowork session, follow-up to Path 1 ship + iOS scanner correction)
**Branch:** `feat/pbv-live-camera-scanner-45`
**Status:** Draft — ready for build.
**Depends on:** Path 1 shipped (`tasks/path-1-ios-native-scanner_2026-05-18.md`) — kept as a small standalone improvement; PRD-45 does not require it but does not undo it either.
**Blocks:** Nothing currently in flight.
**Revision history:**
- v1 (2026-05-18 AM): Drafted with iOS exempted on the assumption that dropping `capture` exposed Apple's "Scan Documents" in Safari's action sheet.
- v2 (2026-05-18 PM): **Corrected.** Apple's scanner is buried inside Files app (Choose Files → ⋯ menu → Scan Documents) — not discoverable for the average tenant. PRD-45 now covers iOS too. Path 1 stays as a small standalone improvement (un-forces the camera) but is no longer the primary iOS strategy.

---

## Problem Statement

Tenants take document photos at angles. Almost every photo-based submission to date arrives skewed, blurry, or partially out of frame — often illegible by the time it reaches Stanton staff for review.

Path 1 (shipped 2026-05-18 AM, corrected PM) un-forces the iOS camera so tenants can choose Photo Library / Take Photo / Choose Files. It does NOT meaningfully surface Apple's "Scan Documents" — that option is buried inside the Files app behind a ⋯ menu, three taps deep, and is not discoverable for the average tenant. Path 1 stays as a small standalone improvement but cannot be the iOS scanner strategy. Android has nothing comparable in the stock file picker.

The existing `DocumentScanner.tsx` calls `jscanify.extractPaper()` **once, post-capture**, on whatever still photo the OS hands back. This is a band-aid: if the photo is already bad (angled, dim, doc partly off-frame), jscanify often fails to detect a clean quadrilateral and the bad photo is uploaded as-is.

The fix is to replace "snap a photo and hope" with "live preview with real-time edge detection and auto-snap when stable." Apple does this in VisionKit; ML Kit does it on Android natively. There is no comparable browser-native API. So we build one in-browser using `getUserMedia` for the live video stream and the already-installed `jscanify`/`opencv.js` pipeline for per-frame contour detection.

Mission-critical: 77 active applicants this cycle, ~22 required docs each, ~1,700 scan events. Bad scans become staff phone calls to re-request documents — the dominant operational cost of the program.

---

## Current state (confirmed 2026-05-18)

| Surface | Path | Notes |
|---|---|---|
| Scanner component | `components/DocumentScanner/DocumentScanner.tsx` | State machine: entry → processing → warning → preview → review_pages → submitting. Uses `<input type="file" capture>` for capture. Post-capture jscanify only. |
| Card-stack caller (active mobile UI) | `components/pbv/cards/DocumentCard.tsx` | Mounts `DocumentScanner` dynamically (`{ ssr: false }`). |
| Directory caller (legacy, still mounted?) | `components/pbv/TenantDocumentUpload.tsx` | Also mounts `DocumentScanner`. Likely unused after PRD-42 card-stack ship — confirm during build. |
| Compliance portal caller | `components/portal/FileUploadTask.tsx` | Out of scope for this PRD. Same component will be live-preview-enabled by inheritance. |
| Already installed | `jscanify`, `opencv.js` (CDN), `pdf-lib`, `heic2any` | No new dependencies. |
| Path 1 helper | `isIOSDevice()` in `DocumentScanner.tsx` lines 62-73 | Reuse for the iOS short-circuit. |

---

## Goals

1. **Live camera preview with real-time edge detection** on every device that supports `getUserMedia` — iOS Safari, Android Chrome, desktop Chrome/Edge/Firefox with a webcam.
2. **Auto-capture when the document is stable** (all four detected corners within a small pixel threshold for ~1.5s).
3. **Manual "Capture now" override** always available — never trap a tenant in an auto-loop.
4. **Discoverability is a first-class design concern.** The tenant must understand within 1 tap that "Scan" gives them an in-browser scanner, not just a file picker. Primary CTA copy, sole-primary-button placement, and a one-time post-permission tooltip all matter as much as the engineering.
5. **Graceful fallback.** When `getUserMedia` is unsupported (older browsers, denied permission, no camera), fall back to the existing "Take Photo" / "Choose File" flow with no error.
6. **No regression in the existing capture/preview/submit pipeline.** Live preview produces a `Blob` that flows into the same `processImageBlob → evaluateImageQuality → preview → onComplete` path that the file-picker flow uses today.
7. **Path 1 stays intact.** Tenants on iOS who actually do know about Apple's scanner can still reach it via the secondary "Choose file" button → Files app → ⋯ → Scan Documents. We don't undo it.

## Non-Goals

- **No commercial SDK swap.** This PRD uses jscanify, which is already installed and free. Commercial SDK evaluation (Scanbot, Dynamsoft, Genius Scan) is a separate decision documented in this thread.
- **No native app, no Capacitor wrapper.** Web-only.
- **No server-side image processing.** All capture/detection/processing stays client-side.
- **No new tenant-facing translations beyond the new entry-button copy.** Permission-prompt copy, error states, and instructions are en/es/pt from day one (matches existing scanner pattern).
- **No telemetry events in this PRD.** Defer to a follow-up if we want capture-success-rate analytics.
- **No multi-camera switching (front/back toggle).** Default to rear (`facingMode: 'environment'`). Tenant scans documents, not selfies.
- **No barcode/QR scanning.** Pure document-edge detection only.

---

## Users & Roles

| Role | What changes |
|---|---|
| Android tenant | Gains a real live-preview scanner. Replaces the file-picker-only flow with `<video>` + edge overlay + auto-snap. |
| iPhone tenant (all iOS versions with Safari `getUserMedia` support — iOS 14.3+) | Gains the same live-preview scanner as Android. Apple's buried "Scan Documents" remains technically reachable via the secondary "Choose file" button for tenants who know about it. |
| iPhone tenant on iOS < 14.3 | Falls back to today's file-picker flow (Path 1 ensures it's not forced-camera). |
| Desktop tenant | Gains live preview if their device has a webcam. Most desktops have one. If `getUserMedia` denied or no camera, falls back cleanly to file picker. |
| Stanton staff | No UI change. Better-quality scans land in `form-submissions` bucket, fewer follow-up phone calls. |
| Compliance portal users | Inherit the same scanner since they use the same component (`FileUploadTask.tsx`). No portal-specific work needed. |

---

## Closed decisions (locked 2026-05-18)

1. **Mount as primary on every supported device.** When `navigator.mediaDevices?.getUserMedia` exists, the scanner entry stage shows "Scan document" as the **only** primary CTA. "Take photo" and "Choose file" remain as small secondary text-buttons below for fallback. Rationale: path of least resistance must produce the best output. If the tenant has to choose between two equally-weighted buttons, half of them will pick the wrong one.

2. **iOS gets PRD-45's in-browser scanner too.** (Reversed from v1 of this PRD.) Apple's "Scan Documents" is buried in Files → ⋯ → Scan Documents, three taps deep, and is not discoverable. A worse scanner that 100% of tenants find beats a better scanner that 5% of tenants find. The `isIOSDevice()` helper from Path 1 is NOT used in PRD-45's support gate — `liveSupported` is purely `!!navigator.mediaDevices?.getUserMedia`.

3. **jscanify is the detection engine.** Already installed, already producing quads via `findPaperContour`. No new dependencies. If `findPaperContour` proves unreliable in production we can swap detection internals without changing the public API.

4. **8 fps detection target, adaptive throttle.** Video renders at native fps (typically 30); detection runs on every Nth frame to hit ~8 fps. If frame processing time exceeds ~150ms (low-end Android), drop to 5 fps. Acceptance: smooth video, no UI jank, detection lag under 250ms.

5. **1.5-second stability window for auto-snap.** All four detected corners must remain within a 12-pixel L∞ distance from their previous-frame position for 12 consecutive detection frames before triggering capture. Tenant can tap "Capture now" at any time to override.

6. **Manual capture is always one tap away.** A persistent "Capture now" button at the bottom of the live-preview view. Solves the "auto-snap never triggers because lighting is bad" trap.

7. **Single page per capture session in the card-stack mount.** Multi-page bundling stays as today — the existing `review_pages` stage handles add-another-page after capture. Live preview captures one page at a time; "Add another page" routes back into live preview.

8. **HTTPS only.** Production already enforces. Dev (`localhost`) is treated as secure by browsers, so local dev works.

9. **No torch button in v1.** `MediaStreamTrack.applyConstraints({ advanced: [{ torch: true }] })` support is patchy across Android browsers. Worth adding in v2 once we see real-tenant lighting failures. v1 ships without.

10. **No new dependencies.** jscanify, opencv.js, pdf-lib, heic2any are all that's used.

11. **Permission UX:** soft pre-prompt (modal explaining "We'll use your camera to scan the document" with a single "Allow camera" button) BEFORE invoking `getUserMedia`. Avoids the trap where a tenant reflexively taps "Block" on the browser permission and bricks the scanner for the rest of the session.

12. **Failure mode for permission denied:** fall through to the existing "Take photo" / "Choose file" buttons. Show a small explanatory line: "Camera access blocked — using photo upload instead. To enable scanner, allow camera in browser settings."

13. **Evidence standard:** every claim in the build report backed by a grep command + raw output. Matches PRD-03 / PRD-41 / PRD-42 convention.

---

## Open questions for the implementing agent

Confirm in the build report.

1. **`TenantDocumentUpload.tsx` orphan check.** Is it still mounted anywhere after the PRD-42 card-stack swap? Grep `import.*TenantDocumentUpload` across `app/` and `components/`. If unused, note for deletion in a follow-up PR but do NOT delete in this PRD.
2. **`jscanify.findPaperContour` return shape.** The README implies `{ topLeftCorner, topRightCorner, bottomLeftCorner, bottomRightCorner }` with `.x` / `.y` fields. Confirm by running it once against a fixture and posting the raw object shape in the build report.
3. **`getUserMedia` constraints for best resolution.** Start with `{ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } }`. If iOS Safari rejects, fall back to `{ video: { facingMode: 'environment' } }`. Post the actual track settings returned (`stream.getVideoTracks()[0].getSettings()`) in the build report.

---

## Core Features

### F1 — Camera permission UX + live video plumbing + discoverability

**Files:**
- New: `components/DocumentScanner/LivePreviewStage.tsx` — the new live-preview view component (mounted inside `DocumentScanner` state machine as a new stage).
- New: `components/DocumentScanner/usePermissionPrompt.ts` — small hook managing the soft pre-prompt + `getUserMedia` invocation + permission state.
- New: `components/DocumentScanner/FirstScanTooltip.tsx` — one-time-only animated tooltip shown the first time a tenant reaches the live preview. Dismisses on first successful capture, persisted via `localStorage` key `pbv_scanner_tooltip_seen`.
- Modify: `components/DocumentScanner/DocumentScanner.tsx` — add new stage `'live_preview'` to the `Stage` union; wire entry-stage routing.
- Modify: `components/DocumentScanner/translations.ts` — new strings (see below). All in en/es/pt.

**Behavior — entry stage (discoverability is the design):**
- `liveSupported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia` (no iOS exemption).
- If `liveSupported`: render **one** primary CTA — "Scan document" — full-width, primary brand color, large. Below it, in small `text-sm text-muted` style, two text-links separated by a dot: "Take photo · Choose file". The discoverability win is that there is only one obvious thing to tap.
- If NOT `liveSupported`: render today's exact layout (two equal buttons). No regression.

**Behavior — permission pre-prompt:**
- Tap "Scan document" → soft pre-prompt modal opens (NOT the browser permission yet).
- Modal copy: title "Use your camera?", body "We'll use your camera to scan this document. The image stays on your phone until you tap Submit." Single button "Allow camera" + a small Cancel link.
- Tap Allow → invoke `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } })`.
- On grant: route to `live_preview` stage with the stream.
- On `NotAllowedError`: dismiss modal, return to entry stage, show inline explanatory text under the entry buttons: "Camera access blocked. Using photo upload instead. To enable the scanner, allow camera in browser settings." Fallback buttons remain.
- On `NotFoundError` (no camera): same fallback path with copy "No camera detected. Using photo upload instead."

**Behavior — first-scan tooltip:**
- First time a tenant reaches the live_preview stage on this device (no `localStorage.pbv_scanner_tooltip_seen`), overlay a non-blocking semi-transparent tooltip on top of the video for ~3 seconds OR until the first stable detection. Copy: "Hold the document flat in the frame. We'll capture automatically when steady."
- Tooltip dismisses on tap, on first successful capture, or on timeout. Sets `localStorage.pbv_scanner_tooltip_seen = '1'` on dismissal.
- Localized en/es/pt.

**Acceptance:**
- iPhone Safari + Android Chrome + desktop Chrome (with webcam): tap "Scan document" → soft pre-prompt → Allow → browser prompt → Allow → live video.
- First-ever scan on a device: tooltip visible for ~3s. Second scan: no tooltip.
- Deny path: returned to entry stage with explanatory text + fallback buttons. No console errors.
- Stream cleanup: navigating away (tap Cancel, hit browser back) calls `stream.getTracks().forEach(t => t.stop())`. Verify camera indicator clears within 1s.
- iOS-specific check: Path 1 fallback path still works — tapping the small "Choose file" text-link still routes through iOS's file picker so a tenant who knows about Files → ⋯ → Scan Documents can still reach it.

---

### F2 — Per-frame detection + overlay rendering

**Files:**
- New: `components/DocumentScanner/edgeDetectionLoop.ts` — pure-function loop manager. Inputs: video element ref, jscanify instance, throttle target (fps), onQuad callback. Returns: start/stop functions.
- New: `components/DocumentScanner/QuadOverlay.tsx` — `<canvas>` overlay component that draws the detected quad on top of the video. Color states: red (no quad), amber (quad detected but unstable), green (stable, about to snap).
- Modify: `LivePreviewStage.tsx` — mount overlay, wire detection loop.

**Behavior:**
- Detection loop:
  1. `requestAnimationFrame`-driven; on every frame, check if `now - lastDetection >= 1000 / targetFps` (default 8 fps).
  2. If so: draw video frame to off-screen canvas, pass to `jscanify.findPaperContour(canvas)`.
  3. Adaptive throttle: if detection wall time exceeds 150ms, decrement targetFps by 1 (floor 4 fps). If under 80ms for 30 consecutive frames, increment back up (ceiling 10 fps).
  4. Pass quad result to `onQuad(quad | null)` callback.
- Overlay rendering:
  - Sized to match video element (use `ResizeObserver` to track viewport changes).
  - Quad drawn as a thick (3px) stroked polygon.
  - Color tied to stability state (computed in F3).
  - No quad detected → no overlay (don't draw a red box; tenant doesn't need scary feedback for "still looking").

**Acceptance:**
- Hold a paystub in frame against a contrasting background: green quad outlines the doc edges visibly within 250ms.
- Move the doc rapidly: quad follows with no perceptible lag at 8 fps.
- Block the doc with your hand (no quad detectable): overlay disappears cleanly, no flicker.
- Detection loop pauses when `LivePreviewStage` unmounts (no zombie loop after stage transition).

---

### F3 — Stability tracking + auto-snap

**Files:**
- New: `components/DocumentScanner/stabilityTracker.ts` — pure function/class that buffers the last N quads, returns stability state + countdown.
- Modify: `LivePreviewStage.tsx` — wire stability state to overlay color, trigger capture on stable.

**Behavior:**
- Buffer the last 12 detection frames of quads.
- On each new quad, compute the max per-corner L∞ distance vs. all buffered quads.
- States:
  - `seeking` — no quad detected in current frame.
  - `unstable` — quad detected, but max corner movement > 12 pixels in the buffer window. Overlay = amber.
  - `stable_warming` — quad stable for 1..11 of the buffer window. Overlay = amber with a small countdown bar (3 ticks).
  - `stable_armed` — quad stable for all 12 frames. Overlay = green. Trigger capture immediately.
- Trigger capture:
  1. Stop detection loop.
  2. Draw current video frame to canvas at native resolution (not the throttled detection canvas).
  3. Hand canvas to `processImageBlob(blob, 'scanner', false)` — the existing pipeline. From here, the existing state machine takes over (warning → preview → review_pages or submit).
- Manual capture button:
  - Persistent at bottom of `LivePreviewStage`, full-width, min-height 48px (touch target).
  - Tapping at any time triggers the same capture path regardless of stability state.

**Acceptance:**
- Hold doc steady in frame on a desk: auto-snap fires within ~1.5s of stability.
- Wiggle the doc continuously: never auto-snaps. Amber overlay persists.
- Tap "Capture now" mid-wobble: captures the current frame, routes to preview.
- After capture, `LivePreviewStage` is unmounted and detection loop is stopped (`getTracks().forEach(t => t.stop())` for the stream too).

---

### F4 — Multi-page integration (Add another page routes to live preview)

**Files:**
- Modify: `components/DocumentScanner/DocumentScanner.tsx` — the existing `review_pages` stage's "Add page" button currently does `setStage('entry')`. Change to: if live preview is supported and not iOS, `setStage('live_preview')`; otherwise `setStage('entry')`.

**Behavior:**
- Tenant scans page 1 via live preview → preview → "Use this page" → review_pages stage shows page 1.
- Tap "Add another page" → goes back into live preview (not back to the entry-stage button screen).
- Repeat for additional pages.
- Tap "Submit" on review_pages → existing `finalizeSubmit` builds multi-page PDF and calls `onComplete`.

**Acceptance:**
- Scan 4 paystubs in one session: each page captured via live preview, all four bundle into one PDF.
- Cancel mid-session: existing cleanup works (already covered by F1's stream cleanup).

---

### F5 — Fallback, browser support, polish

**Files:**
- Modify: `LivePreviewStage.tsx` — error states.
- Modify: `DocumentScanner.tsx` entry stage — conditional routing.
- New tests: `components/DocumentScanner/__tests__/stabilityTracker.test.ts` — unit tests for the pure stability logic.

**Behavior:**
- Browser support detection happens once on entry-stage mount; cached. Detection: `typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !isIOSDevice()`.
- If supported: entry stage shows "Scan document" as primary, "Take photo" / "Choose file" as small text-buttons below.
- If unsupported: entry stage shows today's exact layout (no regression).
- If permission denied at runtime: stuck inline in entry stage with the explanatory text + fallback buttons.
- Low-light handling: if video stream brightness (mean Y in the detection frame) < threshold for 3 consecutive seconds, surface "It's dark — try moving to better light" as a non-blocking toast above the overlay.

**Acceptance:**
- Desktop Chrome with no webcam: entry stage shows fallback buttons, no "Scan document" button rendered.
- Android Chrome with denied permission: entry stage shows fallback buttons + explanatory text.
- iPhone Safari (iOS 14.3+): entry stage shows "Scan document" primary CTA. Tapping it opens the live preview (same as Android). Path 1 fallback ("Choose file" secondary text-link) still works for tenants who want the iOS Files app.
- Unit tests pass: stabilityTracker correctly classifies seeking / unstable / warming / armed states across synthetic quad sequences.

---

## Data Model

No schema changes. No migrations.

---

## Integration Points

- `components/DocumentScanner/DocumentScanner.tsx` — entry stage routing, new `'live_preview'` stage, multi-page add-page routing.
- `components/DocumentScanner/translations.ts` — new strings in en/es/pt.
- `components/DocumentScanner/LivePreviewStage.tsx` — new component.
- `components/DocumentScanner/QuadOverlay.tsx` — new component.
- `components/DocumentScanner/FirstScanTooltip.tsx` — new one-time tutorial overlay.
- `components/DocumentScanner/usePermissionPrompt.ts` — new hook.
- `components/DocumentScanner/edgeDetectionLoop.ts` — new helper.
- `components/DocumentScanner/stabilityTracker.ts` — new helper.
- `components/DocumentScanner/__tests__/stabilityTracker.test.ts` — new unit tests.
- `components/pbv/cards/DocumentCard.tsx` — no changes (it consumes `DocumentScanner` via its public API, which is unchanged).
- `components/portal/FileUploadTask.tsx` — no changes (inherits the new behavior automatically).
- `package.json` — no changes.

---

## Implementation Phases

Five phases, target 3-4 working days.

### Phase 1 — Camera plumbing + permission UX + discoverability (target: 5-7 hrs)

**Build:**
- `usePermissionPrompt.ts` with soft pre-prompt state machine.
- `LivePreviewStage.tsx` skeleton — mounts video element, gets stream, displays it, has Cancel button.
- `FirstScanTooltip.tsx` one-time tutorial overlay + `localStorage` persistence.
- Entry-stage conditional routing in `DocumentScanner.tsx` (no iOS exemption — `liveSupported` purely from `getUserMedia` availability).
- Single primary "Scan document" CTA + small secondary text-links for "Take photo · Choose file" when supported.

**Done when:**
- On Android Chrome AND iPhone Safari AND desktop Chrome with webcam: tap "Scan document" → soft pre-prompt → Allow → live video plays.
- On unsupported browsers (no `getUserMedia`): entry stage shows today's exact two-button layout. No regression.
- Cancel cleanly stops the stream (`stream.getTracks().forEach(t => t.stop())` — verify camera indicator clears).
- Permission-denied path falls back to entry-stage with fallback buttons + explanatory text.
- First-scan tooltip shows once per device, dismisses on tap/timeout/first-capture, persists to `localStorage`.
- `npm run build` zero errors.

### Phase 2 — Edge detection + overlay (target: 6-8 hrs)

**Build:**
- `edgeDetectionLoop.ts` with rAF-driven throttled loop + adaptive fps.
- `QuadOverlay.tsx` canvas-on-video positioning with ResizeObserver.
- Wire into `LivePreviewStage.tsx`.

**Done when:**
- Hold a real paystub in frame on an Android device: green quad outlines doc edges in <250ms.
- Move doc: quad follows.
- Block doc: overlay disappears.
- Detection wall time logged to console in dev mode (no telemetry yet, just dev console).
- No layout shift on viewport resize.

### Phase 3 — Stability + auto-snap (target: 4-6 hrs)

**Build:**
- `stabilityTracker.ts` (pure, easy to unit test).
- Wire to overlay color states.
- Trigger capture on `stable_armed`.
- Manual "Capture now" button.
- Unit tests for `stabilityTracker.ts`.

**Done when:**
- Hold doc steady: auto-snap fires within ~1.5s, routes to existing preview stage.
- Wobble continuously: never snaps.
- Tap "Capture now" mid-wobble: captures, routes to preview.
- `npm test` passes new tests + all existing.

### Phase 4 — Multi-page routing (target: 2-3 hrs)

**Build:**
- Change "Add page" button in `review_pages` stage to route to `live_preview` instead of `entry` when `liveSupported` is true (applies to every supported device including iOS).

**Done when:**
- Scan 4 paystubs in one session: all bundle into one PDF via existing pipeline.
- On unsupported browsers: Add page still goes to entry stage (no regression).

### Phase 5 — Fallback polish + verification + tenant comprehension (target: 4-5 hrs)

**Build:**
- Low-light toast.
- Browser-support detection cached on entry-stage mount.
- Manual cross-device test matrix: Android Chrome (Pixel-class), Android Chrome (low-end like Samsung A-series if available), iPhone Safari (live preview works AND Path 1 fallback through "Choose file" still routes to iOS picker), desktop Chrome with and without webcam.
- **Tenant comprehension test (new).** Send the staging link to one real tenant (or one staff member who has never seen the scanner) with NO instructions beyond "upload your paystub." Watch over their shoulder or have them screen-record. Did they tap "Scan document"? Did they understand the live preview? Did they hold the doc still? Did they reach a successful upload without help? Record findings in build report.
- Build report with all grep evidence + screenshots.

**Done when:**
- All Verification Gates below pass.
- Build report posted with raw grep output, device matrix, screenshot evidence, tenant-comprehension test result.

---

## Acceptance — what "done" looks like

- Tenants on Android Chrome, iPhone Safari, and desktop Chrome (with webcam) all see the same single-primary "Scan document" CTA. Tapping it opens a live-preview scanner with edge detection and auto-snap.
- Permission denial, no camera, and unsupported browsers all fall back to today's flow with no errors.
- Multi-page scans route back into live preview after each page.
- A real paystub photographed at a 30° angle in normal indoor light produces a clean, dewarped, legible scan in under 3 seconds from tapping "Scan document" to seeing the preview.
- First-scan tooltip appears once per device, never again.
- Tenant comprehension test passes: one cold tenant/staff member reaches a successful upload with no instructions.
- Zero new dependencies in `package.json`.
- Zero regression in the compliance portal flow (same `DocumentScanner` consumed by `FileUploadTask.tsx`).
- Path 1's `<input>` `capture` removal stays intact (fallback "Choose file" path on iOS still gives tenants Photo Library / Files access).

---

## Architecture Rules (binding)

- **No new dependencies.** jscanify + opencv.js + pdf-lib + heic2any only.
- **Stream cleanup is non-negotiable.** Every code path out of `LivePreviewStage` must call `stream.getTracks().forEach(t => t.stop())`. Leaking the camera feed will flash the recording indicator and freak tenants out.
- **No device-class branching for the primary path.** Support is detected purely by `!!navigator.mediaDevices?.getUserMedia`. No `isIOSDevice()` checks in PRD-45 code. iOS, Android, and desktop all hit the same code path.
- **Path 1 stays.** The `capture` attribute on the fallback `<input>` remains conditional on `isIOSDevice()` per Path 1's existing code. Do not undo Path 1.
- **Pure functions stay pure.** `stabilityTracker.ts` and `edgeDetectionLoop.ts` must be testable without DOM. Side effects live in `LivePreviewStage.tsx`.
- **No new translations gaps.** Every new string lands in en/es/pt at build time. No English-fallback TODOs.
- **No telemetry.** Defer to a follow-up.
- **Public API of `DocumentScanner` does not change.** `DocumentCard.tsx`, `TenantDocumentUpload.tsx`, `FileUploadTask.tsx` callers are untouched.

---

## Verification Gates

1. `npm run build` zero errors. Strict TS — no new `any`.
2. `npm test` passes existing + new `stabilityTracker` tests.
3. Grep audit (raw output in build report):
   - `grep -n "isIOSDevice" components/DocumentScanner/` — should appear ONLY in the existing Path 1 helper + the `<input>` capture conditional. Must NOT appear in `liveSupported` logic, `LivePreviewStage.tsx`, or any new PRD-45 code.
   - `grep -rn "getUserMedia" components/DocumentScanner` — appears in `usePermissionPrompt.ts` only.
   - `grep -rn "getTracks" components/DocumentScanner` — appears at every unmount/cancel path (count and list them).
   - `grep -rn "DocumentScanner" components app lib --include="*.tsx" --include="*.ts"` — no new external callers introduced.
4. Manual device test matrix:
   - Pixel-class Android Chrome: live preview, auto-snap, multi-page.
   - Low-end Android (if available): live preview at adaptive fps, no UI lock.
   - iPhone Safari (iOS 14.3+): live preview works (same UX as Android), auto-snap fires, multi-page works.
   - iPhone Safari: secondary "Choose file" text-link still routes to iOS file picker (Path 1 fallback intact).
   - Desktop Chrome with webcam: live preview works.
   - Desktop Chrome without webcam: fallback to file picker, no error.
   - Permission denied on each device: fallback works.
5. Real-world capture quality: photograph a paystub at 30° in normal indoor light → final uploaded image is dewarped, edges aligned, text legible. Attach before/after to build report.
6. Compliance portal smoke test: upload a doc via the compliance flow (which uses the same `DocumentScanner`) → confirm no regression.
7. Tenant comprehension test (Phase 5): one cold user reaches successful upload with no instructions. Record narrated screen capture in build report.

If any of 1-7 fails: **stop. Report. Do not declare complete.**

---

## Out of Scope (deferred to future PRDs)

- Torch / flashlight button (v2 after we see lighting failure rates).
- Front-camera toggle (not needed for documents).
- Barcode/QR scanning.
- Telemetry on capture success rate, time-to-stable, retake rate.
- Server-side image re-validation.
- Commercial SDK swap (separate decision; jscanify ships in v1).
- Capacitor/native wrap (separate strategic decision).
- Cross-browser keyboard accessibility for the live preview (touch-first; keyboard can use fallback buttons).
- Forcing or hiding iOS's Apple-native scanner (we run our own primary scanner now; the buried Apple option remains technically reachable via the secondary "Choose file" link → Files app → ⋯ — no action needed either way).

---

## Notes

- This PRD assumes Path 1 (iOS native scanner enablement) is already shipped and verified on a real iPhone. If Path 1 verification turns up a problem, fix that first before starting PRD-45.
- The Android scanner pattern (`getUserMedia` + per-frame contour detection on canvas + auto-snap on stability) is well-trodden. Open-source references exist for visual sanity-checks during build — `jscanify`'s own docs include a live preview demo at `node_modules/jscanify/docs/`.
- After PRD-45 ships, the next strategic question is whether jscanify's detection quality is good enough or whether a commercial SDK is worth the $5-15k/year. That decision should be data-driven: collect 1-2 weeks of real tenant scans, measure illegibility rate, decide. Do not pre-commit to a commercial SDK.
