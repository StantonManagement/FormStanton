# PRD-16 — PBV Tenant Orphan Removal & API Tree Consolidation

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Debt retirement / cleanup
**Sequence:** Spawned from PRD-14 Phase 3.
**Depends on:** None. Parallel-safe with PRD-15.
**Blocks:** Nothing strictly, but every later PRD that touches tenant API routes (PRD-19 resilience especially) benefits from the consolidation landing first.

---

## Problem Statement

Three parallel token-resolution API trees coexist with overlapping responsibility:

- `/api/pbv-full-app/[token]/...` (the path `TenantDocumentUpload` currently calls)
- `/api/tenant/pbv/[token]/...` (the path the orphan `/signing` subpage calls)
- `/api/t/[token]/pbv-full-app/...` (the path the main page uses for intake, signatures, and now finalize per PRD-15)

A separate orphan subpage at `app/pbv-full-app/[token]/signing/` ships a `TenantSigningView` component with a hard-disabled "Sign in-app" button (tooltip "Coming soon — in-app signing capability"). The canonical in-app signing lives on the main page at `pageState === 'signatures'` using `react-signature-canvas`. The orphan is a parallel implementation that confuses anyone who lands there.

This PRD consolidates all tenant-facing API routes under `/api/t/[token]/pbv-full-app/*` and deletes the orphan signing surface and its backing routes.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| Main page POSTs to `/api/t/[token]/pbv-full-app/signatures` | Read | Verified |
| `TenantDocumentUpload` fetches `/api/pbv-full-app/${token}/documents` | Read `components/pbv/TenantDocumentUpload.tsx:122` | Verified |
| Orphan subpage at `app/pbv-full-app/[token]/signing/page.tsx` | Read | Verified |
| `TenantSigningView` calls `/api/tenant/pbv/${token}/signing` | Read `components/tenant-signing/TenantSigningView.tsx:49` | Verified |
| Whether `UploadSignedDialog` or `TenantSigningView` has any other consumer | [Unverified] — grep before deletion | Confirm in build phase |

---

## Key decisions

### 1. `/api/t/[token]/pbv-full-app/*` is canonical for tenant access

All tenant reads and writes resolve under this tree. The other two trees are migrated or deleted.

### 2. The main-page canvas signing flow is the only signing implementation

`/signing` subpage and `TenantSigningView` are deleted, not refactored. PRD-14 audit decision: two parallel implementations was the bug, not a feature.

### 3. The magic-link URL points to the main page, never `/signing`

Audit the SMS / email template source. If it references `/signing` or any other orphan, patch it.

### 4. Old routes get hard-redirect or hard-delete, not silent removal

For at least one release cycle, hitting the old paths should return a 410 Gone with a redirect URL in the body, or a 301 to the canonical path. Silent 404s confuse anyone with a cached link.

---

## Scope

### What this PRD does

1. Creates canonical routes under `/api/t/[token]/pbv-full-app/documents/...` (GET and upload).
2. Updates `TenantDocumentUpload.tsx` and any other tenant-side caller to use the canonical paths.
3. Deletes the orphan `/signing` subpage, `TenantSigningView`, `UploadSignedDialog` (if unused elsewhere), and the `/api/tenant/pbv/[token]/signing/*` routes.
4. Deletes (or 301-redirects) the old `/api/pbv-full-app/[token]/documents/*` routes.
5. Audits the magic-link / SMS template source to confirm the tenant URL.
6. Grep audit: zero references to deleted paths or components in the codebase after the PR.

### What this PRD does NOT do

- Touch admin routes (`/api/admin/pbv/...`).
- Change document or signature data shapes (covered by PRD-15 and PRD-17).
- Implement any new signing modality.

---

## Affected files

### New routes (copies of old, with canonical path)

| Old | New |
|---|---|
| `app/api/pbv-full-app/[token]/documents/route.ts` | `app/api/t/[token]/pbv-full-app/documents/route.ts` |
| `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` | `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/upload/route.ts` |

### Deleted (after grep audit confirms no remaining consumers)

