# Compliance Page — Current State & Redesign Brief

---

## 1. What It's Called vs. What It Actually Does

The page is called **"Compliance Dashboard"** (`/admin/compliance`). The name is misleading — it has nothing to do with regulatory compliance. It's the operational command center for tracking **tenant onboarding projects** across a portfolio of ~41 buildings in Hartford, CT. The real job: "Did every tenant in this building submit their forms, are their documents uploaded, and are their fees loaded?"

---

## 2. Current Architecture

### Tech Stack
- **Framework:** Next.js (App Router), React client component (~1,700 lines, single file)
- **Database:** Supabase Postgres — all data lives in a `submissions` table
- **Storage:** Supabase Storage bucket `submissions` for documents (addendums, insurance PDFs, ID photos)
- **Auth:** Cookie-based admin auth via `isAuthenticated()` / `getSessionUser()`
- **Audit:** All document and fee actions logged via `logAudit()`

### Data Model
The core entity is a **submission** — one row per tenant who completed the onboarding form. Key fields:

| Domain | Fields |
|--------|--------|
| **Identity** | `full_name`, `unit_number`, `building_address`, `phone`, `email` |
| **Vehicle** | `has_vehicle`, `vehicle_make/model/year/color/plate`, `vehicle_verified`, `vehicle_signature`, `vehicle_addendum_file`, `vehicle_exported`, `permit_issued` |
| **Pet** | `has_pets`, `pets` (JSON array), `pet_verified`, `pet_signature`, `pet_addendum_file` |
| **Insurance** | `has_insurance`, `insurance_provider`, `insurance_policy_number`, `insurance_file`, `insurance_verified`, `insurance_upload_pending` |
| **Review workflow** | `ready_for_review`, `reviewed_for_permit`, `reviewed_by`, `reviewed_at` |
| **AppFolio sync** | `vehicle_addendum_uploaded_to_appfolio`, `pet_addendum_uploaded_to_appfolio`, `insurance_uploaded_to_appfolio`, `pet_fee_added_to_appfolio`, `permit_fee_added_to_appfolio` (each with `_at` and `_by` timestamps) |
| **Duplicates** | `merged_into`, `is_primary`, `duplicate_group_id` |
| **Additional vehicles** | `additional_vehicles` (JSON array), `additional_vehicle_approved/denied` |

### Supporting Static Data (hardcoded in `/lib/`)
- **`buildings.ts`** — 41 building addresses, unit lists per building, LLC mapping, parking flags
- **`buildingAssetIds.ts`** — Asset IDs (S0001–S0041), parking spot counts per building
- **`portfolios.ts`** — 5 portfolios: "90 Park", "South End Portf.", "Hartford 1", "North End Portf.", "Park Portfolio"
- **`addressNormalizer.ts`** — Fuzzy address matching between form submissions and canonical building list

### Tenant Source of Truth
A separate `tenant_lookup` table (fetched via `/api/admin/compliance/tenant-data`) provides the **occupied units per building** — this is what lets the page calculate who is "missing" a submission vs. who is vacant.

---

## 3. Current Page Layout & Workflow

### Header Bar
- Portfolio-level stats in a horizontal row (buildings count, units, occupied, submissions, vehicle count per portfolio)
- Links back to admin, to raw data view, and to Export Center

### Left Sidebar (collapsible)
1. **Quick Tenant Lookup** — searches all submissions by name/unit/phone/email (Ctrl+K)
2. **Filters** — checkboxes for Has Vehicle / Has Pets / Has Insurance / Needs Review, plus radio for Export Status (all / exported / not-exported)
3. **Duplicate Detection** — toggle grouping, show-only-duplicates, similarity threshold
4. **Portfolio Filter** — dropdown to filter building list by portfolio
5. **Building List** — scrollable list of all buildings with completion indicators (✅/🟡/⚪) and stats (units | occupied | submissions | % complete)

### Main Content (when a building is selected)
1. **Building Header** — address, asset ID, portfolio, parking spots, Add Tenant / Export Vehicles buttons
2. **Status Bar** — Complete / Incomplete / Missing counts with readiness badge
3. **Stat Cards** — 4-card grid: Collection Complete, Needs Verification, Missing Submission, Occupancy Context
4. **Missing Submissions Panel** — red alert showing occupied units with no form submission, including tenant name/email/phone
5. **Parking Management Panel** — embedded component for parking spot allocation and additional vehicle request approvals
6. **Tenant Cards** — one card per submission showing:
   - Header with name, unit, verification status (vehicle ☑/☐, pet ☑/☐, insurance ☑/☐), edit button
   - Vehicle section: make/model/year/color/plate, signature status, review workflow buttons (Mark Ready → Review for Permit → Approved)
   - Additional vehicles section (if any)
   - Pet section: pet details, signature status
   - Insurance section: provider, policy number

