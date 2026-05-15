# PRD-14 — PBV Tenant Flow Correctness & Go-Live

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / consolidation / production readiness
**Goal:** A tenant can complete the PBV full application end-to-end on a phone, the application is server-side locked when complete, and the codebase has one canonical implementation per concern (no parallel orphan surfaces).

---

## Problem Statement

After multiple Windsurf debug passes, the tenant-facing PBV full application (`/pbv-full-app/[token]`) has accumulated structural problems that prevent a tenant from completing the flow correctly:

1. **Empty documents list** — the tenant sees no required documents because `application_documents` rows are not present (the templates table may not be seeded in the live DB, and the intake POST seeding path needs verification).
2. **Unreachable success state** — `setPageState('confirmed')` is never called anywhere in the codebase. The "All Complete" message in `docs_ready` lets the tenant reload and re-submit signatures indefinitely.
3. **Parallel signing implementations** — the main page has a working canvas-based `react-signature-canvas` flow; a separate orphan subpage at `/pbv-full-app/[token]/signing/` ships a disabled "Sign in-app" placeholder. Two surfaces for the same concern create confusion and broken paths.
4. **Three parallel token-resolution API trees** — `/api/pbv-full-app/[token]/...`, `/api/tenant/pbv/[token]/...`, `/api/t/[token]/pbv-full-app/...` all overlap in responsibility with no canonical owner.
5. **No server-side submission lock** — there is no atomic finalize endpoint. The application's "done" state is a derived computation, not a persisted invariant.
6. **No `already_submitted` re-entry** — returning tenants land back in the live form, can re-sign, can mutate completed state.
7. **Rejection loop has empty-string failure modes** — `rejection_reason` is read but never seeded with a translated, per-doc-type explanation. Tenants see blank rejection UI.
8. **Multi-signer canvas handoff** has a `sigCanvasRefs.current.clear()` call that may strand canvas state between adult signers.
9. **Concurrent / retry submissions** return generic 409s with no idempotency key.
10. **Network failures on document fetch/upload** have no timeout, no retry, no surfaced error.

This PRD addresses all of the above in a single coherent change set, phased so each phase is independently shippable and reversible.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| `setPageState('confirmed')` is never called | Grep across full repo — zero matches | Verified |
| Main page `pageState === 'signatures'` renders working `react-signature-canvas` per-doc; POSTs to `/api/t/[token]/pbv-full-app/signatures` | Read `app/pbv-full-app/[token]/page.tsx:1435-1484` | Verified |
| Orphan subpage at `app/pbv-full-app/[token]/signing/page.tsx` uses `TenantSigningView` with hard-disabled "Sign in-app" button | Read `components/tenant-signing/TenantSigningView.tsx:238-245` | Verified |
| `TenantDocumentUpload` fetches `/api/pbv-full-app/${token}/documents` on mount | Read `components/pbv/TenantDocumentUpload.tsx:122` | Verified |
| Documents API queries `application_documents WHERE anchor_type='pbv_full_application' AND anchor_id=app.id` — returns empty list if no rows | Read `app/api/pbv-full-app/[token]/documents/route.ts:94-100` | Verified |
| Templates migration `20260423220000_pbv_full_app_document_templates.sql` contains 31 INSERTs for `form_id='pbv-full-application'` | Read migration | Verified in source |
| Three parallel token-routing trees coexist: `/api/pbv-full-app/[token]/...`, `/api/tenant/pbv/[token]/...`, `/api/t/[token]/pbv-full-app/...` | Glob | Verified |
| Templates table actually populated in live Supabase | Not yet queried | **Unverified — gate for Phase 1** |
| Intake POST `app/api/t/[token]/pbv-full-app/route.ts` seeds `application_documents` from `form_document_templates` | [Inference] from audit; not read directly | Needs source confirmation in Phase 1 |
| `sigCanvasRefs.current.clear()` at page.tsx:658 leaks or corrupts state between adult signers | [Speculation] — never tested with 2-adult household | Test in Phase 5 |
| `application_documents` rows ever carry `rejection_reason` populated by admin flow | [Unverified] — depends on admin reject endpoint | Confirm in Phase 4 |

