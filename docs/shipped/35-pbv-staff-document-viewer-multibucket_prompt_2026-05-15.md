# Cursor/Windsurf Prompt — PRD-35: Staff Document Viewer Multi-Bucket Resolution

## Context

The April 2026 audit (`AUDIT_REPORT.md:14-37`) flagged "DOCUMENT VISIBILITY FAILURE — HIGH PRIORITY": the staff-side file viewer only checks the `submissions` bucket, but evidence files live in three different buckets (`submissions`, `form-photos`, `project-evidence`). Staff cannot verify documents → cannot pass/fail compliance tasks.

PRD-33 F6 introduces tenant-side document viewing and hardcodes `submissions`. This PRD generalizes both sides through a bucket-aware resolver.

PRD-33 must land first (so the tenant-side endpoint exists for F4).

Atomic commits per feature.

## Required reading before you start

1. `docs/fullApp-Plan/35-pbv-staff-document-viewer-multibucket_prd_2026-05-15.md` — this PRD
2. `AUDIT_REPORT.md:14-37` — the April finding
3. `app/api/admin/file/route.ts:27-32` — staff proxy, currently hardcodes `submissions`
4. `components/compliance/EvidenceViewer.tsx:42` — staff UI; constructs URLs directly
5. `app/api/t/[token]/pbv-full-app/documents/route.ts` — tenant proxy (post-PRD-33 F6)
6. `lib/supabase.ts` — service role client for signed URLs
7. Any places in `app/api/forms/**/route.ts` that write to `form-photos`
8. Any places that write to `project-evidence` — search for `from('project-evidence')`

## Closed decisions

- Approach: bucket-aware resolver, not file migration
- All access through API proxy with signed URLs (5 min TTL)
- Staff and tenant share the same resolver

## Decisions still open — resolve during build, document in build report

- **Bucket-of-record mapping**: is bucket implicit in `doc_type`/`category`, or do we need an explicit `storage_bucket` column on `application_documents`? Audit during F1; decide based on whether the implicit mapping is reliable.
- **Backfill scope**: if you add `storage_bucket` column, backfill via inspection script. Confirm scope with Alex.
- **`form_submissions` table** (April audit issue #4): out of scope for this PRD. Open as separate ticket if needed.

## Build this pass

### Phase 1 — Resolver + admin

1. **F1** — Create `lib/storage/resolveBucket.ts`. Single exported function `resolveBucket(doc: { doc_type: string; category?: string; storage_bucket?: string | null }): 'submissions' | 'form-photos' | 'project-evidence'`. Lookup table at the top of the file; default to `submissions` for unmatched doc_types (current behavior). Unit tests for every known doc_type → expected bucket. Source the doc_type list from `lib/pbv/intake-schema.ts` and any form-submissions code paths.
   Commit: `feat(storage): bucket-aware resolver with unit tests (F1)`

2. **F2** — `app/api/admin/file/route.ts:27-32`: replace hardcoded `from('submissions')` with `from(resolveBucket(doc))`. Look up the doc by id (probably already done; if not, add it). Sign URL with 300s TTL. Return as a redirect or proxy stream — match existing behavior.
   Commit: `fix(admin-file): resolve bucket per document for proxy (F2)`

3. **F3** — `components/compliance/EvidenceViewer.tsx:42`: stop building direct Supabase URLs. Always go through `/api/admin/file?id=<doc.id>` (or whatever the proxy contract is). Manual smoke: open one doc per known bucket from the compliance Review panel.
   Commit: `refactor(evidence-viewer): always use admin file proxy (F3)`

### Phase 2 — Tenant + cleanup

4. **F4** — `app/api/t/[token]/pbv-full-app/documents/route.ts` (introduced by PRD-33 F6): replace hardcoded `from('submissions')` with `from(resolveBucket(doc))` when generating signed URLs.
   Commit: `fix(pbv-tenant-docs): resolve bucket per document for signed URLs (F4)`

5. **Codebase sweep** — grep `from\(['"\`]submissions['"\`]\)` and `from\(['"\`]form-photos['"\`]\)` and `from\(['"\`]project-evidence['"\`]\)` across `app/`. Any read that happens AFTER fetching a document row should go through `resolveBucket`. Writes can stay bucket-specific (you know which bucket you're putting a new file in). Document the sweep in commit body.
   Commit: `refactor(storage): centralize bucket reads through resolveBucket (sweep)`

6. **(Optional) F5** — If F1's lookup proves brittle (e.g., legacy docs with ambiguous doc_type), add `storage_bucket TEXT NULL` to `application_documents`, backfill via `scripts/backfill-storage-bucket.ts` (dry-run + commit modes per PRD-34 F6 pattern). Update writers to set the column at upload time. Update `resolveBucket` to prefer the column when set.
   Commit: `feat(storage): explicit storage_bucket column with backfill (F5)` — only if needed

### Verification

- Staff: open one document per bucket from the compliance Review panel; all should render
- Tenant: upload a doc, view it; one of each common path
- Grep `from('submissions')` in `app/`: should be zero results outside writes and the resolver itself

## Build report requirements

- Decision on F5 (column or no column) with reasoning
- List of files touched in the sweep
- Test matrix: bucket × doc_type → opens correctly (yes/no)
- Backfill output if F5 ran
