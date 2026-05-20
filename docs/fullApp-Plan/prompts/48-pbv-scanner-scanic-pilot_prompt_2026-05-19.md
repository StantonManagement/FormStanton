# Windsurf Build Prompt — PRD-48: Scanic Detection-Library Pilot

You are building from `docs/fullApp-Plan/48-pbv-scanner-scanic-pilot_prd_2026-05-19.md`. Read the PRD before doing anything. This prompt is the operational handoff; the PRD is the source of truth.

**Important:** unlike PRD-47, this PRD is a **pilot, not a swap**. The deliverable is a working branch *and a measured build report comparing both detectors*. Do not delete the jscanify path. The decision to merge happens after Alex reviews the build report.

---

## Branch and base

- Base off `dev`. Do NOT stack on PRD-47's branch.
- Branch: `feat/pbv-scanner-scanic-pilot-48`
- Final target: PR opens against `dev`. **Do not merge.** PR exists for review + comparison; the merge decision follows the build report.
- If PRD-47 lands on `dev` before this branch finishes, rebase onto post-47 `dev` before opening the PR. Conflict resolution guidance is in PRD-48 "Branch strategy" section.
- Confirm `git rev-parse HEAD` against `dev`'s tip before starting.

---

## Shell / npm protocol (mandatory)

Standard rules from prior prompts plus one new wrinkle: **this PRD adds a dep.**

- **Explicit timeouts.** `npm install` ~120s. `npm run build` ~300s. `npx tsc --noEmit` ~60s. Hung = no output for 60s — kill, retry once with `--prefer-offline --no-audit --no-fund`, then report. Do not retry indefinitely.
- **Adding the `scanic` dep:** run `npm install scanic --save --no-audit --no-fund` *once*. Lock the version in `package-lock.json` immediately. Do not re-run if it succeeded. If `npm install` hangs, retry once with `HUSKY=0 npm install scanic --save --ignore-scripts --no-audit --no-fund` and note in the build report. If it still hangs, stop and ask Alex — do not try alternatives like `yarn` or `pnpm`.
- **Confirm version pinned:** after install, `grep scanic package.json` and `grep scanic package-lock.json` should both succeed. Note the pinned version in the build report.
- **Do NOT run `npm run dev` from agent commands.** Use `npm run build` and `npx tsc --noEmit`.
- **No migrations in this PRD.**
- **Burned 2 retries and still hung?** Stop. Report what hung. Don't silently work around.

---

## Files to modify

| File | Change |
|---|---|
| `package.json` + `package-lock.json` | F1 — add `scanic` dependency. |
| `components/DocumentScanner/edgeDetectionLoop.ts` | F2 + F4 — introduce `DetectorAdapter` interface, two adapter factories (`createJscanifyAdapter`, `createScanicAdapter`), async-detect branch in the RAF loop. **Note: this file was off-limits in PRD-46/47. In PRD-48 it is in scope.** |
| `components/DocumentScanner/LivePreviewStage.tsx` | F3 — replace `ensureOpenCvLoaded` + `ensureJscanifyLoaded` direct usage with `ensureDetectorLoaded` returning a `DetectorAdapter`. Detection-loop call signature changes from passing `jscanify` to passing the adapter. |
| `components/DocumentScanner/DocumentScanner.tsx` | F5 — replace direct `jscanify.extractPaper` in `processImageBlob` with `adapter.extract`. |
| `docs/build-reports/48-pbv-scanner-scanic-pilot_build-report_2026-05-19.md` | F7 — **the deliverable.** Side-by-side comparison report. See "What 'done' looks like" below. |

**Do not create new files.** Both adapter factories live inline in `edgeDetectionLoop.ts`. Detector-selection helper lives inline in `LivePreviewStage.tsx`. The single new file is the build report.

---

## Files NOT to touch

