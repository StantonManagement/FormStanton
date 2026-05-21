# Windsurf Build Prompt — PRD-56: Signing & Submission End-to-End Correctness

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/56-pbv-signing-and-submission-e2e_prd_2026-05-20.md`. Read it next.

The sign → submit chain past the summary is wired but **not verified on prod** (roadmap G6), and reading the code shows it depends on **three disconnected signature stores**. Your job is to reconcile to one model, confirm each link, and fix what's broken. Treat unwalked behavior as `[Unverified]`: confirm it (statically + with tests), then fix.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (already created off `main`, already has the PRD-55 commit). Do **not** create a per-PRD branch.
- One commit when done: `PRD-56: signing & submission end-to-end correctness`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- If F4 needs a schema/column change (summary audit row), **write + commit the migration; do NOT apply it to prod** (`lieeeqqvshobnqofcdac`). List it under "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`. No DROP/DELETE/TRUNCATE/un-WHERE'd UPDATE.
- `.git/config` is **not** broken (verified 2026-05-20) — don't "fix" line 23. If git genuinely errors, log a BLOCKER.

---

## The core defect (read the PRD F-table for the rest)

There are three signature stores and they are not synced:
1. **Signing writes** `pbv_form_documents` (`collected_signer_member_ids` / `required_signer_member_ids`, `status`) + `pbv_signature_events` (one row per signer×form).
2. **Finalize reads** `application_documents.requires_signature` (`finalizeValidation.ts:60-104`) — a table the signing chain never writes to.
3. **Download reads** `pbv_signature_audit_log` (`print/page.tsx:202-214`) — also never written by signing.

Result: a fully-signed application can fail (or wrongly pass) finalize, and the downloaded copy shows an empty signatures table and **no signed PDFs**. Reconcile everything to model #1 (the live-written one). Confirm against the DB that #1 is populated and #2/#3 are empty for the tenant lane before changing finalize.

---

## Step-by-step

### Step 0 — Confirm the live model
Read the DB for a real/test application: confirm `pbv_form_documents` + `pbv_signature_events` are what signing populates and `application_documents.requires_signature` / `pbv_signature_audit_log` are empty for the tenant lane. This makes model #1 canonical. If #2/#3 are *also* populated (a staff/HACH surface may read them), do **not** delete them — write-through from #1 and log to OPEN-DECISIONS (O1).

### Step 1 — Reconcile finalize to the canonical model (F1)
Rewrite the signature check in `lib/pbv/finalizeValidation.ts` to read `pbv_form_documents`: `ready` requires the summary signed **and** every non-`skipped` form doc has `collected_signer_member_ids ⊇ required_signer_member_ids`. Populate `missing.signatures` from unsigned form docs. Leave the document-upload check as-is.

### Step 2 — Per-form HOH signing: confirm + make idempotent (F5)
Confirm `signature/capture` → `sign-form` (per form) → all-signed stamp → `signing_status` roll-up produces one `pbv_signature_events` row per (signer×form) with `document_hash`, `ip_address`, `ceremony_id`, `consent_text_version`. Wrap HOH `sign-form/route.ts` in `withIdempotency` keyed on `ceremony_id + form_document_id` (it currently is **not** wrapped). Keep the `collected_signer_member_ids` membership short-circuit as defense-in-depth.

### Step 3 — Summary audit row (F4)
`sign-summary` currently writes only `pbv_summary_documents.signed_at` and explicitly skips an audit row (comment at lines 134-141). Add an audit record for the summary with `signed_at`, `ip_address`, `user_agent`, a `document_hash` of the summary PDF the tenant saw, `ceremony_id`, `consent_text_version`, HOH `signer_member_id`. Pick the store the schema allows (`pbv_signature_events` with nullable `form_document_id`, else `pbv_signature_audit_log`, else `pbv_summary_documents.signature_event_id`); read the schema first and log the choice (O2). Don't break the idempotent `signed_at` path.

