# Windsurf Build Prompt — PRD-53: Preapp Contact Capture + Income Edit & Override

Build from `docs/fullApp-Plan/53-pbv-preapp-contact-capture-and-override_prd_2026-05-19.md`. Read it first.

This fixes a real, user-blocking bug: the phone + invite section on the preapp page is hidden for over-income applicants, so staff literally cannot enter a phone or send an invitation for them. Plus two adjacent needs (edit income, override qualification) and a public-form change (collect phone + email).

---

## Branch and base

- **Build on the PRD-51 branch:** `feat/pbv-preapp-combined-approve-send-51`. This PRD extends PRD-51's combined-invite handler. Branch off it as `feat/pbv-preapp-contact-and-override-53`, OR if PRD-51 has been merged to `main`, branch off `main`.
- **Before anything: fix `.git/config`.** The repo has a corrupted git config (`fatal: bad config line 23 in file .git/config`). Inspect line 23, fix or remove the bad entry, confirm `git status` and `git log` run clean. Merges and pushes may have been silently failing because of this — that's likely why the PRD-51 phone migration didn't land on `main`.
- **Verify the PRD-51 phone migration is present** on whatever base you branch from. If `supabase/migrations/20260519000000_pbv_preapp_phone.sql` is missing, the PRD-51 work didn't fully land — flag it before proceeding.

---

## Shell protocol

See `docs/SHELL-PROTOCOL.md`. Key points:
- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, NOT `npx tsc` (npx hangs on Windows).
- Two migrations in this PRD (email column + override columns) — create the `.sql` files, do NOT execute them.

---

## Files to modify

| File | Change |
|---|---|
| `supabase/migrations/<ts>_pbv_preapp_email.sql` | F1 — `email TEXT` column on `pbv_preapplications`. |
| `supabase/migrations/<ts>_pbv_preapp_override.sql` | F5 — `qualification_override_reason TEXT`, `qualification_override_at TIMESTAMPTZ`, `qualification_override_by TEXT`. (Can combine with the email migration if you prefer one file.) |
| `types/compliance.ts` | Add `email`, override fields to `PbvPreapplication`. |
| `components/portal/PbvPreappForm.tsx` | F1 — phone (required) + email (optional) inputs in HOH section. |
| preapp submit API (find it: `app/api/forms/pbv-preapp/route.ts` or similar) | F1 — store phone + email. |
| preapp translations file (find it: `lib/pbvPreappTranslations.ts` / `lib/pbvFormTranslations.ts`) | F1 — `hoh_phone_label`, `hoh_email_label`, validation msgs, en/es/pt. |
| `app/admin/pbv/preapps/page.tsx` | F2 ungate invite section; F3 qualification-aware button + override panel; F4 inline income edit; F6 surface email. |
| `app/api/admin/pbv/preapps/[id]/route.ts` | F5 — PATCH accepts income, email, phone, override `{reason}`; audit-logs each. |
| `app/api/admin/pbv/full-applications/route.ts` | F6 — accept + store `email` on create (phone already added in PRD-51). |

---

## Files NOT to touch

- `qualification_result` computation logic (wherever it's derived at submission).
- `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts`, `lib/notifications/**`.
- The income-limit threshold editor component (this PRD edits the applicant's income, not the limits table).
- Tenant full-app flow, HACH surfaces.

---

## Step-by-step

### Step 0 — Fix git config, verify base

1. Fix `.git/config` line 23. Confirm clean `git status`.
2. Confirm `supabase/migrations/20260519000000_pbv_preapp_phone.sql` exists on your base branch. If not, stop and report — PRD-51 didn't land.
3. Branch `feat/pbv-preapp-contact-and-override-53`.

### Step 1 — Migrations (F1, F5)

Create the email + override columns. Nullable, `IF NOT EXISTS`. Don't execute — Supabase applies on deploy. Note in the build report: **both the PRD-51 phone migration AND these must be applied to prod Supabase (`lieeeqqvshobnqofcdac`) for the feature to work in production.**

### Step 2 — Types

Add `email: string | null` and the three override fields to `PbvPreapplication`.

### Step 3 — Ungate the invite section (F2)

`app/admin/pbv/preapps/page.tsx:1071` — replace `{qualified && (<section>...</section>)}` with always-render. This is the core bug fix. The phone field, email field, and invite button now show for every preapp.

Type-check after this — it's the highest-value single change; confirm it compiles before building the rest.

### Step 4 — Qualification-aware button + override (F3)

- Qualified: PRD-51 labels unchanged.
- Not qualified: "Override & Send Invitation" → inline panel with a **required** reason input → on confirm, chain runs with the override flag, reason persisted + audited.
- Confirm panel shows an over-income banner + reason when overriding.

### Step 5 — Inline income edit (F4)

Edit affordance on `total_household_income` (~line 942). Save → PATCH → recompute `incomeOk` + badge locally → audit-log old→new. If corrected income is under limit, button reverts to "Approve & Send."

### Step 6 — Public form phone + email (F1)

Add the inputs to `PbvPreappForm.tsx`, wire validation (phone required + parseable via `lib/phoneParser.ts`; email optional + valid if present), store on submit. Translations en/es/pt.

### Step 7 — Email propagation (F6)

Surface email in admin detail; pass it to `pbv_full_applications` on create.

### Step 8 — Type-check + build

`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`. Both clean.

### Step 9 — Verification gates 1-7 + build report

Per PRD-53. Build report at `docs/build-reports/53-pbv-preapp-contact-capture-and-override_build-report_2026-05-19.md`. Must explicitly state: git config fixed, PRD-51 phone migration confirmed present, and the list of migrations that must be applied to prod before this works live.

---

## What "done" looks like

1. Branch pushed, PR opened against `main` (Ready for Review).
2. `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean.
3. Over-income preapp shows phone + invite controls (the bug fix).
4. Income editable; override works with required reason + audit.
5. Public form collects phone (required) + email (optional), trilingual.
6. Build report documents the migration-apply requirement for prod.

---

## What NOT to do

- Do not leave the `qualified &&` gate in place — that's the bug.
- Do not skip the git config fix — merges may keep silently failing otherwise.
- Do not execute migrations — create the files only.
- Do not use `npx tsc`.
- Do not change qualification computation, send-sms, or notification templates.
- Do not make the override reason optional (PRD decision — typed reason required for the HACH audit trail).
- Do not silently expand scope. If something outside the listed files needs changing, stop and ask.

---

## Reporting back

- Branch + SHA, PR URL, build report URL.
- Confirmation: git config fixed; PRD-51 phone migration present on base.
- Per-gate pass/fail.
- The explicit list of migrations that must be applied to prod Supabase before this is live.
- Answers to PRD-53 open questions O1-O3 if they came up.