---

## Key decisions

### 1. The main-page `pageState === 'signatures'` canvas flow is canonical

The working in-app signing surface is the main page. The `/signing` subpage and `TenantSigningView` are removed in this PRD. There is no surviving multi-modal signing implementation. If PDF-upload signing or DocuSign integration is needed later, it is a separate PRD.

### 2. `/api/t/[token]/pbv-full-app/*` is the canonical tenant API tree

All tenant-facing reads and writes resolve under this tree. The other two trees (`/api/pbv-full-app/[token]/*` and `/api/tenant/pbv/[token]/*`) are migrated or removed. Admin routes (`/api/admin/pbv/...`) are unaffected.

### 3. Submission completion is a server-persisted invariant, not a computed flag

A new `pbv_full_applications.submitted_at` column and a single finalize endpoint flip the state irreversibly. The client `confirmed` state is gated on this column.

### 4. Idempotency at every tenant-write endpoint

Every POST that mutates tenant submission state accepts an `Idempotency-Key` header. Replays return the original result, not a 409. This eliminates the network-flake retry trap.

### 5. Rejection reasons must be human-readable in three languages

A `pbv_rejection_reason_templates` table (or extension to an existing translations table) ships in this PRD with seed rows for every doc type, in `en`/`es`/`pt`. Admin rejection routes write the chosen template's key onto the document row; tenant render resolves the key to a localized string. Empty/null falls back to a localized generic string.

### 6. Already-submitted re-entry is read-only

A returning tenant whose application has `submitted_at IS NOT NULL` lands on a read-only confirmation screen showing what was submitted and a contact-the-office prompt. No mutation possible.

### 7. Resilience is per-call, not global

Document fetch, document upload, signature save, and finalize all get explicit timeouts (15s read, 60s upload), one automatic retry on network error, and a user-visible error state with a manual retry button. No silent failures.

---

## Scope

### What this PRD does

1. Verifies the templates table is seeded in live DB; if not, ships an idempotent re-seed.
2. Adds `submitted_at` and `finalized_idempotency_key` columns to `pbv_full_applications`.
3. Adds a server-side `POST /api/t/[token]/pbv-full-app/finalize` endpoint with idempotency.
4. Wires client `setPageState('confirmed')` transitions on finalize success and on initial load when `submitted_at IS NOT NULL`.
5. Adds the `already_submitted` page state branch with a read-only confirmation render.
6. Adds `pbv_rejection_reason_templates` table, seeds it for all doc types in `en`/`es`/`pt`, updates admin reject routes to write template keys, updates tenant render to resolve and fall back gracefully.
7. Adds idempotency-key support to all tenant POSTs: intake submission, signature save, document upload, finalize.
8. Fixes the multi-signer canvas handoff: properly clears each canvas via `forEach`, then resets the Map.
9. Adds explicit per-call timeouts, one retry on network error, and user-visible error UI for documents fetch, document upload, signature save, finalize.
10. Removes orphan files: `app/pbv-full-app/[token]/signing/page.tsx`, `components/tenant-signing/TenantSigningView.tsx`, `components/signing/UploadSignedDialog.tsx` (if unused elsewhere), `app/api/tenant/pbv/[token]/signing/route.ts`, `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts`.
11. Consolidates tenant-facing API tree under `/api/t/[token]/pbv-full-app/*`. Migrates `/api/pbv-full-app/[token]/documents/*` to this tree; updates all callers.
12. Adds a tenant magic-link audit: confirms the SMS/email template links to `/pbv-full-app/<token>` and never to `/signing` or another orphan.
13. Adds end-to-end automated test covering: token landing → intake → docs → signatures → finalize → confirmed → re-entry → already_submitted.
14. Adds structured event logging for each tenant phase transition into `application_events`.
15. Adds a `category` column to `form_document_templates` and `application_documents`, backfilled from the existing `display_order` ranges that already encode logical groupings in the seed migration's comments.
16. Updates the templates seed to populate `category` explicitly. Future templates must set `category` directly — range-based inference is only a one-time backfill.
17. Updates the intake POST handler (`app/api/t/[token]/pbv-full-app/route.ts`) to copy `category` from template to `application_documents` row at seed time.
18. Localizes category labels in `pbvFullAppTranslations.ts` for `en`, `es`, `pt`.
19. Groups document lists by `category` in both `StantonReviewSurface` (admin) and `TenantDocumentUpload` (tenant). Within a category, sort by `(display_order, person_slot)`.

