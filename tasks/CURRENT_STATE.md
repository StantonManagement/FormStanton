# CURRENT_STATE — FormsStanton

> **Front door for every new session.** Read this first. Update at session end.
> Single source of truth for "where are we right now."

_Last updated: 2026-05-29 (admin full-app detail committed to `claude/admin-detail-followups`)_

---

## Repo snapshot

- **Branch:** `claude/admin-detail-followups` — forked from `main` at `8e85ac0` (intake responses inline). Six atomic commits on top, see below.
- **Last commit before docs:** `65a13dc` — _feat(pbv): wire admin detail page — Generated Forms block + ApplicantMessagesPanel_. Docs commit goes on top of this.
- **Working tree:** clean once docs commit lands. Branch needs `git push -u origin claude/admin-detail-followups` from a host with credentials (sandbox has none).
- **`.git/config` was repaired** this session — file was truncated at line 17 (`[l`). Removed the partial section; no LFS evidence in repo so the drop should be harmless. Backup at `.git/config.bak.broken`.
- **Mount quirk worth knowing:** the sandbox cannot `rm` files under `.git/`, only `mv` them. Every git write op leaves a `.git/index.lock` plus a handful of `.git/objects/*.lock` files that have to be moved aside before the next git command. A wrapper script + ~12s sleep handles it. Lock files accumulated in `.git/aside/`.
- **Admin detail handoff (2026-05-28):** shipped on this branch. Messages table, Twilio inbound wiring, Request-changes flow, ApplicantMessagesPanel, Generated Forms preview all in. Build + smoke test pending on Windows.
- **PBV form-execution workstream (PRD-22→32):** the 2026-05-15 snapshot claimed PRD-31 hotfix code was on disk and `dev` was checked out. Current `main` does not show that — no `feature/pbv-form-execution` branch exists, working tree was clean of PRD-31 changes. The earlier snapshot may have been from a different worktree or stale. Reconcile before resuming PRD-32.

## What just shipped (PBV Tenant Flow Correctness Sprint)

All 8 PRDs merged on `dev` as of 2026-05-14:

| PRD | Title | Build report |
|---|---|---|
| 14 | Document Categorization | `docs/build-reports/14-document-categorization-build-report_2026-05-14.md` |
| 15 | Submission Finalization | `docs/build-reports/15-submission-finalization-build-report_2026-05-14.md` |
| 16 | Orphan Removal + API Consolidation | (no separate report file; code merged) |
| 17 | Rejection Loop Completeness | (no separate report file; code merged) |
| 18 | Multi-Signer Correctness | (no separate report file; code merged) |
| 19 | Tenant Resilience | (no separate report file; code merged — `lib/tenantFetch.ts`, `lib/idempotency.ts`, `tenant_idempotency_keys` migration, cron cleanup at `0 2 * * *`) |
| 20 | Already-Submitted Re-Entry | `docs/build-reports/20-already-submitted-build-report_2026-05-14.md` |
| 21 | E2E Test Suite | `docs/build-reports/21-tenant-e2e-build-report_2026-05-14.md` |

## What's next

_Update this section every session._

- [ ] **Push the branch** — `git push -u origin claude/admin-detail-followups` from Windows. The six commits below are local-only until pushed.
- [ ] **Run `npm run build` on Windows** — verify the admin-detail stream compiles. Sandbox could not build (no `node_modules` in mount).
- [ ] **Smoke test** per the build report: Request changes → system message in panel; staff composer → outbound SMS appears; tenant SMS reply → inbound appears within ~15s; Generated Forms preview opens the PDF.
- [ ] **Open PR** from `claude/admin-detail-followups` → `main` after the smoke test passes.
- [ ] **Reconcile the PRD-22→32 workstream** — the 2026-05-15 snapshot's claims (`dev` branch, 958 unstaged paths, PRD-31 hotfix on disk) don't match current `main`. Figure out where that work actually lives before resuming PRD-32.

### Commits on `claude/admin-detail-followups`

