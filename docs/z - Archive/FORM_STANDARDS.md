# Form Standards & Building Guide

This document provides comprehensive guidance for building forms using the standardized form components and design patterns.

## Quick Start

All forms should follow the professional, institutional design established by the tenant reimbursement form. Use the standardized components in `@/components/form/` to ensure consistency.

### Basic Form Template

```tsx
import { FormField, FormInput, FormButton, FormLayout } from '@/components/form';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

export default function MyForm() {
  return (
    <>
      <Header language={language} onLanguageChange={setLanguage} />
      <FormLayout>
        <form onSubmit={handleSubmit} className="p-6 sm:p-8">
          <FormField label="Name" required>
            <FormInput
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              required
            />
          </FormField>
          
          <FormButton type="submit" fullWidth>
            Submit
          </FormButton>
        </form>
      </FormLayout>
      <Footer />
    </>
  );
}
```

## Available Components

### Form Fields

#### FormField
Wrapper component that provides label, helper text, and error display.

```tsx
<FormField
  label="Email Address"
  required
  helperText="We'll never share your email"
  error={errors.email}
>
  {/* Input component */}
</FormField>
```

**Props:**
- `label` (string, required): Field label
- `required` (boolean): Shows red asterisk
- `helperText` (string): Helper text below field
- `error` (string): Error message (replaces helper text)
- `children` (ReactNode): Input component

#### FormInput
Pre-styled text input with consistent design.

```tsx
<FormInput
  type="text"
  value={value}
  onChange={handleChange}
  placeholder="Enter text..."
  error={!!errors.field}
  required
/>
```

**Props:** Extends native `<input>` props plus:
- `error` (boolean): Shows error state styling

**Supported types:** text, email, tel, number, date, password, url

#### FormSelect
Pre-styled select dropdown with custom arrow.

```tsx
<FormSelect
  value={value}
  onChange={handleChange}
  error={!!errors.field}
>
  <option value="">-- Select --</option>
  <option value="1">Option 1</option>
</FormSelect>
```

#### FormTextarea
Pre-styled textarea for multi-line input.

```tsx
<FormTextarea
  value={value}
  onChange={handleChange}
  rows={4}
  placeholder="Enter details..."
/>
```

#### FormRadioGroup
Radio button group with consistent styling.

```tsx
<FormRadioGroup
  name="priority"
  options={[
    { value: 'low', label: 'Low Priority' },
    { value: 'high', label: 'High Priority', description: 'Urgent items' },
  ]}
  value={formData.priority}
  onChange={(value) => updateField('priority', value)}
  direction="horizontal" // or "vertical"
/>
```

#### FormCheckbox
Single checkbox with label.

```tsx
<FormCheckbox
  label="I agree to the terms"
  description="Optional description text"
  checked={formData.agreed}
  onChange={(e) => updateField('agreed', e.target.checked)}
/>
```

### Buttons

#### FormButton
Styled button with variants and loading states.

```tsx
<FormButton
  type="submit"
  variant="primary" // primary, secondary, success, danger, ghost
  size="md" // sm, md, lg
  fullWidth
  loading={isSubmitting}
>
  Submit Form
</FormButton>
```

**Variants:**
- `primary`: Navy background (default)
- `secondary`: Outlined navy
- `success`: Green background
- `danger`: Red background
- `ghost`: Transparent with hover

### Layout Components

#### FormLayout
Main container with consistent max-width and styling.

```tsx
<FormLayout>
  {/* Form content */}
</FormLayout>
```

#### FormSection
Groups related fields with optional background.

```tsx
<FormSection background>
  {/* Related fields */}
</FormSection>
```

#### LanguageLanding
Language selection screen.

```tsx
<LanguageLanding
  title="My Form"
  description="Complete this form to..."
  onSelect={(lang) => {
    setLanguage(lang);
    setShowForm(true);
  }}
/>
```

#### SuccessScreen
Success confirmation with animation.

```tsx
<SuccessScreen
  title="Thank You!"
  message="Your form has been submitted."
  language={language}
  onLanguageChange={setLanguage}
/>
```

## Form Utilities

