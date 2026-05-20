# PRD-46 — PBV Scanner Mobile Polish, Accessibility, and Capture Guidance

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-scanner-mobile-polish-46`
**Status:** Draft — ready for build
**Depends on:** PRD-45 shipped on `dev` (`effb2f0`). Files this PRD modifies all exist on dev.
**Blocks:** Nothing currently in flight.

---

## Problem Statement

Testing on the deployed `dev` build surfaced three usability problems with the live-preview scanner introduced by PRD-45. None block capture, but each one makes the tenant flow harder to complete on a real phone:

1. **Post-capture preview is unreadable.** After a successful scan, the preview `<img>` renders at `w-full` with no height cap. On a phone, a portrait document image fills the entire viewport height and pushes the Retake / Use-this buttons below the fold. The tenant cannot see both the preview and the action buttons at the same time, and has no idea what to do next.

2. **Large phone text breaks the layout.** When a tenant has iOS Dynamic Type or Android display text set above default size (a common accessibility setting, especially for the older end of the applicant pool), button text overflows its fixed-height container, button pairs jam against each other, and tooltip / warning copy wraps awkwardly. The scanner becomes hostile to the people most likely to need it.

3. **No persistent "how to take a good photo" guidance.** PRD-45 ships `FirstScanTooltip`, but it fires only once per device (localStorage flag), only after permission grant, only in the live preview stage, and auto-dismisses in 3 seconds. Tenants who tap "Scan document" the second time, who deny camera permission and fall back to file picker, or who simply blink, get no guidance at all. The per-task `instructions` prop tells them *what* to photograph, not *how* to photograph it well.

Mission-critical context: 77 active applicants this cycle, mostly on phones, many older / non-English-first / not technical. Every rejected scan is a Tess/Kristine phone call. The live-preview scanner from PRD-45 is the right capture mechanism; this PRD makes it survivable on real devices.

---

## Current state (confirmed 2026-05-19 against `dev`)

| Surface | Path | Notes |
|---|---|---|
| Scanner component | `components/DocumentScanner/DocumentScanner.tsx` | 684 lines. Stages: entry → (live_preview \| processing) → warning → preview → review_pages → submitting. **Issue 1** lives in preview + warning stage `<img className="w-full ...">` (lines ~555, ~582). **Issue 2** lives in the `min-h-12` + side-by-side `flex gap-2` button pairs throughout. |
| Live preview stage | `components/DocumentScanner/LivePreviewStage.tsx` | 217 lines. Has **hardcoded English** "Capture now" / "Cancel" strings (lines ~190, ~197) — missed in PRD-45's translation pass. Also `min-h-[48px]` fixed. |
| First-scan tooltip | `components/DocumentScanner/FirstScanTooltip.tsx` | 61 lines. Fires once per device, only after camera permission grant, auto-dismisses in 3s. Out of scope for this PRD — leave alone. |
| Card-stack caller (active mobile UI) | `components/pbv/cards/DocumentCard.tsx` | Parent surface around the scanner. Audit for `text-xs` and fixed widths at large-text. |
| Translations | `components/DocumentScanner/translations.ts` | Add `captureNow`, `cancel`, capture-guidance strings, and expand-panel labels. |

---

## Goals

1. **Preview always fits in the viewport** with Retake / Use-this visible below it on a single screen, on iPhone SE (375px wide) and similar narrow viewports.
2. **Layout survives 200% OS text size** with no overflow, no jammed buttons, no clipped copy. No regression at 100%.
3. **Persistent capture guidance** visible to every tenant on every scan — not gated on localStorage, not gated on permission, not auto-dismissed.
4. **No regression to PRD-45's live-preview UX.** Detection loop, stability tracking, auto-capture, low-light warning, FirstScanTooltip all stay as-is.
5. **Translations complete.** No hardcoded English in any scanner surface.

## Non-Goals

- **No changes to the live preview detection / capture pipeline.** Edge detection loop, stability tracker, jscanify integration, quality gate — all stay.
- **No example photo images.** Placeholder for Phase 2 — Alex supplies do/don't reference images later. MVP is text-only guidance.
- **No new analytics / telemetry events.**
- **No changes to `FormPhotoUpload.tsx`.** Different component, used by non-PBV forms (move-in inspection, pet approval, etc.). Out of scope here.
- **No iOS-specific or Android-specific branching beyond what PRD-45 already does** (`liveSupported`).
- **No new dependencies.**

---

## Users & Roles

| Role | What changes |
|---|---|
| Tenant on phone, default text size | Preview now fits in viewport. Retake / Use-this always visible. Guidance text visible on entry and preview stages. |
| Tenant on phone, large text (OS accessibility) | Layout reflows cleanly. Buttons grow with text. No overlap, no clipping. |
| Tenant who denies camera permission | Falls back to file-picker entry stage (existing behavior). Guidance text still visible — useful for them too. |
| Stanton staff | Same review flow. Better-quality scans land via the same path. No staff-side UI change. |
| HACH reviewers | No change — they don't touch the scanner. |

---

## Closed Decisions

1. **Preview is contained, not cropped.** Use `max-h-[50vh] object-contain` on mobile, allow taller on desktop. Rationale: tenant needs to verify the photo is readable — cropping defeats that. Containing the full image into ~half the viewport height lets the buttons fit below.

2. **Mobile-first button layout.** All button pairs (Retake / Use-this, Retake / Use-anyway) stack vertically on narrow viewports and switch to horizontal on `sm:` and up. Stacking is safer at large text than flex-1 + side-by-side.

3. **Guidance: inline tip + expandable panel.** One short, always-visible tip line above the primary Scan button. One `<details>`-style expandable panel below it ("How to take a good photo") with 4-5 bullets, collapsed by default. Both translated en/es/pt. No example images in MVP.

4. **Guidance is shown on entry stage only.** Not on preview, not on warning, not on review_pages — those stages should stay focused on the action at hand. Rationale: by the time the tenant has captured a photo, they've already had a chance to read the guidance. Putting it on every stage clutters the flow.

5. **`min-h-12` stays as the floor.** The min-height becomes a floor, not a fix — buttons get `h-auto` so they can grow. The 48px floor is still useful for touch-target sizing at default text.

6. **Inline tip text is permanent / not dismissible.** It's short (one line) and shouldn't be hideable — that defeats the purpose. The expandable panel handles users who want more detail.

---

## Detailed Changes

### F1 — Preview image sizing

**File:** `components/DocumentScanner/DocumentScanner.tsx`

**Stages affected:** `warning` (line ~555) and `preview` (line ~582).

**Change:**
```tsx
// Before
<img src={currentPage.previewUrl} className="w-full border border-[var(--border)] rounded-none" />

