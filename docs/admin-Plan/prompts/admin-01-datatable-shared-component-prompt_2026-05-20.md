# Windsurf Build Prompt — admin-01 Phase 1: Build Shared DataTable Component

You are building from `docs/admin-Plan/admin-01-datatable-shared-component-prd_2026-05-20.md`. **Read it before doing anything.** The PRD is the contract; this prompt is the working sequence.

**This prompt covers Phase 1 ONLY** — building the `<DataTable>` component, its types, hooks, cell helpers, toolbar pieces, tests, a demo page, and the a11y pass. **No page retrofits in this PR.** Pre-Apps (Phase 2), Pipeline (Phase 3), Form Submissions (Phase 4), and the remaining seven pages get their own prompts after Phase 1 ships and Alex confirms the component holds up.

Build robustly the first time. No "Phase 1.5," no `// TODO: add a11y later`, no shortcuts. If you hit a problem, solve it; don't park it. The PRD spells out every flag, every URL param shape, every type signature — match them.

---

## Branch and base

- Base off `main` at `7200a25` or later.
- Branch: `feat/admin-datatable-component-01-phase1`
- **Never push to `dev` or `main` directly.** Open the PR Ready for Review (not Draft) once all verification gates pass.
- Final merge target: `main`.

---

## Shell protocol

See `docs/SHELL-PROTOCOL.md`.

PRD-specific deviations:
- `npm install @tanstack/react-table --save --no-audit --no-fund` is the only new top-level install. Explicit timeout 120s, single retry with `--prefer-offline` if hung.
- Verify `@tanstack/react-table` v8.x lands and is React 19 compatible at install time. If `npm install` warns about peer-dep mismatches with React 19, stop and report — do not silence the warning, do not downgrade React.
- **For type-checking, use `node ./node_modules/typescript/bin/tsc --noEmit`, NEVER `npx tsc`.** The npx layer hangs on Windows. This is non-negotiable per `feedback_shell_protocol_reference`.

---

## Files to create

| File | Purpose |
|---|---|
| `components/admin/DataTable/DataTable.tsx` | Main component. Imports TanStack `useReactTable`, wires every flag in the PRD's `DataTableProps<TRow>` type. |
| `components/admin/DataTable/types.ts` | Exports `ColumnDef<TRow>`, `DataTableProps<TRow>`, `DataTableState`. Match PRD §Component API exactly. |
| `components/admin/DataTable/useUrlState.ts` | Hook: serializes table state ↔ URL params under `urlNamespace`. Param shape from PRD §URL-State Contract. Uses Next.js `useSearchParams` + `useRouter`. Reads URL on mount, writes on state change (debounced 150ms to avoid history spam). |
| `components/admin/DataTable/useColumnPersistence.ts` | Hook: column visibility + ordering persisted to localStorage under `datatable.<urlNamespace>.cols` and `datatable.<urlNamespace>.pageSize`. URL wins over localStorage on load. |
| `components/admin/DataTable/toolbar/GlobalSearch.tsx` | Debounced 200ms search input. |
| `components/admin/DataTable/toolbar/ColumnVisibilityMenu.tsx` | Popover with checkboxes for show/hide. Uses `@dnd-kit/sortable` for reorder. |
| `components/admin/DataTable/toolbar/CsvExportButton.tsx` | Exports currently-visible rows respecting filters + sort + column visibility. Filename `<namespace>-<YYYY-MM-DD>.csv`. Honors per-column `csvValue` override (see §CSV note below). |
| `components/admin/DataTable/toolbar/BulkActionBar.tsx` | Sticky bar appears when selection ≥1. Renders parent-supplied actions. |
| `components/admin/DataTable/toolbar/PaginationControls.tsx` | Page-size dropdown (25/50/100/All), prev/next, "M–N of total" counter. |
| `components/admin/DataTable/cells/DateCell.tsx` | Format a date column consistently. |
| `components/admin/DataTable/cells/BadgeCell.tsx` | Status pill with color variants. |
| `components/admin/DataTable/cells/MoneyCell.tsx` | Currency, right-aligned. |
| `components/admin/DataTable/cells/MonoCell.tsx` | Monospace font (plates, IDs). |
| `components/admin/DataTable/cells/AvatarStackCell.tsx` | Stacked avatar circles with overflow count. |
| `components/admin/DataTable/filters/TextFilter.tsx` | Substring filter UI in a popover under column header. |
| `components/admin/DataTable/filters/SelectFilter.tsx` | Single or multi-select enum filter. Takes options from `column.meta.filter.options`. |
| `components/admin/DataTable/filters/DateRangeFilter.tsx` | From/to filter UI. |
| `components/admin/DataTable/index.ts` | Public barrel — exports `DataTable`, types, cell helpers. |
| `components/admin/DataTable/__tests__/DataTable.test.tsx` | Vitest unit tests (see §Test coverage below). |
| `components/admin/DataTable/__tests__/useUrlState.test.ts` | URL round-trip tests. |
| `app/admin/_datatable-demo/page.tsx` | Admin-gated demo page exercising every feature flag combination. **Removed in Phase 6 cleanup, not now.** |

