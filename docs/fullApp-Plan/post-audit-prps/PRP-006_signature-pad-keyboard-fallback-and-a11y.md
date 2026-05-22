# PRP-006 — Signature-Pad Keyboard Fallback & Accessibility

**Assigned batch (per BATCH_PLAN.md):** 02
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **A1** (Critical), **A3** (sig-pad part), **A4** (typed-name input); `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §4.2 (canvas resize/DPR).
**Depends on:** None — operates on current `main`. (Uses the existing `signature/capture` flow's image contract unchanged.)
**Inputs (read before editing):** `components/pbv/sign/SignaturePadGate.tsx` (~114–141), the `SignatureCanvasComponent` it renders, and the `signature/capture` request to confirm the captured-image format it expects (PNG/JPEG bytes).
**Outputs (write — the ONLY files this PRP may modify/create):** `components/pbv/sign/SignaturePadGate.tsx`, the `SignatureCanvasComponent` source file, new test(s).
**Acceptance criteria:**
- A keyboard-reachable, non-drawing signature path exists (typed-signature rendered to the existing image contract, or a discoverable staff-assisted override).
- Signature errors render in an `aria-live="polite" role="status"` region; the typed-name input has `aria-describedby` to its error.
- Canvas resizes on orientation/container change and scales by `devicePixelRatio` (crisp on Retina); `touch-action:none` preserved.

## Context (self-contained)
The legally-required signature step is a `<canvas>` drawn with mouse/touch. Keyboard-only and motor-impaired users cannot complete it — there is no typed/keyboard/assisted fallback. Errors are static `<p>` text (not announced), the typed-name input isn't linked to its error, and the canvas is a fixed 140px with no resize/DPR scaling (distorts on rotate, blurry on Retina). The downstream `signature/capture` endpoint consumes image bytes — a typed-name fallback must render to that same image format so no server change is needed.

## Problem
- **A1:** no non-drawing signature path (keyboard/motor users blocked).
- **A3:** sig-pad errors not announced.
- **A4:** typed-name input lacks `aria-describedby`.
- **mobile §4.2:** no canvas resize / DPR scaling.

## Goals
1. **A1:** add a keyboard-reachable "Type your signature" fallback (typed full name rendered to an offscreen canvas in a script font, exported to the **existing** `signature/capture` image format), validating the name per the existing confirmation rule. (If a staff-assisted override is the chosen design instead, route to the existing assisted path — default to typed-signature as it self-serves.)
2. **A3/A4:** wrap errors in `aria-live="polite" role="status"`; give errors stable ids referenced by the input via `aria-describedby`.
3. **mobile §4.2:** `ResizeObserver` (or resize/orientation listener) sets width from the container + a comfortable height (≥~200px or ~25vh); scale the backing store by `devicePixelRatio`; preserve `touch-action:none`.

## Non-goals
- No change to the signing ceremony hook or `signature/capture` server logic. No visual redesign beyond the fallback + resize. `willReadFrequently` hint only if trivial (H3 is monitor-only). Do not edit files outside the Outputs list.

## Implementation
1. Typed-signature fallback rendering to the existing image contract (confirm the format first).
2. `aria-live` error region + `aria-describedby` association.
3. `ResizeObserver` + DPR scaling; preserve any in-progress stroke across resize if the lib API allows, else resize before drawing.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the touched paths — fallback produces a non-empty image of the expected type; Submit with no signature shows an error inside an `aria-live` region; typed-name input has `aria-describedby` to the error id.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** Tab to the signature step → use the typed fallback end-to-end → finalize; axe scan clean on the signing page; NVDA/VoiceOver announces the no-signature error; rotate iPhone → canvas resizes without distortion, crisp on Retina.
