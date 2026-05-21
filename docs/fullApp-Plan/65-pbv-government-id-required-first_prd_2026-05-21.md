# PRD-65 — Required Government Photo ID as the First Scanned Document

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening`
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane (a HACH packet without a government photo ID is incomplete; identity is the foundational verification document and is currently never collected)
**Depends on:** PRD-58 (documents clarity, gating, DB-driven categorization) — this PRD adds one new universal required document into that same seed/trigger/category machinery.
**Cross-PRD:** Reuses the scanner shipped in PRD-45/52 (multi-page capture confirmed). Last PRD in the launch-hardening batch.

---

## Problem Statement

The PBV full-app document flow **never asks the tenant for a government-issued photo ID.** The seeded required-document set (`form_document_templates`, `form_id = 'pbv-full-application'`) starts at `paystubs` (`display_order = 10`) and contains income, asset, medical, immigration, and signed-form docs — but no identity document. A submitted packet can therefore reach `validateReadyToFinalize → ready` with no proof of who the head of household is.

Identity is the document the office expects **first** and treats as foundational. The fix is to add a universal required "Government-issued Photo ID" document that (a) is always required for every application (not conditional on intake answers), (b) sorts **first** in the whole document list, and (c) is captured with the existing multi-page scanner so the tenant can scan front + back.

A legacy `government_id` `doc_type` string is already referenced as an ungated/untracked value in `lib/pbv/documentTriggers.ts:195` ("legacy rows from pre-F4 … leave them ungated"), but there is **no template row, no trigger, no content, and no category** for it — so it is never seeded for a current application. This PRD makes `government_id` a real, first-class, always-required document.

---

## Root cause / findings (confirmed in code 2026-05-21)

The required set is an implicit contract across four places that must agree on `doc_type`:

| Source | Where | Keyed by | Role for this PRD |
|---|---|---|---|
| Template seed | `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql` → `form_document_templates` | `doc_type` + `display_order` + `category` + `required` | the canonical required set — **add a row here** |
| Live seeding | `app/api/t/[token]/pbv-full-app/intake/complete/route.ts` → `seedApplicationDocuments` (`:316-399`) | reads templates `ORDER BY display_order`, inserts `application_documents`, passes `category` straight through | seeds new applications from the template set |
| Trigger config | `lib/pbv/documentTriggers.ts` → `DOCUMENT_TRIGGERS` | `doc_type` + `isTriggered` predicate | always-required docs are `() => true` (e.g. `main_application`) |
| Plain-language content | `lib/pbv/cards/docContent.ts` (`DOC_CONTENT`) + `lib/pbv/docTypeHelp.ts` (`DOC_TYPE_HELP`) | `doc_type` → EN/ES/PT title, description, help | the new doc needs all three languages |

Ordering + gating + counting are downstream of the above and are already correct **if** the new row is well-formed:

- **Ordering:** `GET /documents` orders `application_documents` by `display_order ASC` then `person_slot ASC` (`documents/route.ts:99-103`). A row with `display_order < 10` renders first. `paystubs` is currently lowest at `10`. **[Inference]** `display_order = 5` (or `1`) places `government_id` first.
- **Required-count (dashboard):** `upload-summary/route.ts` counts `required === true` docs after `filterByTriggers` (`:57-59`). An always-required, always-triggered row is counted automatically.
- **Upload-complete / finalize:** `validateReadyToFinalize` Check 4 (`lib/pbv/finalizeValidation.ts:114-129`) marks the app not-ready if any `required` doc is not `submitted/approved/waived`. An always-required `government_id` row makes the packet not upload-complete until it is scanned — **no finalize-logic change needed.**
- **Scanner multi-page:** `components/DocumentScanner/DocumentScanner.tsx` accepts `multiPage` (defaults `true`) + `maxPages` (defaults `10`). `DocumentCard.tsx:309-311` renders it with `multiPage={supportsMultiFile}` where `supportsMultiFile = isMultiFileDoc(doc_type)` (`:154`) — read from `docContent.ts`. **It does NOT currently pass `maxPages`.** To cap front+back at 2 pages, `DocumentCard` must pass `maxPages={getMaxFiles(doc_type)}` (helper already exported from `docContent.ts`).

**Two snags to handle, not invent around:**

1. **Category.** The DB/UI category vocabulary is `income | assets | medical_childcare | immigration | signed_forms` (DB enum from `20260514205000_pbv_document_categories.sql:8-14`; UI union + `custom` fallback in `AlmostDoneReview.tsx:18-24`). There is **no `identity` category.** The category backfill in that migration keys `display_order < 110 → 'income'`, so a low-order row would be mislabeled `income` **only if** categorized by that backfill — but the live seed path (`seedApplicationDocuments`) copies `template.category` directly, so the template row's explicit `category` wins. We add `identity` as a new first-class category (label "Photo ID" / "Identification"); `AlmostDoneReview.tsx`'s strict `DocCategory` union must gain `'identity'` and a `categories[]` label entry (EN/ES/PT), placed first.

2. **`maxPages` not wired.** As above — a one-line `maxPages={getMaxFiles(document.doc_type)}` on the scanner element so the multi-page cap from `docContent.ts` is honored. Other multi-file docs (`paystubs` maxFiles 4, etc.) already declare `maxFiles` and currently get the scanner default of 10; wiring `maxPages` brings them in line too (acceptable, in-spec).

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Template seed (required set) | `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql` | first row `paystubs` at `display_order=10`; no identity doc |
| Live seeding from templates | `app/api/t/[token]/pbv-full-app/intake/complete/route.ts:316-399` | `ORDER BY display_order`, copies `category` directly |
| Category column + backfill | `supabase/migrations/20260514205000_pbv_document_categories.sql` | DB enum has no `identity`; backfill `<110 → income` |
| Trigger config | `lib/pbv/documentTriggers.ts` | `government_id` named as legacy/ungated (`:195`), no trigger row |
| Plain-language content | `lib/pbv/cards/docContent.ts`, `lib/pbv/docTypeHelp.ts` | no `government_id` entry in either |
| Document ordering (tenant) | `app/api/t/[token]/pbv-full-app/documents/route.ts:99-103` | `display_order ASC, person_slot ASC` |
| Dashboard required-count | `app/api/t/[token]/pbv-full-app/upload-summary/route.ts:57-59` | `required === true` after `filterByTriggers` |
| Upload-complete / finalize | `lib/pbv/finalizeValidation.ts:114-129` | all `required` docs must be `submitted/approved/waived` |
| Scanner multi-page | `components/DocumentScanner/DocumentScanner.tsx:28-29,133-134` | `multiPage` default true, `maxPages` default 10 |
| Scanner wiring | `components/pbv/cards/DocumentCard.tsx:154,309-311` | `multiPage` wired; `maxPages` NOT passed |
| Review-screen categories | `components/pbv/cards/AlmostDoneReview.tsx:18-78` | strict `DocCategory` union + `categories[]` labels; no `identity` |

---

## Goals

1. Every PBV application requires a **Government-issued Photo ID** (`doc_type = government_id`) — always required, **never** conditional on intake answers (`isTriggered: () => true`).
2. The photo ID sorts **first** in the entire tenant document list (before income/assets/forms), via the lowest `display_order` in the template set.
3. The ID is captured with the existing **scanner**, allowing **front + back as one multi-page document** (default 2 pages), via `multiFile: true, maxFiles: 2` in `docContent.ts` plus the `maxPages` wiring.
4. Plain-language **title + one-line "what this is" + fallback** exist in **EN/ES/PT** in both `docContent.ts` and `docTypeHelp.ts`, following the existing pattern.
5. The new doc is wired end-to-end: appears for **new** applications (seed/live-seed) and **existing in-progress** applications (backfill), is grouped under a new **`identity`** category (shown first on the review screen), counted in the dashboard required-count, and makes the application **not upload-complete** until scanned.
6. A migration/seed adds the requirement (and an optional backfill) — **written + committed + listed in OPEN-DECISIONS, NOT applied to prod.**

## Non-goals

- No new signing/finalize logic — `validateReadyToFinalize` already gates on `required` docs; we only add a required row.
- No OCR, ID-number extraction, MRZ parsing, or identity-matching against intake — this is a scanned upload, nothing more.
- No change to the scanner's capture internals (PRD-45/52 own those) beyond passing `maxPages`.
- No restructuring of the other categories or their docs; we only add `identity` and place it first.
- No conditional logic — the ID is universal, so no `conditional_on` / `member_filter` gymnastics.

---

## Implementation phases

### Phase 1 — Add the `government_id` template row (the required set)
- In a **new** migration `supabase/migrations/20260521010000_prd65_government_id_required.sql`, `INSERT … ON CONFLICT (form_id, doc_type) DO UPDATE` one row into `form_document_templates`:
  - `form_id = 'pbv-full-application'`, `doc_type = 'government_id'`, EN/ES/PT labels (e.g. "Government-Issued Photo ID" / "Identificación con foto emitida por el gobierno" / "Identidade com foto emitida pelo governo"), `required = TRUE`, `conditional_on = NULL`, `display_order = 5` (below `paystubs`=10 so it sorts first), `per_person = FALSE`, `applies_to = 'submission'` (one ID for the head of household), `member_filter = NULL`, `category = 'identity'`.
  - **[Inference]** `applies_to = 'submission'` (single submission-level slot, `person_slot = 0`) — the photo ID is the head-of-household applicant's, not one-per-adult. **Default-and-log** if Alex wants one ID per adult.
- Mirror the seed's `ON CONFLICT` upsert columns so a re-run is idempotent. Add a rollback comment (`DELETE … WHERE form_id='pbv-full-application' AND doc_type='government_id'`).
- **Do NOT apply to prod.** Commit + list under "Prod migrations to apply" in OPEN-DECISIONS.

### Phase 2 — Add the always-required trigger
- In `lib/pbv/documentTriggers.ts`, add `{ doc_type: 'government_id', isTriggered: () => true }` (alongside the signed-forms always-required block). Remove `government_id` from the "legacy / not gated" comment at `:195` since it is now first-class. This keeps `filterByTriggers` / `persistDocumentTriggers` from ever marking it `no_longer_required`.

### Phase 3 — Plain-language content (EN/ES/PT)
- In `lib/pbv/cards/docContent.ts`, add a `government_id` entry to `DOC_CONTENT`: short `title`, one-to-two-sentence `description` ("Driver's license, state ID, or passport — for the head of household"), a `fallback`, `multiFile: true`, `maxFiles: 2` (front + back). Add it as a new leading section comment (`IDENTITY`) so the file stays organized.
- In `lib/pbv/docTypeHelp.ts`, add a `government_id` help entry (EN/ES/PT) following the existing tone (what it is, what's accepted, scan front and back).

### Phase 4 — Wire `maxPages` + the `identity` category (UI)
- In `components/pbv/cards/DocumentCard.tsx`, pass `maxPages={getMaxFiles(document.doc_type)}` to the `DocumentScanner` element (`:309`), importing `getMaxFiles` from `docContent.ts`. This caps `government_id` at 2 pages and aligns other multi-file docs with their declared `maxFiles`.
- In `components/pbv/cards/AlmostDoneReview.tsx`, add `'identity'` to the `DocCategory` union (`:18-24`), add a `categories[]` entry keyed `identity` with EN/ES/PT label ("Photo ID" / "Identificación con foto" / "Identidade com foto") placed **first** in the array, and ensure the bucket map (`:270-271`) initializes an `identity: []` bucket. If the DB `category` arrives as `identity`, it must render in this section (not `custom`).

### Phase 5 — Backfill existing in-progress applications
- In the same migration (or a clearly separated, also-committed-not-applied statement block), backfill: for every `pbv_full_applications` whose documents were already seeded (intake complete), insert a `government_id` `application_documents` row if absent — `anchor_type='pbv_full_application'`, `anchor_id=<app id>`, `doc_type='government_id'`, `label`, `required=TRUE`, `display_order=5`, `person_slot=0`, `revision=0`, `status='missing'`, `category='identity'`, `created_by='system'`. Use a `WHERE NOT EXISTS` guard so it is idempotent and never duplicates. **[Inference]** scope to applications not yet `submitted_at` so finalized packets are untouched — **default-and-log**.
- This statement is **written + committed, NOT applied.** List it under "Prod migrations to apply" with the backfill caveat (it changes in-flight tenants' required count → they will be asked for the ID on next visit).

### Phase 6 — Static gate test
- Add/extend a unit test asserting: (a) `government_id` is present in the seed/template set as `required=true` with `category='identity'` and the lowest `display_order`; (b) `TRIGGER_MAP.get('government_id').isTriggered(<any intake>)` is `true`; (c) `getDocTitle/getDocHelp('government_id', 'en'|'es'|'pt')` are non-empty; (d) `filterByTriggers` over a seeded list keeps `government_id` for an empty/minimal intake; (e) a fixture where `government_id` is `missing` makes `validateReadyToFinalize`-style required-doc completeness `false`. Use the existing test fixtures (`lib/pbv/__tests__/`, `lib/documents/__tests__/`) so the assertion is pure where possible.

---

## Verification / test plan

Static gates run in-session; runtime/device gates deferred per `BATCH-RUN-PROTOCOL.md`.

- **Gate 1 (required + first — static):** the template set contains `government_id`, `required=true`, `category='identity'`, `display_order` < every other doc; a test asserts it sorts first.
- **Gate 2 (universal — static):** `isTriggered` for `government_id` is `() => true`; `filterByTriggers` keeps it for a minimal/empty intake (no income, no assets, citizen, no children).
- **Gate 3 (content — static):** `government_id` resolves a non-empty EN/ES/PT title + description + help in `docContent.ts` and `docTypeHelp.ts`.
- **Gate 4 (gating — static):** a required-doc completeness check returns `false` when `government_id` is `missing` (proving upload-complete depends on it), and `true` once it is `submitted`.
- **Gate 5 (multi-page — static):** `isMultiFileDoc('government_id') === true` and `getMaxFiles('government_id') === 2`; `DocumentCard` passes `maxPages` to the scanner.
- **Gate 6:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; new test green.
- **Deferred (runtime/device):** scan a real driver's license/passport front+back on a phone, confirm it uploads as one 2-page PDF, shows first in the card stack and under "Photo ID" on review, and that the dashboard required-count includes it and the app cannot finalize without it. Migration + backfill applied deliberately by Alex post-review.

---

## Open questions

- **O1:** One photo ID for the head of household (`applies_to='submission'`) vs one per adult (`applies_to='each_adult'`)? Default `submission` (single ID), log it. (Reversible: change `applies_to` in the seed + re-seed.)
- **O2:** Front + back as **one** multi-page doc (default) vs two separate `government_id_front` / `government_id_back` docs? Default: one multi-page doc (`maxFiles: 2`), simpler for the tenant and matches the scanner's multi-page model. Log it.
- **O3:** Backfill scope — all in-progress applications, or only un-submitted ones? Default: only `submitted_at IS NULL` so finalized packets are untouched. Log it; flag that backfilled in-flight tenants will see a new required doc.

## Decisions

- **D1:** `government_id` is always required (`isTriggered: () => true`, `required=TRUE`, no `conditional_on`) — universal, never gated by intake. (Resolves the core requirement.)
- **D2:** `display_order = 5` (below `paystubs`=10) makes it first; ordering is purely `display_order ASC` in `documents/route.ts`. (Reversible via the seed.)
- **D3:** New first-class `identity` category (not the `custom` grab-bag), shown first on the review screen, set explicitly on the template row so the live seed path copies it (not derived from the `<110 → income` backfill).
- **D4:** Migration + backfill are **written + committed, not applied to prod**; listed in OPEN-DECISIONS per the batch protocol.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `supabase/migrations/20260521010000_prd65_government_id_required.sql` (new) | 1, 5 | insert `government_id` template row (`display_order=5`, `category='identity'`, `required=TRUE`); backfill `application_documents` for in-progress apps — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/pbv/documentTriggers.ts` | 2 | add `{ doc_type:'government_id', isTriggered:()=>true }`; drop `government_id` from the legacy/ungated comment |
| `lib/pbv/cards/docContent.ts` | 3, 4 | add `government_id` `DOC_CONTENT` entry (EN/ES/PT, `multiFile:true`, `maxFiles:2`) |
| `lib/pbv/docTypeHelp.ts` | 3 | add `government_id` `DOC_TYPE_HELP` entry (EN/ES/PT) |
| `components/pbv/cards/DocumentCard.tsx` | 4 | pass `maxPages={getMaxFiles(document.doc_type)}` to `DocumentScanner` |
| `components/pbv/cards/AlmostDoneReview.tsx` | 4 | add `'identity'` to `DocCategory`, a leading `categories[]` label (EN/ES/PT), and an `identity` bucket |
| new/extended unit test (`lib/pbv/__tests__/` or `lib/documents/__tests__/`) | 6 | assert present/required/first/universal/content/gating |

If anything outside this list needs changing, stop and report rather than expanding scope.
