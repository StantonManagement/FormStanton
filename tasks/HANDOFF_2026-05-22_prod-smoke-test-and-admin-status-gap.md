# HANDOFF — PBV prod smoke test PASSED; investigate admin status not reflecting tenant submission

**Date:** 2026-05-22 · **Env:** prod (`form-stanton.vercel.app`), merged to `main` · **Supabase:** `lieeeqqvshobnqofcdac`

---

## Paste-into-new-chat prompt

> The PBV post-audit remediation is merged to main and live on prod. I ran a full tenant smoke test on prod and it passed end-to-end, but I found a tenant↔staff mismatch I want investigated. Read your PBV memory (`state-pbv-current`, `PBV Strategy`, `feedback-browser-chromedevtools`) first.
>
> **What passed (verified):** a brand-new prod app went invite → 7 intake sections → submit → sign summary → sign all 11 forms incl. `eiv_guide_receipt` → upload ID + paystubs → **finalize = HTTP 200** with body `{"success":true,"data":{"submitted_at":"2026-05-23T00:33:53.518Z","already_submitted":false}}`, no `missing`. Tenant dashboard shows "Application Submitted." Summary + per-form PDF iframes render correctly in prod.
>
> **The problem to investigate:** after that successful tenant finalize, the **staff admin still shows the app as not submitted** (corroborated across list + detail, hard-reloaded twice):
> - List `/admin/pbv/full-applications`: status **"Invited"**, Intake Submitted **"—"** (other submitted apps like "Richie Rich" correctly show "Intake Submitted").
> - Detail `/admin/pbv/full-applications/52ab102b-eb1b-491f-9676-c9e893852d10`: badge **"Pending"**, INTAKE SUBMITTED **"—"**, SIGNATURES **0/1**, DOCS APPROVED 0/23.
> - BUT the detail body DID receive the intake income ($30,000, HOH 37yr) and the uploaded paystub (`paystubs_r1.pdf` = SUBMITTED). So row data propagates; the top-level status / `intake_submitted_at` / signature-count aggregates do not.
>
> **Task:** trace the tenant finalize handler (`app/api/t/[token]/pbv-full-app/finalize` + whatever it calls) against what the admin list/detail read for status, `intake_submitted_at`, and the signatures counter. Determine whether the finalize fails to write those staff-facing fields, whether they're driven by a separate trigger/cadence, or whether "Invited / —" pre-review is expected. Report findings; **default deliverable is a PRD/prompt for Windsurf, NOT code**, unless I say "just fix it."
>
> Note this is NOT confirmed as a merge regression — prior verification only ever checked the tenant-side finalize HTTP, never admin propagation, so the gap may predate the merge.

---

## Key identifiers
- **Test app:** `Prod Smoke Tester`, 900 Prod Smoke Ave / PS-1 — app id `52ab102b-eb1b-491f-9676-c9e893852d10`, token `900-prod-smoke-ave-unit-ps-1-vVd0a4iVAdKj4Dnk` (finalized; lives in prod DB, visible to HACH-facing staff — remove when done).
- **Finalize endpoint:** `POST /api/t/<token>/pbv-full-app/finalize`
- Reused fixtures from `_qa_test_docs/` (photo_id_drivers_license.png, pay_stubs_income.pdf) — no new test files created.

## Operating notes
- Browser walks use `mcp__chrome-devtools__*` (the Claude-in-Chrome extension is blocked here). Admin needs a manual super-admin login in the attached Chrome.
- Git read failed (exit 128) from the sandbox this session — index/lock issue; run git natively on Windows.
- Prior handoff: `tasks/HANDOFF_2026-05-22_pbv-tenant-flow-verified.md` (the tenant-flow fixes that this smoke test validated in prod).
