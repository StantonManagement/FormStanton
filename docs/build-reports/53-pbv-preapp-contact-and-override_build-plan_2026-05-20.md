# PRD-53 Build Plan: Preapp Contact Capture + Income Edit & Qualification Override

## Overview
This PRD fixes a critical bug where the phone + invite section is hidden for over-income applicants, preventing staff from entering contact info or sending invitations. It also adds income editing and qualification override capabilities.

## Base State Verification

- [x] **Git config**: Line 23 is empty (not corrupted) - no fix needed
- [x] **PRD-51 phone migration**: `20260519000000_pbv_preapp_phone.sql` exists

## Implementation Steps

### Step 1: Database Migrations

Create `supabase/migrations/20260520000000_pbv_preapp_email_and_override.sql`:

```sql
-- Add email column to pbv_preapplications
ALTER TABLE pbv_preapplications 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add qualification override columns
ALTER TABLE pbv_preapplications 
ADD COLUMN IF NOT EXISTS qualification_override_reason TEXT,
ADD COLUMN IF NOT EXISTS qualification_override_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qualification_override_by TEXT;
```

**Note**: Do not execute - migrations are applied on deploy.

### Step 2: Type Updates (`types/compliance.ts`)

Add to `PbvPreapplication` interface (around line 515):

```typescript
email: string | null;
qualification_override_reason: string | null;
qualification_override_at: string | null;
qualification_override_by: string | null;
```

### Step 3: Public Form Phone + Email (F1)

**A. Update `lib/pbvFormTranslations.ts`**

Add to `PbvFormStrings` interface:
```typescript
hoh_phone_label: string;
hoh_email_label: string;
err_hoh_phone: string;
err_hoh_email: string;
```

Add translations for en/es/pt:
- `hoh_phone_label`: "Phone Number" / "Número de Teléfono" / "Número de Telefone"
- `hoh_email_label`: "Email Address (optional)" / "Correo Electrónico (opcional)" / "Email (opcional)"
- `err_hoh_phone`: "Phone number is required." / "El número de teléfono es obligatorio." / "O número de telefone é obrigatório."
- `err_hoh_email`: "Please enter a valid email address." / "Ingrese una dirección de correo válida." / "Digite um endereço de email válido."

**B. Update `components/portal/PbvPreappForm.tsx`**

1. Add phone and email to `FormData` interface:
```typescript
hohPhone: string;
hohEmail: string;
```

2. Initialize in state:
```typescript
const [form, setForm] = useState<FormData>({
  hohName: '',
  hohDob: '',
  hohPhone: '',
  hohEmail: '',
  // ... rest
});
```

3. Add validation in `validate()`:
```typescript
if (!form.hohPhone.trim()) errs['hoh_phone'] = t.err_hoh_phone;
if (form.hohEmail.trim() && !isValidEmail(form.hohEmail)) errs['hoh_email'] = t.err_hoh_email;
```

4. Add inputs to Section 1 (after unit fields):
- Phone input (type="tel", required)
- Email input (type="email", optional)

5. Update `handleSubmit()` to include phone and email in POST body.

6. Add email validation helper:
```typescript
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
```

**C. Update `app/api/t/[token]/pbv-preapp/route.ts`**

1. In POST handler, extract `phone` and `email` from body.
2. Validate phone is present and parseable via `parsePhoneToE164`.
3. Validate email format if provided.
4. Include `phone` and `email` in the insert to `pbv_preapplications`.

### Step 4: Ungate Invite Section (F2)

**Update `app/admin/pbv/preapps/page.tsx`**

At line 1071, replace `{qualified && (<section>...</section>)}` with just `<section>...</section>` (always render).

The section should render for ALL preapps regardless of qualification status.

### Step 5: Qualification-Aware Button + Override (F3)

**Update `app/admin/pbv/preapps/page.tsx` DetailContent**

1. Add override state:
```typescript
const [overrideMode, setOverrideMode] = useState(false);
const [overrideReason, setOverrideReason] = useState('');
const [overrideError, setOverrideError] = useState('');
```

2. Modify button logic in the chain idle state (around line 1109):
   - If `qualified`: "Approve & Send Invitation" (current)
   - If NOT qualified: "Override & Send Invitation" → opens override panel

