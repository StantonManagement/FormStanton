# PRD-65 — Required Government Photo ID as the First Scanned Document — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening`
**Commit:** PRD-65: required government photo ID as first scanned document

---

## What changed

| File | Change |
|---|---|
| `supabase/migrations/20260521030000_prd65_government_id_required.sql` | **NEW.** (a) `INSERT … ON CONFLICT` one `government_id` row into `form_document_templates` (`required=TRUE`, `display_order=5`, `category='identity'`, `per_person=FALSE`, `applies_to='submission'`, EN/ES/PT labels). (b) Backfill `application_documents` for `pbv_full_applications WHERE submitted_at IS NULL` that already have seeded docs and no existing `government_id` slot. Idempotent via `WHERE NOT EXISTS`. **NOT APPLIED** — listed in OPEN-DECISIONS with a tenant-comms heads-up. |
| `lib/pbv/documentTriggers.ts` | Added `{ doc_type: 'government_id', isTriggered: () => true }` at the top under a new "Identity docs (PRD-65, always required, sort first)" comment. Removed `government_id` from the trailing legacy/ungated comment (it's first-class now). |
| `lib/pbv/cards/docContent.ts` | New `government_id` entry under a leading `IDENTITY` section comment. `title`/`description`/`fallback` in EN/ES/PT, `multiFile: true`, `maxFiles: 2`. |
| `lib/pbv/docTypeHelp.ts` | New `government_id` `DOC_TYPE_HELP` entry under an `IDENTITY` section comment, EN/ES/PT, matching the existing tone (what it is, what's accepted, scan front and back; passport-only edge case called out). |
| `components/pbv/cards/DocumentCard.tsx` | Imported `getMaxFiles` from `docContent.ts`; passed `maxPages={getMaxFiles(document.doc_type)}` to the `DocumentScanner` element. Caps `government_id` at 2 pages and aligns other multi-file docs (`paystubs` maxFiles 4, etc.) with their declared caps. |
| `components/pbv/cards/AlmostDoneReview.tsx` | Added `'identity'` to the `DocCategory` union; placed an `identity` entry first in `categories[]` (EN "Photo ID", ES "Identificación con foto", PT "Identidade com foto"); initialized an `identity: []` bucket in the grouping map; `categorizeDoc` now maps DB `category === 'identity'` to `identity` and falls back to `identity` for any legacy `government_id` doc with a null DB category. |
| `lib/pbv/__tests__/government-id-required.test.ts` | **NEW.** 14 cases — trigger universal/first; docContent EN/ES/PT + `multiFile:true`/`maxFiles:2`; docTypeHelp EN/ES/PT; migration shape (`required`, `display_order=5`, `category='identity'`, `applies_to='submission'`); backfill scope (`submitted_at IS NULL` + `NOT EXISTS`); `paystubs=10` confirms `5 < 10` so the row sorts first; AlmostDoneReview source has `'identity'` in the union, first in `categories[]`, and an `identity: []` bucket. |

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — present + required + identity + first | ✅ PASS | Migration shape + display_order comparison checked. |
| Gate 2 — `isTriggered('government_id')` is `() => true` | ✅ PASS | `TRIGGER_MAP.get('government_id')!.isTriggered({})` returns `true`; minimal intake too. |
| Gate 3 — EN/ES/PT title + description + help non-empty | ✅ PASS | `getDocTitle/getDocDescription` and `DOC_TYPE_HELP['government_id']` all non-empty in all three languages. |
| Gate 4 — required-doc completeness gating | ✅ PASS (downstream) | `validateReadyToFinalize` Check 4 already treats `required && status !== submitted/approved/waived` as incomplete (already covered by PRD-56/57/58 tests). The PRD-65 row is `required=true`, so finalize automatically refuses without it. No new finalize test added. |
| Gate 5 — `isMultiFileDoc('government_id')===true`, `getMaxFiles('government_id')===2`; `DocumentCard` passes `maxPages` | ✅ PASS | docContent test confirms `multiFile`/`maxFiles`; structural inspection of `DocumentCard.tsx` confirms the `maxPages={getMaxFiles(document.doc_type)}` prop on the scanner. |
| Gate 6 — `tsc --noEmit` + `npm run build` + tests | ✅ PASS | tsc silent; build exit 0; 14/14 PRD-65 tests green. |

## Decisions logged

- `[PRD-65] Photo ID — submission-level slot (one for HoH)` (O1 default).
- `[PRD-65] Photo ID — one multi-page doc (front+back)` (O2 default).
- `[PRD-65] Backfill scope — un-submitted apps only` (O3 default) — with tenant-comms heads-up note.
- `[PRD-65] New 'identity' category` (D3) — first-class top-level category.

## Prod migrations to apply

- `supabase/migrations/20260521030000_prd65_government_id_required.sql` — template row + backfill. **Heads-up:** tenants mid-application get a new required Photo ID slot on next visit. If a comms message is wanted, send before applying.

## Deferred runtime gates (post-run verification pass)

- **Device walk (R1):** scan a real driver's license front + back on a phone — confirm one 2-page PDF lands, the card shows first in the stack, the review screen lists it under "Photo ID" (or the localized label), the dashboard required-count includes it, and `/finalize` returns `validation_failed` until the doc is `submitted`. Repeat with a passport (one-page case — should be acceptable as a single-page upload via the scanner's confirm flow).

## Out-of-lane (untouched)

- `lib/pbv/finalizeValidation.ts` — Check 4 already gates on `required` docs.
- `app/api/t/[token]/pbv-full-app/documents/route.ts` (ordering already `display_order ASC`) and `upload-summary/route.ts` (count already `required===true` after `filterByTriggers`).
- `components/DocumentScanner/*` — no internal capture changes; only consume `multiPage`/`maxPages`.
- Signing flow, summary doc, intake, form generation (`generate-forms`, `conditional-rules.ts`, `field-mapping.ts`).

## Batch closeout (this PRD)

The prompt notes this is the last PRD in the batch, but the batch instructions actually include PRD-66 and PRD-67. Proceeding to **PRD-66** next.
