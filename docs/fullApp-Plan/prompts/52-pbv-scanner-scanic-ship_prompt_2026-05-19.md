# Windsurf Build Prompt — PRD-52: Ship Scanic, Remove jscanify + OpenCV.js

You are building from `docs/fullApp-Plan/52-pbv-scanner-scanic-ship_prd_2026-05-19.md`. Read it before doing anything.

**This is a commit-and-ship, not a pilot.** No A/B flag, no parallel detector, no "Phase 2." The deliverable is a working scanner powered by Scanic with jscanify and OpenCV.js fully removed. The user has explicitly directed: "build robustly the first time, no shortcuts, ship and move on." Honor that. If you hit a problem, solve it; don't park it.

---

## Branch and base

- Base off `main` (latest, post-launch-merge, tag `launch-prep-full-2026-05-19` or later).
- Branch: `feat/pbv-scanner-scanic-ship-52`
- **Never push to `dev` or `main` directly.** The PRD-48 build accidentally committed to `dev` — do not repeat that. If you find prior PRD-48 commits stranded on `dev`, leave them alone (the audit will surface them); your work goes on the new feature branch only.
- Final merge target: `main`. Open the PR Ready for Review (not Draft) once all 11 verification gates pass.

---

## Shell protocol

- `npm install` (this PRD adds Scanic and removes jscanify) — explicit timeout 120s, single retry with `--prefer-offline --no-audit --no-fund` if hung.
- `npx tsc --noEmit` ~60s.
- `npm run build` ~300s — this is the gate that crashed in PRD-48. If the minifier errors, debug the WASM config; do not work around by reverting.
- No `npm run dev` from agent commands.
- If 2 retries on the same command still hang, stop and report.

---

## Files to modify

| File | Change |
|---|---|
| `package.json` + `package-lock.json` | F1 — add `scanic`, remove `jscanify`. |
| `next.config.js` | F2 — WASM bundling config. |
| `components/DocumentScanner/LivePreviewStage.tsx` | F3 — replace OpenCV+jscanify loaders with Scanic loader. Remove URL-param and env-var detector selection. |
| `components/DocumentScanner/edgeDetectionLoop.ts` | F4 — keep `DetectorAdapter` interface, remove `createJscanifyAdapter`, keep `createScanicAdapter` as only implementation. Collapse `isAsync` branching or keep as defensive. |
| `components/DocumentScanner/DocumentScanner.tsx` | F5 — `processImageBlob` uses Scanic adapter for extraction. |
| Various (search-and-clean) | F6 — remove any remaining jscanify / OpenCV.js references in code or docs. |

---

## Files NOT to touch

- `stabilityTracker.ts`
- `QuadOverlay.tsx`
- `usePermissionPrompt.ts`
- `FirstScanTooltip.tsx`
- `quality.ts`
- Translation files
- Any `app/api/` route
- Any file under `components/pbv/cards/` (PRD-47/51 territory)
- Any HACH-facing surface
- Any migration

If you think a fix is needed outside these files, stop and ask.

---

## Step-by-step

### Step 0 — Read and align

1. Read PRD-52 in full.
2. Read PRD-48 (the pilot) for context, including the failure modes Windsurf hit last time.
3. Read the current state of `LivePreviewStage.tsx`, `edgeDetectionLoop.ts`, `DocumentScanner.tsx`, `next.config.js`, and `package.json` on `main`.
4. Note: PRD-48 work may or may not be present on `main`. If `DetectorAdapter` exists, work from there. If not, build from scratch.

### Step 1 — Dependency swap (F1)

```sh
npm install scanic --save --no-audit --no-fund
npm uninstall jscanify --no-audit --no-fund
```

Verify:
- `grep scanic package.json` → present.
- `grep jscanify package.json` → no match.
- `grep -r jscanify components/ lib/ app/` → may have remaining imports; F3-F6 remove them.

### Step 2 — Loading Scanic robustly (F2 — two paths, pick the one that ships)

PRD §F2 now defines two acceptable paths. Try Path A first; switch to Path B if Path A doesn't land cleanly in a half-day of focused work.

**Path A — Webpack WASM experiments.** Add `experiments.asyncWebAssembly: true` to `next.config.js` per PRD §F2. If `npm run build` fails:

1. **Minifier crashes on Scanic chunk:** try `config.optimization.minimizer` exclusion for Scanic's chunk, or `output.webassemblyModuleFilename = 'static/wasm/[modulehash].wasm'`.
2. **`import.meta.url` not resolved:** try `import.meta.webpackContext` or related patterns from Next.js issue #29362.

