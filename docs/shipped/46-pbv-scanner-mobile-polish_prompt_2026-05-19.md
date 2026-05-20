# Windsurf Build Prompt — PRD-46: PBV Scanner Mobile Polish + Accessibility + Capture Guidance

You are building from `docs/fullApp-Plan/46-pbv-scanner-mobile-polish_prd_2026-05-19.md`. Read the PRD before doing anything. This prompt is the operational handoff; the PRD is the source of truth.

---

## Branch and base

- Base off `dev` (PRD-45 is shipped there, not on `main`).
- Branch: `feat/pbv-scanner-mobile-polish-46`
- Final merge target: `dev`. Do not merge to `main`.
- Confirm `git rev-parse HEAD` before starting — must be the tip of `dev` (`7adbc78` or later).

---

## Shell / npm protocol (mandatory)

`npm` commands hang regularly in this environment. Protect every shell call.

- **Explicit timeouts.** `npm install` ~120s. `npm run build` ~300s. If a command emits no output for 60s, treat as hung: kill, retry once with `--prefer-offline --no-audit --no-fund`, then report to user if still stuck. Do not retry indefinitely.
- **Prefer `npm ci --no-audit --no-fund --prefer-offline`** over `npm install` when `package-lock.json` is current. Faster, deterministic, less likely to hang.
- **Do NOT run `npm run dev` from agent commands.** It is long-running and looks like a hang. Assume the user runs dev separately. Use `npm run build` (or `npx tsc --noEmit` for type-only checks) as the compilation gate.
- **Batch dependency additions.** Never run `npm install <pkg>` more than once per phase. (This PRD adds zero deps — there should be no installs.)
- **Husky / postinstall hangs:** retry with `HUSKY=0 npm ci --ignore-scripts` and note in the build report.
- **Verification gate order:** `npx tsc --noEmit` first (fast, types-only, rarely hangs), then `npm run build` if types pass. Catches most errors without burning build minutes.
- **Supabase CLI migrations:** same protocol — explicit timeout, single retry, report if stuck. This PRD has no migrations.
- **LLM vs shell hang:** distinguish "LLM is thinking" (up to ~30s for Sonnet) from "shell is hung" (no output for 60s). Don't kill LLM calls early.
- **Burned 2 retries on the same command and it still hangs?** Stop. Report what command + what output. Do not silently work around by inventing alternatives like `yarn` or `pnpm` — this repo is npm-based.

---

## Files to modify

| File | Change |
|---|---|
| `components/DocumentScanner/DocumentScanner.tsx` | F1 preview sizing (warning + preview stages), F2 button reflow (every button pair), F4 entry-stage guidance (inline tip + expandable panel). |
| `components/DocumentScanner/LivePreviewStage.tsx` | F2 reflow on Capture-now / Cancel, F3 translations for `captureNow`, `cancel`, `lowLightWarning`. |
| `components/DocumentScanner/translations.ts` | Add F3 + F4 strings to all three languages (en/es/pt). See PRD for the exact string table. |
| `components/pbv/cards/DocumentCard.tsx` | F5 large-text audit — see PRD for criteria. |

**Do not create new files.** All guidance and panel markup lives inline in `DocumentScanner.tsx`. Translation additions go in the existing `translations.ts`.

---

## Files NOT to touch

- `components/DocumentScanner/edgeDetectionLoop.ts`
- `components/DocumentScanner/stabilityTracker.ts`
- `components/DocumentScanner/QuadOverlay.tsx`
- `components/DocumentScanner/usePermissionPrompt.ts`
- `components/DocumentScanner/FirstScanTooltip.tsx`
- `components/DocumentScanner/quality.ts`
- `components/form/FormPhotoUpload.tsx`
- Any file under `app/`
- Any migration file

If you find a change you think is needed in one of these, stop and ask. Do not silently expand scope.

---

## Step-by-step

### Step 0 — Read

1. Read the PRD: `docs/fullApp-Plan/46-pbv-scanner-mobile-polish_prd_2026-05-19.md`.
2. Read the four files listed under "Files to modify" — full contents, not just the sections being changed.
3. Note the exact line numbers in `DocumentScanner.tsx` where the `w-full` preview images live (PRD says ~555 and ~582; verify against current dev).

### Step 1 — Translations first

Open `components/DocumentScanner/translations.ts`. Add every key listed in the PRD's F3 and F4 sections to all three languages. Use the exact strings from the PRD — do not paraphrase.

Type-check after this step: `npx tsc --noEmit`.

### Step 2 — LivePreviewStage hardcoded English (F3)

Open `components/DocumentScanner/LivePreviewStage.tsx`.

- Replace the inline `const t = { lowLightWarning: ... }` block with `const t = translations[language]`.
- Replace `Capture now` literal with `{t.captureNow}`.
- Replace `Cancel` literal with `{t.cancel}`.
- Make sure the import of `translations` is added.

Type-check.