### Step 4 — Additional adults complete via both paths (F2, F3)
The member-token route `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` is a **stub** — it inserts the event but never updates `collected_signer_member_ids`, never stamps the signed PDF, never sets status. Bring it to parity with the HOH route by **extracting the shared completion logic** (all-signed → stamp signed PDF → set `status` / `finalized_at` → roll up `signing_status`) into one function both routes call (e.g. `lib/pbv/signing/completeForm.ts`). Fix `additional-signers/route.ts`: a member `has_signed` only when, for every form where they're a required signer, they're in `collected_signer_member_ids` (currently it's true on **any** event). Confirm `device_owner` is `hoh_device` for same-device, `self` for member-token.

### Step 5 — Final packet (F6, F7)
"Download my application copy" (`TenantDashboard.tsx:266` → `print/download/route.ts` → `/print`) must include the **signed packet**: signed federal-form PDFs (`pbv_form_documents.signed_pdf_path`) + signed summary + a signatures table from the canonical model. Prefer server-side merge of the signed PDFs with `pdf-lib` (already used by the stamper) over relying on the print-HTML route. `print/download/route.ts:24` launches full `playwright` chromium — confirm that runs in the deployed runtime; if not (F7), assemble the packet with `pdf-lib` / the stamper path the repo already ships, or `@sparticuz/chromium`. Default to the `pdf-lib` path; log the choice.

### Step 6 — Lock holds everywhere (F8)
`withTenantContext` (`tenantEndpoint.ts:41-48`) already returns 409 `submitted_locked` once `submitted_at` is set. Confirm it covers `sign-form`, `sign-summary`, `signature/capture`, `intake`, document upload, `finalize` replay. The member-token `sign-form` does **not** go through `withTenantContext` — add a parent-app lock check there. Add a test that finalizes a test app then asserts each endpoint rejects (or finalize replays the stored 200).

### Step 7 — Static gates + build report + commit
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green. Build report at `docs/build-reports/56-pbv-signing-and-submission-e2e_build-report_2026-05-20.md`. Commit `PRD-56: …`. Then **proceed to the PRD-57 prompt.**

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/finalizeValidation.ts` | validate signatures vs `pbv_form_documents` (collected ⊇ required) + summary signed |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | `withIdempotency` (ceremony_id + form_document_id); call shared completion logic |
| `lib/pbv/signing/completeForm.ts` (new) | shared all-signed → stamp → status roll-up, used by both sign-form routes |
| `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | summary audit row (hash/IP/UA/ceremony) |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | parity with HOH route + parent-app lock check |
| `app/api/t/[token]/pbv-full-app/additional-signers/route.ts` | per-required-form `has_signed` / `pending_count` |
| `app/pbv-full-app/[token]/print/page.tsx`, `app/api/t/[token]/pbv-full-app/print/download/route.ts` | include signed PDFs + signed summary + canonical signatures; serverless-safe assembly |
| migration (only if F4 needs it) | **commit only, list in OPEN-DECISIONS, do not apply** |
| new tests | finalize model, sign-form idempotency, member-token parity, has_signed, post-submit lock |

## Files NOT to touch

- Form **generation** / field maps / which forms exist (PRD-55).
- Intake, intake-driven document gating, document-upload UX, dashboard banner copy (PRD-57 / PRD-58).
- Staff/admin/HACH review or print posture (out of lane).
- Translation content — keep existing `// PT: tentative — review` strings; ES/PT chain verification is PRD-59.
- Identity-verification standard (typed-name soft-match from PRD-27 stays).

---

## Verification gates (per PRD-56)

**Static (must pass in-session before commit):**
- **S1:** finalize unit test — all form docs signed + summary signed → `ready:true`; one unsigned → `ready:false` with that form in `missing.signatures`.
- **S2:** HOH `sign-form` replay (same ceremony_id + form_document_id) returns cached response, no second `pbv_signature_events` row.
- **S3:** member-token `sign-form` updates collected signers + stamps + rolls up status (same assertion as HOH); completion logic is one shared function.
- **S4:** `additional-signers` `has_signed` is per-required-form (member signed 1 of 2 → `has_signed:false`, counted pending).
- **S5:** member-token `sign-form` rejects when parent app `submitted_at` is set.
- **S6:** `tsc --noEmit` + `npm run build` clean.

**Deferred to the post-run runtime pass (list in build report, do NOT block):**
- **R1:** deployed walk — single adult: summary → all forms → submit; one event row per form with hash/IP/ceremony; signed PDFs render stamped.
- **R2:** 2-adult household via same-device handoff **and** member-token link; both reach signed; `device_owner` correct.
- **R3:** after submit, reload is read-only; each mutation endpoint returns 409; finalize replay returns original 200.
- **R4:** "Download my application copy" returns a packet containing signed forms + signed summary + populated signatures table; no 500 in the deployed runtime.

---

## What "done" looks like

1. `PRD-56: …` commit on `feat/pbv-full-finalization`; any migration committed + listed in OPEN-DECISIONS (not applied).
2. Static gates S1–S6 green.
3. One canonical signature model: finalize, dashboard counts, additional-signers status, and the downloaded packet all read `pbv_form_documents` + `pbv_signature_events`.
4. Both sign-form routes share completion logic; magic-link adults complete forms; summary signing has an audit row.
5. Lock holds across every mutation incl. member-token; finalize replay-safe.
6. Build report written, deferred runtime gates (R1–R4) listed for the post-run pass. Proceed to PRD-57.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (O1/O2/O3 are pre-framed defaults).
- Do not delete a signature store another surface might read — write-through and log instead.
- Do not apply the migration to prod. No destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23.
- Do not change which forms generate, intake, or document-upload UX.
- Do not block on deploy-only gates — defer R1–R4 to the build report.

## Reporting back (in the build report)

- Commit SHA; migration file path if any (listed in OPEN-DECISIONS).
- Which signature model was confirmed canonical (Step 0 finding) + how F1 was reconciled.
- Per-fix status for F1–F8 (fixed / confirmed-already-correct / deferred-with-reason).
- Decisions logged to OPEN-DECISIONS (O1 staff-dependency, O2 summary audit store, O3 packet assembly).
- Deferred runtime gates R1–R4 for the post-run pass.
