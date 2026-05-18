# PRD-32 — PBV Tenant Link: Ship-Blocking Defects (Audit Round 2)

**Date:** 2026-05-15
**Author:** Claude (repo scan) + Cascade (tenant-link audit)
**Branch:** `feature/pbv-form-execution`
**Status:** Shipped 2026-05-15 — F2 implemented as effectively one-shot (idempotent guard at `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:36-44` plus `intake_data` cleared on first complete). Re-sync code is unreachable on resubmit. Edit-and-resubmit deferred as known limitation per PRD-34.

---

## Problem Statement

After PRD-31 closed 14 of 17 PRDs-22–30 audit findings, two follow-on reviews surfaced six **additional defects** that block a real tenant from completing the EN full-app flow when given an `/pbv-full-app/[token]` link:

1. **Cascade's tenant-link audit** (`docs/audit/tenant-link-form-fill-audit_2026-05-15.md`) caught D1–D4 — post-intake routing dead-end, multi-signer stamping, generate-forms upsert collapse, missing resume pointer.
2. **Claude's repo scan** (2026-05-15 conversation) caught two structural defects Cascade's audit missed because both are masked by `tests/e2e/helpers/createMariaApplication.ts`:
   - **F1**: `'review'` is in `ALWAYS_SECTIONS` but `SectionReview` never writes `intake_data.review` — every call to `/intake/complete` returns 422 with `missing_sections: ['review']`.
   - **F2**: The SPA intake flow has **no code path that inserts into `pbv_household_members`**. The only `.insert` on that table is the legacy POST at `app/api/t/[token]/pbv-full-app/route.ts:441`. Every downstream stage (`generate-forms`, `sign-form`, `sign-summary`, `additional-signers`, `finalize`, bootstrap's `hoh_member_id` derivation) reads from that table. For a real tenant the table is empty after intake → cascade failure.

These six defects must ship together for an English solo-HOH tenant to complete the flow end-to-end via the link alone.

D5 (SMS sending), D6 (stale conditional data), D7 (deep-link section gating), D8 (summary audit row), and D9 (PT translations) are deferred. They do not block a solo HOH and add scope.

---

## Users & Roles

- **Solo HOH tenant (EN)** — primary user this PRD must unblock. Receives one link, completes everything via mobile or desktop, no staff handoff.
- **Multi-adult household tenant** — F4 + F5 unlock correct behavior; without them, additional adults are never prompted and signed PDFs contain only one signature.
- **HACH reviewer** — receives federally valid signed packets after submission; F5 is required for legal validity on `each_adult` forms.
- **Cascade / Windsurf** — implementer. Atomic commits per defect, regression tests, build report.

---

## Core Features

### F1 — Drop `'review'` from `ALWAYS_SECTIONS` *(Critical — Claude scan)*

**Defect:** `lib/pbv/intake-schema.ts:31-40` lists `'review'` as required. `intake/complete/route.ts:46` checks `!intakeData[s]`. `SectionReview.tsx` has no `onChange` prop and never autosaves. `intake_data.review` is therefore never populated → `/intake/complete` returns 422 every time.

**Fix:**
- Remove `'review'` from `ALWAYS_SECTIONS`.
- `isSectionComplete('review', ...)` returning `false` is correct and stays.
- Add regression test: `intake/complete` succeeds when all real sections are populated and `intake_data.review` is absent.

**Acceptance:** Posting to `/api/t/[token]/pbv-full-app/intake/complete` with `intake_data` containing every section except `review` returns 200 and sets `intake_status='complete'`.

### F2 — Bridge `intake_data` → `pbv_household_members` + seed `application_documents` *(Critical — Claude scan)*

**Defect:** The SPA intake stores everything in `intake_data` JSONB. Members never land in the `pbv_household_members` table. Every downstream consumer reads from that table. Real tenants finish intake and the system can't generate forms, identify the HOH for signing, gate `signatures_complete`, validate finalize readiness, or send magic links.

**Fix:** Make `/api/t/[token]/pbv-full-app/intake/complete` the commit point. After validation succeeds and before stamping `intake_status='complete'`:

1. Read `intake_data.household.members`, `intake_data.income.by_member`, `intake_data.criminal_history.by_member`, `intake_data.contact`, `intake_data.dv_homeless_ra`, `intake_data.childcare_disability` from the row.
2. Build `memberRows` joining demographic, income, and criminal-history data by slot. Encrypt `ssn` if present (use existing `lib/ssnEncryption.ts`).
3. `DELETE` any existing `pbv_household_members` rows for this app (re-sync semantics — supports edit-then-resubmit), then `INSERT` the new rows.
4. Update `pbv_full_applications` with derived fields: `head_of_household_name`, `household_size`, `total_annual_income`, `dv_status`, `homeless_at_admission`, `claiming_medical_deduction`, `has_childcare_expense`, `reasonable_accommodation_requested`, `phone`, `preferred_language`. Mirror the field set on `route.ts:455-475`.
5. Seed `application_documents` per `form_document_templates` filtered by intake flags (port logic from `route.ts:482-559`).
6. Compensating rollback: if any step fails, delete the inserted members and return 500 so the tenant can retry. Do **not** stamp `intake_status='complete'` on failure.
7. Only on success: update `intake_status='complete'`, `intake_completed_at`.

**Idempotency:** Already-complete intake returns 200 with existing timestamp (current behavior preserved).

**Acceptance:**
- After `/intake/complete` succeeds for a fresh tenant, `pbv_household_members` contains one row per `intake_data.household.members[]` entry with correct slot, demographics, income flags, and `signature_required` (age ≥ 18).
- `application_documents` is seeded with the expected per-tenant rows (matches legacy POST behavior for the same input).
- Bootstrap GET returns a non-null `hoh_member_id`.
- `generate-forms` produces the expected form set.

**Open decision for Dan:** Re-sync on every `/intake/complete` call (delete + re-insert members) **vs** one-shot insert and disallow further edits after complete. Default chosen here: re-sync on every call, but flag this in the build report so Dan can ratify. Re-sync supports edit-and-resubmit; one-shot is simpler but harder to recover from a misclick.

### F3 — Submit-review routes to dashboard, not stub *(Critical — Cascade D1)*

**Defect:** `SectionReview.tsx:212` pushes to `/pbv-full-app/[token]/review`. That page (`app/pbv-full-app/[token]/review/page.tsx`) is a "coming soon" stub. The dispatcher that would send the user to `/dashboard` only fires on the root path. Tenant is stranded after finishing intake.

**Fix:**
- Replace `router.push(\`…/review\`)` with `router.push(\`…/dashboard\`)` in `SectionReview.tsx`.
- Delete `app/pbv-full-app/[token]/review/page.tsx` and the route stub.
- Add regression: snapshot or string-grep test that `SectionReview` does not reference `/review`.

**Acceptance:** Tenant who completes intake lands directly on the dashboard; no extra clicks, no link re-paste.

### F4 — `generate-forms` emits one row per (form_id, language) for each_adult *(Critical — Cascade D3)*

**Defect:** For `each_adult`/`individual` templates, the route loops `signerSlots` and upserts on `(full_application_id, form_id, language)`. Each iteration overwrites `required_signer_member_ids` with a single-id array. Net result: one row in `pbv_form_documents`, with only the **last** adult listed as required. First adult signs → `allSigned=true` → form marked signed → other adults are never prompted.

**Fix:**
- For `each_adult` and `individual` per-person scopes: build `requiredSignerIds` once as `members.filter(adults).map(m=>m.id)`. Emit a **single** row per `(form_id, language)` with the union list. Remove inner per-slot loop for these scopes.
- Submission-level and head-of-household-only scopes unchanged.
- Field-data resolution stays per-row signer (the field map's `row_pattern` writes per-adult cells; the data dict carries values keyed by slot).
- Regression test: for a 3-adult household, `pbv_form_documents.required_signer_member_ids` for `citizenship_declaration` has length 3.

**Acceptance:** Multi-adult households see all required signers listed; `allSigned` only becomes true after every adult signs.

### F5 — Per-signer signature images in final stamp *(Critical — Cascade D2, supersedes prior H2)*

**Defect:** When `allSigned` becomes true, `sign-form/route.ts:200-249` stamps using `sigImageBytes` — the **currently submitting** signer's bytes. Earlier signers' images stored in `pbv_signature_events.signature_image_path` are never re-fetched. Every row-signature slot in the stamped PDF gets the last signer's image.

**Fix:**
- In the `if (allSigned)` branch, query `pbv_signature_events` for every row with this `form_document_id`.
- For each event, download the signer's `signature_image_path` from `pbv-signatures` bucket. Build a `Map<signer_member_id, Buffer>`.
- Determine row coordinate per signer. Default formula: `row_index = member.slot - 1` (HOH = row 0). Verify against actual field maps for `citizenship_declaration` and `obligations_of_family` during build.
- Emit per-row markers from `buildSignatureFieldData`: instead of a single `__sig__` placeholder, emit `__sig__:${signer_member_id}` keyed by row.
- Pass an `imageResolver` to `stampForm` that maps each marker to the corresponding signer's bytes.
- Regression test: 2-signer form produces a stamped PDF where row 0 and row 1 contain visibly different signature pixel hashes.

**Acceptance:** For a multi-adult form, the stamped PDF contains each adult's actual signature in their assigned row.

### F6 — `intake/[section]` writes `_resume_section` + `_last_saved_at` *(High — Cascade D4)*

**Defect:** Both fields are declared in `intake-schema.ts:202-203` and read in two places (`page.tsx:491`, `intake/page.tsx:89-90`), but no writer exists. Resume always restarts at Section 1.

**Fix:** In `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`, when merging `intake_data`, also set:
- `_resume_section: section`
- `_last_saved_at: new Date().toISOString()`

One additive change inside `mergedIntakeData`. No schema change.

**Acceptance:** Tenant who saves a section, closes the tab, and re-opens the link is routed to the section they were last on.

---

## Data Model

No schema changes. All work is at the route/library layer.

Tables touched:
- `pbv_full_applications` — additional updates in `/intake/complete` (head_of_household_name, household_size, total_annual_income, demographic flags, phone, preferred_language). All columns already exist (per legacy POST).
- `pbv_household_members` — populated by `/intake/complete` (currently only by legacy POST). Re-sync semantics: delete-then-insert per call.
- `application_documents` — seeded by `/intake/complete` (currently only by legacy POST). Re-sync: delete-then-insert.
- `pbv_signature_events` — read by `sign-form` in the `allSigned` branch (F5). No new writes.
- `pbv_form_documents` — one row per (app, form_id, language) under all per-person scopes (F4). Existing unique constraint enforces this; F4 just stops the constraint from causing data loss.

---

## Integration Points

- **Legacy POST `route.ts`** stays untouched. `intake_status = null` apps continue to use it (see CURRENT_STATE.md "Open decisions"). The two flows are mutually exclusive via the dispatcher.
- **`lib/ssnEncryption.ts`** — reused by F2 for SSN handling. Same encrypt path as legacy POST.
- **`lib/memberFilter.ts`** — reused by F2 for `application_documents` seeding (`getApplicableMembers`).
- **`form_document_templates`** — read by F2 for doc seeding. No changes.
- **`tests/e2e/helpers/createMariaApplication.ts`** — currently bypasses both F1 and F2 by inserting members directly. **Add a second helper** `createMariaApplicationViaIntake` (or update the happy-path spec) so the E2E exercises the real intake → members bridge. Without this, the regression is not caught.

---

## Implementation Phases

### Phase 1 — Intake completion bridge (F1 + F2)
- Drop `'review'` from `ALWAYS_SECTIONS`.
- Implement `/intake/complete` member + document seeding with compensating rollback.
- Regression tests: complete with no `review` key; member rows materialize correctly; documents seeded; idempotent replay.
- Manual smoke: walk a fresh EN tenant link through intake; confirm `pbv_household_members` populates.

### Phase 2 — Routing fix (F3)
- Update `SectionReview.tsx` to push `/dashboard`.
- Delete `/review/page.tsx`.
- Regression: grep test or component test.

### Phase 3 — Multi-adult form generation (F4)
- Refactor `generate-forms` loop. One row per (form_id, language) for each_adult/individual; full union of required signer ids.
- Regression: 3-adult household → `required_signer_member_ids.length === 3`.

### Phase 4 — Multi-signer stamping (F5)
- Implement per-signer image resolution in `sign-form` `allSigned` branch.
- Verify row coordinate formula against `citizenship_declaration` field map.
- Regression: 2-signer form produces PDF with distinct signatures per row.

### Phase 5 — Resume pointer (F6)
- Add `_resume_section` + `_last_saved_at` writes in `/intake/[section]`.
- Regression: re-bootstrap after saving section N routes to section N.

### Phase 6 — E2E coverage
- New helper / updated happy-path spec that drives intake via the real API (not direct DB insert) and verifies pbv_household_members materializes.
- Update `KNOWN_PACKAGE_HASH` after green.

### Phase 7 — Build report + CURRENT_STATE
- `docs/build-reports/32-pbv-tenant-link-blockers-build-report_2026-05-15.md`
- Update CURRENT_STATE.md.

---

## Open Decisions

1. **F2 re-sync vs one-shot.** Default chosen: re-sync (delete + insert members on every `/intake/complete` call). Allows edit-and-resubmit. Tradeoff: a misclick of "Submit" by a tenant after staff has manually adjusted a member row would lose that adjustment. **Needs Dan confirmation.** Alternative: one-shot insert, lock intake_data once complete.

2. **F5 row coordinate formula.** Default: `row_index = member.slot - 1`. Must verify against `citizenship_declaration` field map during build (HOH is row 0, spouse is row 1, etc.). If field maps use a different convention, adjust and document.

3. **F4 vs current unique constraint.** The current `(full_application_id, form_id, language)` uniqueness was correct architecture; F4 is the loop fix, not a constraint change. Confirm during build that no other code relies on the multi-row pattern.

4. **D5 SMS deferred.** This PRD does not connect a real SMS provider. Magic-link send remains "store token only". For solo HOH this is irrelevant. For multi-adult households, the existing `MagicLinkSigningFlow` works once the URL is delivered manually. Phase 2 PRD will wire Twilio.

5. **D8 summary audit row** stays deferred (would require schema change — already noted in PRD-31).

---

## What this PRD does NOT do

- SMS provider integration (D5)
- Stale conditional-data cleanup when sections become hidden (D6)
- Deep-link section gating / redirect-to-first-incomplete (D7)
- Summary signature audit row (D8 — schema change required)
- PT translation review (D9)
- New form types or new templates
- Schema changes
- Anything in the legacy `intake_status = null` path

---

## Pointers

- Tenant-link audit: `docs/audit/tenant-link-form-fill-audit_2026-05-15.md`
- Prior audit + hotfix: `docs/audit/pbv-prds-22-30-error-audit_2026-05-15.md`, `docs/build-reports/31-pbv-form-execution-hotfix-build-report_2026-05-15.md`
- Intake schema: `lib/pbv/intake-schema.ts`
- Legacy POST (source for F2 port): `app/api/t/[token]/pbv-full-app/route.ts:294-587`
- Generate-forms: `app/api/t/[token]/pbv-full-app/generate-forms/route.ts`
- Sign-form: `app/api/t/[token]/pbv-full-app/sign-form/route.ts`
- Section review: `components/pbv/intake/SectionReview.tsx`
- E2E helper to update: `tests/e2e/helpers/createMariaApplication.ts` + happy-path spec