// After
<img
  src={currentPage.previewUrl}
  alt={...existing alt...}
  className="w-full max-h-[50vh] object-contain bg-[var(--bg-section)] border border-[var(--border)] rounded-none"
/>
```

**Rationale:**
- `max-h-[50vh]` caps height to half the viewport so action buttons fit on one screen.
- `object-contain` preserves aspect ratio so a portrait document doesn't get squished — letterboxed against the bg-section background instead.
- Background color makes the letterboxing intentional rather than looking like a layout bug.

**Verification:** On iPhone SE (375 × 667), capture a portrait document. After capture, Retake and Use-this buttons must both be visible without scrolling.

---

### F2 — Button layout reflow

**Files:**
- `components/DocumentScanner/DocumentScanner.tsx` (multiple stages)
- `components/DocumentScanner/LivePreviewStage.tsx` (Capture now / Cancel)

**Change pattern:**
```tsx
// Before
<div className="flex gap-2">
  <button className="flex-1 min-h-12 ...">{t.retake}</button>
  <button className="flex-1 min-h-12 ...">{t.useThis}</button>
</div>

// After
<div className="flex flex-col sm:flex-row gap-2">
  <button className="w-full sm:flex-1 min-h-12 h-auto py-3 ...">{t.retake}</button>
  <button className="w-full sm:flex-1 min-h-12 h-auto py-3 ...">{t.useThis}</button>
</div>
```

**Apply to every button pair in DocumentScanner.tsx:** warning stage (Retake / Use-anyway), preview stage (Retake / Use-this), and review_pages stage's vertical button group already stacks correctly — leave it.

**Single buttons (Scan document, Cancel, Submit, Add page):** add `h-auto py-3` alongside `min-h-12` so they grow with content at large text.

**LivePreviewStage:** replace `min-h-[48px]` → `min-h-12 h-auto py-3`. Stack Capture-now + Cancel vertically always (they already are — verify no change needed).

**Rationale:** Stacked buttons at narrow / large-text never overlap. `flex-1` at large text creates uneven button widths when one label wraps to 2 lines and the other stays 1 line — stacking dodges this.

**Verification:** Set Chrome devtools mobile emulation to iPhone SE, root font-size to 32px (200% of 16px default), walk through every scanner stage. No button text clipping, no button overlap, no text overflow outside any container.

---

### F3 — Hardcoded English in LivePreviewStage

**File:** `components/DocumentScanner/LivePreviewStage.tsx`

**Change:**
- Add `captureNow` and `cancel` to the `translations` object in `components/DocumentScanner/translations.ts` (en/es/pt).
- Import `translations` in `LivePreviewStage.tsx` and replace the hardcoded `Capture now` and `Cancel` strings with `t.captureNow` and `t.cancel`.
- The existing `t = { lowLightWarning: ... }` inline object becomes `const t = translations[language]` — same pattern as DocumentScanner.tsx.

**Translation strings to add:**
| Key | en | es | pt |
|---|---|---|---|
| `captureNow` | Capture now | Capturar ahora | Capturar agora |
| `cancel` | Cancel | Cancelar | Cancelar |
| `lowLightWarning` | It's dark — try moving to better light | Está oscuro — intenta mejor luz | Está escuro — tente melhor luz |

(`cancel` may already exist for the entry stage. If so, reuse it. `lowLightWarning` moves from inline to translations.)

---

### F4 — Capture guidance on entry stage

**File:** `components/DocumentScanner/DocumentScanner.tsx`, entry stage (lines ~445-505).

**Insert two new elements** between the `{instructions}` paragraph (line ~448) and the primary Scan-document / Take-photo CTAs:

#### F4a — Inline tip (always visible, not dismissible)

```tsx
<div className="bg-[var(--bg-section)] border-l-2 border-[var(--primary)] pl-3 py-2">
  <p className="text-sm text-[var(--ink)] leading-snug">
    {t.inlineTip}
  </p>
