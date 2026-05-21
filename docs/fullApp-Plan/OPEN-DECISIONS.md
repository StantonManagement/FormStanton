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
   - `criminal_background_release` — upload-only (assumed) — **partially reversed by PRD-55b migration below**

**Status:** ✅ APPLIED 2026-05-20 — Migration executed on Tenant Communication project.

**Rollback:** Reverse the UPDATE statements if needed.

### `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql`
**What it does:**
1. Re-enables `criminal_background_release` (`generation_enabled=TRUE`, `category='sign'`, `source_pdf_status='sourced'`) — reverses PRD-55's upload-only classification. Source PDFs now in `assets/pbv-source-pdfs/`.
2. Re-enables `eiv_guide_receipt` (`generation_enabled=TRUE`, `source_pdf_status='sourced'`) — source + field map existed; PRD-55 wrongly left disabled.
3. Sets `generation_enabled=FALSE` for `insurance_settlement` and `cd_trust_bond` — unsourced, were silently skipping pre-batch.

**Status:** ⏳ NOT APPLIED — written + committed in PRD-55b commit. Alex applies after review.

**Rollback:** Reverse the UPDATE statements if needed.

---

## PRD-60 Decisions (logged during run)

### [PRD-60] Scanic detector stays IN for v1 — DECISION (D5)
- **Context:** PRD-60 Part B was to verify Scanic detector and decide in/out for v1.
- **Default taken:** Scanic stays IN for v1. Detector is intact: `ensureScanicLoaded` is the only path, `public/scanic/scanic.umd.cjs` exists, `createScanicAdapter` is wired. No jscanify fallback is active (dead code flagged as O3).
- **Reversible?** yes — can swap detector by changing `ensureScanicLoaded` implementation.
- **Needs Alex:** confirm v1 ship with Scanic as primary edge detector.

### [PRD-60] 3.5s hint threshold default — DECISION (D3)
- **Context:** The no-lock hint needs a time threshold before showing.
- **Default taken:** 3500ms default in `createLockTimeoutTracker`. This is faster than the previous 8s polling, but not so fast it flickers during normal seeking. Tunable via constructor param.
- **Reversible?** yes — change the default constant or pass different threshold when constructing tracker.
- **Needs Alex:** confirm 3.5s feels right in real-device testing (deferred Gate R1).

### [PRD-60] Dead jscanify factory flagged — OUT-OF-LANE (O3)
- **Context:** There may be dead `createJscanifyAdapter` factory code + `window.jscanify?` type.
- **Default taken:** NOT fixed in this lane. Only flagged for cleanup in a future maintenance PR.
- **Reversible?** n/a — cleanup only.
- **Needs Alex:** schedule dead code removal post-v1.

---

## Resolutions & corrections (2026-05-21 — Alex calls + Claude review)

### #1 [PRD-59] Summary/consent prose — RESOLVED: ship best-effort
Alex: "just put your best there." Existing `content.ts` + `consent-text.ts` are already complete best-effort (EN clean + partnership-toned; ES/PT competent). Accepted as shipping copy; do NOT gate on Dan. Native ES/PT review = recommended, non-blocking, post-launch.

### #2 [PRD-55] pet/vehicle/self-employment — RESOLVED: stay deferred
Alex: not sourcing PDFs now. Keep disabled; genuinely unsourced (not in packet; only `.docx` templates in repo root). **Revisit when PDFs are produced** → extract to `assets/pbv-source-pdfs/` + field maps + resolvers + re-enable.

### #3 [PRD-55] criminal_background_release — CORRECTION: it's a sign form, source EXISTS
Alex: "should be within the original PDF" — confirmed: pages 39–40 of `docs/templates/Full Application Package (5-28-2025 bilingual).pdf`, and extracted `docs/templates/criminal-background-release-{en,es}.pdf` already exist (+ field map exists per build report). Cascade's "upload-only" was wrong — it only checked `assets/pbv-source-pdfs/` (PRD-54 copied just 10 forms), not `docs/templates/`. **Migration already APPLIED disabling it**, so a follow-up is needed: copy PDFs → assets/, add `SOURCE_PDFS` entry + resolver, re-enable (`generation_enabled=TRUE`). Claude still has full `docs/templates/` access.

### #4 eiv / insurance_settlement / cd_trust_bond — checked
- **eiv_guide_receipt:** same as #3 — source exists (`docs/templates/eiv-guide-receipt-{en,es}.pdf`) + field map exists; left disabled as "source-pending." Can be enabled the same way. Needs Alex: should it generate?
- **insurance_settlement + cd_trust_bond:** GAP — were in the live skip list (enabled+skipping) but ABSENT from PRD-55's reconciliation → likely still enabled and silently skipping. Not in packet, no source PDFs anywhere. Confirm DB state; disable if vestigial, source if real.

---

## PRD-55b Decisions (logged during run)

### [PRD-55b] criminal_background_release re-enabled as generate-and-sign — DECISION
- **Context:** PRD-55 wrongly classified as `upload`/`generation_enabled=FALSE` because it only checked `assets/pbv-source-pdfs/`. Source PDFs existed at `docs/templates/criminal-background-release-{en,es}.pdf`; field map existed at `scripts/field-maps/criminal-background-release-{en,es}.json`.
- **Default taken:** Copied PDFs to `assets/`, added `SOURCE_PDFS['criminal_background_release']` entry, added `resolveCriminalBackgroundRelease` resolver (mirrors `resolveHachRelease` shape; populates first/middle/last name, DOB, SSN, current address split into street/city/state/zip; leaves previous address + signature image fields blank for in-person fill / signing ceremony). Migration `20260521000000_prd55b_form_sourcing_corrections.sql` sets `generation_enabled=TRUE`, `category='sign'`, `source_pdf_status='sourced'`.
- **Reversible?** yes — re-flip the migration values.
- **Needs Alex:** confirm address-split heuristic (regex `"City, ST 12345"`) handles real data; previous-address fields blank by design (not in intake).

### [PRD-55b] eiv_guide_receipt re-enabled — DECISION (O1 default)
- **Context:** PRD-55 left disabled as "source-pending" but source + field map existed; PRD-55b prompt O1 default-enable.
- **Default taken:** Copied PDFs to `assets/`, added `SOURCE_PDFS['eiv_guide_receipt']`, added minimal `resolveEivGuideReceipt` resolver (signature + date only — receipt is signature-only). Migration sets `generation_enabled=TRUE`, `source_pdf_status='sourced'`. ES PDF coordinates per existing field map (PRD-23 noted ES guide pages blank in packet — ES PDF still has a separate signature page).
- **Reversible?** yes — flip the flag.
- **Needs Alex:** confirm EIV receipt should generate alongside the HUD EIV guide (vs. only being collected on paper/upload).

### [PRD-55b] insurance_settlement + cd_trust_bond disabled — DECISION (O2 default → BLOCKER if real)
- **Context:** PRD-55b prompt notes these were in the live skip list (enabled+silently-skipping) but never appeared in PRD-55's reconciliation. Step 0 prod DB query was not run in-session (no DB credentials in this batch's tooling) — reasoned from PRD-55 build report which omits them, confirming PRD-55 did not change their state.
- **Default taken:** Migration sets `generation_enabled=FALSE`, `source_pdf_status='pending'` for both. They no longer silently skip. Not in packet, not in `docs/templates/`, no field maps, no resolvers.
- **Reversible?** yes — flip flag if source PDFs are provided.
- **Needs Alex:** confirm whether these are vestigial template rows (delete) or real HACH forms that need sourcing (BLOCKER — provide source PDFs + field-map shape; will become new PRD).
