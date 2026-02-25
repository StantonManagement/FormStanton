# Institutional Design System — Employee Handbook (Desktop)

This document defines the professional, institutional design system for the Stanton Management Employee Handbook portal. It shares the same visual language as the tenant onboarding form but is optimized for **desktop reading and navigation**.

## Design Philosophy

**Legal Document Interface** — Not a startup landing page. Think: corporate intranet, HR policy portal, institutional reference document.

Goals:
- Convey trust, legitimacy, and permanence
- Professional and institutional aesthetic
- Clean, serious, trustworthy appearance
- Optimized for extended reading on desktop screens

---

## Color Palette

### Primary Colors
```css
--primary: #1a2744        /* Deep navy - trust, authority */
--primary-light: #2d3f5f  /* Lighter navy for hover states */
```

### Accent Colors
```css
--accent: #8b7355         /* Muted gold - institutional, quality */
--accent-light: #c4a77d   /* Lighter gold for highlights */
```

### Neutrals
```css
--paper: #fdfcfa          /* Warm white, like quality paper */
--ink: #1a1a1a            /* Near black for text */
--muted: #6b7280          /* Secondary text */
--border: #d1d5db         /* Section borders */
--divider: #e5e7eb        /* Content dividers */
```

### Feedback Colors
```css
--success: #166534        /* Muted green */
--error: #991b1b          /* Muted red */
--warning: #92400e        /* Muted amber */
```

### Backgrounds
```css
--bg-section: #f8f7f5     /* Slightly warm gray for content sections */
--bg-input: #ffffff       /* Pure white for content cards */
--bg-sidebar: #f1f0ed     /* Sidebar/navigation background */
```

---

## Typography

### Font Families
- **Headers**: `'Libre Baskerville', Georgia, serif` — Institutional serif
- **Body/UI**: `'Inter', -apple-system, sans-serif` — Clean sans-serif

### Font Sizes (Desktop-Optimized)
```css
--text-xs: 0.75rem     /* 12px - captions, footnotes */
--text-sm: 0.875rem    /* 14px - sidebar nav, metadata */
--text-base: 1rem      /* 16px - body text */
--text-lg: 1.125rem    /* 18px - lead paragraphs */
--text-xl: 1.25rem     /* 20px - section headers */
--text-2xl: 1.5rem     /* 24px - chapter headers */
--text-3xl: 1.875rem   /* 30px - page title */
--text-4xl: 2.25rem    /* 36px - handbook cover title */
```

### Line Heights
```css
--leading-tight: 1.25    /* Headers */
--leading-normal: 1.5    /* UI text */
--leading-relaxed: 1.75  /* Body/reading text — optimized for long-form */
```

### Paragraph Width
- **Optimal reading width**: `max-w-prose` (~65ch / 680px)
- Body text should never span the full container width on desktop

---

## Components

### Sidebar Navigation (Table of Contents)

**Desktop TOC — Fixed Sidebar**
```jsx
<nav className="w-64 shrink-0 border-r border-[var(--divider)] bg-[var(--bg-sidebar)]
                sticky top-0 h-screen overflow-y-auto py-8 px-6">
  <h3 className="font-serif text-sm font-bold text-[var(--primary)] uppercase tracking-wider mb-6">
    Table of Contents
  </h3>
  <ul className="space-y-1">
    <li>
      <a href="#chapter-1"
         className="block px-3 py-2 text-sm text-[var(--muted)] rounded-sm
                    hover:bg-[var(--bg-section)] hover:text-[var(--primary)]
                    transition-colors duration-200">
        1. Company Overview
      </a>
    </li>
    <li>
      <a href="#chapter-1"
         className="block px-3 py-2 text-sm font-medium text-[var(--primary)]
                    bg-[var(--bg-section)] rounded-sm border-l-2 border-[var(--accent)]">
        2. Employment Policies  <!-- active state -->
      </a>
    </li>
  </ul>
</nav>
```

