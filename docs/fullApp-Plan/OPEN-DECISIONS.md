# Open Decisions — PBV Full-App Finalization batch (PRDs 55–61) + Launch-Hardening batch (PRDs 62–67)

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

### `supabase/migrations/20260521060000_prd72_form_display_name_pt_backfill.sql`
**What it does:** Backfills `display_name_pt` for every `pbv_form_templates` row with best-effort PT translations (per PRD-59 / PRD-72 O1 posture — flagged for native PT review). The column was added by `20260515040000_pbv_form_templates.sql` but is NULL on every row in the seed and all subsequent migrations; until this lands, a tenant with `preferred_language='pt'` sees English names on the HOH forms list and on the magic-link signer page.

Idempotent per-row UPDATEs. Handles both `briefing_cert` (post-PRD-55) and `briefing_docs_certification` (pre-PRD-55) so the migration works regardless of whether `20260520000000_prd55…` has been applied to the target env.

**Used by:** the PRD-72 route changes ([forms route](../../app/api/t/[token]/pbv-full-app/forms/route.ts), [signer route](../../app/api/pbv-full-app/signer/[member_token]/forms/route.ts), [mapper](../../lib/pbv/signer-forms-mapping.ts)) — they already select `display_name_pt` and pick it for `lang === 'pt'`. With the column unpopulated, the fallback chain (`pt → en → form_id`) returns English. With this migration applied, `pt` tenants see PT.

**Apply order:** can be applied any time after `20260515040000_pbv_form_templates.sql` (which is APPLIED). Safe to apply before or after `20260521000000_prd55b…` because the `briefing_*` UPDATE targets both forms of the form_id.

**Status:** ⏳ NOT APPLIED — written + committed in PRD-72 commit (`4500f6c`). Alex applies after native PT review of the values below.

**Full PT-value table (for native review — apply against this single artifact, not by grepping migrations):**

| form_id | display_name_pt (best-effort) |
|---|---|
| `main_application` | Pedido HCV de Ocupação Continuada |
| `citizenship_declaration` | Declaração de Cidadania |
| `obligations_of_family` | Obrigações da Família |
| `hud_9886a` | HUD-9886-A Autorização para Divulgação de Informações |
| `hach_release` | Autorização HACH para Divulgação de Informações |
| `hud_92006` | Formulário de Contato Suplementar HUD-92006 |
| `child_support_affidavit` | Declaração Juramentada de Pensão Alimentícia |
| `no_child_support_affidavit` | Declaração Juramentada de Ausência de Pensão Alimentícia |
| `pet_addendum` | Adendo de Animais de Estimação |
| `vehicle_addendum` | Adendo de Veículo |
| `self_employment_worksheet` | Planilha de Renda de Trabalho Autônomo |
| `briefing_cert` / `briefing_docs_certification` | Certificação Familiar de Recebimento de Documentos de Orientação |
| `debts_owed_phas` | Dívidas com Autoridades de Habitação (HUD-52675) |
| `vawa_certification` | Certificação VAWA (HUD-5382) |
| `reasonable_accommodation_request` | Pedido de Adaptação Razoável |
| `zero_income_statement` | Declaração de Renda Zero |
| `eiv_guide_receipt` | Recibo do Guia EIV |
| `criminal_background_release` | Autorização de Antecedentes Criminais |

**Rollback (data only — schema unchanged):** `UPDATE public.pbv_form_templates SET display_name_pt = NULL;`. The route fallback chain (`pt → en → form_id`) means rollback is safe — `pt` tenants see English again, not slugs.

### `supabase/migrations/20260521050000_prd69_pbv_storage_buckets_backfill.sql`
**What it does:** Backfills the creation rows for three storage buckets that were created live by hand on prod alongside their app code and never had a migration:
- `pbv-signatures` (signature PNG images)
- `form-submissions` (default tenant document bucket)
- `pbv-applications` (e-signed PDFs + HACH-shared docs)

Modeled on `20260518000000_pbv_forms_storage_bucket.sql` (the established precedent for the same situation). One `INSERT INTO storage.buckets … ON CONFLICT (id) DO NOTHING;` covering all three. No `storage.objects` policies (service-role-only access; mirrors the `pbv-forms` precedent).

**Why it's needed:** A fresh environment provisioned from `supabase/migrations/` alone had `pbv-forms` but not the other three → every tenant upload, signature capture, and signed-PDF read 404'd. This is the same class of gap as the queued `tenant_lookup` table (no `CREATE TABLE` migration).

**Status:** ✅ APPLIED 2026-05-21 — All three buckets confirmed present.

**⚠ Reconcile-before-apply checklist (for fresh-env apply, NOT for prod apply):**
The live-DB verification audit that would have given authoritative `file_size_limit` / `allowed_mime_types` / `storage.objects` policy values for each bucket was not available at build time. The migration ships with `public=false`, `file_size_limit=NULL`, `allowed_mime_types=NULL` (permissive, safe for prod via `DO NOTHING`). Before standing up a brand-new environment for **production use**, run on prod:
```sql
select id, public, file_size_limit, allowed_mime_types
  from storage.buckets
 where id in ('pbv-signatures','form-submissions','pbv-applications');

select policyname, cmd, qual, with_check
  from pg_policies
 where schemaname='storage' and tablename='objects';
```
and update the migration's `VALUES` (+ add any `CREATE POLICY` blocks the audit reveals) so fresh-env config matches prod. The header comment in the migration carries this same warning inline.

**On the existing prod project:** safe to apply as-is — `ON CONFLICT (id) DO NOTHING` makes it a complete no-op, but applying it is also unnecessary (prod already has these buckets). Apply only when fresh-env provisioning is on the table.

**Rollback:** Buckets cannot be deleted while objects exist. For fresh-env-only rollback: `DELETE FROM storage.buckets WHERE id IN ('pbv-signatures','form-submissions','pbv-applications');`. Never delete these on prod.

### `supabase/migrations/20260521040000_prd66_form_generation_version.sql`
**What it does:** Adds `pbv_form_documents.generation_version INTEGER NOT NULL DEFAULT 1`, the monotonic regeneration counter. The unsigned-PDF storage path is now suffixed `-v${generation_version}.pdf` (see `generate-forms/route.ts`) so a regenerate during signing produces a NEW object instead of clobbering bytes a prior signer hashed. Enforcement of "signed-against version no longer matches current" rides PRD-62's `unsigned_pdf_hash` + `finalizeValidation` Check 5.