- `components/DocumentScanner/stabilityTracker.ts`
- `components/DocumentScanner/QuadOverlay.tsx`
- `components/DocumentScanner/usePermissionPrompt.ts`
- `components/DocumentScanner/FirstScanTooltip.tsx`
- `components/DocumentScanner/quality.ts`
- `components/DocumentScanner/translations.ts` (no new strings in this PRD)
- `components/pbv/DebugErrorOverlay.tsx`
- `components/pbv/cards/DocumentCard.tsx`
- `components/form/FormPhotoUpload.tsx`
- Any file under `app/`
- Any migration file

If you find a change you think is needed in one of these, stop and ask. Do not silently expand scope.

---

## Step-by-step

### Step 0 — Read

1. Read PRD-48: `docs/fullApp-Plan/48-pbv-scanner-scanic-pilot_prd_2026-05-19.md`. Read the full thing, including Decision Criteria.
2. Read the four files listed under "Files to modify" — full contents.
3. Read PRD-47 for context if not already familiar — PRD-47 changes are likely already on `dev` (or about to be). Your changes need to compose cleanly.
4. Open the Scanic README in a browser: `https://github.com/marquaye/scanic`. Note the `Scanner` class API, the `scan(image, options)` shape, the result-object shape.

### Step 1 — Add the dep (F1)

```sh
npm install scanic --save --no-audit --no-fund
```

Confirm `scanic` appears in `package.json` `dependencies` and is locked in `package-lock.json`. Note the exact version installed in the build report (e.g., `scanic@1.0.6`).

Type-check: `npx tsc --noEmit`. Must pass — Scanic ships its own types.

### Step 2 — Introduce `DetectorAdapter` in `edgeDetectionLoop.ts` (F2)

Open `components/DocumentScanner/edgeDetectionLoop.ts`. Add the interface near the top of the file alongside `Quad`:

```ts
export interface DetectorAdapter {
  /** Per-frame corner detection. Returns null if no document found. */
  detect: (canvasOrVideo: HTMLCanvasElement | HTMLVideoElement) => Promise<Quad | null>;
  /** Still-image extraction (perspective-corrected canvas). Returns null on failure. */
  extract: (image: HTMLImageElement) => Promise<HTMLCanvasElement | null>;
  /** True if the per-frame `detect` should be treated as async in the RAF loop. */
  isAsync: boolean;
}
```

Add two factory functions, also inline, near the existing helpers:

```ts
export function createJscanifyAdapter(jscanify: unknown): DetectorAdapter {
  // Wraps the existing logic. detect() runs the same `cv.imread` →
  // `findPaperContour` → `getCornerPoints` chain that's currently inline in
  // the RAF loop. extract() wraps `extractPaper`.
  // isAsync: false — jscanify is synchronous.
  // Returns Promises only to satisfy the interface; resolve synchronously.
}

export function createScanicAdapter(scanner: import('scanic').Scanner): DetectorAdapter {
  // detect: `await scanner.scan(input, { mode: 'detect' })`, then map
  // result.corners → Quad. Return null when !result.success.
  // extract: `await scanner.scan(image, { mode: 'extract', output: 'canvas' })`.
  // Return result.output as HTMLCanvasElement, or null on !result.success.
  // isAsync: true.
}
```

**Important about the jscanify adapter:** the existing detection-loop code already does `cv.imread(offscreenCanvas)` + `jscanify.findPaperContour(mat)` + `getCornerPoints` + Mat cleanup inline. Extract that into the adapter. The RAF loop should not know which library it's using.

Type-check.

### Step 3 — RAF loop branches on `isAsync` (F4)

In `startDetectionLoop`, change the signature from `jscanify: unknown` to `adapter: DetectorAdapter`. Inside the RAF tick, branch:

