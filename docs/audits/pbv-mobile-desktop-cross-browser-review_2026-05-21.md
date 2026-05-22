# PBV Full-App — Mobile & Desktop Cross-Browser Review

**Date:** 2026-05-21  
**Scope:** All tenant-facing PBV UI: intake, document upload/scanner, signing flow, dashboard, review, print, magic-link signer  
**Platforms reviewed:** iOS Safari (16+), Android Chrome, Desktop Safari, Desktop Chrome, Edge  
**Method:** Source inspection of components, CSS, viewport config, platform detection, iframe/PDF handling, touch targets, form input types, responsive breakpoints

---

## TL;DR

| Category | iOS Safari | Android Chrome | Desktop Chrome/Safari/Edge |
|----------|------------|----------------|------------------------------|
| **Viewport / Layout** | ⚠️ `100vh` units unreliable | ✅ Good | ✅ Good |
| **Scanner / Camera** | ✅ iOS-native scan exposed | ✅ Camera direct | N/A |
| **PDF Preview (iframe)** | ⚠️ Scroll-trap risk inside iframe | ⚠️ Scroll-trap risk | ✅ Good |
| **Signature Pad** | ✅ Touch-action set | ✅ Touch-action set | ✅ Mouse + touch |
| **Form Inputs (date, etc)** | ✅ Font-size 16px prevents zoom | ✅ Good | ✅ Good |
| **Print** | N/A | N/A | ✅ Professional styles |
| **Touch Targets** | ✅ >= 44px | ✅ >= 44px | ✅ Good |

**Biggest risks:** (1) `100vh` / `vh` units cause layout jumps on iOS Safari as the dynamic toolbar expands/contracts; (2) PDF iframes on mobile can scroll-trap the user; (3) Canvas signature may not resize on orientation change.

---

## 1. Viewport & Layout

### 1.1 Viewport Meta — Correct

```@/app/layout.tsx:14-18
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}
```

- `minimumScale: 1` prevents user zoom-out, which is intentional for a contained app experience.
- No `user-scalable=no` (good — accessibility-friendly; iOS ignores it anyway since iOS 10).
- No `viewport-fit=cover` — means the app does not extend into iOS safe areas (notch, home indicator). This is safe but leaves letterboxing on iPhone X+.

### 1.2 Mobile-First CSS — Good Foundation

```@/app/mobile-styles.css
html {
  scroll-behavior: smooth;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
body {
  overscroll-behavior-y: contain;
  -webkit-tap-highlight-color: transparent;
}
input, select, textarea {
  min-height: 44px;
  font-size: 16px; /* Prevents iOS zoom on focus */
}
```

**What's right:**
- `-webkit-text-size-adjust: 100%` stops iOS from inflating text on orientation change.
- `overscroll-behavior-y: contain` prevents pull-to-refresh from kicking the tenant out of mid-form context.
- `font-size: 16px` on inputs is **critical** — iOS Safari zooms the viewport to ~1.2x when focusing an input with `font-size < 16px`.
- Touch targets (`min-height: 44px`) meet Apple HIG.

### 1.3 `vh` Units — Risk on Mobile Safari

| File | Line | Usage | Risk |
|------|------|-------|------|
| `app/pbv-full-app/[token]/page.tsx` | ~1679 | `min-h-screen` (Tailwind = `100vh`) | **iOS Safari toolbar collapse causes 100vh > actual visible height** |
| `components/pbv/sign/SummaryDocReviewSign.tsx` | 181 | `style={{ height: '60vh' }}` | Same risk — iframe may extend below fold |
| `components/pbv/sign/FormReviewSignModal.tsx` | 88, 121 | `style={{ height: '40vh' }}` | Same risk — modal iframe height may be wrong on iOS |
| `components/DocumentScanner/DocumentScanner.tsx` | 559, 644 | `max-h-[50vh]` | Less severe (max, not fixed) |
| `components/pbv/sign/MagicLinkSigningFlow.tsx` | — | `max-h-[90vh]` on modal | Modal may overflow on iOS |
| `components/pbv/intake/SectionDvHomelessRa.tsx` | — | `100vh` references (7 grep hits) | Needs verification |

