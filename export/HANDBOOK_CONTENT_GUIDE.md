# Handbook Content Guide — Employee Handbook

This document describes the content structure, styling patterns, and maintenance procedures for the Stanton Management Employee Handbook. It is adapted from the tenant onboarding project's policy content guide, reframed for a desktop handbook context.

---

## Overview

The Employee Handbook is a multi-chapter reference document covering company policies, procedures, benefits, and expectations. All content supports three languages (English, Spanish, Portuguese) and is designed for comfortable desktop reading with print support.

---

## Suggested Handbook Structure

### Chapters

| # | Chapter | Description |
|---|---------|-------------|
| 1 | **Company Overview** | Mission, values, history, organizational structure |
| 2 | **Employment Policies** | At-will employment, equal opportunity, anti-harassment |
| 3 | **Hiring & Onboarding** | Application process, background checks, orientation |
| 4 | **Compensation & Payroll** | Pay schedule, overtime, deductions, direct deposit |
| 5 | **Benefits** | Health insurance, retirement, PTO, leave policies |
| 6 | **Work Schedule & Attendance** | Hours, remote work, absences, tardiness |
| 7 | **Code of Conduct** | Professional behavior, dress code, substance policy |
| 8 | **Safety & Security** | Workplace safety, emergency procedures, reporting |
| 9 | **Technology & Equipment** | Acceptable use, company property, data security |
| 10 | **Separation & Offboarding** | Resignation, termination, final pay, exit process |
| A | **Appendix** | Forms, acknowledgment page, contact directory |

---

## Content Block Types

Use these standardized block types throughout the handbook for visual consistency.

### 1. Policy Statement

For formal policy declarations. Uses the accent gold left border.

```jsx
<div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-6 my-6 max-w-prose">
  <h4 className="font-serif font-bold text-[var(--primary)] mb-2">
    Equal Opportunity Employment
  </h4>
  <div className="text-sm text-[var(--ink)] space-y-3 leading-relaxed">
    <p>
      Stanton Management LLC is an equal opportunity employer. We do not
      discriminate based on race, color, religion, sex, national origin,
      age, disability, or any other protected status.
    </p>
  </div>
</div>
```

**When to use**: Official company policies, legal statements, formal declarations.

### 2. Important Notice / Warning

For critical information employees must not miss. Uses warning amber styling.

```jsx
<div className="border border-[var(--warning)]/30 bg-[var(--warning)]/5
                rounded-sm p-5 my-6 max-w-prose">
  <div className="flex items-center gap-2 text-[var(--warning)]">
    <svg className="w-5 h-5" /* exclamation icon */ />
    <span className="text-sm font-bold">Important</span>
  </div>
  <p className="mt-2 text-sm text-[var(--ink)]/80 ml-7">
    Failure to complete safety training within 30 days of hire may result
    in suspension without pay.
  </p>
</div>
```

**When to use**: Deadlines, compliance requirements, consequences, legal obligations.

### 3. Informational Callout

For helpful context that isn't a formal policy. Uses a neutral bordered box.

```jsx
<div className="bg-[var(--bg-section)] border border-[var(--border)] p-6 my-6
                rounded-sm max-w-prose">
  <div className="flex items-center gap-2 mb-2">
    <svg className="w-4 h-4 text-[var(--primary)]" /* info icon */ />
    <span className="text-sm font-medium text-[var(--primary)]">Good to Know</span>
  </div>
  <p className="text-sm text-[var(--ink)] leading-relaxed">
    Direct deposit typically takes 1–2 pay cycles to activate. In the
    meantime, you will receive a paper check.
  </p>
</div>
```

**When to use**: Tips, context, explanations, FAQs, "good to know" items.

### 4. Definition Block

For defining key terms or concepts.

```jsx
<div className="bg-[var(--bg-section)] border border-[var(--border)] p-6 my-6
                rounded-sm max-w-prose">
  <dt className="font-medium text-[var(--primary)] text-sm uppercase tracking-wide mb-1">
    At-Will Employment
  </dt>
  <dd className="text-[var(--ink)] leading-relaxed text-sm">
    Employment that can be terminated by either the employer or the employee
    at any time, for any lawful reason, with or without cause or notice.
  </dd>
</div>
```

**When to use**: Legal terms, HR jargon, role definitions, benefit plan names.

### 5. Procedure / Steps

For multi-step processes employees need to follow.

```jsx
<div className="my-6 max-w-prose">
  <h4 className="font-serif font-bold text-[var(--primary)] mb-4">
    How to Request Time Off
  </h4>
  <ol className="space-y-4 text-sm text-[var(--ink)]">
    <li className="flex gap-3">
      <span className="w-6 h-6 shrink-0 bg-[var(--primary)] text-white
                       rounded-sm flex items-center justify-center text-xs font-bold">
        1
      </span>
      <div>
        <p className="font-medium">Submit your request</p>
        <p className="text-[var(--muted)] mt-1">
          Log into the HR portal and submit a PTO request at least 2 weeks
          in advance.
        </p>
      </div>
    </li>
    <li className="flex gap-3">
      <span className="w-6 h-6 shrink-0 bg-[var(--primary)] text-white
                       rounded-sm flex items-center justify-center text-xs font-bold">
        2
      </span>
      <div>
        <p className="font-medium">Manager approval</p>
        <p className="text-[var(--muted)] mt-1">
          Your direct manager will review and approve or deny within 3
          business days.
        </p>
      </div>
    </li>
  </ol>
</div>
```

