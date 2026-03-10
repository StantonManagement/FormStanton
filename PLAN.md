# FormsStanton — Plan

## Significant Features
Ordered by priority. Higher = more urgent or more load-bearing.

### P1 — Critical
- **Digital forms with photo upload**: Tenants can submit forms with photo evidence directly from mobile devices — Status: partial (3 of 19 forms)
- **Tenant onboarding system**: New tenants complete multilingual forms for pets, insurance, vehicles with automated document generation — Status: built
- **Admin compliance dashboard**: Property managers track pending approvals, missing documentation, and review submissions — Status: built
- **Supabase backend integration**: All form data persists to PostgreSQL with file storage for photos and signatures — Status: built
- **Trilingual support**: All forms available in English, Spanish, Portuguese — Status: built

### P2 — High
- **Move-in inspection form**: Digital checklist with room-by-room condition codes and damage photos (max 20) — Status: planned
- **Billing dispute form**: Tenants submit disputes with supporting evidence photos (max 10) — Status: planned
- **Bulk disposal request**: Photo-based approval workflow for furniture/appliance removal (max 3) — Status: planned
- **Maintenance request enhancement**: Expand existing form with photo upload capability — Status: planned
- **Guest disclosure form**: Extended guest notification with digital signature — Status: built
- **Pet approval workflow**: Multi-pet requests with vaccination records and photos — Status: built

### P3 — Backlog
- **Smoke detector acknowledgment**: Digital signature for detector functionality confirmation — Status: planned
- **Utility transfer confirmation**: Track utility account setup before key release — Status: planned
- **Entry permission management**: Standing authorization vs. restricted entry preferences — Status: planned
- **Lock/key replacement**: Authorization workflow with cost approval — Status: planned
- **Move-out notice**: 30-day notice submission with forwarding address — Status: planned
- **Common area violation**: Warning notice delivery and fine tracking — Status: planned
- **Lease renewal workflow**: Tenant intent capture and management offer generation — Status: planned
- **Section 8 recertification**: Checklist and document tracking for housing authority compliance — Status: planned
- **Historical data migration**: Import existing tenant/vehicle data from Excel/CSV sources — Status: partial
- **AI scan extraction**: Extract data from scanned paper forms using Claude API — Status: built
- **Duplicate submission detection**: Identify and display potential duplicate form submissions — Status: built
- **Print styling optimization**: Professional document-style print layouts for generated forms — Status: built
- **Mobile UI enhancements**: Touch-optimized interactions and responsive layouts — Status: built

## Known Blockers
- **Forms 4-19 digital conversion** → blocked by FormPhotoUpload component integration (component exists, needs implementation per form)
- **Admin review workflow** → blocked by photo inline display in compliance dashboard
- **Email notifications** → blocked by Resend API configuration for each new form type

## Commit Format
All feature commits: feat(formsstanton): [what capability this adds for the user]
All fixes: fix(formsstanton): [what was broken]
Infrastructure changes: infra: [what changed]
Never describe code changes. Always describe user-facing or operational impact.

---

## Phase 1: Core Infrastructure (Complete)

### FormPhotoUpload Component ✅
**Location:** `components/form/FormPhotoUpload.tsx`

**Features:**
- Drag & drop file upload
- Image preview thumbnails with remove option
- File validation (size, format)
- Configurable max photos per form
- Mobile camera access support
- Progress indicators
- Error handling

**Usage:**
```tsx
<FormPhotoUpload
  maxPhotos={5}
  label="Upload Photos"
  helperText="JPG, PNG up to 5MB"
  photos={photos}
  onPhotosChange={setPhotos}
/>
```

### Database Schema ✅
**Table:** `form_submissions`
```sql
form_submissions (
  id UUID PRIMARY KEY,
  form_type TEXT NOT NULL,
  tenant_name TEXT,
  building_address TEXT,
  unit_number TEXT,
  form_data JSONB NOT NULL,
  photo_urls TEXT[],
  signature_url TEXT,
  language TEXT,
  submitted_at TIMESTAMP,
  reviewed BOOLEAN,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP,
  admin_notes TEXT,
  vehicle_verified BOOLEAN,
  pet_verified BOOLEAN,
  insurance_verified BOOLEAN,
  last_reviewed_at TIMESTAMP
)
```

**Storage Buckets:**
- `form-photos/pet-approval/` - Pet photos and signatures
- `form-photos/guest-disclosure/` - Guest disclosure signatures
- `form-photos/maintenance-request/` - Issue photos and signatures

