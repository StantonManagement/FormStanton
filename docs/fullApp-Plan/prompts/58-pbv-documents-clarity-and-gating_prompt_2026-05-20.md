# Windsurf Build Prompt — PRD-58: Documents Step Clarity, Intake-Gating & Banner Fix

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/58-pbv-documents-clarity-and-gating_prd_2026-05-20.md`. Read it next.

Three tenant-facing defects on the documents step + its dashboard. Observed live 2026-05-20 + the 05-17 journey (`tasks/TENANT_JOURNEY_2026-05-17.md`):
1. The dashboard says **"Application Submitted"** the moment intake completes — while the summary is unsigned and Submit is disabled.
2. Document names are **opaque** federal codes; categorization is **wrong** (EIV receipt + No-Child-Support affidavit filed under IDENTITY; a grab-bag OTHER bucket).
3. The doc list **over-asks** (a wage/checking-only applicant was required to provide SSI/TANF/Immigration docs) and the **counts disagree** (dashboard 22 vs documents page 31).

This PRD makes the documents step clear, asks only what's declared, and makes the dashboard tell the truth — **without** touching intake fields (PRD-57), signing (PRD-56), or form-generation internals (PRD-55).

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-full-finalization` (created off `main` at the start of the batch). Do **not** create a per-PRD branch.
- This depends on **PRD-57** (intake answers drive gating) — build on the accumulated work in this session.
- One commit when done: `PRD-58: documents clarity, intake-gating & banner fix`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD is mostly UI/logic. If you write any DB data/migration change (e.g. correcting a `category` value), **write + commit the migration file; do NOT apply it to prod (`lieeeqqvshobnqofcdac`)** — list it under "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`.
- `.git/config` is **NOT** broken — don't "fix" line 23. If git genuinely errors, log a BLOCKER.

---

## The four defects (see PRD for full detail + line refs)

1. **Banner:** `TenantDashboard.tsx:194-208` renders whenever `intake_status==='complete'` and defaults `status` to `'submitted'`. The truthful signal — `submitted_at`, `signatures_complete`, `next_step`, `can_submit` — already exists (bootstrap `route.ts:159-167,269,273`; hook computes `can_submit`), but the banner ignores it. `submitted_at` is not yet on `DashboardData`.
2. **Names:** card view uses plain `getDocContent` titles (`DocumentCard.tsx:148`), but the review screen falls back to raw `doc.label` (`AlmostDoneReview.tsx:182-190`).
3. **Categories:** `AlmostDoneReview.tsx:116-176 categorizeDoc()` uses `doc_type` substring matching (`eiv_guide_receipt` → "gu**id**e" → IDENTITY) with its own enum diverging from the DB `category` column.
4. **Gating + counts:** triggers in `documentTriggers.ts`/`applyDocumentTriggers.ts` work partly; dashboard counts required-only (`upload-summary/route.ts:44-52`) while the documents page counts all triggered docs live via `filterByTriggers` (`documents/route.ts:165`).

---

## Step-by-step

### Step 0 — Read the truth
Read the bootstrap response shape (`app/api/t/[token]/pbv-full-app/route.ts`) for `submitted_at` / `signatures_complete` / `next_step`, the trigger config (`lib/pbv/documentTriggers.ts`), and the **current `intake_snapshot` shape produced by PRD-57** (check its build report `docs/build-reports/57-*` if present). Confirm the trigger predicate field names still match the snapshot.

### Step 1 — Re-key the dashboard banner to true submission state
In `TenantDashboard.tsx`, stop defaulting to `'submitted'`:
- **Submitted / office-acted:** show the existing review-status banner, keyed on a true submission signal — **`submitted_at`** is canonical (also honor `application_review_status` when set).
- **Not submitted, intake complete:** show an honest in-progress acknowledgment ("We've got your answers. Next: <next step>") using `data.next_step` / `summary_signed` / `forms_signed` / `upload_complete` / `can_submit` — never "Application Submitted."
Add `submitted_at` to `useDashboardState.ts` `DashboardData` + mapping (`d.submitted_at`).
**If a new banner variant is cleaner than inline copy**, add an `in_progress` `ApplicationReviewStatus` to `ApplicationStatusBanner.tsx` with EN/ES/PT copy mirroring existing entries. **Pick the smaller diff and log the choice** in OPEN-DECISIONS. Do not stop to ask.

