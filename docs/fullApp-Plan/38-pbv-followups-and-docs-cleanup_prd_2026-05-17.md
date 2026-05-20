# PRD-38 — Followups + Docs Cleanup

**Date:** 2026-05-17
**Author:** Claude (post-PRD-37 triage)
**Branch:** `feat/pbv-followups-and-docs-cleanup-38`
**Status:** Shipped 2026-05-17
**Depends on:** PRDs 33-37 (all shipped)

---

## Problem Statement

After PRDs 33-37 shipped, a triage of the deferred-decisions list surfaced a small set of loose ends. None of them block "accept applications" — they're cleanup. Bundling them into one PRD keeps the docs honest and closes the open questions without inventing new scope.

Specifically:

1. **PRD-37 did not implement admin access to the `/print` view.** The PRD called it out as a low-cost addition (PRD-37 line 111) but it shipped as tenant-only. Stanton admins reviewing an application cannot pull the same printable copy the tenant sees.
2. **PRD-32 F2 status note is stale.** The PRD header still reads "Draft — awaiting Dan sign-off on F2 architecture decision" but the code shipped — and the shipped behavior is effectively one-shot due to the idempotent guard at `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:36-44` plus `intake_data` being cleared on first complete. The re-sync question is functionally closed; the doc just doesn't reflect it.
3. **PRD-36 status header is stale.** Reads "Draft — needs UX direction" but every open question in the doc is either resolved (banner persistence = dashboard only) or explicitly out of scope (re-apply after denied). The component, migration, and bootstrap integration all shipped.
4. **PRD-35's DocumentViewer fix has no runtime confirmation.** The code is in place (`components/review/DocumentViewer.tsx:46-47` calls the new endpoint at `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/signed-url/route.ts`) but no one has clicked View on a real document from the Stanton review surface and confirmed it works end-to-end.
5. **Docs folder needs cleanup.** The existing plan at `docs/tasks/docs-cleanup_2026-05-15.md` covers PRDs 01-21 but hasn't been executed, and doesn't address PRDs 22-37 (now mostly shipped — should move to `docs/shipped/`). Build reports are missing for PRDs 32, 33, 34, 36, and 37.

---

## Users & Roles

- **Stanton office admins** — gain a "View tenant copy" link on the application detail page, get a verified working document viewer.
- **Future contributors / future-Alex** — gain a docs folder that reflects current state, not aspirational state.
- **Tenants** — unaffected. No tenant-facing changes.

---

## Closed decisions

- **No new data-model changes.** All five items are read-side or docs-side.
- **No new tenant UI.** Print access addition is admin-only.
- **No new connectors / external integrations.**
- **Build reports for PRDs without one are scoped to "what shipped, what got deferred, what to verify"** — not full retro-style postmortems. Short.

---

## Decisions resolved (Alex confirmed 2026-05-17)

- **Admin print access** — yes, add it. Reuse the existing tenant `/print` route with an admin-side entry link rather than building a parallel `/admin/.../print` route. Lower surface area; admins authenticated via existing admin guard can hit the tenant URL with a known token.
- **PRD-38 absorbs docs cleanup** rather than living in a separate task. Single branch.
- **DocumentViewer runtime verification** = required acceptance criterion for PRD-38, not a separate test PRD.

---

## Core Features

### F1 — Admin "View tenant copy" entry point

- **File:** `app/admin/pbv/full-applications/[id]/page.tsx`
- **Change:** Add a button/link in the page header that opens the existing print view at `/pbv-full-app/[token]/print` in a new tab. Resolve the token from the application record (already loaded on this page).
- **Auth:** Print page already reads from `supabaseAdmin` and is gated by token validity. Admin is hitting the same URL a tenant would. No new auth layer.
- **Copy:** "View tenant copy" (en). Translations not needed — admin UI is en-only per existing convention.
- **Out of scope:** A separate admin-only print template, admin-only fields in the print view, audit logging of admin print accesses. If those become real needs, separate PRD.

### F2 — Stale PRD status headers

- **PRD-32** (`docs/fullApp-Plan/32-pbv-tenant-link-blockers_prd_2026-05-15.md`): Update status line from "Draft — awaiting Dan sign-off on F2 architecture decision" to "Shipped 2026-05-15 — F2 implemented as effectively one-shot (idempotent guard + `intake_data` clear). Edit-and-resubmit deferred as known limitation per PRD-34."
- **PRD-36** (`docs/fullApp-Plan/36-pbv-tenant-application-status_prd_2026-05-15.md`): Update status line from "Draft — needs UX direction" to "Shipped 2026-05-16. All decisions in 'Decisions resolved' section ratified. Re-apply-after-denied deferred as separate PRD."
- **PRDs 33, 34, 35, 37**: Verify their status headers are accurate. Update if not.

### F3 — Missing build reports

Write short build-report stubs for the PRDs that shipped without one:

- `docs/build-reports/32-tenant-link-blockers-build-report_2026-05-17.md`
- `docs/build-reports/33-intake-flow-fixes-build-report_2026-05-17.md`
- `docs/build-reports/34-intake-data-snapshot-pattern-build-report_2026-05-17.md`
- `docs/build-reports/36-tenant-application-status-build-report_2026-05-17.md`
- `docs/build-reports/37-printable-application-copy-build-report_2026-05-17.md`

