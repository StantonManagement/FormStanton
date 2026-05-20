# admin-01 — Shared Admin DataTable Component

**Status:** Draft, awaiting Alex sign-off before build prompt
**Author:** Cowork (Alex)
**Date:** 2026-05-20
**Feature group:** `admin` — first PRD in the group; lives in `docs/admin-Plan/`, parallel to `fullApp-Plan/` (PBV work)
**Related:** PBV-51 (in flight, no overlap), PBV-52 (in flight, no overlap)
**Out of scope, queued as follow-on:** `admin-02` — HACH admin tables migration

---

## Problem Statement

11 Stanton admin list pages render data with raw `<table>` markup. There is no shared table component. Each page reimplements its own filters, badge cells, modal opening, bulk-action bars, and (in one case) URL-state sync. Behavior is inconsistent — some have sort, some don't; some have global search, some don't; some paginate, most don't; column show/hide and CSV export exist nowhere.

This costs us in three ways:

1. **Inconsistent UX** for Tess and Kristine, who move between pre-apps, pipeline, and form submissions hourly. Filter UIs work differently, sort exists on some pages and not others, no muscle memory carries over.
2. **No leverage on improvements** — adding "filter by date range" to one page doesn't help any other page. Every new feature is N implementations.
3. **Performance ceiling** — most pages render every row to the DOM. As pre-apps and form-submissions grow into hundreds of rows, table rendering will hitch.

A shared `<DataTable>` component built on TanStack Table (headless, ~14KB, React-19 compatible) solves all three. Filters, sort, column visibility, column reorder, row selection with bulk actions, URL-state, and CSV export become column-config flags, not bespoke code.

## Users & Roles

Direct users:

- **Tess** — primary daily user of pre-apps, pipeline, full-applications. Needs filter persistence (URL-state) so back-nav from a detail page restores the table view she was looking at.
- **Kristine** — same as Tess, also heavy form-submissions user. The tabs + bulk actions on form-submissions are load-bearing for her workflow.
- **Alex / Dan** — occasional users of users, properties, audit log, reimbursements. Need consistent UI, less than they need raw power.

Indirect:

- **HACH** — not a user of this PRD's pages. HACH admin pages (audit log, users) are out of scope here, migrated separately in PRD-54.

## Decisions Locked In

| # | Decision | Rationale |
|---|---|---|
| 1 | **TanStack Table (headless)** as the engine | Industry standard, ~14KB, headless so it stays on existing Tailwind styling. Sort, filter, pagination, column-visibility, row-selection all native. React 19 compatible. |
| 2 | **HACH pages out of scope** (deferred to PRD-54) | HACH-visible surfaces are higher risk; ship Stanton-side and prove the pattern in production first. China Wall posture supports separate rollout. |
| 3 | **URL-state contract: standardize** (`?<namespace>.search=&<namespace>.sort=col:dir&<namespace>.filter.<col>=…`) | Pipeline's existing shareable filter links will break on migration. Acknowledged. Long-term consistency outweighs the recoverable break. |
| 4 | **Default pagination: 50 rows, "show all" toggle available** | Render-everything is the current default but doesn't scale. 50 matches the audit log convention already in place. |
| 5 | **Custom cell renderers stay** | Every existing badge, avatar stack, status pill, mono font, color-coded action gets a `cell` render function on the column def. Not promising to flatten them. |
| 6 | **Client-side default, manual mode for large datasets** | Audit logs already paginate server-side and stay that way (`manualPagination`, `manualFiltering` flags). Other pages start client-side. PRD does not promise to convert any page to server-side as part of this work. |

## Core Features (component-level)

The component exposes these features as flags on a config object. Every page picks the subset it needs.