**When to use**: Onboarding steps, request procedures, reporting processes, emergency protocols.

### 6. Reference Table

For structured data like benefit tiers, pay scales, or contact directories.

```jsx
<table className="w-full border-collapse text-sm my-6">
  <thead>
    <tr className="bg-[var(--primary)] text-white">
      <th className="px-6 py-3 text-left font-medium border border-[var(--primary)]">
        Benefit
      </th>
      <th className="px-6 py-3 text-left font-medium border border-[var(--primary)]">
        Eligibility
      </th>
      <th className="px-6 py-3 text-left font-medium border border-[var(--primary)]">
        Details
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-[var(--divider)] hover:bg-[var(--bg-section)] transition-colors">
      <td className="px-6 py-3 border-x border-[var(--divider)] text-[var(--ink)]">
        Health Insurance
      </td>
      <td className="px-6 py-3 border-x border-[var(--divider)] text-[var(--ink)]">
        Full-time (30+ hrs/wk)
      </td>
      <td className="px-6 py-3 border-x border-[var(--divider)] text-[var(--ink)]">
        Effective 1st of month after 60 days
      </td>
    </tr>
  </tbody>
</table>
```

**When to use**: Benefits summaries, fee schedules, contact lists, holiday calendars.

---

## Color Coding by Content Type

Use consistent color coding so employees can quickly identify content types at a glance.

| Content Type | Border/Accent Color | Background | Usage |
|-------------|---------------------|------------|-------|
| **Policy statement** | `var(--accent)` (gold) | `var(--bg-section)` | Formal policies, legal text |
| **Warning / Important** | `var(--warning)` (amber) | `var(--warning)/5` | Deadlines, consequences, compliance |
| **Error / Prohibited** | `var(--error)` (red) | `var(--error)/5` | Prohibited actions, violations |
| **Success / Benefit** | `var(--success)` (green) | `var(--success)/5` | Benefits, positive outcomes |
| **Informational** | `var(--border)` (gray) | `var(--bg-section)` | Tips, context, definitions |
| **Primary / Action** | `var(--primary)` (navy) | `var(--primary)/5` | Action items, procedures |

---

## Translation / Multilingual Support

### Supported Languages
- **English** (en) — Primary
- **Spanish** (es)
- **Portuguese** (pt)

### Implementation Pattern

Store all translatable content in a centralized translations file:

```typescript
// lib/handbookContent.ts

export type Language = 'en' | 'es' | 'pt';

interface ChapterContent {
  title: string;
  sections: {
    title: string;
    body: string;
    notices?: string[];
  }[];
}

export const handbookContent: Record<Language, Record<string, ChapterContent>> = {
  en: {
    companyOverview: {
      title: 'Company Overview',
      sections: [
        {
          title: 'Mission Statement',
          body: 'Stanton Management LLC is committed to...',
        },
      ],
    },
  },
  es: {
    companyOverview: {
      title: 'Descripción de la Empresa',
      sections: [
        {
          title: 'Declaración de Misión',
          body: 'Stanton Management LLC se compromete a...',
        },
      ],
    },
  },
  pt: {
    companyOverview: {
      title: 'Visão Geral da Empresa',
      sections: [
        {
          title: 'Declaração de Missão',
          body: 'Stanton Management LLC está comprometida com...',
        },
      ],
    },
  },
};
```

### Translation Rules
- **Proper nouns** (company names, addresses, legal entities) stay in English
- **Table data** (dollar amounts, dates) stays in English; headers are translated
- **Legal disclaimers** should be reviewed by a translator, not machine-translated
- **UI labels** (sidebar, buttons, navigation) are translated

### UI Translations

```typescript
// lib/handbookTranslations.ts

export const uiTranslations = {
  en: {
    tableOfContents: 'Table of Contents',
    chapter: 'Chapter',
    printSection: 'Print This Section',
    backToTop: 'Back to Top',
    lastUpdated: 'Last Updated',
    confidential: 'Confidential — For Stanton Management employees only',
  },
  es: {
    tableOfContents: 'Tabla de Contenidos',
    chapter: 'Capítulo',
    printSection: 'Imprimir Esta Sección',
    backToTop: 'Volver Arriba',
    lastUpdated: 'Última Actualización',
    confidential: 'Confidencial — Solo para empleados de Stanton Management',
  },
  pt: {
    tableOfContents: 'Índice',
    chapter: 'Capítulo',
    printSection: 'Imprimir Esta Seção',
    backToTop: 'Voltar ao Topo',
    lastUpdated: 'Última Atualização',
    confidential: 'Confidencial — Apenas para funcionários da Stanton Management',
  },
};
```

---

## Content Updates

### How to Update Handbook Content