---

## Files NOT to touch in Phase 1

- Any existing `app/admin/**/page.tsx` — those are Phase 2+ retrofits. Phase 1 is component-only.
- Any `app/hach/**` — out of scope (admin-02 follow-on).
- Any `app/api/**` route.
- Any migration.
- Any `components/pbv/**` — different domain.
- Any HACH-facing surface.

If you think a fix is needed outside `components/admin/DataTable/` (and the demo page + tests), **stop and ask.**

---

## API contract — match the PRD exactly

The PRD §Component API spells out the `ColumnDef<TRow>` and `DataTableProps<TRow>` shapes in full TypeScript. Match those signatures. If TanStack Table requires a different internal shape for column definitions, **wrap it** — the PRD's `ColumnDef<TRow>` is the public surface; map to TanStack's `ColumnDef` internally.

Specifically:
- `meta.filter` discriminated union — `text`, `select` (with `multi?: boolean`), `dateRange`. Add the runtime filter behavior to TanStack via `filterFn` mapped from `meta.filter.type`.
- `getRowId` is **required** — selection stability across re-sorts depends on it. No fallback to row index.
- `urlNamespace` is **required** even if `enableUrlState: false`. localStorage keys still need namespacing.
- `manualPagination`/`manualFiltering`/`manualSorting` flags pass through to TanStack's `manual*` options. When manual mode is on, the component does NOT process those operations client-side — parent supplies pre-processed data and `pageCount`.

---

## CSV export — handle formatted cells

CSV must export raw values, not rendered JSX. Each column may optionally provide:

```ts
{
  id: "status",
  accessorKey: "status",
  cell: ({ row }) => <BadgeCell value={row.status} variant={statusVariant(row.status)} />,
  meta: {
    csvValue: (row) => row.status,  // raw string for CSV
  }
}
```

If `csvValue` is not provided, CSV export falls back to `String(accessorKey value)`. Document this in the demo page with at least one column showing both rendered and CSV-exported value.

---

## URL-state contract

Match PRD §URL-State Contract exactly:

```
?<ns>.search=foo
&<ns>.sort=col1:desc,col2:asc
&<ns>.filter.<colId>=value
&<ns>.page=2
&<ns>.pageSize=50
&<ns>.cols=name,status,assignees
```

- Multi-value select filters serialize as comma-separated values: `?preapps.filter.status=qualified,needs-review`
- Date-range filters serialize as `from:to` ISO dates: `?preapps.filter.created_at=2026-01-01:2026-05-20`
- Page reset on filter change — when a filter changes, reset `<ns>.page=1` automatically.
- URL update is debounced 150ms to avoid one history entry per keystroke.
- `useUrlState` reads URL on mount once, writes on state change. No re-reads on URL change from external nav unless `urlNamespace` query params actually changed (compare param keys).

