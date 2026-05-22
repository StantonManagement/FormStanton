# PRP-010 — Unsaved-Work Guards (Intake & Signing)

**Assigned batch (per BATCH_PLAN.md):** 03
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **C1** (High).
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `app/pbv-full-app/[token]/documents/page.tsx` (~109–121 — the existing, verified-safe `beforeunload` pattern to mirror), the intake layout / auto-save status source (`saveStatus`), `app/pbv-full-app/[token]/sign/summary/page.tsx`, `app/pbv-full-app/[token]/sign/forms/page.tsx`.
**Outputs (write — the ONLY files this PRP may modify/create):** the intake layout (preferred host) OR `app/pbv-full-app/[token]/intake/[section]/page.tsx` (guard effect only — see note), `app/pbv-full-app/[token]/sign/summary/page.tsx`, `app/pbv-full-app/[token]/sign/forms/page.tsx`, new test.
**Acceptance criteria:**
- A `beforeunload` prompt fires on intake when auto-save status is not `saved`, and on signing pages when a submission is in flight; it does not fire when there's nothing to lose; the listener is added/removed correctly.

> **File-conflict note:** `app/pbv-full-app/[token]/intake/[section]/page.tsx` is also modified by PRP-015 (Batch 04, intake navigation). Prefer hosting this guard in the **intake layout** so this PRP does not touch `[section]/page.tsx`. If it must live there, touch only the guard effect; Batch 04 runs after Batch 03, so there is no race. Record which host you chose.

## Context (self-contained)
A `beforeunload` guard exists only on `documents/page.tsx` (verified-safe cleanup pattern). Closing the tab mid-intake or mid-signature loses unsaved work; auto-save debounces ~600ms, so rapid closure loses the last edits. The intake auto-save hook exposes a `saveStatus`; the signing pages expose a `submitting` state.

## Problem
- **C1:** no `beforeunload` guard on intake or signing.

## Goals
1. Intake: `beforeunload` (preferably in the intake layout) gated on `saveStatus !== 'saved'`, mirroring the documents-page pattern (browsers show a generic dialog).
2. Signing: `beforeunload` on `sign/summary` + `sign/forms` gated on `submitting` (and a captured-but-unsubmitted signature if that state is cheaply available).
3. Listener removed when state returns to safe (reuse the verified-safe cleanup pattern).

## Non-goals
- No change to the auto-save hook itself. No change to intake navigation logic. No custom unload message (browsers ignore it). Do not edit files outside the Outputs list.

## Implementation
1. Intake guard at the layout (or `[section]/page.tsx` guard effect only — record choice).
2. Signing guards on the two sign pages.
3. Correct add/remove cleanup.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` — listener added when dirty/submitting, removed when safe (mock `window.add/removeEventListener`).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gate:** type intake → close tab → prompt; wait for "saved" → close → no prompt; start a signature submit → close → prompt.
