# PRD-68 — Member-Token Signer Forms Route Fix

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (continues the launch-hardening batch after PRD-67)
**Status:** Draft — ready for build
**Severity:** P0 — magic-link signing for non-HOH adults is dead end-to-end. Every load of the signer page 500s the moment a co-applicant clicks their link.
**Depends on:** Nothing. Independent single-route fix; the columns it needs already exist (the working HOH route reads them).
**Source:** Tenant-facing code-level audit 2026-05-21 (Section 1). Confirmed in code 2026-05-21 (read `signer/[member_token]/forms/route.ts` + `t/[token]/pbv-full-app/forms/route.ts`).

---

## Problem Statement

`GET /api/pbv-full-app/signer/[member_token]/forms` (`app/api/pbv-full-app/signer/[member_token]/forms/route.ts:38`) selects three columns that **do not exist** on `pbv_form_documents`:

| Selected column | Reality |
|---|---|
| `display_name` | Not on `pbv_form_documents`. Display names live on `pbv_form_templates` (`display_name_en` / `display_name_es`, and `_pt` per `20260515040000`). |
| `required_signer_count` | Not on `pbv_form_documents`. There is `required_signer_member_ids UUID[]` (`20260515010000:20`); the count is `.length`. |
| `collected_signer_count` | Not on `pbv_form_documents`. There is `collected_signer_member_ids UUID[]` (`20260515010000:21`); the count is `.length`. |

**Impact:** every load of the magic-link signer page (`app/pbv-full-app/signer/[member_token]/page.tsx`) calls this endpoint → PostgrestError (column does not exist) → `throw error` → `catch` → **500**. Magic-link signing for non-HOH adults is dead the moment they click their email/SMS link. [Confirmed in code 2026-05-21]

**The HOH side does this correctly** and is the reference: `app/api/t/[token]/pbv-full-app/forms/route.ts:29-71` selects the `_member_ids` arrays, fetches `pbv_form_templates` separately for display names (`:38-46`), and computes counts in JS from `(doc.required_signer_member_ids ?? []).length` / `(doc.collected_signer_member_ids ?? []).length` (`:63-68`). The member-token route must mirror that.

---

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) | Fix shape |
|---|---|---|---|
| A | Selects non-existent `display_name`, `required_signer_count`, `collected_signer_count` | `signer/[member_token]/forms/route.ts:38` | select `required_signer_member_ids` + `collected_signer_member_ids`; drop `display_name`; fetch templates separately |
| B | No application fetch → no language for display-name selection | route reads only `pbv_household_members` (`:22-26`); never loads the app | resolve language via `member.full_application_id` → `pbv_full_applications.preferred_language`, fall back to `doc.language` then `'en'` |
| C | Counts must come from array lengths | `pbv_form_documents` has `*_member_ids UUID[]`, not count columns | `required_signer_count = required_signer_member_ids.length`, `collected_signer_count = collected_signer_member_ids.length` (mirror HOH `:63-64`) |

