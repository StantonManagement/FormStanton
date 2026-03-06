# Institutional Design System

This document defines the professional, institutional design system for the Stanton Management tenant onboarding form.

## Design Philosophy

**Legal Document Interface** - Not a startup landing page. Think: bank portal, government form, insurance application.

Goals:
- Convey trust, legitimacy, and permanence
- Professional and institutional aesthetic
- Clean, serious, trustworthy appearance

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
--border: #d1d5db         /* Form borders */
--divider: #e5e7eb        /* Section dividers */
```

### Feedback Colors
```css
--success: #166534        /* Muted green */
--error: #991b1b          /* Muted red */
--warning: #92400e        /* Muted amber */
```

### Backgrounds
```css
--bg-section: #f8f7f5     /* Slightly warm gray for info sections */
--bg-input: #ffffff       /* Pure white for inputs */
```

---

## Typography

### Font Families
- **Headers**: `'Libre Baskerville', Georgia, serif` - Institutional serif
- **Body/Forms**: `'Inter', -apple-system, sans-serif` - Clean sans-serif

### Font Sizes
```css
--text-xs: 0.75rem     /* 12px - captions, legal */
--text-sm: 0.875rem    /* 14px - helper text */
--text-base: 1rem      /* 16px - body */
--text-lg: 1.125rem    /* 18px - lead text */
--text-xl: 1.25rem     /* 20px - section headers */
--text-2xl: 1.5rem     /* 24px - page headers */
--text-3xl: 1.875rem   /* 30px - main title */
```

---

## Components

### Form Fields

**Input Fields**
```jsx
<input
  className="w-full px-4 py-3 border border-[var(--border)] rounded-none 
             bg-[var(--bg-input)] text-[var(--ink)] placeholder:text-[var(--muted)]
             focus:outline-none focus:border-[var(--primary)] 
             focus:ring-1 focus:ring-[var(--primary)]/20
             transition-colors duration-200"
/>
```

**Select Dropdowns**
```jsx
<select
  className="w-full px-4 py-3 border border-[var(--border)] rounded-none 
             bg-[var(--bg-input)] text-[var(--ink)]
             focus:outline-none focus:border-[var(--primary)] 
             focus:ring-1 focus:ring-[var(--primary)]/20
             transition-colors duration-200"
>
```

**Radio Buttons & Checkboxes**
```jsx
<input
  type="radio"
  className="w-5 h-5 border-[var(--border)] rounded-none
             checked:bg-[var(--primary)] checked:border-[var(--primary)]
             focus:ring-2 focus:ring-[var(--primary)]/20"
/>
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

### Information Blocks

**Policy Notice**
```jsx
<div className="border-l-4 border-[var(--accent)] bg-[var(--bg-section)] p-6 my-6">
  <h3 className="font-serif font-bold text-[var(--primary)] mb-2">Policy Title</h3>
  <div className="text-sm text-[var(--ink)] space-y-3 leading-relaxed">
    <p>Policy content...</p>
  </div>
</div>
```

**Warning Block**
```jsx
<div className="border border-[var(--warning)]/30 bg-[var(--warning)]/5 
                rounded-sm p-4 my-4">
  <div className="flex items-center gap-2 text-[var(--warning)]">
    <svg className="w-4 h-4" />
    <span className="text-sm font-medium">Deadline: February 28th</span>
  </div>
  <p className="mt-1 text-sm text-[var(--ink)]/80 ml-6">
    Warning text...
  </p>
</div>
```

### Tables

**Formal Table**
```jsx
<table className="w-full border-collapse text-sm">
  <thead>
    <tr className="bg-[var(--primary)] text-white">
      <th className="px-4 py-3 text-left font-medium border border-[var(--primary)]">
        Header
      </th>
    </tr>
  </thead>
  <tbody>
    <tr className="border-b border-[var(--divider)] 
                   hover:bg-[var(--bg-section)] transition-colors">
      <td className="px-4 py-3 border-x border-[var(--divider)] text-[var(--ink)]">
        Cell
      </td>
    </tr>
  </tbody>
</table>
```

### Section Headers

**Document-Style Header**
```jsx
<div className="relative py-6 mb-6">
  <div className="absolute left-0 top-1/2 w-full h-px bg-[var(--divider)]" />
  <h2 className="relative inline-block bg-white pr-4 font-serif text-xl 
                 text-[var(--primary)]">
    Section Title
  </h2>
  <span className="absolute right-0 top-1/2 -translate-y-1/2 bg-white pl-4 
                   text-sm text-[var(--muted)] font-medium">
    Section X of Y
  </span>
</div>
```