### Chapter Headers

**Document-Style Chapter Header**
```jsx
<div className="relative py-8 mb-8" id="chapter-1">
  {/* Decorative line */}
  <div className="absolute left-0 top-1/2 w-full h-px bg-[var(--divider)]" />

  {/* Chapter title with background knockout */}
  <h2 className="relative inline-block bg-white pr-6 font-serif text-2xl
                 text-[var(--primary)]">
    Company Overview
  </h2>

  {/* Chapter number */}
  <span className="absolute right-0 top-1/2 -translate-y-1/2 bg-white pl-6
                   text-sm text-[var(--muted)] font-medium">
    Chapter 1 of 8
  </span>
</div>
```

**Sub-Section Header**
```jsx
<h3 className="font-serif text-xl text-[var(--primary)] mt-8 mb-4
               border-b border-[var(--divider)] pb-2">
  1.1 Mission Statement
</h3>
```

### Content Blocks

**Policy Notice**
```jsx
<div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-6 my-6 max-w-prose">
  <h4 className="font-serif font-bold text-[var(--primary)] mb-2">Policy Title</h4>
  <div className="text-sm text-[var(--ink)] space-y-3 leading-relaxed">
    <p>Policy content goes here...</p>
  </div>
</div>
```

**Warning / Important Block**
```jsx
<div className="border border-[var(--warning)]/30 bg-[var(--warning)]/5
                rounded-sm p-5 my-6 max-w-prose">
  <div className="flex items-center gap-2 text-[var(--warning)]">
    <svg className="w-5 h-5" />
    <span className="text-sm font-bold">Important</span>
  </div>
  <p className="mt-2 text-sm text-[var(--ink)]/80 ml-7">
    Warning or critical information...
  </p>
</div>
```

**Key Definition / Callout**
```jsx
<div className="bg-[var(--bg-section)] border border-[var(--border)] p-6 my-6
                rounded-sm max-w-prose">
  <dt className="font-medium text-[var(--primary)] text-sm uppercase tracking-wide mb-1">
    Definition
  </dt>
  <dd className="text-[var(--ink)] leading-relaxed">
    Term explanation or key concept...
  </dd>
</div>
```

### Tables

**Formal Table (Desktop — Full Width)**
```jsx
<table className="w-full border-collapse text-sm my-6">
  <thead>
    <tr className="bg-[var(--primary)] text-white">
      <th className="px-6 py-3 text-left font-medium border border-[var(--primary)]">
        Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-[var(--divider)]
                   hover:bg-[var(--bg-section)] transition-colors">
      <td className="px-6 py-3 border-x border-[var(--divider)] text-[var(--ink)]">
        Cell
      </td>
    </tr>
  </tbody>
</table>
```

### Buttons

**Primary Button**
```jsx
<button
  className="px-8 py-3 bg-[var(--primary)] text-white font-medium
             border-2 border-[var(--primary)] rounded-none
             hover:bg-[var(--primary-light)]
             focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30
             focus:ring-offset-2
             disabled:opacity-50 disabled:cursor-not-allowed
             transition-all duration-200"
>
```

**Secondary Button**
```jsx
<button
  className="px-6 py-3 bg-transparent text-[var(--primary)] font-medium
             border-2 border-[var(--primary)] rounded-none
             hover:bg-[var(--primary)] hover:text-white
             transition-all duration-200"
>
```

**Print Button (Desktop-Specific)**
```jsx
<button
  onClick={() => window.print()}
  className="px-6 py-2 text-sm text-[var(--muted)] border border-[var(--border)]
             rounded-sm hover:bg-[var(--bg-section)] hover:text-[var(--primary)]
             transition-colors duration-200 print:hidden"
>
  Print This Section
</button>
```

### Header Bar

