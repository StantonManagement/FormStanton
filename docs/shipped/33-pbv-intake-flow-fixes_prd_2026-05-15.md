# PRD-33 — PBV Intake Flow Bug Fixes

**Date:** 2026-05-15
**Author:** Claude (live runtime audit + repo scan)
**Branch:** `fix/pbv-intake-flow-33`
**Status:** Shipped 2026-05-15. All 8 defects from audit resolved. F6 bucket hardcode updated to `form-submissions` per PRD-35 sweep findings.
**Source audit:** `tasks/PBV_INTAKE_AUDIT_2026-05-15.md`

---

## Problem Statement

A live walk of the tenant intake flow against token `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` surfaced six confirmed defects, all visible in the first two minutes of clicking through. Every prior audit missed all six because they read components in isolation rather than tracing the data path or running the app.

1. **Review summary shows `—` for every section** even when intake is complete and household data exists. Root cause: the bootstrap endpoint's `.select()` does not include `intake_data` from `pbv_full_applications`, so `useIntakeBootstrap` always returns `intake_data: {}`. Every page that reads it client-side (`SectionReview`, intake landing's `_resume_section` lookup) sees nothing.
2. **Header reads `"Section 8 of 7"` at the Review step.** `totalSections` excludes review from the denominator while `sectionNumber` overshoots it.
3. **Dashboard "Upload required documents → Start" navigates to a 404.** `TenantDashboard` pushes to `/pbv-full-app/[token]/documents`, which is not a route in the codebase.
4. **Dashboard "Review and sign your summary → Start" navigates to a 404.** `sign/summary/page.tsx` redirects to `/pbv-full-app` (un-tokenized) when `signing_status === 'not_started'`.
5. **Even with intake_data present, `buildSummary` only emits a one-line tagline per section.** Member names, DOBs, relationships, citizenship, disability, student, race, ethnicity, marital status, email, alt contact, income source breakdown, asset breakdown, expense detail — all captured by intake forms, none displayed in Review.
6. **Tenants cannot view, preview, or download documents they uploaded.** `TenantDocumentUpload` has no `view` button, no `file_url` field on its `Document` interface, and the `/documents` GET endpoint does not return signed URLs.

Plus two inferred defects worth fixing in the same PR series:

7. **`useSectionVisibility` derives age as `m.is_minor ? 10 : 30`** — hardcoded constants. Medical section (requires HOH/spouse 62+) can never appear from client-side visibility logic for elderly applicants.
8. **Edit-from-summary may lose the last <600ms of typing.** Navigation does not flush the autosave debounce.

This PRD is bug fixes only. Larger structural improvements (single-source-of-truth for intake_data, staff-side document viewer, tenant status, printable copy) are split into PRDs 34–37.

---

## Users & Roles

- **Tenant** — primary impact. Hits all six visible defects.
- **Office staff** — indirectly impacted; cannot trust that what tenant saw on the Review page matches what they signed.
- **Cascade / Windsurf** — implementer. Atomic commits per defect, regression checks at the end.

---

## Closed decisions (do not relitigate)

- F3 (documents 404): create a new `app/pbv-full-app/[token]/documents/page.tsx` route that mounts `TenantDocumentUpload`. The landing page is already 2,732 lines — do not add another phase to it.
- F6 (document view): view-only for V1. No download. View opens in a new tab. Reduces phishing/exfil surface; download can come later if requested.
- F4 (summary signing redirect): redirect to `/pbv-full-app/${token}/dashboard`, not just `/pbv-full-app/${token}`.
- F5 (full data summary): show only sections the tenant actually saw. If zero-income declaration was not rendered (because no zero-income adults), do not surface it in the summary.
- F8 (autosave race): keep the existing silent retry, add a `flushSave()` await before any `router.push` in the intake section page.

---

## Decisions resolved (Alex confirmed 2026-05-15)

- **F2 progress label at Review step**: render `"Review"` (qualitative).
- **F6 image preview**: open in new tab for parity with PDFs.
- **F5 truncation**: render full — no truncation, no expander.

---

## Core Features

### F1: Bootstrap returns `intake_data`

- File: `app/api/t/[token]/pbv-full-app/route.ts:31-33` — add `intake_data` to the `.select(...)` for `pbv_full_applications`.
- Same file, response object (~line 263): add `intake_data: app.intake_data ?? {}` to the returned `data`.
- Acceptance: GET `/api/t/<token>/pbv-full-app` returns the JSONB object from the DB row, not `{}`.

### F2: Progress label correct at Review step

- File: `app/pbv-full-app/[token]/intake/[section]/page.tsx:142` — pass an `isReviewSection` flag to `IntakeShell`.
- File: `components/pbv/intake/IntakeShell.tsx:80-91` — branch the progress label on the new prop. At review, render the chosen label (see open decision). Progress bar fills to 100% at review.
- Acceptance: header at `/intake/review` never reads `Section N of M` where N > M.

### F3: Documents dashboard route