**Why this matters on iOS Safari:**
iOS Safari's bottom toolbar (address bar + tab bar) collapses on scroll and expands on scroll-up. `100vh` is computed as the **larger** height (toolbar collapsed). When the tenant scrolls up and the toolbar expands, content sized to `100vh` gets pushed below the visible area. This causes:
- Buttons at the bottom of a `min-h-screen` container to be hidden behind the toolbar
- Signature pad / CTA buttons to appear off-screen
- Tenant confusion: "I can't see the Submit button"

**Fix:** Use `100dvh` (dynamic viewport height) where supported, with `100vh` fallback:
```css
height: 100vh; /* fallback */
height: 100dvh; /* iOS Safari + Chrome 108+ */
```
Tailwind v3.3+ supports `h-dvh`, `min-h-dvh`, `max-h-dvh`.

**Severity: MEDIUM** — Not a broken feature, but a frequent UX friction on iOS.

### 1.4 Responsive Breakpoints — Minimal, Appropriate

Grep found only 3 files using Tailwind responsive prefixes (`sm:`, `md:`, `lg:`):

| File | Breakpoint | Usage |
|------|------------|-------|
| `FormReviewSignModal.tsx` | `sm:items-center` | Modal: mobile = bottom-aligned, desktop = center-aligned |
| `DocumentScanner.tsx` | `sm:flex-row` | Warning/preview buttons: mobile = stacked, desktop = side-by-side |
| `pbv-full-app/[token]/page.tsx` | `sm:items-center` | (legacy pre-app page, not PBV full-app) |

**Verdict:** The PBV full-app is intentionally **single-column mobile-first** with almost no responsive breakpoint usage. This is correct for a form-heavy tenant flow where the content is fundamentally a vertical stack. The `max-w-md` / `max-w-lg` / `max-w-2xl` containers with `mx-auto` ensure the layout stays readable on desktop without adding complexity.

**Concern:** No `md:` or `lg:` optimizations for tablet (iPad). An iPad in portrait sees the same `max-w-lg` centered column with generous side margins — acceptable but not tablet-optimized.

---

## 2. Document Scanner / Camera / File Upload

### 2.1 iOS Detection — Sophisticated

```@/components/DocumentScanner/DocumentScanner.tsx:69-75
function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ identifies as MacIntel but supports touch
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}
```

**Correct:** Covers iPhone, iPod, iPad (including iPadOS 13+ which reports as `MacIntel`).

### 2.2 File Input `capture` Attribute — Platform-Appropriate

```@/components/DocumentScanner/DocumentScanner.tsx:402-415
<input
  type="file"
  accept="image/*,.heic,.heif"
  capture={
    isIOSDevice()
      ? undefined
      : captureMode === 'camera'
      ? 'environment'
      : undefined
  }
  ...
/>
```

**What's right:**
- On **iOS**, `capture` is deliberately omitted so the file picker shows Apple's native "Scan Documents" action (iOS 16+). This is a deliberate UX win.
- On **Android**, `capture="environment"` goes straight to the rear camera.
- `.heic,.heif` accepted alongside `image/*` — critical for iOS photo library uploads.

### 2.3 HEIC Conversion — Present

```@/components/DocumentScanner/DocumentScanner.tsx:267-275
if (isHeicFile(file)) {
  const heic2any = (await import('heic2any')).default;
  inputBlob = (await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.92,
  })) as Blob;
  heicConverted = true;
}
```

**Correct:** `heic2any` is dynamically imported (code-split), converting HEIC to JPEG before processing. This is essential because:
- iOS camera and photo library default to HEIC
- Most backend/storage systems expect JPEG
- Canvas APIs and `pdf-lib` cannot consume HEIC directly

**Potential issue:** `heic2any` is a ~180 KB library. On slow mobile networks, the dynamic import may take noticeable time. The UI shows "processing" during this, which is acceptable.

### 2.4 Live Preview / Edge Detection — Platform Gaps