### Step 2 — Plain names + one-line "what this is" (both views)
- In `docContent.ts`, make each tenant-visible `doc_type` title plain-language (no bare federal code as the title — code may sit parenthetically in the description) with a one-sentence "what it is / why needed." Fill missing **EN**; leave ES/PT TODO-fallback (PRD-59 owns translation) but **flag** any doc_type missing EN.
- In `AlmostDoneReview.tsx`, change `getDocDisplayTitle` to use `getDocTitle(doc.doc_type, language)` (plain) instead of raw `doc.label`; show the description as supporting text where space allows.

### Step 3 — One correct categorization
- Replace `AlmostDoneReview.tsx categorizeDoc()` substring logic with the DB `category` already on each doc (returned by `GET /documents`, `documents/route.ts:204`). Use one vocabulary aligned to the DB enum (`income`, `assets`, `medical_childcare`, `immigration`, `signed_forms`) + a clearly-labeled fallback only for `custom`/legacy docs — **no generic "OTHER" grab-bag**.
- Map the DB enum to friendly EN/ES/PT section labels (e.g. `signed_forms` → "Forms we'll prepare for you to sign"). Verify the 05-17 mis-files (EIV receipt, No-Child-Support affidavit — both DB `category='signed_forms'`) render under signed-forms, not Identity.
- If a tenant-visible `doc_type` has a null/`custom` DB category, **log it** and assign a sensible display default; don't drop it.

### Step 4 — Verify + tighten intake gating
- Confirm each `documentTriggers.ts` predicate reads the **current** `intake_snapshot` shape. Statically assert canonical profiles:
  - **Wage-only + checking-only, citizen, no kids:** paystubs + checking statement + always-required signed forms only. **No** SSI/SS/TANF/Unemployment/Pension/Self-Employment/Savings/Immigration/Child-Support docs.
  - **SSI + savings, non-citizen:** SSI letter + savings statement + immigration docs + signed forms.
