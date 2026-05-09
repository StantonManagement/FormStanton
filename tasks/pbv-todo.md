# PBV Full Application — Running TODO

_Last updated: 2026-05-09_

---

## Phase Status
- **Phase 6 (Admin detail + HHA generation):** UI + API compiled, HHA template upload wired, bulk export wired. Needs live data check and template in storage.
- **Phase 7 (Access controls + audit log):** **Not started.** No access-log writes, no role gating beyond default session check.

---

## What Works Right Now
1. **Admin List (`/admin/pbv/full-applications`)**  
   - Filters by status/building/intake-needed  
   - Invitations via modal  
   - Row click + action links navigate to detail
2. **Admin Detail (`/admin/pbv/full-applications/[id]`)**  
   - Household + income math panel (claimed vs documented)  
   - Document status summary + per-slot indicators  
   - Stanton review panel (status/reviewer/notes)  
   - Actions: HHA generation (requires template), HACH package download, magic link copy/regenerate  
   - Link to per-document review (`/admin/form-submissions/[form_submission_id]`)
3. **Per-Document Review (`/admin/form-submissions/[id]`)**  
   - Approve / reject / waive per slot  
   - Revision history + document download  
   - Tenant token regenerate + ZIP export
4. **Tenant Intake (`/pbv-full-app/[token]`)**  
   - 7-section trilingual form  
   - Household repeating groups  
   - Income/assets/expenses/background/circumstances  
   - Multi-signer flow (per adult)  
   - `docs_ready` state links to submission portal
5. **Tenant Document Portal (`/t/[formSubmissionToken]`)**  
   - Per-document status  
   - Upload for missing/rejected docs  
   - Auto-refresh after upload  
   - Language toggle EN/ES/PT

---

## Immediate Follow-Ups
1. **Seed check:** Confirm `form_document_templates` contains rows for `form_id = 'pbv-full-application'` in the target environment.
2. **HHA template:** Upload `hha-templates/hca-application.docx` (supabase storage) before testing generation/export.
3. **QA pass:** Walk through invite → intake → signatures → document upload → admin review on dev data.
4. **Phase 7 design:** Define access log events + `pbv_reviewer` role gating per PRD §Phase 7.

---

## Open Questions / Blockers
- Do we have final HHA template copy from HACH? (PRD §Open Questions)
- Who is assigned the `pbv_reviewer` role? Need list before access-control work.
- Conditional document filtering (`conditional_on`) — confirm tenant portal applies project rules once templates seeded.

---

## Next Check-In
- After QA run-through and HHA template upload, decide whether to start Phase 7 or address conditional-doc logic first.