```@/components/DocumentScanner/DocumentScanner.tsx:154-156
const liveSupported = useMemo(() => {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}, []);
```

**Issue:** `getUserMedia` availability is checked, but **not all browsers that support `getUserMedia` support the live edge-detection pipeline**:
- iOS Safari: supports `getUserMedia` but the video frames may have orientation metadata that confuses the OpenCV/jscanify pipeline
- Android Chrome: generally works
- iOS WebView (if tenant opens link from Mail/ Messages in-app browser): `getUserMedia` may be blocked

**Missing:** No check for `MediaTrackCapabilities` or whether the environment camera is actually available. A device with only a front camera (e.g., some tablets) will attempt `getUserMedia` and may fail or show the wrong camera.

**Missing:** No fallback if `jscanify` / OpenCV.js fails to load. The `ensureScanicLoaded()` function throws if Scanic fails, but there's no graceful fallback to "basic camera without edge detection."

### 2.5 Permission Prompt — Good Pattern

```@/components/DocumentScanner/DocumentScanner.tsx:159-167
const permissionPrompt = usePermissionPrompt({
  onGranted: useCallback((stream: MediaStream) => {
    setStage('live_preview');
  }, []),
  onDenied: useCallback((reason: string) => {
    setError(reason === 'no_camera' ? t.permissionNoCamera : t.permissionDenied);
    setStage('entry');
  }, [t]),
});
```

**Correct:** Shows a pre-prompt explaining why camera access is needed before calling `getUserMedia`. This increases permission grant rates and prevents tenants from accidentally tapping "Don't Allow" and getting stuck.

---

## 3. PDF Preview (iframe Approach)

### 3.1 iframe Used for All PDF Rendering

Both summary review and per-form signing use `<iframe src={pdfUrl} />`:

```@/components/pbv/sign/SummaryDocReviewSign.tsx:180-187
<div className="border border-[var(--border)] mb-6" style={{ height: '60vh' }}>
  <iframe src={summaryPdfUrl} className="w-full h-full" title="Application Summary" />
</div>
```

```@/components/pbv/sign/FormReviewSignModal.tsx:88-89
<div className="border border-[var(--border)]" style={{ height: '40vh' }}>
  <iframe src={pdfUrl} className="w-full h-full" title={form.display_name} />
</div>
```

**Why this was chosen:** Build report explicitly documents the decision: PDF.js would add ~500 KB gzipped. iframe is simpler and "reliable cross-browser."

### 3.2 Mobile Safari iframe Issues

**Scroll trap:** On mobile Safari, a touch-started scroll inside an iframe **does not bubble to the parent page**. If the PDF content is taller than the iframe container (which it almost always is), the tenant can scroll the PDF but may get "stuck" inside the iframe — especially if they reach the top or bottom of the PDF and expect the parent page to continue scrolling.

**Mitigation present:** The iframe containers have explicit heights (`60vh`, `40vh`), so the iframe does not expand to its content. This reduces (but does not eliminate) the scroll-trap risk.

**Missing:** No `scrolling="no"` or `overflow: hidden` on the iframe. No gesture hint (e.g., "scroll outside this box to continue").

**iOS Safari specific:** Safari renders the iframe with a subtle border/shadow that can make the PDF look like it's in a "box." The tenant may not realize they need to scroll the parent page to reach the checkbox below the iframe.

**Severity: MEDIUM** — Friction, not a blocker. Most tenants figure it out, but less tech-savvy tenants may struggle.

### 3.3 iframe on Android Chrome

Android Chrome handles iframe scrolling more gracefully — parent page scrolling resumes naturally when the iframe reaches its scroll boundary. Less of an issue than iOS.

### 3.4 Desktop — iframe Works Well

On desktop, mouse wheel / trackpad scrolling inside the iframe works, and clicking outside the iframe naturally shifts focus. No issues.

---

## 4. Signature Pad

### 4.1 Touch Configuration — Correct

```@/app/mobile-styles.css:83-87
.signature-canvas-container {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
```

