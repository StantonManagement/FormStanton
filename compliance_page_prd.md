# Project Status Page — PRD
## `/admin/compliance` Redesign

**Status:** Draft  
**Phase this covers:** AppFolio sweep (current) + permit workflow (winding down) + collection (complete)  
**Last updated:** March 2026

---

## Problem Statement

The compliance page was built for form collection — reviewing individual submissions one at a time. That phase is largely done. The work now is operational: someone opens a building, works down a list, downloads documents, uploads them to AppFolio, loads fees, checks them off. The current card-per-tenant layout doesn't support this. Documents are buried in modals. AppFolio tracking columns exist in the database but aren't visible. There's no way to see at a glance how complete a building is across the tasks that actually matter right now.

The page also needs to serve the permit workflow that's still in progress — not replace it, just not bury it.

---

## Users & Roles

- **Admin running the AppFolio sweep** — works through a building's tenants, downloads each document, uploads to AppFolio, marks fee loaded. Needs a row-per-tenant table, document accessible from the row, and a fast check-off action.
- **Admin checking building status** — looks at the portfolio view, identifies which buildings are behind, clicks in to see detail. Needs percentage-complete readouts per task column.
- **Admin doing permit workflow** — still needs the review-for-permit flow, permit issued tracking, and parking management panel. These don't go away.

---

## Three-Level Hierarchy

### Level 1 — Portfolio View (default landing)

A table where each row is a building. Columns show completion percentages across the current project's key tasks. This is the "wow, no one has done this building" view.

**Columns:**
| Building | Submissions | Permits Issued | Vehicle Doc → AppFolio | Pet Doc → AppFolio | Insurance → AppFolio | Pet Fees Loaded | Permit Fees Loaded |
|----------|-------------|----------------|------------------------|--------------------|-----------------------|-----------------|-------------------|
| 31-33 Park St | 12/14 | 10/12 | 8/10 | 4/6 | 9/12 | 3/6 | 7/10 |

- Each cell is a fraction + color indicator (green ≥ 90%, yellow 50–89%, red < 50%)
- Click a building row → Building View
- Portfolio dropdown still exists to filter by portfolio
- A "needs attention" sort brings the most incomplete buildings to the top

---

### Level 2 — Building View

Selected building. One row per unit/tenant. This is the working view for the AppFolio sweep.

**Table columns (phase-aware — current phase is AppFolio sweep):**

| Unit | Tenant | Vehicle Doc | Pet Doc | Insurance | Pet Fee | Permit Fee | Permit |
|------|--------|-------------|---------|-----------|---------|------------|--------|
| 1A | Rodriguez, M | ⬇ Upload | ✅ $25 | ✅ | — | ✅ $50 | ✅ |
| 1B | [No submission] | — | — | — | — | — | — |
| 2A | Santos, J | ✅ | ⬇ Upload | ⬇ Upload | ⬇ $0 | ✅ $50 | ✅ |

**Cell states:**
- `—` = not applicable (tenant has no vehicle, no pets, etc.)
- `⬇ Upload` = document exists, not yet uploaded to AppFolio → clicking downloads the document
- `✅ $50` = marked done, fee amount recorded, shows on hover: who marked it + timestamp
- `⬇ $0` = applicable but fee not loaded → click opens inline input to enter amount and mark done
- `[No submission]` = occupied unit with no form — highlighted red

**Row interactions:**
- Click document cell → downloads the PDF directly (no modal)
- Click fee cell → inline popover: enter amount → "Mark Loaded" button → saves and flips to ✅
- Click tenant name → expands to full detail view (current card content) inline or as a side panel
- Checkbox on left → multi-select for bulk actions

**Bulk actions (when rows selected):**
- Mark permit fee loaded (prompts for amount, applies to all selected)
- Mark pet fee loaded (prompts for amount, applies to all selected)
- Download all selected documents as ZIP

**Above the table:**
- Building header: address, asset ID, portfolio, parking spot count
- 5 stat pills: Submissions complete | Permits issued | Docs uploaded | Fees loaded | Missing units
- Filter bar: "Show only incomplete" toggle per column (e.g., "Only: Pet fee not loaded")
- Tabs: **Tenants** (default) | **Parking** | **Duplicates** | **Missing**

**Tabs:**
- **Parking** — existing parking management panel, unchanged
- **Duplicates** — existing duplicate detection, unchanged  
- **Missing** — existing missing submissions panel (occupied units with no submission), unchanged

---

### Level 3 — Tenant Detail

Accessed by clicking a tenant name in the building table. Opens as a side panel (not a new page, not a modal that hides the table).

Contains the current card content:
- Full submission details
- Signature viewer
- Review for permit / mark picked up workflow
- Document upload (attach document)
- AppFolio upload toggles with history (who marked it, when)
- Edit submission link

This is unchanged functionally. The change is that you only open it when you need it — the table row handles 90% of the operational workflow without drilling in.

---

## What Stays, What Changes, What's New

### Stays (functionally unchanged)
- Review for permit workflow (Mark Ready → Review for Permit → Approved)
- Permit issued / picked up tracking
- Parking management panel
- Duplicate detection
- Missing submissions panel
- Add Tenant modal
- Export Center (CSV)
- Submission edit modal
- Quick tenant lookup (Ctrl+K)

