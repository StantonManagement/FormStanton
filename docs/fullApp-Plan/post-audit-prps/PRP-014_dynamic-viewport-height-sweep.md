# PRP-014 — Dynamic Viewport Height (`dvh`) Sweep

**Assigned batch (per BATCH_PLAN.md):** 04
**Source:** `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §1.3, §9, §5.1.
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `components/pbv/sign/MagicLinkSigningFlow.tsx` (`max-h-[90vh]`), `components/pbv/intake/SectionDvHomelessRa.tsx` (grep for `vh`/`min-h-screen` — review flagged "needs verification"), `app/mobile-styles.css`; confirm Tailwind version supports `dvh` utilities (v3.3+).
**Outputs (write — the ONLY files this PRP may modify/create):** `components/pbv/sign/MagicLinkSigningFlow.tsx`, `components/pbv/intake/SectionDvHomelessRa.tsx`, `app/mobile-styles.css`, (optional) one CSS snapshot test.
**Acceptance criteria:**
- `vh`/fixed-`vh`/`max-h-[Nvh]` on the in-scope files use `dvh` with a `vh` fallback.
- `input[type="date"]` is added to the `mobile-styles.css` 16px font-size rule.
- No file owned by another Batch-04 PRP is touched (page shells, scanner, intake `[section]` page, signing modals).

## Context (self-contained)
On iOS Safari, `100vh`/fixed-`vh` computes against the toolbar-collapsed height; when the toolbar expands, bottom CTAs (Submit/Sign) slide off-screen ("I can't see the Submit button"). The fix is `dvh` (dynamic viewport height) with a `vh` fallback. This PRP handles the **standalone** `vh` containers; the signing modals' `vh` is handled by their owning PRP (PRP-007), the main `page.tsx`/scanner `vh` by their owners (PRP-017/PRP-016) — do not touch those here. Also, `mobile-styles.css` covers text/tel/number/email inputs at 16px but not `date` (a `text-sm` date input *could* trigger iOS zoom; the native picker likely avoids it — belt-and-suspenders).

## Problem
- **§1.3/§9:** fixed `vh` on `MagicLinkSigningFlow` (`max-h-[90vh]`) and `SectionDvHomelessRa`.
- **§5.1:** `input[type="date"]` missing from the 16px rule.

## Goals
1. Replace in-scope `vh` with `dvh`+fallback (`height:90vh; height:90dvh;` or Tailwind `*-dvh` with fallback).
2. Add `input[type="date"]` to the `mobile-styles.css` 16px font-size rule.
3. Record (do not edit) any `vh` found in files owned by other PRPs as a handoff.

## Non-goals
- No layout redesign (mechanical `vh`→`dvh`+fallback only). No edits to the modals, page shells, scanner, or intake `[section]` page. iframe scroll-trap is handled by the modal PRP. Do not edit files outside the Outputs list.

## Implementation
1. Verify actual `vh` usages in `MagicLinkSigningFlow` + `SectionDvHomelessRa` (the latter flagged "needs verification"); convert real usages.
2. Add `input[type="date"]` to the font-size rule.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- If a CSS/snapshot harness exists, assert the `dvh`+fallback on the touched containers; else document a manual visual check as a deferred gate (do not invent a harness).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gate:** on iPhone, the magic-link flow + DvHomelessRa section keep bottom CTAs visible as the toolbar expands; desktop unchanged.