### What this PRD does NOT do

- Add PDF-upload or DocuSign signing modalities (separate PRD if needed).
- Refactor admin review or HACH workflows.
- Modify `form_submissions` or `form_submission_documents` tables (covered by PRD-11a).
- Change the document template content (the existing 31 templates are correct).
- Touch the preapp flow or income eligibility engine.

---

## Affected files

### Database migrations (new)

| File | What |
|---|---|
| `supabase/migrations/20260514200000_pbv_submitted_at.sql` | ADD `submitted_at TIMESTAMPTZ`, `finalized_idempotency_key TEXT UNIQUE` to `pbv_full_applications`. Backfill `submitted_at` for any application whose current computed state is "complete" (use existing `next_step` logic). |
| `supabase/migrations/20260514201000_pbv_rejection_reason_templates.sql` | CREATE TABLE `pbv_rejection_reason_templates (key TEXT PRIMARY KEY, reason_en TEXT NOT NULL, reason_es TEXT NOT NULL, reason_pt TEXT NOT NULL, doc_type TEXT, created_at TIMESTAMPTZ DEFAULT now())`. Seed with per-doc-type rejection reasons (illegible, expired, wrong-person, missing-pages, etc.) + generic fallbacks. |
| `supabase/migrations/20260514202000_application_documents_rejection_key.sql` | ADD `rejection_reason_key TEXT REFERENCES pbv_rejection_reason_templates(key)` to `application_documents`. Keep `rejection_reason` as a free-text override for cases templates do not cover. |
| `supabase/migrations/20260514203000_idempotency_keys.sql` | CREATE TABLE `tenant_idempotency_keys (key TEXT PRIMARY KEY, endpoint TEXT NOT NULL, application_id UUID NOT NULL REFERENCES pbv_full_applications(id), response_body JSONB NOT NULL, response_status INT NOT NULL, created_at TIMESTAMPTZ DEFAULT now())`. Index on `(application_id, endpoint)`. |
| `supabase/migrations/20260514204000_reseed_pbv_templates.sql` | Idempotent re-run of the templates seed via `ON CONFLICT (form_id, doc_type) DO UPDATE`. Safe if templates already seeded. |
| `supabase/migrations/20260514205000_pbv_document_categories.sql` | (a) ADD `category TEXT` to `form_document_templates` and `application_documents`. (b) Backfill `form_document_templates.category` for `form_id='pbv-full-application'` from `display_order` ranges: `<110 → income`, `<200 → assets`, `<300 → medical_childcare`, `<400 → immigration`, `>=400 → signed_forms`. (c) Backfill `application_documents.category` by joining on `doc_type` to the seeded templates. (d) Mark `category NOT NULL` on `form_document_templates` after backfill; leave `application_documents.category` nullable to permit custom docs with `category='custom'` (or `NULL`, decided in Phase 4). |

### New API routes

