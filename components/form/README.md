# Standardized Form Components

This directory contains reusable form components that enforce the institutional design pattern established by the tenant reimbursement form.

## Components

### Core Input Components
- **FormField** - Label, helper text, and error wrapper
- **FormInput** - Pre-styled text/email/tel/number/date inputs
- **FormSelect** - Pre-styled dropdown with custom arrow
- **FormTextarea** - Pre-styled multi-line text input

### Form Controls
- **FormRadioGroup** - Radio button group with horizontal/vertical layout
- **FormCheckbox** - Single checkbox with label and description
- **FormButton** - Button with variants (primary, secondary, success, danger, ghost)
- **FormSection** - Groups related fields with optional background

### Layout Components
- **FormLayout** - Main form container with consistent max-width
- **LanguageLanding** - Language selection screen
- **SuccessScreen** - Animated success confirmation

## Usage

Import components from the barrel export:

```tsx
import {
  FormField,
  FormInput,
  FormButton,
  FormLayout,
} from '@/components/form';
```

## Documentation

- **Complete Guide**: See `/FORM_STANDARDS.md`
- **Design System**: See `/DESIGN_SYSTEM.md`
- **Example**: See `/examples/example-form.tsx`

## Quick Example

```tsx
<FormField label="Email" required error={errors.email}>
  <FormInput
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    error={!!errors.email}
    required
  />
</FormField>

<FormButton type="submit" fullWidth loading={isSubmitting}>
  Submit
</FormButton>
```

## Design Principles

All components follow these principles:
- **No rounded corners** on inputs (institutional feel)
- **Consistent spacing** (px-4 py-3 for inputs)
- **CSS variables** for colors (never hardcoded)
- **Accessible** by default (proper labels, focus states)
- **Responsive** (mobile-first design)
- **Professional** (muted colors, subtle animations)
