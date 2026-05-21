# PRD-60 — Scanner: Device-Matrix Verification + Low-Contrast / Can't-Lock Hint

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization` (shared batch branch — see `BATCH-RUN-PROTOCOL.md`)
**Status:** Draft — ready for build
**Severity:** P2 — capture-quality (a tenant who can't lock onto a page and gets no guidance abandons the upload or sends an unreadable photo)
**Depends on:** nothing — independent track. The advanced edge-detection scanner (Scanic) already shipped to `main` via PRD-52 (launch merge `2026-05-19`). This PRD builds on it; it does **not** re-pilot the detector.
**Blocks:** nothing. Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`, roadmap row PRD-60 / gap G8).

---

## Problem Statement

The scanner now runs the Scanic detector on `main` (PRD-52: `scanic ^1.0.8`, loaded from `public/scanic/scanic.umd.cjs` via `ensureScanicLoaded` in `LivePreviewStage.tsx`). It detects page edges live, draws a quad overlay, and auto-captures when stable. But two things are still open from the roadmap (G8):

1. **No clear "why" when it can't find the page.** When the detector returns no valid quad for a stretch — the common real-home case of white paper on a light wood floor / poor lighting — the tenant just sees the camera with no overlay and nothing telling them what to change. There **is** a stuck banner from PRD-47 (`isStuck` → `t.stuckHint` / `t.stuckHintSecondary` in `LivePreviewStage.tsx:280-285`), but it only fires after a full **8s** of continuous `seeking`, and it renders as an opaque amber card pinned to the top. Alex's explicit ask is a faster, transparent on-screen hint that names the fix (more light / darker surface) and doesn't cover the controls. [Inference] the 8s threshold + opaque card is why it reads as "nothing happened" in practice.

2. **The real-device gates from PRD-47/52 were deferred.** PRD-52 Gates 3-7, 10 (high-contrast capture, low-contrast capture, cellular cold-load time, iOS Safari + Android Chrome matrix, narrow viewport, large-text, 5-min memory) and PRD-47 Gates 1-4, 7 all say "manual test required" — they were never run on real hardware because mid-run deploys aren't possible. They remain unverified.

This PRD has two parts. **Part A** (the primary, buildable deliverable) is the contrast/can't-lock hint, hooked into the detector's existing no-quad signal. **Part B** is verification: confirm the Scanic detector is intact on the branch and enumerate the deferred device-matrix gates for the post-run real-device pass.

---

## Current state (confirmed in code 2026-05-20)

| Item | Where | Notes |
|---|---|---|
| Detector = Scanic | `package.json` (`scanic ^1.0.8`, `postinstall: sync-scanic.mjs`); `LivePreviewStage.ensureScanicLoaded` loads `/scanic/scanic.umd.cjs` | PRD-52 shipped. jscanify removed from deps; only a dead `createJscanifyAdapter` factory + `window.jscanify?` type linger in `edgeDetectionLoop.ts` / `DocumentScanner.tsx` (unused) |
| Per-frame detection loop | `components/DocumentScanner/edgeDetectionLoop.ts` | RAF loop @ ~8fps; `adapter.detect()` → `isValidQuad()` filter → `onQuad(quad \| null)`. **`onQuad(null)` is the "no lock this frame" signal.** Also has an `onLowLight` callback (mean-Y < 60 for 3s) |
| Stability tracker | `components/DocumentScanner/stabilityTracker.ts` | `push(quad \| null)` → `seeking` (on null) / `unstable` / `warming` / `armed`. **`{ kind: 'seeking' }` is the "no stable lock" signal** the hint should consume |
| Quality scoring | `components/DocumentScanner/quality.ts` | `evaluateImageQuality()` — post-capture only (blur/brightness/resolution). Not a live signal; not used by the live hint |
| Existing stuck banner (PRD-47) | `LivePreviewStage.tsx:123-125` (`isStuck` state), `:207-215` (8s polling effect), `:280-285` (render) | Fires after 8s of no non-`seeking` state. Opaque amber card, top of screen. Suppressed when `showLowLightWarning \|\| !detectionAvailable` |
| Stuck copy (EN/ES/PT) | `translations.ts` `stuckHint` / `stuckHintSecondary` | Already mentions darker surface / better light + "tap Capture anyway." Good wording; this PRD reuses/refines it |
| Low-light banner | `LivePreviewStage.tsx:268-272` (`t.lowLightWarning`) | Separate, opaque amber card; fires off `onLowLight`. Takes precedence over the stuck banner today |
| Manual-capture fallback | `LivePreviewStage.tsx:274-278` (`detectionAvailable === false`) | Shown when Scanic fails to load. Unchanged by this PRD |
| Test runner | `package.json` (`test: vitest run`); existing `lib/stabilityTracker.test.ts` | Vitest. Pure-function tests live next to or under `lib/`/`components/` and import from `components/DocumentScanner/*` |

