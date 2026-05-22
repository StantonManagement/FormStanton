# PRP-017 — Render-Path Performance & Motion

**Assigned batch (per BATCH_PLAN.md):** 04
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **B5** (Medium), **B6**+**H1** (reduced-motion), **B4** (Medium, stamping budget), **A4** (Medium, SectionHousehold inputs), **H4** (Low, Firefox date); `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §1.3 (`page.tsx` `min-h-screen`→dvh).
**Depends on:** **PRP-005** — that PRP edits the **required-signer region** of `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`. This PRP edits a **different region** of the same file (the stamping loop / duration). PRP-005 is in Batch 01 (runs before Batch 04), so layer on its version; **do not touch the required-signer region.**
**Inputs (read before editing):** `app/pbv-full-app/[token]/page.tsx` (~1, `'use client'`; ~5 framer-motion; `min-h-screen`), the sibling tenant `*/page.tsx` shells, `app/globals.css`, `components/pbv/intake/SectionHousehold.tsx` (~239 date input), `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (~165–169 the stamping loop only).
**Outputs (write — the ONLY files this PRP may modify/create):** `app/pbv-full-app/[token]/page.tsx` (+ sibling page shells), `app/globals.css`, `components/pbv/intake/SectionHousehold.tsx`, `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (stamping region only), new test(s).
**Acceptance criteria:**
- Tenant pages render non-blank HTML before hydration (SSR shell or static skeleton).
- Animations respect `prefers-reduced-motion` (framer-motion gate + global CSS override).
- `page.tsx` `min-h-screen`→`min-h-dvh`+fallback.
- `generate-forms` stamping has a timing log (+ chunking/progress if low-risk); the required-signer region is unchanged.
- SectionHousehold inputs have `aria-describedby`; the Firefox date input clears correctly (`computeAge` stays correct).

## Context (self-contained)
Every tenant page is `'use client'`, so the initial HTML is blank until hydration (white screen on slow mobile). framer-motion page transitions + a progress-bar CSS transition run with no `prefers-reduced-motion` guard. `generate-forms` stamps PDFs in a sequential awaited loop; a large household (10+ members, 15+ forms) can approach the 120s Vercel limit. SectionHousehold inputs lack `aria-describedby`; its `type="date"` may not fire `onChange`/clear correctly on Firefox, and `computeAge` depends on clear handling. The `generate-forms` required-signer logic is owned by an earlier PRP (Batch 01) — this PRP touches only the stamping/duration region.

## Problem
- **B5:** no SSR shell. **B6/H1:** unconditional motion. **B4:** heavy synchronous stamping. **A4:** missing `aria-describedby`. **H4:** Firefox date input. **§1.3:** `page.tsx` `min-h-screen`.

## Goals
1. **B5:** move the bootstrap fetch to a Server Component (pass initial data to a client sub-component) **or**, at minimum, render a static skeleton in the initial HTML. Keep tenant-token gating server-safe; no secret in the server render. (Skeleton is the low-risk floor — decide based on how server-safe the bootstrap is.)
2. **B6/H1:** `useReducedMotion()` gate for framer-motion in `page.tsx`; a global `@media (prefers-reduced-motion: reduce)` override in `globals.css` (covers the progress-bar transition without editing IntakeShell).
3. **§1.3:** `page.tsx` `min-h-screen`→`min-h-dvh`+fallback.
4. **B4:** add server-side timing instrumentation to the stamping loop (+ chunking/progress if low-risk). A background queue is a logged follow-up, not this PRP. **Do not touch the required-signer region.**
5. **A4/H4:** `aria-describedby` on SectionHousehold inputs; explicit `onBlur`/clear handling for the date input.

## Non-goals
- No full SSR migration if risky (skeleton floor is acceptable — record the decision). No background-queue build for generate-forms (logged follow-up). Do not edit the required-signer region, the modals, the scanner, the intake `[section]` page, or `mobile-styles.css`. Do not edit files outside the Outputs list.

## Implementation
1. SSR shell / skeleton in `page.tsx`.
2. Reduced-motion (framer-motion gate + global CSS) + `min-h-dvh`.
3. Stamping timing log (+ chunking if low-risk) — stamping region only.
4. SectionHousehold `aria-describedby` + Firefox-safe date clear.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- **`npm run build` clean (this PRP changes `page.tsx`'s server/client boundary — build-surface PRP).**
- `node ./node_modules/.bin/vitest run` — reduced-motion gate disables framer-motion when `matchMedia` matches (mocked); SectionHousehold inputs have `aria-describedby`; date clear sets empty (no stale `computeAge`); the required-signer region is unchanged (grep/diff).
- **Deferred runtime gates:** view-source a tenant page → non-blank HTML before hydration; with `prefers-reduced-motion`, no transition; iPhone bottom CTAs visible (dvh); a 12-member `generate-forms` fixture completes < 60s (or surfaces the need for a queue).