| Route | Method | Purpose |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/finalize/route.ts` | POST | Atomic submission lock. Validates all required docs are submitted/approved/waived AND all required signatures saved. Writes `submitted_at`. Idempotent via `Idempotency-Key` header. Returns 409 only if the application is in an invalid state for finalize (e.g., missing required docs), not on replay. |
| `app/api/t/[token]/pbv-full-app/documents/route.ts` | GET | Canonical tenant documents endpoint. Migration target for `/api/pbv-full-app/[token]/documents`. |
| `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` | POST | Canonical tenant document upload. Migration target. Idempotency support. |

### Modified API routes

| Route | Change |
|---|---|
| `app/api/t/[token]/pbv-full-app/route.ts` | GET response includes `submitted_at`. Intake POST writes `application_events` row for `intake_submitted`. Idempotency support on POST. Stops returning `form_submission_token` (per PRD-11a). |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | Idempotency support. Writes `application_events` row per signature. |
| `app/api/admin/pbv/full-applications/[id]/...` (all reject endpoints) | Accept `rejection_reason_key` and validate against `pbv_rejection_reason_templates`. Free-text `rejection_reason` allowed as fallback. |

### Deleted files (after grep confirms no remaining imports)

| File | Why |
|---|---|
| `app/pbv-full-app/[token]/signing/page.tsx` | Orphan parallel implementation |
| `components/tenant-signing/TenantSigningView.tsx` | Used only by orphan page |
| `components/signing/UploadSignedDialog.tsx` | [Inference] only by `TenantSigningView` — grep before deletion |
| `app/api/tenant/pbv/[token]/signing/route.ts` | Backs orphan page |
| `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts` | Backs orphan page |
| `app/api/pbv-full-app/[token]/documents/route.ts` | Migrated to `/api/t/[token]/pbv-full-app/documents/` |
| `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` | Migrated to `/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/` |

### Modified client files

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` | (a) Wire `setPageState('confirmed')` in: load handler when `submitted_at IS NOT NULL`, last-signer-done handler after finalize POST succeeds. (b) Wire `setPageState('already_submitted')` in load handler when `submitted_at IS NOT NULL` and tenant re-enters. (c) Fix `sigCanvasRefs.current.clear()` at line 658 to iterate canvases first. (d) Add finalize POST call before transitioning to `confirmed`. (e) Add timeout + retry wrapper around all fetches. (f) Add user-visible error state with retry button for each phase's failures. (g) Update fetches to canonical `/api/t/[token]/pbv-full-app/*` paths. (h) Generate idempotency key per submission/signature/upload. (i) Render rejected-doc reason via `rejection_reason_key` lookup with localized fallback. |
| `components/pbv/TenantDocumentUpload.tsx` | (a) Update fetch URL to canonical path. (b) Add timeout (15s) and one network-retry. (c) Surface error state with retry button. (d) Pass idempotency key on upload POST. |
| `app/pbv-full-app/[token]/page.tsx` — `already_submitted` render block (lines 690-707) | Replace placeholder with a real read-only confirmation: submitted-at timestamp, document checklist (all green), signatures list, "contact the office" CTA. |
| `components/review/StantonReviewSurface.tsx` lines 384-393 | Replace `doc_type`-based grouping with `category`-based grouping. Within each category, sort docs by `(display_order, person_slot)`. Resolve the localized category label via `pbvFullAppTranslations`. Keep the `doc_type === 'custom'` carve-out — render as its own "Additional Documents" section at the bottom. |
| `components/pbv/TenantDocumentUpload.tsx` | Replace the flat `documents.map(...)` render at line 259 with a category-grouped render: collapsible section headers per category (default expanded), sorted by category order (income → assets → medical_childcare → immigration → signed_forms → custom). Within a category, sort by `(display_order, person_slot)`. Use localized labels from `pbvFullAppTranslations`. |
| `lib/pbvFullAppTranslations.ts` | Add `category_income`, `category_assets`, `category_medical_childcare`, `category_immigration`, `category_signed_forms`, `category_custom` to each of `en`, `es`, `pt`. Suggested values: Income Verification / Verificación de Ingresos / Verificação de Renda; Banking & Assets / Cuentas y Bienes / Contas e Bens; Medical & Childcare / Médico y Cuidado Infantil / Médico e Creche; Citizenship & Immigration / Ciudadanía e Inmigración / Cidadania e Imigração; Signed Forms / Formularios Firmados / Formulários Assinados; Additional Documents / Documentos Adicionales / Documentos Adicionais. Confirm Spanish/Portuguese phrasing with the existing translation conventions in the file before merging. |

