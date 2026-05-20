# Windsurf Build Prompt — admin-01 Retrofit Sweep: Migrate All 11 Admin Tables

You are building from `docs/admin-Plan/admin-01-datatable-shared-component-prd_2026-05-20.md`. **Read it before doing anything.** The PRD is the contract; this prompt is the working sequence for the retrofit sweep.

**This prompt covers Phases 2 through 6** of the PRD — every Stanton admin list page migrated to `<DataTable>`, demo page removed, Lighthouse comparison done. **Phase 1 (build the component) must already be merged to `main`** before you start this sweep. If the `<DataTable>` exports are not on `main`, stop and confirm with Alex.

Build robustly the first time. No "ship this page, retrofit the next one next week," no `// TODO: wire CSV later`, no shortcuts. The PRD §Decisions Locked In is the contract — match every column shape, every cell renderer, every existing behavior. New capabilities (sort, per-column filters, column visibility, CSV export, URL state) come for free from the component; do not skip wiring them.

The user has explicitly directed: build it all in one sweep, not phased over weeks. Honor that.

---

## Branch and base

- **Base:** `main` after Phase 1 merge. Verify `components/admin/DataTable/index.ts` exists and exports `DataTable`, `ColumnDef`, etc. If not, stop.
- **Branch:** `feat/admin-datatable-01-retrofit-sweep`
- **Never push to `dev` or `main` directly.** Open the PR Ready for Review once all gates pass.
- **One PR**, but **commits are phase-aligned** so the diff is reviewable page-by-page. Commit message format: `admin-01: retrofit <page-name> to DataTable`.

---

## Shell protocol

See `docs/SHELL-PROTOCOL.md`. **For type-checking, use `node ./node_modules/typescript/bin/tsc --noEmit`, NEVER `npx tsc`.** No new top-level dependencies (TanStack already installed in Phase 1).

---

## Pages to retrofit (and their order)

Order is deliberate: easiest cases first to warm up the column-config pattern, complex cases last when you know the component's quirks.

| # | Page | Complexity | Special notes |
|---|---|---|---|
| 1 | `app/admin/pbv/appfolio-queue/page.tsx` | Trivial | Read-only, no filters today. Add sort + global search + CSV. |
| 2 | `app/admin/properties/page.tsx` | Low | Preserve config-gap status badge. |
| 3 | `app/admin/projects/page.tsx` | Low | Preserve hover-delete, status badge, % complete color coding. |
| 4 | `app/admin/users/page.tsx` | Low | Preserve view-as button, role pills, activate/deactivate toggle. |
| 5 | `app/admin/reimbursements/page.tsx` | Medium | Existing sort UI replaced. Preserve currency formatting, delete confirm modal. |
| 6 | `app/admin/pbv/full-applications/page.tsx` | Medium | Preserve unread-doc badge (red count in name column), assignee avatar stack, copy-link button, modal for "New Invitation." |
| 7 | `app/admin/tow-list/page.tsx` | Medium-high | **Three DataTable instances** on one page. Namespaces: `tow-auto`, `tow-permit`, `tow-manual`. Preserve all three section toolbars and the existing "+ Add to Tow List" + Export CSV controls. |
| 8 | `app/admin/audit-log/page.tsx` | Medium-high | **Manual mode** — `manualPagination: true`, `manualFiltering: true`. Preserve expanded-row JSON detail panel via `expandedRowRenderer`. |
| 9 | `app/admin/pbv/preapps/page.tsx` | High | Tess's daily page. Preserve side panel + approve/send chain + duplicate detection badges + missing-contact-info badges. |
| 10 | `app/admin/pbv/pipeline/page.tsx` | High | **Breaks existing shareable filter URLs** — see §Pipeline URL break below. Preserve sticky bulk action bar (assign-to), inline assignee dropdown, stale-row coloring (amber >14d, red >30d), income icon. |
| 11 | `app/admin/form-submissions/page.tsx` | Highest | Quick-view tabs (All / Needs Action / Approved (Not Sent) / Ready for Appfolio / Waiting on Tenant) stay **above** the DataTable as their own component — each tab sets a different filter set on the table. Bulk actions (assign, mark sent to Appfolio, export ZIP if per_document, delete) become `bulkActions` prop. |

After all 11 are retrofitted: **delete `app/admin/_datatable-demo/page.tsx`** and run a Lighthouse comparison.

---

## Files NOT to touch in this sweep

