# Desktop Layout Guide — Employee Handbook

This document defines the desktop-first responsive strategy and layout patterns for the Stanton Management Employee Handbook portal. It replaces the mobile-optimizations guide from the tenant onboarding project.

---

## Design Orientation

**Desktop-first**: Default styles target screens ≥ 1024px. Tablet and mobile are handled via `@media (max-width)` overrides.

This is a **reading-focused application** — not a form. Layout decisions prioritize comfortable long-form reading, clear navigation, and easy printing.

---

## Responsive Breakpoints

| Breakpoint | Width | Target |
|------------|-------|--------|
| Desktop (default) | ≥ 1024px | Primary experience — sidebar + content |
| Tablet | 768px – 1023px | Collapsed sidebar, slightly narrower content |
| Mobile | < 768px | Single column, top navigation only |

### Tailwind Usage (Desktop-First)

Since Tailwind is mobile-first by default, use `max-*` variants or structure your classes so the desktop layout is the base:

```jsx
{/* Sidebar: visible on desktop, hidden below 1024px */}
<nav className="w-64 shrink-0 lg:block hidden">

{/* Content: has left margin on desktop, full-width on smaller */}
<div className="lg:ml-64 w-full">
```

Alternatively, define desktop styles as the default and override downward:

```css
/* Desktop default */
.handbook-layout {
  display: flex;
  max-width: 72rem; /* max-w-6xl */
}

/* Tablet override */
@media (max-width: 1023px) {
  .handbook-layout {
    display: block;
  }
  .handbook-sidebar {
    display: none;
  }
}

/* Mobile override */
@media (max-width: 767px) {
  .handbook-content {
    padding: 1rem;
  }
}
```

---

## Core Layout: Sidebar + Content

The primary layout is a **fixed sidebar** (table of contents) alongside a **scrollable content area**.

```
┌──────────────────────────────────────────────────────┐
│  Header Bar (sticky)                                 │
├────────────┬─────────────────────────────────────────┤
│            │                                         │
│  Sidebar   │  Main Content                           │
│  (TOC)     │                                         │
│  w-64      │  max-w-prose body text                  │
│  fixed     │  tables can go wider                    │
│            │                                         │
│  Chapter 1 │  ┌─────────────────────────┐            │
│  Chapter 2 │  │ Chapter Header          │            │
│  Chapter 3 │  ├─────────────────────────┤            │
│  ...       │  │ Section content...      │            │
│            │  │                         │            │
│            │  │ Policy block            │            │
│            │  │ Table                   │            │
│            │  └─────────────────────────┘            │
│            │                                         │
├────────────┴─────────────────────────────────────────┤
│  Footer                                              │
└──────────────────────────────────────────────────────┘
```

### Implementation

```jsx
<div className="min-h-screen bg-[var(--paper)]">
  {/* Sticky header */}
  <header className="sticky top-0 z-50 ...">...</header>

  <div className="max-w-6xl mx-auto flex">
    {/* Sidebar — fixed position, scrolls independently */}
    <aside className="w-64 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)]
                      overflow-y-auto border-r border-[var(--divider)]
                      bg-[var(--bg-sidebar)] py-8 px-6
                      hidden lg:block print:hidden">
      {/* TOC links */}
    </aside>

    {/* Main content area */}
    <main className="flex-1 px-12 py-12 min-w-0">
      <article className="max-w-prose">
        {/* Chapter content */}
      </article>
    </main>
  </div>

  {/* Footer */}
  <footer className="print:hidden ...">...</footer>
</div>
```

---

## Sidebar Navigation

### Behavior
- **Desktop**: Always visible, sticky, scrolls independently
- **Tablet**: Hidden by default; toggled via hamburger button
- **Mobile**: Replaced by a top-level chapter dropdown or hamburger menu

### Active State
Highlight the current chapter/section as the user scrolls. Use `IntersectionObserver` or a scroll-spy library.

```jsx
{/* Active link */}
<a className="block px-3 py-2 text-sm font-medium text-[var(--primary)]
              bg-[var(--bg-section)] rounded-sm border-l-2 border-[var(--accent)]">
  2. Employment Policies
</a>

{/* Inactive link */}
<a className="block px-3 py-2 text-sm text-[var(--muted)] rounded-sm
              hover:bg-[var(--bg-section)] hover:text-[var(--primary)]
              transition-colors duration-200">
  3. Benefits
</a>
```

### Nested Sections
Indent sub-sections within the sidebar:

```jsx
<ul className="space-y-1">
  <li>
    <a href="#ch2" className="...">2. Employment Policies</a>
    <ul className="ml-4 mt-1 space-y-1">
      <li><a href="#ch2-1" className="... text-xs">2.1 At-Will Employment</a></li>
      <li><a href="#ch2-2" className="... text-xs">2.2 Equal Opportunity</a></li>
    </ul>
  </li>
</ul>
```

---

## Content Area

### Reading Width
Body text should be constrained to `max-w-prose` (~65 characters / 680px) for comfortable reading. Tables and full-width elements can break out of this constraint.

