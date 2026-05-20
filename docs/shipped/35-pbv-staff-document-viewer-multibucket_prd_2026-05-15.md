# PRD-35 — Staff Document Viewer: Multi-Bucket Resolution

**Date:** 2026-05-15
**Author:** Claude (cross-reference of April 2026 audit + tenant-side fix)
**Branch:** `fix/admin-document-viewer-multibucket-35`
**Status:** Shipped 2026-05-16. F5 (explicit storage_bucket column) deemed unnecessary — all docs use `form-submissions` bucket. Pre-existing defect fixed: Stanton staff document viewer was calling non-existent endpoint.
**Reopens:** AUDIT_REPORT.md (April 8, 2026), Critical Issue #1 — never closed

---

## Problem Statement

The April 2026 audit (`AUDIT_REPORT.md:14-37`) flagged a HIGH PRIORITY defect: staff cannot see uploaded documents in the Review panel because evidence files are stored across **three different storage buckets**, but the file viewer only checks one.

| Bucket | Purpose | Access Route |
|---|---|---|
| `submissions` | Tenant onboarding forms (`insurance/`, `signatures/`, `documents/`) | `/api/admin/file?path=` |
| `form-photos` | Individual form submissions (pet exemption, billing dispute, etc.) | Direct Supabase URL |
| `project-evidence` | Project mode task completions | Stored in `task_completions.evidence_url` as public URL |

The root cause:

- `app/api/admin/file/route.ts:27-32` only proxies the `submissions` bucket
- `components/compliance/EvidenceViewer.tsx:42` constructs the proxy URL only for `submissions`
- `project-evidence` URLs go directly to Supabase public URLs, bypassing the proxy entirely (so they may break when the bucket is private)

This was documented in April, classified HIGH PRIORITY, and never fixed. The tenant-side document view fix (PRD-33 F6) introduces signed URLs against `submissions` only — same hole on the tenant side. This PRD addresses both.

---

## Users & Roles

- **Office staff (Will, etc.)** — primary impact. Need to verify uploaded documents to pass/fail compliance tasks.
- **Compliance reviewer** — needs to confirm evidence for HUD audits.
- **Tenant** — already covered by PRD-33 F6 for the `submissions` bucket; this PRD extends to the other buckets if any tenant-uploaded doc lands there.

---

## Closed decisions

- **Approach: bucket-aware resolver, not bucket consolidation.** Migrating files between buckets is out of scope and risky. Build a resolver that knows which bucket a given doc lives in, given its `doc_type` or `category`.
- **All access goes through the API proxy** for consistency, audit logging, and to avoid public-URL gotchas. Even `project-evidence` (currently public-URL) gets proxied.
- **Signed URLs (5-minute TTL) for both staff and tenant.** No more direct public URLs in admin UI either.

---

## Decisions still open — resolve during build

- **Bucket-of-record mapping**: where does a given `application_documents` row live? Is the bucket implicit in `doc_type` / `category`, or is there an explicit column? Audit during build. If implicit, document the mapping; if missing, add a `storage_bucket` column on `application_documents` and backfill from existing data.
- **`form_submissions` evidence**: per April audit Issue #4, `form_submissions` is a parallel table that doesn't surface in the compliance matrix. Out of scope for this PRD; logged as a follow-up.
- **Proxy auth for tenant-side**: tenant requests already authenticate via the token-scoped routes (`/api/t/[token]/...`). Staff requests authenticate via `iron-session`. The new resolver lives behind both. Confirm the resolver itself is bucket-agnostic and reusable.

---

## Core Features

### F1: Bucket-aware file resolver

- New file: `lib/storage/resolveBucket.ts`
- Single function: `resolveBucket(doc: { doc_type: string; category?: string; storage_bucket?: string }): 'submissions' | 'form-photos' | 'project-evidence'`.
- If `doc.storage_bucket` is set (per the optional new column), use it directly.
- Else: lookup by `doc_type`/`category`. Default `submissions` if unmatched (current behavior).
- Unit tests for every known doc_type → expected bucket mapping.

### F2: Admin file route resolves any bucket

- File: `app/api/admin/file/route.ts:27-32`
- Replace hardcoded `.from('submissions')` with `.from(resolveBucket(doc))`. Look up the doc by id, derive bucket, sign URL, return.
- Acceptance: requesting any document via `/api/admin/file?id=<doc_id>` returns the file regardless of which bucket it lives in.

### F3: EvidenceViewer uses the proxy for every bucket

- File: `components/compliance/EvidenceViewer.tsx:42`
- Stop constructing direct Supabase URLs. Always go through `/api/admin/file?id=...`.
- Acceptance: viewing any task completion evidence in admin renders the file via the proxy.

### F4: Tenant-side `/api/t/[token]/pbv-full-app/documents` uses the resolver

- File: `app/api/t/[token]/pbv-full-app/documents/route.ts` GET handler (signed-URL generation introduced in PRD-33 F6).
- Replace hardcoded `from('submissions')` with `from(resolveBucket(doc))`. Same signed-URL generation.
- Acceptance: a tenant-uploaded doc that landed in `form-photos` (e.g., from a pet exemption flow) is viewable from the tenant's documents page.

### F5: (Optional) Add `storage_bucket` column to `application_documents`

- Only if F1's lookup-by-doc_type proves brittle.
- Migration adds the column nullable. Backfill from a one-time inspection script that lists every bucket and matches files to doc rows.
- New uploads must set the column at write time.

---

## Data Model

Likely no schema changes if F1's lookup map is reliable. If F5 is needed:

```sql
ALTER TABLE application_documents
  ADD COLUMN storage_bucket TEXT NULL;

-- Backfill via scripts/backfill-storage-bucket.ts (separate from migration)
```

---

## Integration Points

- `lib/storage/resolveBucket.ts` (new) — central util
- `app/api/admin/file/route.ts` — staff proxy
- `components/compliance/EvidenceViewer.tsx` — staff UI
- `app/api/t/[token]/pbv-full-app/documents/route.ts` — tenant proxy (depends on PRD-33 F6 landing first)
- All future code that signs URLs for application docs must use `resolveBucket`

---

## Implementation Phases

**Phase 1 — Resolver + admin (target: half day)**
- F1: resolver + unit tests
- F2: admin file route uses resolver
- F3: EvidenceViewer uses proxy

**Phase 2 — Tenant + cleanup (target: quarter day)**
- F4: tenant documents endpoint uses resolver
- Sweep for any remaining hardcoded `.from('submissions')` in API routes; replace
- Manual regression: open one doc per known bucket from both admin UI and tenant UI

---

## Acceptance — what "done" looks like

- Staff can open every uploaded document from the compliance Review panel, regardless of which bucket it lives in.
- Tenant can view every document they uploaded, regardless of bucket.
- Grep for `from('submissions')` in `app/` returns zero hardcoded references; all go through `resolveBucket`.
- Unit tests cover the bucket mapping for every known `doc_type`.
