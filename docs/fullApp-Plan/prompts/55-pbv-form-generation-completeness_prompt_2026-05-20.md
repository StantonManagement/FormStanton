# Windsurf Build Prompt — PRD-55: Form-Generation Completeness & Template Alignment

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/55-pbv-form-generation-completeness_prd_2026-05-20.md`. Read it next.

`generate-forms` silently skips any enabled template whose `form_id` doesn't line up across the DB template, the source-PDF registry, and the field-map file. Confirmed live 2026-05-20: `briefing_cert` skips because `source-pdfs.ts` keys its PDF as `briefing_docs_certification`. This PRD reconciles the whole enabled-template set so the generated packet is complete and the skipped set is intentional.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (created off `main` at the start of the batch). Do **not** create a per-PRD branch.
- One commit when done: `PRD-55: form-generation completeness & template alignment`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD writes a DB data change (`pbv_form_templates.generation_enabled`). **Write + commit the migration/seed file; do NOT apply it to prod.** Add it to the "Prod migrations to apply" section of `docs/fullApp-Plan/OPEN-DECISIONS.md`.

---

## The contract (see PRD for full detail)

A form generates only if its `form_id` agrees across four sources:
1. `pbv_form_templates.form_id` (DB) — **canonical**, with `generation_enabled=true`.
2. `lib/pbv/form-generation/source-pdfs.ts` → `SOURCE_PDFS[form_id]` (object key must equal `form_id`).
3. `scripts/field-maps/<slug>-<lang>.json` where `slug = form_id.replace(/_/g,'-')`.
4. `lib/pbv/form-generation/field-mapping.ts` → `resolveFieldData(form_id, …)`.

Any miss → `generate-forms/route.ts:112-129` skips the form, HTTP 200, no error. DB is canonical — align code/assets to the DB `form_id`.

---

## Step-by-step

### Step 0 — Read the DB truth
Query `pbv_form_templates` for all rows (`form_id`, `generation_enabled`, `source_pdf_status`, `conditional_rule`, `per_person_scope`, display names). This is the canonical list.

### Step 1 — Fix the confirmed `briefing_cert` mismatch
In `source-pdfs.ts`, rename key `briefing_docs_certification` → `briefing_cert` (loaded files unchanged). Confirm against Step 0 that the DB `form_id` is exactly `briefing_cert` + `generation_enabled=true`; if the DB differs, align to the DB and log it to OPEN-DECISIONS.

### Step 2 — Reconcile every enabled template
For each `generation_enabled=true` template verify (a) `SOURCE_PDFS[form_id]` per required language, (b) field-map file exists, (c) `resolveFieldData` handles it. Build a reconciliation table for the build report. Classify each current live skip — `criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`, plus anything Step 0 surfaces — as:
- **(a) mismatch** → fix the key/slug;
- **(b) source-pending** → `generation_enabled=false` (migration) so it stops silently skipping;
- **(c) upload-only** → disable generation; note for PRD-58.

**If sign-vs-upload intent is unclear for a form, do NOT stop.** Take the safe default — `generation_enabled=false` (so it can't silently skip and isn't presented as a half-broken form) — and log it under the pre-seeded PRD-55 entry in `OPEN-DECISIONS.md` for Alex to confirm. Keep going.

### Step 3 — Verify conditional forms
For `intake_has_pets`, `intake_has_vehicle`, `household_has_self_employment`, the child-support pair: confirm assets exist, a triggering household generates the form, a non-triggering one doesn't, and the child-support pair yields exactly one. Confirm intake captures the inputs the rules read (`pets.has_pets`, `vehicle.has_vehicle`, member `has_self_employment` / `has_child_support`). **If intake doesn't collect an input, the form can't trigger — log it as a cross-PRD flag for PRD-57** in the build report and OPEN-DECISIONS; don't try to fix intake here.

### Step 4 — Make silent skips observable
Add a fail-loud guard: a unit test (or CI/startup check) asserting every `generation_enabled=true` template resolves a source PDF + field map per required language, and/or extend the `generate-forms` response with a per-skip reason (`source_pdf_missing` / `field_map_missing` / `conditional_skipped`).

### Step 5 — Static gates + build report + commit
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; the new test green. Build report at `docs/build-reports/55-pbv-form-generation-completeness_build-report_2026-05-20.md`. Commit `PRD-55: …`. Then proceed to the PRD-56 prompt.

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/form-generation/source-pdfs.ts` | align `briefing_docs_certification` → `briefing_cert`; fix any other key drift |
| migration/seed for `pbv_form_templates` | `generation_enabled=false` for source-pending/upload-only forms; correct any `form_id` drift — **commit only, list in OPEN-DECISIONS, do not apply** |
| `scripts/field-maps/*` | add/rename only a field map whose slug genuinely mismatches its `form_id` |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | include skip reasons in the response (observability) |
| new test / CI check | assert every enabled template resolves source PDF + field map per language |

## Files NOT to touch

- Signing flow, summary doc, signature capture (PRD-56).
- Document upload + categorization UI (PRD-58) — only *flag* upload-only forms found here.
- Conditional-rule logic in `conditional-rules.ts` (confirm it fires; don't rewrite).
- Source PDFs for genuinely-unsourced forms (VAWA, RA, healthcare release, childcare-expense).

---

## Verification gates (per PRD-55)

**Static (must pass in-session before commit):**
- **Gate 2:** build report has the full reconciliation table; every enabled template resolves source PDF + field map + field mapping per language, or is reclassified with a reason.
- **Gate 5:** the new guard/test fails when a key is deliberately broken in a scratch run.
- **Gate 6:** `tsc --noEmit` + `npm run build` clean.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate 1:** `briefing_cert/<lang>` in `generated[]` (needs a deploy + `/sign/summary` walk).
- **Gate 3:** pet + vehicle + self-employment household generates those addenda; non-triggering one doesn't (needs a deploy + a triggering test token).
- **Gate 4:** remaining `skipped[]` is only intentional (needs a deploy).

---

## What "done" looks like

1. `PRD-55: …` commit on `feat/pbv-full-finalization`; migration committed + listed in OPEN-DECISIONS (not applied).
2. Static gates green.
3. `briefing_cert` key fixed; reconciliation table proves the enabled set resolves.
4. Conditional-form logic verified statically; intake-capture gaps flagged for PRD-57.
5. Drift now caught by a test/guard.
6. Build report written, deferred runtime gates listed. Proceed to PRD-56.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not leave any `generation_enabled=true` template silently skipping on a missing asset.
- Do not apply the DB migration to prod. Do not run destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config`. Do not touch signing internals.
- Do not block on deploy-only gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; migration file path (listed in OPEN-DECISIONS).
- Enabled-template reconciliation table + per-form skip classifications.
- Conditional-form verification (static) + any PRD-57 intake-capture flags.
- Decisions logged to OPEN-DECISIONS.
- Deferred runtime gates for the post-run pass.
