# Build Report: Admin DataTable Retrofit Sweep
**Date:** 2026-05-20  
**Scope:** Replace manual table implementations across 11 admin pages with the shared `<DataTable>` component.

---

## Summary

All 11 pages retrofitted. TypeScript clean. Build passes. No new top-level dependencies introduced. No API or schema changes made.

---

## Per-Page Checklist

| Page | Route | Namespace | Preserved Behaviors | New Capabilities |
|---|---|---|---|---|
| AppFolio Queue | `/admin/pbv/appfolio-queue` | `appfolio-queue` | Status badges, unit/tenant display | Sorting, CSV export, column visibility |
| Properties | `/admin/properties` | `properties` | Config gap detection, addenda count | Sorting, CSV export, column visibility |
| Projects | `/admin/projects` | `projects` | Create/delete modals, completion % | Sorting, CSV export, row click |
| Users | `/admin/users` | `users` | Role assignment, impersonation, modals | Sorting, global search, column visibility |
| Reimbursements | `/admin/reimbursements` | `reimbursements` | Delete confirmation flow | Sorting, global search, CSV export |
| PBV Full Applications | `/admin/pbv/full-applications` | `full-applications` | Invite modal, magic-link regen, status badges | Sorting, CSV export, column visibility |
| Tow List | `/admin/tow-list` | `tow-auto` / `tow-permit` / `tow-manual` | Three independent tables, add/confirm modals | Per-table sorting, CSV export |
| Audit Log | `/admin/audit-log` | `audit-log` | Expandable JSON rows, pagination | Manual sort/pagination preserved |
| PBV Pre-Apps | `/admin/pbv/preapps` | `preapps` | Detail drawer, approve/invite chain, qualification badges | Sorting, CSV export, column visibility |
| PBV Pipeline | `/admin/pbv/pipeline` | `pipeline` | Server-side filters, inline assign, bulk assign, stale-row borders, URL state, toast | Sorting, CSV export, column visibility, row selection via `onSelectionChange` |
| Form Submissions | `/admin/form-submissions` | `form-submissions` | Quick-view tabs, all filter selects, bulk assign/mark/delete/export ZIP, modal drawer | Sorting, global search, CSV export, column visibility |

---

## Architecture Notes

### DataTable URL State vs. Page URL State
Pages with **server-side filtering** (Pipeline, Pre-Apps) maintain their own URL query params via `router.replace`. The DataTable `urlNamespace` only serializes sorting, pagination, and column visibility — it does not collide with page-level filter params.

### Pipeline URL Contract
Existing API query params (`building`, `stage`, `blocked`, `has_rejections`, `assignee`) are unchanged. The DataTable namespace `pipeline.*` only covers TanStack internal state.

### Audit Log Manual Mode
Audit Log uses `manualPagination + manualSorting + manualFiltering` against `/api/admin/audit-log` with cursor-based pagination. `onStateChange` drives re-fetch.

### Tow List Multiple Tables
Three independent `<DataTable>` instances on one page, each with its own namespace (`tow-auto`, `tow-permit`, `tow-manual`), to avoid URL state collisions.

### TypeScript Casting
Supabase join results cast as `unknown as T` per project rules where joined relations cause overlap errors.

---

## Verification Log

| Gate | Result | Notes |
|---|---|---|
| `tsc --noEmit` | ✅ Exit 0 | No type errors |
| `npm run lint` | ⚠️ Skip | Pre-existing Windows path bug in `npx next lint` wrapper — unrelated to this work |
| `npm run test` | ⚠️ 52 failures / 771 pass | All failures in pre-existing unrelated suites: `useReviewKeyboardShortcuts`, `DocumentRow`, `signing-api`, `in-app-signature-capture-*`, `tenantApiCall`, `workspaces/client`, `pbv/age` — zero DataTable files in failing set |
| `npm run build` | ✅ Exit 0 | 207 pages compiled, no errors |

---

## Cleanup

- `app/admin/_datatable-demo/` — deleted (no inbound imports confirmed before removal)

---

## Known Follow-ups

- `npm run lint` wrapper bug: `npx next lint` treats `lint` as a directory argument on Windows. Needs fix in `package.json` script or a `.eslintrc` direct invocation alias. Unrelated to this sweep.
- Pre-existing test failures in `useReviewKeyboardShortcuts` and `DocumentRow` suites — separate investigation required.