- **Sort** — per-column sortable header with up/down/none state. Multi-column sort via shift-click. Sortable opt-in per column.
- **Global search** — single input above the table, debounced 200ms, fuzzy match across all string columns.
- **Per-column filters** — declared per column via `meta.filter`. Three filter types in v1: `text` (substring), `select` (single or multi enum, options provided), `dateRange` (from/to). Filter UI appears in a popover under the column header.
- **Column visibility (show/hide)** — toggle menu in the toolbar, persisted in URL + localStorage (URL wins on load).
- **Column reorder** — drag handles in the column visibility menu, powered by `@dnd-kit` (already in deps). Order persists alongside visibility.
- **Row selection** — checkbox column, select-all in header. Selection state surfaces to parent via `onSelectionChange`.
- **Bulk action bar** — sticky bar appears when ≥1 row selected, renders parent-supplied action buttons. Drops on deselect.
- **Pagination** — page-size dropdown (25/50/100/All), prev/next, "M–N of total" counter. Default page size 50, "All" available for small lists.
- **URL-state sync** — namespaced query params (`?<ns>.search=&<ns>.sort=&<ns>.filter.<col>=&<ns>.page=&<ns>.cols=`). Required prop `urlNamespace` per page.
- **CSV export** — toolbar button, exports currently-visible rows respecting current filters/sort/columns. Filename: `<namespace>-<YYYY-MM-DD>.csv`.
- **Row click handler** — `onRowClick(row)` parent callback, no behavior baked in (page decides modal vs. drawer vs. nav).
- **Expanded row renderer** — `expandedRowRenderer(row) => ReactNode` for audit-log-style detail panels.
- **Empty state** — parent-supplied `emptyState` node, falls back to a generic "No results."
- **Loading state** — `loading` prop renders skeleton rows matching column shape.

## Component API (proposed)

```tsx
type ColumnDef<TRow> = {
  id: string;
  accessorKey?: keyof TRow | string;
  header: string | (() => ReactNode);
  cell?: (ctx: { row: TRow; value: unknown }) => ReactNode;
  enableSorting?: boolean;       // default true
  enableHiding?: boolean;        // default true
  enableFiltering?: boolean;     // default false; set true + provide meta.filter
  meta?: {
    filter?:
      | { type: "text" }
      | { type: "select"; options: Array<{ label: string; value: string }>; multi?: boolean }
      | { type: "dateRange" };
    align?: "left" | "right" | "center";
    className?: string;
  };
};

type DataTableProps<TRow> = {
  data: TRow[];
  columns: ColumnDef<TRow>[];
  urlNamespace: string;                       // required, drives URL param prefix
  getRowId: (row: TRow) => string;            // required for selection stability

  // feature flags (all default true except where noted)
  enableSorting?: boolean;
  enableGlobalSearch?: boolean;
  enableColumnFilters?: boolean;
  enableColumnVisibility?: boolean;
  enableColumnOrdering?: boolean;
  enableRowSelection?: boolean;               // default false
  enablePagination?: boolean | { pageSize: number };  // default { pageSize: 50 }
  enableUrlState?: boolean;                   // default true
  enableCsvExport?: boolean;                  // default true

  // interactions
  onRowClick?: (row: TRow) => void;
  onSelectionChange?: (rows: TRow[]) => void;
  bulkActions?: Array<{ label: string; onClick: (rows: TRow[]) => void; variant?: "default" | "danger" }>;
  expandedRowRenderer?: (row: TRow) => ReactNode;

  // manual mode (for server-paginated tables like audit log)
  manualPagination?: boolean;
  manualFiltering?: boolean;
  manualSorting?: boolean;
  pageCount?: number;
  onStateChange?: (state: DataTableState) => void;

  // states
  loading?: boolean;
  emptyState?: ReactNode;
};
```

## URL-State Contract

Every table with `enableUrlState=true` syncs these params to the URL:

```
?<ns>.search=foo
&<ns>.sort=created_at:desc,name:asc
&<ns>.filter.status=qualified
&<ns>.filter.building=128-main
&<ns>.page=2
&<ns>.pageSize=50
&<ns>.cols=name,status,assignees                   // visible columns, comma-sep, in display order
```

Two tables on the same page (e.g., Tow List has three sections) use distinct namespaces so they don't collide: `tow-auto`, `tow-permit`, `tow-manual`.

**Pipeline migration note:** Pipeline currently uses `?building=&stage=&blocked=&assignee=&hasRejections=`. After migration these become `?pipeline.filter.building=…` etc. Old shareable links lose their filters (rows still load fine). A one-time announcement in the team channel covers this; no code path catches the old shape.

## Data Model

No schema changes. This is a presentation layer change.

The component is generic over `TRow`. Each page passes its existing row shape and column accessors.

localStorage keys used (URL takes precedence on load):
- `datatable.<urlNamespace>.cols` — JSON array of visible-column ids in order
- `datatable.<urlNamespace>.pageSize` — number

## Integration Points