### Modals
- **Signature Viewer** — displays captured signature images
- **Review for Permit** — admin selects their name, approves submission for permit issuance
- **Export Center** (`VehicleExportCenter`) — bulk CSV export of vehicle data per building with export tracking
- **Submission Edit** (`SubmissionEditModal`) — edit tenant info, vehicle details, insurance, upload pet/insurance documents
- **Add Tenant** (`AddTenantModal`) — manually create a submission for a building

---

## 4. API Routes (20 endpoints under `/api/admin/compliance/`)

| Route | Method | Purpose |
|-------|--------|---------|
| `building-summary` | GET | Fetch submissions + stats for a building |
| `building-summary` | PUT | Update verification status (vehicle/pet/insurance verified toggles) |
| `tenant-data` | GET | Fetch occupied units from `tenant_lookup` |
| `add-tenant` | POST | Create a manual submission |
| `attach-document` | POST | Upload document to Supabase Storage (pet addendum, vehicle addendum, insurance, ID photo, exemption) |
| `delete-document` | DELETE | Remove a document from storage |
| `download-documents-zip` | POST | Download all documents for a submission as ZIP |
| `mark-appfolio-upload` | POST | Mark a document as uploaded to AppFolio (pet/vehicle addendum, insurance) |
| `mark-fee-added` | POST | Mark a fee as loaded in AppFolio (pet rent, permit fee) with amount |
| `merge-submissions` | POST/PUT | Merge duplicate submissions or mark primary / dismiss |
| `permit` | POST | Issue a parking permit |
| `export-vehicles` | GET | CSV export of vehicle data for a building |
| `export-logs` | GET | Fetch export history |
| `toggle-export` | POST | Mark/unmark submissions as exported |
| `parking-availability` | GET | Parking spot analysis for a building |
| `approve-additional-vehicle` | POST | Approve additional vehicle request |
| `deny-additional-vehicle` | POST | Deny additional vehicle request |
| `insurance-type` | POST | Update insurance type |
| `pet-receipt` | POST | Generate pet receipt |
| `vehicle-receipt` | POST | Generate vehicle receipt |
| `exemption-review` | POST | Review exemption documents |

---

## 5. What's Wrong — Why This Needs a Redesign

### Problem: It's a tenant-level detail viewer, not a project tracker
The page was built to review individual submissions one at a time. The primary workflow is: select building → scroll through tenant cards → click checkboxes → view signatures. This worked when onboarding was the project.

**But the actual job now is different.** Someone is told: *"Make sure every pet fee and vehicle fee is loaded for this building."* They need to:
1. See **at a glance** which tenants are done and which aren't — for a specific task (e.g., "pet addendum uploaded to AppFolio")
2. **Not** dig into individual cards to find that information
3. Handle this across **100+ tenants** across multiple buildings efficiently

### Specific UX Failures

- **No task-level views.** There's no way to say "show me everyone who has a pet but whose pet addendum hasn't been uploaded to AppFolio." The filters only cover has_vehicle/has_pets/has_insurance/needs_review — they don't cover the AppFolio upload or fee-loaded status at all.
- **Document review is buried.** To check if a document is uploaded, you have to open each tenant card individually. There's no summary table showing "Unit 1A: ✅ Vehicle Addendum, ❌ Pet Addendum, ✅ Insurance."
- **Signature focus is wrong.** The current detail view emphasizes whether a *signature* was captured. The new need is: *was the actual document generated, uploaded, and pushed to AppFolio?* Signatures are a form-completion detail, not an operational concern.
- **No bulk operations.** Can't mark multiple tenants as "fee loaded" at once. Each action is one-at-a-time.
- **Scale problem.** With 41 buildings and hundreds of tenants, the one-building-at-a-time card view doesn't let someone quickly sweep through a portfolio-level task.
- **Missing AppFolio tracking columns in the UI.** The database has `*_uploaded_to_appfolio` and `*_fee_added_to_appfolio` columns (with timestamps and who-did-it), but the main compliance page doesn't surface most of these. They exist in the `SubmissionEditModal` and some sub-components, but not in the primary view.

---

## 6. The Vision: Project Completion Tracker

### Core Concept
Rename/reconceptualize as a **"Project Status"** or **"Task Tracker"** page. The unit of work is not "review this tenant" — it's **"complete this task across this building (or portfolio)."**

