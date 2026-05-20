# Docs Cleanup Plan — 2026-05-15

## Goal
Move shipped PRDs/prompts from `docs/` root into `docs/shipped/`. A root file is considered shipped only if a matching build report exists in `docs/build-reports/`.

## Move to `docs/shipped/`

Confirmed shipped (matched against `build-reports/`):

- [x] `01-pbv-02-packet-intake-prd_2026-05-14.md` — matches `pbv-02-packet-intake-build-report_2026-05-14.md`
- [x] `01-pbv-02-packet-intake-prompt_2026-05-14.md` — same
- [x] `02-pbv-03-tenant-packet-upload-prd_2026-05-14.md` — matches `pbv-03-tenant-packet-upload-build-report_2026-05-14.md`
- [x] `02-pbv-03-tenant-packet-upload-prompt_2026-05-14.md` — same
- [x] `03-document-scanner-refactor_prd_2026-05-14.md` — matches `document-scanner-refactor-build-report_2026-05-14.md`
- [x] `03-document-scanner-refactor_prompt_2026-05-14.md` — same
- [x] `04-post-approval-execution_prd_2026-05-13.md` — matches `post-approval-execution_build-report_2026-05-13.md`
- [x] `04-post-approval-execution_prompt_2026-05-13.md` — same
- [x] `05-pbv-04-tenant-notifications-prd_2026-05-14.md` — matches `pbv-04-tenant-notifications-build-report_2026-05-14.md`
- [x] `05-pbv-04-tenant-notifications-prompt_2026-05-14.md` — same
- [x] `14-pbv-document-categorization-prompt_2026-05-14.md` — matches `14-document-categorization-build-report_2026-05-14.md`
- [x] `15-pbv-submission-finalization_prd_2026-05-14.md` — matches `15-submission-finalization-build-report_2026-05-14.md`
- [x] `15-pbv-submission-finalization-prompt_2026-05-14.md` — same
- [x] `20-pbv-already-submitted-reentry_prd_2026-05-14.md` — matches `20-already-submitted-build-report_2026-05-14.md`
- [x] `20-pbv-already-submitted-reentry-prompt_2026-05-14.md` — same
- [x] `21-pbv-tenant-e2e-test-suite_prd_2026-05-14.md` — matches `21-tenant-e2e-build-report_2026-05-14.md`
- [x] `21-pbv-tenant-e2e-test-suite-prompt_2026-05-14.md` — same

**Total: 17 files — MOVED 2026-05-17**

### Executed by PRD-38 on 2026-05-17

Additional PRDs 22-37 moved to `docs/shipped/` (build reports now exist for all):

**PRDs 22-31 (build reports already existed):**
- [x] `22-pbv-form-execution-toolchain-and-hard-form-pilot_prd_2026-05-15.md` + prompt
- [x] `23-pbv-form-execution-field-maps_prd_2026-05-15.md` + prompt
- [x] `24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` + prompt
- [x] `25-pbv-form-execution-phase1-intake-ui_prd_2026-05-15.md` + prompt
- [x] `26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` + prompt
- [x] `27-pbv-form-execution-phase3-additional-adults_prd_2026-05-15.md` + prompt
- [x] `28-pbv-form-execution-summary-doc_prd_2026-05-15.md` + prompt
- [x] `29-pbv-form-execution-staff-assisted-mode_prd_2026-05-15.md` + prompt
- [x] `30-pbv-form-execution-e2e-test_prd_2026-05-15.md` + prompt
- [x] `31-pbv-form-execution-hotfix_prd_2026-05-15.md` + prompt

**PRDs 32-37 (build reports written by PRD-38 F3):**
- [x] `32-pbv-tenant-link-blockers_prd_2026-05-15.md` + prompt
- [x] `33-pbv-intake-flow-fixes_prd_2026-05-15.md` + prompt
- [x] `34-pbv-intake-data-snapshot-pattern_prd_2026-05-15.md` + prompt
- [x] `35-pbv-staff-document-viewer-multibucket_prd_2026-05-15.md` + prompt
- [x] `36-pbv-tenant-application-status_prd_2026-05-15.md` + prompt
- [x] `37-pbv-printable-application-copy_prd_2026-05-15.md` + prompt

**PRD-38 will remain in `docs/fullApp-Plan/` until it ships.**

## Leave in place (no matching build report — status unclear)

These look in-flight or unconfirmed. Not moving until you tell me otherwise.

