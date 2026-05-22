# PRP-008 — "Sign All" Stepper Announcements & Memoization

**Assigned batch (per BATCH_PLAN.md):** 02
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **A8** (Medium), **A3** (stepper part), **E4** (memoize sort, Low).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `components/pbv/sign/FormsStack.tsx` (~107–111 the sort, ~208–211 the stepper progress text).
**Outputs (write — the ONLY files this PRP may modify/create):** `components/pbv/sign/FormsStack.tsx`, new test.
**Acceptance criteria:**
- Stepper progress ("Signing N of M") is inside an `aria-live="polite"` region (mounted before the text changes).
- Stepper errors are in an `aria-live`/`role="status"` region.
- The sorted forms array is memoized (stable reference when `forms` is unchanged).

## Context (self-contained)
As a tenant signs forms in the stepper, "Signing N of M…" updates and the next form auto-opens, but the text isn't in a live region, so screen-reader users aren't told. Separately, `[...forms].sort(...)` runs every render, producing a new array reference that re-renders all rows — a cheap fix folded in since it's the same file.

## Problem
- **A8:** stepper progress not announced.
- **A3:** stepper errors not announced.
- **E4:** sorted array recreated each render.

## Goals
1. Wrap the progress text in a persistent `aria-live="polite"` region (mount the empty region first, then write into it — a region that mounts already-filled is not announced).
2. `aria-live`/`role="status"` region for stepper errors.
3. `useMemo(() => [...forms].sort(...), [forms])`.

## Non-goals
- No change to the per-form modal or the signing ceremony hook. No stepper-logic restructuring beyond announcements + memo. Do not edit files outside the Outputs list.

## Implementation
1. Persistent live region for progress; live region for errors.
2. Memoize the sort.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the FormsStack test — progress text is inside an `aria-live` region; the sorted array reference is stable across re-render when `forms` is unchanged.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gate:** VoiceOver/NVDA announces "Signing 2 of 5" on advance and announces a stepper error.