### Changes
- **Main tenant view:** Cards → Table. Cards become the side panel detail.
- **AppFolio columns:** Surface `*_uploaded_to_appfolio` and `*_fee_added_to_appfolio` columns as first-class table columns, not buried in edit modal.
- **Document access:** Download from table row directly, not from inside a modal.
- **Building list:** Moves into the portfolio-level table. Sidebar building list stays for quick navigation but portfolio table becomes the default landing.
- **Filters:** Add task-completion filters ("Pet doc not uploaded", "Permit fee not loaded") alongside existing has_vehicle/has_pets filters.

### New
- **Portfolio-level table** with per-column completion percentages
- **Inline fee entry** (popover from table cell, not a separate modal)
- **Multi-select + bulk actions**
- **"Show only incomplete" column filters**
- **Side panel** for tenant detail (replaces full-screen modal pattern)
- **Matrix summary API endpoint** — returns one row per unit with all task statuses computed server-side, so the table doesn't have to compute it client-side from full submission objects

---

## Data Model — No Schema Changes for V1

All the data already exists. The work is surfacing it.

**Columns being promoted to first-class UI:**

| DB Column | What it tracks | Current UI location |
|-----------|---------------|-------------------|
| `pet_addendum_uploaded_to_appfolio` | Pet doc pushed | Edit modal only |
| `pet_addendum_uploaded_to_appfolio_at/by` | When/who | Edit modal only |
| `vehicle_addendum_uploaded_to_appfolio` | Vehicle doc pushed | Edit modal only |
| `insurance_uploaded_to_appfolio` | Insurance pushed | Edit modal only |
| `pet_fee_added_to_appfolio` | Pet fee loaded | Edit modal only |
| `pet_fee_amount` | Fee amount | Edit modal only |
| `permit_fee_added_to_appfolio` | Permit fee loaded | Edit modal only |
| `permit_fee_amount` | Fee amount | Edit modal only |
| `permit_issued` | Permit issued | Tenant card |
| `vehicle_addendum_file` | Doc path | Edit modal |
| `pet_addendum_file` | Doc path | Edit modal |
| `insurance_file` | Doc path | Edit modal |

---

## New API Endpoint Needed

**`GET /api/admin/compliance/building-matrix`**

Params: `building_address`

Returns one object per unit:
```json
{
  "unit": "1A",
  "submission_id": "uuid",
  "full_name": "Maria Rodriguez",
  "has_vehicle": true,
  "has_pets": false,
  "has_insurance": true,
  "vehicle_addendum_file": "path/to/file.pdf",
  "vehicle_addendum_uploaded_to_appfolio": false,
  "pet_addendum_uploaded_to_appfolio": null,
  "insurance_uploaded_to_appfolio": true,
  "pet_fee_added_to_appfolio": null,
  "pet_fee_amount": null,
  "permit_fee_added_to_appfolio": true,
  "permit_fee_amount": 50,
  "permit_issued": true,
  "missing": false
}
```

Missing units (occupied, no submission) return a row with `missing: true` and nulls for everything else.

This replaces the current pattern where `building-summary` returns full submission objects and the client computes everything.

---

## Implementation Phases

### Phase 1 — Building table view (highest value, ship first)
- Replace tenant cards with the row-per-unit table
- Surface AppFolio columns as table cells
- Download document from row (no modal)
- Inline fee entry popover
- Tenant detail as side panel
- Add the matrix API endpoint

### Phase 2 — Portfolio view
- Portfolio-level table with per-column completion percentages
- "Needs attention" sort
- Per-column color indicators

### Phase 3 — Bulk actions + filters
- Multi-select rows
- Bulk mark fee loaded
- Bulk download ZIP
- Column-level "show only incomplete" filters

---

## Design Constraints

- `rounded-none` on all inputs, buttons, cells
- CSS custom properties for all colors — no hardcoded hex
- `Libre Baskerville` for headers, `Inter` for body
- Institutional — no animations beyond 200–300ms ease-out
- Table must be horizontally scrollable on smaller screens without breaking layout
- ✅ / ⬇ / — cell states must be readable without color alone (for accessibility)
- Hover states on ✅ cells must show who marked it and when — this is the audit trail surfaced passively

---

## Resolved Decisions

1. **Fee entry — $0 is valid.** Emotional support animals, fee waivers, and no-charge situations are real. No validation forcing a non-zero amount. The field just needs to be filled (including $0) to mark done. A $0 entry means "loaded, waived" — still counts as complete.

2. **Document cells handle both directions.** If no document exists → cell shows upload action. If document exists → cell shows download. Both from the table row without opening the edit modal. The existing `attach-document` API handles upload; the existing storage URL handles download. No new API needed for this.

3. **Branch strategy — separate branch, permit workflow stays live.** Phase 1 is built in a dedicated branch (`compliance-redesign` or similar). The current `/admin/compliance` page stays untouched in `main` until Phase 1 is fully tested. When Windsurf starts, the first instruction is: audit the live codebase, work in a new branch, do not modify the existing compliance page component until the new table view is ready to replace it.

