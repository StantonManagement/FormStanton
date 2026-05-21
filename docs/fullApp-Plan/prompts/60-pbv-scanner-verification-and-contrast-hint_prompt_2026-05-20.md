# Windsurf Build Prompt — PRD-60: Scanner Verification + Low-Contrast / Can't-Lock Hint

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/60-pbv-scanner-verification-and-contrast-hint_prd_2026-05-20.md`. Read it next.

The advanced edge-detection scanner (**Scanic**) already shipped to `main` via PRD-52 (launch merge 2026-05-19). This PRD does **not** re-pilot or swap the detector. It has two parts:

- **Part A (primary, buildable):** a transparent on-screen hint shown when the detector can't lock onto a page for a few seconds — "Can't find the page edges — try more light, or place the page on a darker surface." It hooks into the **existing** no-lock signal, does not block the controls, is in EN/ES/PT, and clears the instant a quad locks.
- **Part B (verification):** confirm the Scanic detector is intact on the branch, and enumerate the deferred real-device gates from PRD-47/52 for the post-run pass. Decide Scanic in/out (default IN for v1).

This is an independent track — no code dependency on PRDs 55-59.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (the shared batch branch off `main`). Do **not** create a per-PRD branch.
- One commit when done: `PRD-60: scanner verification + low-contrast / can't-lock hint`.

