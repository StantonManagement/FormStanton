# Handoff — PBV intake→signing fix + form-rendering review

**Date:** 2026-05-31
**Context:** Cowork session. Trigger: "why didn't Mia Lozada sign her documents." Investigation used live DB reads (Supabase `lieeeqqvshobnqofcdac`) and the FormStanton repo. Deliverables are three PRDs + build prompts in `docs/fullApp-Plan/`.

---

## Status in one line

Mia (and one other real applicant) completed intake but were never prompted to sign — a notification template was missing in prod. Root cause is diagnosed and confirmed in code + data. Three PRDs are written and build-ready; they must run in a specific order because the form documents also have a rendering defect that has to be fixed before anyone signs.

---

## What was diagnosed

When a tenant finishes PBV intake, the system sends a `pbv_preflight_checklist` SMS — the handoff that links them into signing. That send **failed silently** for every applicant who completed intake before **2026-05-29 02:23 UTC**, because the notification template rows didn't exist in prod until then.

Confirmed:
- `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:96-98` fires `PBV_PREFLIGHT_CHECKLIST` on intake completion.
- `lib/notifications/send.ts:76-103` looks up the active template by `(notification_type, language, active)`. On a miss it logs `template_missing`, emits `NOTIFICATION_FAILED`, and returns — **no throw, no retry, no operator signal.**
- `tenant_notification_templates` rows for `pbv_preflight_checklist` (en/es/pt) were created 2026-05-29 02:23 UTC.
- `application_events` holds 8 `template_missing` events (5/20–5/27).

**Affected real applicants (intake complete, 0 signed, valid `tenant_access_token`):**
- **Mia Enid Lozada** — `2b451d4e-6578-43e6-9689-450cadcc62fe`, intake 5/27
- **Santha Lee Degross** — `00d613e5-1573-4a7b-ab98-73a46ca4d681`, intake 5/26

The other 6 `template_missing` apps were QA/walk-test accounts. **`Claudia Ferreira`** (`ffffcafe…aa02`) is also intake-complete/unsigned but pre-dates the preflight notification (no `template_missing` event) — needs separate triage (real vs seed).

A second, unrelated config failure is in the same log: `magic_link_initial` failed twice on 5/20 with `PBV_TWILIO_PHONE_NUMBER not configured` — confirm prod env.

---

## Second issue surfaced: form field-map rendering defects

The generated form documents have spacing/placement defects (overlapping fields, text past its box, values in the wrong region). The defect is **template-level** — in the field maps (`FieldMap` shape in `lib/pbv/form-generation/stamper.ts`; rendered by `stampForm`, pdf-lib, bottom-left origin) — not per-applicant. Editing already-signed PDFs is the wrong fix (compliance, HUD/HACH forms): correct the field map and regenerate.

**Consequence:** Mia and Santha must not be re-notified on their current documents — they'd sign the defective version.

---

## Deliverables (in `docs/fullApp-Plan/`)

- **PRD-85** `85-pbv-intake-signing-notification-reliability_prd_2026-05-31.md` (+ `-prompt_`)
  Makes a failed handoff retryable + operator-visible; seed-presence assertion migration so a missing template is caught before an applicant hits it; one-time backfill to re-notify Mia + Santha (gated — see sequencing).
- **PRD-86** `86-pbv-field-map-authoring-and-preview-component_prd_2026-05-31.md` (+ `-prompt_`)
  Reusable component: upload a document → propose field placement → grayed-out spacing preview → text-filled preview → approve, emitting the `FieldMap` artifact `stampForm` consumes. Built-in geometric + OCR-round-trip validators. Phase A = standalone tool that fixes the current 11 PBV maps and regenerates Mia/Santha docs. Phase B = in-app admin feature. Default OCR engine = Tesseract (confirm dependency at build).
- **PRD-87** `87-pbv-pre-send-document-review-ui_prd_2026-05-31.md` (+ `-prompt_`)
  Operator UI to review an applicant's rendered package before the signing prompt sends; gates the `pbv_preflight_checklist` send behind explicit "Approve & send." Approval is bound to a **content hash over rendered bytes** (`hash(sorted (form_id, unsigned_pdf_hash))`) so a regeneration voids a stale approval. (Inputs-based hash was considered and rejected — it would ship a renderer-changed package on a stale approval.)

---

## Critical sequencing (encoded in all three prompts)

**PRD-86 Phase A → PRD-87 → PRD-85 Phase 4.**
Correct field maps and regenerate Mia/Santha docs (86A) → operator reviews each rendered package and approves (87) → only then re-notify Mia/Santha to sign (85 Phase 4).
PRD-85 Phases 1–3 (retry / observability / operator surface) are independent and can land first. PRD-85 and PRD-87 both touch the `pbv_preflight_checklist` send path — land in agreed order; the changes are composable (no approval blocks the send, a missing template is retried).

---

## Pending for Alex (can't be done from the sandbox)

1. Run the three build prompts (Windsurf / coding agent) — in 86→87→85 order for the Mia/Santha path.
2. Apply PRD-85's notification-template seed-presence migration via Supabase MCP / `db push` (migration written, not applied).
3. Confirm the OCR dependency choice for PRD-86 (default Tesseract).
4. Decide which staff role may approve a PRD-87 pre-send review (any staff vs. `send_to_hach` holders, Tess/Kristine) — the one open decision flagged for that build.
5. Triage `Claudia Ferreira` (real applicant vs seed).
6. Confirm `PBV_TWILIO_PHONE_NUMBER` is set in prod.

---

## Open decisions logged

- PRD-85: retry cadence/max attempts (default 3 / 24h); handoff state event-derived vs. a `handoff_status` column (default: event-derived).
- PRD-87: approver role (item 4 above); viewer serves stored `unsigned_pdf_path` vs. re-render (default: serve stored).
