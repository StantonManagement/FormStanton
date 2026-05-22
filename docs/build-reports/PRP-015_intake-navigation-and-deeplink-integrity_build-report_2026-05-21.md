# PRP-015 — Intake Navigation & Deep-Link Integrity — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `1810be683bba202c2aa6b0f9c0556ce247d85050`
**Findings closed:** Angle-2 **E1**, **F1**, **F2**; mobile review §8.2. **F4 deferred** (UX-ambiguous; documented).

## Files changed
- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — functional-updater merge, resume-section guard, scroll-to-top after `router.push`. PRP-010 `beforeunload` guard preserved.
- `app/pbv-full-app/[token]/documents/page.tsx` — `?filter=` allow-list coercion.
- `components/pbv/__tests__/intake-nav-deeplink.test.ts` *(new)* — 7 tests.

## Path taken (defaults logged)
- **E1 functional updater** picks the freshest live value via `setLocalIntakeData(prev => …)`. The previous code closed over `intakeData` (the bootstrap snapshot or whatever was current at callback creation) and dropped the eslint-warning with a disable comment. Empty deps → stable callback reference (downstream memos no longer churn).
- **F2 redirect uses `router.replace` (not `push`)** so the bad URL doesn't pollute history — the back button on the resume section should go to wherever the user came from, not back to the over-eager deep link.
- **F2 review section** is always allowed through (it has its own readiness gate elsewhere).
- **§8.2 scroll** uses `behavior: 'smooth'` which honors the OS-level `prefers-reduced-motion` setting (no extra handling needed).
- **F1 allow-list** coerces unknown values to `null` silently rather than 400-ing. The PRP allowed either; coercing keeps the UX forgiving (no console clutter, no crash).
- **F4 back-button** kept as-is. The PRP marked it UX-ambiguous and explicitly said "if unresolved, keep current behavior" — done. Recorded here as the documented default.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/__tests__/intake-nav-deeplink.test.ts` — **7 pass / 0 fail / 4.20 s.**
- `lib/__tests__/beforeunload-guards.test.ts` (PRP-010) — **6/6 still green** (confirms the layered changes didn't regress).

## Deferred runtime gates
- Deep-link `/intake/income` before `household` is complete → `router.replace` lands on `/intake/household`.
- Section change on iPhone → page lands scrolled to the top.
- `?filter=hack`, `?filter=`, `?filter=undefined` → silently ignored, no crash, no error log.
- Confirm desktop back button still steps section-by-section (current behavior preserved per F4).

## Notes
- The resume-section guard only redirects forward, never backward — completed sections remain navigable.
- The intake page now imports `useEffect` from React; previously only `useState` + `useCallback` were imported.