---

## Goals

1. When the detector can't lock onto a page for a short window (faster than the current 8s), the tenant sees a **transparent overlay hint** that names the fix — more light, or a darker surface — and **does not block** the Capture / Cancel controls.
2. The hint is wired into the **existing** detection signal (`onQuad(null)` / `StabilityState.kind === 'seeking'`), not a new parallel detector. No second edge-detection pass, no new camera read.
3. The hint clears automatically the moment a valid quad locks (any non-`seeking` state).
4. Copy is in EN / ES / PT via `translations.ts`.
5. The trigger ("no lock for N seconds → hint") is a small pure helper with a vitest unit test, so the timing logic is testable without a camera.
6. The Scanic detector is confirmed intact on the branch (loads, detects, `tsc`/`build` clean); the deferred real-device gates from PRD-47/52 are enumerated for the post-run pass.
7. The Scanic-in-or-out decision (PRD-52) is logged: **default IN / keep** for v1; only reconsider if the device-matrix pass shows it too heavy/unreliable.

## Non-goals

- **No new detector and no detector swap.** Scanic stays. This PRD does not touch `ensureScanicLoaded`, the Scanic adapter, the WASM/sync plumbing, or `edgeDetectionLoop`'s detection math beyond reading its existing `onQuad`/`onLowLight` outputs.
- **No tuning of Scanic thresholds, `isValidQuad`, or the stability tracker** — the hint is a UI/feedback layer, not a detection change.
- **No change to `quality.ts`** or the post-capture warning flow (blur/dark/low-res, "no document detected" confirm).
- **No removal of the dead jscanify factory** here (out of lane; flag in build report if noticed).
- **No real-device automation.** The device matrix is a manual post-run pass; this PRD documents it, it does not block on it.

---

## Decisions

- **D1 — Refine, don't duplicate.** The contrast hint extends the existing PRD-47 `isStuck` mechanism rather than adding a parallel timer. The build either (a) lowers/configures the existing `isStuck` threshold and re-styles the banner as a transparent overlay, or (b) introduces one small pure helper that the existing polling effect calls. Either way there is exactly one "no-lock" timer. [Inference] (a)+(b) combined is cleanest: extract the timer into a tested helper and feed the existing `isStuck` state.
- **D2 — Transparent, non-blocking.** The hint is a semi-transparent overlay (e.g. `bg-black/55` text band) positioned so it does not overlap the bottom Capture/Cancel button stack. It is informational, never modal, never intercepts taps on the controls.
- **D3 — Faster than 8s.** Default trigger window is **3.5s** of continuous `seeking` (no valid quad). [Inference] 3.5s is long enough to avoid flicker while panning to the page, short enough to feel responsive. Tunable via a single constant; logged to OPEN-DECISIONS if changed.
- **D4 — Reuse copy.** Reuse `stuckHint` / `stuckHintSecondary` (already EN/ES/PT, already says "darker surface / better light / Capture anyway"). Add a single concise overlay string only if the existing copy doesn't fit a transparent one-line band; if added, it goes in all three languages.
- **D5 — Scanic stays IN for v1.** Per the roadmap scope lock, keep the advanced detector. Scanic-out is only revisited if the device-matrix pass proves it too heavy/unreliable. Logged to OPEN-DECISIONS as a DECISION.
- **D6 — Low-light precedence preserved.** The existing low-light banner (`onLowLight`) still takes precedence; the contrast hint suppresses itself when the low-light banner is showing, as the stuck banner does today.

---

## Implementation phases

### Phase 1 — Extract the no-lock timer into a tested helper (Part A core)
- Add a small pure module, e.g. `components/DocumentScanner/lockTimeout.ts`, exposing a tracker like `createLockTimeoutTracker({ thresholdMs })` with a `tick(now, isLocked) → boolean` (or `update(stabilityState, now)`) that returns whether the "no-lock hint" should currently show. `isLocked` is derived from `StabilityState.kind !== 'seeking'` (a quad is locked) — it reads the **existing** signal, computes nothing about the image itself.
- The helper holds the "last time we were locked" timestamp and the threshold (default 3.5s, D3). It is framework-free and deterministic given an injected `now`, so it unit-tests cleanly.

### Phase 2 — Wire the helper into LivePreviewStage
- Replace the inline 8s `lastNonSeekingAtRef` / polling logic (`LivePreviewStage.tsx:123-125, 207-215`) so the single timer comes from the Phase 1 helper. Feed it the `StabilityState` already produced in the `onQuad` callback (`LivePreviewStage.tsx:177-184`).
- Drive a `showContrastHint` boolean from the helper. Keep the existing suppression rules: hide when `showLowLightWarning` or `!detectionAvailable` (D6).
- Clear immediately on any non-`seeking` state (a quad locked) — already the reset path; keep it.