- Create `app/pbv-full-app/[token]/documents/page.tsx`. Mount `TenantDocumentUpload` with token, language, and a "Back to dashboard" link. Pattern off `app/pbv-full-app/[token]/dashboard/page.tsx`.
- File: `components/pbv/sign/TenantDashboard.tsx:191` — onAction already pushes to the right URL, so no change needed once the route exists.
- Acceptance: clicking Start on the Upload card from the dashboard renders the upload UI, no 404.

### F4: Summary signing redirect uses tokenized path

- File: `app/pbv-full-app/[token]/sign/summary/page.tsx:55` — change `router.push('/pbv-full-app')` to `router.push(\`/pbv-full-app/${token}/dashboard\`)`.
- Sweep: grep `router\.push\(['"\`]/pbv-full-app['"\`/]` and audit all hits for the same un-tokenized bug.
- Acceptance: navigating to `/pbv-full-app/<token>/sign/summary` when `signing_status === 'not_started'` redirects back to that token's dashboard, not a 404.

### F5: Rebuild `buildSummary` with full field data

- File: `components/pbv/intake/SectionReview.tsx:88-188` — replace `summary: string` with `summary: ReactNode`. Render structured per-section blocks. Required content per section listed in audit report (`tasks/PBV_INTAKE_AUDIT_2026-05-15.md` defect #5).
- Render only sections that appear in `useSectionVisibility(intakeData)`. Skip sections the tenant didn't see.
- All new labels must follow the existing `copy[language]` pattern in the same file. Translate to es and pt; mark pt translations `// PT: tentative — review` per existing convention.
- Acceptance: on a token with full intake data populated, every value the tenant entered appears somewhere on the rendered Review page.

### F6: Tenant document view capability

- File: `components/pbv/TenantDocumentUpload.tsx:13-26` — add `file_url?: string` to the `Document` interface.
- File: `app/api/t/[token]/pbv-full-app/documents/route.ts` GET handler — for each document with status in (`submitted`, `approved`, `rejected`), generate a signed URL with `supabase.storage.from('form-submissions').createSignedUrl(path, 300)` (5 min TTL). Return as `file_url` per document. **NOTE:** All `application_documents` for PBV are written to the `form-submissions` bucket (verified by codebase sweep 2026-05-15). Earlier draft said `submissions` — that was wrong. PRD-35 will swap this hardcode to use `resolveBucket()`.
- File: `components/pbv/TenantDocumentUpload.tsx` doc row render block — add a "View" button next to the existing "Replace" button when `file_url` is present. `<a target="_blank" rel="noopener">View</a>`.
- Translate "View" / "Ver" / "Visualizar" in the `translations` map.
- Acceptance: after a tenant uploads a PDF or image, a "View" button appears next to "Replace" and opens the file in a new tab.

### F7: Real age in `useSectionVisibility`

- File: `lib/pbv/hooks/useSectionVisibility.ts:32` — replace `age: m.is_minor ? 10 : 30` with computed age from `m.dob`.
- Extract the existing `computeAge` from `app/api/t/[token]/pbv-full-app/route.ts:10-21` to `lib/pbv/age.ts`. Both client and server import from there.
- Acceptance: a household with HOH DOB making them 62+ shows the medical section. A household with all members aged 18-61 with no disability does not.

### F8: Flush autosave before navigation

- File: `app/pbv-full-app/[token]/intake/[section]/page.tsx` — `useSectionAutoSave` already exposes `saveNow`. Wire it so `handleNext`, `handleBack`, the Edit links from `SectionReview`, and the language switcher all call `await saveNow()` before `router.push`.
- During the await, disable the navigation button (no double-clicks). If the save fails, surface a one-line error and do not navigate.
- Acceptance: type a change, click Next within 600ms, navigate, navigate back. The change is present.

---

## Data Model

No schema changes in this PRD. PRD-34 handles the schema work for the snapshot pattern.

---

## Integration Points

- Bootstrap GET `/api/t/[token]/pbv-full-app` — F1
- Documents GET `/api/t/[token]/pbv-full-app/documents` — F6
- Supabase storage `submissions` bucket — F6 needs `createSignedUrl`. Service role required.
- All client components reading `intake_data` — F1 unblocks them all

---

## Implementation Phases

**Phase 1 — Same-day deploy (small, high-leverage)**
- F1, F2, F3, F4 — each one PR, atomic commit
- Manual regression walk after merge

**Phase 2 — User-trust fixes (1–2 days)**
- F5 (full data summary)
- F6 (tenant document view)
- F7 (real age)
- F8 (flush autosave)
- Regression walk on combined Phase 1 + 2

---

## Acceptance — what "done" looks like

End-to-end: a fresh test token can be walked from `/pbv-full-app/<token>` through every intake section, into Review (showing every entered value), submitted, into the dashboard (no 404s on any Start button), with documents uploaded (and viewable via the new View button).

The audit prompt at `tasks/PBV_INTAKE_AUDIT_PROMPT.md` should pass on a Phase 2 build — no defects in the runtime walk.