```ts
let inFlight = false;

function tick() {
  // ... existing throttle / brightness logic stays unchanged ...

  if (adapter.isAsync) {
    if (inFlight) return; // skip this frame; another detection is in progress
    inFlight = true;
    adapter.detect(offscreenCanvas)
      .then((quad) => {
        if (!state.isRunning) return;
        const validated = quad && isValidQuad(quad, offscreenCanvas.width, offscreenCanvas.height) ? quad : null;
        const scaled = validated ? scaleQuadBack(validated, scale) : null;
        onQuad(scaled);
      })
      .catch((err) => {
        console.warn('[detect] adapter error', err);
        onQuad(null);
      })
      .finally(() => {
        inFlight = false;
      });
  } else {
    // Synchronous path: adapter.detect returns a Promise that's already resolved.
    // Use the same .then chain for symmetry, OR call adapter.detect and
    // synchronously read .then((q) => ...) — Node's microtask queue runs at the
    // same RAF tick. Whichever is cleaner; the loop's behavior must not change
    // for jscanify users.
  }
}
```

**Critical: brightness / low-light check stays synchronous and runs every frame regardless of detector**. It's a different code path; do not move it inside the `isAsync` branch.

Verify the `Quad` returned by `createScanicAdapter` is in the same coordinate space as jscanify's output — i.e., **the offscreen-canvas pixel space, before any scale-back**. If Scanic returns corners in the original-image space (the `image.naturalWidth` space), we have to scale them down to offscreen-canvas space before `isValidQuad`, then scale them back up for the overlay. Test this carefully — the QuadOverlay maps video-pixel space to display space, so the quad it receives must be in video/offscreen-canvas pixel space.

Type-check.

### Step 4 — Detector selection in `LivePreviewStage.tsx` (F3)

Open `components/DocumentScanner/LivePreviewStage.tsx`. Add the detector-selection logic above the component, then refactor the load path.

```ts
function getDetectorChoice(): 'scanic' | 'jscanify' {
  if (typeof window !== 'undefined') {
    const param = new URL(window.location.href).searchParams.get('scanner');
    if (param === 'scanic' || param === 'jscanify') return param;
  }
  return process.env.NEXT_PUBLIC_SCANNER_DETECTOR === 'scanic' ? 'scanic' : 'jscanify';
}

async function ensureDetectorLoaded(): Promise<DetectorAdapter> {
  const choice = getDetectorChoice();
  if (choice === 'scanic') {
    const { Scanner } = await import('scanic');
    type ScanicInst = InstanceType<typeof Scanner>;
    const w = window as unknown as { __scanicInstance?: ScanicInst };
    if (!w.__scanicInstance) {
      w.__scanicInstance = new Scanner();
      await w.__scanicInstance.initialize();
    }
    return createScanicAdapter(w.__scanicInstance);
  }
  await ensureOpenCvLoaded();
  const jscanify = await ensureJscanifyLoaded();
  return createJscanifyAdapter(jscanify);
}
```

Replace the existing `useEffect` that calls `ensureJscanifyLoaded` with one that calls `ensureDetectorLoaded` and stores the adapter (not jscanify) in state:

```tsx
const [adapter, setAdapter] = useState<DetectorAdapter | null>(null);

useEffect(() => {
  let mounted = true;
  ensureDetectorLoaded()
    .then((a) => { if (mounted) setAdapter(a); })
    .catch((err) => {
      if (!mounted) return;
      setDetectionAvailable(false);
      console.warn('[LivePreviewStage] detector load failed; manual capture only', err);
    });
  return () => { mounted = false; };
}, []);
```

Update the detection-loop useEffect to pass `adapter` instead of `jscanifyInstance`:

```tsx
useEffect(() => {
  if (!adapter || !videoReady) return;
  // ... existing startDetectionLoop call, but pass adapter instead of jscanify ...
}, [adapter, videoReady]);
```

Rename the local var `jscanifyInstance` to `adapter` throughout this component. Do not delete `ensureOpenCvLoaded` / `ensureJscanifyLoaded` — they're called from the jscanify branch of `ensureDetectorLoaded`.

Note: PRD-47 added `isStuck` state and a polling effect to this file. Leave that as-is — your changes are additive to the detector loading, not the stuck-timer logic.

Type-check.

### Step 5 — `processImageBlob` uses adapter (F5)

Open `components/DocumentScanner/DocumentScanner.tsx`. Find `processImageBlob` (line ~254). Replace the inline `ensureOpenCvLoaded` + `ensureJscanifyLoaded` + `new Jscanify()` + `extractPaper` with:

