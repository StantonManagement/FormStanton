# PRP-007 — Signing-Modal Focus, A11y & Mobile Viewport — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `3fc1c0f8d2b29280315f88582f7af5f639ee7ab2`
**Findings closed:** Angle-2 A2 / A3 / A4 / B3; mobile review §1.3, §9, §3.2.

## Files changed
- `components/pbv/sign/FormReviewSignModal.tsx` — focus trap hook, role=dialog + aria-modal + aria-labelledby, aria-live error region, aria-describedby/aria-invalid typed-name input, iframe loading=lazy (both branches), max-h-[90dvh] / h-[40dvh], EN/ES/PT scroll-cue.
- `components/pbv/sign/SummaryDocReviewSign.tsx` — iframe loading=lazy, h-[60dvh], EN/ES/PT scroll-cue.
- `components/pbv/sign/__tests__/FormReviewSignModal.test.tsx` *(new)* — 7 tests.

## Path taken (defaults logged)
- **No new focus-trap dep.** A small `useModalFocusTrap` hook (~50 LOC) captures the trigger via `document.activeElement` on mount, moves focus inside via `setTimeout(0)`, intercepts Tab/Shift-Tab via capture-phase keydown listener, and restores on unmount. No need for `focus-trap-react` (~30 KB gzipped).
- **dvh strategy:** Tailwind ^3.3.0 doesn't ship dvh keyword utilities, but arbitrary values (`h-[40dvh]`, `max-h-[90dvh]`) pass through unmodified — supported by all current modern browsers (Safari 15.4+ / Mar 2022, Chrome 108+ / Nov 2022, Firefox 101+ / May 2022). Older browsers treat the unknown unit as invalid and the modal becomes naturally sized + `overflow-y-auto` still scrolls; degraded but functional.
- **`SummaryDocReviewSign` is not a modal** — full-page screen — so no focus trap. Its only PRP-007 scope is iframe lazy + dvh + scroll cue.
- **Scroll-cue residual:** the iframe still traps touch-scroll inside its own document on iOS Safari. The cue tells users to scroll the outer panel; documented as the chosen mitigation per PRP-007.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/sign/__tests__/FormReviewSignModal.test.tsx` — **7 pass / 0 fail / 5.58 s.**

## Deferred runtime gates
- iPhone Safari: open the form modal → Sign button reachable without toolbar overlap (dvh); rotate device → modal resizes cleanly.
- Tab through both modal branches end-to-end → focus stays inside; Esc closes and the focus returns to the dashboard button that opened the modal.
- NVDA / VoiceOver: trigger a server-side error in the confirm-only flow → live region reads it; the input's accessible name + description include the error.
- iframe lazy: in DevTools network panel, the form PDF request fires only when the iframe enters the viewport (not on initial render of a hidden modal).
- axe-core scan on the signing page: zero violations from these two components.

## Notes
- `useId()` (React 18+) provides stable ids that survive SSR/hydration — used for `aria-labelledby` and the error region id so the modal renders identically on both ends.
- `useModalFocusTrap` uses capture-phase `keydown` to intercept Esc/Tab before any nested handler can swallow them.
