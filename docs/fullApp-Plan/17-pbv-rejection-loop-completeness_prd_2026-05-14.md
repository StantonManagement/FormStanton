# PRD-17 — PBV Tenant Rejection Loop Completeness

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / UX
**Sequence:** Spawned from PRD-14 Phase 5.
**Depends on:** PRD-14 (Document Categorization — for category-aware rejection context). Parallel-safe with PRD-15 and PRD-16.
**Blocks:** Nothing.

---

## Problem Statement

When an admin rejects a tenant document, the tenant sees the value of `application_documents.rejection_reason` rendered into the UI at `TenantDocumentUpload.tsx:300-304`. Two failure modes:

1. **Empty rejection_reason renders as blank UI.** No fallback. Tenant sees a rejected status badge with no explanation.
2. **No localization.** Even when populated, the reason is whatever the admin typed — usually English. Spanish and Portuguese tenants see English rejection text.

There is no template system for rejection reasons. Admins type free text every time. This is unmaintainable, error-prone, and creates a per-rejection translation burden.

This PRD adds a template table with per-doc-type, per-language reason strings, a `rejection_reason_key` column on `application_documents`, an admin reject flow that picks from the template list, and a tenant render with a three-level fallback (key → free-text → generic localized).

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| Tenant renders `rejection_reason` as plain text | Read `TenantDocumentUpload.tsx:300-304` | Verified |
| No fallback if reason is null/empty | Read | Verified — the conditional `&& doc.rejection_reason` hides the entire block on null, leaving rejected docs with no explanation visible |
| Admin reject endpoints accept free-text only | [Unverified] — confirm in build phase | Read before coding |

---

## Key decisions

### 1. Hybrid: template key + free-text override

Every rejection writes a `rejection_reason_key` referencing a template row. The free-text `rejection_reason` column stays as an optional override for cases templates don't cover. Admin UI offers a dropdown of templates + a "custom reason" field. Tenant render resolves key → localized template, falls back to free-text, falls back to localized generic.

### 2. Per-doc-type + generic templates

Templates are keyed `(doc_type, reason_slug)` plus generic rows with `doc_type = NULL` for reasons that apply across all doc types. Examples: `paystubs:illegible`, `paystubs:wrong_date_range`, `paystubs:missing_pages`, generic `:expired`, generic `:wrong_person`.

### 3. Localized in en/es/pt at the template layer

The template table carries `reason_en`, `reason_es`, `reason_pt` columns. The tenant render selects the column matching the current language. New language: add a column.

### 4. Admin keeps the override path

Free-text rejection stays supported because no template set covers every edge case. If admins use it often, the template set is missing entries — that's a separate analysis, not a UX failure.

---

## Scope

### What this PRD does

1. Adds `pbv_rejection_reason_templates` table with `(key, doc_type, reason_en, reason_es, reason_pt)` columns.
2. Seeds the table with per-doc-type and generic reason templates.
3. Adds `rejection_reason_key` column to `application_documents` (nullable, FK to templates).
4. Updates admin reject endpoints to accept `rejection_reason_key` (preferred) or `rejection_reason` free-text (override).
5. Builds `lib/rejectionReasons.ts` with `resolveRejectionReason(key, freeText, language)` and three-level fallback.
6. Updates `TenantDocumentUpload.tsx:300-304` to render via `resolveRejectionReason`.
7. Adds an admin UI affordance (dropdown of templates) to the existing reject flow.

### What this PRD does NOT do

- Backfill historical rejections with template keys (those keep their free-text values).
- Add a fourth language (out of scope until requested).
- Build a template-management admin UI (operators edit via SQL or a future PRD).

---

## Affected files

### New migration

| File | What |
|---|---|
| `supabase/migrations/20260514220000_pbv_rejection_reason_templates.sql` | `CREATE TABLE pbv_rejection_reason_templates (key TEXT PRIMARY KEY, doc_type TEXT NULL, reason_en TEXT NOT NULL, reason_es TEXT NOT NULL, reason_pt TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`. Seed ~40 rows: 4-6 reasons per major doc category (paystubs, bank statements, signed forms) + 10-15 generic reasons. Then `ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS rejection_reason_key TEXT REFERENCES pbv_rejection_reason_templates(key)`. |

### New library

| File | What |
|---|---|
| `lib/rejectionReasons.ts` | `resolveRejectionReason({ key, freeText, language, docLabel }): string`. If `key` present and template lookup succeeds, return localized template string. Else if `freeText` present, return free-text. Else return localized generic: "Please contact the office for details on why this document was rejected." Optionally interpolate `docLabel` into the generic if helpful. |