```ts
try {
  const adapter = await ensureDetectorLoaded(); // import this from LivePreviewStage or extract to a shared file — see below
  const extracted = await adapter.extract(image);
  finalCanvas = extracted ?? (() => {
    const c = document.createElement('canvas');
    c.width = image.naturalWidth;
    c.height = image.naturalHeight;
    c.getContext('2d')?.drawImage(image, 0, 0);
    return c;
  })();
} catch {
  // existing fallback path — draw raw image to canvas
}
```

`ensureDetectorLoaded` and the adapter factories should be **exported from `edgeDetectionLoop.ts`** so both `LivePreviewStage.tsx` and `DocumentScanner.tsx` can import them. Move `ensureDetectorLoaded` into `edgeDetectionLoop.ts` if it isn't already (it needs `ensureOpenCvLoaded` + `ensureJscanifyLoaded` which currently live in `LivePreviewStage.tsx` — you can either move them to `edgeDetectionLoop.ts`, or keep them in LivePreviewStage and re-export, or extract to a small shared helper file).

**Constraint: no new files.** Therefore move the helpers into `edgeDetectionLoop.ts`. Note the relocation in the build report.

Note: `processImageBlob` runs once per still-image capture. The `await ensureDetectorLoaded()` here returns the same singleton adapter the live preview is using — should be cached at that point and resolve immediately.

Type-check.

### Step 6 — Type check and build (Gate 8)

- `npx tsc --noEmit` — must pass cleanly. Common pitfalls:
  - Scanic's `Scanner` import type — verify `InstanceType<typeof Scanner>` works, otherwise import the type directly if exported.
  - `result.corners.bottomRight` vs jscanify's `bottomRightCorner` naming — verify mapping in `createScanicAdapter`.
  - Async signatures throughout the loop — `Promise<Quad | null>` everywhere.
- `npm run build` — must pass cleanly. Honor the 300s timeout / single-retry rule.

### Step 7 — Comparison report (Gates 1-9, this is THE deliverable)

Write `docs/build-reports/48-pbv-scanner-scanic-pilot_build-report_2026-05-19.md`. This is not a checkbox-tick report; it is the artifact Alex uses to decide whether to merge. Include all of:

#### Gate 1 — Both detectors load
- `?scanner=jscanify` → screenshot showing live preview, network tab showing `docs.opencv.org/4.x/opencv.js` requested.
- `?scanner=scanic` → screenshot showing live preview, network tab showing NO request to `docs.opencv.org`. Network tab should show the scanic chunk loading (look for a `.wasm` request).

#### Gate 2 — Auto-capture on clean scene
- Same physical document, dark surface, well-lit.
- `?scanner=jscanify`: seconds to first valid quad, seconds to auto-capture, screenshot of captured image.
- `?scanner=scanic`: same measurements, same screenshot.

#### Gate 3 — Low-contrast scene (THE primary criterion)
- Same physical document on a light wood floor (or your worst-case reproducible scene).
- `?scanner=jscanify`: seconds to first valid quad (if any), did auto-capture fire within 30s, screenshot at 30s mark.
- `?scanner=scanic`: same measurements.
- If Scanic substantially outperforms here → flag as the headline finding.
- If Scanic does NOT outperform here → flag prominently. This is the make-or-break test.

