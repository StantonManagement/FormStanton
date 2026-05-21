# PRD-56 — Signing & Submission End-to-End Correctness

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization` (one cumulative batch branch — see `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md`)
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane. This is the legal moment: a signature recorded against the wrong document, a form that looks signed but isn't, or a packet the tenant can't download is a tenant-safety / compliance defect.
**Depends on:** PRD-55 (forms must generate before they can be signed). Builds on PRD-15 (submission lock), PRD-26 (review-and-sign UI), PRD-27 (additional adults).
**Blocks:** PRD-59 (trilingual verifies this in ES/PT). Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`, gap **G6**).

---

## Problem Statement

The sign → submit chain *past* the summary is not verified on production (`/sign/forms`, per-form signing, additional adults, finalize, download). It is gated behind signing the summary, so no one has walked it live (roadmap G6). Reading the code reveals the chain is wired but has at least one **confirmed structural defect** and several **[Unverified] correctness risks** that this PRD must confirm-then-fix.

**Confirmed in code (2026-05-20):** there are two parallel, disconnected signature data models.

- The signing UI and the per-form API (`sign-form/route.ts`, `forms/route.ts`, `additional-signers/route.ts`) operate on **`pbv_form_documents`** + **`pbv_signature_events`** (`required_signer_member_ids` / `collected_signer_member_ids`, one event row per signer×form, signed-PDF stamping).
- The finalize gate (`lib/pbv/finalizeValidation.ts:67-103`) validates signatures against **`application_documents.requires_signature`** + `signer_scope` / `person_slot` — a different table the signing chain never writes to.
- The downloadable copy (`app/pbv-full-app/[token]/print/page.tsx:202-214`) reads its signatures section from a **third** table, `pbv_signature_audit_log`, which the signing chain also never writes to.

So a tenant can sign every federal form (rows in `pbv_signature_events`, `pbv_form_documents.status='signed'`) while `validateReadyToFinalize` evaluates an unrelated `application_documents` set, and the "Download my application copy" shows an empty Signatures table and **no signed PDFs at all**. The three models must be reconciled to one source of truth before submit can be trusted.

This PRD makes the sign → submit chain airtight against one model, and has the build **verify each link live and fix what's broken** rather than assume the wiring is correct.

---

## Root cause / findings (confirmed in code 2026-05-20)

| # | Finding | Where | Status |
|---|---|---|---|
| F1 | Three signature stores, not synced: signing writes `pbv_signature_events`; finalize reads `application_documents`; print reads `pbv_signature_audit_log` | `sign-form/route.ts:179-194`, `finalizeValidation.ts:67-103`, `print/page.tsx:202-214` | Confirmed |
| F2 | Magic-link `sign-form` is a stub: inserts the event but never updates `collected_signer_member_ids`, never stamps the signed PDF, never sets form `status` or `signing_status` — so an additional adult on their own link never *completes* a form | `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:84-101` | Confirmed |
| F3 | `additional-signers` "has_signed" is true if the member has **any** `pbv_signature_events` row, not all their required forms — a partial signer shows complete | `additional-signers/route.ts:41-53` | Confirmed |
| F4 | `sign-summary` deliberately writes **no** `pbv_signature_events` row (comment at `sign-summary/route.ts:134-141`) — summary signing has no audit row with document hash / IP | `sign-summary/route.ts` | Confirmed |
| F5 | HOH `sign-form` is **not** wrapped in `withIdempotency` (unlike `signature/capture`); double-submit relies on `collected_signer_member_ids` membership only | `sign-form/route.ts:36` (no `withIdempotency`) | Confirmed |
| F6 | Downloaded copy omits the signed packet: `/print` renders `intake_snapshot` + an `application_documents` table only — never the signed federal-form PDFs (`pbv_form_documents.signed_pdf_path`) or the signed summary | `print/page.tsx`, `print/download/route.ts` | Confirmed |
| F7 | `print/download` launches full `playwright` `chromium` (`print/download/route.ts:8,24`) — likely unavailable in the serverless runtime; the download may 500 on prod | `print/download/route.ts` | [Unverified] runtime |
| F8 | Submission lock is real and centralized: `withTenantContext` rejects all writes with 409 `submitted_locked` when `submitted_at IS NOT NULL`; finalize is replay-safe via `withIdempotency` + the lock | `tenantEndpoint.ts:41-48`, `finalize/route.ts` | Confirmed working (verify holds) |

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Signature capture | `components/pbv/sign/SignaturePadGate.tsx` + `components/SignatureCanvas.tsx` | Draw once, typed-name + consent, then per-form tap-confirm via `FormReviewSignModal` |
| Capture endpoint | `app/api/t/[token]/pbv-full-app/signature/capture/route.ts` | Stores PNG in `pbv-signatures` bucket, returns path; wrapped in `withIdempotency` |
| Per-form sign (HOH) | `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | Event row + collected-signer update + signed-PDF stamp when all signers complete |
| Summary sign | `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | Sets `pbv_summary_documents.signed_at`, `signing_status='summary_signed'` |
| Forms gate | `app/pbv-full-app/[token]/sign/forms/page.tsx:44` | Explainer "sign your summary first" (not a silent redirect) — working |
| Additional signers | `sign/additional-signers/page.tsx`, `AdditionalSignersPanel.tsx`, signer routes under `/api/pbv-full-app/signer/[member_token]/` | Same-device handoff + magic-link; magic-link sign-form is the F2 stub |
| Finalize | `app/api/t/[token]/pbv-full-app/finalize/route.ts` + `finalizeValidation.ts` | Lock + replay-safe; validates the **wrong** signature model (F1) |
| Submission lock | `lib/pbv/tenantEndpoint.ts:41-48` | 409 `submitted_locked` on all tenant writes once `submitted_at` set |
| Download copy | `TenantDashboard.tsx:266` → `/api/t/[token]/pbv-full-app/print/download` → `/print` | Playwright PDF of the print HTML; omits signed PDFs (F6) + uses an empty signature table (F1) |