**Used by:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`.

**Apply order:** Apply BEFORE deploying the PRD-66 code change. The route writes `generation_version` on every upsert; if the column isn't there, generate-forms 500s. The DEFAULT 1 fills existing rows safely.

**Status:** ✅ APPLIED 2026-05-21 — Column present with DEFAULT 1, NOT NULL.

**Rollback:** `ALTER TABLE public.pbv_form_documents DROP COLUMN IF EXISTS generation_version;` plus reverting `generate-forms/route.ts` to the fixed `-unsigned.pdf` path.

### `supabase/migrations/20260521030000_prd65_government_id_required.sql`
**What it does:**
1. Inserts a `government_id` template row into `form_document_templates` (`form_id='pbv-full-application'`, `required=TRUE`, `display_order=5` so it sorts first, `category='identity'`, `applies_to='submission'`).
2. Backfills `application_documents` for in-progress (`submitted_at IS NULL`) apps that already have seeded docs and no existing `government_id` slot. Idempotent via `WHERE NOT EXISTS`.

**Used by:** the live seed path (`seedApplicationDocuments` in `app/api/t/[token]/pbv-full-app/intake/complete/route.ts`) for new apps; the backfill takes care of in-flight ones.

**Status:** ✅ APPLIED 2026-05-21 — Template at display_order=5; 7 in-flight apps backfilled (all test data).

**Heads-up for tenant comms:** tenants currently mid-application will see a NEW required Photo ID slot on their next visit. If that needs a heads-up message, send it before applying.

**Rollback:**
```sql
DELETE FROM public.application_documents
 WHERE anchor_type='pbv_full_application'
   AND doc_type='government_id'
   AND created_by='system';
DELETE FROM public.form_document_templates
 WHERE form_id='pbv-full-application'
   AND doc_type='government_id';
```

### `supabase/migrations/20260521020000_finalize_pbv_application_fn.sql`
**What it does:** Creates `public.finalize_pbv_application(p_app_id uuid, p_submitted_at timestamptz, p_actor_display_name text)`, a `SECURITY DEFINER` plpgsql function that updates `pbv_full_applications.submitted_at` and inserts the `application.submitted` row into `application_events` inside a single transaction. `RAISE` on any error rolls both back. `GRANT EXECUTE ... TO service_role` so `supabaseAdmin.rpc(...)` can call it.

**Used by:** `app/api/t/[token]/pbv-full-app/finalize/route.ts` (replaces the previous separate UPDATE + best-effort event insert).

**Apply order:** **Apply BEFORE deploying the PRD-64 code change.** The route is hard-coded to call this RPC; if the function isn't there, every finalize attempt returns 500. (Acceptable for a coordinated cutover; document in the deploy runbook.)

**Status:** ✅ APPLIED 2026-05-21 — Function exists; service_role has EXECUTE.

**Rollback:** `DROP FUNCTION IF EXISTS public.finalize_pbv_application(uuid, timestamptz, text);` plus a revert of `finalize/route.ts` to the previous JS-side submit + writePbvApplicationEvent ordering.

### `supabase/migrations/20260521010000_prd62_unsigned_pdf_hash.sql`
**What it does:**
1. Adds `pbv_form_documents.unsigned_pdf_hash TEXT` (nullable). Distinct from `source_pdf_hash` (template hash) — this hashes the stamped unsigned bytes the signer downloads.
2. Adds a `COMMENT ON COLUMN` explaining its purpose.

**Used by:** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` writes the hash at upload time; `lib/pbv/finalizeValidation.ts` Check 5 compares each `pbv_signature_events.document_hash` to it (null = skip, legacy rows are not retroactively blocked).

**Status:** ✅ APPLIED 2026-05-21 — Column present, nullable.

**Rollback:** `ALTER TABLE public.pbv_form_documents DROP COLUMN IF EXISTS unsigned_pdf_hash;` (the column is purely additive; dropping it disables Check 5 silently rather than corrupting state).

### `supabase/migrations/20260521000000_prd55b_form_sourcing_corrections.sql`
**What it does:**
1. Re-enables `criminal_background_release` (`generation_enabled=TRUE`, `category='sign'`, `source_pdf_status='sourced'`) — reverses PRD-55's upload-only classification. Source PDFs now in `assets/pbv-source-pdfs/`.
2. Re-enables `eiv_guide_receipt` (`generation_enabled=TRUE`, `source_pdf_status='sourced'`) — source + field map existed; PRD-55 wrongly left disabled.
3. Sets `generation_enabled=FALSE` for `insurance_settlement` and `cd_trust_bond` — unsourced, were silently skipping pre-batch.

**Status:** ✅ APPLIED 2026-05-21 — criminal_background_release + eiv_guide_receipt enabled; insurance_settlement + cd_trust_bond disabled.

**Rollback:** Reverse the UPDATE statements if needed.

---

### `supabase/migrations/20260521070000_reconcile_source_pdf_status_constraint.sql`
**What it does:** Reconciles the `pbv_form_templates.source_pdf_status` constraint drift discovered during PRD-55b apply. The live prod constraint had drifted to `('ready','pending','deprecated')` by hand (no migration). The PRD-55b patch wrote `'ready'` to avoid the error. This migration:
1. Drops the drifted constraint
2. Normalizes all `'ready'` rows to `'sourced'` (the canonical value)
3. Re-asserts the original CHECK `('pending','sourced','verified')` matching the table-defining migration and TS type

**Branch chosen:** DEFAULT — consolidated to original vocabulary `('pending','sourced','verified')` because `'ready'` was only introduced by the PRD-55b patch, and `'deprecated'` had zero rows.

**Status:** ✅ APPLIED 2026-05-21 — Constraint now canonical; 13 rows normalized from `'ready'`→`'sourced'`; generation_enabled set unchanged.

**Files updated:** `20260521000000_prd55b_form_sourcing_corrections.sql` (lines 26, 38: `'ready'`→`'sourced'`), TS type unchanged (already correct).

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

### [PRD-61] O1 — fourth household profile — DECISION
- **Context:** PRD-61 specifies three profiles (single-adult, multi-adult, conditional). Open question: do we need a fourth (zero-income-only, or eligible-non-citizen immigration-doc path)?
- **Default taken:** Ship the three named profiles. The conditional-form lane (Profile C) already exercises pet/vehicle/self-employment/child-support; zero-income would mostly re-exercise the same generation lane with `zero_income_statement` (which is `generation_enabled=FALSE`, source-pending — OUT-OF-LANE per roadmap).
- **Reversible?** yes — add `tests/fixtures/profile-d-*.json` + a new describe-block; no code change.
- **Needs Alex:** confirm three is enough for v1 sign-off, or name a fourth profile shape.

### [PRD-61] O2 — prod-token walk submit vs read-only — DECISION
- **Context:** The runtime trilingual walk (Gate G-61.1) runs against prod test tokens. If those tokens reach `/finalize`, a real prod application gets submitted.
- **Default taken:** **Read-only** on prod (read `generate-forms` body, walk UI, stop short of `/finalize`). Full submit only against a fresh non-prod application created on the preview deploy via the staff approve-and-send flow.
- **Reversible?** yes — submit on prod is a one-line change if Alex wants it.
- **Needs Alex:** confirm read-only-on-prod is acceptable (it should be — protects HACH inbox from synthetic data).

