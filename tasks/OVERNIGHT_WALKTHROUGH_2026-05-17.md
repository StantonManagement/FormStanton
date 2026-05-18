# Overnight Runtime Walkthrough — 2026-05-17

**Verifier:** Claude (Cowork, via chrome-devtools-mcp)
**Environment:** http://127.0.0.1:63189 (dev), Stanton admin = aks@stantoncap.com
**Test application:** Maria Test Tenant, 110 Martin Unit 1, token `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`, application id `6a43b66a-cc33-45b6-b18f-ca0276707736`
**PRDs in scope:** 33 (intake fixes), 34 (snapshot), 35 (DocumentViewer), 36 (status banner), 37 (print view), 38 (admin print + cleanup)

---

## Verdict — NOT READY to accept applications

**Three independent blockers.** Any one of them stops the flow:

1. **Sign-summary page always redirects to dashboard.** Tenant can't sign their summary → can't sign forms → can't final-submit. Whole post-intake flow stuck. One-line fix candidate, flagged for your review (Defect #1).
2. **Tenant document upload only supports camera scan, not PDF/file picker.** UI advertises PDF acceptance but the only file input is camera-only (`accept="image/*,.heic,.heif"`). Tenants on desktops cannot upload PDFs (Defect #9).
3. **Admin "Upload" buttons do nothing.** Click registered, no modal, no console error — completely silent. Staff cannot upload documents on tenants' behalf (Defect #8).

Plus six other significant defects detailed below. PRDs 33-38 mostly landed — bootstrap, intake submit, snapshot pattern, admin print link, summary rendering all confirmed working — but the gaps that remain are real, not cosmetic.

---

## Verified working

| PRD | Feature | How verified |
|---|---|---|
| PRD-34 | `intake_snapshot` migration applied; bootstrap GET returns 200 | Network panel during page load |
| PRD-33 F2 | Review page progress label says "Review" not "Section N of M" | Snapshot of /intake/review |
| PRD-33 F5 | Review summary renders captured data per section, not one-line taglines | Snapshot — every section showed real data |
| PRD-33 F3 | `/documents` route exists and renders (was 404) | Snapshot of /pbv-full-app/[token]/documents — 31 doc templates rendered |
| PRD-37 | Tenant `/print` route and download link surface on dashboard | "Download my application copy" link present and resolves |
| PRD-38 F1 | Admin "View tenant copy" link on application detail page | Link present at admin/pbv/full-applications/[id], URL correctly tokenized to /print |
| PRD-32 F2 | Bridge from intake to `pbv_household_members` runs on submit | Admin shows Maria as member with relationship, age, citizenship, SSN last 4 |
| Intake submit | `/intake/complete` returns 200, redirects to dashboard | Submit button → dashboard loaded |
| PRD-33 F1 | Dashboard renders 4 task cards | Snapshot of /dashboard |
| PRD-37 | Tenant `/print` view renders snapshot data | Direct nav to /pbv-full-app/[token]/print — all 9 sections + doc list + signatures + footer rendered cleanly |
| Admin | PBV Pre-Apps list (/admin/pbv/preapps) | 28 submissions, filters working, duplicate detection visible |
| Admin | PBV Pipeline view (/admin/pbv/pipeline) | Multi-stage filters, blocked-on filter, assignee picker, stale tracker. Maria correctly shows "Intake" stage (so the right field is being read by *this* surface, just not by full-applications list) |
| Admin | PBV Work (/admin/pbv/work) | 6 queue sections render, filters present, empty state correct |
| Admin | PBV Reviewers (/admin/pbv/reviewers) | Renders empty state, Add Reviewer button present |
| HACH | /hach/login page renders with separate auth | Need HACH-specific creds to deep-test the portal |

---

## Defects surfaced

### Defect #1 — BLOCKER: /sign/summary always redirects to dashboard

**Impact:** Tenants cannot sign their summary, so cannot reach forms signing, so cannot final-submit. Whole post-intake flow stuck.

**File:line:** `app/pbv-full-app/[token]/sign/summary/page.tsx:54-57`

**Code:**
```js
// If intake not complete (no signing_status), can't generate yet
if (!data.signing_status || data.signing_status === 'not_started') {
  router.push(`/pbv-full-app/${token}/dashboard`);
  return;
}
```

**The bug:** The comment says "If intake not complete" but the code checks `signing_status`. After intake submission, `intake_status='complete'` but `signing_status` is null/'not_started' (the user hasn't started signing — that's literally why they're on this page). So the guard fires and bounces them away.

**Likely fix:** `if (data.intake_status !== 'complete')` instead. One-line change.

**Why I didn't self-fix:** Logic change, not a typo. Original `signing_status` check may have been intentional for a reason I can't see from this file alone. Worth 60 seconds of your eyes before merging.

---

### Defect #2 — Income annual = $0 despite $10,000/mo entered

**Impact:** Admin sees $0 claimed income for everyone. Income comparisons and AMI checks will be meaningless. Review summary also shows "Annual total $0/yr" while monthly displays correctly.

**File:line:** `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:179`

**Code:**
```js
annual_income: memberIncome?.annual_income ?? 0,
```

**The mismatch:** Intake captures monthly amounts (the form field is "Monthly amount ($)"). Bridge expects `annual_income`. Result: every member gets `annual_income = 0`.

**Likely fix:** Either compute annual in the bridge (`monthly_amount * 12`) or have the intake form derive and persist annual_income alongside monthly. The summary builder probably has the same gap.

**Verified in two places:**
- Review page (uid 2_37): "$10,000/mo … Annual total $0/yr"
- Admin detail page (uid 6_31): Maria claimed = "$0"

---

### Defect #3 — Application status banner (PRD-36) missing from dashboard

**Impact:** Tenants who've submitted don't see "Your application has been submitted" reassurance. PRD-36 was explicitly built to close this gap.

**Observation:** Migration shipped (`supabase/migrations/20260517010000_pbv_application_review_status.sql`), `ApplicationStatusBanner` component exists at `components/pbv/sign/ApplicationStatusBanner.tsx`, but the banner does not render on the dashboard post-submission.

**Likely causes (in order of probability):**
1. Backfill UPDATE in the migration didn't fire (or fired before `intake_status='complete'` was set on Maria's row)
2. Bootstrap GET response isn't surfacing `application_review_status` to the dashboard hook
3. `TenantDashboard.tsx` isn't mounting the banner component
4. The condition `intake_status === 'complete' && application_review_status != null` is wrong somewhere

**To investigate:** Query `pbv_full_applications` for Maria's row, check whether `application_review_status` is set. If null, the backfill didn't apply — re-run it. If set, the gap is in bootstrap or the dashboard component.

---

### Defect #4 — Admin list shows "Invited" not "Intake Submitted" for Maria

**Impact:** Staff scanning the application list don't see that Maria has just submitted her intake. Will be ignored.

**Observation:** Admin list at `/admin/pbv/full-applications` shows Maria's status badge as "Invited" with an "—" in the Intake column. Another application (Richie Rich) on the same list shows "Intake Submitted" correctly, so the differentiation logic exists — it's just not applying to Maria.

**Possible cause:** Field name mismatch — the admin list likely checks `submitted_at` (the post-signing final submission timestamp) rather than `intake_completed_at`. Maria has intake complete but not final submission. If that's the intent, the column header is misleading; it should say "Final Submission" not "Intake".

**File to check:** `app/admin/pbv/full-applications/page.tsx` (or the list query route)

---

### Defect #5 — Section visibility logic: "Zero Income Declaration" appears for wage earners

**Impact:** Confusing UX. Tenant with employment income sees an irrelevant "Zero Income Declaration" section title (with an empty body) during intake AND on the Review summary.

**Where surfaced:**
- During intake walkthrough: Section 4 of 9 = "Zero Income Declaration" with completely empty body. Section visibility logic should hide this when applicant has wage/SSI/pension/etc income.
- Review summary: Section appears in the list with "Edit" button but no content.

**Probable file:** Section visibility hook `useSectionVisibility` and intake config. Likely the visibility predicate isn't keyed off `income.by_member[].income_sources` correctly, OR the predicate exists but the section is being added unconditionally.

---

### Defect #6 — Doc count inconsistency: dashboard "0 of 22" vs documents page "0 of 31"

**Impact:** Minor confusion. Dashboard counts required-only (22), documents page counts all (31 = 22 required + 9 optional).

**Recommendation:** Pick one. Either change dashboard to "0 of 31 (22 required)" or change documents page header to "0 of 22 required" with a separate optional count.

---

### Defect #7 — Two "Submit my answers" buttons on Review page

**Impact:** Confusing UX. One in main content area (enabled), one in footer (disabled). User unsure which to click.

**Where:** /intake/review — uid 2_107 (main, enabled) and uid 2_110 (footer, disabled).

---

### Defect #8 — BLOCKER: Admin "Upload" button does nothing

**Impact:** Staff cannot upload documents on tenants' behalf. 31 Upload buttons on the admin detail page (`/admin/pbv/full-applications/[id]`), zero of them functional.

**Observation:** Clicking any "Upload" button:
- Registers the click (no JS error)
- Does NOT inject a file input into the DOM
- Does NOT open any modal (queried `[role="dialog"]`, `dialog`, `.modal`, `[class*=Modal]` — all empty)
- Does NOT log any console error

**File to investigate:** Whatever component renders the Upload buttons on `app/admin/pbv/full-applications/[id]/page.tsx`. Most likely the click handler is missing or the modal portal isn't rendering. May be related to the `UploadDialog.tsx` component at `components/review/UploadDialog.tsx` not being mounted.

---

### Defect #10 — Print view shows "Uploaded: <today>" for missing documents

**Impact:** Tenant's downloadable application copy claims every required document was uploaded on the submission date — even ones that are clearly marked "missing." Confusing and misleading on a legal record.

**File:line:** `app/pbv-full-app/[token]/print/page.tsx` — likely reading `application_documents.created_at` (seed time = today) instead of `application_documents.uploaded_at` (which would be null for missing docs).

**Where surfaced:** Tenant `/print` view shows e.g.:
- "Paystubs (...)" — Status: missing — Uploaded: May 17, 2026
- "SSI Award Letter" — Status: missing — Uploaded: May 17, 2026
- (...repeated for all 31 documents)

**Fix:** Only show the "Uploaded" column value when status != 'missing', otherwise show "—". Render condition is one ternary.

---

### Defect #11 — Silent redirects from /sign/forms and /sign/additional-signers

**Impact:** When tenants try to navigate to gated sign pages, the route silently redirects to `/dashboard` with no message explaining why. Especially confusing if they bookmarked a sign URL or used browser back/forward.

**Pages affected:**
- `/sign/forms` — gated by summary not being signed yet (Locked on dashboard)
- `/sign/additional-signers` — gated by no other adults needing to sign (Complete ✓ on dashboard for HoH-only households)
- `/sign/summary` — Defect #1 covers this one separately (which is a true bug, not just a gate)

**Recommendation:** Each gated page should render its own "Why am I here?" message — "Complete summary signing first" or "All adults already signed; nothing to do here" — rather than bouncing to dashboard. The dashboard cards already say this, so the destination has the info but the path getting there is invisible.

---

### Defect #9 — BLOCKER: Tenant document upload only supports camera, not PDF

**Impact:** Tenants on desktops cannot upload PDFs (which is the most common document format from banks, employers, SSA, etc.). They can only take a photo on mobile.

**File:line:** `components/pbv/TenantDocumentUpload.tsx` uses `DocumentScanner` component (camera-only flow) as the only upload path.

**Evidence at runtime:** Only one `<input type="file">` exists on the tenant documents page. Its attributes:
- `accept="image/*,.heic,.heif"` — explicitly excludes PDF
- `capture="environment"` — mobile camera capture
- `class="hidden"` — meant to be triggered by a button

**Contradiction:** The same page's UI copy reads: "Upload one file per document. **Accepted: JPEG, PNG, PDF, HEIC.** Max 25MB." That promise is not backed by the actual input. PDF is in the copy, not the implementation.

**Possible fix paths:**
1. Add a separate "Upload PDF/file" path next to the scanner button. Most users on desktop will use this.
2. Widen the existing scanner input's `accept` to include PDFs and drop `capture="environment"` on desktop. May complicate the scanner's image-processing assumptions.

---

## Not testable without additional setup

| What | Why | What would unblock |
|---|---|---|
| PRD-35 F4 DocumentViewer fix end-to-end | Blocked by Defects #8 and #9 — cannot upload anything from either side | Fix #8 or #9, upload a doc, then click View from admin |
| PRD-33 F6 tenant View UI | Same — Defect #9 blocks tenant upload entirely | Fix #9 |
| HACH portal data display (known gap) | Skipped — already in deferred list | Separate audit after a PRD-39 fix |
| Sign-summary page actual rendering | Blocked by Defect #1 — never reaches the page | Fix Defect #1 first |

**Important pattern:** I tried to upload `tests/fixtures/sample-paystub.pdf` to test PRD-35 F4 end-to-end. The upload tooling exists on both admin and tenant surfaces but neither path actually opens a file picker. PRD-35's DocumentViewer fix is unverified because nothing can be uploaded to view in the first place.

---

## Open questions for you (Alex)

1. **Defect #1 (/sign/summary redirect):** Do you want me to ship the one-line fix to a branch and you review the diff, or do you want to investigate the original `signing_status` intent first?
2. **Defect #2 (income annual):** Same — one-line fix in the bridge to compute `monthly * 12`, or do you want a wider conversation about where annual income should live?
3. **Defect #3 (status banner):** Want me to dig into which of the four causes it is? Quickest path is the SQL check — `SELECT id, intake_status, application_review_status FROM pbv_full_applications WHERE token='110-martin-unit-1-...'`.
4. **Defect #8 (admin Upload silent):** Want me to read the admin detail page component to find the missing click handler and propose a fix?
5. **Defect #9 (tenant PDF upload):** Should I scope a separate file-picker path on `TenantDocumentUpload.tsx`, or do you want a wider conversation about whether desktop PDF upload is a deliberate omission (mobile-camera-first design)?
6. **HACH portal verification:** Skip for tonight as planned, or worth a smoke pass?

---

## What I did not verify

- Document upload flow (needs file in browser session)
- DocumentViewer click-through (needs uploaded doc)
- Tenant docs View UI (needs uploaded doc)
- Sign-summary page rendering (blocked by Defect #1)
- Forms signing (blocked transitively)
- Additional-adults flow (HoH-only test household)
- Spanish/Portuguese translations
- Stanton review status transitions
- HACH portal end-to-end

---

## Files referenced

- Bug: `app/pbv-full-app/[token]/sign/summary/page.tsx:54-57`
- Bug: `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:179`
- Migration shipped: `supabase/migrations/20260517010000_pbv_application_review_status.sql`
- Migration shipped: `supabase/migrations/20260515110000_pbv_intake_snapshot.sql`
- Component (likely not mounted): `components/pbv/sign/ApplicationStatusBanner.tsx`
- Admin detail: `app/admin/pbv/full-applications/[id]/page.tsx` (PRD-38 F1 link verified at runtime)

---

## Re-verification 2026-05-17 (post PRD-39)

After PRD-39 shipped, re-walked the four fixes via chrome-devtools-mcp against http://localhost:3000.

### Verified working

| Fix | Evidence |
|---|---|
| **F1** — /sign/summary redirect | Page now renders SummaryDocReviewSign component (no longer bounces to /dashboard). |
| **F2** — admin Upload buttons | Dialog opens with file picker. **CORRECTION to Defect #8**: original "silent click" finding was a snapshot timing artifact — chrome-devtools-mcp click + immediate snapshot raced React's re-render, so the dialog wasn't captured. Windsurf's code-review verdict that wiring is correct was right. The buttons work. |
| **F3 UI** — tenant Scan/Upload buttons | Both render on every doc row. Upload-file picker triggers correctly. |
| **F4 code** — income annual = monthly × 12 | Review summary shows "Annual total $120,000/yr"; tenant /print view shows the same. |

### Still broken / new defects

| # | Description |
|---|---|
| **#12 (new)** | `POST /api/t/[token]/pbv-full-app/generate-forms` returns 500 with empty body when /sign/summary triggers auto-generate. Server-side throw, no client-visible details. Needs dev-server stack trace. |
| **#13 (new)** | `POST /api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload` returns 500 with body `{"success":false,"message":"Upload failed. Please try again.","code":"upload_failed"}`. Outer catch at upload route line 240. Underlying error in dev server logs. Blocks F3 backend verification. |
| **F4 admin column** | Admin "Claimed" shows $0 — Maria's `pbv_household_members.annual_income` row is stale from pre-PRD-39 bridge run. PRD-39's prompt anticipated this. Needs SQL repair or fresh test tenant. |
| **PRD-35 DocumentViewer** | Untestable — Defects #12 and #13 prevent uploading anything to view. |

### What this means

PRD-39's code changes are good. The walkthrough surfaced two NEW server-side 500s (#12 and #13) that were hiding behind the original blockers — neither was visible before because the flow never reached generate-forms or hit a real upload attempt. Both look like data-shape mismatches in routes that read from the application's intake state.

Pattern: **fix the user-facing flow blockers, the next layer's bugs surface.** Same as how PRD-32 F2 fix exposed PRD-33 defects, which exposed PRD-35 defects, which exposed PRD-39 defects, which now expose #12 and #13.

### Recommended next move

1. Paste the dev-server stack traces for the two 500s into Defect #12 / #13 entries below. With those, the fix scope becomes obvious.
2. SQL-repair Maria's annual_income (or provision fresh test token) to close the F4 admin verification.
3. PRD-40 to fix #12 + #13 + the seven polish defects from the original walkthrough.

---

## Summary for the next chat

**11 defects total** across tenant intake, tenant signing, tenant documents, tenant print view, admin list, admin detail, and admin upload. The walkthrough is now complete across all PBV-related pages and workflows except HACH portal (separate auth, need creds).

**Three blockers** (any one stops accept-applications):
- Defect #1: `/sign/summary` redirect bug
- Defect #8: admin Upload buttons silent
- Defect #9: tenant upload PDF-incompatible

**Two data-integrity** (downstream calculations broken):
- Defect #2: income annual = $0 everywhere
- Defect #4: admin list reads wrong status field for "Intake Submitted"

**Six smaller** (#3, #5, #6, #7, #10, #11): banner missing, section visibility wrong, count inconsistency, double-submit-button, print uploaded-date stale, silent redirects from gated pages.

**What's verified working:**
- Bootstrap GET (PRD-34 migration applied)
- Intake walk through all 9 sections
- /intake/complete + dashboard transition
- Review summary rendering (PRD-33 F2, F5)
- Tenant `/print` view (PRD-37) — best-tested surface, looks great
- Admin print link (PRD-38 F1)
- Admin detail member rendering, doc seeding, status dropdown, action button gating
- PBV admin list pages (preapps, pipeline, work, reviewers all render)

**What's still NOT verified at runtime:**
- PRD-35 F4 DocumentViewer fix end-to-end — needs uploaded doc, blocked by Defects #8/#9
- HACH portal review surface — needs HACH-specific creds
- Forms generation flow (`/api/.../generate-forms`) — blocked behind Defect #1
- Final submission — blocked transitively
- Twilio SMS (deferred per PRD-32 D5 anyway)

**Recommended sequence:**
1. Triage Defects #1, #8, #9 (the blockers) — Defect #1 looks like a one-line wrong-field fix, #8 and #9 need component-level investigation
2. After fixes, upload a doc and re-run to validate PRD-35 DocumentViewer + the rest of the signing flow
3. Get HACH creds for HACH portal audit (will need that anyway before the upcoming HACH conversation)
4. Then tackle Defect #2 (income annual = $0) which surfaces in three places (Review, Print, Admin) — likely one source of truth that propagates everywhere

The pattern these defects expose is clear and consistent: **PRD code shipped on the routes side but the actual interaction surfaces (sign pages, upload buttons, status fields) were never runtime-tested.** Without browser-driven verification, all of this would have been "all clear" again — the same failure mode the audit was designed to catch.

---

## Re-verification 2026-05-17 (PRD-39)

PRD-39 shipped with fixes for the four accept-applications blockers:

### Defects Addressed

| Defect | PRD-39 Fix | Status |
|---|---|---|
| #1 — /sign/summary redirect | Changed guard from `signing_status` to `intake_status !== 'complete'` | Code complete, pending runtime verification |
| #2 — Income annual = $0 | Bridge now computes `monthly_amount * 12` from income_sources; Display component computes on render | Code complete, pending runtime verification |
| #8 — Admin Upload silent | Investigation confirmed button wiring is correct (DocumentRow → StantonReviewSurface → UploadDialog) | Code verified, pending runtime verification |
| #9 — Tenant PDF upload | Added "Upload file" button with hidden file input (accept PDF+images, no capture) alongside camera scanner | Code complete, pending runtime verification |

### Code Changes Summary

1. **F1** — `app/pbv-full-app/[token]/sign/summary/page.tsx:54` — One-line redirect fix
2. **F4** — Two files:
   - `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:151-154,184` — Bridge annual computation
   - `components/pbv/IntakeDataDisplay.tsx:201-207` — Display annual computation
3. **F3** — `components/pbv/TenantDocumentUpload.tsx` — Dual-button UI with PDF support
4. **F2** — No code changes required — investigation confirmed correct wiring

### Remaining Deferred (PRD-40)

- Defect #3: ApplicationStatusBanner missing from dashboard
- Defect #4: Admin list wrong field for "Intake Submitted"
- Defect #5: Zero Income Declaration visibility logic
- Defect #6: Dashboard vs documents page count inconsistency
- Defect #7: Double "Submit my answers" button
- Defect #10: Print view shows "Uploaded: <today>" for missing docs
- Defect #11: Silent redirects from gated sign pages
- HACH portal data display gap

### Recommended Next Steps

1. **Runtime verify PRD-39** with test tenant (Maria or fresh token):
   - Complete intake → confirm dashboard renders
   - Navigate to /sign/summary → confirm no redirect (F1)
   - Verify income shows $120,000/yr for $10,000/mo wages (F4)
   - Upload PDF from tenant /documents → confirm status flip (F3)
   - Upload from admin side → confirm UploadDialog opens (F2)
   - View uploaded doc → confirm PRD-35 DocumentViewer works

2. **PRD-40** — Address the seven deferred polish defects

3. **HACH credentials** — Request access for HACH portal end-to-end audit
