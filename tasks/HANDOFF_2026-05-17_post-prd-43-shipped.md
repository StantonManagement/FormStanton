# Handoff — Post PRD-43 Shipped, PRD-42/44 Queued

**Date:** 2026-05-17 (late session, ~evening)
**From:** Claude (this session)
**For:** the next chat picking this up
**Pairs with prior handoff:** `tasks/HANDOFF_2026-05-17_tenant-verification.md` (morning session — audit + PRD-40 draft)

---

## TL;DR — what to do first

**The next chat exists to verify that PRD-40, PRD-41, and PRD-43 actually shipped end-to-end as specified, then unblock #12/#13 and tee up PRD-42.**

First actions, in order:

1. Ask Alex for the Windsurf build reports for PRD-40, PRD-41, and PRD-43. They should live at `docs/build-reports/40-*`, `docs/build-reports/41-*`, `docs/build-reports/43-*` respectively. If any are missing, status flags on the PRDs are aspirational, not verified.
2. Ask Alex for the dev-server terminal stack traces for Defects #12 (generate-forms 500) and #13 (upload 500). Without these, the tenant flow remains blocked from sign/summary onward — no end-to-end PRD verification is possible.
3. Walk Maria-equivalent test tenant through every shipped PRD's acceptance test. Score per-step like the prior audit. Do NOT skip to the new shipped features — re-verify foundations.

The verification lens is the same: **would Maria reach final submission without calling Stanton?** Tenant view is source of truth. Friction = defect.

---

## Current PRD state

| PRD | What | Status as of this handoff | Verification needed by next chat |
|---|---|---|---|
| 33-38 | Earlier work (intake fixes, snapshot, doc viewer, banner, print, followups) | Shipped + verified (per morning handoff) | No |
| 39 | Accept-applications blockers (F1-F4) | Shipped + partly verified (morning) | No (already done) |
| **40** | Trust + safety + polish (12 features, 5 phases) | **Marked completed by Alex 2026-05-17 (this session)** | **YES — walk full acceptance** |
| **41** | Tenant upload UX (hash dedup, help content, progress bar, drag-drop) | **Marked "presently running" by Alex 2026-05-17** — Windsurf was executing as of this session. **F2 explicitly descoped per PRD-42 decision.** Build report not yet seen. | **YES — confirm F1/F3/F4 shipped, F2 absent** |
| **42** | Card stack redesign of /documents (10 features, 5 phases) | **DRAFT — ready for build.** PRD + prompt written this session. | No (waiting on PRD-43 verification + Alex go-ahead) |
| **43** | Outbound comms (pre-flight SMS + deferred-doc reminders) | **PRD status updated to "Shipped — 2026-05-17"** in this session. Build report not yet confirmed. May be aspirational status flip, not verified ship. | **YES — confirm build report exists, walk acceptance** |
| **44** | Mid-flow re-entry + forms handoff | **DRAFT — ready for build.** PRD + prompt written this session. Depends on PRD-42 landing first. | No |

---

## What the next chat MUST verify

### PRD-40 acceptance (12 steps from PRD-40 §"Acceptance summary")

Provision fresh `not_started` tenant. Walk through:

1. Magic link → lands on `/intake` (F10 routing).
2. Section 1: every required field has `*` marker (F1).
3. Section 3: enter monthly Wages, blur → annual auto-fills (F3).
4. Section 6: no radio pre-selected on felony question (F2).
5. Section 7: no radios pre-selected on DV/homeless/RA (F2).
6. Section indicator stable throughout (F9).
7. Review: human-readable values (no `"black"` enums), ONE Submit button (F7, F8).
8. Submit intake. Dashboard renders.
9. ApplicationStatusBanner visible on dashboard (F5).
10. Dashboard shows GATED doc count (F4, F6) — e.g., "0 of 13" for Maria-type, NOT "0 of 31".
11. Documents page matches dashboard count and lists ONLY relevant docs (no SSI/TANF/Immigration for wage-only-citizen).
12. Direct nav to `/sign/forms` → explainer page, NOT silent bounce (F11).

If any of those fail, PRD-40's "Shipped" status is wrong — kick back to Windsurf.

### PRD-41 acceptance (when build report lands)

1. **Hash dedup (F1):** upload `tests/fixtures/paystub-week1.pdf`, then `paystub-week1-COPY.pdf` (same SHA-256). Dedup dialog appears for compatible slots.
2. **Per-doc help (F3):** "?" icon on each doc row. Click → help content shows. Switches language with EN/ES/PT toggle.
3. **Progress bar (F4):** visual bar on `/dashboard` task card. Updates as docs upload.
4. **F2 absent:** confirm NO drag-drop zone on documents page (descoped per PRD-42 decision).

