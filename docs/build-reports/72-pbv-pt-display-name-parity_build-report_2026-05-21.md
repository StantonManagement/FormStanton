# Build Report — PRD-72: Portuguese Form Display-Name Parity

**Date:** 2026-05-21
**Branch:** `feat/pbv-tenant-polish` (branched off `feat/pbv-launch-hardening` — that branch is not yet merged to `main`, per the batch-run prompt fallback)
**Commit:** `4500f6c` (pushed to `origin/feat/pbv-tenant-polish`)
**Status:** ✅ Static gates green. Backfill migration written, **not applied** — listed in OPEN-DECISIONS for native PT review.

---

## Premise — confirmed in code 2026-05-21

PRD-72 findings re-verified before changes:

- HOH route ([app/api/t/[token]/pbv-full-app/forms/route.ts:41](app/api/t/[token]/pbv-full-app/forms/route.ts)) selected en/es only; resolved language at `:48` and ternaried at `:53` — `pt` fell through to EN.
- Member-token signer route ([app/api/pbv-full-app/signer/[member_token]/forms/route.ts:54](app/api/pbv-full-app/signer/[member_token]/forms/route.ts)) selected en/es only; delegates display-name resolution to the mapper.
- Mapper ([lib/pbv/signer-forms-mapping.ts](lib/pbv/signer-forms-mapping.ts)) — `SignerFormTemplate` had no `display_name_pt` field; ternary at `:60-63` was en/es only.
- `display_name_pt` column exists ([supabase/migrations/20260515040000_pbv_form_templates.sql:19](supabase/migrations/20260515040000_pbv_form_templates.sql)), nullable, no default, never written by any seed/UPDATE in the current migration set.
- `pt` is a valid `preferred_language` value ([supabase/migrations/20260501000000_pbv_application_contact_fields.sql:11-13](supabase/migrations/20260501000000_pbv_application_contact_fields.sql)).

Premise stands. Built.

---

## What changed

| File | Change |
|---|---|
| [app/api/t/[token]/pbv-full-app/forms/route.ts](app/api/t/[token]/pbv-full-app/forms/route.ts) | Added `display_name_pt` to template select; introduced the `pt → en → form_id` branch alongside the existing `es` / default branches. |
| [app/api/pbv-full-app/signer/[member_token]/forms/route.ts](app/api/pbv-full-app/signer/[member_token]/forms/route.ts) | Added `display_name_pt` to template select — mapper handles language resolution. |
| [lib/pbv/signer-forms-mapping.ts](lib/pbv/signer-forms-mapping.ts) | Added `display_name_pt: string \| null` to `SignerFormTemplate`; replaced en/es ternary with the same `pt → en → form_id` chain so HOH and signer stay byte-parity (D1). |
| [lib/pbv/__tests__/signer-forms-mapping.test.ts](lib/pbv/__tests__/signer-forms-mapping.test.ts) | `tmpl()` factory takes an optional 4th `pt` argument (defaults to `null`, so all existing call sites still type-check). Replaced the prior `pt → EN` test (PRD-68 O3) with three new pt cases: `pt → display_name_pt`; `pt + NULL _pt → display_name_en`; `pt + both NULL → form_id`. |
| [supabase/migrations/20260521060000_prd72_form_display_name_pt_backfill.sql](supabase/migrations/20260521060000_prd72_form_display_name_pt_backfill.sql) (new) | Best-effort PT backfill for all 18 seeded form_id rows. Per-row `UPDATE`, idempotent. Handles both `briefing_cert` (post-PRD-55) and `briefing_docs_certification` (pre-PRD-55) so it works regardless of whether PRD-55 has been applied. **Committed, NOT applied.** |

**Response shape unchanged** — the signer page and HOH UI consume the same `display_name` field; only the source value differs when `lang === 'pt'`.

