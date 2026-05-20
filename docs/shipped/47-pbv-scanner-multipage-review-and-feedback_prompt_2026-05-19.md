# Windsurf Build Prompt — PRD-47: PBV Scanner Multi-Page Review, Contrast Feedback, Debug Overlay Gating

You are building from `docs/fullApp-Plan/47-pbv-scanner-multipage-review-and-feedback_prd_2026-05-19.md`. Read the PRD before doing anything. This prompt is the operational handoff; the PRD is the source of truth.

---

## Branch and base

- Base off `dev` (PRD-46 is shipped there or in flight; this stacks on top).
- Branch: `feat/pbv-scanner-multipage-review-47`
- Final merge target: `dev`. Do not merge to `main`.
- Confirm `git rev-parse HEAD` before starting — must be tip of `dev`.
- If PRD-46's branch hasn't merged yet, rebase onto it once it lands. Do not block on it — the files diverge cleanly.

---

## Shell / npm protocol (mandatory)

`npm` commands hang regularly in this environment. Protect every shell call.

- **Explicit timeouts.** `npm install` ~120s. `npm run build` ~300s. If a command emits no output for 60s, treat as hung: kill, retry once with `--prefer-offline --no-audit --no-fund`, then report to user if still stuck. Do not retry indefinitely.
- **Prefer `npm ci --no-audit --no-fund --prefer-offline`** over `npm install` when `package-lock.json` is current. Faster, deterministic, less likely to hang.
- **Do NOT run `npm run dev` from agent commands.** It is long-running and looks like a hang. Assume the user runs dev separately. Use `npm run build` (or `npx tsc --noEmit` for type-only checks) as the compilation gate.
- **This PRD adds zero deps** — there should be no installs.
- **Husky / postinstall hangs:** retry with `HUSKY=0 npm ci --ignore-scripts` and note in the build report.
- **Verification gate order:** `npx tsc --noEmit` first (fast, types-only), then `npm run build`.
- **No migrations in this PRD.**
- **Burned 2 retries on the same command and it still hangs?** Stop. Report what command + what output. Do not invent alternatives like `yarn` or `pnpm`.

---

## Files to modify

| File | Change |
|---|---|
| `components/DocumentScanner/translations.ts` | F5 — add new keys (review stage, stuck banner) to en/es/pt. Some are functions. |
| `components/pbv/DebugErrorOverlay.tsx` | F4 — add `NODE_ENV !== 'production'` second gate to `enabled` boolean. One-line change. |
| `components/DocumentScanner/LivePreviewStage.tsx` | F3 — add `isStuck` derived state, polling effect, stuck banner render. |
| `components/DocumentScanner/DocumentScanner.tsx` | F1 — drop `isSingleMode` branch in `commitCurrentPage`. F2 — replace `review_pages` stage block with new thumbnail list + conditional Add-page + explicit Upload structure. |

**Do not create new files.** All markup lives inline in `DocumentScanner.tsx`. Translation additions go in the existing `translations.ts`.

---

## Files NOT to touch

- `components/DocumentScanner/edgeDetectionLoop.ts`
- `components/DocumentScanner/stabilityTracker.ts`
- `components/DocumentScanner/QuadOverlay.tsx`
- `components/DocumentScanner/usePermissionPrompt.ts`
- `components/DocumentScanner/FirstScanTooltip.tsx`
- `components/DocumentScanner/quality.ts`
- `components/pbv/cards/DocumentCard.tsx` (this PRD does not touch the caller)
- `components/form/FormPhotoUpload.tsx`
- Any file under `app/`
- Any migration file

If you find a change you think is needed in one of these, stop and ask. Do not silently expand scope.

---

## Step-by-step

### Step 0 — Read

1. Read the PRD: `docs/fullApp-Plan/47-pbv-scanner-multipage-review-and-feedback_prd_2026-05-19.md`.
2. Read the four files listed under "Files to modify" — full contents, not just the sections being changed.
3. Locate `commitCurrentPage` in `DocumentScanner.tsx` (PRD says line 337). Locate the existing `review_pages` stage block in the same file — verify what it currently renders before replacing.

### Step 1 — Translations first (F5)

Open `components/DocumentScanner/translations.ts`. Add every key listed in PRD §F5 to all three languages. Several are *functions* that take a number (e.g., `reviewTitle(n)`, `pageNumber(n)`, `uploadNPages(n)`). The translation file's existing type must support function-valued entries — verify by checking how PRD-46 added any function strings, or follow this pattern:

```ts
// In the type definition
reviewTitle: (n: number) => string;
pageNumber: (n: number) => string;
uploadNPages: (n: number) => string;

// In each language object
reviewTitle: (n) => `Review your ${n} page${n === 1 ? '' : 's'}`,
pageNumber: (n) => `Page ${n}`,
uploadNPages: (n) => `Upload ${n} pages`,
```

Use the exact strings from the PRD — do not paraphrase. If the existing translations type doesn't allow function values, extend it minimally (add to the type interface and the three language objects). Do not refactor the file beyond what's strictly required.

Type-check after this step: `npx tsc --noEmit`.

### Step 2 — Debug overlay gate (F4)

Open `components/pbv/DebugErrorOverlay.tsx`. Find:

```tsx
const enabled = search?.get('debug') === '1';
```

Replace with:

```tsx
const enabled =
  search?.get('debug') === '1' &&
  process.env.NODE_ENV !== 'production';
```

That's the entire change. Do not touch anything else in this file. Do not remove the sessionStorage logic — it stays as gated dead code in prod.

Type-check.

### Step 3 — LivePreviewStage stuck timer (F3)

Open `components/DocumentScanner/LivePreviewStage.tsx`.

**Add state and ref near other refs/state at the top of the component** (near line 95, where `lastValidQuadAtRef` lives):

```tsx
const lastNonSeekingAtRef = useRef<number>(Date.now());
const [isStuck, setIsStuck] = useState(false);
```

**Inside the `onQuad` callback** (around line 142, after `setStabilityState(state)` is called):

```tsx
if (state.kind !== 'seeking') {
  lastNonSeekingAtRef.current = Date.now();
  if (isStuck) setIsStuck(false);
}
```

Note: `isStuck` referenced inside the callback creates a closure-stale-state risk. Use the functional form or a ref to read the current value. Safer pattern:

```tsx
setIsStuck((prev) => (prev && state.kind !== 'seeking' ? false : prev));
```

…and only call this when `state.kind !== 'seeking'`. Verify on your end which form passes the lint hook-deps rule.

**Add a polling effect** at the same level as the other useEffects:

```tsx
useEffect(() => {
  const id = setInterval(() => {
    if (Date.now() - lastNonSeekingAtRef.current > 8000) {
      setIsStuck(true);
    }
  }, 1000);
  return () => clearInterval(id);
}, []);
```

**Render the stuck banner** alongside the existing `showLowLightWarning` and `!detectionAvailable` banners (around line 223). Place it AFTER both — so suppression precedence works naturally based on render order. Use the exact JSX from the PRD §F3:

```tsx
{isStuck && !showLowLightWarning && detectionAvailable && (
  <div className="absolute top-4 left-4 right-4 z-40 bg-amber-100/95 border border-amber-300 px-4 py-3 rounded-none">
    <p className="text-sm text-amber-900 leading-snug">{t.stuckHint}</p>
    <p className="text-xs text-amber-900/80 mt-1 leading-snug">{t.stuckHintSecondary}</p>
  </div>
)}
```

Note the suppression rule has *three* conditions: stuck, no low-light banner showing, and detection IS available (we suppress when fallen back to manual-only because the existing "Auto-detect unavailable" banner already covers that case).

Type-check.

### Step 4 — `commitCurrentPage` shortcut removal (F1)

Open `components/DocumentScanner/DocumentScanner.tsx`. Find `commitCurrentPage` (line ~337). Replace with:

```tsx
const commitCurrentPage = () => {
  if (!currentPage) return;
  setPages((prev) => [...prev, currentPage]);
  setCurrentPage(null);
  setQualityOverride(false);
  setStage('review_pages');
};
```