Half-day budget. If at that point the build is still crashing, switch to Path B without further escalation. Document what you tried in the build report.

**Path B — Self-hosted UMD via `/public/scanic/`.** Mirrors the existing OpenCV.js loading pattern in this codebase. Steps:

1. **`scripts/sync-scanic-public.js`** — copies `node_modules/scanic/dist/scanic.umd.cjs` (and any `.wasm` siblings) to `public/scanic/`. Fails loudly with a clear error if Scanic's dist layout changed (so a future Scanic upgrade surfaces the breakage at install time, not at runtime).
2. **`package.json`** — add `"postinstall": "node scripts/sync-scanic-public.js"`. Verify it runs as part of `npm install`. Keep `scanic` as an npm dependency (the script reads from `node_modules/scanic/`).
3. **`ensureScanicLoaded()` in `edgeDetectionLoop.ts` (or `LivePreviewStage.tsx`):** inject `<script src="/scanic/scanic.umd.cjs">` if not already present, wait for the global Scanic export on `window` (inspect the bundle to confirm the global name — likely `window.scanic` or `window.Scanic`), instantiate `new Scanner()`, call `await scanner.initialize()`, cache on `window.__scanicInstance`, return the adapter. Pattern is the same as today's `ensureOpenCvLoaded`.
4. **Adjust `next.config.js`:** drop the `asyncWebAssembly` experiments config — not needed if Path B is the loader. Keep the file minimal.
5. **WASM file:** if the UMD bundle expects a separately-loaded `.wasm` file, copy it to `public/scanic/` in the sync script too. Confirm the bundle's runtime expectation by reading the UMD source after `npm install` once.

**Both paths satisfy the PRD's constraints** (same-origin, no third-party CDN, robust). Path B is not a "fallback to scrappy" — it mirrors a proven loading pattern already in production for OpenCV.js. The postinstall sync keeps it auto-current.

**Do not pick Option 3 from your prior message** (report pilot blocked). That's the "Phase 2" framing the user has explicitly rejected. The decision is to ship Scanic; the choice is just which loader path delivers a clean build.

### Step 3 — Scanic loader in `LivePreviewStage.tsx` (F3)

Replace `ensureOpenCvLoaded` + `ensureJscanifyLoaded` + the URL-param/env-var detector selection with:

```ts
async function ensureScanicLoaded(): Promise<DetectorAdapter> {
  const w = window as unknown as { __scanicInstance?: InstanceType<typeof Scanner> };
  if (w.__scanicInstance) {
    return createScanicAdapter(w.__scanicInstance);
  }
  const { Scanner } = await import('scanic');
  const instance = new Scanner();
  await instance.initialize();
  w.__scanicInstance = instance;
  return createScanicAdapter(instance);
}
```

The detection-loop `useEffect` calls `ensureScanicLoaded()`. On rejection (any error), set `detectionAvailable = false` — the existing manual-capture banner fires.

**Remove entirely:**
- `ensureOpenCvLoaded` function.
- `ensureJscanifyLoaded` function.
- The `<script>` tag injection logic.
- `getDetectorChoice` / URL parameter handling.
- Any `NEXT_PUBLIC_SCANNER_DETECTOR` environment-variable check.

### Step 4 — Single-detector simplification in `edgeDetectionLoop.ts` (F4)

- Keep `DetectorAdapter` interface as-is.
- Remove `createJscanifyAdapter` function.
- `createScanicAdapter` stays. Verify it maps Scanic's `result.corners` → `Quad` correctly (Scanic returns `{ topLeft, topRight, bottomRight, bottomLeft }`, our Quad uses same names — should be a direct pass-through).
- The RAF loop: keep `inFlight` guard for the async detect call. The `isAsync` switch can collapse to always-async — your call on whether to keep the abstraction or simplify. Either is fine; document the choice.

### Step 5 — `processImageBlob` uses adapter (F5)

In `DocumentScanner.tsx`'s `processImageBlob`:

```ts
const adapter = await ensureScanicLoaded(); // exported from LivePreviewStage or moved to edgeDetectionLoop
const extracted = await adapter.extract(image);
finalCanvas = extracted ?? fallbackCanvas(image);
```

Move `ensureScanicLoaded` into `edgeDetectionLoop.ts` so both files can import it. This removes the awkward cross-component import. The PRD prohibits creating new files, so this co-location is the right move.

### Step 6 — Clean up residue (F6)

