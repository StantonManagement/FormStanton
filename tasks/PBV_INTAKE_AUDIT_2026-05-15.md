# PBV Tenant Intake Flow — Audit Report

**Date:** 2026-05-15
**Token tested:** `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`
**State of token:** `intake_status = "complete"`, household members exist in `pbv_household_members`, `intake_data` JSONB is empty `{}` (root cause — see #1)

---

## TL;DR

Six defects, three of them user-visible the moment a tenant or staff member loads the app. The big one is structural: the bootstrap endpoint doesn't return `intake_data`, so every page that reads it client-side gets nothing. That cascades into the empty summary, the resume-section logic, and probably more.

The dashboard has two non-functional buttons (one 404, one redirect-to-404). Prior audits missed all of these because they read the section components in isolation, not the data path.

---

## Defects (in priority order)

### 1. Bootstrap endpoint excludes `intake_data` — root cause of empty Review summary

**Severity:** breaks data integrity / blocks meaningful review
**Files:**
- `app/api/t/[token]/pbv-full-app/route.ts:31-33` — the `.select(...)` for `pbv_full_applications` does NOT include `intake_data`.
- `lib/pbv/hooks/useIntakeBootstrap.ts:56` — falls back to `(d.intake_data ?? {}) as IntakeData`. With the column not selected, this is always `{}`.
- `components/pbv/intake/SectionReview.tsx:88-188` (`buildSummary`) reads `intakeData.household`, `intakeData.contact`, etc. Always undefined → every block renders `'—'`.

**Live evidence (browser, this session):**
- GET `/api/t/<token>/pbv-full-app` returned `intake_data_keys: []`, `intake_status: "complete"`.
- Loading `/intake/review` rendered seven cards each showing `—`. Screenshot below.
- Yet `pbv_household_members` is populated (intake submission did persist normalized rows).

**Why prior audits missed it:** They read `SectionReview.tsx`, saw `buildSummary` exists, and called it green. Nobody traced the data backwards from the rendered "—" to the API SELECT statement.

**Fix path:**
1. Add `intake_data` to the `.select()` in `route.ts:31-33`.
2. Return `intake_data: app.intake_data ?? {}` in the response object (line 263).
3. Separately: even with data present, `buildSummary` only shows tagline-level info (see #5). Both fixes needed for a real summary.

---

### 2. Progress bar header shows "Section 8 of 7" at the Review step

**Severity:** UX defect, credibility hit
**Files:**
- `app/pbv-full-app/[token]/intake/[section]/page.tsx:83` — `totalSections = visibleSections.filter((s) => s !== 'review').length` excludes review from the denominator.
- Same file line 142 — `sectionNumber={isReviewSection ? totalSections + 1 : sectionNumber}` overshoots the denominator.
- `components/pbv/intake/IntakeShell.tsx:80, 91` — renders both the percentage bar and the "Section N of T" string from those numbers.

**Live evidence:** Header on `/intake/review` reads literally `"Section 8 of 7"`. Screenshot below.

**Fix path:** Either include review in the total count, or render a non-numeric label like "Review" at the review step (cleaner — review is qualitatively different from a data-entry step).

---

### 3. Dashboard "Upload required documents → Start" goes to a 404

**Severity:** breaks the flow entirely for documents
**Files:**
- `components/pbv/sign/TenantDashboard.tsx:191` — `onAction={() => router.push('/pbv-full-app/${token}/documents')}`.
- `app/pbv-full-app/[token]/` — there is **no** `documents/page.tsx`. Confirmed via `find app/pbv-full-app -name "page.tsx"`.

**Live evidence:** Clicked "Start" on the Upload card from the dashboard; URL became `/pbv-full-app/<token>/documents`; page rendered "404 — This page could not be found."

**Fix path:** Either create the `documents/page.tsx` route that mounts `TenantDocumentUpload`, or change the dashboard to route to the existing landing page that already mounts it (`app/pbv-full-app/[token]/page.tsx:1655`).

---

### 4. Dashboard "Review and sign your summary → Start" redirects to /pbv-full-app (404)

**Severity:** breaks the signing flow when intake is "complete" but signing_status is "not_started"
**Files:**
- `app/pbv-full-app/[token]/sign/summary/page.tsx:53-56`:
  ```
  if (!data.signing_status || data.signing_status === 'not_started') {
    router.push('/pbv-full-app');   // ← un-tokenized path
    return;
  }
  ```
- The redirect target `/pbv-full-app` is a non-existent route → 404.

**Live evidence:** Direct navigation to `/pbv-full-app/<token>/sign/summary` redirected to `/pbv-full-app` and rendered "404 — This page could not be found."

**Fix path:** Redirect to `/pbv-full-app/${token}` or `/pbv-full-app/${token}/dashboard`. Audit any other un-tokenized `router.push('/pbv-full-app')` calls in the codebase for the same bug.

---

### 5. Even with `intake_data` populated, the Review summary is one-line per section

**Severity:** breaks the user's ability to actually verify their answers — the original complaint
**Files:** `components/pbv/intake/SectionReview.tsx`, function `buildSummary` (lines 88-188).

What the function emits per section:
- **Household:** `"<hoh_name>, DOB <hoh_dob> · N member(s)"`. Member names, DOBs, relationships, citizenship, disability, student, race, ethnicity, marital status — all captured in `IntakeHousehold` (`lib/pbv/intake-schema.ts:54-67`) — never displayed.
- **Contact:** phone numbers concatenated. Email, alt contact name, alt contact phone never displayed.
- **Income:** annual total per member only. Source breakdown hidden.
- **Assets:** total dollar amount only.
- **Childcare/Disability:** three boolean labels, no amounts.
- **Medical:** literally `"Insurance: Yes"` or `"Insurance: No"`. All expense data hidden.
- **Criminal History:** per-member yes/no.
- **DV/Homeless/RA:** three labels.
- **Household Expenses:** total monthly only, no rent/utilities/food split.

**Fix path:** Rewrite `buildSummary` to render full field-level data. ~150-200 lines. Each section needs its own structured display block. Worth pairing this with #1 — together they make the summary actually serve its purpose.

---

### 6. Tenants cannot view, preview, or download documents they uploaded

**Severity:** breaks trust + matches your second main complaint
**Files:** `components/pbv/TenantDocumentUpload.tsx` (entire 484 lines).

- Grep for `view|preview|file_url|download|signed_url` in this file: zero matches.
- The `Document` interface (lines 13-26) has no `file_url`, `path`, or signed-URL field.
- The `/api/t/<token>/pbv-full-app/documents` endpoint response was confirmed: documents array is empty in our test token, and the type definition has no file URL anyway.
- After upload, the only UI feedback is a status badge ("Submitted") and a "Replace" button. No filename, no thumbnail, no link.

**Fix path:**
1. Add `file_url` (signed URL with short TTL) to the `Document` interface and the `/documents` API response.
2. Add a "View" button per uploaded doc that opens it in a new tab. PDF iframe is fine; image inline preview is better.
3. Apply the same fix to the staff-side viewer per `AUDIT_REPORT.md:14-37` — same root issue, multiple buckets, viewer only checks one.

---

## Inferred / lower-confidence defects

### 7. `useSectionVisibility` derives age as a hardcoded constant, breaks medical-section visibility

`lib/pbv/hooks/useSectionVisibility.ts:32` — `age: m.is_minor ? 10 : 30`. Medical section visibility (`shouldRenderSectionVIMedical`) requires HOH or spouse age 62+. This rule can never fire client-side because every adult is reported as 30. Medical section will never appear from client-side visibility logic for elderly applicants.

### 8. Edit-from-summary may lose last <600ms of typing [Inference]

`app/pbv-full-app/[token]/intake/[section]/page.tsx:64` — `localIntakeData` is per-page-mount state. `handleNext` and the Edit links call `router.push` directly with no `flushSave()`. The 600ms autosave debounce in `useSectionAutoSave.ts:30` means anything typed in the last debounce window is gone on navigation. Need timed-click test to confirm; could not produce on the test token because intake_data was already empty.

---

## What I did NOT verify and why

- **Did not actually upload a file.** Couldn't reach the upload screen — the dashboard's documents Start button is broken (#3), and the landing-page-mounted upload component requires the form to be in a specific phase that this token isn't in.
- **Did not test mobile breakpoint at 375px properly.** Browser resize_window didn't appear to constrain viewport in this session (screenshot shows ~1568px wide). Worth a manual pass.
- **Did not test back-button data preservation, browser-refresh data preservation, or required-field validation per section.** Each is its own runtime test that needs a token mid-intake; this one was already submitted.
- **Did not verify whether `SectionReview.handleSubmit` waits for in-flight autosave** before POST `/intake/complete`. Code reads as fire-and-forget; would race with an in-progress save if user submits within the debounce window.
- **Did not confirm whether the `intake_data` for this token was ever populated and then wiped, or whether the 22 documents seeded with no `intake_data` ever existed.** Need to check the DB row directly.
- **Did not check the additional-signers card** behavior — it currently shows "All adults have signed" so couldn't exercise its Start button.

---

## Recommended fix order

1. **#1 (bootstrap selects intake_data)** — one-line fix. Unblocks the entire Review page. Do this first.
2. **#3 (documents 404)** — either create route or repoint button. ~30 lines.
3. **#4 (summary route untokenized redirect)** — one-line fix.
4. **#2 (Section 8 of 7)** — one-line fix in IntakeShell or [section]/page.tsx.
5. **#6 (document view capability)** — API + UI work. ~half day.
6. **#5 (full data summary)** — rewrite `buildSummary`. ~half day. Pair with #1.
7. **#7 (age derivation)** — load real DOBs in `deriveMembers`. Real age math.
8. **#8 (autosave race)** — add `flushSave` before navigation in `[section]/page.tsx:108`.

---

## Why prior audits missed these

A pattern I noticed:
- Audits read components in isolation. `SectionReview.tsx` looks fine on its own — there's a `buildSummary` function, it returns blocks, it renders them. Green. But the `intakeData` argument it receives is empty because of a SELECT statement two API hops away.
- Audits trusted file existence as proof of correctness. `app/pbv-full-app/[token]/sign/summary/page.tsx` exists, therefore "the summary route works" — but the page logic redirects to a broken URL the moment it loads.
- Audits didn't run the app. Not one of the defects in #1, #2, #3, #4 requires understanding code — they all show up in the first 30 seconds of clicking through. They were missed because nobody clicked.

The audit prompt you wrote enforces the runtime walk. Use it.
