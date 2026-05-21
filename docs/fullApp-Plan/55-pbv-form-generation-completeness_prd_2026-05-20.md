# PRD-55 — Form-Generation Completeness & Template Alignment

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `fix/pbv-form-generation-completeness-55`
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane (a form that silently fails to generate is a missing legal document in the submitted packet)
**Depends on:** PRD-54 (Bug C source-PDF tracing) — shipped. Builds on the same `generate-forms` path.
**Blocks:** PRD-56 (signing) — the tenant can only sign forms that were generated. Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`).

---

## Problem Statement

`generate-forms` silently skips any enabled template whose `form_id` doesn't line up across three independent sources (DB template, source-PDF registry, field-map file). The skip returns HTTP 200 with the form simply absent from `generated[]` — there is no error, so a missing form is invisible until someone notices the packet is short.

This is **confirmed for at least one form.** In the live PRD-54 verification (prod token `222-224-maple-ave-unit-2n-…`, 2026-05-20), `generate-forms` returned `total_generated: 9` with `skipped` containing `briefing_cert/en`. Investigation:

- The DB template `form_id` is `briefing_cert` (that's the string `generate-forms` requests).
- The field map `scripts/field-maps/briefing-cert-en.json` **exists**.
- The source PDF `assets/pbv-source-pdfs/briefing-cert-en.pdf` **exists**.
- But `lib/pbv/form-generation/source-pdfs.ts` registers that PDF under the key **`briefing_docs_certification`**, not `briefing_cert`. So `getSourcePdf('briefing_cert','en')` returns `null` → the form skips at the source-PDF check (`generate-forms/route.ts:112-118`) before it ever reaches its (present) field map.

The form *is* meant to be a stamped PDF: it's `generation_enabled=true` in `pbv_form_templates`, it has both assets, and it appears in the packet as "Family Certification of Briefing Documents Received." (The `app/pilot/briefing-cert/` HTML-rendering exploration is the **abandoned** approach per `form-execution-plan_2026-05-14.md` — PDF overlay won. It is not the production path.)

`briefing_cert` is the one we caught. The same class of mismatch can hide in any enabled template, and the conditional forms (pet / vehicle / self-employment) have **never been verified to generate** for a household that triggers them — the test applicants didn't have pets, vehicles, or self-employment. We need a one-time reconciliation that guarantees the generated set is complete and the skipped set is intentional.

---

## Root cause / findings (confirmed in code 2026-05-20)

The generated set is determined by an implicit contract across four sources that must agree on `form_id`:

| Source | Where | Keyed by |
|---|---|---|
| Template registry | `pbv_form_templates` (DB) — `getEnabledFormTemplates()` | `form_id` (canonical) |
| Source PDF registry | `lib/pbv/form-generation/source-pdfs.ts` → `SOURCE_PDFS` | object key (must equal `form_id`) |
| Field map file | `scripts/field-maps/<slug>-<lang>.json`, `slug = form_id.replace(/_/g,'-')` | filename slug |
| Field data resolver | `lib/pbv/form-generation/field-mapping.ts` → `resolveFieldData(formId, …)` | `form_id` |

`generate-forms/route.ts` walks enabled templates, evaluates `shouldGenerateForm(conditional_rule, …)`, then requires **both** `getSourcePdf(form_id, lang)` and `loadFieldMap(form_id, lang)` to be non-null. Any miss → `skipped.push(\`${form_id}/${lang}\`)`, HTTP 200, no error surfaced.

**Confirmed defect:** `source-pdfs.ts` key `briefing_docs_certification` ≠ template `form_id` `briefing_cert`. Fix is to align the key to `briefing_cert` (the assets are already named `briefing-cert-*`).

**Unverified, must be checked by this build:**
- Whether the other live-skipped entries (`criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`) are (a) more key mismatches, (b) genuinely source-pending (should be `generation_enabled=false` until assets land), or (c) upload-only forms that shouldn't be generation templates at all. They appear on the documents page as uploads, which suggests possible (c) — confirm and classify.
- Whether the conditional forms (`pet_addendum`, `vehicle_addendum`, `self_employment_worksheet`, `child_support_affidavit`/`no_child_support_affidavit`) generate correctly when their rule fires, including that their field maps exist and `resolveFieldData` handles them.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Key mismatch (confirmed) | `lib/pbv/form-generation/source-pdfs.ts:85-88` | `briefing_docs_certification` should be `briefing_cert` |
| Silent skip (no error) | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:112-129` | source-PDF / field-map miss → skip, HTTP 200, no signal |
| Enabled templates | `pbv_form_templates` (DB `lieeeqqvshobnqofcdac`) | source of `form_id` + `generation_enabled` + `source_pdf_status` + `conditional_rule` |
| Conditional rules | `lib/pbv/conditional-rules.ts` | `intake_has_pets`, `intake_has_vehicle`, `household_has_self_employment`, child-support pair, etc. |
| Field maps present | `scripts/field-maps/*.json` | bundled via PRD-54 `outputFileTracingIncludes` |
| Source PDFs present | `assets/pbv-source-pdfs/*.pdf` | bundled via PRD-54 `outputFileTracingIncludes` |
| Conditional intake capture | intake UI (PRD-57 surface) | rules read `intakeData.pets.has_pets`, `intakeData.vehicle.has_vehicle` — confirm intake collects these, else the forms can never trigger |

---

## Goals

1. Every template that is **supposed** to generate as a stamped PDF does so, with its data correctly stamped — no silent skips of forms that should exist.
2. `briefing_cert` generates (registry key aligned to the template `form_id`).
3. Every enabled template is reconciled across DB `form_id` ↔ `source-pdfs.ts` key ↔ field-map slug ↔ `resolveFieldData` — all four agree, verified by a check that fails loudly on drift.
4. The conditional forms (pet, vehicle, self-employment, child-support pair) are verified to generate for a household that triggers each, and to be absent for one that doesn't.
5. The skipped set is **intentional and documented**: each skip is classified as fixed-mismatch, source-pending-and-flagged-off, or upload-only-not-a-generation-template — with the DB rows corrected so generation_enabled reflects reality.
6. A silent zero-asset skip becomes observable (the build adds a guard/log/startup check so a future mismatch is caught, not hidden).

## Non-goals

- No change to the signing flow, summary doc, or document-upload/categorization (that's PRD-56 / PRD-58).
- No new federal form sourcing (VAWA, Reasonable Accommodation, healthcare-provider release, childcare-expense verification stay source-pending — externally blocked).
- No change to the conditional-rule *logic* beyond confirming each fires; the intake fields that feed them are PRD-57's surface (flag, don't fix here).

---

## Implementation phases

### Phase 1 — Fix the confirmed `briefing_cert` mismatch
- In `lib/pbv/form-generation/source-pdfs.ts`, rename the `briefing_docs_certification` registry key to `briefing_cert` (the loaded files `briefing-cert-en.pdf` / `briefing-cert-es.pdf` are unchanged).
- First confirm against the DB that the template `form_id` is exactly `briefing_cert` and `generation_enabled=true`. If the DB uses a different `form_id`, align to whatever the DB row actually is (DB is canonical) and report the discrepancy.

### Phase 2 — Reconcile all enabled templates (the audit)
- Pull all `pbv_form_templates` where `generation_enabled=true`. For each, verify: (a) a `SOURCE_PDFS[form_id]` entry exists for each required language; (b) `scripts/field-maps/<slug>-<lang>.json` exists; (c) `resolveFieldData(form_id, …)` has a mapping. Produce a reconciliation table in the build report.
- Classify every current live skip (`criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`, and any others) as: **(a) mismatch** → fix the key/slug; **(b) source-pending** → set `generation_enabled=false` (write a migration/seed update) so it stops appearing as a silent skip; **(c) upload-only** → remove from generation templates (it belongs to the documents/upload set, not generate-forms). Record the decision per form.

### Phase 3 — Verify conditional forms
- For each of `intake_has_pets`, `intake_has_vehicle`, `household_has_self_employment`, `household_has_child_support` / `household_no_child_support`: confirm the form's assets exist and that a triggering household produces the form and a non-triggering one does not. Confirm the child-support pair is mutually exclusive (exactly one generates).
- Confirm the intake actually captures the inputs these rules read (`pets.has_pets`, `vehicle.has_vehicle`, member `has_self_employment` / `has_child_support`). If intake does not collect a given input, the form can never trigger — **flag this for PRD-57** in the build report; do not silently leave a form un-triggerable.

### Phase 4 — Make silent skips observable
- Add a fail-loud signal so a future asset/key drift can't hide: e.g. a startup/CI check (or a unit test) that asserts every `generation_enabled=true` template resolves a source PDF + field map for each required language, and/or have `generate-forms` include skip reasons (`source_pdf_missing` vs `field_map_missing` vs `conditional_skipped`) in its response so a short packet is diagnosable from the response body.

---

## Verification / test plan

Run against a deployed preview (asset bundling is runtime-specific; local-only is insufficient — see `docs/SHELL-PROTOCOL.md`).

- **Gate 1 (briefing_cert):** on a fresh `/sign/summary` load, `generate-forms` returns `briefing_cert/<lang>` in `generated[]`, not `skipped[]`. The stamped PDF renders with the tenant's data.
- **Gate 2 (reconciliation):** the build report contains the full enabled-template reconciliation table; every enabled template resolves source PDF + field map + field mapping for each required language, or is explicitly reclassified (flagged off / moved to upload-only) with a reason.
- **Gate 3 (conditional forms):** a household with a pet + a vehicle + self-employment income generates `pet_addendum`, `vehicle_addendum`, `self_employment_worksheet`; a household with none of these does not. The child-support pair yields exactly one form.
- **Gate 4 (intentional skips):** the remaining `skipped[]` contains only forms classified as source-pending (and they are `generation_enabled=false` so they no longer appear) or conditional-not-triggered. No `generation_enabled=true` template skips for a missing asset.
- **Gate 5 (observability):** the new guard/test fails when a registry key is deliberately broken in a scratch run, proving drift is now caught.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean.

---

## Open questions

- **O1:** For each live-skipped form (`criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`): is it a form the tenant **signs** (generate as stamped PDF) or one they **upload** (office-provided / evidence)? This determines fix vs reclassify. The documents page lists some of these as uploads — confirm against HACH intake expectation. (Overlaps PRD-58.)
- **O2:** Are the conditional intake inputs (`pets.has_pets`, `vehicle.has_vehicle`) actually collected in the current intake? If not, PRD-57 must add them before pet/vehicle forms can ever trigger.

## Decisions

- **D1:** `briefing_cert` generates as a stamped PDF; the HTML pilot is abandoned and out of scope. (Resolved 2026-05-20 from `form-execution-plan_2026-05-14.md`.)
- **D2:** DB `pbv_form_templates.form_id` is the canonical key; `source-pdfs.ts` and field-map slugs align to it (not the reverse).
- **D3:** Source-pending forms become `generation_enabled=false` rather than being left enabled-and-silently-skipped, so the skipped set is always intentional.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/form-generation/source-pdfs.ts` | 1, 2 | align `briefing_docs_certification` → `briefing_cert`; fix any other key drift found |
| `pbv_form_templates` (DB migration/seed) | 2 | set `generation_enabled=false` for genuinely source-pending forms; correct any `form_id` drift |
| `scripts/field-maps/*` | 2 | add/rename any field map whose slug doesn't match its `form_id` (only if a real mismatch is found) |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | 4 | include skip reasons in the response (observability) |
| new test or CI check | 4 | assert every enabled template resolves source PDF + field map per language |

If anything outside this list needs changing, stop and report rather than expanding scope.
