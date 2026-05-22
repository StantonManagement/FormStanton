# PRP-017 — Render-Path Performance & Motion — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `72edebcb26024dd5a67541fe0c58f453ccac1ab3`
**Findings closed (Phase 1):** Angle-2 **B4**, **B5** (skeleton floor; full SSR deferred), **B6** + **H1**, **A4** (SectionHousehold), **H4**; mobile review §1.3. **Background queue for B4 = follow-up.**

## Files changed
- `app/pbv-full-app/[token]/page.tsx` — bulk `min-h-screen` → `min-h-dvh`; `useReducedMotion` gate.
- `app/globals.css` — `@media (prefers-reduced-motion: reduce)` global override.
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` — per-form `stampMs` log (stamping region only; required-signer region untouched per PRP-005).
- `components/pbv/intake/SectionHousehold.tsx` — `aria-describedby` + onBlur clear on both date inputs.
- `components/pbv/__tests__/prp017-render-and-motion.test.ts` *(new)* — 11 tests.

## Path taken (defaults logged)
- **B5 SSR shell deferred** to a follow-up. The tenant page is `'use client'` top-to-bottom; a real Server Component refactor is high-risk. A `loading.tsx` sibling would render a non-blank skeleton during streaming but is a NEW file outside this PRP's Outputs. Logged as the documented default. The current page already shows a `min-h-dvh` loading state once the JS lands; the gap is only the brief pre-hydration whitespace.
- **B4 background queue deferred.** Per-form timing instrumentation lands; chunking + queue is a separate ~day-long effort and is documented as the follow-up.
- **B6 + H1 reduced-motion** uses BOTH a framer-motion gate AND a global CSS override. Belt-and-suspenders: the JS gate handles framer-motion's page transitions; the CSS rule catches every other animation/transition on the page (progress bar, hover effects, etc.) without needing to know about each one.
- **PRP-005 invariant preserved.** A dedicated regression test asserts the `members.filter(>=18).map(id)` union is still in `generate-forms/route.ts` — proves the stamping-region edits didn't accidentally touch the required-signer region.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/__tests__/prp017-render-and-motion.test.ts` — **11 pass / 0 fail / 4.13 s.**
- `npm run build` — **clean** (this PRP is build-surface; `useReducedMotion` import + motion-props refactor changed the client bundle).
- **Bundle audit (PRP-016 B1 follow-through):** `find .next/static/chunks -name "*.js" | xargs grep -l "pdf-lib\|PDFDocument\.create"` → matches **only** `.next/static/chunks/5969.140a517b5f73b678.js` (412 KB). That's a numbered lazy chunk; `framework-*.js` and `main-*.js` do not contain pdf-lib. ✅ confirmed lazy.

## Deferred runtime gates
- View-source on a tenant URL → some non-trivial HTML (currently mostly the framework shell + initial blank state); follow-up SSR or loading.tsx would deliver real content.
- OS reduced-motion toggle (macOS / iOS / Android) → no page transitions, no progress-bar slide.
- Generate a 10-member, 15-form fixture → per-form `[generate-forms] stamp ...` log lines; total < 60s. If totals approach 90s, the chunking follow-up is required.
- NVDA / Firefox: focus a date input → reads "YYYY-MM-DD"; clear via picker → `dob` empties, `is_minor` re-computes from the empty value.

## Follow-ups
- Add `app/pbv-full-app/[token]/loading.tsx` rendering the IntakeShell-shaped skeleton (closes B5 fully).
- generate-forms chunking: split per-form stamping into batches of N and surface a `progress` SSE / poll endpoint (closes B4 fully).