- **Existing files touched, Phase 1** (build component): new files only, no existing-file modifications.
- **Phase 2+** (retrofits): each page swaps its `<table>` for `<DataTable>` with a column config. Modals and drawers stay where they are — only the table swaps. Row click handlers wire to existing modal/drawer state.
- **`@dnd-kit/core` + `@dnd-kit/sortable`** — already in deps, used for column reorder.
- **Lucide icons** — already in deps, used for sort/filter/menu glyphs.
- **No new top-level deps except `@tanstack/react-table`** (current version: 8.x).

## Implementation Phases

### Phase 1 — Build component + types + tests
**Branch:** `feat/admin-datatable-component-53-phase1`
**Deliverables:**
- `components/admin/DataTable/DataTable.tsx` (main component)
- `components/admin/DataTable/types.ts` (exported types)
- `components/admin/DataTable/useUrlState.ts` (URL ↔ table state hook)
- `components/admin/DataTable/cells/` (shared cell helpers — DateCell, BadgeCell, MoneyCell, MonoCell, AvatarStackCell)
- `components/admin/DataTable/toolbar/` (GlobalSearch, ColumnVisibilityMenu, CsvExportButton, BulkActionBar)
- Vitest unit tests covering: sort, filter, pagination, URL round-trip, selection, column visibility persistence
- A Storybook-free demo page at `app/admin/_datatable-demo/page.tsx` (admin-gated, removed before final merge)

**Acceptance gates:**
- `tsc --noEmit` clean
- `npm run build` clean
- Unit tests green
- Keyboard navigation: tab through filters, enter to apply, arrow keys to navigate rows
- A11y: ARIA `role="grid"`, sortable headers announce direction, selected row count announced in live region
- Manual smoke on demo page covers every flag combination listed in "Core Features"

### Phase 2 — Retrofit Pre-Applications (proof of pattern)
**Branch:** `feat/admin-datatable-preapps-53-phase2`
**Why first:** Tess's daily page, mid-complexity (has filters today, no bulk actions, no sort), high feedback signal.
**Deliverables:**
- `app/admin/pbv/preapps/page.tsx` swaps to DataTable
- Column config preserves: Unit, HoH Name, HH Size, Total Income, Limit, Result badge, Review badge, Submitted
- Existing filter dropdowns (qualification, review, building) become column filters
- Side panel and approve/send chain untouched
- `urlNamespace: "preapps"`

**Acceptance gates:**
- All current behavior preserved (filter, click-to-open panel, approve & send chain)
- New behavior: per-column sort, global search, column show/hide, CSV export
- tsc + build clean
- Visual regression: side-by-side with `main` shows no layout drift outside the table itself
- Tess + Kristine walk it on Vercel preview before merge

### Phase 3 — Retrofit Pipeline (URL-state migration test)
**Branch:** `feat/admin-datatable-pipeline-53-phase3`
**Why now:** has URL-state today, has bulk actions, has inline assignee dropdown. Proves the bulk-action and URL-state contracts under real load.
**Deliverables:**
- `app/admin/pbv/pipeline/page.tsx` swaps to DataTable
- Sticky bulk action bar (assign-to, cancel) becomes `bulkActions` prop
- Inline assignee dropdown stays in the cell renderer
- `urlNamespace: "pipeline"` — **breaks old shareable URLs** (acknowledged)
- Stale-row coloring (amber >14d, red >30d) stays in cell renderer

**Acceptance gates:**
- All current behavior preserved (multi-select, bulk assign, stale row colors)
- Filter URL params change shape, no `?building=` etc. anymore
- Team channel announcement drafted ready to post on merge

### Phase 4 — Retrofit Form Submissions (highest complexity)
**Branch:** `feat/admin-datatable-form-submissions-53-phase4`
**Why now:** most complex page (quick-view tabs with counts, bulk actions, sort, global search). If DataTable can host this page cleanly, the component is proven.
**Deliverables:**
- `app/admin/form-submissions/page.tsx` swaps to DataTable
- Quick-view tabs (All, Needs Action, Approved (Not Sent), Ready for Appfolio, Waiting on Tenant) stay above the table as their own component, each setting a different filter set on the table
- Bulk actions (assign, mark sent, export ZIP, delete) become `bulkActions` prop
- `urlNamespace: "form-submissions"`

**Acceptance gates:**
- All current behavior preserved (tabs, counts, bulk actions, modal open)
- New: per-column filters supplement global search

