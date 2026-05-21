# PRD-72 — Portuguese Form Display-Name Parity

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** part of the tenant-polish batch (see batch-run prompt) — one branch off `main` after the 55–70 launch merge.
**Status:** Draft — ready for build
**Severity:** P3 — trilingual completeness. Portuguese-preferred tenants see English form names on the forms list and the magic-link signer page. Not a data-integrity bug; a localization gap against the EN/ES/PT launch bar.
**Depends on:** PRD-68 (which fixed the member-token signer route and deliberately deferred this as its O3). No code dependency beyond the routes 68 touched.
**Source:** PRD-68 O3 + `OPEN-DECISIONS.md` #R4 ("PT display name … shared follow-up for the signer + HOH routes"). Grounded against current code 2026-05-21.

---

## Problem statement

`pbv_form_templates` carries `display_name_en`, `display_name_es`, and `display_name_pt`. The `_pt` column exists but is **never read** for display and is **NULL on every row**, so a tenant whose `preferred_language = 'pt'` sees English form names everywhere forms are listed. `preferred_language` already permits `'pt'`, and the rest of the app (summary doc, consent, doc help) already branches on `pt` — only the form *names* lag.

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) |
|---|---|---|
| 1 | HOH/tenant forms route selects en/es only; `pt` falls through to EN | `app/api/t/[token]/pbv-full-app/forms/route.ts:41` (select), `:48` (`lang = app.preferred_language ?? 'en'`), `:53` (`lang === 'es' ? es : en`) |
| 2 | Member-token signer route selects en/es only | `app/api/pbv-full-app/signer/[member_token]/forms/route.ts:54` (select); language selection delegated to the mapper below |
| 3 | Pure mapper hardcodes en/es in its type + ternary | `lib/pbv/signer-forms-mapping.ts:29-31` (`interface SignerFormTemplate` — **no `display_name_pt` field**), `:58` (`lang`), `:61-63` (`lang === 'es' ? es : en`) |
| 4 | `display_name_pt` column added, nullable, no default | `supabase/migrations/20260515040000_pbv_form_templates.sql:19` |
| 5 | **`display_name_pt` is NULL on all rows** — the seed INSERT + `ON CONFLICT DO UPDATE` (`:49-50`, `:178-185`) and `20260520000000_prd55_form_generation_alignment.sql:55-56` only ever set en/es | (same files) |
| 6 | `pt` is a valid `preferred_language` | `supabase/migrations/20260501000000_pbv_application_contact_fields.sql:11-13` (`CHECK … IN ('en','es','pt')`) |
| 7 | App-wide `pt` branch precedent to mirror | `lib/pbv/summary-doc/content.ts:50`, `lib/pbv/docTypeHelp.ts:217`, `lib/pbv/consent-text.ts:12`, `lib/notifications/resolve.ts:65` |

The only place `display_name_pt` is referenced today is a type field (`lib/pbv/form-templates.ts:13`) that no consumer reads.

## Goals

1. All tenant-facing template-name read sites resolve `pt` to `display_name_pt`, with a safe fallback chain `pt → en → form_id`.
2. `display_name_pt` is populated for every `pbv_form_templates` row (best-effort PT, flagged for native review), so the branch has values to return.
3. The HOH route and the signer route stay at **parity** (identical name-resolution logic); the JSON response shape is unchanged.

## Non-goals

- **No** change to the summary-doc form list — `generate-forms/route.ts:298-300` builds names by prettifying `form_id`, not from template display names. Separate concern; out of scope.
- **No** change to PDF-asset language routing — `pt → es` for stamped PDFs is intentional (`lib/pbv/__tests__/language-routing.test.ts:25-28`); only the *display name* goes to `pt`.
- **No** schema change beyond data backfill (`display_name_pt` already exists).

## Implementation

1. **Routes + mapper.** Add `display_name_pt` to both selects (`forms/route.ts:41`, `signer/[member_token]/forms/route.ts:54`) and to `SignerFormTemplate` (`signer-forms-mapping.ts:29-31`). Replace the en/es ternary at each name-resolution site with the chain:
   `lang === 'pt' ? (display_name_pt ?? display_name_en ?? form_id) : lang === 'es' ? (display_name_es ?? form_id) : (display_name_en ?? form_id)`.
   Keep the existing `lang` resolution (`preferred_language ?? doc.language ?? 'en'`).
2. **Backfill migration (write, do NOT apply).** A new `supabase/migrations/<ts>_prd72_form_display_name_pt_backfill.sql` that `UPDATE pbv_form_templates SET display_name_pt = <PT>` per `form_id`, for all rows. Produce **best-effort PT** translations from the existing en/es names (consistent with the [PRD-59] "ship best-effort, native review post-launch" posture). List every value in OPEN-DECISIONS for native review. Idempotent / safe to re-run.
3. **Tests.** Update `lib/pbv/__tests__/signer-forms-mapping.test.ts` — the `:34` factory must include `display_name_pt`, and the `:139-143` assertion (`pt → EN`) flips to `pt → display_name_pt`, plus a case proving a NULL `display_name_pt` falls back to EN.

## Verification / test plan

**Static (must pass before commit):**
- `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean (use `node ./node_modules/typescript/bin/tsc`, never `npx tsc` — `docs/SHELL-PROTOCOL.md`).
- vitest: `pt` selects `display_name_pt`; NULL `_pt` falls back to EN; `es`/`en` unchanged; HOH and signer resolve identically.

**Deferred (manual Chrome walk — NOT Playwright; list in build report, do not block):**
- **R1:** a `preferred_language='pt'` application's forms list shows PT names on the HOH forms page AND the magic-link signer page (after the backfill migration is applied to the target env).

## Open questions

- **O1 (PT quality):** best-effort machine/Cowork PT (default — matches PRD-59) vs. block on native review. Default: best-effort, log for review, non-blocking.
- **O2 (backfill scope):** all rows incl. disabled/source-pending forms (default — cheap, complete) vs. enabled-only.

## Decisions

- **D1:** HOH + signer stay byte-parity on name resolution; both get the `pt` branch in the same shape.
- **D2:** Fallback chain `pt → en → form_id` (NOT `pt → es`) — display names are text, not PDF assets; mirrors the summary-doc `pt` handling.

## Files expected to change

| File | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/forms/route.ts` | add `display_name_pt` to select; `pt` branch |
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | add `display_name_pt` to select |
| `lib/pbv/signer-forms-mapping.ts` | add `display_name_pt` to type + `pt` branch |
| `supabase/migrations/<ts>_prd72_form_display_name_pt_backfill.sql` (new) | best-effort `display_name_pt` backfill — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/pbv/__tests__/signer-forms-mapping.test.ts` | `_pt` in factory; `pt → display_name_pt`; NULL-pt fallback |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