```jsx
<article className="max-w-prose">
  <p className="leading-relaxed text-[var(--ink)]">
    Body text stays within readable width...
  </p>
</article>

{/* Table breaks out of prose width */}
<div className="max-w-3xl my-8">
  <table className="w-full ...">...</table>
</div>
```

### Vertical Rhythm
- **Between paragraphs**: `space-y-4` (1rem)
- **Between sub-sections**: `mt-8` (2rem)
- **Between chapters**: `mt-16` (4rem) + decorative divider

---

## Chapter / Section Navigation

### Anchor Links
Every chapter and section should have an `id` for deep linking:

```jsx
<h2 id="chapter-3" className="font-serif text-2xl text-[var(--primary)] ...">
  3. Benefits & Compensation
</h2>

<h3 id="chapter-3-1" className="font-serif text-xl text-[var(--primary)] ...">
  3.1 Health Insurance
</h3>
```

### Scroll Behavior
```css
html {
  scroll-behavior: smooth;
  scroll-padding-top: 4rem; /* Account for sticky header */
}
```

### Back-to-Top Button
```jsx
<button
  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
  className="fixed bottom-8 right-8 w-10 h-10 bg-[var(--primary)] text-white
             rounded-sm shadow-md hover:bg-[var(--primary-light)]
             transition-all duration-200 print:hidden"
  aria-label="Back to top"
>
  ↑
</button>
```

---

## Multi-Column Layouts

For certain content (e.g., contact directories, benefit summaries), use side-by-side columns on desktop:

```jsx
<div className="grid grid-cols-2 gap-8 my-8">
  <div className="bg-[var(--bg-section)] border border-[var(--border)] p-6 rounded-sm">
    <h4 className="font-serif font-bold text-[var(--primary)] mb-2">Option A</h4>
    <p className="text-sm text-[var(--ink)] leading-relaxed">...</p>
  </div>
  <div className="bg-[var(--bg-section)] border border-[var(--border)] p-6 rounded-sm">
    <h4 className="font-serif font-bold text-[var(--primary)] mb-2">Option B</h4>
    <p className="text-sm text-[var(--ink)] leading-relaxed">...</p>
  </div>
</div>
```

On tablet/mobile these stack:
```css
@media (max-width: 1023px) {
  .grid-cols-2 { grid-template-columns: 1fr; }
}
```

---

## Print Layout

The handbook should be fully printable. See `DESIGN_SYSTEM.md` for the full print stylesheet.

### Key Print Decisions
- **Sidebar**: Hidden
- **Header/Footer**: Hidden (browser handles page headers)
- **Chapter breaks**: `page-break-before: always` on each `.chapter`
- **Tables**: `page-break-inside: avoid`
- **Links**: Show URL after link text
- **Font size**: 11pt for body, 14pt for headers
- **Colors**: Black text on white background

### Print-Specific Classes
```jsx
{/* Hide from print */}
<div className="print:hidden">...</div>

{/* Show only in print */}
<div className="hidden print:block">...</div>

{/* Page break before this element */}
<div className="print:break-before-page">...</div>
```

---

## Tablet Overrides (768px – 1023px)

| Element | Desktop | Tablet |
|---------|---------|--------|
| Sidebar | Visible, fixed | Hidden, hamburger toggle |
| Container | `max-w-6xl` | `max-w-3xl` |
| Content padding | `px-12` | `px-8` |
| Multi-column | `grid-cols-2` | `grid-cols-1` |
| Header | Full nav | Condensed |

---

## Mobile Overrides (< 768px)

| Element | Desktop | Mobile |
|---------|---------|--------|
| Sidebar | Visible | Hidden, replaced by dropdown |
| Container | `max-w-6xl` | Full width |
| Content padding | `px-12` | `px-4` |
| Chapter headers | `text-2xl` | `text-xl` |
| Tables | Full width | Horizontally scrollable |
| Print button | Visible | Hidden |
| Back-to-top | Fixed corner | Hidden or bottom bar |

---

## Browser Compatibility

Primary targets (desktop):
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Microsoft Edge (latest 2 versions)
- Safari 16+

Secondary targets (tablet/mobile):
- Safari (iOS 16+)
- Chrome (Android)

---

## Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.0s |
| Largest Contentful Paint | < 1.5s |
| Time to Interactive | < 2.0s |
| Cumulative Layout Shift | < 0.05 |

Desktop targets are tighter than mobile since users have faster hardware and connections.

---

## Interaction Patterns

### Mouse & Keyboard (Desktop Defaults)
- **Hover states** on all interactive elements (links, buttons, table rows)
- **Focus rings** visible on keyboard navigation
- **Cursor styles**: `pointer` on links/buttons, `default` on text
- **Tooltips** on icon-only buttons (e.g., print, back-to-top)

### Keyboard Shortcuts (Optional Enhancement)
| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next chapter |
| `Home` | Back to top |
| `Ctrl+P` | Print current page |
| `/` | Focus search (if implemented) |

---

## Resources

- [Tailwind CSS — Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [MDN — CSS Print Styles](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/print)
- [Web Content Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
