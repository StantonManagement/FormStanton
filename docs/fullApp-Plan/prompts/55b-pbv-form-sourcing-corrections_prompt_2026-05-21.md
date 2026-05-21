# Build Prompt — PRD-55b: Form-Sourcing Corrections

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first (branch, default-and-log, write-but-don't-apply prod migrations, static-vs-deferred gates).

Build from `docs/fullApp-Plan/55b-pbv-form-sourcing-corrections_prd_2026-05-21.md`. Read it next.

PRD-55 classified forms by checking only `assets/pbv-source-pdfs/` and missed the sources in `docs/templates/`. Fix: re-enable `criminal_background_release` (it's a sign form whose source exists), re-enable `eiv_guide_receipt` (default), and disable `insurance_settlement` + `cd_trust_bond` (unsourced, were silently skipping).

---

## Branch / commit
- Same branch `feat/pbv-full-finalization`. One commit: `PRD-55b: form-sourcing corrections (criminal_background_release, eiv, insurance/cd_trust)`.

## Shell + DB
- `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc`. See `docs/SHELL-PROTOCOL.md`.
- Write the new migration and **commit it; list it in `OPEN-DECISIONS.md` "Prod migrations to apply."** PRD-55's migration was already applied to prod, so this corrective migration must be applied deliberately too — do not auto-apply.
- `.git/config` is fine — if git errors, report, don't "fix" config lines.

## Steps
0. **Read DB truth:** query `pbv_form_templates` for `criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond` (`generation_enabled`, `category`, `source_pdf_status`, `conditional_rule`, `per_person_scope`).
1. **criminal_background_release:** copy `docs/templates/criminal-background-release-{en,es}.pdf` → `assets/pbv-source-pdfs/`; add `SOURCE_PDFS['criminal_background_release']` (en+es) in `source-pdfs.ts`; add `resolveCriminalBackgroundRelease` in `field-mapping.ts` (mirror `resolveHachRelease`; match the existing `scripts/field-maps/criminal-background-release-*.json` field names); migration sets `generation_enabled=TRUE` + restores its signed-form `category`.
2. **eiv_guide_receipt (default enable):** copy `docs/templates/eiv-guide-receipt-{en,es}.pdf` → `assets/` (ES guide is blank in the packet — reuse the en file for es as PRD-23 did); add `SOURCE_PDFS` entry + a minimal resolver; migration `generation_enabled=TRUE`. Log the enable under the PRD-55 eiv entry in OPEN-DECISIONS.
3. **insurance_settlement + cd_trust_bond:** if Step 0 shows them enabled with no source, migration sets `generation_enabled=FALSE`. Do NOT invent sources. If they look like real needed forms, log a BLOCKER (need HACH source PDFs) and disable for now.
4. **Completeness guard:** add `criminal_background_release` (+ eiv) to the expected-active set in `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts`; it must pass — every enabled template resolves source PDF + field map per language.
5. **Static gates + report:** `tsc --noEmit` + `npm run build` clean, test green. Build report at `docs/build-reports/55b-pbv-form-sourcing-corrections_build-report_2026-05-21.md`. Commit. If PRD-61 hasn't run yet, proceed to it; otherwise this is the last build.

## Files to modify
- `assets/pbv-source-pdfs/criminal-background-release-{en,es}.pdf`, `assets/pbv-source-pdfs/eiv-guide-receipt-{en,es}.pdf` (copied)
- `lib/pbv/form-generation/source-pdfs.ts`, `lib/pbv/form-generation/field-mapping.ts`
- `lib/pbv/form-generation/__tests__/form-generation-completeness.test.ts`
- `supabase/migrations/<ts>_prd55b_form_sourcing_corrections.sql` (commit + list in OPEN-DECISIONS, don't apply)

## Don't
- Don't re-enable pet/vehicle/self-employment (Alex deferred them — genuinely unsourced).
- Don't invent source PDFs for insurance_settlement / cd_trust_bond.
- Don't touch signing/documents/summary code.
- Don't apply migrations to prod; don't `npx tsc`; don't stop to ask — default-and-log.

## Verification gates
- **S1 (static):** completeness guard passes with the corrected active set.
- **S2 (static):** tsc + build clean.
- **R1 (deferred):** post-deploy + post-migration, an app requiring criminal_background_release generates it with fields stamped; insurance_settlement/cd_trust_bond no longer in `skipped[]`.

## Report back (build report)
- Step 0 DB findings for the four forms.
- Commit SHA; migration path (listed in OPEN-DECISIONS).
- criminal_background_release + eiv now resolve (source + field map + resolver); completeness guard green.
- insurance_settlement/cd_trust_bond outcome (disabled / blocked).
- Deferred runtime gates.