### [PRD-61] O3 — ES/PT placeholder leakage at deploy time — DECISION
- **Context:** PRD-59 shipped best-effort EN/ES/PT prose; native review is post-launch (per Alex resolution 2026-05-21). The trilingual walk may surface placeholder-looking strings.
- **Default taken:** Run Gate G-61.1 against whatever is deployed. Log any placeholder-leakage as a **Polish/Deferred** residual defect (not a BLOCKER). Aligns with the "ship best-effort" resolution on summary/consent prose.
- **Reversible?** yes — promote to BLOCKER if Alex changes the shipping bar before launch.
- **Needs Alex:** confirm the bar — Polish-deferred is fine, or do we promote to blocking?

### [PRD-55b] insurance_settlement + cd_trust_bond disabled — DECISION (O2 default → BLOCKER if real)
- **Context:** PRD-55b prompt notes these were in the live skip list (enabled+silently-skipping) but never appeared in PRD-55's reconciliation. Step 0 prod DB query was not run in-session (no DB credentials in this batch's tooling) — reasoned from PRD-55 build report which omits them, confirming PRD-55 did not change their state.
- **Default taken:** Migration sets `generation_enabled=FALSE`, `source_pdf_status='pending'` for both. They no longer silently skip. Not in packet, not in `docs/templates/`, no field maps, no resolvers.
- **Reversible?** yes — flip flag if source PDFs are provided.
- **Needs Alex:** confirm whether these are vestigial template rows (delete) or real HACH forms that need sourcing (BLOCKER — provide source PDFs + field-map shape; will become new PRD).

---

## Launch-hardening batch (PRDs 62–67) — logged during run

### [PRD-62] Branch base — DECISION
- **Context:** PRD-62 prompt says branch off `feat/pbv-full-finalization` if it has not yet merged to `main`, else off `main`.
- **Default taken:** Branched `feat/pbv-launch-hardening` off `feat/pbv-full-finalization` (verified via `git log main..feat/pbv-full-finalization` — finalization batch is ahead of main, not merged). The PRD-62 commit will stack on top of `bea32eb Add PRD-61 code and workflow audit`.
- **Reversible?** yes — can rebase onto main after the finalization PR merges, if Alex prefers that ordering.
- **Needs Alex:** confirm ordering — keep launch-hardening stacked on finalization, or rebase after finalization merges.

### [PRD-62] Legacy null-`unsigned_pdf_hash` rows skip Check 5 — DECISION (O1 default)
- **Context:** Rows generated before this migration have `unsigned_pdf_hash = NULL`. Per PRD O1: should finalize block them, back-download to verify, or skip?
- **Default taken:** Check 5 **skips** null-hash forms (no block). Per the cached-hash variant decision (D1) we do not download PDFs at finalize, and we explicitly do not retroactively block packets generated before this PRD landed.
- **Reversible?** yes — a backfill job (compute `sha256` of each stored unsigned PDF, populate the column) can be added later.
- **Needs Alex:** confirm "no retroactive block" is acceptable for launch. If not, add a one-off backfill before applying the prod migration set.

### [PRD-62] HOH summary-doc-signed gate stays in the HOH route — DECISION (D3)
- **Context:** PRD D3 keeps the gate in the route, not in `completeFormSigning`, because the member-token path intentionally omits it.
- **Default taken:** Implemented as specified — the summary gate is in `app/api/t/[token]/pbv-full-app/sign-form/route.ts`; `completeFormSigning` knows nothing about it.
- **Reversible?** yes — could be moved into the shared fn behind an option flag if a future flow needs it.
- **Needs Alex:** none expected.

### [PRD-64] X-Assisted-By verification — DECISION (D1)
- **Context:** Audit #4. Pre-PRD-64 code accepted any `X-Assisted-By` value present in `admin_users` (forgeable). PRD specified session-verification as preferred, 401-stopgap as fallback if `getSession()` can't reach the cookie from `/api/t/...`.
- **Default taken:** Session-verification path. The route now reads `getSession()` and verifies `assistedMode.staffUserId === assistedByHeader && assistedMode.applicationId === app.id`. Mismatch → 401 `assisted_session_unverified` + structured `console.warn`. The same pattern is already used by `app/api/t/[token]/pbv-full-app/assisted-mode/route.ts:42-55`, so the iron-session cookie is known-readable from this route family.
- **Reversible?** yes — could downgrade to 401-only stopgap (or upgrade to HMAC-signed header) later.
- **Needs Alex:** none expected. Confirm post-deploy R2 walk shows the header rejected when no session is active.

### [PRD-64] Atomic finalize via SQL function — DECISION (D2)
- **Context:** Audit #10. Pre-PRD-64 code set `submitted_at` then wrote `application.submitted` in a swallowing `try/catch` — submission/event could diverge.
- **Default taken:** SQL function `finalize_pbv_application(p_app_id, p_submitted_at, p_actor_display_name)` in migration `20260521020000_finalize_pbv_application_fn.sql`. `SECURITY DEFINER` plpgsql; UPDATE + INSERT in one transaction; `RAISE` on error to roll back; `GRANT EXECUTE ... TO service_role`. The route calls `supabaseAdmin.rpc('finalize_pbv_application', ...)`; RPC error → 500 + no submitted_at + no event.
- **Reversible?** yes — revert to event-first code-only path by restoring the previous JS submit + writePbvApplicationEvent ordering. The migration is additive (adds a function) — `DROP FUNCTION public.finalize_pbv_application(uuid, timestamptz, text);` to roll back the schema side.
- **Needs Alex:** apply migration `20260521020000_finalize_pbv_application_fn.sql` BEFORE deploying the PRD-64 code change (otherwise every finalize attempt 500s). Confirm Gate R1 on staging after apply: force an event-insert failure (e.g. add a constraint violation) and confirm `submitted_at` is rolled back too.

### [PRD-64] SQL path bypasses _notifySubscribers — DECISION (informational)
- **Context:** The RPC-based finalize writes the `application.submitted` event directly via SQL, so the in-process `_notifySubscribers` hook in `lib/events/application-events.ts:459` is bypassed.
- **Default taken:** Acceptable for now — `application.submitted` has no subscriber today (`lib/notifications/init.ts` does not wire one for it). Logged as a divergence so a future submit-notification feature isn't silently dropped.
- **Reversible?** yes — if/when a subscriber is added, either (a) emit the notification from the route after a successful RPC, (b) switch to a postgres LISTEN/NOTIFY trigger, or (c) revert to the event-first code path.
- **Needs Alex:** before wiring any `application.submitted` subscriber, decide which of (a)/(b)/(c) to use.

