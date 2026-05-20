# PRD-53 — Preapp Contact Capture + Staff Income Edit & Qualification Override

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-preapp-contact-and-override-53`
**Status:** Draft — ready for build
**Depends on:** PRD-51 (`feat/pbv-preapp-combined-approve-send-51`). This PRD builds on PRD-51's combined-invite work and fixes the gate that hid it. **Recommend building this on top of the PRD-51 branch, or merging PRD-51 first.**
**Blocks:** A working preapp → invitation flow for real applicants (qualified AND over-income).

---

## Problem Statement

Three connected failures, surfaced by real use on 2026-05-19:

1. **The phone + invite section is hidden for over-income preapps.** The combined-invite UI (PRD-51) is wrapped in `{qualified && (...)}` at `app/admin/pbv/preapps/page.tsx:1071`, where `qualified = qualification_result === 'likely_qualifies'`. Staff testing over-income applicants see *nothing* — no phone field, no invite button. This came from a closed decision in PRD-51 ("hide button if not likely_qualifies") that was wrong: staff routinely need to work over-income preapps (correct a mis-entered income, or override on judgment).

2. **No way to edit the applicant's income or override the qualification.** The applicant's `total_household_income` is display-only on the preapp. If it was entered wrong, staff are stuck. And there's no path to approve + invite an over-income applicant on staff judgment (e.g., deductions not captured in the preapp, borderline case, known correction coming).

3. **The public preapp form collects no contact info.** New applicants submit name, DOB, income, and household — but no phone or email. So every invitation requires staff to source contact info separately. New preapps should capture phone + email at submission.

Net effect: the combined-invite feature we've iterated on three times has been invisible for exactly the applicants staff were testing, and even when visible, can't be driven for the over-income cases that need human judgment.

---

## Current state (confirmed 2026-05-19)

| Surface | Path | Notes |
|---|---|---|
| Invite section gate | `app/admin/pbv/preapps/page.tsx:1071` | `{qualified && (<section>...phone + invite...</section>)}` — hides everything for non-qualified preapps. |
| Income display (read-only) | preapps/page.tsx ~942-946 | Shows `total_household_income` + `income_limit` + an Over/Under pill. No edit. |
| `incomeOk` derivation | preapps/page.tsx:676 | `income_limit === null || total_household_income <= income_limit`. |
| Preapp schema | `pbv_preapplications` | Has `phone` (PRD-51 migration `20260519000000_pbv_preapp_phone.sql`). **No `email` column.** |
| Public preapp form | `components/portal/PbvPreappForm.tsx` | Collects `hoh_name`, `hoh_dob`, income sources, household members. **No phone, no email.** |
| Preapp submit API | `app/api/forms/pbv-preapp/route.ts` (verify exact path) | Stores the public submission. |
| Preapp edit API | `app/api/admin/pbv/preapps/[id]/route.ts` (PRD-51 added/extended for phone) | PATCH path — extend for income + email. |
| Translations | `lib/pbvPreappTranslations.ts` or `lib/pbvFormTranslations.ts` (verify) | Trilingual en/es/pt. New form fields need entries. |

**Infrastructure blockers (NOT PRD scope, but block the result):**
- The PRD-51 phone migration is **not on `main`** (verified via `git cat-file`). The merge may not have landed.
- `.git/config` is **corrupted** (`fatal: bad config line 23`). This can make merges/pushes silently misbehave. Fix before merging.
- The migration must be **applied to the prod Supabase DB** (`lieeeqqvshobnqofcdac`) — merging the file doesn't add the column to the running database.

---

## Goals

1. **Phone + invite controls visible for every preapp**, regardless of qualification.
2. **Staff can edit the applicant's income** inline; qualification recomputes on save.
3. **Staff can override an over-income qualification** and send the invitation, recording a typed reason to the audit trail.
4. **New public preapp submissions capture phone (required) and email (optional).**
5. **No regression** to PRD-51's combined-invite happy path for qualified applicants.

## Non-Goals

- No change to how `qualification_result` is computed at submission — we add an *override*, not a re-derivation.
- No change to the send-sms endpoint or notification templates.
- No bulk override.
- No removal of the qualification *display* — the over-income badge stays; we just stop it from hiding the controls.

---

## Closed Decisions

1. **Ungate the invite section entirely.** Replace `{qualified && (...)}` with always-render. The section adapts its button to the qualification state (see F3).

2. **Phone is editable for any preapp; email surfaced too.** Phone field (PRD-51) moves out of the qualified-only gate. Email displayed + editable alongside it.

3. **Income edit is inline, recomputes qualification on save.** Editing `total_household_income` re-evaluates `incomeOk` against `income_limit`. If the corrected income is under the limit, the preapp becomes `likely_qualifies` and the normal invite flow applies. Persisted via the preapp PATCH endpoint, audit-logged.

4. **Override requires a typed reason.** For a genuinely over-income applicant staff still want to advance, the button reads **"Override & Send Invitation."** Clicking it requires a one-line reason ("why is this over-income applicant being advanced?"). The reason is stored and audit-logged. Rationale: HACH is a government partner; an over-income advance is exactly the kind of decision compliance may need to justify later. (Adjustable — if this proves to be friction, the reason can be made optional in a follow-up.)

5. **Public form: phone required, email optional.** Phone is the SMS channel (the primary invitation path), so it's required. Email is the fallback channel (the send-sms endpoint already has email fallback), so it's encouraged but optional. Both trilingual.

6. **Existing preapps without contact info are unaffected.** No backfill. Staff enter contact info manually for pre-existing preapps via the same admin fields (PRD-51 behavior).

---

## Detailed Changes

### F1 — Public preapp form: phone + email

**Files:** `components/portal/PbvPreappForm.tsx`, the preapp submit API, the preapp translations file, a new migration.

- **Migration** (`supabase/migrations/<timestamp>_pbv_preapp_email.sql`): `ALTER TABLE pbv_preapplications ADD COLUMN IF NOT EXISTS email TEXT;` (phone already exists.)
- **Type:** add `email: string | null` to `PbvPreapplication` in `types/compliance.ts`.
- **Form:** add a phone input (required, `type="tel"`) and email input (optional, `type="email"`) to the HOH section of `PbvPreappForm.tsx`, near `hoh_name`. Client-side validation: phone required + parseable; email optional but valid format if present.
- **Submit API:** accept + store `phone` and `email` on the new preapp row.
- **Translations:** add `hoh_phone_label`, `hoh_email_label`, and validation messages in en/es/pt.

### F2 — Ungate the invite section

**File:** `app/admin/pbv/preapps/page.tsx:1071`

Replace `{qualified && (<section>...</section>)}` with an always-rendered section. The phone field, email field, and the combined-invite controls render for every preapp. Qualification state changes the *button*, not the section's visibility (F3).

### F3 — Qualification-aware invite button

The combined button (PRD-51 F1-F2) adapts:

- **Qualified** (`likely_qualifies`): "Approve & Send Invitation" → "Create & Send Invitation" → "Send Invitation" (PRD-51 behavior, unchanged).
- **Not qualified** (over_income or other): button reads **"Override & Send Invitation."** Clicking it opens an inline panel requiring a typed reason before proceeding. On confirm, the chain runs (approve-with-override → create full_app → send SMS), and the override reason is persisted + audit-logged.

The confirm panel shows: recipient, phone, language, **and** — when overriding — a banner ("This applicant is over the income limit. You are advancing them on override.") plus the reason input.

### F4 — Inline income edit

**File:** `app/admin/pbv/preapps/page.tsx` (income display ~942)

- Add an edit affordance to the `total_household_income` display (pencil/Edit link → input + Save/Cancel).
- Save → PATCH the preapp (`total_household_income`), recompute `incomeOk` and the qualification badge locally, persist.
- If the corrected income moves the applicant under the limit, the invite button reverts from "Override & Send" to "Approve & Send" automatically.
- Audit-log the income edit (old → new).

### F5 — Override + income-edit persistence + audit

**File:** preapp PATCH endpoint (`app/api/admin/pbv/preapps/[id]/route.ts`)

- Accept `total_household_income`, `email`, `phone`, and an `override` object `{ reason: string }` for the over-income advance.
- Store the override reason on the preapp (new column `qualification_override_reason TEXT` + `qualification_override_at TIMESTAMPTZ` + `qualification_override_by TEXT`, via the F1 migration or a sibling migration).
- Audit-log each: income edit, override, contact-info edit. Reuse the existing audit pattern.

### F6 — Surface email in admin

Show `email` on the preapp detail page alongside phone (display + inline edit), and pass it through to `pbv_full_applications` on create (so the email-fallback notification path works).

---

## Architecture Rules

1. **No change to `qualification_result` computation** at submission. Override is additive.
2. **No change to the send-sms endpoint or notification templates.**
3. **All new public-facing strings via the preapp translations file**, en/es/pt. Admin strings stay English.
4. **Phone/email validation via `lib/phoneParser.ts`** (phone) and a simple email regex (email). No new validation deps.
5. **Audit every staff mutation**: income edit, override, contact edit.
6. **Migrations are created as `.sql` files, not executed by the build agent.**
7. **No `localStorage`/`sessionStorage`.**

---

## Verification Gates

### Gate 1 — Public form collects + stores phone + email
- Submit a new preapp with phone + email. Verify both land on the `pbv_preapplications` row.
- Phone required (form blocks submit without it); email optional (submits when blank).
- Walk es + pt — labels + validation localized.

### Gate 2 — Over-income preapp shows phone + invite controls
- Open an over-income preapp. The phone field, email field, and invite button are all visible (previously hidden).

### Gate 3 — Income edit recomputes qualification
- On an over-income preapp, edit `total_household_income` to a value under the limit. Save.
- Qualification badge flips to "Likely Qualifies." Invite button changes from "Override & Send" to "Approve & Send."
- Verify the edit persisted and was audit-logged.

### Gate 4 — Override path
- On a genuinely over-income preapp (income correct), click "Override & Send Invitation."
- Reason input is required — confirm cannot proceed without it.
- Enter reason, confirm. Chain runs: approve (with override) → create full_app → send SMS.
- Override reason + actor + timestamp persisted and audit-logged.

### Gate 5 — Qualified path unchanged
- Qualified preapp: "Approve & Send Invitation" works exactly as PRD-51 shipped. No override prompt, no regression.

### Gate 6 — Email propagates to full_app
- After invite, `pbv_full_applications.email` matches the preapp email (enables email-fallback).

### Gate 7 — Build + types
- `node ./node_modules/typescript/bin/tsc --noEmit` clean (NOT `npx` — see `docs/SHELL-PROTOCOL.md`).
- `npm run build` clean.

---

## Out of Scope (do not touch)

- `qualification_result` computation logic.
- send-sms endpoint, notification templates, `lib/notifications/**`.
- Tenant full-app flow.
- HACH-facing surfaces.
- The income-*limit* threshold editor (different feature; this PRD edits the applicant's income, not the limits table).

---

## Phasing

One PRD, ideally one PR. If the build agent prefers, the public-form work (F1) and the admin work (F2-F6) can land as two commits on the same branch — they're independent. Estimated Windsurf time: 4-7 hours.

**Sequencing note:** this depends on PRD-51's combined-invite handler. Build on the PRD-51 branch, or merge PRD-51 to main first (after fixing the git config + landing the phone migration). The build report must confirm the phone migration is present and note that BOTH the phone and email migrations must be applied to prod Supabase before this works in production.

---

## Open Questions

| ID | Question | Owner | Blocker? |
|---|---|---|---|
| O1 | Should email be required on the public form, not just phone? | Alex | No — MVP: phone required, email optional. Flip if you want both required. |
| O2 | Should the override reason be a free-text field or a dropdown of preset reasons (deduction, correction pending, borderline, other)? | Alex | No — MVP free text. Presets can come later if patterns emerge. |
| O3 | Who can override — any staff, or only Tess/Kristine (who hold send_to_hach permission)? | Alex | No — MVP: any authenticated staff. Tighten to a permission check if needed. |
