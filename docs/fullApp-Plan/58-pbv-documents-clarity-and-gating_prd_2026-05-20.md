# PRD-58 — Documents Step: Clarity, Intake-Gating & Banner Fix

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-full-finalization`
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane (a tenant told she's "submitted" when she isn't, or asked for docs she doesn't have, calls Stanton or abandons)
**Depends on:** PRD-57 (intake answers drive the gating — `intake_snapshot` is the gating input). Part of the PBV Full-App Finalization lane (`docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`, gaps G2/G3/G4).
**Cross-PRD:** PRD-55 classifies some "forms" as upload-only vs generated — the doc list here must show upload-only items correctly and **not** duplicate generated-and-signed forms as uploads.

---

## Problem Statement

Three tenant-facing defects converge on the documents step + the dashboard that fronts it. Observed live 2026-05-20 and in the 2026-05-17 tenant journey (`tasks/TENANT_JOURNEY_2026-05-17.md`):

1. **The dashboard lies about submission state.** The status banner says "Application Submitted / Your application has been received / Office reviews typically within 2 weeks" the moment intake is complete — while the summary is still unsigned and the Submit button is disabled. A tenant who has done nothing past intake is told she's done.

2. **Document names are opaque.** Federal form names ("HUD-9886-A Authorization for Release of Information", "Debts Owed to PHAs (HUD-52675)", "HUD-92006 Supplemental Contact Form", "EIV Guide Receipt") appear with no plain-language "what this is."

3. **Categorization is wrong, and over-asking is alarming.** "No Child Support Affidavit" and "EIV Guide Receipt" were filed under **IDENTITY**; there's a grab-bag **OTHER DOCUMENTS** bucket. And the 05-17 walk showed a wage-only / checking-only applicant required to provide SSI, SS, Child Support, TANF, Unemployment, Self-Employment, Pension, Savings, and Immigration docs she never declared — alarming and a likely abandonment trigger. (A later test token showed a tailored count of 11, so gating is **partly** working — this PRD confirms the rules and closes the gaps.)

Plus a **doc-count coherence** defect: 05-17 showed "0 of 22" on the dashboard vs "0 of 31" on the documents page — a 9-doc discrepancy with no explanation.

---

## Root cause / findings (confirmed in code 2026-05-20)

### Banner [confirmed]
`components/pbv/sign/TenantDashboard.tsx:194` renders the banner whenever `data.intake_status === 'complete'` and passes `status={(data.application_review_status ?? 'submitted')}` (`:195`). So before any signing/finalize, `application_review_status` is null → defaults to `'submitted'`, whose copy is "Application Submitted / has been received / 2 weeks" (`ApplicationStatusBanner.tsx:44-49`). The banner ignores the truthful pre-submit state the same component already has: `data.summary_signed`, `data.forms_signed/forms_total`, `data.upload_complete/upload_total`, `data.can_submit`.
- **The truthful signal exists.** `app/api/t/[token]/pbv-full-app/route.ts` returns `submitted_at` (the real finalize timestamp, `:273`), `signatures_complete` (`:269`), and `next_step` ('complete' only when `validateReadyToFinalize` passes, `:159-167`). `submitted_at` is **not** currently surfaced through `DashboardData` in `lib/pbv/hooks/useDashboardState.ts` — it must be added.

### Names + "what this is" [confirmed, partial]
- The card view (`DocumentCard.tsx:148-150`) already prefers plain-language `getDocContent(doc_type)` titles/descriptions from `lib/pbv/cards/docContent.ts` — but the **review screen** (`AlmostDoneReview.tsx:182-190 getDocDisplayTitle`) falls back to raw `doc.label` (the opaque DB/federal name). And `docContent.ts` titles exist but several read like jargon ("Briefing certification", "Income verification receipt") with no one-line "what this is" surfaced consistently.

### Categorization [confirmed]
- `AlmostDoneReview.tsx:116-176 categorizeDoc()` re-derives categories from `doc_type` **substring** matching, independent of the DB `category` column. `eiv_guide_receipt` matches `type.includes('id')` via "gu**id**e" → IDENTITY. Anything unmatched → `'other'` (the grab-bag). Its category enum (`income/banking/medical_childcare/citizenship_immigration/identity/other`) also **diverges** from the DB enum (`income/assets/medical_childcare/immigration/signed_forms`, set in `supabase/migrations/20260514205000_pbv_document_categories.sql:8-14`). Two category systems, neither aligned.

### Intake-gating [partly working]
- Dynamic gating lives in `lib/pbv/documentTriggers.ts` + `lib/pbv/applyDocumentTriggers.ts`. `filterByTriggers` (pure) runs in `GET /documents` (`documents/route.ts:165-167`) and `persistDocumentTriggers` runs at intake/complete to write `no_longer_required`. Income docs key off `intake.income.by_member[].income_sources[].type==X && has_income`; asset docs off `intake.assets.has_checking` etc. **Signed forms are `isTriggered: () => true`** (correct — always required).
- Seed-time gating already excludes `vawa_certification` / `reasonable_accommodation_request` / the `child_support_affidavit` vs `no_child_support_affidavit` pair (`route.ts:516-519`), so the child-support pair is mutually exclusive at seed. The over-asking on 05-17 was the pre-gating state; **must verify the trigger predicate keys match the actual `intake_snapshot` shape** (PRD-57 may have changed field names).

### Doc-count coherence [confirmed root cause]
- Dashboard `upload_total` = **required-only**, from `upload-summary/route.ts` (`required===true`, excludes `no_longer_required`, `:44-47`). The documents page card stack counts **all** triggered docs incl. optional. Different populations → different totals. Worse: `upload-summary` filters only by persisted `no_longer_required` status, while `GET /documents` applies `filterByTriggers` **live** against `intake_snapshot` (`:165`). If `persistDocumentTriggers` didn't run or ran against a stale snapshot, the two surfaces count different sets — the 22-vs-31 divergence.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Banner over-claims "submitted" | `components/pbv/sign/TenantDashboard.tsx:194-208` | gates on `intake_status==='complete'`, defaults status to `'submitted'` |
| Submitted copy | `components/pbv/sign/ApplicationStatusBanner.tsx:44-61` | "Application Submitted / received / 2 weeks" |
| True submission signal (unused by banner) | `app/api/t/[token]/pbv-full-app/route.ts:159-167,269,273` | `submitted_at`, `signatures_complete`, `next_step` |
| Dashboard data shape (missing `submitted_at`) | `lib/pbv/hooks/useDashboardState.ts:25-49,118-144` | add `submitted_at`; `can_submit`/`summary_signed`/counts already present |
| Plain titles (card view) | `lib/pbv/cards/docContent.ts`; `DocumentCard.tsx:148-150` | titles/descriptions present; some still jargon-y |
| Opaque title (review view) | `components/pbv/cards/AlmostDoneReview.tsx:182-190` | falls back to raw `doc.label` |
| Mis-categorization | `components/pbv/cards/AlmostDoneReview.tsx:116-176` | substring matcher; diverges from DB `category` |
| DB category source | `supabase/migrations/20260514205000_pbv_document_categories.sql` | `income/assets/medical_childcare/immigration/signed_forms` |
| Trigger config | `lib/pbv/documentTriggers.ts` | predicate keys must match `intake_snapshot` shape |
| Trigger apply (live + persisted) | `lib/pbv/applyDocumentTriggers.ts` | `filterByTriggers` (GET) vs `persistDocumentTriggers` (intake/complete) |
| Required-only count | `app/api/t/[token]/pbv-full-app/upload-summary/route.ts:44-52` | dashboard total source |
| All-triggered count | `app/api/t/[token]/pbv-full-app/documents/route.ts:165-211` | documents-page source |

---

## Goals

1. The dashboard banner reflects **true submission state**: a tenant who has not finalized is never told "Application Submitted." Pre-submit shows an honest "in progress / here's your next step" acknowledgment; post-submit (real `submitted_at` / review status) shows the submitted/under-review/etc. banner as today.
2. Every document the tenant sees has a **plain-language name + a one-line "what this is,"** consistently on both the card view and the review screen — no raw federal codes as the primary label.
3. **Correct categorization:** documents are grouped by a single category system aligned to the DB `category` column; no item is mis-filed (EIV receipt / No-Child-Support out of IDENTITY); the grab-bag "OTHER DOCUMENTS" bucket is eliminated or replaced with a meaningful group.
4. **Intake-driven gating is correct:** a tenant is asked only for docs her declared income / assets / household / citizenship imply. The trigger predicates are verified against the real `intake_snapshot` shape; the wage-only/checking-only profile sees only matching docs (no SSI/TANF/Immigration/etc.).
5. **Doc-count coherence:** the dashboard count and the documents-page count describe the same population (required, post-trigger), with optional counted separately and labeled, so the two surfaces agree.
6. Upload-only items (per PRD-55 classification) appear in the doc list correctly; generated-and-signed forms are **not** duplicated as uploads.

## Non-goals

- No change to intake fields, defaults, validation, or the review-page enums — that's PRD-57 (only *consume* its `intake_snapshot`).
- No change to signing capture, signed-PDF storage, or finalize/submission-lock logic — that's PRD-56.
- No change to form-generation internals or the source-PDF/field-map registries — that's PRD-55 (only *coordinate* the upload-only vs generated classification it produces).
- No new federal form sourcing (VAWA/RA remain seed-gated/source-pending).

---

## Implementation phases

### Phase 1 — Re-key the dashboard banner to true submission state
- In `TenantDashboard.tsx`, stop defaulting to `'submitted'`. Drive the banner from real state:
  - **Submitted** (or `application_review_status` set): show the existing review-status banner (submitted / under_review / action_required / approved / denied) — keyed on a true submission signal, **`submitted_at` is the canonical one** (add it to `DashboardData` from the bootstrap response, which already returns it).
  - **Not submitted but intake complete:** show an honest in-progress acknowledgment ("We've got your answers. Next: <next step>") instead of "Application Submitted." Reuse `data.next_step` / the card states (`summary_signed`, `forms_signed`, `upload_complete`, `can_submit`) the component already holds. Do not invent a backend field if existing ones suffice.
- Add `submitted_at` to `useDashboardState.ts` `DashboardData` + the mapping (`d.submitted_at`). Keep `can_submit` as-is.
- If the cleanest honest pre-submit copy needs a new `ApplicationReviewStatus` variant (e.g. `in_progress`), add it to `ApplicationStatusBanner.tsx` with EN/ES/PT copy mirroring the existing entries; otherwise render a lightweight inline acknowledgment. Either is acceptable — pick the smaller diff and **log the choice** in OPEN-DECISIONS.

### Phase 2 — Plain-language names + one-line "what this is" (consistent both views)
- Make `docContent.ts` titles plain-language and human (no bare federal codes as the title; the code may appear parenthetically in the description). Confirm each tenant-visible `doc_type` has a title + a one-sentence description that says *what it is and why it's needed*. Fill any missing EN; leave ES/PT as today's TODO-fallback (PRD-59 owns translation completion) — but **flag** any doc_type missing EN.
- Fix `AlmostDoneReview.tsx getDocDisplayTitle` to use `getDocTitle(doc.doc_type, language)` (plain) instead of falling back to raw `doc.label`. Show the one-line description as supporting text where space allows.

### Phase 3 — Single, correct categorization
- Replace `AlmostDoneReview.tsx categorizeDoc()` substring logic with the DB-driven `category` already on each doc (returned by `GET /documents`, `documents/route.ts:204`). Use one category vocabulary aligned to the DB enum (`income`, `assets`, `medical_childcare`, `immigration`, `signed_forms`) plus a clearly-labeled fallback only for `custom`/legacy admin-added docs (not a generic "OTHER").
- Map the DB enum to friendly section labels in EN/ES/PT (e.g. `signed_forms` → "Forms we'll prepare for you to sign", `assets` → "Bank & assets"). Verify no doc lands in a grab-bag: the 05-17 mis-files (EIV receipt, No-Child-Support affidavit) are signed forms (DB `category='signed_forms'`) and must render there, not under Identity.
- If any tenant-visible `doc_type` has a null/`custom` DB category, **log it** and assign a sensible default for display; do not silently drop it.

### Phase 4 — Verify + tighten intake gating
- Confirm each predicate in `documentTriggers.ts` reads the **current** `intake_snapshot` shape (PRD-57 may have renamed fields). For the canonical profiles, statically assert the resulting required set:
  - **Wage-only + checking-only, citizen, no children:** paystubs + checking statement + the always-required signed forms only. **No** SSI/SS/TANF/Unemployment/Pension/Self-Employment/Savings/Immigration/Child-Support docs.
  - **SSI + savings, non-citizen:** SSI letter + savings statement + immigration docs + signed forms.
- Confirm `persistDocumentTriggers` runs at intake/complete so the persisted `no_longer_required` set matches what `filterByTriggers` computes live (so dashboard and documents page agree — see Phase 5). If a predicate keys off a field that no longer exists in `intake_snapshot`, fix the predicate (don't rewrite the trigger framework) and **flag the field name** for PRD-57 cross-check.
- Add a unit test asserting the canonical profiles produce the expected required `doc_type` sets (pure `filterByTriggers` over a representative seeded doc list + a fixture `intake_snapshot`).

### Phase 5 — Doc-count coherence
- Make the dashboard count and the documents-page count describe the **same population**: required docs after trigger filtering, with optional counted/labeled separately. Decide one of:
  - have `upload-summary/route.ts` apply `filterByTriggers` against `intake_snapshot` (matching `GET /documents`), so both surfaces start from the identical filtered set; **or**
  - have both read a single shared helper that returns `{required_total, required_complete, optional_total, optional_complete}`.
- The dashboard `DocumentProgressBar` (`required uploaded / required total` + "+N optional") and the documents-page header must report numbers that reconcile (required totals identical; optional shown but not conflated). Add a check (test or build-report assertion) for a seeded profile that the two totals match.
- Cross-PRD with PRD-55: ensure upload-only forms appear as uploads here, and any form PRD-55 marks generated-and-signed is **not** also seeded/counted as an upload (avoid double-count). If PRD-55's build report flags a doc as upload-only, reflect it; if classification is still pending, **log it** and keep the current behavior.

---

## Verification / test plan

Static gates run in-session; runtime/device gates deferred to the post-run pass (per `BATCH-RUN-PROTOCOL.md`).

- **Gate 1 (banner — static):** unit/render check — given `submitted_at=null` + `intake_status='complete'` + `can_submit=false`, the dashboard does **not** render "Application Submitted"; it renders the in-progress acknowledgment. Given `submitted_at` set (or `application_review_status` present), it renders the submitted/review banner.
- **Gate 2 (names — static):** every tenant-visible `doc_type` resolves a plain-language title (no bare federal code as the title) + a one-line description; `AlmostDoneReview` uses the plain title, not raw `doc.label`. Coverage listed in the build report.
- **Gate 3 (categories — static):** categorization is DB-`category`-driven; the 05-17 mis-files render under signed-forms (not Identity); no generic "OTHER" grab-bag. A test asserts each `doc_type`'s rendered section equals its DB category mapping.
- **Gate 4 (gating — static):** the canonical-profile unit test passes — wage/checking profile yields only matching required docs; no undeclared-income/asset/immigration docs.
- **Gate 5 (count coherence — static):** for a seeded profile, dashboard required-total == documents-page required-total; optional counted separately. Asserted by test or build-report computation.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean.
- **Deferred (runtime):** a live walk on a deployed preview with a wage/checking test token — dashboard shows the honest in-progress banner pre-submit and "Application Submitted" only after finalize; documents page asks only matching docs; counts match end-to-end; EN/ES/PT label parity (PRD-59 owns translation completeness).

---

## Open questions

- **O1:** Pre-submit banner — new `in_progress` `ApplicationReviewStatus` variant (full banner styling) vs a lightweight inline acknowledgment? Default to the smaller diff, log it. (Decision needed: copy tone — celebratory vs. neutral "next step.")
- **O2:** For upload-only forms surfaced by PRD-55 (`criminal_background_release`, `eiv_guide_receipt`, `insurance_settlement`, `cd_trust_bond`): do they appear as **tenant uploads** or **office-provided/signed**? Their `() => true` trigger + `requires_signature` flag in seed determines this. Coordinate with PRD-55's classification; if still pending, keep current behavior and log.
- **O3:** Friendly section label wording for `signed_forms` (e.g. "Forms we'll prepare for you to sign") — confirm with Alex/Dan; ship a sensible default.

## Decisions

- **D1:** The banner keys on a true submission signal (`submitted_at`), not `intake_submitted` / `intake_status==='complete'`. (Resolves G2.)
- **D2:** One categorization system, sourced from the DB `category` column; the substring matcher in `AlmostDoneReview` is removed. (Resolves G3 categorization.)
- **D3:** Plain-language title is the primary label everywhere a tenant sees a doc; the federal code, if shown, is secondary. (Resolves G3 opacity.)
- **D4:** Dashboard and documents-page counts describe the same required-after-trigger population; optional is separate. (Resolves the 22-vs-31 mismatch.)

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `components/pbv/sign/TenantDashboard.tsx` | 1 | re-key banner to `submitted_at` / true state; honest pre-submit acknowledgment |
| `lib/pbv/hooks/useDashboardState.ts` | 1 | add `submitted_at` to `DashboardData` + mapping |
| `components/pbv/sign/ApplicationStatusBanner.tsx` | 1 | (if chosen) add `in_progress` variant + EN/ES/PT copy |
| `lib/pbv/cards/docContent.ts` | 2 | plain titles + one-line "what this is" per tenant-visible doc_type (EN; flag ES/PT gaps) |
| `components/pbv/cards/AlmostDoneReview.tsx` | 2, 3 | use plain title not raw `doc.label`; replace substring `categorizeDoc` with DB `category` |
| `lib/pbv/documentTriggers.ts` | 4 | align predicate keys to current `intake_snapshot` shape (no framework rewrite) |
| `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` | 5 | apply `filterByTriggers` (or shared helper) so counts match documents page |
| new unit test(s) | 4, 5 | canonical-profile gating + count-coherence + category-mapping assertions |

If anything outside this list needs changing, stop and report rather than expanding scope.
