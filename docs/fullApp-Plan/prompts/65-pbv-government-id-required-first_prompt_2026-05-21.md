# Windsurf Build Prompt — PRD-65: Required Government Photo ID as the First Scanned Document

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs branch, decision-handling (default-and-log, never stop to ask), prod-migration safety, and static-vs-deferred gates for this whole batch.

Build from `docs/fullApp-Plan/65-pbv-government-id-required-first_prd_2026-05-21.md`. Read it next.

The PBV document flow **never collects a government-issued photo ID** — the seeded required set (`form_document_templates`, `form_id='pbv-full-application'`) starts at `paystubs` (`display_order=10`) and has no identity doc, so a packet can finalize with no proof of identity. This PRD adds a **universal, always-required** "Government-Issued Photo ID" (`doc_type='government_id'`) that sorts **first**, is captured with the existing multi-page scanner (front + back, 2 pages), and blocks upload-complete until scanned. Small and additive — do **not** touch signing, intake, or generation.

---

## Branch / commit (per batch protocol)

- Work on `feat/pbv-launch-hardening` (created earlier in this batch off `feat/pbv-full-finalization` or `main`). Do **not** create a per-PRD branch.
- One commit when done: `PRD-65: required government photo ID as first scanned document`. **Push after commit.**

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD writes a DB change (a new `form_document_templates` row + a backfill of `application_documents`). **Write + commit the migration; do NOT apply it to prod.** Add it to the "Prod migrations to apply" section of `docs/fullApp-Plan/OPEN-DECISIONS.md`.
- If you need to confirm the current lowest `display_order` or category enum, query `form_document_templates` **read-only**. Never write/migrate against prod.

---

## The contract (see PRD for full detail)

A document is required, first, universal, scannable, and gating only if its `doc_type` agrees across:
1. `form_document_templates` (seed) — the row: `required=TRUE`, lowest `display_order`, `category='identity'`, `conditional_on=NULL`.
2. `lib/pbv/documentTriggers.ts` — `isTriggered: () => true` (so `filterByTriggers` never drops it).
3. `lib/pbv/cards/docContent.ts` + `lib/pbv/docTypeHelp.ts` — EN/ES/PT title/description/help; `multiFile:true`, `maxFiles:2`.
4. UI: `DocumentCard.tsx` scanner (`multiPage`/`maxPages`) + `AlmostDoneReview.tsx` `identity` category.

Ordering (`documents/route.ts:99-103` orders by `display_order ASC`), the dashboard count (`upload-summary/route.ts:57-59`, `required===true` after `filterByTriggers`), and finalize gating (`finalizeValidation.ts:114-129`, all `required` docs must be complete) are **already correct** once the row above is well-formed — no changes to those three files.

---

## Step-by-step

### Step 0 — Read the DB truth (read-only)
Confirm the lowest current `display_order` in `form_document_templates WHERE form_id='pbv-full-application'` (expected `10` = `paystubs`) and that the `category` column has no `identity` value yet. This sets your new row's `display_order` (use `5`) and confirms `identity` is a new category.

### Step 1 — Add the `government_id` template row (Phase 1)
New migration `supabase/migrations/20260521010000_prd65_government_id_required.sql`. `INSERT … ON CONFLICT (form_id, doc_type) DO UPDATE SET …` (mirror the upsert columns in `20260423220000_pbv_full_app_document_templates.sql:359-369`) one row: `form_id='pbv-full-application'`, `doc_type='government_id'`, EN/ES/PT labels, `required=TRUE`, `conditional_on=NULL`, `display_order=5`, `per_person=FALSE`, `applies_to='submission'`, `member_filter=NULL`, `category='identity'`. Add a rollback comment. **Commit only — do not apply.**

### Step 2 — Always-required trigger (Phase 2)
In `lib/pbv/documentTriggers.ts`, add `{ doc_type:'government_id', isTriggered:()=>true }` in the always-required block. Remove `government_id` from the legacy/ungated comment (`:195`) — it is first-class now.

### Step 3 — Plain-language content EN/ES/PT (Phase 3)
- `lib/pbv/cards/docContent.ts`: add a `government_id` `DOC_CONTENT` entry — `title` (e.g. "Government photo ID"), `description` ("Driver's license, state ID, or passport for the head of household. Scan the front and back."), `fallback`, `multiFile:true`, `maxFiles:2`, all three languages. Add a leading `IDENTITY` section comment so the file stays organized.
- `lib/pbv/docTypeHelp.ts`: add a `government_id` `DOC_TYPE_HELP` entry (EN/ES/PT) in the existing tone.

### Step 4 — Wire `maxPages` + `identity` category (Phase 4)
- `components/pbv/cards/DocumentCard.tsx`: import `getMaxFiles` from `docContent.ts` and pass `maxPages={getMaxFiles(document.doc_type)}` to the `DocumentScanner` element (`:309`). (`multiPage` is already wired at `:311`.)
- `components/pbv/cards/AlmostDoneReview.tsx`: add `'identity'` to the `DocCategory` union (`:18-24`); add a `categories[]` entry keyed `identity` with EN/ES/PT label, placed **first** (`:53`); initialize an `identity: []` bucket in the grouping map (`:270-271`). A doc whose DB `category` is `identity` must render in this section, not `custom`.

### Step 5 — Backfill existing in-progress applications (Phase 5)
In the same migration file (clearly separated block), backfill: insert a `government_id` `application_documents` row for every `pbv_full_applications` that has already-seeded docs and **no** existing `government_id` slot — `status='missing'`, `required=TRUE`, `display_order=5`, `person_slot=0`, `revision=0`, `category='identity'`, `created_by='system'`. Use `WHERE NOT EXISTS (…)` for idempotency. **Default-and-log:** scope to `submitted_at IS NULL` so finalized packets are untouched. **Commit only — do not apply.** List under "Prod migrations to apply" with the caveat that backfilled in-flight tenants get a new required doc.