### [PRD-65] Photo ID — submission-level slot (one for HoH) — DECISION (O1)
- **Context:** PRD O1 asked whether `government_id` should be `applies_to='submission'` (one ID for the HoH) or `'each_adult'` (one per adult).
- **Default taken:** `'submission'` — one ID for the head of household, `per_person=FALSE`, `person_slot=0`. Matches how the office treats the document today (identity is verified for the HoH at intake; co-residents' IDs are not requested by the live HACH workflow).
- **Reversible?** yes — flip `per_person` to TRUE and `applies_to` to `'each_adult'` in the seed + re-run, then re-seed in-flight apps via the existing `seedApplicationDocuments` path.
- **Needs Alex:** confirm HoH-only is acceptable; if HACH wants one ID per adult, flip the flag.

### [PRD-65] Photo ID — one multi-page doc (front+back) — DECISION (O2)
- **Context:** PRD O2 asked whether to capture front + back as one 2-page doc or two separate slots (`government_id_front` / `government_id_back`).
- **Default taken:** One multi-page doc. `docContent.ts.government_id.multiFile=true, maxFiles=2`; the scanner's existing `multiPage` mode handles both pages in one capture session, and `DocumentCard.tsx` now passes `maxPages={getMaxFiles(...)}` so the cap is honored. Simpler for the tenant; matches the `immigration_docs` precedent (already 2-page multi-file).
- **Reversible?** yes — split into two slots later by adding a second template row + scanner mode tweak.
- **Needs Alex:** none expected.

### [PRD-65] Backfill scope — un-submitted apps only — DECISION (O3)
- **Context:** PRD O3 asked whether to backfill all in-progress apps or only un-submitted ones.
- **Default taken:** `WHERE submitted_at IS NULL`. Already-finalized packets are NOT retroactively marked incomplete. In-flight tenants WILL see a new required Photo ID slot on their next visit; logged so Alex can communicate that.
- **Reversible?** yes — re-running the backfill against finalized apps would require a separate one-off insert (and would intentionally unblock the rule for those apps).
- **Needs Alex:** confirm tenants currently mid-application getting a new required slot is acceptable; if not, defer the backfill until a tenant-comms message is ready.

### [PRD-65] New `identity` category — DECISION (D3)
- **Context:** `form_document_templates.category` is a `TEXT` column with no enum constraint (`supabase/migrations/20260514205000_pbv_document_categories.sql`); the UI category union in `AlmostDoneReview.tsx` was strict. We're adding a new top-level category, not extending the `custom` grab-bag.
- **Default taken:** Added `'identity'` as a first-class category. DB is forwards-compatible (no enum to update). UI: extended the `DocCategory` union, added an `identity` `categories[]` entry placed FIRST (EN/ES/PT label), initialized the `identity: []` bucket. Legacy/custom `government_id` rows from pre-PRD-65 are mapped to `identity` even if their DB `category` is null.
- **Reversible?** yes — drop the row in the UI + DB if a different categorization is preferred.
- **Needs Alex:** none expected.

### [PRD-66] Unsigned PDF versioning — DECISION (D1, O1)
- **Context:** Audit #5. `generate-forms` could overwrite the unsigned PDF a signer is mid-ceremony on (`upsert: true`, fixed path `…-{lang}-unsigned.pdf`). Two options: 409-refuse if any signer has been collected, or version-and-bump.
- **Default taken:** Durable version variant (D1). `pbv_form_documents.generation_version` (new column, migration `20260521040000`). The unsigned path is now `…-v${generationVersion}.pdf`. Decision rule: no row → v1 + `upsert:true`; row with 0 signers → reuse existing version + `upsert:true` (safe to overwrite, no signer committed); row with ≥1 signer → bump + `upsert:false` (brand-new path, clobber should fail loudly). O1 = the zero-signer no-bump rule.
- **Reversible?** yes — drop the column + revert the route to the fixed path. Old v1 objects remain in storage and are reachable via `pbv_form_documents.unsigned_pdf_path` for any row that wasn't re-stamped.
- **Needs Alex:** confirm we want a regenerate during signing to succeed (creating v2) rather than 409-refuse. Either way the in-flight signer ends up with a "please re-sign" via PRD-62 hash check.

### [PRD-66] No `generation_version` column on `pbv_signature_events` — DECISION (D2, O2)
- **Context:** Audit #5 also suggested writing the version onto each signature event so finalize could compare. PRD-62 already added `pbv_form_documents.unsigned_pdf_hash` + Check 5, and bumping the version rewrites the hash — so any signature event with the old hash already blocks finalize.
- **Default taken:** No new column. Rely on PRD-62 Check 5. The version is for human-readable diagnostics + the storage path; the hash is the enforcement.
- **Reversible?** yes — add the column later if Alex wants a separate version-mismatch message.
- **Needs Alex:** none expected.

### [PRD-66] Signed-PDF path includes ceremony_id; upsert:false — DECISION (D3)
- **Context:** Audit #11. The signed PDF was written to `…-signed.pdf` with `upsert:true`, so a restarted ceremony silently overwrote the prior artifact.
- **Default taken:** Signed path is `…-${ceremonyId}-signed.pdf`, uploaded with `upsert:false`. `signed_pdf_path` points at the latest; prior ceremonies' objects remain in storage for audit. A benign same-ceremony replay (409 / "exists" / "duplicate" from Supabase Storage) is detected and treated as already-written (no throw).
- **Reversible?** yes — revert the path literal + upsert flag.
- **Needs Alex:** none expected.

### [PRD-66] Idempotency scoped by application_id — DECISION (D4)
- **Context:** Audit #9. The cached-response lookup in `lib/idempotency.ts` filtered only by `(key, endpoint)`, leaving a theoretical cross-tenant replay if an `Idempotency-Key` was guessable.
- **Default taken:** Added `.eq('application_id', applicationId)` to the lookup. Pre-existing cache rows miss the (now narrower) WHERE and fall through to the (idempotent) handler.
- **Reversible?** yes (would be a regression).
- **Needs Alex:** none expected.

### [PRD-66] tryLoadPdf logs non-ENOENT errors — DECISION (D5)
- **Context:** Audit #13. `lib/pbv/form-generation/source-pdfs.ts:tryLoadPdf` had an empty catch that swallowed permission denied / EMFILE / anything indistinguishably from "this form isn't sourced."
- **Default taken:** Inspect `err.code` + `err.message`. `ENOENT` or the wrapper's "Source PDF not found" message → return null silently. Any other error → `console.error('[source-pdfs] Failed to load ${fileName}:', err)` and still return null (so module import / generate-forms doesn't crash).
- **Reversible?** yes.
- **Needs Alex:** none expected.

### [PRD-66] No "discard & regenerate" UI — DECISION (O3)
- **Context:** PRD-66 makes regeneration version-safe server-side. A tenant who edits intake mid-signing now silently triggers a v2; the in-flight signer's hash no longer matches and finalize blocks with "please re-sign."
- **Default taken:** Server-side safety only. No UI affordance built. A future PRD should give the tenant an explicit "discard signatures & regenerate" choice so the version bump isn't a silent surprise.
- **Reversible?** n/a — this is a flag, not a build.
- **Needs Alex:** schedule a follow-up UI PRD when bandwidth allows.