**Desktop Header**
```jsx
<header className="border-b border-[var(--divider)] bg-white sticky top-0 z-50 shadow-sm">
  <div className="max-w-6xl mx-auto px-8 py-3 flex items-center justify-between">
    {/* Logo and Company Info */}
    <div className="flex items-center gap-4">
      <div className="w-9 h-9 bg-[var(--primary)] rounded-sm flex items-center justify-center">
        <span className="text-white font-serif font-bold text-sm">SM</span>
      </div>
      <div className="border-l border-[var(--divider)] pl-4">
        <p className="text-sm font-medium text-[var(--primary)]">Stanton Management LLC</p>
        <p className="text-xs text-[var(--muted)]">Employee Handbook</p>
      </div>
    </div>

    {/* Desktop nav / actions */}
    <div className="flex items-center gap-6">
      <button className="text-sm text-[var(--muted)] hover:text-[var(--primary)]
                         transition-colors print:hidden">
        Print
      </button>
      <select className="text-sm border-0 bg-transparent text-[var(--muted)]
                         focus:ring-0 focus:outline-none cursor-pointer font-medium">
        <option value="en">English</option>
        <option value="es">Español</option>
        <option value="pt">Português</option>
      </select>
    </div>
  </div>
</header>
```

### Footer

**Desktop Footer**
```jsx
<footer className="border-t border-[var(--divider)] bg-[var(--bg-section)] mt-16 print:hidden">
  <div className="max-w-6xl mx-auto px-8 py-8">
    <div className="flex justify-between items-center">
      <div>
        <p className="font-medium text-[var(--primary)]">Stanton Management LLC</p>
        <p className="text-sm text-[var(--muted)]">421 Park Street, Hartford, CT 06106</p>
        <p className="text-sm text-[var(--muted)]">(860) 993-3401</p>
      </div>
      <div className="text-right text-xs text-[var(--muted)]">
        <p>Employee Handbook — Confidential</p>
        <p>Last Updated: [Date]</p>
        <p>© 2025 Stanton Management LLC. All rights reserved.</p>
      </div>
    </div>
  </div>
</footer>
```

---

## Layout

### Desktop Container (Sidebar + Content)
```jsx
<main className="min-h-screen bg-[var(--paper)]">
  <div className="max-w-6xl mx-auto flex">
    {/* Sidebar TOC */}
    <nav className="w-64 shrink-0 border-r border-[var(--divider)] bg-[var(--bg-sidebar)]
                    sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-8 px-6 print:hidden">
      {/* Table of Contents */}
    </nav>

    {/* Main Content */}
    <div className="flex-1 px-12 py-12">
      <div className="max-w-prose">
        {/* Chapter content */}
      </div>
    </div>
  </div>
</main>
```

### Single-Page Layout (No Sidebar)
```jsx
<main className="min-h-screen bg-[var(--paper)]">
  <div className="max-w-4xl mx-auto px-8 py-12">
    <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm p-10">
      {/* Content */}
    </div>
  </div>
</main>
```

---

## Animations

### Principles
- Subtle, professional
- No bouncing or flashy effects
- Smooth transitions (200–300ms)
- Ease-out timing

### Examples
```css
/* Chapter transitions */
.chapter-enter {
  opacity: 0;
  transform: translateY(8px);
}
.chapter-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

/* Sidebar link hover */
nav a:hover {
  transition: background-color 200ms ease, color 200ms ease;
}

/* Button hover */
button:hover {
  transition: background-color 200ms ease, transform 100ms ease;
}
```

---

## Spacing

### Padding Scale
- `p-2`: 0.5rem (8px) — Tight spacing
- `p-3`: 0.75rem (12px) — Compact
- `p-4`: 1rem (16px) — Standard
- `p-6`: 1.5rem (24px) — Comfortable
- `p-8`: 2rem (32px) — Spacious (desktop default for containers)
- `p-10`: 2.5rem (40px) — Desktop content cards
- `p-12`: 3rem (48px) — Major page padding