### New library

| File | What |
|---|---|
| `lib/tenantFetch.ts` | `tenantFetch(url, opts)` wrapper: 15s timeout (60s for uploads), one network-error retry, idempotency-key generation/passthrough, normalized error envelope. |
| `lib/rejectionReasons.ts` | `resolveRejectionReason(key, freeText, language)` — looks up template, falls back to free text, falls back to generic localized string. |

### Tests

| File | What |
|---|---|
| `tests/e2e/pbv-tenant-flow.spec.ts` | Playwright (or existing harness) walkthrough: mint token → load page → intake → docs upload → signatures → finalize → confirmed render → reload → already_submitted render. Variants: 1-adult, 2-adult, doc rejection round-trip. |
| `lib/__tests__/tenantFetch.test.ts` | Timeout, retry, idempotency replay. |
| `lib/__tests__/rejectionReasons.test.ts` | Template lookup, fallback chain, all three languages. |

---

## Phases

Each phase is independently shippable. Phases 1–2 are blocking for go-live. Phases 3–7 must all land before a public rollout (multi-tenant production traffic).

### Phase 1 — DB hygiene and operational verification

| # | Step | Verify |
|---|---|---|
| 1.1 | Apply `20260514204000_reseed_pbv_templates.sql` (idempotent — safe whether templates exist or not). | `select count(*) from form_document_templates where form_id='pbv-full-application'` returns 31. |
| 1.2 | Read `app/api/t/[token]/pbv-full-app/route.ts` POST handler to confirm/document the templates → `application_documents` seeding path. If seeding is missing, add it in this phase. | Create a fresh test application via the intake POST; query `application_documents` for matching `anchor_id` — expect ≥1 row per template that matches the household. |
| 1.3 | Apply `20260514200000_pbv_submitted_at.sql`. | Column exists, backfill correct on a sample of existing rows. |
| 1.4 | Apply `20260514201000_pbv_rejection_reason_templates.sql` and `20260514202000_application_documents_rejection_key.sql`. | Tables exist, seeds present. |
| 1.5 | Apply `20260514203000_idempotency_keys.sql`. | Table exists, index present. |

### Phase 2 — Server-side finalize + client `confirmed` wiring

| # | Step | Verify |
|---|---|---|
| 2.1 | Build `POST /api/t/[token]/pbv-full-app/finalize` with idempotency check, completion validation, `submitted_at` write, `application_events` row. | Unit test: replay returns identical body; invalid state returns 409 with explicit `missing` list. |
| 2.2 | GET `/api/t/[token]/pbv-full-app` returns `submitted_at` in the response. | Manual: finalize a test app, reload GET, see timestamp. |
| 2.3 | Client: in load handler, if `submitted_at IS NOT NULL` set `pageState='already_submitted'` (Phase 7 builds the render). For Phase 2 a placeholder is acceptable. | Reload after finalize → does not return to mutation state. |
| 2.4 | Client: replace `setPageState('docs_ready')` in last-signer-done handler with finalize POST → on success `setPageState('confirmed')`, on failure render error with retry. | E2E: full flow ends on `SuccessScreen`. |
| 2.5 | Fix `sigCanvasRefs.current.clear()` at page.tsx:658 → iterate `.forEach(c => c?.clear())` then reset the Map. | Manual test with 2-adult household. |

### Phase 3 — Orphan removal and API consolidation

