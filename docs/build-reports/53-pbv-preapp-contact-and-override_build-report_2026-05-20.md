# PRD-53 Build Report: Preapp Contact Capture + Income Edit & Qualification Override

**Date:** 2026-05-20  
**Branch:** `feat/pbv-preapp-contact-and-override-53`  
**Status:** Complete

---

## Summary

This build implements PRD-53 which fixes a critical bug where the phone + invite section was hidden for over-income applicants, and adds staff capabilities to edit income and override qualification.

---

## Files Modified

| File | Change |
|------|--------|
| `supabase/migrations/20260520000000_pbv_preapp_email_and_override.sql` | New migration - adds `email`, `qualification_override_reason`, `qualification_override_at`, `qualification_override_by` columns to `pbv_preapplications` |
| `types/compliance.ts` | Added `email`, `qualification_override_reason`, `qualification_override_at`, `qualification_override_by` to `PbvPreapplication` type |
| `lib/pbvFormTranslations.ts` | Added `hoh_phone_label`, `hoh_email_label`, `err_hoh_phone`, `err_hoh_email` (en/es/pt) |
| `components/portal/PbvPreappForm.tsx` | Added phone (required) and email (optional) inputs with validation to Section 1 |
| `app/api/t/[token]/pbv-preapp/route.ts` | Accept and store `phone` and `email` on preapp submission |
| `lib/buildings.ts` | Added `buildingToZipcode` export (pre-existing issue fix) |
| `app/admin/pbv/preapps/page.tsx` | **Major changes:**<br>- Ungated invite section (removed `{qualified &&` wrapper)<br>- Added editable email field<br>- Added inline income editing with Save/Cancel<br>- Added "Override & Send Invitation" button for over-income applicants<br>- Added override panel with required reason input<br>- Updated confirmation panel to show email and override banner<br>- Qualification badge recomputes on income edit |
| `app/api/admin/pbv/preapps/[id]/route.ts` | Extended PATCH to handle `phone`, `email`, `total_household_income`, and `override.reason` |
| `app/api/admin/pbv/full-applications/route.ts` | Accept and store `email` when creating full application |

---

## Verification Gates

| Gate | Status | Notes |
|------|--------|-------|
| Gate 1: Public form phone + email | PASS | Phone (required), email (optional), trilingual (en/es/pt), validated |
| Gate 2: Over-income preapp shows invite controls | PASS | `{qualified &&` wrapper removed, section visible for all |
| Gate 3: Income edit recomputes qualification | PASS | Local state updates, badge recalculates, button updates |
| Gate 4: Override path with required reason | PASS | Override panel shows, reason required, persists via PATCH |
| Gate 5: Qualified path unchanged | PASS | "Approve & Send Invitation" for qualified, no override prompt |
| Gate 6: Email propagates to full_app | PASS | Email passed in POST body, stored in `pbv_full_applications` |
| Gate 7: Type check + build | PASS | `node ./node_modules/typescript/bin/tsc --noEmit` clean, `npm run build` successful |

---

## Build Output

```
> tenant-onboarding-form@0.1.0 build
> next build --webpack

▲ Next.js 16.1.6 (webpack)
- Environments: .env.local
- Experiments (use with caution):
  · optimizePackageImports

✓ Compiled successfully in 34.9s
✓ Finished TypeScript in 58s
✓ Collecting page data using 7 workers in 4.0s    
✓ Generating static pages using 7 workers (207/207) in 9.7s
```

---

## Production Deployment Requirements

The following migrations **must be applied to prod Supabase** (`lieeeqqvshobnqofcdac`) before this feature works:

1. **`20260519000000_pbv_preapp_phone.sql`** (PRD-51 - if not already applied)
2. **`20260520000000_pbv_preapp_email_and_override.sql`** (this PRD)

Migration files are at:
- `supabase/migrations/20260519000000_pbv_preapp_phone.sql`
- `supabase/migrations/20260520000000_pbv_preapp_email_and_override.sql`

**Note:** Do not execute migrations manually via the build agent. Supabase applies migrations on deploy.

---

## Key Implementation Details

### F1 — Public Form Phone + Email
- Phone input: `type="tel"`, required, validated on submit
- Email input: `type="email"`, optional, validated if present
- Both stored on `pbv_preapplications` table

### F2 — Ungate Invite Section
- **Bug fix:** The `{qualified && (<section>...</section>)}` at line 1243 was the root cause
- Now shows for ALL preapps regardless of qualification result

### F3 — Qualification-Aware Button + Override
- Button label adapts:
  - Qualified: "Approve & Send Invitation" (green)
  - Not qualified: "Override & Send Invitation" (amber)
- Override panel requires typed reason before proceeding
- Override reason stored in `qualification_override_reason`

### F4 — Inline Income Edit
- Edit button appears next to income display
- Save updates via PATCH, recomputes qualification locally
- If corrected income is under limit, button reverts from "Override" to "Approve"

### F5 — Override Persistence
- PATCH accepts `override: { reason: string }`
- Stores: `qualification_override_reason`, `qualification_override_at` (timestamp), `qualification_override_by` (actor email)

### F6 — Email Propagation
- Email displayed in HoH section (editable)
- Passed to full application on creation
- Enables email fallback for SMS notifications

---

## Testing Notes

### Over-income scenario (the bug fix):
1. Open an over-income preapp in admin
2. Phone field, email field, and invite controls are now visible
3. Button shows "Override & Send Invitation" (amber)
4. Click opens override panel with required reason
5. Confirm saves override + approves + creates full app + sends SMS

### Income correction scenario:
1. Open over-income preapp
2. Click Edit next to income
3. Enter lower amount (under limit)
4. Save - qualification badge flips to "Under Limit"
5. Button updates to "Approve & Send Invitation" (green)

### Qualified scenario (no regression):
1. Open qualified preapp
2. Button shows "Approve & Send Invitation" (green)
3. No override prompt - flows directly to confirmation

---

## What NOT to Touch (per PRD)

- ✅ No change to `qualification_result` computation logic
- ✅ No change to send-sms endpoint
- ✅ No change to notification templates
- ✅ No bulk override
- ✅ No removal of qualification display

---

## Open Questions (O1-O3) - Decisions

| ID | Question | Decision |
|----|----------|----------|
| O1 | Email required on public form? | No - phone required, email optional |
| O2 | Override reason free-text or dropdown? | Free-text (MVP), presets can come later |
| O3 | Who can override? | Any authenticated staff (can tighten to permission check later) |

---

## Git Status

- Branch: `feat/pbv-preapp-contact-and-override-53`
- Base: `main`
- Migrations: Created but not executed (Supabase applies on deploy)
- Type check: Clean (exit 0)
- Build: Successful (exit 0)

---

## Checklist

- [x] Migration files created (not executed)
- [x] Types updated
- [x] Translations added (en/es/pt)
- [x] Public form updated
- [x] Admin page updated
- [x] API routes updated
- [x] Type check clean
- [x] Build successful
- [x] Build report created
- [ ] Migrations applied to prod (deployment step)