1. `3495471` — feat(pbv): add pbv_application_messages table + staff_message template
2. `684e3a8` — feat(pbv): admin form preview endpoint + generated_forms in GET
3. `71e41a5` — feat(pbv): two-way SMS messages API + Twilio inbound wiring
4. `f969af8` — feat(pbv): Request changes flow logs system message to thread
5. `f09a0a3` — feat(pbv): ApplicantMessagesPanel + useApplicationMessages hook
6. `65a13dc` — feat(pbv): wire admin detail page — Generated Forms block + ApplicantMessagesPanel
7. (this commit) — docs: admin full-app detail build report + CURRENT_STATE
- [x] ~~Run PRD-22 in Windsurf~~ — done
- [x] ~~PRDs 23-30 sequential~~ — done; audit surfaced defects, see PRD-31
- [x] ~~Run PRD-31 hotfix~~ — code applied; commit + run E2E still pending
- [ ] **Dan** — F2 re-sync decision (re-sync members on every `/intake/complete` call vs one-shot lock). Default in PRD-32 is re-sync.
- [ ] **Dan** — book HACH conversation to ratify the three blocking decisions (stamped-PDF accept, PT-UI/ES-output, per-form intent). Defaults are baked in.
- [ ] **Alex** — source the 4 source-pending form PDFs (VAWA HUD-5382, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification). Drop into `docs/templates/`. Then a small follow-on PRD writes their field maps and flips `generation_enabled`.
- [ ] **Alex + Dan** — draft real summary doc content; Cascade's best-effort lands in PRD-28, marked tentative.

### Goal locked
A tenant gets one link, completes everything HACH needs to review their PBV application from inside the system (including signing forms), without a caseworker handing them paper or walking them through it. Caseworker assist still acceptable for edge cases. Full goal in `docs/NORTH_STAR.md`.

### Resolved decisions (2026-05-14/15)

- **Build vs adopt:** built it. PDF overlay via pdf-lib. Pilot validated.
- **Architecture:** Additive Variant A. `pbv_full_applications` is the single parent table. New tables (`pbv_form_documents`, `pbv_signature_events`, `pbv_summary_documents`, optionally `pbv_form_templates`) FK to it.
- **Form list:** 17 total. 12 fully mapped in `docs/fullApp-Plan/pbv-field-inventory.md` + 1 mapped-pending-PDF (zero_income_statement) + 4 source-pending (VAWA HUD-5382, Reasonable Accommodation, healthcare-provider-release, childcare-expense-verification). Source-pending forms `generation_enabled = FALSE` until each source PDF lands.
- **Signing flow:** One signature capture + per-form tap-to-confirm. Same signature image stamped on each confirmed form. Each tap-confirm creates its own `pbv_signature_events` row (timestamp, IP, document hash). Audit per-form; ceremony for tenant.
- **HACH decisions (Dan confirmed defaults):** stamped-PDF output accepted; PT-UI / ES-output flow approved; per-form intent confirmation accepted. All three pending live HACH conversation but Dan is comfortable proceeding on defaults.
- **Summary doc content:** Cascade drafts best-effort EN/ES/PT in PRD-28; Alex + Dan + professional translator refine later.
- **Field-by-field inventory:** complete and in repo at `docs/fullApp-Plan/pbv-field-inventory.md`.
- **Conditional trigger map:** encoded in inventory § Conditional Trigger Reference. Dual-pipeline / form-fill-only / upload-only / hidden in-form / section gating all spelled out.

## Open decisions / things to watch

- **Admin-detail handoff (2026-05-28)** — full handoff at top of session. Two-way messaging table, Twilio inbound wiring, Request-changes flow, and `ApplicantMessagesPanel` all landed; panel is now wired into the page. No build report exists yet for this stream — write one after the smoke test passes.
- **Workstream interleaving** — admin-detail work ran in parallel with the PBV form-execution sprint (PRD-22→32). Both streams have uncommitted code. Decide commit order before pushing.
- **PRD-32 F2 architecture (open)** — re-sync vs one-shot member insert on `/intake/complete`. Default: re-sync (delete + re-insert on every call, supports edit-and-resubmit). Tradeoff: a tenant re-submit after staff-side adjustments could clobber those adjustments. Needs Dan ratification.
- **PRD-32 F5 row-coordinate formula** — default `row_index = member.slot - 1`. Must be verified against `scripts/field-maps/citizenship-declaration-en.json` during build.
- **Audit Round 2 findings (2026-05-15)** — see `docs/audit/tenant-link-form-fill-audit_2026-05-15.md`. D1–D4 + the two Claude-scan defects (F1, F2 in PRD-32) ship in PRD-32. D5 (SMS), D6, D7, D8, D9 deferred to a Phase-2 PRD.
- **`CATEGORY_ORDER` duplication** in `StantonReviewSurface.tsx:390` and `TenantDocumentUpload.tsx:142`. Not blocking. Extract to `lib/pbv/categories.ts` when convenient.
- **`UploadSignedDialog.tsx`** was recreated during PRD-16 (deleted then restored). Interface compiles; visual/behavioral parity with original not verified end-to-end. Worth a quick admin-UI smoke test.
- **PRD-19 build report missing.** Code is in (`lib/tenantFetch.ts` etc.) but no `19-tenant-resilience-build-report_2026-05-14.md` was written. If a retroactive report is wanted, reconstruct from the diff and the prompt's verification section.
- **PRD-22 table-style field map pattern** (Pattern A explicit-per-row vs Pattern B templated-rows). Cascade picks during the Citizenship Declaration pilot; choice propagates to PRD-23.
- **PRD-24 templates table** — extend `pbv_full_app_document_templates` or create `pbv_form_templates`. Cascade picks during build.
- **HACH live conversation** still pending. Defaults are sufficient for engineering; required before first real submission.

