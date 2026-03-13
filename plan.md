# FormsStanton
FormsStanton is a production tenant onboarding and compliance platform for Stanton Management that digitizes lease-related workflows with multilingual forms, signatures, photos, and admin review tooling. The system currently supports core live workflows while expanding conversion of remaining paper forms into digital flows.

## Features

### Digital forms with photo upload
- **Status:** partial
- **Description:** Tenants can submit evidence-backed forms from mobile or desktop using photo uploads.
- **Blockers:** FormPhotoUpload integration is not completed across Forms 4-19.
- **Dependencies:** none
- **Unlocks:** End-to-end digital processing for all tenant compliance workflows.
- **Effort:** large
- **Priority:** P1

### Tenant onboarding system
- **Status:** active
- **Description:** New tenants submit core onboarding data for pets, insurance, and vehicles with automated document generation.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Faster move-in readiness and reduced paper intake overhead.
- **Effort:** medium
- **Priority:** P1

### Admin compliance dashboard
- **Status:** active
- **Description:** Property management staff can track missing documentation, approvals, and submission status by building.
- **Blockers:** Inline photo review flow still needs completion in admin review workflow.
- **Dependencies:** none
- **Unlocks:** Centralized compliance operations and better exception handling.
- **Effort:** medium
- **Priority:** P1

### Supabase backend integration
- **Status:** active
- **Description:** Form records, signatures, and photos persist in Supabase PostgreSQL and Storage.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Auditability, reporting, and durable submission history.
- **Effort:** medium
- **Priority:** P1

### Trilingual form experience
- **Status:** active
- **Description:** Forms are available in English, Spanish, and Portuguese.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Tenant accessibility across language preferences.
- **Effort:** medium
- **Priority:** P1

### Move-in inspection form
- **Status:** planned
- **Description:** Room-by-room move-in checklist with condition codes and up to 20 damage photos.
- **Blockers:** Awaiting full digital form conversion implementation.
- **Dependencies:** none
- **Unlocks:** Standardized intake evidence for unit condition disputes.
- **Effort:** large
- **Priority:** P2

### Billing dispute form
- **Status:** planned
- **Description:** Structured dispute submission with supporting photo evidence and dispute basis capture.
- **Blockers:** Awaiting full digital form conversion implementation.
- **Dependencies:** none
- **Unlocks:** Faster adjudication and traceable tenant billing exceptions.
- **Effort:** medium
- **Priority:** P2

### Bulk disposal request
- **Status:** planned
- **Description:** Furniture/appliance disposal request flow with photo proof and approval intent.
- **Blockers:** Awaiting full digital form conversion implementation.
- **Dependencies:** none
- **Unlocks:** Better operational control of disposal and violation prevention.
- **Effort:** medium
- **Priority:** P2

### Maintenance request enhancement
- **Status:** planned
- **Description:** Existing maintenance workflow expansion with deeper photo-based issue documentation.
- **Blockers:** Email notification configuration by form type remains incomplete.
- **Dependencies:** none
- **Unlocks:** Faster maintenance triage and clearer field context.
- **Effort:** medium
- **Priority:** P2

### Guest disclosure form
- **Status:** active
- **Description:** Extended guest disclosure captures stay details and digital signature.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Compliance tracking for occupancy exceptions.
- **Effort:** small
- **Priority:** P2

### Pet approval workflow
- **Status:** active
- **Description:** Multi-pet intake captures vaccination records, photos, and approval data.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Policy enforcement and addendum generation for pet-related compliance.
- **Effort:** medium
- **Priority:** P2

### Smoke detector acknowledgment
- **Status:** planned
- **Description:** Digital acknowledgment workflow for detector functionality and tenant confirmation.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Better safety compliance audit trails.
- **Effort:** small
- **Priority:** P3

### Utility transfer confirmation
- **Status:** planned
- **Description:** Utility account setup confirmation before key release.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Reduced move-in utility handoff errors.
- **Effort:** small
- **Priority:** P3