#### Gate 4 — Bundle size
- Run `npm run build` twice if needed — once with `.env.local` containing `NEXT_PUBLIC_SCANNER_DETECTOR=jscanify`, once with `=scanic`. (Or run once and note that the dynamic-imported chunks differ at runtime; the static bundle should be similar since both paths exist in source.)
- Paste the relevant chunk sizes from Next.js build output.
- Note the **runtime** network savings (the ~9MB OpenCV.js fetch that doesn't happen on the Scanic path) — this is the bigger user-facing win and doesn't show in static bundle sizes.

#### Gate 5 — Fast 3G latency
- Chrome DevTools → Network → Fast 3G + Disable cache.
- Cold open `?scanner=jscanify`: timer from "Scan document" tap to first quad overlay drawn.
- Cold open `?scanner=scanic`: same timer.
- This gate exists to confirm the bundle-size delta translates to a real cellular UX improvement.

#### Gate 6 — Still extraction
- Capture any document with each detector. Confirm `processImageBlob` produces a cropped/warped canvas (not a raw frame) under both.
- Compare crop quality between the two on the same physical document.

#### Gate 7 — Regression sweep
- Spanish + Portuguese walkthroughs unchanged. FirstScanTooltip still fires. Quality flags still surface. Multi-page review tray (from PRD-47, if landed) still works with both detectors.

#### Gate 8 — Type check + build clean
- Paste of `npx tsc --noEmit` (should be empty / no output).
- Paste of `npm run build` exit code and route count.

#### Gate 9 — PRD-47 composability
- If PRD-47 is on `dev`, rebase, then verify: review stage works after Scanic capture; stuck timer fires on a scene Scanic can't handle; debug overlay still gated.
- If PRD-47 not yet on `dev`, note "composability test deferred until PRD-47 lands" and skip.

#### Decision recommendation
End the report with one of:
- **"Merge Scanic, default to Scanic, follow-up PRD to remove jscanify."** — if all five decision criteria in PRD-48 hold.
- **"Merge Scanic, keep jscanify as runtime fallback."** — if 1, 3, 5 hold but 2 (latency) doesn't.
- **"Archive branch, keep jscanify."** — if criterion 1 (low-contrast) fails.
- **"Inconclusive — need [specific additional test]."** — if you weren't able to reproduce one of the scenes.

Be honest about which scenes you could and could not reproduce. If you only had access to a desk, say so — don't fabricate a "wood floor" test.

---

## What "done" looks like

1. Branch `feat/pbv-scanner-scanic-pilot-48` pushed to origin with all changes.
2. `npx tsc --noEmit` clean.
3. `npm run build` clean.
4. `package.json` and `package-lock.json` show `scanic` pinned to a specific version.
5. PR opened against `dev` with the PRD link in the description. **Mark the PR as Draft.** Do not request review-and-merge — Alex reviews the build report first.
6. Build report at `docs/build-reports/48-pbv-scanner-scanic-pilot_build-report_2026-05-19.md` covers all 9 verification gates with screenshots/measurements/quotes, ending in a one-of-four decision recommendation.

---

## What NOT to do

- **Do not merge the PR.** This is a pilot. The merge decision is Alex's after reading the build report.
- **Do not delete jscanify code, the OpenCV.js loader, or any reference to either.** Both pathways must remain operational for the A/B comparison and for the post-pilot decision.
- **Do not skip the build report.** A merged-or-mergeable PR without the comparison report is useless — this PRD's deliverable is the data, not the diff.
- **Do not optimize Scanic's threshold parameters** beyond the README defaults. We want to compare like-for-like. If defaults fail, that's a finding — record it, don't paper over it.
- **Do not add Scanic-specific UI states** (e.g., "powered by Scanic" badges). Library is implementation detail.
- **Do not add new translations.** No user-facing strings change.
- **Do not introduce `localStorage` / `sessionStorage`.**
- **Do not introduce a fallback-on-runtime-failure** path (Scanic fails → fall back to jscanify). That's a separate decision; keep this branch's behavior simple — if the chosen detector fails, fall back to file picker per existing behavior.
- **Do not paraphrase the Scanic README's API claims in the build report.** Quote them precisely and tie each to your measurements.
- **Do not invent test scenes you didn't actually photograph.** If you only had three real scenes, report on three. Empty rows in the comparison table beat fabricated ones.

---

## Reporting back

When done, post in the chat:
- Branch name + commit SHA at HEAD.
- PR URL (marked Draft).
- Build report URL.
- Headline finding: did Scanic outperform jscanify on the low-contrast scene? One sentence.
- Pinned Scanic version.
- Any open question from PRD-48 (O1-O5) that came up — answer what you observed.
- Anything you punted on with the reason.