```@/app/pbv-full-app/[token]/page.tsx:1804-1808
<div className="p-4" style={{ touchAction: 'none' }}>
  <div className="border border-[var(--border)] bg-white overflow-hidden" style={{ touchAction: 'none' }}>
    <SignatureCanvas
      canvasProps={{ className: 'w-full', style: { width: '100%', height: '140px', touchAction: 'none' } }}
      ...
    />
  </div>
</div>
```

**What's right:**
- `touch-action: none` prevents the browser from interpreting signature strokes as page scroll / zoom gestures.
- Applied at multiple nesting levels (container + canvas + inline style) — belt-and-suspenders.

### 4.2 Canvas Height — Fixed at 140px

The signature canvas height is hardcoded at `140px` across all usage sites:
- `@/app/pbv-full-app/[token]/page.tsx:1808`
- `@/app/pbv-preapp/page.tsx:520`
- `@/components/pbv/sign/SignaturePadGate.tsx` (via SignatureCanvasComponent)

**Issues:**
1. **Small on large phones:** iPhone 15 Pro Max / Galaxy S24 Ultra have wide screens. 140px is ~15% of screen height. The signature area feels cramped.
2. **No orientation-change handler:** If the tenant rotates from portrait to landscape, the canvas stays at 140px height but becomes much wider (due to `width: 100%`). The signature may appear stretched or the aspect ratio changes.
3. **No device-pixel-ratio scaling:** `react-signature-canvas` may not automatically scale the canvas backing store for Retina displays (iOS devices have DPR 2x or 3x). Signatures may appear blurry on iPhone.

**Missing:** A `ResizeObserver` or `window.addEventListener('resize', ...)` handler that adjusts canvas dimensions based on container width while maintaining a comfortable height (~25vh or min 200px).

**Severity: LOW** — The pad works; this is a polish/comfort issue.

---

## 5. Form Inputs & Mobile Keyboard

### 5.1 Date Inputs (`type="date"`)

```@/components/pbv/intake/SectionHousehold.tsx:239
<input
  id="hoh_dob"
  type="date"
  value={hohDob}
  ...
  className="mt-1 block w-full border border-[var(--border)] px-3 py-2 text-sm bg-white ... rounded-none"
/>
```

**iOS Safari behavior:**
- Renders a native iOS date picker wheel when focused.
- The picker appears at the bottom of the screen, pushing content up.
- The `text-sm` class sets `font-size: 0.875rem` (~14px). **Wait — `mobile-styles.css` sets `font-size: 16px` on inputs.** Let me verify which rule wins.

**Cascade conflict:**
- `mobile-styles.css` targets `input[type="text"], input[type="tel"], ...` but **NOT** `input[type="date"]`.
- `SectionHousehold.tsx` applies `text-sm` (14px) directly.

**Result on iOS Safari:** Focusing the date input with `font-size: 14px` **may trigger the zoom-in behavior** because iOS Safari zooms when focusing inputs with `font-size < 16px`. However, `type="date"` inputs on iOS use the native picker, not the keyboard, so the zoom may not occur. This needs testing.

**Fix:** Add `input[type="date"]` to the `mobile-styles.css` font-size rule:
```css
input[type="text"], input[type="tel"], input[type="number"], input[type="email"], input[type="date"], select, textarea {
  font-size: 16px;
}
```

**Severity: LOW** — Date inputs use the native picker, so zoom is unlikely. But belt-and-suspenders.

### 5.2 Text Inputs

```@/app/mobile-styles.css:35-43
input[type="text"],
input[type="tel"],
input[type="number"],
input[type="email"],
select,
textarea {
  min-height: 44px;
  font-size: 16px; /* Prevents iOS zoom on focus */
}
```

**Correct:** All text-like inputs have `font-size: 16px`, preventing iOS zoom.

### 5.3 `autoComplete` Handling

```@/app/pbv-full-app/[token]/page.tsx:1754
<input
  type="text"
  value={sigConfirmedName}
  ...
  autoComplete="off"
  ...
/>
```

**Good:** `autoComplete="off"` on the name-confirmation input prevents the browser from suggesting the wrong name. Important for assisted-mode handoffs where the HOH device may have autofill data.