### Validation Functions

```tsx
import {
  validateEmail,
  validatePhone,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  validateNumberRange,
} from '@/lib/formUtils';

// Email validation
if (!validateEmail(formData.email)) {
  setError('Invalid email address');
}

// Phone validation (10 digits)
if (!validatePhone(formData.phone)) {
  setError('Invalid phone number');
}

// Required field
if (!validateRequired(formData.name)) {
  setError('This field is required');
}
```

### Formatting Functions

```tsx
import {
  formatPhone,
  sanitizePhone,
  formatCurrency,
  parseCurrency,
} from '@/lib/formUtils';

// Format phone: "8605551234" → "(860) 555-1234"
const formatted = formatPhone(phone);

// Sanitize phone: "(860) 555-1234" → "8605551234"
const clean = sanitizePhone(phone);

// Format currency: 1234.56 → "$1,234.56"
const price = formatCurrency(1234.56);
```

## Custom Hooks

### useFormSection
Manages multi-section form navigation.

```tsx
import { useFormSection } from '@/lib/formHooks';

const {
  currentSection,
  nextSection,
  previousSection,
  goToSection,
  isFirstSection,
  isLastSection,
} = useFormSection(3); // 3 total sections
```

### useFormSubmit
Manages form submission state.

```tsx
import { useFormSubmit } from '@/lib/formHooks';

const { submit, isSubmitting, submitError, submitSuccess } = useFormSubmit(
  async (data) => {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed');
  }
);
```

### useFieldValidation
Manages field-level validation errors.

```tsx
import { useFieldValidation } from '@/lib/formHooks';

const {
  errors,
  setFieldError,
  clearFieldError,
  clearAllErrors,
  getFieldError,
} = useFieldValidation<FormData>();

// Set error
setFieldError('email', 'Invalid email');

// Get error
const emailError = getFieldError('email');
```

### useFormData
Manages form data state.

```tsx
import { useFormData } from '@/lib/formHooks';

const { formData, updateField, updateFields, resetForm } = useFormData({
  name: '',
  email: '',
});

// Update single field
updateField('name', 'John');

// Update multiple fields
updateFields({ name: 'John', email: 'john@example.com' });
```

### useFileUpload
Manages file upload state.

```tsx
import { useFileUpload } from '@/lib/formHooks';

const {
  files,
  addFiles,
  removeFile,
  clearFiles,
  canAddMore,
  fileCount,
} = useFileUpload(5); // max 5 files

// Add files
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files) {
    addFiles(e.target.files);
  }
};
```

## Multi-Section Forms

### Structure

```tsx
import { AnimatePresence, motion } from 'framer-motion';
import TabNavigation from '@/components/TabNavigation';
import SectionHeader from '@/components/SectionHeader';

const tabs = [
  { id: 1, label: 'Basic Info' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Review' },
];

return (
  <FormLayout>
    <TabNavigation
      tabs={tabs}
      activeTab={currentSection}
      onTabClick={goToSection}
    />
    
    <form className="p-6 sm:p-8">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {currentSection === 1 && (
            <FormSection>
              <SectionHeader
                title="Basic Information"
                sectionNumber={1}
                totalSections={3}
              />
              {/* Section 1 fields */}
            </FormSection>
          )}
          
          {/* Other sections... */}
        </motion.div>
      </AnimatePresence>
    </form>
  </FormLayout>
);
```

### Section Validation

```tsx
const validateSection = (section: number): boolean => {
  clearAllErrors();
  
  if (section === 1) {
    if (!formData.name.trim()) {
      setFieldError('name', 'Name is required');
      return false;
    }
    if (!validateEmail(formData.email)) {
      setFieldError('email', 'Invalid email');
      return false;
    }
    return true;
  }
  
  return true;
};

// Use in navigation
<FormButton
  onClick={() => {
    if (validateSection(currentSection)) {
      nextSection();
    }
  }}
>
  Continue
</FormButton>
```

## Design Patterns

### Language Selection Flow

