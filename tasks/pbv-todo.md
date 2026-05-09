# PBV Full Application — Running TODO

_Last updated: 2026-05-09_

---

## Phase Status
- **Phase 6 (Admin detail + HHA generation):** Complete. All UI + API routes verified. `appfolio_update_queue` view applied. 33 document templates seeded.
- **Phase 7 (Access controls + audit log):** **Complete.** `pbv_access_log` writes on HHA generation and HACH export. `read_ssn` permission + gated SSN endpoint at `/api/admin/pbv/full-applications/[id]/ssn/[memberId]`. Conditional doc filtering confirmed wired at intake time.

---

## What Works Right Now
1. **Admin List (`/admin/pbv/full-applications`)** — filters, invite modal, navigation
2. **Admin Detail (`/admin/pbv/full-applications/[id]`)** — household/income panel, doc status, review panel, HHA + export actions
3. **Per-Document Review (`/admin/form-submissions/[id]`)** — approve/reject/waive, revision history, ZIP export
4. **Tenant Intake (`/pbv-full-app/[token]`)** — 7-section trilingual form, multi-signer flow, conditional doc seeding
5. **Tenant Document Portal (`/t/[formSubmissionToken]`)** — per-doc upload, auto-refresh, language toggle
6. **AppFolio Queue (`/admin/pbv/appfolio-queue`)** — shows phone/language diffs vs AppFolio

---

## Remaining (Non-Blocking)
1. **HHA template:** Upload `hca-application.docx` to `hha-templates` bucket in Supabase storage before first live generation.
2. **`pbv_reviewer` role assignment:** Assign the `pbv-full-applications:read_ssn` permission to the relevant role(s) in the DB, then assign those roles to the appropriate users.
3. **SSN UI:** Optionally surface the SSN reveal button on the admin detail page (calls `/api/admin/pbv/full-applications/[id]/ssn/[memberId]`).

---

## Open Questions
- Do we have final HHA template copy from HACH?
- Who gets `pbv_reviewer` access (SSN read)?