| File | Why |
|---|---|
| `app/pbv-full-app/[token]/signing/page.tsx` | Orphan |
| `components/tenant-signing/TenantSigningView.tsx` | Only consumed by orphan |
| `components/signing/UploadSignedDialog.tsx` | [Unverified] grep before delete |
| `app/api/tenant/pbv/[token]/signing/route.ts` | Backs orphan |
| `app/api/tenant/pbv/[token]/signing/[signatureId]/upload/route.ts` | Backs orphan |
| `app/api/pbv-full-app/[token]/documents/route.ts` | Migrated |
| `app/api/pbv-full-app/[token]/documents/[doc_row_id]/upload/route.ts` | Migrated |

### Modified client files

| File | Change |
|---|---|
| `components/pbv/TenantDocumentUpload.tsx:122` | Update fetch URL to `/api/t/${token}/pbv-full-app/documents` |
| `components/pbv/TenantDocumentUpload.tsx` upload call | Update fetch URL to canonical upload path |
| Magic-link / SMS template source | Confirm URL is `/pbv-full-app/<token>` with no suffix |

---

## Phases

### Phase 1 — Create canonical routes

| # | Step | Verify |
|---|---|---|
| 1.1 | Copy `documents/route.ts` (GET) to the new path. Identical behavior. | Curl both old and new routes against a real token — identical response bodies. |
| 1.2 | Copy `documents/[doc_row_id]/upload/route.ts` (POST) to the new path. | Upload a test file against the new route — succeeds. |

### Phase 2 — Update callers

| # | Step | Verify |
|---|---|---|
| 2.1 | Update `TenantDocumentUpload.tsx` fetch and upload URLs to canonical paths. | Browser DevTools network tab shows tenant page hitting only `/api/t/...` paths. |
| 2.2 | Grep the entire repo for `/api/pbv-full-app/[token]` and `/api/tenant/pbv/[token]/signing`. List every consumer. Update each. | Grep returns zero results outside the files marked for deletion. |

### Phase 3 — Orphan grep audit + deletion

| # | Step | Verify |
|---|---|---|
| 3.1 | Grep for `TenantSigningView` import. Confirm only the orphan page uses it. | If any other consumer found: STOP and post in chat. |
| 3.2 | Grep for `UploadSignedDialog` import. Confirm only `TenantSigningView` uses it. | If any other consumer: keep the file, document why. |
| 3.3 | Delete the orphan files listed above. | `npm run build` passes. `next dev` boots without route warnings. |
| 3.4 | Add a 301 redirect or 410 Gone response from the old API paths (optional but recommended). If choosing hard delete: confirm no cached links from outbound communications could still hit them. | Curl the old path → either 301 to canonical or 410. |

### Phase 4 — Magic-link audit

| # | Step | Verify |
|---|---|---|
| 4.1 | Find the source of the tenant magic-link URL. Likely in `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts` or similar. | Read the template string. |
| 4.2 | Confirm URL is `/pbv-full-app/<token>` with no `/signing` suffix. Patch if wrong. | Send a test SMS / inspect outbound payload. |

### Phase 5 — Verification

| # | Step | Verify |
|---|---|---|
| 5.1 | Full tenant flow walkthrough on a fresh app. All requests in DevTools hit only `/api/t/...`. | Pass. |
| 5.2 | Direct navigate to `/pbv-full-app/<token>/signing` returns 404 (Next.js default after deletion). | Pass. |
| 5.3 | Grep for deleted file basenames anywhere in repo — zero hits except in git history. | Pass. |

---

## Rollback

- New routes: deletable. Callers can be reverted to the old paths via revert.
- Orphan deletion: recoverable from git history.
- Magic-link patch: revert the template change.

---

## Open questions

1. **[Unverified]** Is `UploadSignedDialog` used by any non-orphan code? Grep before deleting.
2. **[Speculation]** Whether to keep a 301-redirect on the old API paths for one release cycle, or hard-delete. Recommendation in the prompt is 301 for safety; user may choose hard delete.
3. **[Unverified]** The exact location of the magic-link URL template. Could be in the admin send-sms route, or in a notifications/ library. Phase 4.1 finds it.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Delete orphan `/signing` rather than fix its disabled button | PRD-14 audit established two implementations was the problem to remove, not preserve. |
| 2026-05-14 | 301 redirect (not hard 404) on deprecated API paths | Cached SMS links may still hit them. A redirect preserves access; the next message uses the canonical path. |
| 2026-05-14 | Magic-link audit is in scope | One template patch is cheap insurance against future tenants landing on a dead orphan. |