---

## A11y requirements (non-deferrable)

- Table root has `role="grid"` (TanStack does not set this — add it).
- Sortable headers: `aria-sort="ascending|descending|none"`, change announced via header content.
- Filter popovers: focus trap when open, escape closes, return focus to trigger.
- Bulk action bar: appears with `aria-live="polite"` announcing selection count.
- Row selection checkbox header: `aria-label="Select all rows"`; row checkboxes: `aria-label="Select row <id>"`.
- Pagination buttons: descriptive `aria-label` ("Previous page", "Next page", "Page 2 of 14").
- Loading state: `aria-busy="true"` on table root; skeleton rows have `aria-hidden="true"`.
- Keyboard: Tab navigates filters; Enter in filter popover applies; arrow keys move focus between rows (Down/Up); Space toggles row selection when row has focus.

If a TanStack pattern conflicts with one of these, **the a11y requirement wins** — work around the library.

---

## Demo page (`app/admin/_datatable-demo/page.tsx`)

Admin-gated (use existing admin auth pattern from `app/admin/users/page.tsx`). Renders three demo tables side-by-side or stacked:

1. **Minimal table** — 5 columns, no filters, no selection, no pagination. Proves the "small list" case (users, properties).
2. **Full-featured table** — 10 columns, all filters, all features enabled, including bulk actions and CSV export with `csvValue` overrides. Proves the complex case (form-submissions, pre-apps).
3. **Manual-mode table** — `manualPagination: true`, `pageCount` from a fixed dataset, simulates server-paginated audit log. Proves the manual flow.

Demo data is generated inline (no API calls, no Supabase). Each table uses a distinct `urlNamespace` (`demo-minimal`, `demo-full`, `demo-manual`) so URL params don't collide.

This page is **kept through Phases 2–5** for regression testing, removed in Phase 6.

---

## Test coverage (Vitest)

`__tests__/DataTable.test.tsx` covers:

1. Renders rows from `data` prop.
2. Sort: clicking header toggles asc → desc → none.
3. Sort: multi-column sort via shift-click adds secondary sort.
4. Global search filters rows.
5. Per-column text filter narrows rows.
6. Per-column select filter (multi) narrows rows.
7. Per-column date-range filter narrows rows.
8. Column visibility menu hides a column; rendered HTML loses that column.
9. Column reorder via drag changes display order (mock dnd-kit drag).
10. Row selection: clicking checkbox marks row; `onSelectionChange` fires with selected rows.
11. Bulk action bar appears on selection, disappears on deselect.
12. Bulk action click calls handler with selected rows.
13. Pagination: page-size change resizes; prev/next moves page; "All" shows all rows.
14. Manual mode: `manualPagination` prevents client-side pagination; `pageCount` honored.
15. Empty state renders when `data: []`.
16. Loading state renders skeletons when `loading: true`.
17. Expanded row renderer renders below the selected row.
18. CSV export downloads a file with the right name and respects `csvValue` overrides (mock `URL.createObjectURL`).

`__tests__/useUrlState.test.ts` covers:

1. Reads initial state from URL on mount.
2. Writes state to URL on change (debounced).
3. Round-trip: state → URL → state preserves values.
4. Page resets to 1 on filter change.
5. Multi-value filters serialize as comma-separated.
6. Date-range serializes as `from:to`.
7. `urlNamespace: "foo"` namespaces all params with `foo.` prefix.
8. Param collisions between two namespaces don't bleed.

---

## Step-by-step

### Step 0 — Read and align

1. Read `docs/admin-Plan/admin-01-datatable-shared-component-prd_2026-05-20.md` in full.
2. Read `app/admin/pbv/preapps/page.tsx` and `app/admin/pbv/pipeline/page.tsx` — these are the two pages the demo data should mirror in shape, so the component is provably general. **Do not modify them.**
3. Read `app/admin/users/page.tsx` for the admin auth gating pattern.
4. Confirm `@dnd-kit/core` and `@dnd-kit/sortable` are in `package.json` (they are — used by other parts of the app).

