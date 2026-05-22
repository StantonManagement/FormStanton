# PRP-015 — Intake Navigation & Deep-Link Integrity

**Assigned batch (per BATCH_PLAN.md):** 04
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **E1** (Medium), **F1** (Medium), **F2** (Medium), **F4** (Low); `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §8.2 (scroll-to-top).
**Depends on:** **PRP-010** — that PRP may add a `beforeunload` guard effect to `app/pbv-full-app/[token]/intake/[section]/page.tsx`. This PRP edits the same file's navigation logic. PRP-010 is in Batch 03 (runs before Batch 04), so there is no race; **layer these changes on top, do not remove the guard effect.** (If PRP-010 hosted its guard in the layout instead, this file has no prior change — proceed normally.)
**Inputs (read before editing):** `app/pbv-full-app/[token]/intake/[section]/page.tsx` (~98–105 `handleSectionChange` with the eslint-disable, ~120 `router.push`), `app/pbv-full-app/[token]/documents/page.tsx` (~54–55, 188–208 the `?filter=` read), the bootstrap's `resume_section`/section-ordering source (intake schema).
**Outputs (write — the ONLY files this PRP may modify/create):** `app/pbv-full-app/[token]/intake/[section]/page.tsx`, `app/pbv-full-app/[token]/documents/page.tsx` (the `?filter=` validation only — do not touch its existing `beforeunload` guard), new test(s).
**Acceptance criteria:**
- `handleSectionChange` always merges current `intakeData` (no stale overwrite).
- Requesting a section ahead of `resume_section` redirects to the resume section; backward navigation to completed sections still works.
- Section change scrolls to top.
- `?filter=` is validated against an allow-list (`'rejected'|'all'|null`); invalid values are ignored/400.

## Context (self-contained)
`handleSectionChange` has an `eslint-disable exhaustive-deps` and omits `intakeData`, so a background reload can make it merge stale data over newer. A tenant can deep-link `/intake/income` without completing `household` (no gate vs `resume_section`). After Next, the page lands mid-section on mobile (no scroll-to-top). `documents/page.tsx` reads `?filter=` and only compares to `'rejected'`, with no allow-list (fragile if ever interpolated).

## Problem
- **E1:** stale-closure `handleSectionChange`. **F2:** no deep-link section guard. **F4:** back-button steps section-by-section. **§8.2:** no scroll-to-top. **F1:** `?filter=` unvalidated.

## Goals
1. **E1:** fix the closure (prefer a functional `setLocalIntakeData(prev => …)`) so the merge always uses current data; no behavior change.
2. **F2:** on mount, compare requested section vs `resume_section`; if ahead, redirect to the resume section (allow going back to completed sections).
3. **§8.2:** `window.scrollTo({ top: 0, behavior: 'smooth' })` after a section change.
4. **F1:** validate `?filter=` against the allow-list; ignore/400 invalid; never interpolate raw.
5. **F4 (low / UX-ambiguous):** confirm intended back-button behavior; if unresolved, keep current behavior and record the decision (do not guess).

## Non-goals
- No `canGoNext`/section-completion gating UX. No change to the auto-save hook or the existing `beforeunload` guard. Do not edit files outside the Outputs list.

## Implementation
1. Functional-updater merge (E1).
2. Resume-section guard + scroll-to-top.
3. `?filter=` allow-list; F4 per the decision above.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` — merge uses current data after a simulated background reload; a section ahead of `resume_section` redirects; invalid `?filter=` ignored/400, valid passes; `window.scrollTo` called on section change (mocked).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gate:** deep-link `/intake/income` before `household` → redirected; Next scrolls to top on mobile; `?filter=hack` → ignored, no crash.