## Shell + build

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, **never** `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- Tests run with `vitest run` (existing runner — see `lib/stabilityTracker.test.ts` for the established pattern).
- `npm run build` must be clean.
- **No prod migration** in this PRD — it's all client component + a pure helper + translations. Nothing to apply to Supabase.
- `.git/config` is **not** broken — do not "fix" line 23 (it's a harmless tab line; git runs fine).

---

## The signal to hook into (do NOT build a parallel detector)

The detector already emits the "no lock this frame" signal. Reuse it:

1. `edgeDetectionLoop.ts` → `onQuad(quad | null)`. `null` = no valid quad this frame.
2. `LivePreviewStage.tsx:177` → that quad is pushed to the stability tracker; `StabilityState.kind === 'seeking'` = no stable lock; any other kind = locked.
3. There is **already** an `isStuck` timer (`LivePreviewStage.tsx:123-125, 207-215`) firing after **8s** of continuous `seeking`, rendering an opaque amber card (`:280-285`) with `t.stuckHint` / `t.stuckHintSecondary`.

Your job: make that hint **faster (default 3.5s), transparent, and non-blocking** — and move the timer into a tested pure helper. One timer, not two. No new image read, no new `scanner.scan` / `adapter.detect` / `getImageData` call.

---

## Step-by-step

### Step 0 — Confirm the detector is intact (Part B, static)
Verify on the branch: `package.json` has `scanic` + `postinstall: sync-scanic.mjs`; `public/scanic/scanic.umd.cjs` exists; `LivePreviewStage.ensureScanicLoaded` is the only detector path and `DocumentScanner.processImageBlob` uses `adapter.extract`. Note (don't fix) the dead `createJscanifyAdapter` factory + `window.jscanify?` type if present — flag in the build report (O3), out of this lane.

### Step 1 — Extract the no-lock timer into a tested helper (Part A core)
Add `components/DocumentScanner/lockTimeout.ts`: a framework-free tracker, e.g. `createLockTimeoutTracker({ thresholdMs = 3500 })` with an `update(isLocked: boolean, now: number) => boolean` that returns whether the hint should show. `isLocked` is derived by the caller from `StabilityState.kind !== 'seeking'`. The helper holds the last-locked timestamp and the threshold; deterministic given an injected `now`. Mirror the shape/style of `stabilityTracker.ts`.

### Step 2 — Unit-test the trigger (Gate S1)
Add `lockTimeout.test.ts` (next to the helper, or under `lib/` like `stabilityTracker.test.ts`). Cover: returns `false` while locked; `false` before `thresholdMs` of no-lock; `true` once `thresholdMs` continuous no-lock elapses; `false` immediately after a re-lock; boundary at exactly `thresholdMs`. Use injected `now` (no fake timers needed). `vitest run` green.

### Step 3 — Wire the helper into LivePreviewStage (Part A)
Replace the inline 8s `lastNonSeekingAtRef` + polling effect with the Step-1 helper, fed the `StabilityState` already computed in the `onQuad` callback (`:177-184`). Drive a `showContrastHint` boolean. Keep the existing suppression: hide when `showLowLightWarning` or `!detectionAvailable`. Clear immediately on any non-`seeking` state (already the reset path).

### Step 4 — Transparent, non-blocking overlay (Part A UI)
Render the hint as a **semi-transparent** band (e.g. `bg-black/55` text), positioned **clear of the bottom Capture/Cancel stack** (`:307-328`), with `pointer-events-none` on the hint container so taps fall through to the controls. Use `t.stuckHint` + `t.stuckHintSecondary`. Add a one-line `t.contrastHint` in EN/ES/PT **only if** the existing copy is cramped in a one-line band (O2) — otherwise reuse the existing keys (don't add strings you don't need).

### Step 5 — Log decisions + build report + commit
Log to `OPEN-DECISIONS.md`: D5 (Scanic stays IN for v1 — DECISION) and D3 (3.5s hint threshold default — DECISION, tunable via one constant). Static gates green. Build report at `docs/build-reports/60-pbv-scanner-verification-and-contrast-hint_build-report_2026-05-20.md` with the deferred real-device gates enumerated. Commit `PRD-60: …`. Then **proceed to the PRD-61 prompt.**

---

## Files to modify

| File | Change |
|---|---|
| `components/DocumentScanner/lockTimeout.ts` (new) | pure no-lock-timer helper, default 3.5s, `now`-injectable |
| `components/DocumentScanner/lockTimeout.test.ts` (new) or under `lib/` | vitest unit test for the trigger (Gate S1) |
| `components/DocumentScanner/LivePreviewStage.tsx` | replace the inline 8s timer with the helper; transparent, non-blocking hint clear of the controls |
| `components/DocumentScanner/translations.ts` | add `contrastHint` in EN/ES/PT **only if** a one-line band string is needed |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | log D3 (threshold) + D5 (Scanic-in) |

## Files NOT to touch

- `edgeDetectionLoop.ts` detection math, `isValidQuad`, the Scanic adapter — read its outputs only, change nothing.
- `ensureScanicLoaded`, `public/scanic/*`, `scripts/sync-scanic.mjs`, `next.config.js` WASM config (PRD-52 territory).
- `stabilityTracker.ts`, `quality.ts` (no threshold tuning).
- The post-capture warning flow / "no document detected" confirm in `DocumentScanner.tsx`.
- The dead jscanify factory — only *flag* it (O3); removal is out of lane.
- Any `app/api/` route, any migration, any HACH-facing surface.

---

## Verification gates (per PRD-60)

**Static (must pass in-session before commit):**
- **Gate S1:** vitest test on the helper passes (locked→false, pre-threshold→false, threshold→true, re-lock→false, boundary).
- **Gate S2:** the hint path reads `StabilityState`/`onQuad(null)` only — no new `adapter.detect` / `scanner.scan` / `getImageData` / detector load (grep-verifiable).
- **Gate S3:** hint container is `pointer-events-none` and clear of the bottom button stack; Capture/Cancel stay tappable.
- **Gate S4:** any hint string exists in EN/ES/PT; no English in es/pt.
- **Gate S5:** `tsc --noEmit` + `npm run build` clean; `vitest run` green.

**Deferred to the post-run real-device pass (list in build report, do NOT block):**
- **Gate R1:** hint fires within ~3.5s on a real low-contrast scene; controls stay tappable.
- **Gate R2:** hint clears the instant a quad locks (darker surface / more light); auto-capture still fires.
- **Gate R3 / R4:** iOS Safari (current + iOS 16) and Android Chrome — Scanic loads, detects, captures, advances (PRD-52 Gate 7).
- **Gate R5:** Fast-3G cold-load time to first quad overlay — record the number (PRD-52 Gate 5).
- **Gate R6:** 5-min open, heap stable, `window.__scanicInstance` reused (PRD-52 Gate 10).
- **Gate R7:** 375px width + 200% root font — hint band + controls reflow without overflow (PRD-46/47).

---

## What "done" looks like

1. `PRD-60: …` commit on `feat/pbv-full-finalization`. No migration (none needed).
2. Static gates green: helper tested, hint wired to the existing signal, transparent + non-blocking, EN/ES/PT, build clean.
3. The contrast/can't-lock hint fires faster than the old 8s and reads through the camera without covering controls.
4. Scanic confirmed intact; D5 (Scanic-in) + D3 (3.5s threshold) logged to OPEN-DECISIONS.
5. Build report written with the deferred real-device gates enumerated. Proceed to PRD-61.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not build a second detector or a parallel timer — extend the one existing no-lock signal.
- Do not touch the Scanic plumbing, detection math, or quality scoring.
- Do not let the hint cover or intercept the Capture/Cancel controls.
- Do not add translation strings you don't end up using.
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23.
- Do not block on the real-device gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; the helper + test file paths.
- How the hint hooks into the existing signal (the `onQuad(null)` / `StabilityState 'seeking'` path) and the chosen threshold.
- Confirmation Scanic is intact (loads, only adapter wired, build clean).
- Decisions logged to OPEN-DECISIONS (D3, D5).
- The deferred real-device gates (R1-R7) for the post-run pass.
- The O3 jscanify-residue flag (noted, not fixed).

Then proceed to the PRD-61 prompt.