### Step 6 — Static gate test (Phase 6)
Add/extend a unit test (in `lib/pbv/__tests__/` or `lib/documents/__tests__/`, reuse existing fixtures) asserting: `government_id` present + `required` + `category='identity'` + lowest `display_order`; `isTriggered` is `true` for any/empty intake; `filterByTriggers` keeps it for a minimal intake; EN/ES/PT title + help non-empty; required-doc completeness is `false` when `government_id` is `missing` and `true` when `submitted`.

### Step 7 — Static gates + build report + commit + push + close the batch
`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean; new test green. Build report at `docs/build-reports/65-pbv-government-id-required-first_build-report_2026-05-21.md`. Commit `PRD-65: required government photo ID as first scanned document`, then **push**.

**This is the LAST PRD in the batch.** After pushing: confirm the branch `feat/pbv-launch-hardening` is pushed, `docs/fullApp-Plan/OPEN-DECISIONS.md` is complete (PRD-65 migration + backfill listed, the three O1–O3 defaults logged), and **one** PR is open (`feat/pbv-launch-hardening` → its base, Ready for Review). **Do not merge** — Alex reviews.

---

## Files to modify

| File | Change |
|---|---|
| `supabase/migrations/20260521010000_prd65_government_id_required.sql` (new) | insert `government_id` template row (`display_order=5`, `category='identity'`, `required=TRUE`); backfill `application_documents` — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/pbv/documentTriggers.ts` | add `{ doc_type:'government_id', isTriggered:()=>true }`; drop from legacy/ungated comment |
| `lib/pbv/cards/docContent.ts` | add `government_id` entry (EN/ES/PT, `multiFile:true`, `maxFiles:2`) |
| `lib/pbv/docTypeHelp.ts` | add `government_id` help (EN/ES/PT) |
| `components/pbv/cards/DocumentCard.tsx` | pass `maxPages={getMaxFiles(document.doc_type)}` to `DocumentScanner` |
| `components/pbv/cards/AlmostDoneReview.tsx` | add `'identity'` to `DocCategory`; leading `categories[]` label (EN/ES/PT); `identity` bucket |
| new/extended unit test | present / required / first / universal / content / gating |

## Files NOT to touch

- `lib/pbv/finalizeValidation.ts` — Check 4 already gates on `required` docs; do not edit it.
- `app/api/t/[token]/pbv-full-app/documents/route.ts`, `upload-summary/route.ts` — ordering + counting are already correct; do not edit.
- `components/DocumentScanner/*` capture internals (PRD-45/52) — only consume `multiPage`/`maxPages`, do not modify the scanner.
- Signing flow, summary doc, intake, form generation (`generate-forms`, `conditional-rules.ts`, `field-mapping.ts`).
- `.git/config` — it is fine, don't touch it.

---

## Verification gates (per PRD-65)

**Static (must pass in-session before commit):**
- **Gate 1:** template set has `government_id`, `required=true`, `category='identity'`, lowest `display_order`; test asserts it sorts first.
- **Gate 2:** `isTriggered('government_id')` is `() => true`; `filterByTriggers` keeps it for a minimal/empty intake.
- **Gate 3:** EN/ES/PT title + description + help all non-empty for `government_id`.
- **Gate 4:** required-doc completeness is `false` when `government_id` is `missing`, `true` when `submitted`.
- **Gate 5:** `isMultiFileDoc('government_id')===true`, `getMaxFiles('government_id')===2`; `DocumentCard` passes `maxPages`.
- **Gate 6:** `tsc --noEmit` + `npm run build` clean; new test green.

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- Scan a real ID front+back on a phone → one 2-page PDF; shows first in the card stack and under "Photo ID" on review; dashboard required-count includes it; app cannot finalize without it. Migration + backfill applied deliberately by Alex post-review.

---

## What "done" looks like

1. `PRD-65: required government photo ID as first scanned document` committed on `feat/pbv-launch-hardening` and **pushed**.
2. `government_id` is required, universal (`()=>true`), first (`display_order=5`), scannable front+back (2 pages), under a new `identity` category, and blocks upload-complete.
3. Migration + backfill written + committed + listed in OPEN-DECISIONS (not applied).
4. Static gates green; build report written with deferred device gates listed.
5. **Batch closeout:** branch pushed, OPEN-DECISIONS complete, one PR open (not merged).

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (O1 submission-level ID, O2 one multi-page doc, O3 backfill un-submitted only).
- Do not edit finalize/ordering/count logic — they already work; only add the required row + content + category.
- Do not add OCR, ID parsing, or identity-matching — it's a scanned upload.
- Do not write or apply the migration to prod. Read-only on `form_document_templates` if you need the current `display_order`/category set.
- Do not use `npx tsc`. Do not "fix" `.git/config`. Do not touch the scanner internals, signing, intake, or generation.
- Do not merge the PR.

## Reporting back (in the build report)

- Commit SHA + push confirmation.
- The migration file path (listed in OPEN-DECISIONS) + backfill scope + the O1–O3 defaults logged.
- The `government_id` row shape (display_order, category, required, applies_to) and confirmation it sorts first.
- The `maxPages` wiring + the new `identity` category placement.
- Static gates pass/fail; deferred device gates for the post-run pass.
- **Batch closeout note:** branch pushed, OPEN-DECISIONS complete, one PR open (not merged).
