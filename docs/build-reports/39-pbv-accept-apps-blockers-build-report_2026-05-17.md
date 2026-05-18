# Build Report — PRD-39: Accept-Applications Blockers

**Date:** 2026-05-17
**Branch:** `feat/pbv-accept-apps-blockers-39`
**Status:** _Draft — fill in as work completes_

---

## Summary

PRD-39 fixed the four defects from the overnight runtime walkthrough that were blocking accept-applications: tenant sign-summary redirect, admin Upload buttons silent, tenant PDF upload missing, and income annual = $0 everywhere.

_<replace this paragraph with one sentence on the outcome — e.g. "All four fixes landed; end-to-end tenant signing flow now reachable" or "F1/F3/F4 landed; F2 split into its own PRD because <reason>">_

---

## F1 — /sign/summary redirect fix

**Status:** _<complete | partial | blocked>_

**File:line:** `app/pbv-full-app/[token]/sign/summary/page.tsx:53-57`

**Change:** _<paste the actual before/after diff or describe>_

**Verification:**
- _<e.g. "Navigated to /sign/summary as Maria — SummaryDocReviewSign rendered, generate-forms triggered.">_

**Deviations from PRD:** _<none | describe>_

---

## F4 — Income annual computation in bridge

**Status:** _<complete | partial | blocked>_

**Files modified:**
| File | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` | _<line range, brief>_ |
| `lib/pbv/buildSummary.ts` (or equivalent) | _<>_ |
| `app/pbv-full-app/[token]/print/page.tsx` | _<>_ |

**Verification (test tenant Maria, $10,000/mo wages):**
- Review summary "Annual total": _<value>_ (expected $120,000)
- /print view "Annual total": _<value>_ (expected $120,000)
- Admin claimed column: _<value>_ (expected $120,000)
- `pbv_household_members.annual_income` for Maria's HoH row: _<value>_ (expected 120000)
- `pbv_full_applications.total_annual_income`: _<value>_ (expected 120000)

**How Maria's existing row was repaired:** _<SQL update | fresh test tenant | n/a — did it differently>_

**Side-effect search:** _<did you grep for `annual_income` references? What did you find? Anything that needs follow-up?>_

**Deviations from PRD:** _<none | describe>_

---

## F3 — Tenant desktop PDF upload path

**Status:** _<complete | partial | blocked>_

**Files modified:**
| File | Change |
|---|---|
| `components/pbv/TenantDocumentUpload.tsx` | _<added Upload-file button + hidden file input + handler>_ |
| _<i18n file>_ | _<added strings for new button label>_ |

**New hidden input attributes:** _<accept value, no capture attr confirmed>_

**Upload endpoint reused:** _<endpoint path>_

**Verification:**
- Desktop browser — clicked "Upload file" next to Paystubs row, picked `tests/fixtures/sample-paystub.pdf`, status flipped to: _<>_
- Existing camera-scan path still functional: _<yes/no>_
- Tested on mobile? _<yes/no — if no, note as followup>_

**Deviations from PRD:** _<none | describe>_

---

## F2 — Admin Upload buttons

**Status:** _<complete | partial | blocked — if blocked, was it split into a separate PRD?>_

**Diagnosis:** _<what was actually wrong — missing onClick, modal state never toggling, portal target missing, etc.>_

**Files modified:**
| File | Change |
|---|---|
| `app/admin/pbv/full-applications/[id]/page.tsx` | _<>_ |
| `components/review/UploadDialog.tsx` | _<modified | unchanged>_ |

**Verification:**
- Clicked Upload on Paystubs row in admin → file picker opened: _<yes/no>_
- Selected `sample-paystub.pdf` → status flipped to: _<>_
- Refreshed tenant /print view → that row's "Uploaded" date changed (or stayed wrong, confirming Defect #10): _<>_

**Deviations from PRD:** _<none | describe>_

**If split into separate PRD:** _<PRD number, what was deferred and why>_

---

## End-to-end re-verification

**Status:** _<complete | partial | blocked>_

| Step | Result |
|---|---|
| Tenant completes intake → dashboard renders | _<pass/fail>_ |
| Tenant clicks Sign Summary → /sign/summary renders (not redirected) | _<pass/fail — confirms F1>_ |
| Tenant signs summary → forms signing unlocks | _<pass/fail>_ |
| Tenant uploads PDF on /documents → status flips | _<pass/fail — confirms F3>_ |
| Admin uploads PDF on admin detail → status flips | _<pass/fail — confirms F2>_ |
| Admin clicks View on uploaded doc → opens correctly | _<pass/fail — confirms PRD-35>_ |
| Income annual = $120,000 in Review summary | _<pass/fail — confirms F4>_ |
| Income annual = $120,000 in /print view | _<pass/fail>_ |
| Income annual = $120,000 in admin claimed column | _<pass/fail>_ |
| Tenant reaches final-submit (Submit my application button enables) | _<pass/fail>_ |

**Walkthrough doc updated:** _<yes/no — confirm "Re-verification 2026-05-17 (PRD-39)" section added to tasks/OVERNIGHT_WALKTHROUGH_2026-05-17.md>_

---

## Defects / followups

**Defects from PRD-39's "Out of scope" list — still open for PRD-40:**
- Defect #3: PRD-36 ApplicationStatusBanner not rendering
- Defect #4: Admin list wrong field for "Intake Submitted"
- Defect #5: Zero Income Declaration appears for non-zero-income applicants
- Defect #6: Dashboard "0 of 22" vs docs page "0 of 31" count inconsistency
- Defect #7: Double "Submit my answers" button on Review
- Defect #10: Print view shows "Uploaded: <today>" for missing documents
- Defect #11: Silent redirects from gated sign pages
- HACH portal data display gap (HachReviewSurface.tsx:320)

**New defects surfaced during PRD-39 build:**
_<list anything new — keep these out of PRD-39 scope, but capture for future PRDs>_

---

## What was deferred / changed from PRD

_<anything that didn't go as planned — e.g. F4 also needed a change in component X, or F2's investigation revealed a bigger issue that got its own PRD>_

---

## Notes for next chat

_<one-paragraph wrap-up — e.g. "All four blockers resolved, end-to-end accept-applications flow now works. PRD-40 next for the seven polish defects. HACH creds still needed.">_