- Any `app/hach/**` — out of scope (admin-02 follow-on).
- Any `app/api/**` route. If you think a page change requires an API change, stop and ask.
- Any migration.
- Any HACH-facing surface.
- Any form-rendering surface (`components/form/**`, `components/pbv/**`) — those are review/intake surfaces, not list pages.
- Print pages — static layouts.
- Compliance tables (`BuildingMatrixTable`, `PortfolioTable`) — distinct, separate effort.
- `components/admin/DataTable/**` — Phase 1's deliverable; if you find a bug, fix it surgically and note in the build report.

If you think a fix is needed outside `app/admin/**/page.tsx` (and the demo page deletion), **stop and ask.**

---

## Per-page work pattern (apply this to every page)

1. Read the current `page.tsx` in full.
2. Identify: the row shape (TypeScript type), the data source (Supabase query, server action, etc.), every column rendered, every filter/search UI, every row action (click → modal, navigate, dropdown), every bulk action.
3. Build a `columns: ColumnDef<TRow>[]` array using `components/admin/DataTable` cell helpers (`BadgeCell`, `DateCell`, `MoneyCell`, `MonoCell`, `AvatarStackCell`) where they fit. Custom inline cells where they don't.
4. For each existing filter input (dropdown, text box, date range), convert to a column with `enableFiltering: true` and `meta.filter: { type: 'select'|'text'|'dateRange', options? }`.
5. For each column that exports as a formatted cell (badge, avatar stack), set `meta.csvValue` to the raw string. CSV must not export JSX.
6. Replace the `<table>...</table>` block with `<DataTable data={rows} columns={columns} urlNamespace="<page-namespace>" getRowId={(r) => r.id} ...flags />`.
7. Wire existing row-click behavior via `onRowClick`. Wire existing bulk actions via `bulkActions` prop.
8. Wire `expandedRowRenderer` if the page has expandable detail rows.
9. Delete per-page state code that's now redundant (filter `useState`s, sort `useState`s, pagination state, search debouncing). Be aggressive — leftover state code is a code-smell vector.
10. **Verify the existing behavior survives:** every action that worked before works now. Every badge color, every modal open, every dropdown, every bulk handler. Run dev locally and click everything.
11. New capabilities should be present and usable: sort headers, column visibility menu, CSV export button. If they aren't visible, your column config is wrong.

---

## URL namespace per page

| Page | `urlNamespace` |
|---|---|
| Pre-apps | `preapps` |
| Pipeline | `pipeline` |
| Full-applications | `full-apps` |
| Form-submissions | `form-submissions` |
| Audit log | `audit-log` |
| Reimbursements | `reimbursements` |
| Users | `users` |
| Properties | `properties` |
| Projects | `projects` |
| AppFolio queue | `appfolio-queue` |
| Tow list (3 tables) | `tow-auto`, `tow-permit`, `tow-manual` |

---

## Pipeline URL break — explicit handling

`app/admin/pbv/pipeline/page.tsx` currently syncs filters as raw query params: `?building=128-main&stage=docs-incoming&blocked=missing-income&assignee=tess&hasRejections=1`. These shareable links exist in team channels and email history.

After this retrofit they become: `?pipeline.search=…&pipeline.filter.building=128-main&pipeline.filter.stage=docs-incoming&pipeline.filter.blocked=missing-income&pipeline.filter.assignee=tess&pipeline.filter.has_rejections=true`.

**Old links will load the page with no filters applied.** Rows still render. No 404, no error — just unfiltered.

**You must:**
- Add a clear "Breaking change — Pipeline URL filters" section to the PR description with the old → new shape mapping above.
- Add the same section to the build report.
- Do NOT write a redirect/adapter for the old shape — the PRD decided against it (decision 3). Long-term consistency over backward-compat is the call.

---

## Form Submissions complexity — explicit handling

This is the most intricate page. Treat the migration carefully:

- **Quick-view tabs** (All / Needs Action / Approved (Not Sent) / Ready for Appfolio / Waiting on Tenant) stay as their own component **above** the DataTable. Tabs are not built into DataTable. Each tab, when clicked, applies a fixed filter set to the DataTable via column-state-setter callbacks (TanStack exposes these from `useReactTable`).
- **Tab counts** continue to render from the unfiltered data, not the currently-filtered table state.
- **Global search** wires to `enableGlobalSearch={true}` and supplements the search behavior already present.
- **Bulk actions** (assign dropdown, mark sent to AppFolio, export ZIP if `review_granularity === 'per_document'`, delete) all become `bulkActions` prop items. The conditional ZIP export logic stays — pass `disabled: !canExport` or similar per item.
- **Modal open on row click** — preserve via `onRowClick={(row) => setQuickViewRow(row)}`.

---

## Audit Log manual mode — explicit handling