Each report should be short and follow the existing build-report shape (look at `35-staff-document-viewer-multibucket-build-report_2026-05-16.md` as the template). Cover: what shipped, what changed from PRD, what was deferred, file:line references, what still needs runtime verification.

If a PRD's author isn't reachable for the "what changed" detail, mark as `[inference based on diff]` and reference the relevant commits.

### F4 — DocumentViewer runtime verification

- **Pre-condition:** A test PBV application in any state that has at least one uploaded document.
- **Steps to execute and document:**
  1. Log into Stanton admin
  2. Open the application detail page
  3. Click "View" on an uploaded document
  4. Confirm the document opens (PDF inline or image preview)
  5. Repeat for: a PDF document, an image document, a staff-uploaded document, a tenant-uploaded document
- **Acceptance:** All four documents open successfully. Any that don't are filed as defects with file:line references in the build report.
- **No code change expected.** If a defect surfaces, it gets its own ticket — not absorbed into PRD-38.

### F5 — Execute docs cleanup

- **Pre-existing plan:** `docs/tasks/docs-cleanup_2026-05-15.md` lists 17 files to move from `docs/` root into `docs/shipped/`. Execute that plan.
- **Additions for PRDs 22-37:** Move all PRDs and prompts for 22-31 from `docs/fullApp-Plan/` into `docs/shipped/` (they've shipped — build reports exist for all). Same for 33-37 once F3's build reports are written (so the "shipped" criterion of "build report exists" is satisfied).
- **PRD-32 special case:** Move once F2 status header update + F3 build report land.
- **PRDs that have NOT shipped or whose status is unclear** stay in `docs/fullApp-Plan/`. The pre-existing plan's "Leave in place — status unclear" section lists these. Don't touch them; do not relitigate.
- **Update `docs/tasks/docs-cleanup_2026-05-15.md`** to check off completed moves and add a note pointing to PRD-38 as the executing PRD.

---

## Data Model

No changes.

---

## Integration Points

- `app/admin/pbv/full-applications/[id]/page.tsx` — F1 entry link
- `app/pbv-full-app/[token]/print/page.tsx` — F1 reuses, no change
- `docs/fullApp-Plan/32-*.md`, `docs/fullApp-Plan/36-*.md` — F2 header updates
- `docs/build-reports/` — F3 new files
- `docs/fullApp-Plan/` → `docs/shipped/` — F5 file moves
- `docs/tasks/docs-cleanup_2026-05-15.md` — F5 updates

---

## Implementation Phases

**Phase 1 — Admin print access (target: quarter day)**
- F1: add entry link
- Manual smoke test: admin clicks link, print view loads with snapshot data

**Phase 2 — Docs hygiene (target: quarter day)**
- F2: update PRD-32 and PRD-36 headers
- F3: write 5 build report stubs
- Verify PRD 33, 34, 35, 37 status headers are accurate (update if not)

**Phase 3 — DocumentViewer verification (target: quarter day)**
- F4: execute the 4-document test, record results in PRD-35's build report (or a new addendum if PRD-35's report doesn't have a verification section)
- File any defects as separate tickets

**Phase 4 — Docs cleanup execution (target: quarter day)**
- F5: execute moves per pre-existing plan + the 22-37 additions
- Update the cleanup plan doc with checked-off items
- Final pass: `ls docs/fullApp-Plan/` should contain only in-flight or status-unclear items

---

## Acceptance — what "done" looks like

- An admin viewing an application detail page can click "View tenant copy" and see the same `/print` view a tenant would see, in a new tab.
- PRD-32 and PRD-36 status headers reflect shipped state, not draft state.
- Every PRD that has shipped (PRDs 22-37, minus any explicitly unshipped) has a corresponding build report.
- DocumentViewer has been runtime-verified against four document types; results captured in PRD-35's build report or an addendum.
- `docs/fullApp-Plan/` contains only PRDs that are in-flight or whose shipped status is genuinely unclear. Everything verifiably shipped lives in `docs/shipped/`.
- The docs cleanup plan at `docs/tasks/docs-cleanup_2026-05-15.md` is checked off or marks remaining items as known-deferred with a reason.

---

## Out of scope — captured for future PRDs

- **D5 — Twilio SMS for magic links** (PRD-32 deferred). Separate PRD when SMS workflow is real.
- **D8 — Summary audit row schema change** (PRD-32 deferred). Group with any other data-model PRD.
- **L4 — Nullable `form_document_id` column** (PRD-31 deferred). Group with D8.
- **Re-apply-after-denied** (PRD-36 deferred). Product decision needed first.
- **Edit-and-resubmit intake flow** (PRD-34 deferred). Touches snapshot pattern; design conversation needed.
- **HACH portal data display gap** (`components/review/HachReviewSurface.tsx:320` — members destructured never rendered). Real gap, but Stanton/HACH conversation should drive scope. Possible PRD-39 candidate after the runtime walkthrough.

---

## Notes

- This PRD intentionally bundles small unrelated cleanup items. Resist the urge to expand it. If something doesn't fit cleanly into F1-F5, it belongs in its own PRD.
- Per Alex's working style: do not draft speculative PRDs from the "Out of scope" list above. Wait for explicit go.