## Standing rules for this repo

- Stack: Next.js (App Router), Supabase, TypeScript, deployed on Vercel (Pro plan assumed for 60s function ceiling).
- Windows / PowerShell environment. **Do not** use `npm run build | Select-Object -First/-Last N` — it truncates and makes clean builds look broken. The middleware-deprecation stderr line is a known false-positive exit code.
- Hand Cursor the **prompt** file, not the umbrella PRD. PRDs are wide; prompts are scoped.
- Cursor's workflow: read PRD + prompt → audit → post open-decision answers in chat → wait for "go" → implement → write build report → wait for sign-off.
- Anti-patterns: skipping the audit, widening scope past the prompt, deleting files the grep audit flagged as having non-orphan consumers, trusting `Select-Object`-truncated build output.
- Cursor pushing back on a prompt is fine — evaluate on merits. PRD-19's "retry on `TypeError` only, not `AbortError`" deviation was correct.

## How to update this file

At session end, edit:
1. **Repo snapshot** — new last commit hash + subject (`git log -1 --pretty=format:'%h %s'`).
2. **What's next** — strike completed items, add new ones.
3. **Open decisions** — log new items, remove resolved ones.
4. **Last updated** date at the top.

Keep it short. If a section grows past ~10 lines, the detail belongs in a PRD, handoff, or build report — link to it from here.

## Pointers (read on demand, not by default)

- Project plan & PRD index: `docs/` (numbered `01-` through `21-`)
- Build reports: `docs/build-reports/`
- Active task lists: `tasks/pbv-todo.md`, `tasks/todo.md`
- Handoffs from past sessions: `docs/handoffs/`
- Verification methodology: `docs/verification-methodology_2026-05-13.md`
- Lessons learned (if/when): `tasks/lessons.md`
- **North star:** `docs/NORTH_STAR.md` (goal = `hap_executed`; pipeline stages 1–7; design principles)
- **Project-level knowledge base:** `docs/PROJECT_KNOWLEDGE.md` (Stanton Management context, last March 19 2026)
- **Tenant form spec:** `docs/TENANT_FORM_SPECIFICATION.md` (pet/insurance/parking compliance spec)
- **AppFolio insurance decision:** `docs/appfolio-insurance-decision-memo_2026-04-30.md`
- **Document inventory:** `docs/document-inventory.md` (PBV full app — 33 templates, evidence vs fill-in form breakdown, source-PDF page map)
- **Tenant requirements (plain language):** `docs/tenant-requirements.md` (same 33 items written for tenant/UX audience — forms vs documents split, freshness rules, common failure modes)

## PBV form-execution build sweep (2026-05-15)

PRD + prompt pairs written to `docs/fullApp-Plan/` — 22 through 32. Run sequentially in Windsurf per the order in `tasks/pbv-form-execution-prd-sweep_2026-05-15.md`. Each PRD has a matching prompt file with the same number.

**PRD-32** (`32-pbv-tenant-link-blockers_prd_2026-05-15.md`) is the next live PRD. Closes 6 critical/high defects that block the real EN tenant link flow. Two of the six (F1, F2) are structural defects the PRD-31 audit missed because the E2E helper sidesteps them.

Architecture documents (read with the PRDs):
- `docs/fullApp-Plan/05-pbv-form-execution_prd_2026-05-14.md` — overarching spec
- `docs/fullApp-Plan/form-execution-plan_2026-05-14.md` — strategic plan
- `docs/fullApp-Plan/pdf-overlay-validated_2026-05-14.md` — architecture decision memo
- `docs/fullApp-Plan/pdf-overlay-build-handoff_2026-05-14.md` — original handoff (now superseded by PRDs 22-30)
- `docs/fullApp-Plan/dan-hach-decision-log_2026-05-14.md` — decisions log
- `docs/fullApp-Plan/pbv-field-inventory.md` — source of truth for fields + conditional triggers
