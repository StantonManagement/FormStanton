# PRD-39 — PBV Accept-Applications Blockers

**Date:** 2026-05-17
**Author:** Claude (post-runtime-walkthrough triage)
**Branch:** `feat/pbv-accept-apps-blockers-39`
**Status:** Shipped 2026-05-17
**Depends on:** PRDs 33-38 (all shipped)
**References:** `tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md` (defect inventory)

---

## Problem Statement

The overnight runtime walkthrough on 2026-05-17 surfaced 11 defects across the PBV surface area. Three of them are independent blockers — any one stops accept-applications:

1. **Tenants cannot sign their summary.** `/sign/summary` always redirects to dashboard due to a wrong-field check in the page guard. Once a tenant completes intake, they have nowhere to go.
2. **Admin "Upload" buttons do nothing.** All 31 Upload buttons on the application detail page are silent — click registers, no modal opens, no file input injected, no console error. Staff cannot upload documents on tenants' behalf.
3. **Tenant document upload is camera-only.** The page advertises "Accepted: JPEG, PNG, PDF, HEIC" but the only file input has `accept="image/*,.heic,.heif"` with `capture="environment"` — PDFs explicitly excluded. Desktop tenants cannot upload PDFs.

A fourth defect (income annual = $0 everywhere) isn't a flow blocker but is a data-integrity blocker: every income calculation downstream of the bridge is wrong, which breaks AMI comparisons, qualification logic, and any reporting based on annual income.

This PRD fixes those four defects. Everything else from the walkthrough (seven smaller defects) is deferred to PRD-40 polish.

The walkthrough audit also confirmed PRDs 33-38 mostly landed and the PBV admin list pages (preapps, pipeline, work, reviewers) are healthy. The mess is concentrated in the tenant signing/uploading path and field-mapping in the bridge.

---

## Users & Roles

- **Tenants** — regain the ability to sign their summary, regain the ability to upload PDF documents from a desktop browser.
- **Stanton office admins** — regain the ability to upload documents on tenants' behalf.
- **Anyone reading downstream calculations** — annual income values become correct everywhere they appear (Review summary, print view, admin claimed-income column, future AMI checks).

---

## Closed decisions

