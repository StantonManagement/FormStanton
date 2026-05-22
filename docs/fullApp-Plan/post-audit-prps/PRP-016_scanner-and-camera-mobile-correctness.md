# PRP-016 — Scanner & Camera Mobile Correctness + Bundle Cost

**Assigned batch (per BATCH_PLAN.md):** 04
**Source:** `docs/audits/pbv-angle-2-audit_2026-05-21.md` — **B1** (High), **B2** (Medium), **H2** (Low); `docs/audits/pbv-mobile-desktop-cross-browser-review_2026-05-21.md` §2.4, §9, §11.7.
**Depends on:** None — operates on current `main`.
**Inputs (read before editing):** `components/DocumentScanner/DocumentScanner.tsx` (~6 `pdf-lib` static import, ~99–113 preview blob, ~267–275 heic2any, ~559/644 `max-h-[50vh]`), `components/DocumentScanner/usePermissionPrompt.ts` (`getUserMedia` constraints).
**Outputs (write — the ONLY files this PRP may modify/create):** `components/DocumentScanner/DocumentScanner.tsx`, `components/DocumentScanner/usePermissionPrompt.ts`, new test(s).
**Acceptance criteria:**
- `pdf-lib` is loaded via dynamic `import('pdf-lib')` inside the assembly path (not a top-level static import) — confirmed absent from the initial chunk at the batch-boundary build.
- Captured images are downsampled (max ~1200px) before the preview blob.
- `getUserMedia` requests `facingMode: { ideal: 'environment' }`.
- `max-h-[50vh]` previews use `dvh`+fallback; a "Converting photo…" state shows during HEIC conversion.

## Context (self-contained)
`pdf-lib` (~500KB) is a top-level static import in `DocumentScanner.tsx`; the scanner is dynamically imported but `pdf-lib` isn't inside that chunk, so it loads on every page that transitively imports the scanner. Preview blobs are full-resolution (10+MP photos held in memory at `max-h-[50vh]`). `getUserMedia` lacks a `facingMode` constraint, so Samsung Internet / front-only tablets may open the wrong camera or a blank stream. HEIC conversion (`heic2any`, ~180KB) shows only a generic processing state.

## Problem
- **B1:** `pdf-lib` eagerly bundled. **B2:** previews not downsampled. **§2.4/H2:** no `facingMode`. **§9:** `max-h-[50vh]`. **§11.7:** weak HEIC loading state.

## Goals
1. **B1:** dynamic `import('pdf-lib')` inside the PDF-assembly function(s); a real runtime dynamic import (use `import type` only for types).
2. **B2:** downsample to ~1200px longest edge via an offscreen canvas before the preview blob.
3. **§2.4/H2:** `facingMode: { ideal: 'environment' }` in `usePermissionPrompt`'s constraints; handle devices without it gracefully.
4. **§9:** `max-h-[50vh]`→`max-h-[50dvh]`+fallback on the preview images.
5. **§11.7:** "Converting photo…" state during `heic2any`.

## Non-goals
- No new scanner engine; keep jscanify/OpenCV/Scanic. No change to HEIC conversion beyond the loading message or the iOS native-scan `capture` logic. Do not touch the signature canvas or modals. Do not edit files outside the Outputs list.

## Implementation
1. Lazy `pdf-lib`.
2. Downsample + `dvh` on previews.
3. `facingMode` + HEIC loading state.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run components/DocumentScanner/__tests__/...` — downsample within max dimension; `getUserMedia` called with `facingMode: { ideal: 'environment' }` (mock `mediaDevices`); HEIC path sets the converting state; `import('pdf-lib')` is a dynamic import (grep/test).
- **No full build per PRP**, but the **batch boundary build must confirm `pdf-lib` is only in a lazy chunk** (record it).
- **Deferred runtime gates:** Samsung Internet → rear camera opens; low-RAM phone scans a 12MP photo without OOM; bundle analyzer shows `pdf-lib` only in the lazy chunk.