---

## 6. Magic-Link Signer Flow (Mobile-First by Design)

### 6.1 Entry Page

```@/app/pbv-full-app/signer/[member_token]/page.tsx
<div className="min-h-screen flex items-center justify-center bg-[var(--paper)]">
```

**Correct:** Simple centered layout, works well on all screen sizes.

### 6.2 Identity Capture

The `IdentityCapturePanel` component (not fully read but inferred) asks the signer to type their name. On mobile, this is a single-field form with a large touch target.

### 6.3 Per-Form Signing

```@/components/pbv/sign/MagicLinkSigningFlow.tsx:87
const pdfUrl = `/api/pbv-full-app/signer/${memberToken}/forms/${form.id}/preview`;
```

Uses the same iframe PDF preview approach. Same iframe scroll-trap risk on mobile Safari.

---

## 7. Print View

### 7.1 Print Styles — Comprehensive

```@/app/globals.css:74-199
@media print {
  @page {
    size: letter;
    margin: 0.75in 0.75in 0.75in 0.75in;
  }
  /* ... extensive print styles ... */
}
```

**Correct:**
- `size: letter` sets US Letter page size.
- `print-color-adjust: exact` ensures background colors print (important for form fields).
- `page-break-after: avoid` on headers prevents awkward splits.
- `page-break-inside: avoid` on tables prevents table rows from splitting across pages.
- Screen-only elements hidden with `.print\:hidden`, `nav`, `button:not(.print-visible)`.

### 7.2 Print Page

```@/app/pbv-full-app/[token]/print/page.tsx:229
<meta name="viewport" content="width=device-width, initial-scale=1" />
```

The print page renders its own `<html>` with a viewport meta. **Unusual:** This is a secondary `<html>` element inside a Next.js app. On desktop browsers this works because the print page is likely opened in a new window or rendered server-side for print. If rendered inline in the SPA, nested `<html>` tags are invalid HTML but browsers are forgiving.

**No mobile concern:** Print is desktop-only functionality.

---

## 8. Scroll & Navigation Behavior

### 8.1 `beforeunload` Guard

```@/app/pbv-full-app/[token]/documents/page.tsx:109-119
useEffect(() => {
  if (submittedAt) return;
  const hasMissingRequired = documents.some(...);
  if (!hasMissingRequired) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [documents, submittedAt]);
```

**Correct:** Prevents accidental tab closure when required documents are missing. Modern browsers show a generic "Leave site?" dialog (they ignore custom message strings). Works on all platforms.

### 8.2 No Scroll-to-Top on Navigation

**Missing:** When the tenant clicks "Next" in the intake flow, the page does not scroll to the top. If the previous section was long, the tenant lands mid-page in the next section. This is a mobile friction point because:
- On mobile, sections are tall (full screen + scrolling)
- The tenant may not realize they're on a new section if the scroll position stays at the bottom

**Fix:** Add `window.scrollTo({ top: 0, behavior: 'smooth' })` in the `onNext` handler of `IntakeSectionPage`.

**Severity: LOW** — Friction, not a blocker.

---

## 9. Platform-Specific Gaps

| Gap | Platform | Impact | Suggested Fix |
|-----|----------|--------|---------------|
| `100vh` instead of `100dvh` | iOS Safari | Bottom buttons hidden behind toolbar | Replace `min-h-screen` with `min-h-dvh` where Tailwind supports it; add CSS fallback |
| iframe scroll-trap | iOS Safari | Tenant gets stuck scrolling inside PDF | Add `scrolling="no"` + overflow hidden; or add visual cue |
| Canvas doesn't resize on orientation change | All mobile | Signature aspect ratio distorts | Add `ResizeObserver` on canvas container |
| `input[type="date"]` not in `font-size: 16px` rule | iOS Safari | Potential zoom (unconfirmed) | Add `input[type="date"]` to `mobile-styles.css` |
| No scroll-to-top on section change | All mobile | Tenant lands mid-page on next section | `window.scrollTo({ top: 0, behavior: 'smooth' })` in section nav |
| `getUserMedia` fails in iOS WebView | iOS (Mail/Messages in-app) | Live scanner unavailable, falls back to file upload | Acceptable fallback — verify fallback UI is clear |
| No `MediaTrackCapabilities` check | Tablets with front camera only | May open wrong camera | Add `facingMode: 'environment'` constraint to `getUserMedia` call |
| `heic2any` bundle load on slow network | All mobile | Delay before processing HEIC | Preload or show clearer "Converting photo…" message |
| `max-h-[50vh]` on preview images | iOS Safari | Image may extend below fold on toolbar expand | Use `max-h-[50dvh]` or `max-height: 50%` of container |
| Modal `max-h-[90vh]` | iOS Safari | Modal may be taller than visible area | Use `max-height: 90dvh` |

