# Windsurf Build Prompt — PRD-68: Member-Token Signer Forms Route Fix

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates. This PRD is part of the launch-hardening batch; if you are running the 68→70 batch, also read `docs/fullApp-Plan/prompts/68-70-launch-hardening-batch-run_prompt_2026-05-21.md`.

Build from `docs/fullApp-Plan/68-pbv-member-signer-forms-route-fix_prd_2026-05-21.md`. Read it next.

## Precondition — confirm against the audit FIRST (do not skip)

A code-level audit (2026-05-21) found this bug; a **live-DB verification audit is/was running in a separate Windsurf session** (Supabase MCP, project `lieeeqqvshobnqofcdac`). Before writing any fix:

1. Read the audit report (Section 1 — it runs `select column_name from information_schema.columns where table_schema='public' and table_name='pbv_form_documents'` and attempts the exact failing select).
2. **Confirm** the three columns (`display_name`, `required_signer_count`, `collected_signer_count`) are absent from `pbv_form_documents` and that the route's select is what 500s it.
3. If the audit **contradicts** the premise (e.g. the columns exist, or the route was already fixed), **STOP** — do not build. Log the contradiction to `docs/fullApp-Plan/OPEN-DECISIONS.md` and report. Otherwise proceed.

If the audit report is not available yet, you may still confirm directly: read both route files and the migration `supabase/migrations/20260515010000_pbv_form_documents.sql`; confirm the columns are absent before fixing.

---

## The bug (one sentence)

`app/api/pbv-full-app/signer/[member_token]/forms/route.ts:38` selects `display_name`, `required_signer_count`, `collected_signer_count` from `pbv_form_documents` — none exist — so every magic-link signer page load 500s. The HOH route at `app/api/t/[token]/pbv-full-app/forms/route.ts:29-71` does it correctly; mirror it.

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening` (continues PRD-67). Do **not** create a per-PRD branch.
- One commit when done: `PRD-68: fix member-token signer forms route (phantom columns → 500)`.
- **Push after commit.**

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows — `docs/SHELL-PROTOCOL.md`). Then `npm run build`. Then `npx vitest run <new spec>`.
- **No schema change** — the columns the fix needs already exist. Do not write a migration. Do not run SQL against prod.

---

## Step-by-step

### Step 0 — Read ground truth
Read the broken route (`signer/[member_token]/forms/route.ts`), the reference route (`t/[token]/pbv-full-app/forms/route.ts`), and `signer/[member_token]/page.tsx` (the consumer — confirm the response field names it reads). Confirm the PRD's line refs still hold; if drifted, follow the code and note it in the build report.

### Step 1 — Fix the route (PRD "Implementation")
In `signer/[member_token]/forms/route.ts`:
- Change the `pbv_form_documents` select (`:38`) to `id, form_id, language, status, generated_at, finalized_at, required_signer_member_ids, collected_signer_member_ids, conditional_trigger` — drop `display_name`, `required_signer_count`, `collected_signer_count`.
- Add a `pbv_full_applications` fetch by `member.full_application_id` to get `preferred_language`. Language = `app.preferred_language ?? doc.language ?? 'en'`.
- Add a `pbv_form_templates` fetch (`form_id, display_name_en, display_name_es`) for the docs' `form_id`s; build a `form_id → template` map (mirror HOH `:38-46`).
- Map each doc: `display_name` = language-selected template name (`?? doc.form_id`); `required_signer_count` = `(required_signer_member_ids ?? []).length`; `collected_signer_count` = `(collected_signer_member_ids ?? []).length`; keep `signatures_complete` from the existing `pbv_signature_events` lookup; `conditional_trigger ?? null`.
- Leave token expiry / 404 / 410 handling unchanged.

### Step 2 — Tests (vitest unit; NOT Playwright)
Add a unit test for the route handler or an extracted mapping helper:
- Gate 1: query references only real columns; counts = array lengths; `display_name` = language-selected template name (falls back to `form_id`).
- Gate 2: language resolves `preferred_language → doc.language → 'en'`; `'es'` selects `display_name_es`, otherwise `display_name_en`.

### Step 3 — Static gates + build report + commit + push
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green. Build report at `docs/build-reports/68-pbv-member-signer-forms-route-fix_build-report_2026-05-21.md`. Commit `PRD-68: …`. **Push.**

---

## Files to modify

| File | Change |
|---|---|
| `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` | the fix (select + app-language fetch + template fetch + JS counts + language-selected display name) |
| tests (new) | Gates 1–2 (vitest unit) |

## Files NOT to touch

- `app/api/t/[token]/pbv-full-app/forms/route.ts` (the HOH reference — read-only).
- Signing/ceremony logic, `pbv_signature_events` writes, the signer page UI (beyond confirming field names).
- `tests/e2e/**` and `.github/workflows/**` — **do not** add or run Playwright/e2e here.
- `.git/config` — it is fine; if git genuinely errors, log a BLOCKER, do not "fix" it.

---

## Verification gates (per PRD-68)

**Static (must pass in-session before commit):**
- **Gate 1:** query uses only real columns; counts from `*_member_ids.length`; display_name language-selected.
- **Gate 2:** language fallback `preferred_language → doc.language → 'en'`.
- **Gate 3:** `tsc --noEmit` + `npm run build` clean; new vitest tests green.

**Deferred to the post-run verification pass (manual Chrome walk — NOT Playwright; list in build report, do NOT block):**
- **Gate R1:** with a real unexpired `magic_link_token`, `GET /api/pbv-full-app/signer/{member_token}/forms` returns 200 (the exact call that 500s today).
- **Gate R2:** the signer page renders the forms list without error.

## What "done" looks like

1. `PRD-68: …` commit on `feat/pbv-launch-hardening`, **pushed**.
2. Static gates green; no Playwright/e2e added or run.
3. The member-token forms route selects only real columns, mirrors HOH semantics, and the response shape is unchanged (signer page consumes it as-is).
4. Build report written; member-scoping (O1), language source (O2), PT display name (O3) logged to OPEN-DECISIONS.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not change the HOH route, the signing logic, or the response shape.
- Do not add member-scoping (return all forms, as HOH does) — log it as O1.
- Do not write a migration (no schema change). Do not run SQL against prod.
- **Do not add or run Playwright/e2e tests; do not touch `tests/e2e/**` or `.github/workflows/**`.**
- Do not use `npx tsc`. Do not "fix" `.git/config`.

## Reporting back (in the build report)

- Commit SHA; pushed.
- The corrected select + how language is resolved + how counts are computed.
- Confirmation the response shape is unchanged (field-by-field vs. what `page.tsx` reads).
- Decisions/defaults logged to OPEN-DECISIONS (O1–O3).
- Deferred runtime gates (R1–R2) for the post-run manual pass.