### Example Tasks (Projects)
- "All pet addendums uploaded to AppFolio" → for each tenant with pets, is `pet_addendum_uploaded_to_appfolio = true`?
- "All vehicle fees loaded" → for each tenant with a vehicle, is `permit_fee_added_to_appfolio = true`?
- "All insurance documents on file" → for each tenant with insurance, is `insurance_file` non-null?
- "All missing submissions collected" → are there occupied units with no submission?

### What the New UX Should Enable

1. **Building-level task matrix.** For a selected building, show a table/grid: rows = units/tenants, columns = task statuses (document uploaded? fee loaded? addendum in AppFolio?). At a glance, see red/green for each cell.

2. **Portfolio-level rollup.** For a selected portfolio (or all), show each building as a row with completion percentages per task. "865 Broad St: 15/15 submissions, 12/15 pet addendums uploaded, 8/15 fees loaded." Click into a building to see the detail.

3. **Task-focused filtering.** Instead of "Has Vehicle" checkbox, the filter should be: "Show me everyone where pet addendum is NOT uploaded to AppFolio." This is the actionable view — it shows exactly what's left to do.

4. **Bulk actions.** Select multiple tenants → "Mark fee loaded" / "Mark document uploaded" with a single action. When someone is processing 30 tenants in a row, clicking one at a time is unacceptable.

5. **Document review without drilling in.** Show document status (exists / doesn't exist / uploaded to AppFolio) in the summary row. Allow viewing/downloading the actual document from the summary row without opening a modal.

6. **Multi-project support.** The page should not be hardcoded to "tenant onboarding." The building list, portfolio structure, and unit data already exist. A new "project" could be: annual insurance renewal, lease renewal document collection, etc. The task columns would change but the building→unit→tenant structure stays the same.

---

## 7. Key Data Already Available (No Schema Changes Needed for V1)

These columns already exist in `submissions` but aren't surfaced in the main compliance view:

| Column | What it tracks |
|--------|---------------|
| `pet_addendum_file` | Pet addendum document path in storage |
| `vehicle_addendum_file` | Vehicle addendum document path |
| `vehicle_addendum_file_uploaded_at` | When vehicle addendum was uploaded |
| `vehicle_addendum_file_uploaded_by` | Who uploaded it |
| `insurance_file` | Insurance document path |
| `pet_addendum_uploaded_to_appfolio` | Whether pet addendum was pushed to AppFolio |
| `pet_addendum_uploaded_to_appfolio_at` | Timestamp |
| `pet_addendum_uploaded_to_appfolio_by` | Who did it |
| `vehicle_addendum_uploaded_to_appfolio` | Whether vehicle addendum was pushed to AppFolio |
| `insurance_uploaded_to_appfolio` | Whether insurance was pushed to AppFolio |
| `pet_fee_added_to_appfolio` | Whether pet fee/rent was loaded |
| `pet_fee_amount` | Amount |
| `permit_fee_added_to_appfolio` | Whether permit fee was loaded |
| `permit_fee_amount` | Amount |
| `permit_issued` | Whether parking permit was issued |
| `permit_issued_at` / `permit_issued_by` | Metadata |
| `vehicle_exported` | Whether vehicle data was exported to CSV |
| `exemption_documents` | Array of exemption doc paths |
| `exemption_status` | pending / approved / denied |

---

## 8. Architectural Considerations

- **The page is 1,700 lines in a single client component.** This needs to be broken into sub-components regardless of redesign.
- **All building/unit/portfolio data is hardcoded in `/lib/` files.** This is fine for now (41 buildings don't change often) but a multi-project system would eventually need this in the database.
- **The `submissions` table is the single source of truth for everything.** There's no separate "tasks" or "projects" table. The current approach is: every column on `submissions` IS a task status. A multi-project redesign might need a `projects` table and a `project_tasks` table, or it might just be different views over the same `submissions` columns.
- **The tenant_lookup table provides occupancy data** (who lives where). This is what makes "missing submissions" possible. Any new project would need this same mapping to know "who should have done this but hasn't."
- **20 API routes** already exist for granular operations. Most can be reused. The main gap is a summary/matrix endpoint that returns task completion status per building in a single call rather than requiring the client to compute it.

---

## 9. Design System Constraints

- CSS custom properties for all colors (no hardcoded hex)
- `rounded-none` on all inputs and buttons
- Serif fonts (`Libre Baskerville`) for headers, `Inter` for body
- Institutional aesthetic — no vibrant colors, no animations beyond 200–300ms ease-out transitions
- Spacing from a defined scale
