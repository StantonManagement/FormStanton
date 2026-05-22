# BATCH 04 — Mobile/Cross-Browser & Performance (PRP-014 … PRP-017)

You are an autonomous Claude Code session running **Batch 04** of a 5-batch PBV remediation: dynamic viewport height, intake navigation/deep-link integrity, scanner/camera correctness + bundle cost, and render-path performance + motion. Run the four PRPs **in order**, one git commit each, no sign-off. Clean context; everything is in this file and the named PRP files.

## Working directory & branch
- Run from the repo root.
- Ensure branch **`feat/pbv-post-audit-remediation`** is checked out (create off `main` if missing). Shared branch. No PR (Batch 05 does).

## ⚠️ This batch MUST run after Batches 01 and 03 (it layers on their files)
- **PRP-017** edits the **stamping region** of `generate-forms` — Batch 01 (PRP-005) edited that file's **required-signer region**. Layer on it; **do not touch the required-signer region**.
- **PRP-015** edits the intake `[section]` page — Batch 03 (PRP-010) may have added a `beforeunload` guard effect there. Layer on it; **do not remove the guard**.
The 5-batch loop runs these in order, so the dependencies are satisfied. Do **not** run this batch in parallel with 01 or 03.

## Shell rules (inlined)
- Type-check: `node ./node_modules/typescript/bin/tsc --noEmit`. **Never `npx tsc`.**
- Tests: `node ./node_modules/.bin/vitest run <path>`. **Never `npx vitest`.** Targeted only.
- **No `npm run build` per PRP** — exception: **PRP-017** changes `page.tsx`'s server/client boundary (build surface) → build that one. The batch-boundary build must also confirm **`pdf-lib` is only in a lazy chunk** (PRP-016).
- No prod migration apply; no destructive SQL.

## PRPs in execution order
1. **PRP-014** (`PRP-014_dynamic-viewport-height-sweep.md`) — `vh`→`dvh` on standalone containers + `input[type=date]` font-size. *Depends on: none.*
2. **PRP-015** (`PRP-015_intake-navigation-and-deeplink-integrity.md`) — stale-closure fix, deep-link guard, scroll-to-top, `?filter=` validation. *Depends on: **PRP-010** (Batch 03)* — layer on its guard in the intake `[section]` page; don't remove it.
3. **PRP-016** (`PRP-016_scanner-and-camera-mobile-correctness.md`) — lazy `pdf-lib`, preview downsample, `facingMode`, HEIC loading state. *Depends on: none.*
4. **PRP-017** (`PRP-017_render-path-performance-and-motion.md`) — SSR shell/skeleton, reduced-motion, `page.tsx` dvh, generate-forms stamping budget, SectionHousehold aria/date. *Depends on: **PRP-005** (Batch 01)* — stamping region only; leave the required-signer region. **Build this PRP.**

No two PRPs in this batch write the same file. (PRP-014 must not touch the modals/page-shells/scanner/intake-page owned by 007/017/016/015.)

## Per-PRP loop
1. Read the PRP; note **Outputs** + **Acceptance criteria**.
2. Implement only those files; default-and-note on ambiguity. (PRP-015 F4 back-button is UX-ambiguous — keep current behavior + note if unresolved, don't guess.)
3. Per-PRP gates: `tsc --noEmit` clean; targeted `vitest` green (PRP-017 also `npm run build`).
4. Commit `PRP-0NN: <slug>` (push if git healthy).
5. Build report `docs/build-reports/PRP-0NN_<slug>_build-report_2026-05-21.md`.
6. Next PRP.

## Batch-boundary gates (after PRP-017)
- One full `npm run build` → clean; **confirm `pdf-lib` is only in a lazy chunk** (record the bundle observation).
- Pattern-sweep for other `vh` containers and other eager heavy imports. Record findings.

## Done when
Four commits `PRP-014:`…`PRP-017:`; per-PRP gates green; PRP-017 + boundary build clean; `pdf-lib` lazy confirmed; four build reports; deferred device gates (iOS dvh, Samsung camera, low-RAM scan, reduced-motion, view-source SSR/skeleton, generate-forms load) enumerated. No PR.