### Step 1 — Install + types

```sh
npm install @tanstack/react-table --save --no-audit --no-fund
node ./node_modules/typescript/bin/tsc --noEmit
```

Both must exit 0. Create `components/admin/DataTable/types.ts` first — every other file imports from it.

### Step 2 — Core component + URL state

Build `DataTable.tsx`, `useUrlState.ts`, `useColumnPersistence.ts`. Get a bare render working (no filters, no selection) against the demo page's minimal table. `tsc` clean.

### Step 3 — Toolbar pieces

Build all `toolbar/*.tsx` files. Wire global search, column visibility, bulk action bar, pagination, CSV export.

### Step 4 — Filters + cells

Build all `filters/*.tsx` and `cells/*.tsx`. Wire per-column filter UIs to TanStack's `filterFn` via `meta.filter.type` mapping.

### Step 5 — Demo page

Build `app/admin/_datatable-demo/page.tsx` with the three demo tables. Manually exercise every feature in dev. Run through the a11y checklist with keyboard only.

### Step 6 — Tests

Write the Vitest tests listed in §Test coverage. All must pass.

### Step 7 — Verification gates

Run, in order, until all green:

```sh
node ./node_modules/typescript/bin/tsc --noEmit
npm run lint
npm run test
npm run build
```

If any gate fails, **fix the root cause**. Do not skip the test, do not add a TS ignore, do not relax a type. The PRD says build robustly.

### Step 8 — Build report

Write `docs/build-reports/admin-01-datatable-shared-component-build-report_<YYYY-MM-DD>.md` with:

- All gates green (paste exit codes).
- Bundle size delta from `npm run build` output (compare against pre-install baseline).
- List of every file created.
- Any TanStack quirks you worked around (a11y patches, type wrapping).
- A11y manual-test notes (which keyboard paths you actually walked).
- Open questions for Alex (e.g., demo data shape — should it move to fixtures, can the toolbar slot be exposed for Phase 4's tabs).

---

## Verification gates (must all pass before PR)

1. `node ./node_modules/typescript/bin/tsc --noEmit` exits 0.
2. `npm run lint` exits 0.
3. `npm run test` — every new test passes, no existing test breaks.
4. `npm run build` exits 0. Bundle size delta under 25KB gzipped for the route bundle (TanStack + component).
5. Demo page loads on `npm run dev` at `/admin/_datatable-demo` (after admin login). Every feature flag combination works.
6. Keyboard-only walkthrough on the demo page: can sort, filter, select rows, trigger bulk actions, change pages, export CSV, all without a mouse.
7. URL state round-trip: load demo page, apply filters and sort, copy URL, paste into a new tab, table renders with same state.
8. localStorage column persistence: hide a column, reload, column still hidden (only when URL param absent).
9. No `console.error` or `console.warn` from the demo page in dev or in the test suite.
10. No existing admin page renders differently — diff `app/admin/**/page.tsx` against `main`, expect zero changes.

---

## What success looks like

- Component is callable from any admin page with a column config and data, and immediately gets sort + filters + visibility + selection + URL state + CSV.
- Demo page passes the a11y walkthrough.
- All 10 gates green.
- Build report posted to `docs/build-reports/`.
- PR opened against `main`, Ready for Review.

Phase 2 (Pre-Apps retrofit) waits on Alex's review of the merged Phase 1.

---

## Open questions you may surface (don't block on these)

These are spelled out in PRD §Open Questions. Resolve in code with the recommended default; flag in the build report for Alex to confirm or push back.

1. `cols` URL param encodes **visible** columns (recommended) — confirm in build report.
2. Cross-page bulk selection in manual mode: bulk actions operate on **current-page selection only** — document in component JSDoc.
3. Toolbar layout: built-in toolbar, page wraps with its own controls. Phase 4 may surface a need for `toolbarSlot`; if so, add then, not now.
