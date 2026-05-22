# Batch 04 — Mobile/Cross-Browser & Performance Summary (PRP-014..017)

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`

## Per-PRP commits
| PRP | Slug | Commit | Per-PRP gates |
|-----|------|--------|---------------|
| 014 | dynamic-viewport-height-sweep | `d7c2520` | tsc ✅ ; vitest 4/4 ✅ |
| 015 | intake-navigation-and-deeplink-integrity | `1810be6` | tsc ✅ ; vitest 7/7 ✅ |
| 016 | scanner-and-camera-mobile-correctness | `d188b23` | tsc ✅ ; vitest 9/9 ✅ |
| 017 | render-path-performance-and-motion | `72edebc` | tsc ✅ ; vitest 11/11 ✅ ; build ✅ |

## Batch-boundary gates
- **Full `npm run build`** — **clean** (run as part of PRP-017's per-PRP build).
- **`pdf-lib` is only in a lazy chunk** — confirmed: `find .next/static/chunks -name "*.js" | xargs grep -l "PDFDocument\.create"` matches only `.next/static/chunks/5969.140a517b5f73b678.js` (412 KB). No match in `framework-*.js`, `main-*.js`, or `main-app-*.js`. Closes PRP-016 B1.
- Cross-batch invariants preserved:
  - PRP-010's `beforeunload` guard on `intake/[section]/page.tsx` — still present after PRP-015 layered its nav/deep-link/scroll changes. Confirmed via `lib/__tests__/beforeunload-guards.test.ts` still 6/6 green.
  - PRP-005's `required-signer` union in `generate-forms/route.ts` — still present after PRP-017's stamping-region edits. Asserted by a dedicated regression test in `prp017-render-and-motion.test.ts`.

## Pattern sweep
- **Other `vh` containers** in tenant code (outside this batch's scope):
  - The `min-h-dvh` conversion in tenant page.tsx is local to that file. Other tenant routes (`/dashboard`, `/documents`, `/sign/*`, `/intake/...`) use `min-h-screen` on their own outer divs — same iOS toolbar trap. Follow-up: a tenant-wide `min-h-screen` → `min-h-dvh` sweep across `app/pbv-full-app/**/page.tsx`.
- **Other eager heavy imports:** none found via spot-check; `lucide-react` / `@dnd-kit/*` are already in `optimizePackageImports`. The big eager dep was `pdf-lib`; that's now lazy. `heic2any` and `sharp` are already dynamic-imported.

## Deferred runtime gates (need a preview + a real device)
- iPhone Safari: open `MagicLinkSigningFlow`, tenant `page.tsx`, the scanner preview — toolbar expansion no longer hides bottom CTAs.
- Samsung Internet: scanner opens the rear camera (no NotFoundError); HEIC upload → "Converting photo…" announces.
- Deep-link `/intake/income` before household done → `router.replace` to `/intake/household`.
- OS reduced-motion toggle → no page transitions, no progress-bar slide.
- 10-member generate-forms run → per-form stamp ms log lines; total under 60s.
- View-source tenant page → some non-trivial HTML before hydration (currently still mostly blank — full SSR or loading.tsx is the follow-up).

No PR opened — per the protocol the single PR opens at end of Batch 05.