1. **Edit content**: Modify the translations/content file (e.g., `lib/handbookContent.ts`)
2. **Update all languages**: Ensure changes are reflected in `en`, `es`, and `pt`
3. **Update version/date**: Bump the "Last Updated" date in the footer and cover page
4. **Review**: Have HR and legal review policy changes before publishing

### Example: Add a New Policy

```typescript
// 1. Add to the relevant chapter in lib/handbookContent.ts
remoteWork: {
  title: 'Remote Work Policy',
  sections: [
    {
      title: 'Eligibility',
      body: 'Employees who have completed 90 days of employment...',
      notices: ['Manager approval required for all remote work arrangements.'],
    },
  ],
},

// 2. Add translations for es and pt

// 3. Add to sidebar navigation (chapter list)

// 4. Update the "Last Updated" date
```

### Example: Update a Date or Amount

```typescript
// Find the relevant string in the content file and update it
body: 'Health insurance is effective the 1st of the month after 60 days of employment.',
// Change to:
body: 'Health insurance is effective the 1st of the month after 30 days of employment.',
```

---

## Content Formatting Rules

### Text Style
- **Body text**: Regular weight, `text-[var(--ink)]`, `leading-relaxed`
- **Section headers**: Serif font, `text-[var(--primary)]`
- **Emphasis**: Bold for key terms, not italic (italic is harder to read on screen)
- **Dates/deadlines**: Bold + warning color
- **Dollar amounts**: Bold
- **Legal citations**: `text-xs`, `text-[var(--muted)]`

### Lists
- Use **numbered lists** for sequential steps or ranked items
- Use **bullet lists** for unordered items
- Keep list items concise (1–2 sentences max)
- Indent sub-items one level only

### Paragraphs
- Keep paragraphs short (3–5 sentences) for screen readability
- One idea per paragraph
- Use sub-headings liberally to break up long sections

### Tables
- Always include a header row
- Keep tables to 4–5 columns max for readability
- Use `hover:bg-[var(--bg-section)]` for row hover on desktop
- Tables wider than `max-w-prose` are fine — they break out of the text column

---

## Acknowledgment Page

The final page of the handbook should include an acknowledgment section:

```jsx
<div className="border-2 border-[var(--primary)] p-8 my-8 max-w-prose">
  <h3 className="font-serif text-xl text-[var(--primary)] mb-4">
    Employee Acknowledgment
  </h3>
  <p className="text-sm text-[var(--ink)] leading-relaxed mb-6">
    I acknowledge that I have received and read the Stanton Management
    Employee Handbook. I understand that the policies described herein are
    subject to change and that I will be notified of any updates.
  </p>
  <div className="space-y-4">
    <div className="border-b-2 border-dashed border-[var(--border)] pb-1">
      <span className="text-xs text-[var(--muted)]">Employee Signature</span>
    </div>
    <div className="border-b-2 border-dashed border-[var(--border)] pb-1">
      <span className="text-xs text-[var(--muted)]">Printed Name</span>
    </div>
    <div className="border-b-2 border-dashed border-[var(--border)] pb-1 w-48">
      <span className="text-xs text-[var(--muted)]">Date</span>
    </div>
  </div>
</div>
```

---

## Testing Checklist

### Content Quality
- [ ] All chapters have content in all three languages
- [ ] Policy statements are reviewed by HR/legal
- [ ] Dates and dollar amounts are current
- [ ] No placeholder text remains
- [ ] Acknowledgment page is complete

### Visual Consistency
- [ ] All policy blocks use correct color coding
- [ ] Tables have navy headers with proper borders
- [ ] Section headers use serif font
- [ ] Content stays within `max-w-prose` width
- [ ] Warning/important blocks are visually distinct

### Navigation
- [ ] Sidebar TOC lists all chapters and sections
- [ ] Anchor links scroll to correct positions
- [ ] Active section is highlighted in sidebar
- [ ] Back-to-top button works

### Print
- [ ] Each chapter starts on a new page
- [ ] Tables don't break across pages
- [ ] Sidebar and navigation are hidden
- [ ] Font sizes are appropriate for print
- [ ] All content is legible in black and white

### Accessibility
- [ ] Heading hierarchy is correct (h1 → h2 → h3)
- [ ] Color is not the sole indicator of meaning
- [ ] All content is keyboard-navigable
- [ ] Screen reader reads content in logical order

---

## Future Enhancements

- [ ] Search functionality across all chapters
- [ ] Collapsible sections for long chapters
- [ ] PDF export of full handbook
- [ ] Version history / changelog page
- [ ] Digital signature for acknowledgment page
- [ ] Manager-specific content sections (role-based visibility)
- [ ] Notification system for policy updates
- [ ] Embedded training videos
- [ ] FAQ section with expandable answers
- [ ] Glossary of terms with cross-references

---

## Support

For questions about handbook content:
- **Content/Policy**: Contact HR department
- **Technical**: Check content files in `lib/handbookContent.ts`
- **Translations**: Verify all three languages in content files
- **Design**: See `DESIGN_SYSTEM.md` for styling reference
- **Layout**: See `DESKTOP_LAYOUT_GUIDE.md` for layout patterns