### Margin Scale
- `mb-2`: 0.5rem (8px) — Tight
- `mb-4`: 1rem (16px) — Standard
- `mb-6`: 1.5rem (24px) — Sub-section spacing
- `mb-8`: 2rem (32px) — Section spacing
- `mb-12`: 3rem (48px) — Chapter spacing
- `mb-16`: 4rem (64px) — Major page divisions

---

## Desktop Optimization

### Breakpoints (Desktop-First)
- Desktop: ≥ 1024px (default styles)
- Tablet: 768px – 1023px
- Mobile: < 768px

### Desktop Defaults
- Sidebar navigation visible by default
- Multi-column layouts where appropriate
- Wider containers (`max-w-6xl`)
- Generous padding and spacing
- Hover states on interactive elements
- Keyboard shortcuts for navigation

### Tablet Overrides
```css
@media (max-width: 1023px) {
  /* Collapse sidebar to hamburger menu */
  /* Reduce container padding */
  /* Stack multi-column layouts */
}
```

### Mobile Overrides
```css
@media (max-width: 767px) {
  /* Full-width content */
  /* Hide sidebar completely, use top nav */
  /* Reduce font sizes slightly */
  /* Stack all layouts vertically */
}
```

---

## Trust Indicators

### Confidentiality Notice
```jsx
<div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-4">
  <svg className="w-4 h-4" /* lock icon */ />
  <span>Confidential — For Stanton Management employees only</span>
</div>
```

### Document Version
```jsx
<div className="text-xs text-[var(--muted)] text-right mt-8">
  Version 1.0 — Effective [Date] — Last Updated [Date]
</div>
```

---

## Accessibility

### Requirements
- Minimum contrast ratio: 4.5:1 for text
- Focus indicators on all interactive elements
- Proper heading hierarchy (h1 → h2 → h3)
- Keyboard navigation for sidebar TOC
- Skip-to-content link
- Screen reader friendly landmarks (`<nav>`, `<main>`, `<article>`)
- ARIA labels on navigation elements

### Focus States
```css
focus:outline-none
focus:ring-2
focus:ring-[var(--primary)]/30
focus:ring-offset-2
```

### Keyboard Navigation
- `Tab` / `Shift+Tab` — Move between interactive elements
- `Enter` — Activate links/buttons
- Sidebar links focusable and navigable via keyboard

---

## Print Styles

```css
@media print {
  /* Hide non-content elements */
  header, footer, nav, .no-print, .print\\:hidden {
    display: none !important;
  }

  /* Reset layout to single column */
  main {
    display: block !important;
  }

  /* Page breaks between chapters */
  .chapter {
    page-break-before: always;
  }

  /* Typography for print */
  body {
    font-size: 11pt;
    color: #000;
    background: #fff;
  }

  h1, h2, h3 {
    page-break-after: avoid;
  }

  table {
    page-break-inside: avoid;
  }

  /* Show URLs for links */
  a[href]::after {
    content: " (" attr(href) ")";
    font-size: 9pt;
    color: #666;
  }
}
```

---

## Usage Guidelines

### Do's
✓ Use serif fonts for headers only
✓ Maintain consistent spacing
✓ Use muted, professional colors
✓ Keep animations subtle
✓ Ensure high contrast for readability
✓ Constrain body text to readable width (`max-w-prose`)
✓ Provide clear chapter/section navigation
✓ Include print styles for every page

### Don'ts
✗ No rounded corners on content cards
✗ No bright, vibrant colors
✗ No bouncing or flashy animations
✗ No startup-style branding
✗ No full-width body text on desktop (hard to read)
✗ No decorative elements
✗ No auto-playing media

---

## Support

For questions about the design system:
- **Colors**: See color palette section
- **Typography**: Check typography section
- **Components**: Reference component examples
- **Layout**: Review layout section (sidebar + content)
- **Print**: See print styles section
- **Accessibility**: Review accessibility section
