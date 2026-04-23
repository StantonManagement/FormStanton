# Phase 1 — Schema Decision: Per-Document Review
**Date:** April 23, 2026  
**Phase:** 1 — Schema Design (no migration applied)

---

## Three Alternatives Evaluated

### Alternative 1 — Child Table Model (PRD proposal)

Three new tables:
- `form_document_templates` — one row per `(form_id, doc_type)`; declares expected documents for a form
- `form_submission_documents` — one row per `(submission_id, doc_type)`; current document state
- `form_submission_document_revisions` — append-only; one row per file uploaded per document

Plus three new columns on `form_submissions`:
- `review_granularity text` — `'atomic' | 'per_document'`
- `document_review_summary jsonb` — denormalized rollup (counts only; never queried for structure)
- `tenant_access_token text unique` — magic-link token for tenant status page

**Query patterns:**
```sql
-- List all documents for a submission (admin detail view)
SELECT fsd.*, fsdr.*
FROM form_submission_documents fsd
LEFT JOIN form_submission_document_revisions fsdr
  ON fsdr.document_id = fsd.id AND fsdr.revision = fsd.revision
WHERE fsd.form_submission_id = $1
ORDER BY fsd.display_order;

-- All submissions with at least one rejected document (list view filter)
SELECT DISTINCT fs.id FROM form_submissions fs
JOIN form_submission_documents fsd ON fsd.form_submission_id = fs.id
WHERE fsd.status = 'rejected';

-- Bulk export: get approved docs for N submissions
SELECT fs.building_address, fs.tenant_name, fsd.*
FROM form_submission_documents fsd
JOIN form_submissions fs ON fs.id = fsd.form_submission_id
WHERE fsd.form_submission_id = ANY($1) AND fsd.status IN ('approved', 'waived');

-- Seed documents at submission creation from template
INSERT INTO form_submission_documents (form_submission_id, doc_type, label, required, display_order)
SELECT $1, doc_type, label, required, display_order
FROM form_document_templates WHERE form_id = $2;
```

**Indexing:** `form_submission_id`, `status`, `(form_submission_id, status)` cover all access patterns.

**RLS:** Service-role only (consistent with all existing tables). Tenant access via API routes with service-role key.

**Section 8 reuse test:** Adding Section 8 recertification requires only a new `INSERT INTO form_document_templates` seed. Zero schema changes to the foundation. ✓

**Concurrent update risk:** Two staff members reviewing different documents simultaneously write to different `form_submission_documents` rows — no contention. ✓

---

### Alternative 2 — JSONB-per-submission

Add a `documents jsonb` column to `form_submissions`:
```json
{
  "paystubs": { "status": "approved", "revision": 2, "file_name": "...", "revisions": [...] },
  "hud-9886a": { "status": "rejected", "rejection_reason": "...", "revisions": [...] }
}
```

**Pros:** No new tables; single-row update for status changes; simple reads on a single submission.

**Cons — disqualifying:**

1. **No indexing on document status.** Querying "all submissions with at least one rejected document" requires a full-table scan with a JSONB containment operator. At 500+ submissions this becomes a performance issue. The list view's "Needs Review" filter relies on this.

2. **Unbounded column growth.** Revision history appends to the JSONB blob for the lifetime of the submission. No natural cap; no ability to archive old revisions without a custom migration.

3. **Concurrent write collision.** If two staff members approve different documents on the same submission simultaneously, the second `UPDATE form_submissions SET documents = $new_blob` overwrites the first. This is a data loss risk with no mitigation short of optimistic concurrency — which adds complexity that the child table model avoids entirely.

4. **PRD anti-slop rule:** "Forbidden: JSONB columns without written justification (default to proper columns)." The `document_review_summary` JSONB column on `form_submissions` is justified (denormalized rollup for list-view rendering, never queried structurally). A full `documents` JSONB column is not justified — the data is structured, relational, and queryable.

5. **Section 8 reuse:** Every consumer of the JSONB shape must know its internal structure. Any schema evolution (adding a field to each document object) requires a data migration over all existing rows rather than an `ALTER TABLE`.

**Verdict: Eliminated.**

---

### Alternative 3 — Polymorphic `reviewable_items` table