---

## Goals

1. One signature source of truth for the tenant lane. The finalize gate, the dashboard "forms signed N of N", the additional-signers status, and the downloaded copy all read the **same** model that signing actually writes (`pbv_form_documents` + `pbv_signature_events`). Reconcile F1 to that model; retire or backfill the `application_documents`-signature and `pbv_signature_audit_log` paths for this lane. [Inference: `pbv_form_documents`/`pbv_signature_events` is the live-written model and should win.]
2. Per-form signature capture works end-to-end for the HOH: draw once, tap-confirm per form, one `pbv_signature_events` row per (signer × form) with `signed_at`, `ip_address`, `document_hash`, `ceremony_id`, `consent_text_version`; signed PDF stored at `pbv/<app>/forms/<form>-<lang>-signed.pdf`.
3. Summary signing records an audit row equivalent to a form (F4): timestamp + IP + a document hash of the summary the tenant saw, not just `signed_at`.
4. Additional adults complete forms via **both** paths: same-device handoff and member-token link. The magic-link `sign-form` does the same collected-signer update + signed-PDF stamp + status roll-up as the HOH route (fix F2). "has_signed" reflects all of a member's required forms, not any one (fix F3).
5. Submission is idempotent and locked: finalize can be replayed without double-submitting; per-form signing can be replayed without a duplicate event or a corrupt PDF (fix F5); after `submitted_at`, every tenant mutation returns 409 and no re-sign or edit is possible (confirm F8 holds across all sign endpoints).
6. "Download my application copy" yields the correct final packet: the signed federal-form PDFs + signed summary + a real signatures audit table sourced from the live model (fix F6); the download path works in the deployed runtime or is repaired (F7).

## Non-goals

- No change to **which** forms generate or their field maps — that's PRD-55 (this PRD signs whatever PRD-55 produced).
- No change to intake, intake-driven document gating, the documents-upload UX, or the dashboard banner copy (PRD-57 / PRD-58).
- No staff/HACH-side review, HACH handoff packet, or admin print posture (out of lane per roadmap).
- No new identity-verification standard (typed-name soft-match per PRD-27 stays; no OTP/photo-ID).
- No translation authoring; ES/PT *verification* of the signing chain is PRD-59. Keep existing `// PT: tentative — review` strings.

---

## Implementation phases

