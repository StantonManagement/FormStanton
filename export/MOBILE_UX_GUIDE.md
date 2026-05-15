# Mobile UX Guide
## Stanton Management — Standards for Every Mobile-Facing Page

This document defines the required mobile behaviors for every tenant-facing and staff-facing page in the Stanton system. Apply these standards when building new pages or auditing existing ones. They are not optional polish — they are baseline expectations for any user on a phone in 2026.

---

## 1. Viewport & Zoom

**Rule:** Never block pinch-to-zoom.

```tsx
// app/layout.tsx — CORRECT
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
}

// WRONG — do not use either of these:
// maximumScale: 1
// userScalable: false
```

**Why:** `userScalable: false` is an accessibility violation (WCAG 1.4.4). Low-vision users depend on pinch-to-zoom. iOS 10+ ignores it for users, but it still blocks programmatic zoom and causes undefined behavior in some browsers.

**Exception:** Signature canvas elements must set `touch-action: none` on themselves AND their wrapper divs to prevent the page scrolling during drawing. This is a canvas-specific fix, not a viewport fix.

---

## 2. Tap Targets

**Rule:** Every tappable element must be at least 44×44px (Apple HIG / WCAG 2.5.5).

```css
/* mobile-styles.css */
input[type="text"],
input[type="tel"],
input[type="number"],
input[type="email"],
select,
textarea {
  min-height: 44px;
  font-size: 16px;
}

button {
  min-height: 44px;
}

input[type="radio"],
input[type="checkbox"] {
  width: 20px;
  height: 20px;
}
```

**Why:** Undersized targets cause mis-taps, especially for elderly tenants or users with motor impairments.

**Checklist:**
- [ ] All buttons ≥ 44px tall
- [ ] All text inputs ≥ 44px tall
- [ ] Radio/checkbox touch area ≥ 20×20px (wrap in a `<label>` to extend the tap zone)
- [ ] Icon-only buttons have `padding` or `min-width`/`min-height` to reach 44px

---

## 3. Font Size on Inputs — Prevent iOS Auto-Zoom

**Rule:** All form inputs must have `font-size: 16px` or larger.

**Why:** iOS Safari automatically zooms the viewport when a focused input has `font-size < 16px`. This causes the page to jump and scale unexpectedly. Setting 16px on all inputs prevents this entirely.

```css
input, select, textarea {
  font-size: 16px;
}
```

This is already in `mobile-styles.css` globally — do not override it with `text-sm` on inputs without also setting an explicit 16px size.

---

## 4. Tap Feedback

**Rule:** Every interactive element must provide immediate visual feedback on press.

```css
/* Replaces the default blue/grey iOS tap highlight */
body {
  -webkit-tap-highlight-color: transparent;
}

button:active,
a:active,
[role="button"]:active {
  opacity: 0.75;
  transition: opacity 80ms ease-out;
}
```

**Why:** Without feedback, users tap twice because they don't know if the first tap registered. The default iOS blue flash looks out of place with the institutional design.

**Checklist:**
- [ ] No bare `div` or `span` used as a button — use `<button>` or add `role="button"` + `tabIndex={0}`
- [ ] Disabled state visually distinct (`opacity-50`, `cursor-not-allowed`)
- [ ] Loading state shown on async actions (spinner or text change) — never leave a button looking tappable while it's processing

---

## 5. Keyboard & Input Types

**Rule:** Always use the semantically correct `type` and `inputMode` for inputs.

| Field | `type` | `inputMode` | `autoComplete` |
|---|---|---|---|
| Phone number | `tel` | — | `tel` |
| Date of birth | `date` | — | `bday` |
| Full name (self) | `text` | — | `name` |
| Email | `email` | — | `email` |
| ZIP code | `text` | `numeric` | `postal-code` |
| Currency / numbers | `text` | `decimal` | — |
| SSN / sensitive | `text` | `numeric` | `off` |
| Search | `search` | `search` | `off` |

**Why:** `type="tel"` on iOS shows the numeric dial-pad keyboard. `type="email"` shows the keyboard with `@` accessible. Wrong types force users to switch keyboards manually.

**autoComplete:** Enables iOS/Android to autofill from saved contacts and Keychain. For household member fields that are about *other people*, set `autoComplete="off"` — autofill would suggest the user's own data, which is wrong.

---

## 6. Scroll Behavior

**Rule:** Three scroll rules must be applied globally.

```css
html {
  scroll-behavior: smooth;
}

body {
  overscroll-behavior-y: contain;
}

.overflow-y-auto,
.overflow-auto,
.overflow-scroll {
  -webkit-overflow-scrolling: touch;
}
```

**`scroll-behavior: smooth`** — programmatic scrolls (`scrollIntoView`, `scrollTo`) animate instead of jumping.

**`overscroll-behavior-y: contain`** — prevents pull-to-refresh from triggering mid-form. Normal scrolling still works. Especially important on long forms where a stray downward swipe can close the page on Android Chrome.