`app/admin/audit-log/page.tsx` already paginates server-side at 50 per page. Keep that.

- `manualPagination: true`, `manualFiltering: true`, `manualSorting: true`.
- Pass `pageCount` from the server response.
- Hook `onStateChange` to fire the existing fetch with `{ page, pageSize, filters, sort }` mapped to the existing API params.
- `expandedRowRenderer={(row) => <ExpandedDetails entry={row} />}` — keep the existing JSON-pretty-print panel.

---

## Step-by-step

### Step 0 — Confirm Phase 1 is on main

```sh
ls components/admin/DataTable/index.ts
grep "export.*DataTable" components/admin/DataTable/index.ts
```

If either fails: stop, alert Alex.

### Step 1 — Retrofit pages in order

Work through pages 1–11 in the table above. **One commit per page.** Each commit:

1. Modifies only that one `page.tsx` (and any closely-coupled component file that page imports).
2. Passes `node ./node_modules/typescript/bin/tsc --noEmit` clean.
3. Passes `npm run build` clean.
4. Manually smoke-tested in `npm run dev`: every existing behavior preserved, new sort/filter/visibility/CSV visible.

If a commit's gates don't pass, **fix before moving on.** Don't accumulate broken commits.

### Step 2 — Delete demo page

```sh
rm app/admin/_datatable-demo/page.tsx
```

Commit: `admin-01: remove DataTable demo page after retrofit sweep`.

### Step 3 — Lighthouse comparison

For pre-apps, pipeline, and form-submissions:

1. Check out `main` (before the sweep), run dev, capture Lighthouse Performance + Best Practices + Accessibility scores.
2. Check out this branch, run dev, capture the same scores.
3. Diff in the build report.

Numbers should be the same or better. If Performance drops by more than 5 points on any of the three pages, flag in build report — do not block PR but call out clearly.

### Step 4 — Final verification gates

```sh
node ./node_modules/typescript/bin/tsc --noEmit
npm run lint
npm run test
npm run build
```

All four exit 0.

### Step 5 — Build report

Write `docs/build-reports/admin-01-datatable-shared-component-retrofit-sweep-build-report_<YYYY-MM-DD>.md` with:

- Gate results (paste exit codes).
- Bundle size delta vs pre-sweep `main` (route-level for each retrofitted page).
- Lighthouse before/after for pre-apps, pipeline, form-submissions.
- **"Pipeline URL break" callout** — the old → new shape mapping, restated.
- Per-page notes: any column-config quirks, any cell rendering that needed a custom `cell` function not covered by the shared helpers, any TanStack edge cases.
- A11y manual-test notes for pre-apps, pipeline, form-submissions (keyboard-only walk).
- Open questions for Alex: list any column that you weren't sure should be visible-by-default, any filter you weren't sure should be opt-in.

---

## Final verification gates (must all pass before PR)

1. `node ./node_modules/typescript/bin/tsc --noEmit` exits 0.
2. `npm run lint` exits 0.
3. `npm run test` — no existing test breaks. (You won't add new tests in this sweep; the Phase 1 tests cover the component.)
4. `npm run build` exits 0.
5. Each of the 11 retrofitted pages loads in dev, every existing button/dropdown/modal still works, every existing badge/color/avatar renders identically.
6. Sort, per-column filter, column visibility, and CSV export work on every page.
7. URL state survives copy-paste-into-new-tab on at least pre-apps, pipeline, and form-submissions.
8. Pipeline old query params no longer take effect (acknowledged break) — confirm by visiting `/admin/pbv/pipeline?building=foo` and observing no filter applied.
9. Demo page is gone — `ls app/admin/_datatable-demo` returns "No such file."
10. Lighthouse Performance on pre-apps, pipeline, form-submissions did not drop more than 5 points.
11. Bundle size delta across all routes under 25KB gzipped (compared to pre-sweep `main`).

---

## What success looks like

- All 11 Stanton admin tables on the shared component.
- Every existing behavior preserved.
- Sort, filter, visibility, CSV export available on every page.
- Pipeline URL break clearly documented.
- Demo page gone.
- Lighthouse comparison in the build report.
- Single PR opened against `main`, Ready for Review, 12 phase-aligned commits.

After merge: admin-02 (HACH migration) becomes the next prompt.

---

## Reminders

- HACH pages out of scope. Do not touch `app/hach/**`.
- Print pages and form-rendering surfaces out of scope.
- No new dependencies.
- No API changes.
- No migrations.
- If any one page's retrofit feels like it needs a component change, surgically fix the component, note in build report, keep moving.
- Build robustly the first time. The user does not want a Phase 7 cleanup PR — finish this sweep clean.