### Step 3 — Preview image sizing (F1)

Open `components/DocumentScanner/DocumentScanner.tsx`. Find the `<img>` in the `warning` stage and the one in the `preview` stage. Apply the className change from the PRD:

```tsx
className="w-full max-h-[50vh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none"
```

Same change for both stages. Preserve existing `alt` text.

### Step 4 — Button reflow (F2)

Walk every `<div className="flex gap-2">` button pair in `DocumentScanner.tsx`. Apply the pattern from the PRD:

- Outer container: `flex flex-col sm:flex-row gap-2`.
- Each child button: change `flex-1 min-h-12 ...` → `w-full sm:flex-1 min-h-12 h-auto py-3 ...`.

For single-button-per-row elements (Scan document, Cancel at entry, Submit, Add page): add `h-auto py-3` alongside the existing `min-h-12`. Do not remove `min-h-12` — it's the floor.

In `LivePreviewStage.tsx`: change `min-h-[48px]` to `min-h-12 h-auto py-3` on the Capture-now button. Cancel button already uses `min-h-12` — add `h-auto py-3`.

### Step 5 — Entry-stage guidance (F4)

In `DocumentScanner.tsx`, locate the entry stage (`{stage === 'entry' && (...)}` block). Insert two new elements between the existing `<p className="text-sm text-[var(--ink)] leading-relaxed">{instructions}</p>` and the `{liveSupported ? ... : ...}` conditional block:

**F4a — Inline tip:** copy the markup from the PRD verbatim, using `t.inlineTip`.

**F4b — Expandable panel:** copy the `<details>` markup from the PRD verbatim, using `t.howToTitle`, `t.howToIntro`, `t.howToBullet1` through `t.howToBullet4`. Use the native `<details>` element — do not introduce useState or any custom toggle logic.

### Step 6 — DocumentCard parent audit (F5)

Open `components/pbv/cards/DocumentCard.tsx`. Audit per the PRD's F5 criteria:
- Any `text-xs` in body copy → `text-sm`.
- Any fixed `h-{N}` / `w-{N}` on text-containing elements → `min-h-{N}` + `h-auto`, or remove.
- Any `overflow-hidden` on text containers — verify intentional.

Make minimum-necessary changes. If you find something invasive, stop and ask before changing it.

### Step 7 — Type check

`npx tsc --noEmit`. Must pass cleanly.

### Step 8 — Build

`npm run build`. Honor the shell protocol — 300s timeout, single retry on hang, report if stuck.

### Step 9 — Verification gates (manual, devtools)

Per PRD Gates 1-6. Document each Gate in the build report:
- Gate 1: screenshot of preview stage on iPhone SE, default text, showing image + both buttons.
- Gate 2: screenshot at each of entry / live_preview (mock if camera unavailable) / preview / review_pages at 32px root font-size.
- Gate 3: screenshot at default font-size confirming no regression.
- Gate 4: short note confirming no English in es/pt walkthroughs.
- Gate 5: short note confirming `<details>` open / close behavior.
- Gate 6: screenshot of DocumentCard at 32px root.
- Gate 7: paste of `npx tsc --noEmit` and `npm run build` output.

---

## Translation key checklist

Confirm every one of these is present in en/es/pt of `translations.ts` before opening a PR. The PRD has the exact copy.

- `captureNow`
- `cancel` (may already exist — confirm)
- `lowLightWarning`
- `inlineTip`
- `howToTitle`
- `howToIntro`
- `howToBullet1`
- `howToBullet2`
- `howToBullet3`
- `howToBullet4`

---

## What "done" looks like

1. Branch `feat/pbv-scanner-mobile-polish-46` pushed to origin with all changes.
2. `npx tsc --noEmit` clean.
3. `npm run build` clean.
4. PR opened against `dev` (not `main`) with the PRD link in the description.
5. Build report written to `docs/build-reports/46-pbv-scanner-mobile-polish_build-report_2026-05-19.md` documenting all 7 verification gates with the screenshots / pastes called out above.

---

## What NOT to do

- Do not change the detection / capture pipeline. PRD-45 is stable; this PRD is polish, not rewrite.
- Do not introduce localStorage / sessionStorage anywhere. The expandable panel uses native `<details>` — no state persistence.
- Do not introduce a custom accordion component. Native `<details>` is the spec.
- Do not add any new dependency.
- Do not run `npm run dev`. Use build + type-check.
- Do not paraphrase the translation strings. Copy them from the PRD verbatim. Spanish/Portuguese fluency varies among the applicant base; consistency with PRD-45's existing translation tone matters.
- Do not merge to `main`. Target `dev`.
- Do not silently expand scope. If you find a fix you think is needed in an out-of-scope file, stop and ask.

---

## Reporting back

When done, post in the chat:
- Branch name + commit SHA at HEAD.
- PR URL.
- Build report URL.
- Anything you punted on with the reason.
- Any verification gate that was hard to satisfy or required a workaround.
