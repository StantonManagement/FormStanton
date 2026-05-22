# PRP-010 — Unsaved-Work Guards — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `5bb35b2f1ea9c8d10faf3a845319e29f7e3cc8ae`
**Findings (Phase 1):** Angle-2 **C1** — intake guard live; signing-page event channel established; per-form-submit dispatcher = follow-up.

## Files changed
- `app/pbv-full-app/[token]/intake/[section]/page.tsx` — beforeunload guard gated on `sectionData !== null && saveStatus !== 'saved'`.
- `app/pbv-full-app/[token]/sign/summary/page.tsx` — beforeunload guard on form-generation in-flight OR `pbv:signing-in-flight` window event.
- `app/pbv-full-app/[token]/sign/forms/page.tsx` — beforeunload guard on `pbv:signing-in-flight` window event.
- `lib/__tests__/beforeunload-guards.test.ts` *(new)* — 6 tests.

## Path taken (defaults logged)
- **Host location:** the intake guard lives at the **section page**, not a new intake layout. PRP allowed either; section-page hosting is the lower-risk choice because `saveStatus` is the section-page state (lifting it to a layout would require new context plumbing). Trade-off: this same file is edited in Batch 04 (PRP-015 navigation); PRP-015's instructions say "do not remove the guard," and Batch 04 runs after Batch 03 so the order is correct.
- **Signing-page in-flight signal:** the `submitting` state lives in `SummaryDocReviewSign` / `useSigningCeremony`, neither of which are in this PRP's Outputs. I established the page-side **listener** for a `pbv:signing-in-flight` `CustomEvent<{inFlight:boolean}>` window event; the **dispatcher** inside the child component is a follow-up. Until the dispatcher lands, the signing-page guard only fires for the form-generation in-flight branch on `sign/summary` (still useful) and is inert on `sign/forms`. Documented in the build report so the wiring isn't lost.
- **No custom unload message** — browsers ignore it; the empty `returnValue = ''` triggers the generic native dialog.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run lib/__tests__/beforeunload-guards.test.ts` — **6 pass / 0 fail / 1.86 s.**

## Deferred runtime gates
- Intake: type into a field → close tab immediately → native "Leave site?" dialog; wait for "saved" indicator → close → no dialog.
- Sign summary: trigger form generation → close tab → native dialog while `genState === 'generating'`.
- Sign summary + sign forms: once the dispatcher follow-up lands — start signature submit → close tab → native dialog.

## Follow-up (post-PRP-010)
- Add a tiny dispatcher to `SummaryDocReviewSign` (in `handleSign`) and to `useSigningCeremony` (around the submit/finally blocks) that does:
  ```ts
  window.dispatchEvent(new CustomEvent('pbv:signing-in-flight', { detail: { inFlight: true } }));
  // ...
  window.dispatchEvent(new CustomEvent('pbv:signing-in-flight', { detail: { inFlight: false } }));
  ```
  This is ~6 LOC each and completes the C1 fix on the signing pages. Out of scope for PRP-010 because those files aren't in the Outputs allowlist.