- **Scope is the three flow-blockers plus the income data-integrity bug.** Other defects from the walkthrough (#3, #5, #6, #7, #10, #11) stay deferred to PRD-40. Resist scope creep.
- **No new tenant-facing features.** Only fixes to existing surfaces.
- **No schema migrations expected.** All four fixes are code-side. If F2 or F4 turn out to need schema work, escalate and split.
- **Defect #1 fix is a logic change, not a typo.** Original `signing_status` check may have had unknown intent — the fix should be reviewed before merge but is straightforward (`intake_status !== 'complete'`).
- **Defect #2 fix lives in the bridge** (`/intake/complete` route), not in the intake form. The form collects monthly because that's what tenants understand; annual is a derived field. Compute on save.
- **Defect #9 fix adds a parallel PDF/file path** alongside the camera flow, rather than widening the camera input's accept attribute. Cleaner separation; the scanner's image-processing pipeline stays untouched.

---

## Decisions resolved (Alex confirmed 2026-05-17)

- **Defect #1 — wrong-field check:** Yes, change to `intake_status !== 'complete'`. The original `signing_status` check appears to be a copy-paste error from a different gate.
- **Defect #2 — income annual computation:** Bridge computes `monthly_amount * 12` when source is monthly. If a source is annual (e.g., SSA award letters often state annual), store as-is.
- **Defect #8 — admin Upload investigation:** Read the application detail page component to find which Upload-button click handler is missing or which dialog component isn't mounted. Then fix.
- **Defect #9 — tenant PDF path:** Add a "Upload file" button (with file picker, accept="application/pdf,image/*,.heic,.heif") alongside the existing "Scan document" button. Both call the same upload endpoint with the resulting blob.

---

## Core Features

### F1 — Fix /sign/summary redirect

- **File:line:** `app/pbv-full-app/[token]/sign/summary/page.tsx:54-57`
- **Change:** Replace
  ```ts
  if (!data.signing_status || data.signing_status === 'not_started') {
    router.push(`/pbv-full-app/${token}/dashboard`);
    return;
  }
  ```
  with
  ```ts
  if (data.intake_status !== 'complete') {
    router.push(`/pbv-full-app/${token}/dashboard`);
    return;
  }
  ```
- **Acceptance:** Navigating to `/pbv-full-app/[token]/sign/summary` after submitting intake renders the SummaryDocReviewSign component (and triggers generate-forms if forms don't exist yet) rather than bouncing to /dashboard.

### F2 — Fix admin "Upload" buttons

- **Files to investigate:** `app/admin/pbv/full-applications/[id]/page.tsx` (or whichever component renders the doc list) and `components/review/UploadDialog.tsx`.
- **Symptom:** Clicking any "Upload" button (31 of them on a fully-seeded application) registers the click but does not inject a file input, open a modal, or log any console error. UploadDialog component exists in the codebase but appears to not be wired up.
- **Likely fixes (investigate first, then pick):**
  1. Missing onClick handler on the Upload button — wire it to setState that toggles a modal.
  2. UploadDialog is rendered but never opened — fix the open state.
  3. UploadDialog renders in a portal that's outside the page mount — fix the portal target.
- **Acceptance:** Clicking any Upload button on the admin detail page opens a file picker (or modal containing one) that accepts at minimum PDF, JPEG, PNG, HEIC. Selecting a file uploads it via the existing upload route. The doc row's status flips from "Missing" to "Uploaded" or similar.

### F3 — Add desktop PDF/file upload path to tenant document flow

- **File:** `components/pbv/TenantDocumentUpload.tsx`
- **Current state:** Only renders the DocumentScanner component, which uses a hidden `<input type="file" accept="image/*,.heic,.heif" capture="environment">` — desktop-incompatible for PDFs.
- **Change:** Render two buttons per doc row (or a split button):
  1. "Scan with camera" → existing DocumentScanner flow (mobile-first)
  2. "Upload file" → new hidden file input with `accept="application/pdf,image/*,.heic,.heif"` (no `capture` attribute), triggered by clicking the button. On file selection, POST the file to the same upload endpoint the scanner uses.
- **Mobile behavior:** Both buttons remain functional on mobile. "Upload file" lets the user pick from their photo library or files app instead of opening the camera.
- **Copy:** Match existing styling. Labels in en/es/pt to match the rest of the tenant UI.
- **Acceptance:** On a desktop browser, a tenant can click "Upload file" next to any document, select a PDF, and the doc row's status changes from "Missing" to indicate uploaded. The existing camera-scan path is unchanged. Stated "Accepted: PDF" in the page copy is now backed by actual functionality.

### F4 — Fix income annual computation in bridge

- **File:line:** `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:179` (uses `memberIncome?.annual_income ?? 0`)
- **Problem:** Intake collects monthly amounts. Bridge reads `annual_income` which is never populated. Every member gets `annual_income = 0`.
- **Change:** Compute annual from the income sources during the bridge. Sum `monthly_amount * 12` across all income sources for the member.
- **Schema consideration:** `intake_data.income.by_member[i].income_sources[j]` has `{ type, has_income, monthly_amount }` based on what the intake form populates. Annual is derived, not stored at the source level.
- **Where the fix needs to propagate:**
  1. Bridge — `pbv_household_members.annual_income` becomes correct
  2. `total_annual_income` on `pbv_full_applications` (summed in the same bridge function around line 214) — already sums member rows, so it'll pick up the fix automatically once member rows are correct
  3. `buildSummary` — Review summary "Annual total" computation should also be `monthly * 12`. Verify it does the same thing.
  4. Tenant `/print` view — reads from `intake_snapshot`, which contains the same monthly-only structure. Recompute on render.
- **Acceptance:** A tenant who entered $10,000/mo wage income sees:
  - Review summary: "Income: employment $10,000/mo · Annual total $120,000/yr"
  - Tenant print view: Same.
  - Admin claimed column: "$120,000" (not "$0").
  - `pbv_household_members.annual_income` in DB: `120000`.
  - `pbv_full_applications.total_annual_income`: `120000` (single-member household).

---

## Data Model

No migrations. F4 changes are read-side computations and a write-side derived value in the bridge.

---

## Integration Points

- `app/pbv-full-app/[token]/sign/summary/page.tsx` — F1 redirect fix
- `app/admin/pbv/full-applications/[id]/page.tsx` — F2 wiring (or wherever the Upload buttons live)
- `components/review/UploadDialog.tsx` — F2, likely needs investigation
- `components/pbv/TenantDocumentUpload.tsx` — F3 second upload button
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` — F4 bridge computation
- `lib/pbv/buildSummary.ts` (or equivalent) — F4 summary recomputation
- `app/pbv-full-app/[token]/print/page.tsx` — F4 print view recomputation

---

## Implementation Phases

**Phase 1 — Defect #1 (target: 15 min)**
- F1: one-line change + manual nav check on /sign/summary

**Phase 2 — Defect #2 (target: 1-2 hours)**
- F4: bridge computation + summary builder + print view fix
- Verify in three places (Review, Print, Admin) that $10,000/mo now shows $120,000/yr

**Phase 3 — Defect #9 (target: 2-3 hours)**
- F3: add "Upload file" button + file input + wire to existing upload endpoint
- Manual upload test on desktop with sample-paystub.pdf (test fixture already exists at `tests/fixtures/sample-paystub.pdf`)

**Phase 4 — Defect #8 (target: variable, investigate first)**
- F2: read component, identify why Upload is silent, fix
- Manual upload test from admin side

**Phase 5 — End-to-end re-verification (target: 30 min)**
- Re-run the OVERNIGHT_WALKTHROUGH flow with these fixes in place
- Confirm tenant can sign summary, upload PDF, complete signing flow, reach final submission
- Confirm admin can upload, can see correct income values
- Confirm PRD-35 DocumentViewer works (now testable since uploads work)
- Update OVERNIGHT_WALKTHROUGH_2026-05-17.md with re-verification results

---

## Acceptance — what "done" looks like

- A tenant with completed intake can navigate to `/sign/summary` and the page renders (does not redirect to /dashboard).
- A tenant on a desktop browser can upload a PDF document via the document upload UI.
- A staff admin can click "Upload" on any document row in `/admin/pbv/full-applications/[id]` and successfully upload a file.
- Income annual amounts on the Review summary, tenant print view, and admin detail page all reflect `monthly * 12`. The test case of $10,000/mo yields $120,000/yr everywhere.
- PRD-35's DocumentViewer fix is runtime-verified by clicking View on at least one uploaded document from the admin detail page (now possible because uploads work).
- The OVERNIGHT_WALKTHROUGH_2026-05-17.md document gets a "Re-verification 2026-05-17 (PRD-39)" section noting which of the four blockers are now resolved and confirming the end-to-end flow.

---

## Out of scope — explicitly deferred to PRD-40

These are real defects but not blocking accept-applications. Keep them for the next round:

- **Defect #3** — PRD-36 ApplicationStatusBanner not rendering on dashboard. Investigate cause (backfill didn't apply / bootstrap not surfacing field / component not mounted).
- **Defect #4** — Admin list at `/admin/pbv/full-applications` reads wrong field for "Intake Submitted" date. (Pipeline view reads correctly.)
- **Defect #5** — Zero Income Declaration section appears in intake and review summary for applicants with non-zero income. Section visibility logic broken.
- **Defect #6** — Dashboard "0 of 22" vs documents page "0 of 31" count inconsistency.
- **Defect #7** — Two "Submit my answers" buttons on the Review page (one enabled, one disabled).
- **Defect #10** — Print view shows "Uploaded: <today>" for missing documents. Reading `created_at` instead of `uploaded_at`.
- **Defect #11** — Silent redirects from gated sign pages (/sign/forms when summary unsigned, /sign/additional-signers when no other adults). Should show explanatory message rather than bounce.
- **HACH portal data display gap** — `components/review/HachReviewSurface.tsx:320` destructures `members` but never renders them. Confirmed from code review, never runtime-verified (need HACH creds).

---

## Notes

- The walkthrough doc has full file:line evidence for every defect. Reference it during implementation rather than re-discovering.
- Phase 4 (Defect #8 investigation) is the only phase with uncertain scope. If the investigation reveals a deeper architectural issue (e.g., the entire UploadDialog component was never finished), escalate and split into its own PRD rather than absorbing into PRD-39.
- After PRD-39 lands, the planned next moves are: (1) PRD-40 for the seven deferred polish defects, (2) HACH credential request + HACH portal audit, (3) re-run runtime walkthrough end-to-end to give a real "ready to accept applications" verdict.