```sql
CREATE TABLE reviewable_items (
  id uuid PRIMARY KEY,
  parent_type text NOT NULL,   -- 'form_submission'
  parent_id uuid NOT NULL,     -- form_submissions.id
  item_type text NOT NULL,     -- doc_type slug
  label text NOT NULL,
  status text NOT NULL DEFAULT 'missing',
  ...
);
```

**Pros:** Generic — could theoretically attach review items to any parent entity in the future.

**Cons — disqualifying:**

1. **No FK enforcement.** A polymorphic `parent_id` cannot reference multiple parent tables with a single foreign key constraint. Referential integrity is broken by design.

2. **Query complexity.** Every query must filter by `parent_type = 'form_submission'` in addition to `parent_id`. This is noise that compounds across every API route, every index, and every RLS policy.

3. **Speculative generalization.** The only entities that will need per-document review in this system are `form_submissions` (PBV full application, Section 8 recertification, etc.). All of them use `form_submissions` as the parent. There is no second parent type on the horizon.

4. **Template table becomes awkward.** `form_document_templates` logically belongs to this system regardless. Decoupling it from `form_submission_documents` via a polymorphic table adds join complexity without benefit.

5. **PRD stress test failure.** The stress test is Section 8 recertification — which uses `form_submissions` as its entity. The polymorphic model provides no advantage here; it only complicates the query surface.

**Verdict: Eliminated. Premature abstraction with real costs.**

---

## Decision: Alternative 1 — Child Table Model

**Reasoning:**

The three entities have distinct, non-overlapping lifecycles:
- Templates are seeded once per form type and rarely change
- Document rows are created at submission time and mutate as review progresses
- Revision rows are written once (append-only) and never mutated

Separate tables are the correct representation. The joins are simple and well-indexed. The Section 8 reuse test passes cleanly. RLS is consistent with the existing system. The only cost is the seeding step at submission creation — which is a two-line `INSERT INTO ... SELECT` from the templates table.

The `document_review_summary JSONB` column on the parent `form_submissions` row is the one justified JSONB usage: it denormalizes counts for list-view rendering (e.g., "3/5 approved, 1 rejected") so the list page does not need a JOIN to `form_submission_documents` on every row load.

---

## Columns Requiring Clarification Before Migration

All resolved during Phase 0 checkpoint. Recorded here for migration reference:

| Column | Table | Decision |
|---|---|---|
| `review_granularity` | `form_submissions` | `text NOT NULL DEFAULT 'atomic'`, CHECK `('atomic', 'per_document')` |
| `document_review_summary` | `form_submissions` | `jsonb`, nullable, only populated for per-document submissions |
| `tenant_access_token` | `form_submissions` | `text UNIQUE`, nullable (only set for per-document submissions), no expiration |
| `created_by` | all new tables | `text`, nullable — system sets to `'system'` on seeded rows, staff ID on manual rows |

---

## Display Order Source

`form_submission_documents` needs `display_order` for consistent rendering. This comes from `form_document_templates.display_order` at seeding time and is stored on the document row itself. Rationale: document rows outlive and are independent of templates — if a template is later reordered, existing submission documents should not silently reorder.

---

## `unique(form_submission_id, doc_type)` Constraint

Each submission can have at most one active document row per doc_type. Resubmissions add rows to `form_submission_document_revisions` and update the parent `form_submission_documents` row. This constraint prevents duplicate document rows from seeding bugs.

---

## Rollback Instructions

If the migration causes issues and must be reverted before Phase 3 begins:

```sql
-- Remove new form_submissions columns
ALTER TABLE public.form_submissions
  DROP COLUMN IF EXISTS review_granularity,
  DROP COLUMN IF EXISTS document_review_summary,
  DROP COLUMN IF EXISTS tenant_access_token;

-- Drop new tables (CASCADE handles FKs)
DROP TABLE IF EXISTS public.form_submission_document_revisions CASCADE;
DROP TABLE IF EXISTS public.form_submission_documents CASCADE;
DROP TABLE IF EXISTS public.form_document_templates CASCADE;
```

**Safe to roll back if:** No per-document submissions exist yet (i.e., before the first form is flagged `review_granularity = 'per_document'` and receives a submission). After that point, rollback loses data.
