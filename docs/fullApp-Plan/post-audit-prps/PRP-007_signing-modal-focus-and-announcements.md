# PRP-007 — Signing-Modal Focus Management, Announcements & Mobile Viewport

**Assigned batch (per BATCH_PLAN.md):** 02
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **A2** (High), **A3** (modal part), **A4** (confirm-name input), **B3** (iframe lazy); `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §1.3/§9 (`vh`→`dvh`), §3.2 (iframe scroll-trap).
**Depends on:** None — operates on current `main`. (This PRP owns the two signing-modal files **completely** so no other PRP touches them — including their mobile `dvh`.)
**Inputs (read before editing):** `components/pbv/sign/FormReviewSignModal.tsx` (~82, 88–89, 121, 133–143), `components/pbv/sign/SummaryDocReviewSign.tsx` (~117–119, 144, 181–187); confirm the project's Tailwind version supports `dvh` utilities (v3.3+) and whether a focus-trap dependency exists.
**Outputs (write — the ONLY files this PRP may modify/create):** `components/pbv/sign/FormReviewSignModal.tsx`, `components/pbv/sign/SummaryDocReviewSign.tsx`, new test(s).
**Acceptance criteria:**
- On open, focus moves into the modal and is trapped; on close/Esc, focus returns to the trigger.
- Modal errors render in an `aria-live` region; the confirm-name input has `aria-describedby`.
- iframes carry `loading="lazy"`; the `60vh`/`40vh`/`max-h-[90vh]` heights use `dvh` (with `vh` fallback); a mobile scroll cue mitigates the PDF iframe scroll-trap.

## Context (self-contained)
Both signing modals open without moving focus inside, so keyboard users tab to elements behind the modal; on close, focus isn't restored. Errors are static text. The PDF preview is an `<iframe src=...>` set on mount (not lazy), sized with fixed `vh` (iOS Safari toolbar pushes content/buttons off-screen), and touch-scroll inside it doesn't bubble (scroll-trap). The iframe approach is a deliberate ~500KB-saving decision over PDF.js and stays.

## Problem
- **A2:** no focus trap/restoration.
- **A3:** modal errors not announced.
- **A4:** confirm-name input lacks `aria-describedby`.
- **B3:** iframe not lazy.
- **mobile §1.3/§9:** fixed `vh` heights.
- **mobile §3.2:** iframe scroll-trap.

## Goals
1. **A2:** capture trigger on open → move focus inside → trap Tab/Shift-Tab → restore focus on close/Esc. Reuse an existing focus-trap dependency if present; else a small hand-rolled trap (no heavy new dep).
2. **A3/A4:** `aria-live="polite" role="status"` error region; confirm-name input `aria-describedby` to its error id.
3. **B3:** `loading="lazy"` on both iframes.
4. **mobile:** `60vh`/`40vh`/`max-h-[90vh]` → `dvh` with `vh` fallback (Tailwind `*-dvh` if supported, else inline two-line fallback).
5. **mobile §3.2:** visible "scroll down to continue" cue below the iframe on mobile (and/or constrain so the parent stays scrollable); note residual.
6. `Esc` closes + restores focus.

## Non-goals
- No switch to PDF.js. No change to what the signature captures or the ceremony hook. No heavy focus-trap dep unless one exists. Do not edit files outside the Outputs list.

## Implementation
1. Focus trap/restore on both modals.
2. `aria-live` errors + `aria-describedby`.
3. `loading="lazy"`; `vh`→`dvh`+fallback; mobile scroll cue.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the modal tests — on open focus is inside; on close the (mocked) trigger receives focus; error renders in an `aria-live` region; confirm-name input has `aria-describedby`; iframe carries `loading="lazy"`.
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** Tab through both modals → focus never escapes; Esc closes + restores; axe clean; on iPhone, buttons reachable (dvh), PDF scroll cue visible, parent scroll works after the iframe.
