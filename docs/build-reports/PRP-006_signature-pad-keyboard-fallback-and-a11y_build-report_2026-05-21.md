# PRP-006 — Signature Pad Keyboard Fallback & A11y — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `ee10d14c4889e5eff2e6657562278790624230c2`
**Findings closed:** Angle-2 A1 / A3 / A4; mobile review §4.2.

## Files changed
- `components/pbv/sign/SignaturePadGate.tsx` — typed-signature mode toggle, error role/live region, aria-describedby/aria-invalid on typed-name input, EN/ES/PT toggle/preview strings, exported helper `renderTypedSignaturePng`.
- `components/SignatureCanvas.tsx` — ResizeObserver + orientation listener, DPR-scaled backing store, role=img + aria-labelledby + aria-describedby on the wrapper.
- `components/pbv/sign/__tests__/SignaturePadGate.test.tsx` *(new)* — 7 tests.

## Path taken (defaults logged)
- Typed-signature is the default fallback (PRP allowed this OR routing to staff-assisted; typed-signature self-serves keyboard-only users without staff handoff, which matches the PRP's "default to typed-signature" note).
- `aria-describedby` / `aria-invalid` are conditional — only set when an error is visible, so SR doesn't announce "described by ..." on initial load.
- Typed-signature `<canvas>` preview has `role="img"` + `aria-label` set to the typed text so SR users get an audible read of what their signature will be.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/sign/__tests__/SignaturePadGate.test.tsx` — **7 pass / 0 fail / 5.94 s.**

## Deferred runtime gates (need a preview)
- Tab to the signing modal → focus reaches the typed-name input, the toggle button, then the Sign button; activate the toggle with Space/Enter → typed-signature preview replaces the drawing surface; complete a finalization end-to-end via typed-signature (server should accept the PNG without change).
- NVDA / VoiceOver: trigger a name-mismatch → the error is announced via the polite live region; the typed-name input announces "Type your full name … invalid entry. The name you entered does not match…".
- iPhone Safari: rotate device → canvas resizes smoothly without distortion; on Retina the line weight stays crisp (DPR=2 backing store).
- axe-core scan on the signing page: zero violations on the gate (deferred to PRP-022 harness).

## Notes
- `react-signature-canvas` is stubbed in tests because jsdom does not implement enough of the canvas API to drive it; the stub validates the wrapping component's a11y wiring without exercising the third-party lib.