### PRD-43 acceptance (8 steps from PRD-43 §"Acceptance summary")

Requires a Twilio test number OR staging Twilio account:

1. Fresh tenant submits intake. SMS arrives within 30s. Pre-flight checklist matches gated docs.
2. EN content verified. ES tenant gets Spanish. PT tenant gets Portuguese.
3. Replay `intake/complete` via curl. No second SMS. Idempotency hit logged.
4. Mock-defer a doc. Fast-forward `next_reminder_scheduled_at`. Cron run. Reminder fires with count+link.
5. Upload doc within 24h of scheduled reminder. Skip + log `paused_recent_engagement`.
6. Submit application. Cron run. No reminder.
7. Tenant local 11pm → send deferred to 9am next day. Log `deferred_quiet_hours`.
8. Inbound STOP → subsequent reminders blocked.

### Defects from morning audit — status?

- **#12 generate-forms 500** — STATUS UNKNOWN. As of morning audit, server returned empty 500 body. Console: `[SummarySignPage] generate-forms failed`. **Need stack trace from Alex's dev terminal.**
- **#13 upload 500** — STATUS UNKNOWN. As of morning audit, server returned `{"code":"upload_failed"}`. Verified non-tooling-artifact via real-FormData fetch. **Need stack trace from Alex's dev terminal.**
- All other audit defects (#3-#11) — should be RESOLVED by PRD-40 if it shipped per spec. Verify each via the 12-step walkthrough above.

---

## Things drafted this session, NOT yet built

- **PRD-42** at `docs/fullApp-Plan/42-pbv-tenant-document-card-stack_prd_2026-05-17.md`. Prompt at `docs/fullApp-Plan/prompts/42-pbv-tenant-document-card-stack_prompt_2026-05-17.md`. Card stack redesign of /documents. Headline. 10 features, 5 phases. 8-12 days estimate.
- **PRD-44** at `docs/fullApp-Plan/44-pbv-flow-continuity_prd_2026-05-17.md`. Prompt at `docs/fullApp-Plan/prompts/44-pbv-flow-continuity_prompt_2026-05-17.md`. Mid-flow re-entry + forms handoff + two-phase progress bar. Depends on PRD-42. 3-5 days.

Both are gated on PRD-43 verification being clean. Don't kick either to Windsurf until PRD-43 acceptance passes.

---

## Decisions locked this session

These are in the PRDs but recapping for the next chat so nothing gets re-litigated:

### PRD-40 decisions resolved (Alex confirmed 2026-05-17)
- **F4 soft-detach:** add `'no_longer_required'` to `ad_status_check` constraint via migration.
- **F5 translations:** full EN + ES + PT inline at build time.
- **F9 section indicator:** lock-at-start per tenant, stored in `intake_data.section_count`.

### PRD-42 decisions
- F2 of PRD-41 (drag-drop) is descoped. PRD-41 build report should reflect this.
- Multi-file UX uses single-PDF bundling via existing DocumentScanner. No schema change.
- Card stack doesn't handle sign flow — PRD-44 owns that.
- Analytics events non-negotiable (DOCUMENT_CARD_VIEWED, etc.).

### PRD-43 decisions
- Templates in DB (`tenant_notification_templates`).
- Deferred reminder body = count + link only, no enumerated doc list.
- One reminder system covers both deferred AND general "you haven't completed" — same notification type, same anti-spam.
- Cadence: 3d / 7d / 14d / 21d / 28d / 35d / 42d (then escalate to staff queue, stop reminding).
- Default TZ: America/New_York. Add `tenant_timezone` column only if needed during build.

### PRD-44 decisions
- Review screen mandatory between uploads and signing (v1). "Skip review" deferred to v2.
- Progress bar resets between upload and signing phases. Two distinct bars.
- PRD-20 merge decision deferred to build — coordinate then.

---

## Test environment

### Dev server
Last known: `http://localhost:3000`. Confirm with Alex.

### Stanton admin creds
- Email: `aks@stantoncap.com`
- Password: ask Alex (don't put in any file).

### Test tenant (if Maria's row is still usable)
- Token: `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`
- App ID: `6a43b66a-cc33-45b6-b18f-ca0276707736`
- **For PRD verification, prefer a FRESH not_started tenant.** Windsurf's reset script should now reset properly per PRD-40 considerations — but the previous one left `intake_submitted`, `signatures_complete`, `next_step`, and `resume_section` stale. Verify.

### chrome-devtools-mcp
Configured in `%APPDATA%\Claude\claude_desktop_config.json` with autoApprove for the standard suite (snapshot, click, fill, navigate, etc.) and `--isolated` arg. If a "browser already running" lock conflict happens, kill Chrome in Task Manager.

### Test fixtures
`C:\CursorProjects\FormStanton\tests\fixtures\` — 16 files including:
- SHA-256-identical PDFs for dedup testing (paystub-week1.pdf, paystub-week1-COPY.pdf, income-verification.pdf)
- Multi-page variants (paystub-week2.pdf, paystub-4weeks.pdf)
- Bank statements, SSI/TANF letters, ID images
- Edge cases (oversized-30mb.pdf, unsupported-document.txt, empty.pdf)

### Twilio (PRD-43 verification)
Verify with Alex whether to use real Twilio against a test phone, or a sandbox account. The infra (`lib/notifications/send.ts`) is wired; what's needed is a delivery target.

---

## Other things flagged this session

### DocumentScanner already exists
- Path: `components/DocumentScanner/DocumentScanner.tsx`
- Multi-page, blur/brightness/resolution quality scoring (opencv.js + jscanify), HEIC conversion, PDF assembly via pdf-lib, EN/ES/PT translations, full state machine (entry → processing → warning → preview → review_pages → submitting).
- Audit MISSED this — Scan buttons on each doc row are real, not placeholders. Card stack (PRD-42) leverages this as the primary upload primitive.
- The "iOS native scan" cross-platform concern I raised earlier was wrong — browser-based CV handles iOS/Android/desktop uniformly.

### Notification infra is fully wired
- `lib/notifications/send.ts` is the canonical send path. opt-out gate, email fallback (Resend), Twilio for SMS, event emission.
- Existing notification types in `lib/notifications/types.ts`: `magic_link_initial`, `magic_link_resent`, `docs_upload_reminder`, `doc_rejected`, `hach_approved_signing_ready`, `signing_reminder`, `hap_executed_move_in`.
- PRD-43 adds one new type (`pbv_preflight_checklist`) and refines the existing `docs_upload_reminder`.
- Templates table: `tenant_notification_templates`, EN/ES/PT versioned, primary key `(notification_type, language, version)`.

### Schema facts (verified)
- `application_documents`: one row per file. Unique constraint `(anchor_type, anchor_id, doc_type, person_slot, revision)`.
- Multi-file per doc = single bundled PDF (scanner already does this), NOT sibling rows.
- `ad_status_check` enum values: `'missing', 'submitted', 'approved', 'rejected', 'waived', 'flagged_for_rereview'`. PRD-40 adds `'no_longer_required'`.

### What I'm uncertain about

- Whether PRD-40 actually shipped per spec or was just marked complete. Alex said it shipped — verify by walking acceptance.
- Whether PRD-41's build is fully done. Status was "presently running" at last update.
- Whether PRD-43 is genuinely shipped or just marked. The file's status was flipped to "Shipped" in this session but I didn't see a build report.
- Whether Defects #12 and #13 are still firing. They were as of the morning audit; they may have been fixed since.
- Whether the Windsurf reset script now clears `intake_submitted`/`signatures_complete`/`next_step`/`resume_section`. The previous reset left these stale, causing magic-link routing bugs.

---

## What to do — step by step for the next chat

1. **Confirm dev server up.** Ping Alex.
2. **Get build reports.** `docs/build-reports/40-*`, `41-*`, `43-*`. If missing, escalate.
3. **Get stack traces for #12/#13.** Without these, end-to-end verification stops at sign/summary.
4. **Provision fresh `not_started` tenant.** Either via Windsurf's reset script (now hopefully complete) or by asking Alex to create a new test row.
5. **Walk PRD-40 acceptance (12 steps).** Score each. Log defects per the audit format in `tasks/TENANT_JOURNEY_2026-05-XX.md`.
6. **Walk PRD-41 acceptance (4 features).** Verify F2 is descoped, F1/F3/F4 work.
7. **Walk PRD-43 acceptance (8 steps).** SMS infra in particular — confirm body matches spec, idempotency holds, cron + anti-spam works.
8. **Fix #12/#13 if not already fixed.** Stack traces from Alex's terminal point to the root cause.
9. **Re-walk post-sign-summary flow** once #12/#13 are fixed. Reach final submission.
10. **Write verification report.** Per-PRD pass/fail with evidence. Save to `tasks/VERIFICATION_2026-05-XX.md`.
11. **Tee up PRD-42 build** once everything above is clean. Hand Windsurf the prompt at `docs/fullApp-Plan/prompts/42-pbv-tenant-document-card-stack_prompt_2026-05-17.md`.

---

## What NOT to do

- **Don't kick PRD-42 to Windsurf until PRD-40/41/43 are verified.** PRD-42 depends on all three.
- **Don't relitigate locked decisions.** All three PRDs have "Decisions resolved" sections — those were Alex's calls and aren't up for debate without explicit Alex sign-off.
- **Don't ask Alex to do things you can do in chrome-devtools.** If the dev server is up and tools are loaded, just click.
- **Don't trust status flags blindly.** "Shipped" in a PRD header means "Alex marked it shipped." Verify with a build report and a walkthrough.
- **Don't conflate Defect #8 with anything new.** It was a measurement artifact from a prior session. Admin Upload buttons work.

---

## Working style notes (carried forward)

- **Alex pushes back hard on shallow analysis.** "Just verifying the code looks right" is not enough. Click the button.
- **Don't punt runtime work back to Alex.** They have other repos. If you found the iceberg, you confirm it isn't there too.
- **Scope creep gets called out.** When Alex says "go," go. When they want to think, they'll say so.
- **Conversational tone in chat.** Tight responses. No big bullet lists unless explicitly asked.
- **.md unless explicitly requested otherwise.**
- **Acknowledge corrections fast and adjust.** Past mistakes from prior sessions: missing the DocumentScanner during the audit, conflating PRD-22 (dead) with PRD-42 (alive). Both Alex caught immediately.

---

## Key file pointers

### This handoff + prior handoff
- `tasks/HANDOFF_2026-05-17_post-prd-43-shipped.md` (this file)
- `tasks/HANDOFF_2026-05-17_tenant-verification.md` (morning session)

### Audit (defects this session is testing the fix for)
- `tasks/TENANT_JOURNEY_2026-05-17.md`

### Active PRDs (the work this verification covers)
- `docs/fullApp-Plan/40-pbv-trust-safety-polish_prd_2026-05-17.md`
- `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`
- `docs/fullApp-Plan/43-pbv-outbound-comms_prd_2026-05-17.md`

### Active PRD prompts
- `docs/fullApp-Plan/prompts/40-pbv-trust-safety-polish_prompt_2026-05-17.md`
- `docs/fullApp-Plan/prompts/43-pbv-outbound-comms_prompt_2026-05-17.md`

### Queued PRDs (NOT yet built)
- `docs/fullApp-Plan/42-pbv-tenant-document-card-stack_prd_2026-05-17.md`
- `docs/fullApp-Plan/prompts/42-pbv-tenant-document-card-stack_prompt_2026-05-17.md`
- `docs/fullApp-Plan/44-pbv-flow-continuity_prd_2026-05-17.md`
- `docs/fullApp-Plan/prompts/44-pbv-flow-continuity_prompt_2026-05-17.md`

### Build reports expected (verify these exist)
- `docs/build-reports/40-pbv-trust-safety-polish-build-report_2026-05-XX.md`
- `docs/build-reports/41-pbv-tenant-upload-ux-build-report_2026-05-XX.md`
- `docs/build-reports/43-pbv-outbound-comms-build-report_2026-05-XX.md`

### Source code anchors
- Tenant intake entry: `app/pbv-full-app/[token]/page.tsx`
- Tenant dashboard: `components/pbv/sign/TenantDashboard.tsx`
- Tenant docs upload: `components/pbv/TenantDocumentUpload.tsx` (PRD-42 replaces this)
- DocumentScanner: `components/DocumentScanner/DocumentScanner.tsx` (primary upload primitive)
- Notification send path: `lib/notifications/send.ts`
- Notification types: `lib/notifications/types.ts`
- Application events: `lib/events/application-events.ts`
- Bridge (intake → DB): `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`
- Generate-forms route (Defect #12): `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- Tenant upload route (Defect #13): `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts`

### Schema
- `application_documents`: `supabase/migrations/20260514120000_application_documents.sql`
- `application_document_revisions`: `supabase/migrations/20260515030000_application_document_revisions.sql`
- `tenant_notification_templates`: `supabase/migrations/20260514120000_tenant_notifications_unified.sql`

---

## chrome-devtools-mcp gotchas (carried forward from morning handoff)

1. **Click + immediate snapshot races React re-renders.** Use `wait_for` with a text that should appear post-click, or `evaluate_script` for programmatic click + setTimeout.
2. **`upload_file` may attach metadata without firing React onChange.** Workaround: `dispatchEvent(new Event('change', { bubbles: true }))` on the input after attaching. OR build FormData via `evaluate_script` for a fully programmatic upload (verified working pattern in morning audit).
3. **`--isolated` resets browser state between MCP launches.** Re-login admin per session.
4. **Orphan Chrome lock:** kill Chrome in Task Manager if a "browser already running" error fires.
5. **Empty 500 response bodies hide the real error.** Ask Alex for dev-server terminal trace.

---

## What I want to be honest about

Three of the PRDs are claimed-shipped but not verified by this Claude session. The morning audit found real defects in shipped code (e.g., F5 banner was "shipped per code review" but didn't render). Code-review-passes-acceptance is not the same as tenant-flow-works.

The next chat's job is the walkthrough, not more PRD writing.