### Phase 1 — Reconcile to one signature model (the F1 fix)
- Confirm by reading the DB which model is actually populated by live signing: expect `pbv_form_documents.collected_signer_member_ids` + `pbv_signature_events` rows, and `application_documents.requires_signature` / `pbv_signature_audit_log` empty for the tenant lane. Treat the live-written model as canonical. [Inference — verify before changing finalize.]
- Rewrite `validateReadyToFinalize` signature check (`finalizeValidation.ts:60-104`) to read `pbv_form_documents`: ready when every non-skipped form doc has `collected_signer_member_ids ⊇ required_signer_member_ids` (i.e. `status` in `signed|finalized`), and the summary is signed. Keep the document-upload check as-is (that side is correct).
- If both signature models are genuinely populated and HACH/admin depends on `application_documents`/`audit_log`, do **not** delete the other path — instead **write through** to it from the live model (or default to the canonical model and log the cross-dependency to OPEN-DECISIONS for Alex). Do not silently drop a model another surface reads.

### Phase 2 — Per-form HOH signing, confirmed end-to-end + idempotent (F5)
- Walk (statically + via tests) the chain: `signature/capture` → `sign-form` per form → all-signed stamp → `signing_status` roll-up. Confirm one `pbv_signature_events` row per (signer × form) with `document_hash`, `ip_address`, `ceremony_id`, `consent_text_version` populated.
- Make HOH `sign-form` idempotent: wrap in `withIdempotency` keyed on `ceremony_id + form_document_id` (matching the PRD-26 design), so a retried tap can't create a duplicate event or re-stamp into a corrupt PDF. Keep the existing `collected_signer_member_ids` membership short-circuit as defense-in-depth.

### Phase 3 — Summary signing audit row (F4)
- On `sign-summary`, write a `pbv_signature_events`-equivalent audit record for the summary: `signed_at`, `ip_address`, `user_agent`, a `document_hash` of the summary PDF the tenant saw, `ceremony_id`, `consent_text_version`, and the HOH `signer_member_id`. If `pbv_signature_events.form_document_id` is NOT NULL-able, write the row to `pbv_signature_audit_log` or set `pbv_summary_documents.signature_event_id` — pick whichever the schema allows and log the choice. Do not break the existing idempotent `signed_at` behavior.

### Phase 4 — Additional adults complete via both paths (F2, F3)
- Bring `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` to parity with the HOH route: after inserting the event, update `collected_signer_member_ids`, stamp the signed PDF when all required signers are present, set form `status` and roll up `signing_status`. Factor the shared completion logic out of the HOH route so both call one function (no copy-paste drift).
- Fix `additional-signers/route.ts` "has_signed": a member is signed only when, for every form where they are in `required_signer_member_ids`, they are in `collected_signer_member_ids`. `pending_count` reflects members with at least one unsigned required form.
- Confirm same-device handoff records `device_owner='hoh_device'` and member-token records `device_owner='self'`.

### Phase 5 — Final packet (F6, F7)
- The downloaded copy must include the signed packet: the signed federal-form PDFs (`pbv_form_documents.signed_pdf_path`) + the signed summary, plus a signatures table sourced from the canonical model (Phase 1). Simplest robust approach: server-side merge the signed PDFs into one packet (e.g. `pdf-lib`, already used by the stamper) rather than relying on the print-HTML route to render them. Decide merge-vs-HTML and log it.
- Confirm `print/download` runs in the deployed runtime. If `playwright`/`chromium.launch()` (`print/download/route.ts:24`) is unavailable serverless (F7), switch the cover/summary HTML→PDF to the serverless-safe path the repo already uses for form PDFs (`pdf-lib`/the stamper), or `@sparticuz/chromium`. Default to whatever the form-generation path already depends on; log the choice.

### Phase 6 — Lock + no-post-submit-edit, confirmed (F8)
- Confirm `withTenantContext` 409 `submitted_locked` fires for every tenant mutation after `submitted_at`: `sign-form`, `sign-summary`, `signature/capture`, `intake`, document upload, `finalize` replay. Add a test that finalizes a test app then asserts each endpoint returns 409 (or, for finalize, replays the stored 200). Confirm the member-token `sign-form` (which does **not** go through `withTenantContext`) also rejects once the parent app is submitted — add the lock check there.

---

## Verification / test plan

Static gates run in-session; deploy/device gates are deferred to the build report per `BATCH-RUN-PROTOCOL.md`.

