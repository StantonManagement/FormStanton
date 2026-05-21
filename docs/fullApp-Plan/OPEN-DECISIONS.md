# Open Decisions — PBV Full-App Finalization batch (PRDs 55–61)

Decisions deferred during the autonomous batch run, for Alex to resolve **after** the run. See `BATCH-RUN-PROTOCOL.md` for the format. Cascade appends here instead of stopping to ask.

Entry format:

```
### [PRD-NN] <short title>   — <DECISION | BLOCKER | MIGRATION-TO-APPLY>
- **Context:** what was ambiguous / what's needed.
- **Default taken:** what you did and why (or "none — blocked").
- **Reversible?** yes/no + how to change it later.
- **Needs Alex:** the specific question to resolve post-run.
```

---

## Pre-seeded (known before the run)

### [PRD-55] briefing_cert renders as stamped PDF, not HTML pilot — DECISION (resolved)
- **Context:** `briefing_cert` skipped in prod; an `app/pilot/briefing-cert/` HTML exploration also exists.
- **Default taken:** treat as a stamped PDF (PDF-overlay is the production path per `form-execution-plan_2026-05-14.md`; HTML rendering was tried and abandoned). Fix is the source-pdfs registry key.
- **Reversible?** yes — if HTML rendering is ever revived, revisit.
- **Needs Alex:** confirm, no action expected.

### [PRD-55] sign-vs-upload classification for criminal_background_release, eiv_guide_receipt, insurance_settlement, cd_trust_bond — needs Alex
- **Context:** these are `generation_enabled=true` but skip; some appear on the documents page as uploads. Unclear if they're stamped-and-signed or uploaded.
- **Default taken:** (Cascade to fill during PRD-55) — likely set `generation_enabled=false` for any that are upload-only / source-pending, logged as MIGRATION-TO-APPLY.
- **Reversible?** yes — flip the flag back.
- **Needs Alex:** confirm sign-vs-upload per form against HACH intake expectation.

---

## Logged during the run

### [PRD-55] Pet/Vehicle/Self-Employment forms disabled — MIGRATION-TO-APPLY
- **Context:** `pet_addendum`, `vehicle_addendum`, `self_employment_worksheet` are conditional forms that should generate when household has pets/vehicle/self-employment, but they have no source PDFs or field maps.
- **Default taken:** Set `generation_enabled=FALSE` for all three in migration `20260520000000_prd55_form_generation_alignment.sql`. They will no longer silently skip — instead they're explicitly disabled until assets are sourced.
- **Reversible?** yes — re-enable by setting `generation_enabled=TRUE` and ensuring source PDFs exist in `assets/pbv-source-pdfs/` and field maps in `scripts/field-maps/`.
- **Needs Alex:** confirm these forms ARE wanted for generation (not upload-only). Source the PDFs and re-enable when ready.

### [PRD-55] criminal_background_release as upload-only — MIGRATION-TO-APPLY
- **Context:** `criminal_background_release` has field maps but no source PDFs. It appears on the documents page as an upload slot.
- **Default taken:** Set `generation_enabled=FALSE`, `category='upload'` in migration. Assumption: this is an office-provided form that tenants upload, not a generated/stamped form.
- **Reversible?** yes — if this IS a generated form, source the PDFs and re-enable.
- **Needs Alex:** confirm `criminal_background_release` is upload-only vs sign-generated. If generated, source PDFs needed.

### [PRD-59] Real EN/ES/PT summary + consent prose needs human authoring — DECISION
- **Context:** The signed summary document and consent flow contain prose that must be legally accurate and culturally appropriate. Machine translations are insufficient for this content.
- **Default taken:** Built against current `// CONTENT: tentative` / `// CONSENT: tentative` draft strings in `lib/pbv/summary-doc/content.ts` and `lib/pbv/consent-text.ts`. All mechanical string tables (docTypeHelp.ts, docContent.ts) are complete; only the narrative prose remains tentative.
- **Reversible?** yes — update the marked strings and remove the tentative comments when final copy is ready.
- **Needs Alex:** Review tentative prose with Dan and a professional translator for EN/ES/PT parity. Mark final when approved.

### [PRD-59] Tentative summary/consent acceptable to ship behind — DECISION
- **Context:** The batch needs to complete without blocking on final legal copy.
- **Default taken:** Tentative strings are acceptable for internal/staging deploy. They are clearly marked `// CONTENT: tentative — review with Dan + translator` and `// CONSENT: tentative` for grep-ability.
- **Reversible?** yes — replace with final copy when available; no code changes needed.
- **Needs Alex:** Confirm go/no-go for staging deploy with tentative prose. Production deploy should wait for final copy.

---

## Prod migrations to apply (do NOT auto-apply — Alex applies after review)

### `supabase/migrations/20260520000000_prd55_form_generation_alignment.sql`
**What it does:**
1. Renames `briefing_docs_certification` → `briefing_cert` in `pbv_form_templates` and `pbv_form_documents`
2. Sets `generation_enabled=FALSE` for:
   - `pet_addendum` — missing source PDFs
   - `vehicle_addendum` — missing source PDFs
   - `self_employment_worksheet` — missing source PDFs
   - `criminal_background_release` — upload-only (assumed)

**When to apply:** After Alex reviews and confirms the classifications (especially `criminal_background_release`).

**Rollback:** Reverse the UPDATE statements if needed.
