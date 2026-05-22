# PRP-009 — Landmarks, Skip-Link, Progress & Status A11y — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-post-audit-remediation`
**Commit:** `8ca90363b4a3176997f7a226ecdbdbbe5885f728`
**Findings closed:** Angle-2 A5 / A6 / A7.

## Files changed
- `app/pbv-full-app/[token]/layout.tsx` — first-focusable skip-link + `<main id="main">` wrapping children.
- `components/pbv/intake/IntakeShell.tsx` — content slot `<main>` → `<section aria-label={sectionTitle}>`; sr-only aria-live region for section progress; progressbar aria-label.
- `components/pbv/TenantDocumentUpload.tsx` — status dot role=img + aria-label keyed on doc.status.
- `components/pbv/__tests__/landmarks-a11y.test.tsx` *(new)* — 5 tests.

## Path taken (defaults logged)
- **Single `<main>` at the layout level** (not duplicated per-page). This required removing the existing `<main>` in IntakeShell — done with the documented `<section aria-label={sectionTitle}>` replacement.
- **sr-only live region for progress** rather than putting `aria-live` directly on the progressbar div. SRs treat the progressbar role specially; a separate polite live region with the same text is more reliably announced on section transitions.
- **Status dot uses `role="img" + aria-label`** rather than visually-hidden text inside the span, because the span has `w-2 h-2` and no children.

## Per-PRP gates
- `node ./node_modules/typescript/bin/tsc --noEmit` — **clean.**
- `node node_modules/vitest/dist/cli.js run components/pbv/__tests__/landmarks-a11y.test.tsx` — **5 pass / 0 fail / 6.28 s.**

## Deferred runtime gates
- Keyboard: load any tenant page → first Tab focuses "Skip to main content" → Enter jumps to the page body.
- NVDA / VoiceOver: navigate to a new intake section → "Section 3 of 5" is announced.
- Grayscale: open the documents page → status badges still distinguishable (label text + dot SR announcement).
- axe-core scan on tenant pages: zero violations from these three components.

## Notes
- The skip-link is only visible on focus; it stays out of the way for sighted users.
- The `main` element is `tabIndex={-1}` so the skip-link can move focus into it without making it a normally-tabbable element.