### [PRD-67] Post-complete editing deferred — DECISION
- **Context:** PRD-67 Step 2 called for editing intake answers after `intake_status='complete'`, which requires (a) a confirmation gate, (b) a write to `intake_snapshot` (NOT the old `intake_data`), (c) re-running `bridgeIntakeToDatabase` for member-affecting sections, (d) invoking `generate-forms` (PRD-66 bumps `generation_version`), (e) clearing changed forms' `collected_signer_member_ids` + summary signature if changed + calling `updateApplicationSigningStatus`. Five-step interaction touching two routes, two helpers, and the dashboard.
- **Default taken:** Ship the **read-only** review surface only. Editing post-complete is not enabled in this PRD. The user instead sees a "To change any of your answers, call our office (860) 993-3401" line — matching the long-standing posture for building/unit. Pre-complete editing is unchanged (it still flows through the intake screens; SectionReview's Edit links work as before).
- **Why defer:** the prompt warns "do not let an edit silently overwrite a signed packet's data." Wiring the regenerate-on-edit confirmation + signing reset partially is the worst outcome — it could leave a packet in a state where `intake_snapshot` says X but signed PDFs were stamped from Y. PRD-62 Check 5 + PRD-66's version bump would catch it at finalize, but the UX would be confusing. The right thing is to land the whole interaction in a focused follow-up PRD with its own test plan.
- **Reversible?** yes — the follow-up PRD adds the edit endpoint + the regenerate/reset call. The review page already has the section structure; only the "Edit" button + the wire-up needs to be added.
- **Needs Alex:** schedule the follow-up. Until then, tenants who need to correct answers post-complete call the office. (This is the current production behavior — PRD-67 doesn't regress anything; it just doesn't add the missing edit path.)

### [PRD-67] Download link gated on `submitted_at` — DECISION
- **Context:** Pre-PRD-67 the dashboard offered "Download my application copy" whenever `intake_status === 'complete'`, but `/api/t/[token]/pbv-full-app/print/download` requires `submitted_at`. Tenants who finished intake but hadn't submitted saw a working-looking link that 403'd.
- **Default taken:** Gate on `data.submitted_at` instead. The link is hidden until the application is actually submitted, which is the unambiguous "copy ready" point.
- **Reversible?** yes — flip the condition back.
- **Needs Alex:** none expected. Confirm in R3 post-deploy that the link appears after finalize and returns a real PDF.

### [PRD-67] No new migration written — DECISION (O5)
- **Context:** PRD O5 asked whether to add `pbv_full_applications.intake_edited_after_generation_at` for diagnostics.
- **Default taken:** No. PRD-66's `generation_version` already records that a regenerate happened; the `signing_status` reset (when wired in by the follow-up) records the signing reset. A separate edit-timestamp column would be useful only with the editing path enabled.
- **Reversible?** yes — the follow-up edit PRD can add it then.
- **Needs Alex:** revisit when the follow-up edit PRD is scoped.

### [PRD-67] Deferred usability items (U7, U9, U11) — DECISION
- **U7 (hub progress indicator):** not built. Existing dashboard cards already show per-task state via `CardStatus`; a global progress bar is a polish item, not a launch blocker.
- **U9 (PT prose review):** ships best-effort per [PRD-59] resolution; native PT review is post-launch.
- **U11 (leave-with-missing confirmation):** not built. The card stack already has explicit "I'll get this later" + the dashboard re-entry path handles partial completion gracefully.
- **Needs Alex:** prioritize U7 + U11 in a polish PRD; schedule PT native review.

### [PRD-68] O1 — member-scoping of signer forms — DECISION
- **Context:** PRD-68 O1 asked whether to return all application forms (HOH-route parity) or filter to forms where `required_signer_member_ids` includes `member.id` (matching the route's docstring `:6-7`).
- **Default taken:** Return **all** application forms (no scope change). Mirrors the working HOH route; the per-member `signatures_complete` lookup against `pbv_signature_events` already tells the page which forms the member has signed. Docstring-style filter would be a separate refinement for both routes.
- **Reversible?** yes — add a single `.contains('required_signer_member_ids', [member.id])` filter on the docs query in `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` (and consider applying it to the HOH route for parity).
- **Needs Alex:** confirm "return all forms + signatures_complete flag" is acceptable for the signer page UX (it's the current HOH behavior; the change here is bringing the broken route to parity, not introducing a new scoping policy).

### [PRD-68] O2 — language source for display name — DECISION
- **Context:** PRD-68 O2 asked whether to resolve display language from `pbv_full_applications.preferred_language` (HOH parity) or `pbv_form_documents.language` (per-doc).
- **Default taken:** `preferred_language → doc.language → 'en'`. Strict HOH parity (`app.preferred_language ?? 'en'`) plus a `doc.language` fallback so a doc generated in a non-preferred language still picks a sensible name if the app row is missing `preferred_language`. The signer page also reads `preferred_language` from the bootstrap, so this is consistent.
- **Reversible?** yes — drop the `doc.language` fallback in `lib/pbv/signer-forms-mapping.ts` to be byte-identical to HOH.
- **Needs Alex:** none expected.

### [PRD-68] O3 — PT display name not yet supported — DECISION
- **Context:** PRD-68 O3 noted the HOH route only selects `display_name_en` / `display_name_es` even though `display_name_pt` exists (`20260515040000`). Adding `_pt` here would diverge from HOH.
- **Default taken:** Mirror HOH exactly — en/es only. PT speakers see the EN display name for now. PT display-name support is a shared follow-up for BOTH routes (and the rest of the template-name read sites).
- **Reversible?** yes — add `display_name_pt` to the select + `lang === 'pt'` branch in `lib/pbv/signer-forms-mapping.ts` (and the HOH route, for parity).
- **Needs Alex:** schedule the PT display-name follow-up; this fix doesn't make the gap worse, just doesn't close it.

### [PRD-70] O1 — Gap A halt vs proceed — DECISION (default applied)
- **Context:** On unit-save PATCH failure, halt navigation + show inline error (default), or warn-and-proceed?
- **Default taken:** **Halt + inline error.** A wrong/unsaved unit silently carried into intake would corrupt the rest of the application (HoH building/unit underpins every member, document, and signature event). The new `attemptUnitSaveAndDecide` helper in `lib/pbv/tenant-flow-handlers.ts` returns `{ navigate: false }` on `!res.ok` or throw; the page handler reads that, sets `unitError` (rendered via a tenant-readable EN/ES/PT string above the Start button), and does NOT call `router.push`. The tenant stays on the landing, sees the error, and the Start button is re-enabled so they can retry.
- **Reversible?** yes — swap the early return for a `console.warn` and let navigation proceed. Helper would need to surface both navigate=true and error=set; trivial diff.
- **Needs Alex:** none expected. This is the safer default and matches the "no silent corruption" posture in PRD-67 and PRD-62.

### [PRD-70] O2 — Gap B implemented surgically — DECISION
- **Context:** PRD-67 deliberately KEPT `window.location.reload()` in the documents error fallback as "an intentional retry, not navigation." PRD-70 Gap B is conditional on a clean refetch existing.
- **Default taken:** **Implemented.** A clean `fetchDocuments(language)` already exists at `documents/page.tsx:68`; it clears local `error` state at the top and re-runs the documents fetch. Wired via `chooseDocumentsRetryAction` so:
  - `state.status === 'error'` (bootstrap) → `window.location.reload()` (PRD-67's intentional retry — preserved)
  - `pageView.kind === 'error'` → `window.location.reload()` (same rationale — preserved)
  - **data-fetch-only** (`error` set, the other two clear) → `fetchDocuments(language)` (the new behavior; SPA state preserved)
  - bootstrap or pageView errors WIN over a data-fetch error if both are set (bootstrap can't be recovered by a docs refetch).
- **Reversible?** yes — replace `onRetry={onRetry}` with `onRetry={() => window.location.reload()}` and the change is reverted; PRD-67 behavior is restored verbatim. Helper covered by 6 vitest tests.
- **Needs Alex:** none expected. PRD-67's intentional reload for bootstrap errors is preserved exactly; this only changes the data-fetch-only branch.

### [PRD-62] Pre-existing test-suite baseline failures — DECISION (informational)
- **Context:** `npx vitest run` shows ~10 unrelated failing test files on this branch: `components/review/{DocumentRow,useReviewKeyboardShortcuts}.test`, `lib/__tests__/{in-app-signature-capture-staff,in-app-signature-capture-tenant,signing-api,tenantApiCall}.test`, `lib/workspaces/__tests__/client.test`, `lib/pbv/__tests__/{age,documentTriggers,field-mapping}.test`. Confirmed pre-existing by stashing PRD-62 changes and re-running (still failed). `field-mapping.test` failure references `briefing_docs_certification`, which PRD-55 renamed to `briefing_cert` — that test was not updated in PRD-55.
- **Default taken:** Do not fix in this PRD (out of lane). PRD-62 only adds passing tests (`completeForm`, `finalizeValidation` extensions, `sign-form-unification`).
- **Reversible?** n/a — informational.
- **Needs Alex:** consider a cleanup PRD for the baseline failures; the `field-mapping.test` `briefing_docs_certification` rename was missed by PRD-55.

---

## Resolutions (2026-05-21 — session 2: git recovery + 68–70 decision clearing)

Context: after the 68–70 batch pushed, the local `.git` index corrupted from a mid-session crash. Recovered (index rebuilt from native Windows; commits + remote confirmed intact via `git ls-remote` = `4c624360`). The branch `feat/pbv-launch-hardening` is clean and pushed. No PR opened yet. The decisions below were cleared with Alex in the same session.

### #R1 [PRD-55b] insurance_settlement + cd_trust_bond — RESOLVED: tenant-attested "I have this, send me the form"
Alex: "let them say yes I have this please send me [the] form or something along those lines." NOT vestigial (do not delete the template rows) and NOT auto-generated. The 55b migration's `generation_enabled=FALSE` for both is correct and stays. New intended behavior: surface a tenant-facing yes/no prompt ("Do you have an insurance settlement / cash deposit or trust bond?"); on "yes," flag the application so the office sends the relevant form (or opens an upload slot). **Action:** scope a follow-up PRD for the prompt + office-send/upload wiring. Until then the rows stay generation-disabled (no silent skip).

### #R2 [PRD-55b] eiv_guide_receipt — RESOLVED: keep generating
Alex: keep generating. The 55b migration's `generation_enabled=TRUE` (+ `source_pdf_status='sourced'`) is correct. Stays a stamped-and-signed form alongside the HUD EIV guide. No change needed.

### #R3 Unapplied migration set — RESOLVED: none applied; runbook produced
Alex: none of the six committed-but-unapplied migrations have been applied yet. A sequenced apply-runbook (timestamp order, with the PRD-65 tenant Photo-ID heads-up and the PRD-69 fresh-env reconcile note) is captured in the session handoff doc. The six: `20260521000000_prd55b…`, `…010000_prd62…`, `…020000_finalize_pbv_application_fn`, `…030000_prd65…`, `…040000_prd66…`, `…050000_prd69…`. (PRD-55's `20260520000000` is already APPLIED.)

### #R4 [PRD-68/70] batch defaults — CONFIRMED (no change)
- **PRD-68 O1** member-scoping: return all application forms (HOH parity) + per-member `signatures_complete` flag. Confirmed acceptable.
- **PRD-68 O2** language source: `preferred_language → doc.language → 'en'`. Confirmed.
- **PRD-68 O3** PT display name: EN/ES only for now; PT-display-name is a shared follow-up for the signer + HOH routes. Scheduled (not closed). **Closed by PRD-72 (`4500f6c`).**
- **PRD-70 O1** Gap A: halt navigation + inline EN/ES/PT error on unit-save failure. Confirmed (matches no-silent-corruption posture).
- **PRD-70 O2** Gap B: data-fetch errors refetch; bootstrap/pageView errors keep PRD-67's intentional `reload()`. Confirmed.

---

## PRD-72 Decisions (logged during run)

### [PRD-72] O1 — Best-effort PT, flagged for native review — DECISION
- **Context:** PT translations for 18 `pbv_form_templates` rows. Choice between best-effort machine + Cowork draft (ship now, review post-launch) vs. block on a native Portuguese speaker.
- **Default taken:** Best-effort. All 18 values written into `20260521060000_prd72_form_display_name_pt_backfill.sql` and tabulated in the "Prod migrations to apply" entry above so the review can run against a single artifact. Matches the PRD-59 posture ("ship best-effort, native review post-launch").
- **Reversible?** yes — UPDATE per row to replace any value; route fallback chain (`pt → en → form_id`) means even `SET display_name_pt = NULL` safely returns English instead of slugs.
- **Needs Alex:** route the values above to a native PT speaker. No code change needed for value swaps.

### [PRD-72] O2 — Backfill all rows incl. disabled/source-pending — DECISION
- **Context:** Whether to backfill `_pt` for rows with `generation_enabled=FALSE` (vawa_certification, reasonable_accommodation_request, zero_income_statement, plus the 55b-disabled insurance_settlement / cd_trust_bond if they ever land as template rows).
- **Default taken:** Backfill all 18 seeded rows including the source-pending ones. Cheap, complete, future-proof — if any of these flip to `generation_enabled=TRUE` later (e.g. via PRD-55b's tenant-attested follow-up), PT names are already populated. `insurance_settlement`/`cd_trust_bond` are no-ops today (no template rows exist) per the batch-run prompt.
- **Reversible?** yes — per-row UPDATE.
- **Needs Alex:** none.

### [PRD-72] D1/D2 — Parity + fallback chain — DECISIONS (per PRD)
- **D1:** HOH route + signer mapper stay byte-parity. Same `pt → en → form_id` chain, same lookup. Verified: both implementations land in the same shape, only the call site differs.
- **D2:** Fallback `pt → en → form_id`, NOT `pt → es`. Display names are text; mirrors `summary-doc/content.ts` PT branch. PDF asset routing (`pt → es`) is intentional and untouched (per `lib/pbv/__tests__/language-routing.test.ts:25-28`).
- **Reversible?** yes for D2 (one-line change in two places + mapper). D1 should remain — divergence between HOH and signer here was the original bug PRD-68 fixed.

---

## PRD-73 Decisions (logged during run)

### [PRD-73] O1 — 4 top-level tasks (not weighted) — DECISION
- **Context:** Granularity choice for U7. Options: (a) count the four cards (default — matches the cards, simple, accurate); (b) weight by sub-counts (forms_signed/forms_total + upload_complete/upload_total).
- **Default taken:** 4 top-level tasks. `computeHubProgress(statuses: CardStatus[])` consumes only the per-card statuses already derived in `TenantDashboard.tsx`. Locked cards drop out of both numerator and denominator (so total may temporarily be 3 while card2 is locked-on-summary; back to 4 after summary signed) — this is intentional and matches the PRD note.
- **Reversible?** yes — helper accepts an arbitrary `CardStatus[]`; switching to a weighted derivation is a helper rewrite + caller change. No callers outside `TenantDashboard.tsx`.
- **Needs Alex:** confirm the bar UX feels right during the manual Chrome walk (Gate R1).

### [PRD-73] O2 — beforeunload only (no in-app router.push intercept) — DECISION
- **Context:** U11 scope. Options: (a) `beforeunload` guard only (default — smallest surface, mirrors intake page); (b) also intercept in-app `router.push` back/exit with a trilingual `confirm()` mirroring `DocumentCard.tsx:281`.
- **Default taken:** `beforeunload` only. Active when any required doc has status `'missing'` or `'rejected'`. Skipped once `submittedAt` is set. The in-app intercept is the optional "nice to have" — the PRD explicitly flagged it as optional, and adding it would require a custom router.push wrapper or a `usePathname`-watching effect, both larger surface than the intake-page pattern.
- **Reversible?** yes — adding the in-app intercept later is additive and doesn't change the `beforeunload` behavior.
- **Needs Alex:** decide post-walk whether the in-app intercept is worth the extra complexity. If yes: small follow-up PR.

### [PRD-73] O3 — Documents page only (not dashboard) — DECISION
- **Context:** Where to attach U11. Options: documents page (default + dashboard); documents page only (default); also the read-only review surface (no — `submittedAt` is set there).
- **Default taken:** documents page only. Once the tenant reaches the dashboard, all docs are either uploaded (status: `submitted` / `approved` / `waived`) or they've consciously left a required slot via the "I'll get this later" defer flow. The dashboard itself doesn't lose in-progress data on navigate-away. Read-only review is unaffected by definition.
- **Reversible?** yes — adding the dashboard guard is a copy-paste of the documents-page `useEffect`.
- **Needs Alex:** none expected.

### [PRD-73] D1/D2 — Confirmations (per PRD)
- **D1:** Derive U7 from existing card statuses — no new data, no new fetch.
- **D2:** Mirror `beforeunload` (`page.tsx:556`) + (in scope) `confirm()` (`DocumentCard.tsx:281`); no modal library.

---

## Stress-Test Hardening batch (PRDs 74–79) — logged during run

### [PRD-74] Phase 3 run-lock applied to all three cron routes — DECISION (O1)
- **Context:** PRD-74 O1 asks whether to lock `cleanup-idempotency-keys`. A double-run is harmless (delete by `expires_at` is idempotent), so the PRD calls it optional.
- **Default taken:** Apply the lock to all three cron routes for consistency (`pbv-deferred-reminders` 600s lease, `notifications-scheduled-sends` 300s lease, `cleanup-idempotency-keys` 120s lease). The cost is one extra RPC per cron invocation; the benefit is uniform diagnostics (`cron_skipped_locked` log fires across the board) and no special-case code-review burden.
- **Reversible?** yes — drop the `claimCronRun(...)` block in `cleanup-idempotency-keys/route.ts` to revert.
- **Needs Alex:** none expected.

### [PRD-74] `claimCronRun` fails open when the RPC errors — DECISION
- **Context:** The Phase 3 migration is commit-only and won't be applied until Alex applies it post-run. If the cron routes hit the lease path before the migration is applied, the RPC returns an error.
- **Default taken:** On RPC error, log `cron_claim_error` (structured JSON) and **proceed with the run** rather than aborting. This makes the deploy-blocker fix (#1, mandatory auth) independent of the Phase 3 hardening — the cron route is still secure (Bearer required) but does not skip work just because the lock table isn't there yet. Once the migration is applied, the RPC succeeds and the lease is enforced.
- **Reversible?** yes — change the `if (error) return true;` branch in `lib/cron/runLock.ts` to `return false;` to fail-closed instead.
- **Needs Alex:** confirm acceptable. Until the migration is applied, two parallel regions can both run (which was already true before this PRD); after migration apply, only one will.

### [PRD-74] 401 on unset CRON_SECRET — DECISION (O2 default)
- **Context:** PRD-74 O2 asks 401 vs 503 for an unset secret. Default per PRD: 401.
- **Default taken:** 401 with a structured `console.error({ event: 'cron_secret_unset', path })` log. Matches the audit's "fail closed" requirement and avoids leaking config state via 503.
- **Reversible?** yes — one-line change in `lib/cron/auth.ts` to switch the status.
- **Needs Alex:** none expected.

### [PRD-75] `pbv_document_requirements` not brought under migration control — DECISION (O2)
- **Context:** The PRD's preferred path was to reverse-engineer a `CREATE TABLE IF NOT EXISTS` for `pbv_document_requirements` using introspected prod columns, since the table was created out-of-band and has no committed migration. The PRD's documented fallback: "If the real schema can't be confirmed in-session, scope this migration to the RLS policy statements only".
- **Default taken:** Took the fallback. Supabase MCP introspection is not available in this batch's tooling, so the corrective migration is RLS-only. The table's column definitions remain out-of-band; only the RLS policy is corrected.
- **Reversible?** n/a — a future PRD with prod-introspection access can write a follow-up `CREATE TABLE IF NOT EXISTS` migration with the real columns + COMMENT.
- **Needs Alex:** schedule a follow-up to bring `pbv_document_requirements` under migration control (introspect prod → write CREATE TABLE IF NOT EXISTS with the real columns). The RLS fix in this PRD remediates audit #3 fully; the schema-under-migration gap is a separate hygiene concern.

### [PRD-75] No `authenticated` SELECT on `pbv_document_requirements` — DECISION (O1)
- **Context:** PRD-75 O1: does the admin UI read `pbv_document_requirements` with the `authenticated` client?
- **Default taken:** `service_role`-only. The only known reader in the codebase is `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:287` via `supabaseAdmin` (service_role). Grepping for `pbv_document_requirements` finds no other application reads.
- **Reversible?** yes — add `CREATE POLICY ... FOR SELECT TO authenticated USING (true)` in a follow-up migration if an admin UI later reads it through the authenticated session.
- **Needs Alex:** confirm no other reader is planned.

### [PRD-75] Policy-name discovery via `pg_policies` loop (defensive idempotency) — DECISION
- **Context:** The drifted `public ALL` policy name is unknown (it was added out-of-band; no committed migration declares it). Hardcoding a guess at the policy name and `DROP POLICY IF EXISTS <guess>` would silently fail to drop the actual drift.
- **Default taken:** A `DO $$` block enumerates `pg_policies` and drops every policy on either table whose `roles` array contains `public`. This is targeted (does not touch the locked-down policies) and idempotent (safe to re-run after apply).
- **Reversible?** n/a — defensive cleanup. The reasserted policies below are explicit and idempotent.
- **Needs Alex:** none expected; the post-apply verification SELECT in the migration comment confirms no `public` policy remains.

### [PRD-76] Collision-detect (not RPC advisory-lock) for first-gen race — DECISION (O2)
- **Context:** PRD-76 O2 asks RPC advisory-lock vs collision-detect for the `generate-forms` zero-prior-version race. Default per PRD: RPC advisory-lock IF it can be validated in-session; otherwise the documented collision-detect fallback (`upsert:false` + re-read on 409/exist/duplicate).
- **Default taken:** Took the collision-detect fallback. The RPC path requires (1) a new migration with a `SECURITY DEFINER` function that mixes `pg_advisory_xact_lock` with a row read of `pbv_form_documents`, AND (2) validation against a live DB to confirm advisory-lock semantics. With the migration commit-only constraint and no DB access in-session, the collision-detect path is the safer ship-now choice. It is structurally identical to PRD-66's `completeForm.ts:254-260` benign-replay handling and reuses the same status/message detection.
- **Behavior:** first-gen now uses `upsert:false`. On a `409` / "exist" / "duplicate" storage error AND `existingVersion === null`, the route re-reads the winning row and surfaces its `form_document_id` in the response WITHOUT re-upserting (preserves winner's hash → bytes consistency, since the stamper is not guaranteed byte-deterministic across processes).
- **Reversible?** yes — the RPC advisory-lock path can be added in a follow-up PRD; this PRD's defensive guard is forward-compatible (the RPC would simply make the collision path unreachable).
- **Needs Alex:** schedule the RPC-based serialization as a follow-up if the collision-detect approach turns out to be tripped frequently in observability (it shouldn't be — true concurrent first-gen for the same form is rare).

### [PRD-76] supabase-js `count: 'exact'` on UPDATE returns count (no `.select()` needed) — DECISION (O1)
- **Context:** PRD-76 O1 asks whether `.update(data, { count: 'exact' })` returns `count` directly or requires `.select()`. The installed supabase-js (per package-lock) does return `count` on the response object when `{ count: 'exact' }` is passed — no `.select()` needed.
- **Default taken:** Used `.update(updateData, { count: 'exact' })` and destructured `{ error: updateError, count: updatedCount }`.
- **Reversible?** yes — fall back to `.select('id')` + `data?.length` check if a future supabase-js upgrade changes the contract.
- **Needs Alex:** none expected; verify in R2 walk that the path returns 409 on a simulated concurrent upload.

### [PRD-76] No `generate_form_claim_fn.sql` migration written — DECISION
- **Context:** The PRD lists this migration as "new, only if RPC path". The collision-detect path is the alternative; no migration is needed.
- **Default taken:** Skipped. No new migration for PRD-76.
- **Reversible?** yes — write the migration in a follow-up if the RPC path is later chosen.
- **Needs Alex:** none.

### [PRD-75] `supabase/migrations/20260521090000_pbv_rls_lockdown.sql` — MIGRATION-TO-APPLY
- **What it does:** (1) Drops every policy on `pbv_document_requirements` and `pbv_rejection_reason_templates` that grants the `public` role anything (drift remediation). (2) Ensures RLS enabled on both. (3) Reasserts `service_role` ALL + `authenticated` SELECT on `pbv_rejection_reason_templates` (mirrors 20260514220000). (4) Asserts `service_role` ALL on `pbv_document_requirements`.
- **Apply order:** any time after PRD-75 ships. Idempotent — safe to re-apply.
- **Status:** ⏳ NOT APPLIED — committed only.
- **Verification (run by hand after apply):** `SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname='public' AND tablename IN ('pbv_document_requirements','pbv_rejection_reason_templates');` — expect no row with `public` in the `roles` array.
- **Rollback:** the previous wide-open state was a vulnerability; the rollback is "do not run this migration." If for some reason a `public` read is intentionally needed later, add a narrow `CREATE POLICY ... FOR SELECT TO anon USING (<condition>)` rather than reverting.

### [PRD-75] `supabase/migrations/20260521100000_pbv_signature_events_hash_index.sql` — MIGRATION-TO-APPLY
- **What it does:** Adds `CREATE INDEX IF NOT EXISTS idx_pbv_signature_events_form_hash ON pbv_signature_events (form_document_id, document_hash)` — a covering index for `finalizeValidation` Check 5. The existing single-column `idx_pbv_signature_events_form` is intentionally kept.
- **Apply order:** any time. Safe to apply concurrently.
- **Status:** ⏳ NOT APPLIED — committed only.
- **Rollback:** `DROP INDEX IF EXISTS public.idx_pbv_signature_events_form_hash;`

### [PRD-74] `supabase/migrations/20260521080000_cron_run_locks.sql` — MIGRATION-TO-APPLY
- **What it does:** Creates `public.cron_run_locks` (job_name PK, locked_until, updated_at) + `service_role`-only RLS policy + `public.claim_cron_run(job_name, lease_seconds)` SECURITY DEFINER function. The function does an atomic conditional UPSERT and RETURNS BOOLEAN (TRUE = caller holds new lease; FALSE = another holder is active).
- **Used by:** `lib/cron/runLock.ts` (`claimCronRun`), called at the start of every cron route handler after auth passes.
- **Apply order:** any time after PRD-74 ships. Until applied, `claimCronRun` logs `cron_claim_error` and fails-open (route runs). After apply, the lock works as intended.
- **Status:** ⏳ NOT APPLIED — committed only.
- **Rollback:** `DROP FUNCTION IF EXISTS public.claim_cron_run(TEXT, INTEGER); DROP TABLE IF EXISTS public.cron_run_locks;` (the table has no app data — leases are short-lived state).