- `06-rejection-tenant-loop_*` (note: there's a separate `rejection-notifications-build-plan_2026-05-01.md` in tasks/ — could be related but not a clear match)
- `07-pbv-application-layer_*`
- `08-hach-auth_*`
- `09-hach-reviewer-portal_*`
- `10-income-eligibility-engine_*`
- `11-appointment-scheduling_*` (3 files: prd, prompt, build-plan)
- `11a-pbv-form-submission-decoupling_prd_*`
- `12-stanton-pipeline-dashboard_*` (3 files: prd, prompt, implementation-plan)
- `13-asset-id-migration-prp.md`
- `14-pbv-tenant-flow-go-live-fixes_prd_2026-05-14.md` ([inference] the `14-document-categorization` build report doesn't obviously cover this; could be a separate Phase-14 PRD that didn't ship under that name)
- `15-pbv-submission-lock-and-resilience_prd_2026-05-14.md` ([inference] separate from `15-pbv-submission-finalization` which did ship)
- `16-pbv-orphan-removal-api-consolidation_*`
- `17-pbv-rejection-loop-completeness_*`
- `18-pbv-multi-signer-correctness_*`
- `19-pbv-tenant-resilience_*`
- `form-html-rendering-pilot_prd_2026-05-14.md`
- `form-pdf-overlay-pilot_prd_2026-05-14.md`

## Leave in place (reference/standing docs)

- `NORTH_STAR.md`
- `PROJECT_KNOWLEDGE.md`
- `TENANT_FORM_SPECIFICATION.md`
- `tenant-requirements.md`
- `document-inventory.md`
- `appfolio-insurance-decision-memo_2026-04-30.md`
- `verification-methodology_2026-05-13.md`

## Notes / Open questions

- Build reports exist for items 22–31 (form-execution toolchain, phase1–3, summary doc, staff-assisted, e2e, hotfix) but I don't see corresponding 22–31 PRDs in the root. [inference] Those PRDs may already live elsewhere or were never separately written. No action needed unless you tell me otherwise.
- There are also some build-plan / implementation-plan files mixed in at the root (`11-appointment-scheduling_build-plan.md`, `12-stanton-pipeline-dashboard_implementation-plan.md`). Should these move into `build-reports/` as their work completes, or stay co-located with the PRD? Not touching for now.

## Execution

Once approved, I'll `mv` the 17 confirmed-shipped files into `docs/shipped/` and check them off above.

---

## 2026-05-19 cleanup pass (Claude / Cowork)

Same rule (build report exists → move to `shipped/`), applied to everything that accumulated since 2026-05-17.

**Moved to `docs/shipped/`:**

PRDs + prompts (build reports confirm shipped):
- `38-pbv-followups-and-docs-cleanup` (prd + prompt)
- `39-pbv-accept-apps-blockers` (prd + prompt)
- `41-pbv-tenant-upload-ux` (prd + prompt + plan)
- `43-pbv-outbound-comms` (prd + prompt)
- `44-pbv-flow-continuity` (prd + prompt)
- `46-pbv-scanner-mobile-polish` (prd + prompt)
- `47-pbv-scanner-multipage-review-and-feedback` (prd + prompt)

Briefs that fed shipped PRDs:
- `prd-42-brief_card-stack-redesign.md`
- `prd-43-brief_outbound-comms.md`
- `prd-44-brief_flow-continuity.md`

Standalone prompts (no paired PRD, work completed):
- `49-launch-readiness-audit_prompt_2026-05-19.md` (audit complete; result at `docs/audit/49-pbv-launch-readiness-audit_2026-05-19.md`)
- `50-launch-merge-execution_prompt_2026-05-19.md` (merge executed; report in `build-reports/`)

PDF overlay pilot (validated, shipped):
- `form-pdf-overlay-pilot_prd_2026-05-14.md`
- `pdf-overlay-build-handoff_2026-05-14.md`
- `pdf-overlay-validated_2026-05-14.md`

**Moved to `docs/z - Archive/`:**

- `48-pbv-scanner-scanic-pilot_prd_2026-05-19.md` (prd + prompt) — superseded by PRD-52.

**Remaining in `fullApp-Plan/` (in flight):**

- `51-pbv-preapp-combined-approve-send_prd_2026-05-19.md` + prompt
- `52-pbv-scanner-scanic-ship_prd_2026-05-19.md` + prompt

**Remaining in `fullApp-Plan/` (status unclear — leaving for Alex to triage):**

- `40-pbv-trust-safety-polish_prd_2026-05-17.md` + prompt — no matching build report
- `42-pbv-tenant-document-card-stack_prd_2026-05-17.md` + prompt — card stack is in production but no formal build report
- `45-pbv-live-camera-scanner_prd_2026-05-18.md` + prompt — scanner is in production but no formal build report
- All the older PRDs `06-13`, `16-19` previously flagged as "status unclear" — unchanged from 2026-05-15 review

**Remaining at `docs/` root:**

- `IN-FLIGHT.md` — new rolling tracker (added 2026-05-19)
- `form-html-rendering-pilot_prd_2026-05-14.md` — status unclear, no build report
- All reference/standing docs (`NORTH_STAR`, `PROJECT_KNOWLEDGE`, `TENANT_FORM_SPECIFICATION`, etc.) — unchanged

**Open questions for Alex:**

- 40 / 42 / 45 — shipped without build reports, or genuinely never shipped? If the former, write a quick build report each and move to `shipped/`. If the latter, archive.
- `form-html-rendering-pilot_prd_2026-05-14.md` — superseded by the PDF overlay path, or still a live exploration?
