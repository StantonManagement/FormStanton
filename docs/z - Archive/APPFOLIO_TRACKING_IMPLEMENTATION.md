# AppFolio Document Upload Tracking System - Implementation Complete

Implementation completed on March 15, 2026.

---

## What Was Built

A comprehensive document tracking system integrated into the Compliance Dashboard that allows property management to:
- Download all required documents (pet addendum, vehicle addendum, insurance)
- Mark documents as uploaded to AppFolio with notes
- Track monthly fees added to AppFolio (pet rent, permit fees)
- Filter submissions by AppFolio status (Ready, Partial, Complete)

---

## Files Created

### Database Migration
- `supabase/migrations/20260315000000_add_appfolio_tracking.sql`
  - Adds 20 new columns to track document uploads and fees
  - Includes timestamps, uploader names, amounts, and notes

### Reusable Components
- `components/DocumentDownloadButton.tsx` - Download button with loading states
- `components/AppFolioDocumentRow.tsx` - Document upload tracking row
- `components/AppFolioFeeRow.tsx` - Fee tracking with amount input
- `components/AppFolioStatusFilter.tsx` - Status filter dropdown

### API Routes
- `app/api/admin/compliance/mark-appfolio-upload/route.ts` - Mark documents as uploaded
- `app/api/admin/compliance/mark-fee-added/route.ts` - Mark fees as added with amounts
- `app/api/admin/compliance/download-documents-zip/route.ts` - Download all docs as ZIP

### Updated Files
- `app/admin/compliance/page.tsx` - Integrated AppFolio UI and filtering
- `package.json` - Added jszip dependency

---

## Key Features

### Progressive Disclosure
- AppFolio section only appears after permit is issued
- No clutter before documents are ready for upload
- Clean, scannable layout

### Document Tracking
Each document (pet addendum, vehicle addendum, insurance) tracks:
- ✓ Whether uploaded to AppFolio
- ✓ Who uploaded it
- ✓ When it was uploaded
- ✓ Optional note (for physical documents without scans)

### Fee Tracking
Tracks monthly fees with dollar amounts:
- Pet rent (only if has pets and not fee exempt)
- Permit fee (only if has vehicle)
- Records who added the fee and when

### Filtering
New "AppFolio Status" filter with 4 options:
- **All** - Show everything
- **Ready to Upload** - Verified and permit issued, not yet uploaded
- **Partially Uploaded** - Some documents uploaded, not all
- **Complete** - All documents uploaded + fees added

### Allow Physical Documents
Property managers can mark documents as uploaded even without digital copies by adding a note like "Physical document uploaded directly to AppFolio"

---

## UX Design Principles Followed

✓ **Institutional Design System** - Uses existing CSS variables, serif headers, no rounded corners
✓ **Progressive Disclosure** - AppFolio features only show when permit issued
✓ **Reusable Components** - Consistent patterns throughout
✓ **Clear Affordances** - Download buttons with icons, green checkmarks for completed items
✓ **Scannable Layout** - Documents grouped together, vertical alignment
✓ **Subtle Guidance** - Gray for pending, green for complete, warning icons for missing

---

## Workflow Separation

**Lobby Staff (Alex, Dean, Dan, Tiff):**
- Verify documents in person
- Issue permits
- NO AppFolio features (lobby tool unchanged)

**Property Managers (back office):**
- Download documents from Compliance Dashboard
- Upload to AppFolio
- Mark fees added
- Track completion

---

## Database Schema

New columns added to `submissions` table:

**Pet Addendum:**
- pet_addendum_uploaded_to_appfolio (boolean)
- pet_addendum_uploaded_to_appfolio_at (timestamp)
- pet_addendum_uploaded_to_appfolio_by (text)
- pet_addendum_upload_note (text)

**Vehicle Addendum:**
- vehicle_addendum_uploaded_to_appfolio (boolean)
- vehicle_addendum_uploaded_to_appfolio_at (timestamp)
- vehicle_addendum_uploaded_to_appfolio_by (text)
- vehicle_addendum_upload_note (text)

**Insurance:**
- insurance_uploaded_to_appfolio (boolean)
- insurance_uploaded_to_appfolio_at (timestamp)
- insurance_uploaded_to_appfolio_by (text)
- insurance_upload_note (text)

**Pet Fee:**
- pet_fee_added_to_appfolio (boolean)
- pet_fee_added_to_appfolio_at (timestamp)
- pet_fee_added_to_appfolio_by (text)
- pet_fee_amount (numeric(10,2))

**Permit Fee:**
- permit_fee_added_to_appfolio (boolean)
- permit_fee_added_to_appfolio_at (timestamp)
- permit_fee_added_to_appfolio_by (text)
- permit_fee_amount (numeric(10,2))

---

## Next Steps

1. **Run the migration:**
   ```bash
   supabase db reset
   ```
   Or apply manually via Supabase dashboard

2. **Test the workflow:**
   - Navigate to Compliance Dashboard
   - Select a building with submissions that have permits issued
   - You'll see the new "AppFolio Documents" section
   - Test downloading documents
   - Test marking documents as uploaded
   - Test adding fees with amounts
   - Test the AppFolio status filter

3. **Admin name:**
   - First time marking something uploaded, you'll be prompted for your name
   - Name is cached for the session

---

## Technical Notes

- Uses progressive enhancement - existing functionality unchanged
- All AppFolio features are additive, no breaking changes
- Follows existing patterns (ExemptionStatusBadge, DocumentViewerModal)
- TypeScript interfaces fully updated
- Filter logic handles undefined boolean values correctly
- ZIP download uses jszip library (newly installed)

---

## Design System Compliance

✓ No rounded corners (rounded-none)
✓ Serif fonts (Libre Baskerville) for headers only
✓ Inter for body text
✓ CSS variables for all colors
✓ 200-300ms transitions
✓ Institutional aesthetic maintained
✓ High contrast for readability
✓ Reusable components following established patterns