The existing token-expiry/404/410 handling (`:22-34`) and the `pbv_signature_events` per-member `signatures_complete` lookup (`:44-54`) are **correct and unchanged** — only the broken `pbv_form_documents` select + mapping changes.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Broken member-token route | `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | `:38` select references 3 columns that don't exist → 500 on every call |
| Working HOH route (reference) | `app/api/t/[token]/pbv-full-app/forms/route.ts:29-71` | correct pattern: arrays + separate template fetch + JS counts |
| Signer page (consumer) | `app/pbv-full-app/signer/[member_token]/page.tsx` | fetches `/forms`; already expects `display_name`, `required_signer_count`, `collected_signer_count`, `signatures_complete`, `conditional_trigger` in the response — the **response shape stays the same**, only its server derivation is fixed |
| Columns the fix needs | `pbv_form_documents` (`20260515010000`), `pbv_form_templates` (`20260515040000`) | already exist; **no schema change** |

---

## Goals

1. The member-token signer forms endpoint returns **200** with the correct form list — no 500. Magic-link signing for non-HOH adults works end-to-end again.
2. `display_name`, `required_signer_count`, `collected_signer_count`, and `signatures_complete` in the response are correct and carry the **same semantics as the HOH route** (the signer page consumes them unchanged).

## Non-goals

- **No** change to the HOH route (`t/[token]/pbv-full-app/forms/route.ts`).
- **No** change to signing/ceremony logic, `pbv_signature_events`, or the signer page UI beyond consuming the (unchanged-shape) corrected payload.
- **No** member-scoping change — the route returns all application forms and marks per-member completion, exactly as the HOH route does today. (See O1.)
- **No** schema change — the columns the fix needs already exist.
- **No** new Playwright/e2e test, and **no** change to `tests/e2e/**` or `.github/workflows/**`.

---

## Implementation (single phase)

In `app/api/pbv-full-app/signer/[member_token]/forms/route.ts`:

1. **Fix the `pbv_form_documents` select (`:38`).** Replace `display_name, required_signer_count, collected_signer_count` with `required_signer_member_ids, collected_signer_member_ids`. Keep `id, form_id, language, status, generated_at, finalized_at, conditional_trigger`.
2. **Resolve display language.** The member already carries `full_application_id` (`:24`). Fetch `pbv_full_applications.preferred_language` for it (one extra select), and use `app.preferred_language ?? doc.language ?? 'en'` as the language. (Mirrors HOH `:48`, which uses `app.preferred_language ?? 'en'`.)
3. **Fetch templates.** Mirror HOH `:38-46`: `select form_id, display_name_en, display_name_es from pbv_form_templates where form_id in (…)`, build a `form_id → template` map.
4. **Map the response.** For each doc:
   - `display_name = lang === 'es' ? (tmpl?.display_name_es ?? doc.form_id) : (tmpl?.display_name_en ?? doc.form_id)` (mirror HOH `:52-53`).
   - `required_signer_count = (doc.required_signer_member_ids ?? []).length`.
   - `collected_signer_count = (doc.collected_signer_member_ids ?? []).length`.
   - `signatures_complete` — keep the existing `pbv_signature_events` lookup result (`:44-54, :66`); do not change it.
   - `conditional_trigger = doc.conditional_trigger ?? null` (unchanged).
5. **Leave token expiry / 404 / 410 handling untouched** (`:22-34`).

This is the minimal change that stops the 500 and matches HOH semantics. Do not refactor beyond this route.

---

## Verification / test plan

Static gates only. **No Playwright, no e2e — do not run `npm run test:e2e`, do not add specs under `tests/e2e/**`.**

### Static (must pass before commit)
- **Gate 1 (no phantom columns):** a vitest unit test of the route handler (or an extracted mapping helper) asserts the `pbv_form_documents` query references **only** real columns (`required_signer_member_ids`, `collected_signer_member_ids`, not `display_name`/`*_count`), and that given a fixture row, `required_signer_count`/`collected_signer_count` equal the array lengths and `display_name` is the language-selected template name (falling back to `form_id`).
- **Gate 2 (language fallback):** a test asserts language resolves `preferred_language → doc.language → 'en'` and selects `display_name_es` for `'es'`, `display_name_en` otherwise.
- **Gate 3 (build):** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; `vitest run` green for the new tests (`npx vitest run` of the new spec file). Use `node ./node_modules/typescript/bin/tsc`, never `npx tsc` (hangs on Windows — see `docs/SHELL-PROTOCOL.md`).

### Deferred to the post-run verification pass (manual Chrome walk — NOT Playwright; list in build report, do NOT block)
- **Gate R1:** with a real `pbv_household_members.magic_link_token` (unexpired), `GET /api/pbv-full-app/signer/{member_token}/forms` returns **200** with the member's forms (this is the exact call that 500s today — Section 1/Section 5.5 of the audit).
- **Gate R2:** the signer page (`signer/[member_token]/page.tsx`) renders the forms list without error after the fix.

---

## Open questions

- **O1 (member scoping):** Return **all** application forms (default — mirrors the HOH route, and the existing `signatures_complete` lookup already tells the page which the member has signed) vs. filter to forms where `required_signer_member_ids` includes `member.id` (matching the route's docstring `:6-7`). Default: **return all** (no scope change). Log to OPEN-DECISIONS; the docstring-style filter is a separate refinement for both routes. [Inference]
- **O2 (language source):** `app.preferred_language` (default — mirrors HOH) vs `doc.language`. Default: `preferred_language` with `doc.language` then `'en'` fallback. [Inference]
- **O3 (PT display name):** The HOH route only selects `display_name_en` / `display_name_es` — **not** `_pt`, even though the column exists (`20260515040000`). Mirror HOH exactly (en/es) here to avoid scope creep, and flag PT display-name support as a shared follow-up for **both** routes. Default: en/es only. [Inference]

## Decisions

- **D1:** Mirror the working HOH route (`t/[token]/pbv-full-app/forms/route.ts`) — separate `pbv_form_templates` fetch + counts from `*_member_ids.length`. **No schema change** (the columns already exist).
- **D2:** No member-scoping change in this fix (return all application forms, mark per-member completion as today).
- **D3:** Response shape is unchanged — the signer page consumes the same fields; only their server-side derivation is corrected.

---

## Files expected to change

| File | Change |
|---|---|
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | fix the `pbv_form_documents` select; add `pbv_full_applications.preferred_language` fetch + `pbv_form_templates` fetch; compute counts from array `.length`; language-select display name |
| tests (new, e.g. `app/api/pbv-full-app/signer/[member_token]/forms/__tests__/route.test.ts` or a `lib` mapping test) | Gates 1–2 above (vitest unit; **not** Playwright) |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