- If a predicate keys off a field no longer in the snapshot, fix the predicate (don't rewrite the trigger framework) and **flag the field name as a cross-PRD note for PRD-57**.
- Add a unit test asserting the canonical profiles produce the expected required `doc_type` sets (pure `filterByTriggers` over a representative seeded doc list + a fixture `intake_snapshot`).

### Step 5 — Doc-count coherence
- Make the dashboard count and the documents-page count describe the **same population** (required, after trigger filtering), with optional counted/labeled separately. Either have `upload-summary/route.ts` apply `filterByTriggers` against `intake_snapshot` (matching `GET /documents`), or route both through one shared `{required_total, required_complete, optional_total, optional_complete}` helper.
- Add a check (test or build-report computation) that for a seeded profile the two required-totals match.
- **Cross-PRD with PRD-55:** upload-only forms appear as uploads here; any form PRD-55 marks generated-and-signed is **not** also counted as an upload. If PRD-55's classification is still pending, keep current behavior and **log it**.

### Step 6 — Static gates + build report + commit
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new tests green. Build report at `docs/build-reports/58-pbv-documents-clarity-and-gating_build-report_2026-05-20.md`. Commit `PRD-58: …`. Then **proceed to the PRD-59 prompt.**

---

## Files to modify

| File | Change |
|---|---|
| `components/pbv/sign/TenantDashboard.tsx` | re-key banner to `submitted_at` / true state; honest pre-submit acknowledgment |
| `lib/pbv/hooks/useDashboardState.ts` | add `submitted_at` to `DashboardData` + mapping |
| `components/pbv/sign/ApplicationStatusBanner.tsx` | (if chosen) `in_progress` variant + EN/ES/PT copy |
| `lib/pbv/cards/docContent.ts` | plain titles + one-line "what this is" (EN; flag ES/PT gaps) |
| `components/pbv/cards/AlmostDoneReview.tsx` | plain title not raw `doc.label`; DB-`category`-driven grouping (drop substring matcher) |
| `lib/pbv/documentTriggers.ts` | align predicate keys to current `intake_snapshot` shape (no framework rewrite) |
| `app/api/t/[token]/pbv-full-app/upload-summary/route.ts` | apply `filterByTriggers` / shared count helper so counts reconcile |
| new unit test(s) | canonical-profile gating + count coherence + category mapping |
| migration (only if a DB `category` value is genuinely wrong) | commit only, list in OPEN-DECISIONS, do not apply |

## Files NOT to touch

- Intake fields/defaults/validation/review-page enums (PRD-57) — only *consume* `intake_snapshot`.
- Signing capture, signed-PDF storage, finalize/submission-lock (PRD-56).
- Form-generation internals, source-PDF/field-map registries (PRD-55) — only *coordinate* upload-only vs generated classification.
- The trigger framework in `applyDocumentTriggers.ts` (confirm it runs; don't rewrite).

---

## Verification gates (per PRD-58)

**Static (must pass in-session before commit):**
- **Gate 1:** dashboard does NOT show "Application Submitted" when `submitted_at=null` + `can_submit=false`; shows the submitted/review banner only when `submitted_at` (or review status) is set.
- **Gate 2:** every tenant-visible doc_type resolves a plain title + one-line description; `AlmostDoneReview` uses the plain title.
- **Gate 3:** categorization is DB-`category`-driven; 05-17 mis-files render under signed-forms; no "OTHER" grab-bag.
- **Gate 4:** canonical-profile gating test green (wage/checking yields only matching docs).
- **Gate 5:** dashboard required-total == documents-page required-total for a seeded profile; optional separate.
- **Gate 6:** `tsc --noEmit` + `npm run build` clean.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- Live walk on a deployed preview with a wage/checking test token: honest in-progress banner pre-submit, "Application Submitted" only after finalize, only-matching docs requested, counts reconcile end-to-end, EN/ES/PT label parity.

---

## What "done" looks like

1. `PRD-58: …` commit on `feat/pbv-full-finalization`; any migration committed + listed in OPEN-DECISIONS (not applied).
2. Static gates green.
3. Banner tells the truth pre- and post-submit; doc names are plain; categories are correct + single-system; gating matches declared answers; counts reconcile.
4. Cross-PRD flags (PRD-57 snapshot field names; PRD-55 upload-only classification) logged in the build report + OPEN-DECISIONS.
5. Build report written, deferred runtime gates listed. **Proceed to the PRD-59 prompt.**

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol.
- Do not tell an un-submitted tenant she's submitted under any state.
- Do not introduce a second categorization system; converge on the DB `category`.
- Do not rewrite intake, signing, the trigger framework, or form generation.
- Do not apply any DB migration to prod. Do not run destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config` line 23.
- Do not block on deploy-only gates — defer them to the build report.

## Reporting back (in the build report)

- Commit SHA; any migration file path (listed in OPEN-DECISIONS).
- Banner re-key approach (inline vs `in_progress` variant) + why.
- Plain-title coverage + any doc_type missing EN; ES/PT gaps flagged for PRD-59.
- Category mapping table (DB category → section label) + confirmation no doc is mis-filed.
- Canonical-profile gating results + any `intake_snapshot` field-name flags for PRD-57.
- Count-coherence result (dashboard vs documents page).
- PRD-55 upload-only coordination outcome.
- Decisions logged to OPEN-DECISIONS; deferred runtime gates for the post-run pass.