```sh
grep -r jscanify . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json"
grep -r "docs.opencv.org" . --include="*.ts" --include="*.tsx" --include="*.js"
grep -r OpenCV . --include="*.ts" --include="*.tsx"
```

Resolve every match. Code references should be removed. Doc references in `docs/` should be updated to reflect Scanic as the detector (only if the doc is current — don't rewrite archived PRDs).

### Step 7 — Type check

`npx tsc --noEmit`. Must pass.

### Step 8 — Build (the gate that bit PRD-48)

`npm run build`. If it fails:
- Read the error carefully. WASM bundling failures usually point at the chunk or the loader.
- Iterate on `next.config.js` config per Step 2's escalation list.
- Do not fall back to script-tag CDN loading. Solve the bundler problem.

If you genuinely cannot get the build to pass after a focused day, **stop and report** with:
- Every config you tried.
- The exact error each time.
- Your hypothesis for the root cause.
- Whether you think Next.js + Scanic WASM is fundamentally incompatible vs solvable with more time.

That report is itself valuable — it's the "Inconclusive" decision criterion from PRD-48 with new data. Do not silently ship a half-working version.

### Step 9 — Verification gates 1-11

Per PRD-52 §Verification Gates. The bar is high because this is commit-and-ship.

**Gates that need real-world capture (not just code-level checks):**
- Gate 3 (high-contrast scene) — real document on real surface, real camera.
- Gate 4 (low-contrast scene) — white paper on light wood floor (or your closest reproducible equivalent).
- Gate 5 (cellular load) — Fast 3G DevTools throttle, cold cache, time the load.
- Gate 7 (device matrix) — list every device tested.
- Gate 10 (memory) — 5-minute live preview, watch heap.

For each gate, capture screenshots or measurements. Do not check off gates you couldn't actually verify; mark them "deferred" and explain why.

### Step 10 — Build report

Write `docs/build-reports/52-pbv-scanner-scanic-ship_build-report_2026-05-19.md` with:

1. Final `next.config.js` webpack config and any config knobs that were load-bearing.
2. Per-gate results (pass / fail / deferred).
3. **Headline measurement: cellular cold-load time** (Gate 5). This is the number that justifies the entire PRD; capture it precisely.
4. **Headline measurement: low-contrast detection** (Gate 4). Did it work? If not, what threshold tuning would it need?
5. Pinned `scanic` version.
6. Anything you punted on with reason.
7. Open questions O1-O4 from PRD-52, answered with what you observed.

---

## What "done" looks like

1. Branch `feat/pbv-scanner-scanic-ship-52` pushed to origin.
2. All 11 verification gates passed (or honestly documented as deferred with explanation).
3. `npx tsc --noEmit` clean.
4. `npm run build` clean — no minifier errors, no WASM warnings.
5. `grep -r jscanify` and `grep -r docs.opencv.org` return zero matches in code.
6. PR opened against `main`, Ready for Review (not Draft).
7. Build report written.

---

## What NOT to do

- **Do not push to `dev` or `main`.** Feature branch only. PRD-48 was on `dev` and that was the wrong call.
- **Do not introduce a runtime A/B switch or feature flag.** Single detector, hardcoded.
- **Do not load Scanic from a third-party CDN as a fallback.** WASM ships from our origin via Vercel.
- **Do not keep `jscanify` "just in case."** Remove the dependency and all imports.
- **Do not ship a half-working build by silently disabling Scanic.** If WASM bundling truly can't be made to work, report honestly; don't disable.
- **Do not add new `any` types** in the detection path. Scanic ships types.
- **Do not skip Gate 4 (low-contrast scene).** It's the original reason any of this is happening.
- **Do not skip Gate 5 (cellular cold-load measurement).** That number is the entire pitch for the PRD.
- **Do not "Phase 2" any verification gate.** If a gate fails, fix it or report. Don't park.
- **Do not paraphrase PRD decisions.** If you find yourself wanting to deviate (e.g., "I'm going to keep a fallback to jscanify just in case"), stop and ask first.

---

## Reporting back

When done, post in chat:
- Branch + commit SHA.
- PR URL.
- Build report URL.
- Per-gate pass/fail summary.
- **Cellular cold-load time before and after** (Gate 5 number).
- **Low-contrast scene result** (Gate 4 outcome).
- Pinned Scanic version.
- Anything you punted on with reason.
- If the WASM bundling defeated you, an honest report: what you tried, why it failed, your recommendation (try X for another day vs abandon the swap).
