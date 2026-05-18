# Prompt — PRD-38: Followups + Docs Cleanup

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/38-pbv-followups-and-docs-cleanup_prd_2026-05-17.md`
**Target branch:** `feat/pbv-followups-and-docs-cleanup-38`

---

## Read first

1. The PRD: `docs/fullApp-Plan/38-pbv-followups-and-docs-cleanup_prd_2026-05-17.md`
2. The existing docs-cleanup plan: `docs/tasks/docs-cleanup_2026-05-15.md`
3. The handoff: `tasks/HANDOFF_2026-05-15.md`
4. PRD-35 build report template: `docs/build-reports/35-staff-document-viewer-multibucket-build-report_2026-05-16.md` (use as the shape for the build reports F3 asks for)
5. PRD-32, PRD-36 for status header context

Do not re-read PRDs 33, 34, 35, 37 unless their headers turn out to be wrong during F2.

---

## What you're building

Five small things bundled to close out the PRD 22-37 series:

1. **F1** — Admin entry link to the existing tenant `/print` view
2. **F2** — Update two stale PRD status headers (PRD-32, PRD-36)
3. **F3** — Write 5 missing build reports (PRDs 32, 33, 34, 36, 37)
4. **F4** — Runtime-verify the DocumentViewer fix from PRD-35
5. **F5** — Execute the existing docs cleanup plan + extend to PRDs 22-37

Total target: 1 day if no surprises.

---

## Order of operations

### Step 1 — F1 admin print link

- Open `app/admin/pbv/full-applications/[id]/page.tsx`. Find the page header section.
- The application's token is already loaded on this page (used elsewhere in the file). Reuse it.
- Add a button/link in the header: "View tenant copy" → opens `/pbv-full-app/${token}/print` in a new tab (`target="_blank" rel="noopener noreferrer"`).
- Match the existing button styling in that header.
- No new API call. No auth changes. No new component file unless the header already has a sub-component pattern that calls for it.

Manual verification before moving on: spin up dev server, log in as admin, navigate to a real application, click the link, confirm print view loads with the snapshot data.

### Step 2 — F2 status header corrections

- **PRD-32** `docs/fullApp-Plan/32-pbv-tenant-link-blockers_prd_2026-05-15.md` line 6: change
  ```
  **Status:** Draft — awaiting Dan sign-off on F2 architecture decision
  ```
  to
  ```
  **Status:** Shipped 2026-05-15 — F2 implemented as effectively one-shot (idempotent guard at `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:36-44` plus `intake_data` cleared on first complete). Re-sync code is unreachable on resubmit. Edit-and-resubmit deferred as known limitation per PRD-34.
  ```
- **PRD-36** `docs/fullApp-Plan/36-pbv-tenant-application-status_prd_2026-05-15.md` line 6: change
  ```
  **Status:** Draft — needs UX direction
  ```
  to
  ```
  **Status:** Shipped 2026-05-16. All decisions in the "Decisions resolved" section ratified. Re-apply-after-denied deferred as separate PRD.
  ```
- **PRDs 33, 34, 35, 37**: skim each header. If accurate, leave alone. If stale, update with same pattern: `Shipped YYYY-MM-DD. <one-line summary of what shipped vs PRD>. <any deferred items>.`

### Step 3 — F3 build report stubs

Create five files in `docs/build-reports/`, dated 2026-05-17. Use the existing `35-staff-document-viewer-multibucket-build-report_2026-05-16.md` shape: short, factual, file:line where useful.

Each report should answer:
- **What shipped** — bullet list, one line per feature from the PRD
- **What changed from PRD** — anything implemented differently than specified, with reason
- **What was deferred** — anything from the PRD that explicitly didn't ship
- **Verification status** — what's been runtime-verified vs what's still on faith
- **Known issues / followups** — anything surfaced during build that's worth tracking

For PRDs where you weren't the author and can't reach the original implementer, use git log to find the relevant commits and mark inference where needed:
```
[inference based on diff at commit <sha>]
```

Filenames:
- `docs/build-reports/32-tenant-link-blockers-build-report_2026-05-17.md`
- `docs/build-reports/33-intake-flow-fixes-build-report_2026-05-17.md`
- `docs/build-reports/34-intake-data-snapshot-pattern-build-report_2026-05-17.md`
- `docs/build-reports/36-tenant-application-status-build-report_2026-05-17.md`
- `docs/build-reports/37-printable-application-copy-build-report_2026-05-17.md`

Keep each report under 80 lines. These are status records, not retros.

### Step 4 — F4 DocumentViewer runtime check

Pre-condition: dev server up, Stanton admin login, a real application with at least one uploaded document.

Sequence:
1. Open Stanton admin → application detail page for a PBV application with documents
2. Click "View" on a tenant-uploaded PDF document → confirm it loads (inline or new tab)
3. Click "View" on a tenant-uploaded image document → confirm it loads
4. Click "View" on a staff-uploaded document → confirm it loads
5. Click "View" on a different doc_type (e.g., a generated form vs a raw upload) → confirm it loads

Capture results in `docs/build-reports/35-staff-document-viewer-multibucket-build-report_2026-05-16.md` as an addendum at the bottom, dated 2026-05-17. Format:
```
## Runtime verification 2026-05-17
- [x] PDF tenant upload — opens correctly
- [x] Image tenant upload — opens correctly
- [ ] Staff upload — FAILS: <symptom> / fix tracked in <ticket-or-line>
- [x] Generated form — opens correctly
```

If any document fails to load, **stop and file as a defect** (own ticket or note in the build report — don't try to fix in PRD-38 unless the fix is one line).

### Step 5 — F5 docs cleanup

Read `docs/tasks/docs-cleanup_2026-05-15.md` first. Execute the 17 moves it lists (uses `mv`-equivalent — in this environment, you may need to copy + delete depending on git tracking — preserve git history if possible via `git mv`).

Then add to the same plan doc and execute:

**Confirmed-shipped PRDs 22-31** (build reports exist for all):
- `22-pbv-form-execution-toolchain-and-hard-form-pilot_prd_2026-05-15.md` + prompt
- `23-pbv-form-execution-field-maps_prd_2026-05-15.md` + prompt
- `24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` + prompt
- `25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md` + prompt
- `26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` + prompt
- `27-pbv-form-execution-phase3-additional-adults_prd_2026-05-15.md` + prompt
- `28-pbv-form-execution-summary-doc_prd_2026-05-15.md` + prompt
- `29-pbv-form-execution-staff-assisted-mode_prd_2026-05-15.md` + prompt
- `30-pbv-form-execution-e2e-test_prd_2026-05-15.md` + prompt
- `31-pbv-form-execution-hotfix_prd_2026-05-15.md` + prompt

**Confirmed-shipped PRDs 32-37** (move only after F3 writes their build reports):
- `32-pbv-tenant-link-blockers_prd_2026-05-15.md` + prompt
- `33-pbv-intake-flow-fixes_prd_2026-05-15.md` + prompt
- `34-pbv-intake-data-snapshot-pattern_prd_2026-05-15.md` + prompt
- `35-pbv-staff-document-viewer-multibucket_prd_2026-05-15.md` + prompt
- `36-pbv-tenant-application-status_prd_2026-05-15.md` + prompt
- `37-pbv-printable-application-copy_prd_2026-05-15.md` + prompt

**Do NOT move** anything from the existing cleanup plan's "Leave in place — status unclear" section. Those need their own triage and are not in PRD-38 scope.

**Do NOT move** the standing reference docs (`NORTH_STAR.md`, `PROJECT_KNOWLEDGE.md`, etc.) — they stay at `docs/` root.

After moves, update `docs/tasks/docs-cleanup_2026-05-15.md`:
- Check off all completed items
- Add a section "Executed by PRD-38 on 2026-05-17" listing the additional moves
- For anything still in "status unclear," leave the note as-is

### Step 6 — Final verification

- `ls docs/fullApp-Plan/` — should contain: status-unclear PRDs only, plus reference docs already at that level (pbv-field-inventory.md, packet-page-map.md, form-execution-plan, dan-hach-decision-log, the pdf-overlay docs), plus PRD-38 itself + prompt
- `ls docs/shipped/` — should contain everything from the executed moves
- `ls docs/build-reports/` — should contain new reports for 32, 33, 34, 36, 37 + the PRD-35 addendum
- All link references in remaining docs that point to moved files: leave alone unless they're in a doc that's actively used. Future PRDs can fix link rot if it becomes a problem.

---

## What to deliver

- Branch `feat/pbv-followups-and-docs-cleanup-38` with all changes
- A build report for PRD-38 itself: `docs/build-reports/38-followups-and-docs-cleanup-build-report_2026-05-17.md`
  - Lists what shipped under F1-F5
  - Captures any defects surfaced by F4
  - Notes any items that couldn't be moved/updated and why
- Status header update on PRD-38 itself: change "Draft — ready for build" to "Shipped 2026-05-17" once done

---

## Gotchas

- **F4 is mandatory.** If you skip the runtime verification because "the code looks right," you've reproduced the failure mode the PRDs 22-37 audit was trying to break. Click the buttons.
- **F5 is destructive.** Always use `git mv` so history is preserved. If a file is referenced by an active doc (links, includes), the move will break that link — note it in the build report, don't try to chase every reference.
- **Do not expand scope.** If F4 turns up a real bug, file it; don't fix it here. If a docs cleanup move surfaces a doc that needs rewriting, note it; don't rewrite it here.
- **Status headers should be honest.** If a PRD shipped with deviations from the spec, the header should say so. Don't write "Shipped per PRD" if it isn't true. Inference is allowed but must be labeled.

---

## When something is ambiguous

Stop and ask. Do not assume. Specifically:
- If a PRD's status is genuinely unclear after reading the code, mark the status header as `Status unclear — needs triage` and skip it from the move list.
- If a build report can't be honestly written (the code is too divergent from the PRD to reconstruct intent), say so and skip rather than fabricating.
- If F1's admin link placement isn't obvious from the existing page structure, ask before adding.
