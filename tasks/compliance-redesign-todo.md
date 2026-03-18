# Compliance Page Redesign — Phase 1 Implementation Checklist

## Bug Fixes
- [x] Fix `mark-fee-added` API rejecting $0 amounts — changed `!amount` to explicit null check, `parsedAmount <= 0` to `parsedAmount < 0`

## New API
- [x] `GET /api/admin/compliance/building-matrix?building=<address>` — returns one row per unit with all AppFolio columns, joins submissions + tenant_lookup server-side, computes aggregate stats

## New Types
- [x] `types/compliance.ts` — `MatrixRow`, `BuildingMatrixResponse`, `BuildingMatrixStats`, `CellState`

## New Components (`components/compliance/`)
- [x] `BuildingHeader.tsx` — address, asset ID, portfolio, parking, stat pills
- [x] `ComplianceTabs.tsx` — Tenants | Parking | Duplicates | Missing tabs with badge counts
- [x] `BuildingMatrixTable.tsx` — one row per unit, all AppFolio task columns
- [x] `MatrixDocumentCell.tsx` — download / upload / mark-uploaded / done states
- [x] `MatrixFeeCell.tsx` — click-to-enter fee amount / done states with audit hover
- [x] `MatrixStatusCell.tsx` — generic done/pending cell with audit tooltip
- [x] `FeeEntryPopover.tsx` — inline $ input with Mark Loaded button, $0 is valid
- [x] `TenantSidePanel.tsx` — right-side slide panel with full submission detail, AppFolio status summary, vehicle/pet/insurance sections, signature viewer, document viewer
- [x] `index.ts` — barrel export

## Page Integration
- [x] Replace 1,898-line card-based tenant section with tabbed table + side panel
- [x] Kept: sidebar, portfolio stats, building selection, quick lookup, keyboard shortcuts
- [x] Kept: Export Center, Add Tenant, Edit Submission modals
- [x] Added: matrix fetch on building change, tab state, side panel state
- [x] Page reduced from 1,898 lines to ~620 lines

## Design System Compliance
- [x] `rounded-none` on all inputs, buttons, table cells
- [x] CSS custom properties for all colors — no hardcoded hex
- [x] `font-serif` for headers (Libre Baskerville)
- [x] `font-sans` for body (Inter, default)
- [x] Transitions: 200ms ease-out
- [x] Horizontal scroll wrapper on table for narrow viewports
- [x] Hover tooltips on done cells show audit trail (who + when)

---

## Not Built (Phase 2 / 3)
- [ ] Portfolio-level table view
- [ ] Bulk actions / multi-select
- [ ] Column-level filters ("show only incomplete")
- [ ] "Needs attention" sort
- [ ] Download all documents as ZIP from table

---

## Review Notes

### What was built
Building-level table view replacing the card-per-tenant layout. One row per unit shows all AppFolio task statuses (document uploads, fee loading, permit status) as first-class cells. Inline fee entry via popover allows $0. Document cells handle download and upload directly from the row. Tenant side panel replaces drilling into modals for detail. Existing panels (Parking, Duplicates, Missing) moved to tabs.

### What was skipped
- The original page had inline verification toggles (vehicle_verified, pet_verified, insurance_verified) inside each card. The table shows these as read-only states; verification still happens through the existing `building-summary` PUT endpoint. The side panel provides edit access.
- The original page had a review-for-permit workflow with buttons inside cards. This is preserved in the side panel but not surfaced as a table column (could be Phase 2).
- Signature viewing is in the side panel, not the table.

### Decisions not in the PRD
1. **Matrix API filters out `merged_into` submissions** — only shows primary/unmerged submissions to avoid duplicate rows.
2. **Vacant units (no tenant in lookup, no submission) are excluded** from the matrix. Only occupied-but-missing and submitted units appear.
3. **Side panel fetches submission from `allSubmissions` state** rather than making a separate API call, since the data is already loaded. This could change if the page moves to per-building-only fetching in Phase 2.
4. **Unit sorting**: numeric ascending, retail/commercial units sorted to the bottom.