```tsx
const [language, setLanguage] = useState<Language>('en');
const [showForm, setShowForm] = useState(false);

if (!showForm) {
  return (
    <LanguageLanding
      title="My Form"
      onSelect={(lang) => {
        setLanguage(lang);
        setShowForm(true);
      }}
    />
  );
}

// Show form...
```

### Success State

```tsx
if (submitSuccess) {
  return (
    <SuccessScreen
      title="Thank You!"
      message="Your submission was successful."
      language={language}
      onLanguageChange={setLanguage}
    />
  );
}
```

### Error Display

```tsx
{submitError && (
  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
    <p className="text-sm text-red-700">{submitError}</p>
  </div>
)}
```

## Styling Guidelines

### Spacing
- Use `space-y-4` for field groups
- Use `space-y-6` for sections
- Use `mb-8` for major section breaks

### Responsive Design
- All components are mobile-first
- Use `sm:` prefix for tablet/desktop adjustments
- Forms are max-width 3xl (768px)

### Colors
- Use CSS variables: `var(--primary)`, `var(--error)`, etc.
- Never hardcode colors
- See `@/app/globals.css` for full palette

### Typography
- Labels: `text-sm font-medium`
- Helper text: `text-xs text-[var(--muted)]`
- Errors: `text-xs text-[var(--error)]`

## Best Practices

### 1. Always Use FormField Wrapper
```tsx
// ✅ Good
<FormField label="Email" required error={errors.email}>
  <FormInput type="email" value={email} onChange={handleChange} />
</FormField>

// ❌ Bad
<label>Email *</label>
<input type="email" value={email} onChange={handleChange} />
```

### 2. Consistent Validation
```tsx
// ✅ Good - Use utility functions
if (!validateEmail(email)) {
  setFieldError('email', 'Invalid email');
}

// ❌ Bad - Custom regex
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  setFieldError('email', 'Invalid email');
}
```

### 3. Loading States
```tsx
// ✅ Good
<FormButton type="submit" loading={isSubmitting}>
  {isSubmitting ? 'Submitting...' : 'Submit'}
</FormButton>

// ❌ Bad - No loading state
<button type="submit">Submit</button>
```

### 4. Accessibility
```tsx
// ✅ Good - Proper labels and required
<FormField label="Name" required>
  <FormInput type="text" required />
</FormField>

// ❌ Bad - No label
<FormInput type="text" placeholder="Name" />
```

### 5. Error Handling
```tsx
// ✅ Good - Show errors inline
<FormField label="Email" error={errors.email}>
  <FormInput error={!!errors.email} />
</FormField>

// ❌ Bad - Alert for errors
if (error) alert('Error!');
```

## Complete Example

See `@/examples/example-form.tsx` for a fully functional example demonstrating:
- Language selection
- Multi-section navigation
- Field validation
- Form submission
- Success state
- Error handling
- Responsive design
- Animations

## Migration Guide

### Converting Existing Forms

1. **Replace input elements:**
   ```tsx
   // Before
   <input className="..." />
   
   // After
   <FormInput />
   ```

2. **Add FormField wrappers:**
   ```tsx
   // Before
   <label>Name</label>
   <input />
   
   // After
   <FormField label="Name">
     <FormInput />
   </FormField>
   ```

3. **Use FormButton:**
   ```tsx
   // Before
   <button className="...">Submit</button>
   
   // After
   <FormButton type="submit">Submit</FormButton>
   ```

4. **Wrap in FormLayout:**
   ```tsx
   // Before
   <div className="max-w-3xl mx-auto...">
   
   // After
   <FormLayout>
   ```

## Troubleshooting

### TypeScript Errors
- Ensure you import types from `@/types/forms`
- Use proper Language type from `@/lib/translations`

### Styling Issues
- Check that `@/app/globals.css` is imported
- Verify CSS variables are defined
- Use browser DevTools to inspect applied styles

### Validation Not Working
- Ensure validation runs before navigation/submission
- Check that error state is properly set
- Verify error prop is passed to FormField

## Support

For questions or issues:
- Review `@/DESIGN_SYSTEM.md` for design guidelines
- Check `@/examples/example-form.tsx` for reference
- Review existing forms like `@/app/reimbursement/page.tsx`