---

## Layout

### Container
```jsx
<main className="min-h-screen bg-[var(--paper)]">
  <div className="max-w-3xl mx-auto px-6 py-12">
    <div className="bg-white shadow-sm border border-[var(--border)] rounded-sm">
      {/* Form content */}
    </div>
  </div>
</main>
```

### Progress Indicator
- Subtle line progress bar
- Section labels below
- Current section highlighted
- Muted colors for incomplete sections

---

## Animations

### Principles
- Subtle, professional
- No bouncing or flashy effects
- Smooth transitions (200-300ms)
- Ease-out timing

### Examples
```css
/* Section transitions */
.section-enter {
  opacity: 0;
  transform: translateY(8px);
}
.section-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 300ms ease-out, transform 300ms ease-out;
}

/* Form field focus */
input:focus, select:focus {
  transition: border-color 200ms ease, box-shadow 200ms ease;
}

/* Button hover */
button:hover {
  transition: background-color 200ms ease, transform 100ms ease;
}
```

---

## Spacing

### Padding Scale
- `p-2`: 0.5rem (8px) - Tight spacing
- `p-3`: 0.75rem (12px) - Compact
- `p-4`: 1rem (16px) - Standard
- `p-6`: 1.5rem (24px) - Comfortable
- `p-8`: 2rem (32px) - Spacious

### Margin Scale
- `mb-2`: 0.5rem (8px) - Tight
- `mb-4`: 1rem (16px) - Standard
- `mb-6`: 1.5rem (24px) - Section spacing
- `mb-8`: 2rem (32px) - Major sections
- `mb-12`: 3rem (48px) - Page sections

---

## Mobile Optimization

### Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Mobile Adjustments
- Full-width form fields
- Horizontal scroll for tables with shadow indicators
- Larger touch targets (min 44px)
- Reduced padding on mobile
- Sticky header with minimal height

---

## Trust Indicators

### Security Badge
```jsx
<div className="flex items-center gap-2 text-xs text-[var(--muted)] mt-4">
  <svg className="w-4 h-4" /* lock icon */ />
  <span>256-bit SSL encrypted • Your data is secure</span>
</div>
```

### Reference Number
```jsx
<div className="text-xs text-[var(--muted)] text-right mt-8">
  Reference: SM-{year}-{submissionId}
</div>
```

---

## Accessibility

### Requirements
- Minimum contrast ratio: 4.5:1 for text
- Focus indicators on all interactive elements
- Proper heading hierarchy (h1 → h2 → h3)
- Alt text for all images
- Keyboard navigation support
- Screen reader friendly labels

### Focus States
```css
focus:outline-none 
focus:ring-2 
focus:ring-[var(--primary)]/30 
focus:ring-offset-2
```

---

## Print Styles

```css
@media print {
  header, footer, .no-print { 
    display: none; 
  }
  
  .page-break { 
    page-break-before: always; 
  }
  
  body { 
    font-size: 12pt; 
  }
  
  .signature-canvas { 
    border: 1px solid #000; 
  }
}
```

---

---

## Standardized Form Components

### Overview

All forms should use the standardized components in `@/components/form/` to ensure consistency. These components enforce the institutional design pattern automatically.

### Form Field Components

**FormField** - Wrapper with label, helper text, and error display
```jsx
<FormField label="Email" required helperText="We'll contact you here" error={errors.email}>
  <FormInput type="email" value={email} onChange={handleChange} />
</FormField>
```

**FormInput** - Pre-styled text input
```jsx
<FormInput
  type="text"
  value={value}
  onChange={handleChange}
  placeholder="Enter text..."
  error={!!errors.field}
  required
/>
```

**FormSelect** - Pre-styled dropdown with custom arrow
```jsx
<FormSelect value={value} onChange={handleChange}>
  <option value="">-- Select --</option>
  <option value="1">Option 1</option>
</FormSelect>
```

**FormTextarea** - Pre-styled multi-line input
```jsx
<FormTextarea
  value={value}
  onChange={handleChange}
  rows={4}
  placeholder="Enter details..."
/>
```