| # | Step | Verify |
|---|---|---|
| 3.1 | Create `app/api/t/[token]/pbv-full-app/documents/` and `.../[doc_row_id]/upload/` as copies of the old routes, with idempotency added. | New routes pass the same tests as the old ones plus replay test. |
| 3.2 | Update all client callers to the new paths. | Grep for `/api/pbv-full-app/[token]/documents` returns zero results outside the deleted source. |
| 3.3 | Delete the old `/api/pbv-full-app/[token]/...` routes. | Build passes. |
| 3.4 | Grep for any remaining import of `TenantSigningView`, `UploadSignedDialog`, `/api/tenant/pbv/[token]/signing`. Confirm none survive outside the files-to-delete list. | Build passes after deletion. |
| 3.5 | Delete the orphan signing subpage, component, dialog, and backing API routes. | Build passes; no broken routes in Next.js dev. |
| 3.6 | Audit magic-link / SMS template source. Confirm tenant URL is `/pbv-full-app/<token>` (no suffix). Patch if wrong. | Inspect a sent message in staging. |

### Phase 4 — Document categorization (data-driven grouping)

| # | Step | Verify |
|---|---|---|
| 4.1 | Apply `20260514205000_pbv_document_categories.sql`. Confirms backfill: every `form_document_templates` row for `pbv-full-application` has a non-null `category` matching the intended grouping (spot-check at least one row per category). | `select category, count(*) from form_document_templates where form_id='pbv-full-application' group by category` returns 5 rows summing to 31, with no NULLs. |
| 4.2 | Confirm existing `application_documents` rows backfilled. Richie Rich's 35 rows should all have a non-null `category` after migration. | `select category, count(*) from application_documents where anchor_type='pbv_full_application' and anchor_id='<richie_id>' group by category` matches expected distribution. |
| 4.3 | Update the templates seed file (`20260423220000_pbv_full_app_document_templates.sql`) to include `category` in the INSERT statement going forward. Note: this is a documentation/source-of-truth fix — the actual rows are already set via 4.1's UPDATE. | Diff the migration file; confirm `category` is now in the column list and in every VALUES row. |
| 4.4 | Update intake POST handler (`app/api/t/[token]/pbv-full-app/route.ts` ~line 463-498) to copy `template.category` into the `application_documents` insert payload. | Submit a fresh intake; query the resulting `application_documents` rows; confirm `category` is populated. |
| 4.5 | Add `category_*` translation keys to `lib/pbvFullAppTranslations.ts` for `en`, `es`, `pt`. | Type-check passes; manual render shows correct strings per language toggle. |
| 4.6 | Replace `doc_type`-based grouping in `StantonReviewSurface.tsx` lines 384-393 with `category`-based grouping. Sort by `(display_order, person_slot)` within each category. Resolve labels via translations. Keep `doc_type === 'custom'` carve-out as its own "Additional Documents" section. | Admin review page for Richie Rich renders 5 sections (Income/Assets/Medical & Childcare/Citizenship/Signed Forms) instead of 34, with localized headers. |
| 4.7 | Update `TenantDocumentUpload.tsx` to group by `category` with collapsible section headers (default expanded). Sort within category by `(display_order, person_slot)`. | Tenant view on Richie Rich's token renders 5 sections in all three languages; mobile layout works on a narrow viewport. |
| 4.8 | Update the documents API response shape (`/api/t/[token]/pbv-full-app/documents/route.ts`, `/api/admin/pbv/full-applications/[id]/route.ts`) to include `category` per document. | Network response includes `category` field; older clients ignore unknown fields safely. |

### Phase 5 — Rejection loop completeness

| # | Step | Verify |
|---|---|---|
| 5.1 | Seed `pbv_rejection_reason_templates` with per-doc-type, per-language reasons (illegible, expired, wrong person, missing pages, watermark obscured, etc.) plus generic fallback rows. | Row count covers all 31 doc types + generics. |
| 5.2 | Update admin reject endpoints to accept `rejection_reason_key`; write to `application_documents.rejection_reason_key`. Free-text `rejection_reason` remains allowed as override. | Admin can reject with a key; tenant sees localized reason. |
| 5.3 | Build `lib/rejectionReasons.ts`. Client rejected-doc render uses it with three-level fallback (key → free-text → generic). | Unit tests pass. |
| 5.4 | Verify language switcher in tenant UI re-renders rejection reasons in the new language. | Manual test with all three languages. |