### Phase 3 — Transparent, non-blocking overlay (Part A UI)
- Render the hint as a semi-transparent band (D2), positioned clear of the bottom Capture/Cancel stack (`LivePreviewStage.tsx:307-328`). `pointer-events-none` on the hint container so taps fall through to the controls.
- Use `t.stuckHint` (primary) + `t.stuckHintSecondary` (the "or tap Capture anyway" line). Add a one-line `t.contrastHint` only if needed for the band (D4), in EN/ES/PT.

### Phase 4 — Verify the detector is intact + close/enumerate device-matrix gates (Part B)
- Confirm statically: Scanic still loads via `ensureScanicLoaded` (`public/scanic/scanic.umd.cjs` present, `postinstall` sync intact), the Scanic adapter is the only one wired in `LivePreviewStage` + `DocumentScanner.processImageBlob`, `tsc --noEmit` + `npm run build` clean.
- Enumerate every deferred real-device gate (below) in the build report under "Deferred runtime gates."
- Log the Scanic-in decision (D5) and the hint-threshold default (D3) to OPEN-DECISIONS.

---

## Verification / test plan

### Static (must pass in-session before commit)
- **Gate S1 (hint trigger):** vitest unit test on the Phase 1 helper — given a `now`-injected sequence, it returns `false` while locked, `false` before the threshold elapses with no lock, `true` once `thresholdMs` of continuous no-lock passes, and `false` again immediately after a lock. Boundary case at exactly `thresholdMs`.
- **Gate S2 (signal source):** code inspection confirms the hint reads `StabilityState`/`onQuad(null)` and adds **no** new image read or detector call (grep: the hint path does not call `adapter.detect`, `scanner.scan`, `getImageData`, or load anything).
- **Gate S3 (non-blocking):** the hint container is `pointer-events-none` and positioned clear of the bottom button stack; Capture/Cancel remain tappable while it shows (inspection + the existing render structure).
- **Gate S4 (translations):** any string the hint uses exists in EN/ES/PT in `translations.ts`; no English fallback in es/pt.
- **Gate S5 (build/types):** `node ./node_modules/typescript/bin/tsc --noEmit` clean; `npm run build` clean; `vitest run` green.

### Deferred runtime gates (real devices — list in build report, do NOT block)
- **Gate R1 (hint fires):** on a real low-contrast scene (white paper, light wood floor, dim room) the transparent hint appears within ~3.5s and the controls stay tappable.
- **Gate R2 (hint clears):** moving the page onto a darker surface / improving light locks a quad and the hint disappears immediately; auto-capture still fires.
- **Gate R3 (iOS Safari):** iPhone, current iOS + iOS 16 — Scanic loads, detects on a high-contrast scene, captures, advances to review (PRD-52 Gate 7).
- **Gate R4 (Android Chrome):** same walk (PRD-52 Gate 7).
- **Gate R5 (cold-load time):** Fast-3G cold load → tap Scan → time to first quad overlay; record the number (PRD-52 Gate 5).
- **Gate R6 (5-min memory):** scanner open on a scene 5 min, heap not growing unboundedly, `window.__scanicInstance` reused across mount/unmount (PRD-52 Gate 10).
- **Gate R7 (narrow + large-text):** iPhone-SE 375px width and 200% root font — hint band + controls reflow without horizontal overflow (PRD-46/47 territory).

---

## Open questions

- **O1:** Is 3.5s the right window, or should the hint be even faster (e.g. 2.5s)? Default 3.5s, tunable via one constant; confirm against a real-device feel test (Gate R1). Logged to OPEN-DECISIONS.
- **O2:** Does the existing `stuckHint` copy read well in a one-line transparent band, or is a shorter `contrastHint` string needed? Default: reuse `stuckHint`; add `contrastHint` only if the band is cramped. (Resolve during build by inspection on a 375px frame.)
- **O3:** Should the dead `createJscanifyAdapter` factory + `window.jscanify?` type be removed? Out of this lane — flag in build report, do not remove here.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `components/DocumentScanner/lockTimeout.ts` (new) | 1 | pure no-lock-timer helper (default 3.5s), `now`-injectable |
| `components/DocumentScanner/lockTimeout.test.ts` (new) or under `lib/` | 1 | vitest unit test for the trigger (Gate S1) |
| `components/DocumentScanner/LivePreviewStage.tsx` | 2, 3 | replace inline 8s timer with the helper; render transparent non-blocking hint clear of the controls |
| `components/DocumentScanner/translations.ts` | 3 | add `contrastHint` in EN/ES/PT **only if** a one-line band string is needed (else reuse existing keys) |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | 4 | log D3 threshold + D5 Scanic-in decision |

If anything outside this list needs changing (e.g. `edgeDetectionLoop.ts` detection math, `quality.ts`, the Scanic plumbing), stop and report rather than expanding scope.