Notes:
- Function is no longer `async` because we no longer await `finalizeSubmit` here. Check call sites for awaited usage and adjust if needed (likely fine — the `onClick` handlers don't care).
- `isSingleMode` is still referenced elsewhere (button labels at line ~701, Add-page gating in Step 5). Do NOT delete the constant.

Type-check.

### Step 5 — Replace `review_pages` stage block (F2)

Open `components/DocumentScanner/DocumentScanner.tsx`. Find the existing `{stage === 'review_pages' && (...)}` block. Replace its inner JSX with the structure from PRD §F2 verbatim. Key behavioral requirements:

- Vertical list of thumbnails (`<ul className="space-y-3">`), each row showing image + page number + quality-flag note (if any) + delete link.
- "Add another page" button shown only when `!isSingleMode && pages.length < (maxPages ?? 30)`. Routes to `setStage('entry')`.
- "Upload N page(s)" button — label switches based on `pages.length === 1`. Calls `finalizeSubmit(pages)`. Disabled when `pages.length === 0` (defensive; shouldn't happen).
- "Cancel and start over" — revokes all preview URLs, clears pages, routes to `entry`.

**Existing `deletePage` function** is already present (line ~352) — reuse it; don't redefine.

**Existing button styling pattern from PRD-46:** `w-full min-h-12 h-auto py-3` on full-width buttons. Match.

If the existing `review_pages` block contains anything the new structure misses (e.g., a "Finish capture" or "Build PDF" button you don't see in this prompt), preserve it ONLY if it's actually called from somewhere — otherwise replace cleanly. Note any preserved leftover in the build report.

Type-check.

### Step 6 — Type check

`npx tsc --noEmit`. Must pass cleanly. If a translations function-signature error surfaces, fix the type definition in `translations.ts` to accommodate function values; do not paper over with `as any`.

### Step 7 — Build

`npm run build`. Honor the shell protocol — 300s timeout, single retry on hang, report if stuck.

### Step 8 — Verification gates (manual, devtools)

Per PRD Gates 1-8. Document each Gate in the build report:

- **Gate 1:** screenshot of `review_pages` stage with one page, `multiPage={false}` — must show "Upload 1 page" button and NO "Add page" button.
- **Gate 2:** screenshot of `review_pages` stage with 5 pages, `multiPage={true}` — list visible, Upload count matches, delete shrinks the list.
- **Gate 3:** screenshot of stuck banner appearing on a low-contrast scene within 8 seconds. Easiest test: point camera at a blank white wall, count to 10. If you can't get a real low-contrast scene in dev, temporarily lower the threshold to 2000ms for the test and revert.
- **Gate 4:** short note confirming stuck banner did NOT appear on a working scene (document on dark surface, auto-capture fired normally).
- **Gate 5:** screenshot or HTML inspect confirming `?debug=1` does NOT show overlay on a production build, but DOES show on `npm run dev`.
- **Gate 6:** short note confirming Spanish + Portuguese walkthroughs have no English in any new strings (review stage, stuck banner).
- **Gate 7:** screenshot of `review_pages` with 3 pages at 32px root font-size — buttons and thumbnails legible, no overflow.
- **Gate 8:** paste of `npx tsc --noEmit` and `npm run build` output.

---

## Translation key checklist

Confirm every one of these is present in en/es/pt of `translations.ts` before opening a PR. PRD §F5 has the exact copy.

- `reviewTitle(n)` (function)
- `reviewHint`
- `pageNumber(n)` (function)
- `deletePage`
- `addPage`
- `uploadOnePage`
- `uploadNPages(n)` (function)
- `cancelAndStartOver`
- `qualityWarning`
- `stuckHint`
- `stuckHintSecondary`

---

## What "done" looks like

1. Branch `feat/pbv-scanner-multipage-review-47` pushed to origin with all changes.
2. `npx tsc --noEmit` clean.
3. `npm run build` clean.
4. PR opened against `dev` (not `main`) with the PRD link in the description.
5. Build report written to `docs/build-reports/47-pbv-scanner-multipage-review-and-feedback_build-report_2026-05-19.md` documenting all 8 verification gates with the screenshots / pastes called out above.

---

## What NOT to do

- Do not change the detection / capture pipeline. Edge detection, stability tracker, jscanify integration, quality gate — off-limits.
- Do not introduce `localStorage` / `sessionStorage` anywhere new. The existing `sessionStorage` in `DebugErrorOverlay.tsx` stays as-is (gated dead code in prod after F4).
- Do not paraphrase translation strings. Copy from the PRD verbatim.
- Do not introduce a new dependency.
- Do not run `npm run dev` from agent commands. Use `npm run build` + `npx tsc --noEmit`.
- Do not merge to `main`. Target `dev`.
- Do not silently expand scope. If you find a fix you think is needed in an out-of-scope file (especially `DocumentCard.tsx` or the detection loop), stop and ask.
- Do not delete `isSingleMode` from `DocumentScanner.tsx` — it's still used for button labels and Add-page gating.
- Do not change the 8-second stuck threshold unless explicitly told to. It's user-confirmed.
- Do not delete `DebugErrorOverlay.tsx`. Just double-gate it.

---

## Reporting back

When done, post in the chat:
- Branch name + commit SHA at HEAD.
- PR URL.
- Build report URL.
- Anything you punted on with the reason.
- Any verification gate that was hard to satisfy or required a workaround.
- Result of Open Question O1 if it came up during build (does the server accept single-page PDFs from `supportsMultiFile === false` fields? If you tested an upload and the server rejected it, that's important to flag).