### Phase 6 — Multi-signer correctness

| # | Step | Verify |
|---|---|---|
| 6.1 | Fix canvas refs handoff per Phase 2.5 if not already done. | — |
| 6.2 | Add per-signer `application_events` row written on each signer's `done` step. | Database row per signer after a 2-adult walkthrough. |
| 6.3 | Verify finalize endpoint correctly counts signatures across all adult signers. | E2E: 2-adult finalize succeeds; 2-adult with one missing fails with explicit `missing` list. |
| 6.4 | Add a "review your signatures" preview step before finalize POST. Tenant sees thumbnails of each saved signature and can re-sign before locking. | Manual test: re-sign works pre-finalize; post-finalize is read-only. |

### Phase 7 — Resilience

| # | Step | Verify |
|---|---|---|
| 7.1 | Build `lib/tenantFetch.ts`. Replace all bare `fetch()` calls in tenant pages/components with `tenantFetch()`. | Unit tests pass. Grep for `fetch(` in tenant files returns only `tenantFetch` usages. |
| 7.2 | Add user-visible error states with manual retry buttons for: documents fetch failure, document upload failure, signature save failure, finalize failure. | Chaos test: kill backend mid-action; UI shows error + retry; retry succeeds when backend returns. |
| 7.3 | Idempotency-key generation on the client (UUIDv4 per logical action). Server stores key → response; replays return original. | Replay test: same key returns same body and status. |
| 7.4 | Add concurrent-submission protection: intake POST checks for existing intake; replays via idempotency key, distinct submissions return clear 409. | Two parallel intake POSTs from different keys return one success, one explicit "intake already submitted" 409. |

### Phase 8 — Already-submitted re-entry

| # | Step | Verify |
|---|---|---|
| 8.1 | Build the `already_submitted` render block: timestamp, doc checklist (read-only with status), signatures list, contact-office CTA. Localized in all three languages. | Manual: finalize, then reload — see read-only confirmation. |
| 8.2 | Ensure no mutation endpoints accept writes when `submitted_at IS NOT NULL` (server-side guard, not just client). | Direct curl POST to upload/signature endpoints after finalize returns 409. |

### Phase 9 — End-to-end verification

| # | Step | Verify |
|---|---|---|
| 9.1 | Build `tests/e2e/pbv-tenant-flow.spec.ts` covering the full happy path. | Test passes in CI. |
| 9.2 | Add 2-adult variant test. | Passes. |
| 9.3 | Add rejection round-trip test (admin rejects with key → tenant sees localized reason → re-uploads → admin approves). | Passes. |
| 9.4 | Add re-entry test (finalize → reload → confirm read-only state). | Passes. |
| 9.5 | Add idempotency replay test (submit twice with same key → identical response). | Passes. |
| 9.6 | Manual: complete the flow on a real phone (Safari iOS + Chrome Android) with throttled network. | No console errors; canvas signing works on touch; no stuck states. |
| 9.7 | Category grouping renders correctly across all three languages on tenant and admin surfaces with Richie Rich's 35-doc baseline. | Visual diff or screenshot review. |

---

## Verification

### Definition of done

A tenant on a phone, with no staff assistance, can:

1. Land on the magic link.
2. Choose a language.
3. Complete intake.
4. See a populated, accurate list of required documents.
5. Upload every required document with retry on network failure.
6. See clear, localized rejection reasons if any doc is rejected.
7. Re-upload rejected documents.
8. Sign every required signature in-app (with multi-adult handoff if applicable).
9. Hit "submit" and reach a confirmation screen.
10. Reload the page and see a read-only confirmation, with no path back to mutation.

The server reflects this:

1. `pbv_full_applications.submitted_at` is set.
2. `application_documents` has correct status per uploaded file.
3. `application_events` has per-phase transition rows.
4. `tenant_idempotency_keys` correctly replays duplicate POSTs.
5. No row in any table has `form_submission_id` written by tenant code (PRD-11a invariant).

---

## Rollback

Each phase is reversible:

| Phase | Rollback |
|---|---|
| 1 | All migrations are additive. Drop columns/tables if reverting. Re-seed migration is idempotent. |
| 2 | `git revert` the finalize endpoint and client changes. `submitted_at` column remains harmless if unused. |
| 3 | Old routes can be restored from git history. Orphan deletions are recoverable. |
| 4 | `category` column is additive; UI grouping reverts to the old `doc_type` grouping (or flat list on tenant side) by reverting the client commit. Column stays in the schema — harmless if unused. |
| 5 | Rejection-reason-key column is additive; free-text reasons still work without templates. |
| 6 | Canvas fix and event logging are independent; revert one without affecting the other. |
| 7 | `tenantFetch` reverts to `fetch`; idempotency key passthrough is no-op on old endpoints. |
| 8 | `already_submitted` render reverts to the existing placeholder block; server guard remains as safety net. |
| 9 | Tests are removable; production code unaffected. |

---

## Open questions

1. **[Unverified]** Does the existing intake POST already seed `application_documents` from `form_document_templates`? Phase 1.2 confirms this by reading the route source.
2. **[Unverified]** Are any admin or staff surfaces calling the orphan `/api/tenant/pbv/[token]/signing` routes? Phase 3.4 grep confirms.
3. **[Unverified]** Does `UploadSignedDialog` have any non-`TenantSigningView` consumer? Phase 3.4 grep confirms.
4. **[Inference]** Backfilling `submitted_at` for historical applications: use computed `next_step === 'complete'` as the backfill predicate. Confirm with one query against current data before applying migration 1.3 to production.
5. **[Speculation]** Whether `application_events` already has a row schema compatible with per-phase transition logging, or whether we need a new column/event_type enum value. Phase 2 implementation confirms.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Single signing modality (canvas only) | Two parallel implementations was the bug, not a feature. Removing reduces surface area. PDF/DocuSign can be a separate PRD if needed. |
| 2026-05-14 | `submitted_at` is the lock, not a derived flag | A persisted invariant eliminates the entire class of "tenant reloaded and re-signed" bugs. |
| 2026-05-14 | Idempotency keys on every tenant write | Mobile network reality. Without this, every Phase 6 retry creates a new submission attempt that races the original. |
| 2026-05-14 | Rejection reasons via key + free-text fallback | Pure free-text is unmaintainable across three languages; pure templates are inflexible. Hybrid lets admin pick from a list 95% of the time, override when needed. |
| 2026-05-14 | Consolidate to `/api/t/[token]/pbv-full-app/*` | Three parallel trees with overlapping responsibility is debt that compounds. Fixed once, locked thereafter. |
| 2026-05-14 | Templates re-seed migration even though source migration exists | Operational reality: source migrations may not be applied. Idempotent re-seed is cheap insurance. |
| 2026-05-14 | E2E test in CI is in scope, not deferred | "Do it right" includes "stays right." A passing test in CI prevents the next regression. |
| 2026-05-14 | Document `category` as a real column, not derived | The SQL-comment-only categories in the seed migration were unactionable from code. A nullable `category` column on `application_documents` plus a NOT NULL `category` on `form_document_templates` gives both surfaces a stable, localizable grouping key without a separate categories table. |
| 2026-05-14 | Five fixed categories (income, assets, medical_childcare, immigration, signed_forms) plus a `custom` bucket | Matches the structure already implicit in `display_order` and the templates migration comments. A separate categories table is overkill — these five are stable HUD-policy-driven groupings. If they need to expand later, the column accepts any string. |
| 2026-05-14 | Range-based backfill once, then explicit category on new templates | Avoids the trap of "what if a future template's display_order lands between ranges." After backfill, the seed file is the source of truth for category, not display_order. |