</div>
```

Translation:
| Key | en | es | pt |
|---|---|---|---|
| `inlineTip` | Hold the document flat. All four corners in the frame. Good light. | Mantén el documento plano. Las cuatro esquinas en el marco. Buena luz. | Mantenha o documento plano. Os quatro cantos no quadro. Boa iluminação. |

#### F4b — Expandable "How to take a good photo" panel

Use native HTML `<details>` for accessibility — works with screen readers, keyboard, no JS state needed.

```tsx
<details className="border border-[var(--border)] rounded-none">
  <summary className="px-3 py-2 cursor-pointer text-sm font-medium text-[var(--ink)] hover:bg-[var(--bg-section)]">
    {t.howToTitle}
  </summary>
  <div className="px-3 pb-3 pt-1 space-y-2">
    <p className="text-sm text-[var(--ink)] leading-relaxed">{t.howToIntro}</p>
    <ul className="text-sm text-[var(--ink)] leading-relaxed list-disc pl-5 space-y-1">
      <li>{t.howToBullet1}</li>
      <li>{t.howToBullet2}</li>
      <li>{t.howToBullet3}</li>
      <li>{t.howToBullet4}</li>
    </ul>
  </div>
</details>
```

Translation strings to add (en / es / pt):

| Key | en | es | pt |
|---|---|---|---|
| `howToTitle` | How to take a good photo | Cómo tomar una buena foto | Como tirar uma boa foto |
| `howToIntro` | A few quick tips help us approve your document on the first try. | Algunos consejos rápidos para aprobar tu documento la primera vez. | Algumas dicas rápidas para aprovarmos seu documento na primeira vez. |
| `howToBullet1` | Lay the document on a flat, dark surface. A table works well. | Coloca el documento sobre una superficie plana y oscura. Una mesa funciona bien. | Coloque o documento sobre uma superfície plana e escura. Uma mesa funciona bem. |
| `howToBullet2` | Stand directly above it. Don't take the photo at an angle. | Párate directamente encima. No tomes la foto en ángulo. | Fique diretamente acima. Não tire a foto em ângulo. |
| `howToBullet3` | Make sure the whole document is in the frame — all four corners. | Asegúrate de que todo el documento esté en el marco — las cuatro esquinas. | Certifique-se de que todo o documento esteja no quadro — os quatro cantos. |
| `howToBullet4` | Good light. Avoid shadows from your hand or phone. | Buena luz. Evita sombras de tu mano o teléfono. | Boa luz. Evite sombras da sua mão ou telefone. |

**Placement order in entry stage (top to bottom):**
1. `instructionsTitle` heading (existing)
2. `instructions` paragraph (existing, per-task)
3. **NEW** Inline tip
4. **NEW** Expandable "How to take a good photo" panel
5. Primary Scan-document CTA (or fallback Take-photo)
6. Secondary text links / Choose file
7. Error message
8. Cancel button

---

### F5 — Card-stack parent surface audit

**File:** `components/pbv/cards/DocumentCard.tsx`

**Task:** Walk the parent surface that mounts `DocumentScanner` and check for layout fragility at large text:
- Any `text-xs` used in body copy → bump to `text-sm` so it scales with OS settings without going sub-readable at default.
- Any fixed `h-*` or `w-*` (numeric, e.g. `h-12`, `w-64`) on text-containing elements → switch to `min-h-*` + `h-auto`, or remove the constraint.
- Any `overflow-hidden` on containers that hold text-containing children → verify it's there for layout reasons (badges, etc.) and not silently clipping content.
- Any `flex` with fixed-width children that hold text → check wrap behavior.

**Acceptance:** Card surface at 200% root font-size still renders all text fully readable, no clipping, no horizontal scroll. No regression at default size.

**Out of scope here:** the broader PBV tenant flow outside the card stack. We're scoping to the card that wraps the scanner.

---

## Architecture Rules

1. **No detection-pipeline changes.** Anything in `edgeDetectionLoop.ts`, `stabilityTracker.ts`, `QuadOverlay.tsx`, `usePermissionPrompt.ts` is off-limits. PRD-45 just shipped and is stable.
2. **No localStorage / sessionStorage in new code.** The inline tip and expandable panel are stateless. FirstScanTooltip's existing localStorage flag stays as-is.
3. **All new user-facing strings go through `translations.ts`.** Zero hardcoded English.
4. **Native `<details>` / `<summary>`, not a custom accordion.** Accessibility (screen reader announce, keyboard support) is free with the native element. No `useState` for expand/collapse.
5. **Tailwind only, no custom CSS.** Match the existing scanner style (`rounded-none`, var-based colors, `font-serif` for titles).
6. **No new files unless necessary.** Inline guidance lives in `DocumentScanner.tsx` entry stage. Translation additions go in the existing `translations.ts`. The only file that *might* warrant extraction is the expandable panel — but at 4 bullets + intro, inline is fine.

---

## Verification Gates

Build is not done until all of the following pass. Use Chrome devtools mobile emulation; no real device required.

### Gate 1 — Preview fits in viewport (default text)
- Device: iPhone SE (375 × 667)
- Walk: Scan / Take photo → capture a portrait document → land on preview stage
- **Pass:** Both Retake and Use-this buttons visible without scrolling. Preview image visible above them, not cropped (object-contain), centered against bg-section letterbox.
- Repeat for the `warning` stage (capture an intentionally blurry photo to trigger quality flag).

### Gate 2 — Large-text reflow (no overflow)
- Device: iPhone SE (375 × 667)
- Set root font-size: 32px (DevTools → Rendering → Emulate CSS or `document.documentElement.style.fontSize='32px'`).
- Walk every stage: entry → live_preview → processing → warning → preview → review_pages.
- **Pass at each stage:**
  - No text clipped by a fixed-height container.
  - No two buttons overlapping.
  - No text overflowing horizontally past the card boundary.
  - All buttons fully tappable (>=44pt effective touch target after scaling).

### Gate 3 — No regression at default text
- Repeat Gate 1 walk at default font-size on iPhone SE *and* iPhone 14 Pro Max (430 × 932).
- **Pass:** Layout looks the same as the pre-PRD-46 dev build, plus the inline tip and expandable panel. No new spacing weirdness.

### Gate 4 — Translations complete
- Set `language` prop to `es` and `pt` in turn.
- Walk: entry → live_preview → preview.
- **Pass:** No English strings visible anywhere. Specifically check Capture now / Cancel in LivePreviewStage and the new inline tip + how-to panel.

### Gate 5 — Expandable panel works
- Tap the "How to take a good photo" summary.
- **Pass:** Panel opens, shows 4 bullets. Tap again, panel closes. Works with keyboard (Enter / Space when focused). Screen reader announces "How to take a good photo, collapsed/expanded."

### Gate 6 — Card-stack parent doesn't break at large text
- Set 32px root, navigate the full tenant flow that lands on `DocumentCard.tsx`.
- **Pass:** Card header, task instruction, scanner mount point all readable. No layout collapse.

### Gate 7 — Build + types
- `npx tsc --noEmit` passes.
- `npm run build` passes (see shell protocol in build prompt).
- No new lint errors.

---

## Out of Scope (do not touch)

- Detection loop, stability tracker, QuadOverlay, usePermissionPrompt.
- FirstScanTooltip — keep its current behavior (one-time, post-permission, 3s auto-dismiss).
- `FormPhotoUpload.tsx` — different component, different forms.
- Example photo images for the how-to panel — Phase 2.
- Telemetry / analytics.
- Server-side image processing.
- Any change to the PBV full app form itself (`app/pbv-full-app/[token]/page.tsx`).
- HACH reviewer surfaces.
- Admin / staff workspace surfaces.

---

## Phasing

**Single phase, single merge.** No reason to split — all six changes are small, scoped to 3 files (plus the parent audit), and share a verification surface.

Estimated Windsurf time: 3-5 hours including verification gates.

---

## Open Questions

| Question | Owner | Blocker? |
|---|---|---|
| Should the expandable panel default to open on first ever scan and remember closed via localStorage afterward? | Alex | No — MVP defaults to closed. Revisit if tenant comprehension testing shows people miss it. |
| Should the inline tip vary per document type (e.g. "Make sure dates are visible" for paystubs)? | Alex | No — Phase 2 if useful. The per-task `instructions` prop already handles task-specific copy. |
| Are there other surfaces using `min-h-12` button pairs that this PRD should sweep? | Build agent | No — out of scope. Scoped to scanner + DocumentCard parent. |
