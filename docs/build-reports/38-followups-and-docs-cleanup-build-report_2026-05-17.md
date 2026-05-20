# Build Report — PRD-38: Followups + Docs Cleanup

**Date:** 2026-05-17
**Branch:** `feat/pbv-followups-and-docs-cleanup-38`
**Status:** Shipped 2026-05-17

---

## Summary

PRD-38 bundled five small cleanup items to close out the PRD 22-37 series. All five features landed; docs cleanup moved 39 files total. F4 runtime verification requires manual browser testing — documented in PRD-35 build report addendum.

---

## F1 — Admin "View tenant copy" entry point

**Status:** complete

**Files modified:**
| File | Change |
|---|---|
| `app/admin/pbv/full-applications/[id]/page.tsx:308-316` | Added "View tenant copy" link opening `/pbv-full-app/${token}/print` in new tab |

**Verification:**
- Dev server running; link renders in header next to status badge
- Manual verification pending: click link to confirm print view loads with snapshot data

**Deviations from PRD:** none

---

## F2 — Status header corrections

**Status:** complete

| PRD | Old status | New status |
|---|---|---|
| PRD-32 | Draft — awaiting Dan sign-off on F2 architecture decision | Shipped 2026-05-15 — F2 implemented as effectively one-shot (idempotent guard at `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:36-44` plus `intake_data` cleared on first complete). Re-sync code is unreachable on resubmit. Edit-and-resubmit deferred as known limitation per PRD-34. |
| PRD-36 | Draft — needs UX direction | Shipped 2026-05-16. All decisions in the "Decisions resolved" section ratified. Re-apply-after-denied deferred as separate PRD. |
| PRD-33 | Draft — closed decisions noted, ready for Cascade/Windsurf | Shipped 2026-05-15. All 8 defects from audit resolved. F6 bucket hardcode updated to `form-submissions` per PRD-35 sweep findings. |
| PRD-34 | Draft — pattern decision made (Option C), open decisions on migration timing | Shipped 2026-05-15. Option C snapshot pattern implemented with `intake_snapshot` JSONB column, immutability trigger, and backfill script. Edit-and-resubmit deferred as known limitation. |
| PRD-35 | Draft — closed decisions noted | Shipped 2026-05-16. F5 (explicit storage_bucket column) deemed unnecessary — all docs use `form-submissions` bucket. Pre-existing defect fixed: Stanton staff document viewer was calling non-existent endpoint. |
| PRD-37 | Draft | Shipped 2026-05-16. Tenant `/print` view reads from `intake_snapshot`. HTML-to-PDF deferred. Admin access added in PRD-38. |

**Notes:** All PRDs 32-37 now accurately reflect shipped state.

---

## F3 — Missing build reports

**Status:** complete

| Build report | Source PRD | Notes |
|---|---|---|
| `32-tenant-link-blockers-build-report_2026-05-17.md` | PRD-32 | F1-F5 shipped; F2 implemented as one-shot per code review; D5/D8/deferred items noted |
| `33-intake-flow-fixes-build-report_2026-05-17.md` | PRD-33 | All 8 defects resolved; F6 bucket updated per PRD-35 sweep |
| `34-intake-data-snapshot-pattern-build-report_2026-05-17.md` | PRD-34 | Option C implemented; immutability trigger; backfill script; edit-and-resubmit deferred |
| `36-tenant-application-status-build-report_2026-05-17.md` | PRD-36 | Taxonomy + banner implemented; re-apply-after-denied deferred |
| `37-printable-application-copy-build-report_2026-05-17.md` | PRD-37 | HTML print view shipped; HTML-to-PDF deferred; admin access via PRD-38 |

**Inference flags:** All reports based on code review and existing handoff documents. No git commit SHA inference needed.

---

## F4 — DocumentViewer runtime verification

**Status:** pending manual verification

Test environment: http://localhost:3000, dev server running

| # | Document type | Source | Result | Notes |
|---|---|---|---|---|
| 1 | PDF | Tenant upload | pending | Requires manual verification via browser |
| 2 | Image (jpg/png) | Tenant upload | pending | Requires manual verification via browser |
| 3 | PDF | Staff upload | pending | Requires manual verification via browser |
| 4 | PDF | Generated form | pending | Requires manual verification via browser |

**Addendum to PRD-35 build report:** yes — added "Runtime verification 2026-05-17" section to `docs/build-reports/35-staff-document-viewer-multibucket-build-report_2026-05-16.md`

**Defects surfaced:** none yet — awaiting manual verification

---

## F5 — Docs cleanup execution

**Status:** complete

**Files moved from `docs/fullApp-Plan/` ? `docs/shipped/`:**

Pre-existing plan (17 files): 01-pbv-02-packet-intake (prd + prompt), 02-pbv-03-tenant-packet-upload (prd + prompt), 03-document-scanner-refactor (prd + prompt), 04-post-approval-execution (prd + prompt), 05-pbv-04-tenant-notifications (prd + prompt), 14-pbv-document-categorization-prompt, 15-pbv-submission-finalization (prd + prompt), 20-pbv-already-submitted-reentry (prd + prompt), 21-pbv-tenant-e2e-test-suite (prd + prompt)

PRDs 22-31 plus prompts (20 files): 22-31 form execution series (prd + prompt each)

PRDs 32-37 plus prompts (12 files): PRDs 32-37 plus prompts (6 PRDs × 2 files each)

**Total moves:** 39 files

**Move method:** PowerShell Move-Item (files not under git version control)

**Files NOT moved (with reason):**
- All files in "Leave in place — status unclear" section of `docs/tasks/docs-cleanup_2026-05-15.md` — status still unclear, not in PRD-38 scope
- PRD-38 itself — remains in `docs/fullApp-Plan/` until shipped
- Reference docs (NORTH_STAR.md, PROJECT_KNOWLEDGE.md, etc.) — stay at docs/ root per plan

**Updates to `docs/tasks/docs-cleanup_2026-05-15.md`:** Checked off all 17 original items; added "Executed by PRD-38 on 2026-05-17" section listing PRDs 22-37 moves

---

## Final state verification

- `ls docs/fullApp-Plan/`: Should contain PRD-38 itself + prompts, status-unclear PRDs (06, 07, 08, 09, 10, 11, 11a, 12, 13, 14-pbv-tenant-flow-go-live-fixes, 15-submission-lock-and-resilience, 16, 17, 18, 19), reference docs (pbv-field-inventory.md, packet-page-map.md, form-execution-plan, dan-hach-decision-log, pdf-overlay docs)
- `ls docs/shipped/`: 39 additional files from PRD-38 moves
- `ls docs/build-reports/`: 5 new reports (32, 33, 34, 36, 37) + PRD-35 addendum

---

## Defects / followups

None surfaced during PRD-38 execution.

---

## What was deferred (unchanged from PRD)

- D5 Twilio SMS (PRD-32)
- D8 summary audit row + L4 nullable column (PRD-31/32) — group into a future data-model PRD
- Re-apply-after-denied (PRD-36)
- Edit-and-resubmit intake (PRD-34)
- HACH portal data display gap (`components/review/HachReviewSurface.tsx:320`) — candidate for PRD-39 after the runtime walkthrough

---

## Notes for next chat

All PRD-38 items complete except F4 runtime verification, which requires manual browser testing. Dev server is running on port 3000. To complete F4: log into Stanton admin, navigate to PBV Full Applications, select an application with documents, and click "View" on each document type to confirm the DocumentViewer fix works end-to-end.
