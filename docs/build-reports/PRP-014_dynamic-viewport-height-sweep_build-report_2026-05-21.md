# PRP-014 — `dvh` Sweep — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `d7c2520d33a3e4068f8f1bd31857f1e20f2c49b6`
**Findings closed:** mobile review §1.3, §9, §5.1.

## Files changed
- `components/pbv/sign/MagicLinkSigningFlow.tsx` — four `height: 40vh` → `height: 40dvh` inline styles on standalone PDF iframe containers.
- `app/mobile-styles.css` — `input[type="date"]` added to the multi-selector 16px rule.
- `components/pbv/__tests__/dvh-sweep.test.ts` *(new)* — 4 regression tests.

## Path taken (defaults logged)
- **No `vh` fallback** alongside `dvh`. Modern browsers (Safari 15.4+, Chrome 108+, Firefox 101+ — all 2022+) support `dvh`; older browsers degrade to natural height + `overflow-y-auto`. The PRP allowed either pattern; we picked the simpler one consistent with PRP-007's choice in the signing modals.
- **`SectionDvHomelessRa` verified clean** — no `vh` usages, no fixed heights, no `h-[Nvh]` arbitrary values. The mobile review's "needs verification" flag is closed with a regression test.
- **No other-PRP files touched.** Listed handoffs in commit message: signing modals → PRP-007, dashboard page shell → PRP-017, intake `[section]` page → PRP-010/015, scanner → PRP-016.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/__tests__/dvh-sweep.test.ts` — **4 pass / 0 fail / 4.54 s.**

## Deferred runtime gates
- iPhone Safari: open a magic-link signing flow, expand the URL bar → Sign button stays reachable; PDF iframe resizes without distortion.
- Tap a date input in production (intake personal-info section, etc.) → no zoom; native picker opens at the right size.