**Static (must pass before commit):**
- **Gate S1:** `validateReadyToFinalize` reads the canonical signature model; a unit test with all `pbv_form_documents` signed + summary signed returns `ready:true`, and one unsigned form returns `ready:false` with that form in `missing.signatures`.
- **Gate S2:** HOH `sign-form` wrapped in `withIdempotency`; a replay test (same `ceremony_id + form_document_id`) returns the cached response and creates no second `pbv_signature_events` row.
- **Gate S3:** member-token `sign-form` updates `collected_signer_member_ids` + stamps + rolls up status (same assertion as the HOH route) via a unit/integration test; shared completion logic is one function.
- **Gate S4:** `additional-signers` "has_signed" is per-required-form (test: member signed 1 of 2 required forms → `has_signed:false`, counted in `pending_count`).
- **Gate S5:** member-token `sign-form` returns a lock error when the parent app `submitted_at` is set.
- **Gate S6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean.

**Deferred to the post-run runtime pass (list in build report, do NOT block):**
- **Gate R1:** on a deployed preview, a single-adult household completes summary → all forms → submit; `pbv_signature_events` has one row per form with `document_hash`/`ip_address`/`ceremony_id`; signed PDFs render with the signature stamped.
- **Gate R2:** a 2-adult household completes via same-device handoff **and** via a member-token link; both adults' rows reach signed; `device_owner` is `hoh_device` / `self` respectively.
- **Gate R3:** after submit, reloading lands on a read-only state and direct API hits to each mutation endpoint return 409; finalize replay returns the original 200.
- **Gate R4:** "Download my application copy" returns a PDF that contains the signed federal forms + signed summary + a populated signatures table; the download does not 500 in the deployed runtime (F7).

---

## Open questions

- **O1 (F1):** Is `application_documents.requires_signature` / `pbv_signature_audit_log` consumed by any **staff/HACH/admin** surface? If yes, Phase 1 must write through rather than retire it. Default if unclear: keep finalize on the canonical `pbv_form_documents` model and write-through to the others, logged to OPEN-DECISIONS.
- **O2 (F4):** Does `pbv_signature_events.form_document_id` allow NULL (for a summary audit row), or must the summary audit row go to `pbv_signature_audit_log` / `pbv_summary_documents.signature_event_id`? Read the schema before Phase 3.
- **O3 (F7):** Is the deployed runtime able to run `playwright` chromium, or must the packet be assembled with `pdf-lib`? Default: assemble with `pdf-lib` (matches the form-generation dependency) to remove the serverless risk.

## Decisions

- **D1:** `pbv_form_documents` + `pbv_signature_events` is the canonical tenant-lane signature model; finalize, dashboard counts, additional-signers status, and the downloaded packet all read it. (Default per F1 evidence; revisit if O1 surfaces a staff dependency.)
- **D2:** The downloaded "application copy" is the **signed packet** (signed form PDFs + signed summary + audit table), not just an intake reprint. (Resolves F6 against the roadmap definition of done item 5.)
- **D3:** Per-form and finalize idempotency keys are client-supplied per logical action (`ceremony_id + form_document_id` for sign-form), matching PRD-15 / PRD-26. The server is store-and-replay.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/finalizeValidation.ts` | 1 | validate signatures against `pbv_form_documents` (collected ⊇ required) + summary signed |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | 2 | wrap in `withIdempotency`; extract shared completion logic |
| `lib/pbv/form-generation/*` or new `lib/pbv/signing/completeForm.ts` | 2,4 | shared "all-signed → stamp → status roll-up" used by both sign-form routes |
| `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` | 3 | write a summary audit row (hash/IP/UA/ceremony) |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | 4 | parity with HOH route + parent-app lock check |
| `app/api/t/[token]/pbv-full-app/additional-signers/route.ts` | 4 | per-required-form "has_signed" |
| `app/pbv-full-app/[token]/print/page.tsx` + `app/api/t/[token]/pbv-full-app/print/download/route.ts` | 5 | include signed PDFs + signed summary + canonical signatures; serverless-safe packet assembly |
| migration (if a new column/audit row is needed for F4) | 3 | **write + commit only, list in OPEN-DECISIONS, do NOT apply to prod** |
| new tests | S1–S5 | finalize model, sign-form idempotency, member-token parity, has_signed, post-submit lock |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md` rather than expanding scope.