3. Add override confirmation panel (when overrideMode is true):
   - Banner: "This applicant is over the income limit. You are advancing them on override."
   - Required reason input (textarea)
   - Cancel/Confirm buttons
   - Error display if reason is empty

4. Modify `handleApproveAndSendInvitation` to accept `overrideReason` parameter:
   - When reason provided, include in PATCH before chain runs
   - Store override fields via API

### Step 6: Inline Income Edit (F4)

**Update `app/admin/pbv/preapps/page.tsx` DetailContent**

1. Add income edit state:
```typescript
const [incomeEditMode, setIncomeEditMode] = useState(false);
const [incomeEditValue, setIncomeEditValue] = useState('');
const [incomeSaving, setIncomeSaving] = useState(false);
```

2. Around line 936 (Qualification Math section), add edit affordance:
   - Display current income with Edit button
   - When editing: input field + Save/Cancel buttons

3. Add `handleSaveIncome` function:
   - PATCH to `/api/admin/pbv/preapps/${detail.id}` with new income
   - On success: recompute `incomeOk` locally, update qualification badge
   - If corrected income is under limit, button reverts from "Override" to "Approve"

### Step 7: PATCH API Extension (F5)

**Update `app/api/admin/pbv/preapps/[id]/route.ts`**

Extend PATCH handler to accept:
- `phone`: string | null
- `email`: string | null  
- `total_household_income`: number
- `override`: { reason: string }

Implementation:
1. Extract all fields from body
2. Build update object with provided fields
3. If `override.reason` provided:
   - Add `qualification_override_reason`, `qualification_override_at` (now), `qualification_override_by` (session user)
4. Execute update
5. Audit log each change (income edit, contact edit, override)

### Step 8: Email in Admin + Propagation (F6)

**A. Update `app/admin/pbv/preapps/page.tsx`**

1. Add localEmail state similar to localPhone
2. Display email field in HoH section (editable like phone)
3. Include email in confirmation panel display

**B. Update `app/api/admin/pbv/full-applications/route.ts`**

1. Accept `email` in POST body
2. Store `email` in `pbv_full_applications` insert (line 294)

### Step 9: Type Check & Build

```bash
node ./node_modules/typescript/bin/tsc --noEmit
npm run build
```

## Files to Modify

| File | Changes |
|------|---------|
| `supabase/migrations/20260520000000_pbv_preapp_email_and_override.sql` | New migration - email + override columns |
| `types/compliance.ts` | Add email, override fields to PbvPreapplication |
| `lib/pbvFormTranslations.ts` | Add phone/email labels and validation (en/es/pt) |
| `components/portal/PbvPreappForm.tsx` | Add phone/email inputs, validation, submit |
| `app/api/t/[token]/pbv-preapp/route.ts` | Accept and store phone/email on submit |
| `app/admin/pbv/preapps/page.tsx` | Ungate invite, income edit, override UI, email display |
| `app/api/admin/pbv/preapps/[id]/route.ts` | Extend PATCH for income/email/override |
| `app/api/admin/pbv/full-applications/route.ts` | Accept and store email on create |

## Verification Gates

- [ ] Gate 1: Public form collects phone (required) + email (optional), stores both
- [ ] Gate 2: Over-income preapp shows phone + invite controls (the bug fix)
- [ ] Gate 3: Income edit recomputes qualification, button updates accordingly
- [ ] Gate 4: Override path requires reason, persists and audit-logs
- [ ] Gate 5: Qualified path unchanged (no regression)
- [ ] Gate 6: Email propagates to full_application on invite
- [ ] Gate 7: Type check and build clean

## Production Deployment Notes

The following migrations must be applied to prod Supabase (`lieeeqqvshobnqofcdac`) before this feature works:

1. `20260519000000_pbv_preapp_phone.sql` (from PRD-51)
2. `20260520000000_pbv_preapp_email_and_override.sql` (this PRD)

## What NOT to Do

- Do not leave the `qualified &&` gate in place
- Do not skip the email validation on public form
- Do not make override reason optional
- Do not change qualification computation logic
- Do not modify send-sms endpoint or notification templates

## Branch

`feat/pbv-preapp-contact-and-override-53`

---

**Waiting for user confirmation to proceed.**