### Entry permission management
- **Status:** planned
- **Description:** Authorization preferences for permitted or restricted maintenance entry.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Clear resident consent trail for access events.
- **Effort:** medium
- **Priority:** P3

### Lock/key replacement workflow
- **Status:** planned
- **Description:** Tenant authorization process for lock/key replacement with cost acknowledgement.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Standardized handling of lock change requests and approvals.
- **Effort:** small
- **Priority:** P3

### Move-out notice workflow
- **Status:** planned
- **Description:** Notice submission flow with forwarding address and timeline capture.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Cleaner turnover preparation and communication workflows.
- **Effort:** medium
- **Priority:** P3

### Common area violation workflow
- **Status:** planned
- **Description:** Formal warning and follow-up tracking for common area policy violations.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** More consistent policy enforcement operations.
- **Effort:** medium
- **Priority:** P3

### Lease renewal workflow
- **Status:** planned
- **Description:** Tenant renewal/non-renewal intent capture with management follow-through.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Better renewal forecasting and outreach timing.
- **Effort:** medium
- **Priority:** P3

### Section 8 recertification workflow
- **Status:** planned
- **Description:** Recertification checklist and supporting document tracking.
- **Blockers:** Awaiting backlog implementation capacity.
- **Dependencies:** none
- **Unlocks:** Stronger compliance posture for assisted housing requirements.
- **Effort:** medium
- **Priority:** P3

### Historical data migration
- **Status:** partial
- **Description:** Imports tenant and vehicle history from CSV/Excel sources into digital records.
- **Blockers:** Migration scripts exist but import execution and cleanup remain incomplete.
- **Dependencies:** AppFolio Sync Layer
- **Unlocks:** Better continuity between historical paper/legacy records and new digital workflows.
- **Effort:** large
- **Priority:** P3

### AI scan extraction
- **Status:** active
- **Description:** Claude-powered extraction of scanned form data for faster data entry.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Accelerated conversion of legacy scanned intake documents.
- **Effort:** medium
- **Priority:** P3

### Duplicate submission detection
- **Status:** active
- **Description:** Duplicate detection UI highlights potential repeated submissions for review.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Reduced redundant processing and cleaner records.
- **Effort:** small
- **Priority:** P3

### Print styling optimization
- **Status:** active
- **Description:** Print-specific layouts improve generated document readability and professionalism.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Better print-ready legal and compliance artifacts.
- **Effort:** small
- **Priority:** P3

### Mobile UI enhancements
- **Status:** active
- **Description:** Touch-first and responsive UX improvements support mobile form completion.
- **Blockers:** none
- **Dependencies:** none
- **Unlocks:** Higher mobile completion rates and fewer submission errors.
- **Effort:** medium
- **Priority:** P3

## Recent Changes
- Updated PLAN documentation to capture compliance dashboard additions, including add tenant tooling and edit capabilities.
- Added compliance dashboard features for tenant creation, inline submission editing, additional vehicle display, and parking context.
- Added priority backlog forms including Smoke Detector, Common Area Violation, and Unauthorized Pet workflows.
- Converted README into NavChart-oriented project metadata format.
- Added Bulk Item Disposal, Billing Dispute, and Move-In Inspection form implementations.
- Added maintenance request digital form support with photo upload.

## Known Debt
- Form conversion coverage remains incomplete across remaining paper workflows (Forms 4-19).
- Admin review experience still lacks full inline photo display completion.
- Email notification wiring for each new form type is incomplete.
- Historical import scripts exist but migration execution/validation is only partially complete.
- Institutional redesign follow-through is incomplete for onboarding page, signature styling, and final accessibility verification.

## Next Milestone
Deliver the next conversion tranche (Move-In Inspection, Billing Dispute, and Bulk Disposal) with complete FormPhotoUpload integration and admin-review-ready submission data.

## Triage Flags
- Digital conversion pace is constrained by per-form integration bandwidth despite shared component availability.
- Admin review workflow quality is impacted until inline photo review is fully closed.
- Resend configuration introduces rollout risk for newly digitalized forms.

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