### Modified API routes

| Route | Change |
|---|---|
| `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/reject/route.ts` (or whichever route handles rejection — confirm in build phase) | Accept `rejection_reason_key` (preferred), validate against templates table, write to `application_documents.rejection_reason_key`. Free-text `rejection_reason` still accepted as override. |
| Documents API (whichever endpoint serves the tenant docs list) | Include `rejection_reason_key` in response payload. |

### Modified client files

| File | Change |
|---|---|
| `components/pbv/TenantDocumentUpload.tsx:300-304` | Replace direct render with `resolveRejectionReason({ key: doc.rejection_reason_key, freeText: doc.rejection_reason, language, docLabel: doc.label })`. |
| Admin reject UI (location TBD in build phase) | Add a dropdown of templates filtered by current doc's `doc_type`, with a "custom reason" option that reveals the free-text input. |

---

## Phases

### Phase 1 — Schema + seed

| # | Step | Verify |
|---|---|---|
| 1.1 | Apply `20260514220000_pbv_rejection_reason_templates.sql`. | Templates table exists. Seed populated. `application_documents.rejection_reason_key` column exists. |
| 1.2 | Spot-check seed coverage: for each of the top 5 most commonly rejected doc types (paystubs, bank statements, ssi/ss award letters, id docs, signed forms) the template table has at least 3 reason variants. | Query the table. |

### Phase 2 — Helper + tenant render

| # | Step | Verify |
|---|---|---|
| 2.1 | Build `lib/rejectionReasons.ts` with the three-level fallback. Add unit tests. | Test cases: key-only / free-text-only / both / neither — each returns the expected string in each of en/es/pt. |
| 2.2 | Update `TenantDocumentUpload.tsx:300-304` to render via the helper. | Manual test: inject a rejected doc with each fallback level; UI shows correct localized text. |
| 2.3 | Update the documents API response to include `rejection_reason_key`. | DevTools shows the field in payload. |

### Phase 3 — Admin reject flow

| # | Step | Verify |
|---|---|---|
| 3.1 | Locate the admin reject endpoint(s). Add `rejection_reason_key` parameter handling with template validation. | Curl a reject with a valid key — succeeds. Invalid key — 400. |
| 3.2 | Update admin UI: add a template dropdown filtered by the doc's `doc_type`, with a "custom reason" toggle. | Manual test: admin rejects via dropdown, tenant sees localized template; admin rejects via custom, tenant sees free-text. |

### Phase 4 — Verification

| # | Step | Verify |
|---|---|---|
| 4.1 | Round-trip test: admin rejects with template key → tenant sees localized reason in en/es/pt. | Pass. |
| 4.2 | Round-trip test: admin rejects with free-text → tenant sees free-text. | Pass. |
| 4.3 | Backfill check: historical rejections (free-text only, no key) still render correctly. | Pass. |
| 4.4 | Empty-rejection check: a rejected doc with neither key nor free-text shows the localized generic, not blank. | Pass. |

---

## Rollback

- Migration is additive. Inverse drops the column and table.
- Helper file is deletable.
- Admin reject endpoint changes revert via git; the column stays nullable so existing data is harmless.

---

## Open questions

1. **[Unverified]** The exact path of the admin reject endpoint(s). Could be `/api/admin/applications/[anchor_type]/[anchor_id]/documents/[documentId]/reject` per PRD-01 conventions, or `/api/admin/pbv/full-applications/[id]/...`. Grep before coding.
2. **[Unverified]** Whether there are bulk-reject endpoints that also need updating. Grep for any "bulk" + "reject" combinations.
3. **[Speculation]** Whether the existing admin reject UI has room for a dropdown without redesign. Phase 3.2 may scope-creep into a small UI refactor — if it does, post in chat before expanding.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Hybrid template + free-text | Pure templates inflexible; pure free-text unmaintainable across 3 languages. Hybrid lets the dropdown cover 90%, the override covers the long tail. |
| 2026-05-14 | Localization at the template layer, not at render time | Translations belong to the template, not to per-rejection runtime code. Adding a language = adding a column. |
| 2026-05-14 | No backfill of historical rejections | They render via free-text fallback. Backfill adds noise without value. |
| 2026-05-14 | No template-management admin UI in this PRD | SQL edits via Supabase studio are acceptable for the seed set. A real admin UI is a future PRD if templates churn. |