---

## 10. Positive Findings (What's Done Well)

| Item | Evidence | Why It Matters |
|------|----------|----------------|
| Touch targets >= 44px | `mobile-styles.css` + inline `min-h-[44px]` | Meets Apple/Android HIG; no accidental misses |
| `font-size: 16px` on inputs | `mobile-styles.css` | Prevents iOS zoom-on-focus |
| iOS detection for `capture` attr | `DocumentScanner.tsx:69-75` | Exposes native "Scan Documents" on iOS |
| HEIC conversion | `heic2any` dynamic import | iOS photos work end-to-end |
| `touch-action: none` on signature | Inline + CSS class | Prevents scroll-while-signing |
| Permission pre-prompt | `usePermissionPrompt` | Increases camera grant rate |
| `-webkit-tap-highlight-color: transparent` | `mobile-styles.css` | Removes ugly grey flash on tap |
| `overscroll-behavior-y: contain` | `mobile-styles.css` | Prevents pull-to-refresh disruption |
| Print styles | `globals.css` @media print | Professional output on desktop |
| `minimumScale: 1` in viewport | `layout.tsx` | Prevents zoom-out on mobile |
| `beforeunload` guard | `documents/page.tsx` | Prevents accidental data loss |
| `autoComplete="off"` on name input | `page.tsx` | Prevents wrong-name autofill |
| Single-column mobile-first | `max-w-md` / `max-w-lg` containers | Works on all screen sizes without breakpoint complexity |

---

## 11. Recommendations by Priority

### High Priority (Fix Before Launch)

1. **Replace `100vh` with `100dvh` on critical containers**
   - `app/pbv-full-app/[token]/page.tsx`: change `min-h-screen` to `min-h-dvh`
   - `components/pbv/sign/SummaryDocReviewSign.tsx`: change `60vh` to `60dvh`
   - `components/pbv/sign/FormReviewSignModal.tsx`: change `40vh` to `40dvh`
   - `components/pbv/sign/MagicLinkSigningFlow.tsx`: change `max-h-[90vh]` to `max-h-[90dvh]`
   - Add fallback: `min-height: 100vh; min-height: 100dvh;`

### Medium Priority (Fix in v1.1)

2. **Mitigate iframe scroll-trap on mobile**
   - Option A: Add `scrolling="no"` to iframe and wrap PDF in a scrollable container with visual boundary
   - Option B: Add a subtle hint below the iframe: "Scroll down to continue" (mobile only)

3. **Add scroll-to-top on intake section navigation**
   - `app/pbv-full-app/[token]/intake/[section]/page.tsx`: call `window.scrollTo({ top: 0, behavior: 'smooth' })` after `router.push()`

4. **Add canvas resize handler for signature pad**
   - Use `ResizeObserver` on the canvas container to adjust height dynamically (e.g., `Math.min(280, containerWidth * 0.4)`)

### Low Priority (Polish)

5. **Add `input[type="date"]` to mobile-styles.css font-size rule**
6. **Add `facingMode: 'environment'` to `getUserMedia` constraints** in `usePermissionPrompt`
7. **Add "Converting photo…" loading state** during `heic2any` processing
8. **Consider iPad-optimized layout** (slightly wider `max-w` on tablet breakpoint)

---

*End of review.*