**`-webkit-overflow-scrolling: touch`** — enables kinetic (momentum) scrolling inside scrollable containers on iOS. Without it, containers scroll but stop dead when the finger lifts.

---

## 7. Text Size Adjustment

**Rule:** Prevent iOS from re-sizing text on orientation change.

```css
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

**Why:** When rotating from portrait to landscape, iOS Safari can increase font sizes by up to 40% to "improve readability." This breaks layouts built for specific type scales.

---

## 8. Horizontal Scroll Containers

**Rule:** Any container that scrolls horizontally must have a visual cue that it scrolls.

Pattern: right-edge gradient fade mask.

```tsx
<div className="relative">
  <div className="flex overflow-x-auto scrollbar-hide">
    {/* scrollable content */}
  </div>
  {/* fade hint */}
  <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[var(--bg-section)] to-transparent" />
</div>
```

**Active item scrolls into view:**

```tsx
const activeRef = useRef<HTMLElement>(null);
useEffect(() => {
  activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}, [activeId]);
```

**Applies to:** Tab bars, filter pill rows, horizontal card sliders, step indicators.

---

## 9. Scroll-to-Error

**Rule:** When form validation fails, scroll the first error into view.

```tsx
const goNext = (section: number) => {
  if (validateSection(section)) {
    nextSection();
  } else {
    requestAnimationFrame(() => {
      const firstError = document.querySelector('[data-error="true"]') as HTMLElement | null;
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }
};
```

**Why:** On mobile, the form extends well below the fold. A validation failure that sets error text on a field 400px up the page gives the user no visible signal — the "Next" button just appears to do nothing.

**Implementation note:** Mark error containers with `data-error="true"` so the selector is reliable regardless of CSS class changes.

---

## 10. beforeunload Guard

**Rule:** Warn users before they accidentally navigate away from an in-progress form.

```tsx
useEffect(() => {
  const isDirty = pageState === 'form' || pageState === 'signatures';
  if (!isDirty) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [pageState]);
```

**Why:** On mobile, the browser back gesture (swipe from edge) or an accidental tap on a notification that switches apps can kill a half-completed form. The browser dialog gives users a chance to stay.

**When to activate:** Any multi-step form that has unsaved state — intake, document upload in progress, partial signature flow.

**When NOT to activate:** After successful submission, on read-only screens, or on the landing/language selection screen.

---

## 11. Safe Area Insets (Notch / Home Indicator)

**Rule:** Any fixed/sticky element at the top or bottom of the screen must respect safe areas.

```css
/* For a sticky bottom bar */
.sticky-bottom-bar {
  padding-bottom: env(safe-area-inset-bottom);
}

/* For a fixed header */
.fixed-header {
  padding-top: env(safe-area-inset-top);
}
```

```html
<!-- Required in <head> for env() to work -->
<meta name="viewport" content="viewport-fit=cover">
```

**Why:** iPhone X and later have a home indicator bar at the bottom. Buttons placed there are invisible or inaccessible without safe area padding. Android notch devices have the same issue at the top.

**Applies to:** Any `position: fixed` or `position: sticky` element. Modals/drawers with content near screen edges.

---

## 12. Touch-Action on Canvas / Drawing Elements

**Rule:** Signature canvases and any draw-on-screen element need `touch-action: none` on the element AND every wrapper div.

```tsx
<div style={{ touchAction: 'none' }}>       {/* wrapper */}
  <div style={{ touchAction: 'none' }}>     {/* inner wrapper */}
    <SignatureCanvas
      canvasProps={{
        style: { width: '100%', height: '140px', touchAction: 'none' }
      }}
    />
  </div>
</div>
```

**Why:** iOS interprets touch movement as page scroll unless `touch-action: none` is explicitly set on the element AND its DOM ancestors. Setting it only on the canvas itself is not sufficient — the scroll event bubbles through the wrapper divs first.

---

## 13. No alert() / confirm() / prompt()

**Rule:** Never use `window.alert()`, `window.confirm()`, or `window.prompt()` in any user-facing code path.

**Why:**
- On iOS, these block the entire browser thread and look completely out of place
- They cannot be styled to match the design system
- They are inaccessible to screen readers in some contexts
- They cannot be tested with Playwright without special config

**Replacements:**

| Native dialog | Replace with |
|---|---|
| `alert(message)` | Inline error state: `const [error, setError] = useState('')` + render near the action |
| `confirm("Are you sure?")` | A modal component with Cancel/Confirm buttons |
| `prompt("Enter label:")` | An inline input that appears contextually |

---

## 14. Loading & Empty States

**Rule:** Every data-fetching component must explicitly handle three states: loading, empty, and error.

```tsx
if (loading) return <LoadingSpinner />;   // not just "Loading..." text
if (error)   return <InlineError msg={error} onRetry={reload} />;
if (!data || data.length === 0) return <EmptyState />;
return <DataView data={data} />;
```

**Loading states on mobile:** Skeleton screens are significantly better than spinners for content that has a known shape (lists, cards). A spinner is acceptable for actions (button loading states).

**Retry:** Always offer a retry mechanism on error. On mobile networks, transient failures are common. A hard error with no retry forces the user to reload the page and lose their place.

---

## 15. File Upload — Mobile Camera Integration

**Rule:** File inputs on mobile should offer camera as a source.

```tsx
<input
  type="file"
  accept="image/*,application/pdf,.heic"
  capture="environment"   // opens rear camera directly on mobile
/>
```

Or without `capture` (lets user choose between camera, files, and photos):
```tsx
<input
  type="file"
  accept="image/jpeg,image/png,image/heif,image/heic,application/pdf"
  multiple
/>
```

**HEIC:** Always include `image/heic` and `image/heif` in `accept`. iOS shoots in HEIC by default. Without it, iOS shows the file as grayed out in the picker.

**Max size feedback:** Show file size limits before the user selects, not after. A tenant on a slow connection who uploads a 40MB video needs to know upfront that the limit is 25MB.

---

## 16. Orientation Change

**Rule:** Pages must not break when the device rotates.

**Checklist:**
- [ ] No fixed pixel widths that exceed 375px (minimum iPhone width)
- [ ] Flexbox wraps correctly (`flex-wrap: wrap` where needed)
- [ ] Modal/overlay heights use `max-height: 90vh` or `dvh` units, not fixed pixel heights
- [ ] Signature canvas re-measures on resize (react-signature-canvas handles this with `trimCanvas` — verify after rotation)

---

## 17. Dynamic Viewport Height (dvh)

**Rule:** For full-height screens on mobile, use `dvh` instead of `vh`.

```css
/* WRONG — on iOS Safari, 100vh includes the address bar height, causing overflow */
.full-screen {
  height: 100vh;
}

/* CORRECT — dvh accounts for the actual visible viewport */
.full-screen {
  height: 100dvh;
}

/* Fallback for older browsers */
.full-screen {
  height: 100vh;
  height: 100dvh;
}
```

**Why:** iOS Safari's address bar shrinks when scrolling. `100vh` is calculated against the *full* viewport including the collapsed bar, so elements sized to `100vh` overflow by ~60px when the bar is visible.

---

## 18. Network Resilience

**Rule:** All fetch calls on tenant-facing pages must handle network failure gracefully.

```tsx
try {
  const res = await fetch(url, { signal: controller.signal });
  if (!res.ok) throw new Error(`${res.status}`);
  // ...
} catch (e: any) {
  if (e.name === 'AbortError') return;
  setError('Connection failed. Please check your signal and try again.');
}
```

**Specific patterns:**
- Use `AbortController` for any fetch that might be superseded (filter changes, navigation away)
- Show connection-specific error copy — "Check your signal" is more useful to a tenant on cellular than "Something went wrong"
- Auto-retry logic for idempotent GET requests (optional, but high-value for weak-signal environments)

---

## 19. Print on Mobile

**Rule:** `window.print()` works on iOS Safari (via Share → Print) and Android Chrome. It is acceptable to use.

**Requirements:**
- The print button must be `display: none` in print styles (`print:hidden` in Tailwind)
- Use Tailwind `print:` variants to simplify layout for print — hide nav, sidebars, action buttons
- Test: Safari → Share → Print → check preview

---

## 20. Quick Audit Checklist

Before marking any page as mobile-ready, verify:

```
Viewport
[ ] No userScalable:false or maximumScale:1 in viewport meta

Touch Targets
[ ] All buttons ≥ 44px tall
[ ] All inputs ≥ 44px tall, font-size ≥ 16px

Inputs
[ ] Correct type= attributes (tel, email, date, search)
[ ] Correct inputMode= where type=text is required
[ ] autoComplete= set appropriately

Scroll
[ ] scroll-behavior: smooth on html
[ ] overscroll-behavior-y: contain on body
[ ] -webkit-overflow-scrolling: touch on scrollable containers
[ ] Horizontal containers have fade mask + auto-scroll to active item

Forms
[ ] Scroll-to-first-error on validation failure
[ ] beforeunload guard when form has unsaved state

Feedback
[ ] -webkit-tap-highlight-color: transparent
[ ] button:active opacity feedback
[ ] Loading state on all async actions
[ ] Error + retry on all data fetches

Accessibility
[ ] No alert() / confirm() / prompt()
[ ] All interactive elements keyboard-accessible (tab, enter, space)
[ ] Error messages associated with fields (aria-describedby or adjacent text)

Layout
[ ] No fixed widths < 375px
[ ] Modals use max-height: 90dvh
[ ] Full-screen containers use 100dvh not 100vh
[ ] Safe area insets on fixed/sticky elements
```
