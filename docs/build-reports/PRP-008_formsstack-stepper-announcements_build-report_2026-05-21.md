# PRP-008 — FormsStack Stepper Announcements & Memoization — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `9bd8f8bf8bee3d7dac951ea9b59efbc7ac7a90bb`
**Findings closed:** Angle-2 A8 / A3 (stepper part) / E4.

## Files changed
- `components/pbv/sign/FormsStack.tsx` — persistent aria-live progress + error regions, `useMemo`-wrapped sort.
- `components/pbv/sign/__tests__/FormsStack.test.tsx` *(new)* — 5 tests.

## Path taken
- **Persistent live regions** (mounted always, empty when no stepper) rather than conditionally mounting on `stepperQueue.length > 0`. ARIA live regions only announce a change between mount-time content and a subsequent write; mounting already-filled means the announcement is skipped on most screen readers.
- **Stepper error vs ceremony error:** the `ceremony.error` from `useSigningCeremony` already surfaces inside the per-form modal's aria-live region (PRP-007). We additionally surface it in a dedicated stepper-level live region during stepper runs so users on the list view hear it even before the next form opens.
- **`useMemo`** rather than restructuring the component into smaller memo'd children — single-file scope, no over-engineering.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/sign/__tests__/FormsStack.test.tsx` — **5 pass / 0 fail / 5.90 s.**

## Deferred runtime gates
- VoiceOver/NVDA: advance through the stepper → each "Signing N of M…" is announced; trigger a server error mid-stepper → the announcement fires.
- React DevTools profiler: confirm row rerenders no longer trigger on every stepperIndex change.