**FormRadioGroup** - Radio button group
```jsx
<FormRadioGroup
  name="priority"
  options={[
    { value: 'low', label: 'Low' },
    { value: 'high', label: 'High', description: 'Urgent items' },
  ]}
  value={value}
  onChange={setValue}
  direction="horizontal"
/>
```

**FormCheckbox** - Single checkbox with label
```jsx
<FormCheckbox
  label="I agree to terms"
  checked={agreed}
  onChange={(e) => setAgreed(e.target.checked)}
/>
```

**FormButton** - Styled button with variants
```jsx
<FormButton
  type="submit"
  variant="primary" // primary, secondary, success, danger, ghost
  size="md" // sm, md, lg
  fullWidth
  loading={isSubmitting}
>
  Submit
</FormButton>
```

### Layout Components

**FormLayout** - Main container with consistent max-width
```jsx
<FormLayout>
  {/* Form content */}
</FormLayout>
```

**FormSection** - Groups related fields
```jsx
<FormSection background>
  {/* Related fields */}
</FormSection>
```

**LanguageLanding** - Language selection screen
```jsx
<LanguageLanding
  title="My Form"
  description="Complete this form..."
  onSelect={(lang) => setLanguage(lang)}
/>
```

**SuccessScreen** - Animated success confirmation
```jsx
<SuccessScreen
  title="Thank You!"
  message="Your form was submitted."
  language={language}
  onLanguageChange={setLanguage}
/>
```

### Utilities & Hooks

**Form Utilities** (`@/lib/formUtils.ts`)
- `validateEmail(email)` - Email validation
- `validatePhone(phone)` - Phone validation (10 digits)
- `formatPhone(phone)` - Format to (XXX) XXX-XXXX
- `sanitizePhone(phone)` - Remove non-digits
- `validateRequired(value)` - Required field check
- `formatCurrency(value)` - Format as USD

**Form Hooks** (`@/lib/formHooks.ts`)
- `useFormSection(totalSections)` - Multi-section navigation
- `useFormSubmit(handler)` - Submission state management
- `useFieldValidation()` - Field-level error handling
- `useFormData(initialData)` - Form data state
- `useFileUpload(maxFiles)` - File upload management

### Quick Start Example

```jsx
import { FormField, FormInput, FormButton, FormLayout } from '@/components/form';
import { useFormData, useFormSubmit } from '@/lib/formHooks';

export default function MyForm() {
  const { formData, updateField } = useFormData({ name: '', email: '' });
  const { submit, isSubmitting } = useFormSubmit(async (data) => {
    await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  return (
    <FormLayout>
      <form onSubmit={(e) => { e.preventDefault(); submit(formData); }}>
        <FormField label="Name" required>
          <FormInput
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            required
          />
        </FormField>
        
        <FormButton type="submit" fullWidth loading={isSubmitting}>
          Submit
        </FormButton>
      </form>
    </FormLayout>
  );
}
```

For complete documentation, see **FORM_STANDARDS.md**.

---

## Implementation Checklist

### Completed
- [x] Color palette defined
- [x] Typography system established
- [x] Global CSS with design tokens
- [x] Header component created
- [x] Footer component created
- [x] Progress indicator component
- [x] Section header component
- [x] Table component updated
- [x] Standardized form components created
- [x] Form utilities and hooks implemented
- [x] Form documentation completed
- [x] Example form template created

### In Progress
- [ ] Migration of existing forms to use new components

### Pending
- [ ] Admin logo upload page
- [ ] Accessibility audit

---

## Usage Guidelines

### Do's
✓ Use standardized form components from `@/components/form/`
✓ Use serif fonts for headers only
✓ Maintain consistent spacing
✓ Use muted, professional colors
✓ Keep animations subtle
✓ Ensure high contrast for readability
✓ Test on mobile devices
✓ Follow FORM_STANDARDS.md for form building

### Don'ts
✗ No rounded corners on form fields
✗ No bright, vibrant colors
✗ No bouncing or flashy animations
✗ No startup-style branding
✗ No excessive whitespace
✗ No decorative elements
✗ No custom form inputs without using standardized components

---

## Support

For questions about the design system:
- **Colors**: See color palette section
- **Typography**: Check typography section
- **Components**: Reference component examples
- **Form Building**: See FORM_STANDARDS.md
- **Layout**: Review layout section
- **Animations**: See animations section
- **Example**: Check `@/examples/example-form.tsx`
