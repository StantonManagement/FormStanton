# Build Report — PRD-68: Member-Token Signer Forms Route Fix

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening` (continues 62–67)
**Commit:** `ad33f52` (pushed to `origin/feat/pbv-launch-hardening`)
**Status:** ✅ Static gates green; deferred runtime gates listed below for the manual Chrome walk.

---

## Premise — confirmed in code (audit unavailable in-session)

The live-DB verification audit referenced in the prompt was not present at
`docs/audits/` at build time. Per the prompt's fallback ("If the audit report
isn't available… confirm directly from code/migrations"), confirmed:

- `supabase/migrations/20260515010000_pbv_form_documents.sql` defines
  `required_signer_member_ids UUID[]` and `collected_signer_member_ids UUID[]`
  (lines 20–21). No `display_name`, no `*_count` columns anywhere on
  `pbv_form_documents`.
- The broken route at
  `app/api/pbv-full-app/signer/[member_token]/forms/route.ts:38` (pre-fix)
  selected `display_name, required_signer_count, collected_signer_count`
  — three columns that don't exist → PostgrestError → 500 on every load.
- The HOH route at `app/api/t/[token]/pbv-full-app/forms/route.ts:29-71`
  uses the arrays + a separate `pbv_form_templates` fetch + JS counts. The
  fix mirrors HOH exactly.

Premise stands. Built.

---

## What changed

| File | Change |
|---|---|
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | Fixed select to use real columns (`required_signer_member_ids`, `collected_signer_member_ids`); added `pbv_full_applications.preferred_language` fetch + `pbv_form_templates` fetch; delegates mapping to `mapSignerForms`. Token expiry / 404 / 410 handling unchanged. |
| `lib/pbv/signer-forms-mapping.ts` (new) | Pure helper: `mapSignerForms({ docs, templates, preferredLanguage, signedFormIds })` → response array. Extracted so the language-selection + count-from-array-length + per-member `signatures_complete` logic is unit-testable without mocking Supabase. |
| `lib/pbv/__tests__/signer-forms-mapping.test.ts` (new) | 11 vitest unit tests covering Gates 1 & 2 + shape parity with the signer page. |
| `docs/fullApp-Plan/OPEN-DECISIONS.md` | Appended O1 (member-scoping), O2 (language source), O3 (PT display name). |

**Response shape unchanged** — the signer page (`app/pbv-full-app/signer/[member_token]/page.tsx:28-32`) reads
`json.data?.forms ?? []` and the typed `FormDoc` shape it consumes (`id, form_id,
display_name, language, status, generated_at, finalized_at, required_signer_count,
collected_signer_count, signatures_complete, conditional_trigger`) is what
`mapSignerForms` returns, field-for-field.

**Language resolution:** `app.preferred_language ?? doc.language ?? 'en'`; `'es'`
selects `display_name_es`, otherwise `display_name_en`. (Mirrors HOH plus a
`doc.language` fallback — O2.)

**Counts:** `(doc.required_signer_member_ids ?? []).length` and
`(doc.collected_signer_member_ids ?? []).length` — JS-side, identical to HOH
`:63-64`.

---

## Static gates — all green ✅

| Gate | Result | Notes |
|---|---|---|
| Gate 1: query references only real columns; counts = array lengths; display_name = language-selected template name (falls back to `form_id`) | ✅ | covered by `signer-forms-mapping.test.ts` Gate 1 block (4 tests) |
| Gate 2: language resolves `preferred_language → doc.language → 'en'`; `'es'` selects `display_name_es`, otherwise `display_name_en` | ✅ | Gate 2 block (6 tests) including null/missing-template/non-es-language edges |
| Gate 3: `node ./node_modules/typescript/bin/tsc --noEmit` clean | ✅ | exit 0, no output |
| Gate 3: `npm run build` clean | ✅ | Next.js production build completed; `/pbv-full-app/signer/[member_token]` route appears in the manifest |
| Gate 3: new vitest spec green | ✅ | `npx vitest run lib/pbv/__tests__/signer-forms-mapping.test.ts` → 1 file, 11 tests passed |

No Playwright/e2e added or run. `tests/e2e/**` and `.github/workflows/**` untouched.

---

## Deferred runtime gates (manual Chrome walk — NOT Playwright)

Listed for the post-run verification pass. **Do not block on these in-session.**

- **Gate R1:** with a real unexpired `pbv_household_members.magic_link_token`,
  `GET /api/pbv-full-app/signer/{member_token}/forms` returns 200 with the
  member's forms (the exact call that 500s pre-fix).
- **Gate R2:** the signer page (`app/pbv-full-app/signer/[member_token]/page.tsx`)
  renders the forms list without error after the fix; per-form display name,
  counts, and "Sign" CTA enabled/disabled state match HOH parity.

---

## Decisions logged to OPEN-DECISIONS

- **O1 — member-scoping:** return all application forms (HOH parity), rely on
  per-member `signatures_complete` to mark progress. Docstring filter deferred.
- **O2 — language source:** `preferred_language → doc.language → 'en'`. Strict
  HOH parity plus a `doc.language` fallback.
- **O3 — PT display name:** EN/ES only (mirrors HOH). PT support is a shared
  follow-up for both routes.

---

## Cross-PRD flags

None. PRD-68 is an isolated route fix. Response shape is unchanged, so it does
not interact with PRDs 62–67 (signing/finalize), and 69 (storage migration) /
70 (UX polish) are independent.

The PT display-name gap (O3) is a shared issue with the HOH route — a future
PT-display-name PRD should land both routes (and any other template-name read
sites) together.