### Phase 5 — Retrofit remaining Stanton admin pages
**Branch per page** (or grouped 2–3 at a time if Windsurf prefers):
- `app/admin/pbv/full-applications/page.tsx` — preserve unread doc badge, assignee avatars, copy-link button
- `app/admin/audit-log/page.tsx` — uses `manualPagination`, `manualFiltering` (server-paginated), preserves expanded-row JSON panel
- `app/admin/reimbursements/page.tsx` — preserve currency formatting, delete confirm modal
- `app/admin/users/page.tsx` — preserve view-as button, role pills
- `app/admin/properties/page.tsx` — preserve config-gap badge
- `app/admin/projects/page.tsx` — preserve hover-delete, status badge, % complete coloring
- `app/admin/pbv/appfolio-queue/page.tsx` — read-only, simplest case
- `app/admin/tow-list/page.tsx` — three DataTable instances (`tow-auto`, `tow-permit`, `tow-manual`), preserve all three section toolbars and the existing CSV export

**Acceptance gates per page:**
- All current behavior preserved
- tsc + build clean
- Quick smoke on Vercel preview

### Phase 6 — Cleanup
**Branch:** `chore/admin-datatable-cleanup-53`
**Deliverables:**
- Remove `app/admin/_datatable-demo/page.tsx`
- Remove any unused per-page filter state code left behind
- Lighthouse run on pre-apps + pipeline + form-submissions, capture before/after numbers for the build report

## Known Risks

1. **Pipeline URL break** — acknowledged in decision 3. Mitigated by team channel post on merge. No code-level mitigation.
2. **TanStack Table v8 + React 19** — v8.x is React 19 compatible per their changelog; if the actual install reveals issues, Windsurf flags and we revisit before Phase 2.
3. **Column reorder via @dnd-kit inside a TanStack table** — known-good pattern, examples in TanStack docs.
4. **Form Submissions complexity** — tabs + bulk + filters interacting could surface a TanStack API edge case. If Phase 4 stalls more than a day, ship Phases 1–3 first and re-scope Phase 4 separately.
5. **CSV export of formatted cells** — CSV should export raw values, not the rendered JSX. Each column may need a `csvValue` override on top of `cell`. Spelled out in component API but flag for Windsurf to surface examples in the demo page.

## Open Questions

| # | Question | Why it matters | Owner |
|---|---|---|---|
| 1 | Should `cols` URL param encode hidden columns or visible columns? | Affects URL shape. Recommend visible+ordered (clearer intent, shorter when most columns shown). | Alex confirm |
| 2 | Should bulk actions disable when row data is server-paginated and selection spans pages? | TanStack handles cross-page selection but bulk actions on rows not in memory are awkward. Likely just: bulk actions only operate on current-page selection, document clearly. | Resolve in Phase 1 build |
| 3 | Should the DataTable own its own toolbar layout, or accept a `toolbarSlot` prop for custom controls (e.g., Form Submissions' tabs)? | Decision affects Phase 4 integration. Recommend: toolbar is built-in, page wraps DataTable with its own controls above. | Confirm in Phase 1 build |

## Out of Scope

- HACH admin tables (`/hach/admin/audit-log`, `/hach/admin/users`) — deferred to PRD-54.
- Form panels (`components/form/PerDocumentReviewPanel.tsx`, etc.) — these are review surfaces, not list pages.
- Print pages — static layouts, no interactivity needed.
- Compliance tables (`BuildingMatrixTable`, `PortfolioTable`) — distinct rendering needs, separate effort.
- Server-side conversion of any currently-client page — explicitly not promised.
- Theme variant for HACH (covered in PRD-54).

## Success Metrics

- Tess and Kristine confirm pre-apps + pipeline + form-submissions feel "the same or better" after retrofit (qualitative, 1-week post-merge check-in).
- Zero regressions reported on bulk actions, modal open behavior, or filter behavior.
- Lighthouse Performance score on pre-apps and form-submissions does not drop by more than 5 points; ideally improves on large lists.
- Bundle size delta < 25KB gzipped (TanStack ~14KB + component code ~10KB).

## Rollback

- Each retrofit phase ships on its own feature branch and merges independently. Revert is `git revert <merge-commit>`.
- Component itself (Phase 1) lives in `components/admin/DataTable/` — leaving it in tree on a revert is harmless.
- localStorage keys are namespaced; orphan keys are inert.