### Design System ✅
**File:** `app/globals.css`
- Professional color palette (deep navy #1a2744, muted gold #8b7355, warm paper #fdfcfa)
- Typography: Libre Baskerville (serif) for headers, Inter (sans-serif) for body
- CSS variables for all design tokens
- No rounded corners (institutional style)
- Framer Motion for subtle animations

**Components:**
- `Header.tsx` - Sticky header with logo and language selector
- `Footer.tsx` - Company info with security badge
- `ProgressIndicator.tsx` - Document-style progress tracking
- `SectionHeader.tsx` - Formal section headers with decorative lines
- `InfoTable.tsx` - Navy header tables with borders

---

## Phase 2: Digital Forms with Photos (In Progress)

### Completed Forms (3/19)

#### Pet Approval Request ✅
**URL:** `/pet-approval`  
**Form ID:** 12  
**API Route:** `/api/forms/pet-approval`

**Features:**
- 4-section multi-step form with tab navigation
- Support for up to 5 pets per request
- Photo upload: 3 photos per pet
- Pet details: type, breed, name, weight, age, color, spayed/neutered, vaccinations
- Digital signature requirement
- Trilingual support (EN/ES/PT)
- Full validation
- Success screen with animation

#### Extended Guest Disclosure ✅
**URL:** `/guest-disclosure`  
**Form ID:** 13  
**API Route:** `/api/forms/guest-disclosure`

**Features:**
- 3-section form with tab navigation
- Guest information: name, relationship, arrival/departure dates, length of stay, reason
- Digital signature requirement
- Trilingual support (EN/ES/PT)
- Full validation
- Success screen

#### Maintenance Request ✅
**URL:** `/maintenance-request`  
**Form ID:** 8  
**API Route:** `/api/forms/maintenance-request`

**Features:**
- 4-section form with tab navigation
- Issue details: location, type (9 categories), description, emergency flag
- Photo upload: up to 5 photos
- Entry authorization preferences
- Pet notification option
- Digital signature requirement
- Trilingual support (EN/ES/PT)
- Emergency warning banner
- Full validation
- Success screen

**Issue Types:**
1. Plumbing (leak, clog, toilet)
2. Electrical (outlets, lights, breaker)
3. Heating/Cooling (furnace, AC, thermostat)
4. Appliance (stove, fridge, dishwasher)
5. Door/Lock/Window
6. Floor/Carpet/Tile
7. Wall/Ceiling/Paint
8. Pest Control
9. Other

### Next Priority Forms

#### Move-In Inspection (Form 1)
- Photos: 20 max (damage documentation)
- Multi-room checklist (living room, kitchen, bathroom, bedroom)
- Condition codes (G/D/M/N/A)
- Room-by-room table structure
- Keys received tracking

#### Billing Dispute (Form 19)
- Photos: 10 max (evidence)
- Dispute details (charge description, amount, date)
- Basis for dispute (pre-existing, wear and tear, incorrect amount)
- Supporting documentation upload
- 15-day submission deadline tracking

#### Bulk Item Disposal (Form 11)
- Photos: 3 max (item verification)
- Item description table
- Requested disposal date
- Approval workflow
- Fine warning for unauthorized disposal

### Remaining Forms (11)
2. Smoke & CO Detector Acknowledgment
3. Utility Transfer Confirmation
7. Permission to Enter / Entry Restriction
10. Lock / Key Replacement Authorization
13. Move-Out Notice
14. Forwarding Address Submission
16. Common Area Violation Warning
17. Unauthorized Pet — Cure Notice
18. Lease Renewal / Non-Renewal Notice
19. Section 8 Recertification Checklist
(Forms 8, 9 are cash payment/PaySlip - may not need digital versions)

---

## Phase 3: Admin & Compliance Tools (Complete)

### Compliance Dashboard ✅
**URL:** `/admin/compliance`

**Features:**
- Building-by-building compliance tracking
- Progress bars for vehicles, pets, insurance
- Filter buttons (All, Has Vehicle, Missing Vehicle, Has Pets, Missing Insurance)
- Verification checkboxes (vehicle_verified, pet_verified, insurance_verified)
- Admin notes field
- Export vehicle CSV for parking permits
- Submission count and stats
- Last reviewed timestamp tracking

**API Endpoints:**
- `GET /api/admin/compliance/building-summary` - Get submissions by building
- `PUT /api/admin/compliance/building-summary` - Update verification status
- `GET /api/admin/compliance/export-vehicles` - Export CSV for parking permits

### Forms Library ✅
**URL:** `/admin/forms-library`

**Features:**
- Searchable table of all 19 forms
- Status badges (Digital, Paper, Planned)
- Form type, description, photo support indicators
- Quick links to digital forms
- Implementation priority tracking

### Duplicate Detection ✅
**Component:** `DuplicateSubmissionAccordion.tsx`

**Features:**
- Identifies potential duplicate submissions
- Accordion UI for reviewing duplicates
- Shows submission details side-by-side
- Helps prevent duplicate processing

---

## Phase 4: Infrastructure & Enhancements (Partial)

### Historical Data Migration (Partial) ✅
**Scripts:**
- `scripts/import-historical-vehicles.ts` - Import vehicle data from CSV
- `scripts/import-rentroll-occupancy.ts` - Import tenant data from Excel
- `scripts/import-tenant-lookup.ts` - Import tenant directory
- `scripts/migrate-tenant-data.ts` - Migrate tenant records

**Status:** Scripts created, some data imported

### AI Scan Extraction ✅
**Features:**
- Claude API integration for extracting data from scanned paper forms
- Handles handwritten and typed forms
- Populates form fields automatically
- Reduces manual data entry

### Print Styling ✅
**File:** `app/globals.css` (print media queries)

**Features:**
- Professional document-style print layouts
- Hides navigation and UI elements
- Optimized for generated documents
- Page break controls

### Mobile Optimizations ✅
**File:** `app/mobile-styles.css`

**Features:**
- Touch-optimized interactions (44px minimum touch targets)
- Responsive layouts for all screen sizes
- Mobile camera access for photo upload
- Horizontal scroll for tables
- Sticky header works on mobile

### Tab Navigation ✅
**Features:**
- Keyboard navigation support
- Focus management
- Accessibility improvements
- WCAG compliance

### Tenant Verification ✅
**Features:**
- Building/unit lookup validation
- Prevents invalid submissions
- Integration with tenant directory

---

## Institutional Redesign Tasks

### Completed ✅
- Design system foundation with CSS variables
- Header component with logo and language selector
- Footer component with security badge
- Progress indicator (document-style)
- Section header component with decorative lines
- Professional table component (navy headers, borders)
- Framer Motion installed
- Google Fonts imported (Libre Baskerville + Inter)
- Design documentation (DESIGN_SYSTEM.md)

### Remaining
- Apply institutional design to main onboarding form (`app/page.tsx`)
- Update signature component to formal document style
- Admin logo upload page (`app/admin/settings/page.tsx`)
- Verify mobile responsiveness with new design
- Accessibility audit

---

## Technical Architecture

### Form Structure Pattern
All forms follow this consistent pattern:

1. **Language Selection Landing**
   - LanguageLanding component
   - Title, description, language buttons

2. **Multi-Section Form**
   - TabNavigation for progress
   - AnimatePresence for smooth transitions
   - FormSection wrappers

3. **Section 1: Tenant Info**
   - Name, building, unit, phone, email
   - BuildingAutocomplete integration
   - Validation

4. **Section N: Form-Specific Fields**
   - Custom fields per form type
   - Photo upload (if applicable)
   - Conditional logic

5. **Final Section: Review & Sign**
   - Summary of all data
   - Terms & conditions
   - Digital signature
   - Final confirmation checkbox

6. **Success Screen**
   - Animated checkmark
   - Success message
   - Language switching

### API Route Pattern
```typescript
1. Parse FormData
2. Upload photos to Supabase Storage (form-photos bucket)
3. Upload signature to Supabase Storage
4. Save to form_submissions table
5. Return success/error response
```

### Workflow
**Tenant Submission:**
1. Tenant accesses form URL
2. Selects language (EN/ES/PT)
3. Completes multi-section form
4. Uploads photos (if applicable)
5. Reviews and signs digitally
6. Submits form

**Backend Processing:**
1. Photos uploaded to Supabase Storage
2. Form data saved to database
3. Email notification sent to Philippines back office
4. Confirmation shown to tenant

**Admin Review:**
1. Philippines team receives notification
2. Reviews submission in admin dashboard
3. Views photos inline
4. Marks as reviewed
5. Takes appropriate action

---

## Implementation Statistics

**Forms Completed:** 3 of 19 (16%)  
**Components Created:** FormPhotoUpload + 5 design system components  
**API Routes Created:** 3 form routes + 3 compliance routes  
**Translation Files:** 3  
**Lines of Code:** ~3,500+

**Live URLs:**
- `/pet-approval` - Pet Approval Request
- `/guest-disclosure` - Extended Guest Disclosure
- `/maintenance-request` - Maintenance Request
- `/form` - Tenant Onboarding (existing)
- `/reimbursement` - Reimbursement Request (existing)
- `/admin/compliance` - Compliance Dashboard
- `/admin/forms-library` - Forms Library

**Total Interactive Forms:** 5  
**Forms Remaining:** 14

---

## Key Achievements

1. **Standardization:** All forms use identical components and patterns
2. **Efficiency:** New forms can be built in ~1 hour using templates
3. **Quality:** Professional design enforced automatically
4. **Accessibility:** WCAG compliance built-in
5. **Internationalization:** Trilingual support standard
6. **Mobile-First:** Responsive on all devices
7. **User Experience:** Smooth animations and clear feedback
8. **Developer Experience:** Reusable components and hooks
9. **Maintainability:** Consistent codebase structure
10. **Scalability:** Easy to add new forms

---

## Documentation Reference

**For Developers:**
- `FORM_STANDARDS.md` - Complete form building guide
- `DESIGN_SYSTEM.md` - Design system documentation
- `examples/example-form.tsx` - Reference implementation
- `components/form/README.md` - Component usage guide
- `ADMIN_DASHBOARD_GUIDE.md` - Admin interface documentation
- `COMPLIANCE_DASHBOARD_IMPLEMENTATION.md` - Compliance features
- `SCAN_IMPORT_GUIDE.md` - Historical data import guide
- `SETUP_GUIDE.md` - Environment setup instructions

**For Users:**
- Language selection on every form
- Inline help text and validation messages
- Progress indicators
- Clear error messages
- Success confirmations