**Fallback chain (D2):** `pt → en → form_id`. Display names are text, so we fall back to EN (not ES, which would only matter for PDF asset routing — that intentionally stays `pt → es` per `lib/pbv/__tests__/language-routing.test.ts:25-28`).

---

## Static gates — all green ✅

| Gate | Result | Notes |
|---|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ clean | No errors. |
| `npm run build` | ✅ clean | All 80+ routes compile. Pre-existing env warnings (`RESEND_API_KEY` format, `ANTHROPIC_API_KEY` not set) unchanged. |
| `vitest run lib/pbv/__tests__/signer-forms-mapping.test.ts` | ✅ 13/13 pass | Was 11; +2 net (replaced 1 PRD-68 case, added 3 PRD-72 cases). |

`npm run build` warning lines about `/api/admin/compliance/warn-tenant` and `/api/log/client-error` are baseline env-validation noise, not code errors.

---

## Decisions taken

| # | Decision | Source |
|---|---|---|
| D1 | HOH route and signer mapper stay byte-parity — same chain, same fallback. | PRD-72 D1 |
| D2 | Fallback `pt → en → form_id`, not `pt → es`. | PRD-72 D2 |
| O1 | Best-effort PT (machine + Cowork-drafted), flagged for native review, non-blocking. | PRD-72 O1 default — matches PRD-59 posture. |
| O2 | Backfill ALL rows, including `generation_enabled=FALSE` (source-pending) forms. Cheap, complete, future-proof. | PRD-72 O2 default. |

No defaults diverged from the PRD's listed defaults. Nothing was hard-stopped.

---

## Deferred gates (manual Chrome walk — NOT Playwright)

| # | Gate | When |
|---|---|---|
| R1 | A `preferred_language='pt'` application's forms list shows PT names on both the HOH forms page (`/t/[token]/.../forms`) and the magic-link signer page (`/pbv-full-app/signer/[member_token]`). | After the backfill migration is applied to the target env. Pre-application, both surfaces will continue to show EN (fallback chain working as designed). |

Per the batch-run prompt: do not run, add, or modify Playwright/e2e. The `E2E Tenant Flow` red check stays red and is not the merge bar.

---

## Prod migration to apply

`supabase/migrations/20260521060000_prd72_form_display_name_pt_backfill.sql` — listed in [OPEN-DECISIONS.md](../fullApp-Plan/OPEN-DECISIONS.md) "Prod migrations to apply" with the full PT-value table for native review.

---

## Full list of PT display names written (for native review)

| form_id | display_name_pt (best-effort) |
|---|---|
| main_application | Pedido HCV de Ocupação Continuada |
| citizenship_declaration | Declaração de Cidadania |
| obligations_of_family | Obrigações da Família |
| hud_9886a | HUD-9886-A Autorização para Divulgação de Informações |
| hach_release | Autorização HACH para Divulgação de Informações |
| hud_92006 | Formulário de Contato Suplementar HUD-92006 |
| child_support_affidavit | Declaração Juramentada de Pensão Alimentícia |
| no_child_support_affidavit | Declaração Juramentada de Ausência de Pensão Alimentícia |
| pet_addendum | Adendo de Animais de Estimação |
| vehicle_addendum | Adendo de Veículo |
| self_employment_worksheet | Planilha de Renda de Trabalho Autônomo |
| briefing_cert / briefing_docs_certification | Certificação Familiar de Recebimento de Documentos de Orientação |
| debts_owed_phas | Dívidas com Autoridades de Habitação (HUD-52675) |
| vawa_certification | Certificação VAWA (HUD-5382) |
| reasonable_accommodation_request | Pedido de Adaptação Razoável |
| zero_income_statement | Declaração de Renda Zero |
| eiv_guide_receipt | Recibo do Guia EIV |
| criminal_background_release | Autorização de Antecedentes Criminais |

18 rows. All flagged for native PT review; route fallback chain (`pt → en → form_id`) means any reverted value safely falls back to English, not to a slug.
