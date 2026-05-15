# Build Report — PRD-14 Phase 4: Document Categorization

**Date:** 2026-05-14
**Scope:** Phase 4 only (Phases 1, 2, 3, 5, 6, 7, 8, 9 are separate PRs)

---

## Migration Applied

**File:** `supabase/migrations/20260514205000_pbv_document_categories.sql`

**Applied to:** Tenant Communication project (lieeeqqvshobnqofcdac)

**Result:** SUCCESS

**Steps executed:**
1. Added `category` column to `form_document_templates` (TEXT, NOT NULL after backfill)
2. Added `category` column to `application_documents` (TEXT, nullable for custom docs)
3. Backfilled templates using display_order ranges:
   - `<110` → `income`
   - `110-199` → `assets`
   - `200-299` → `medical_childcare`
   - `300-399` → `immigration`
   - `≥400` → `signed_forms`
4. Backfilled `application_documents` by joining to templates on `doc_type`
5. Set `category = 'custom'` for application docs with no matching template
6. Applied `NOT NULL` constraint to `form_document_templates.category`
7. Created index `idx_application_documents_anchor_category`

---

## Post-Migration Category Counts

### form_document_templates (pbv-full-application)

| Category | Count |
|----------|-------|
| income | 10 |
| assets | 5 |
| medical_childcare | 3 |
| immigration | 2 |
| signed_forms | 14 |
| **Total** | **34** |

Note: 3 additional templates exist for `test-foundation-review` form with `category = 'custom'`.

### application_documents (pbv_full_application anchor)

| Category | Count |
|----------|-------|
| income | 13 |
| assets | 9 |
| medical_childcare | 3 |
| immigration | 2 |
| signed_forms | 37 |
| custom | 5 |
| **Total** | **69** |

The 5 `custom` category documents are:
- `bank_statement` (1)
- `birth_certificate` (1)
- `government_id` (1)
- `pay_stub` (1)
- `tax_return` (1)

These are legacy custom documents that don't match PBV template doc_types.

---

## Code Changes

### Commit 2 — Templates Seed + Intake POST

**File:** `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`
- Added `category` column to INSERT column list
- Added explicit category value to all 34 VALUES rows
- Added `category = EXCLUDED.category` to ON CONFLICT DO UPDATE

**File:** `app/api/t/[token]/pbv-full-app/route.ts`
- Added `category: template.category` to both docRows.push calls (submission-level path and per-person path)

### Commit 3 — Translations

**File:** `lib/pbvFullAppTranslations.ts`
- Added to `PbvFullAppStrings` interface:
  - `category_income`
  - `category_assets`
  - `category_medical_childcare`
  - `category_immigration`
  - `category_signed_forms`
  - `category_custom`

- Added translations for `en`, `es`, `pt`:
  - **en:** Income Verification, Banking & Assets, Medical & Childcare, Citizenship & Immigration, Signed Forms, Additional Documents
  - **es:** Verificación de Ingresos, Cuentas y Bienes, Médico y Cuidado Infantil, Ciudadanía e Inmigración, Formularios Firmados, Documentos Adicionales
  - **pt:** Verificação de Renda, Contas e Bens, Médico e Creche, Cidadania e Imigração, Formulários Assinados, Documentos Adicionais

### Commit 4 — Admin UI (StantonReviewSurface)

**File:** `components/review/StantonReviewSurface.tsx`
- Added `category?: string` to Doc interface
- Added fixed category order: `['income', 'assets', 'medical_childcare', 'immigration', 'signed_forms']`
- Added `CATEGORY_LABELS` mapping for localized headers
- Replaced `doc_type`-based grouping with `category`-based grouping
- Documents sorted within each category by `(display_order, person_slot)`
- Custom docs (doc_type === 'custom') still render in separate "Additional Documents" section

### Commit 5 — Tenant UI (TenantDocumentUpload)

**File:** `components/pbv/TenantDocumentUpload.tsx`
- Added `category?: string` and `display_order?: number` to Document interface
- Added category translations to local translations object (en/es/pt)
- Added fixed category order: `['income', 'assets', 'medical_childcare', 'immigration', 'signed_forms', 'custom']`
- Added collapsible section headers per category (default expanded)
- Documents sorted within each category by `(display_order, person_slot)`
- Added category progress counter `(uploaded/total)` in each section header

### API Updates

**File:** `app/api/pbv-full-app/[token]/documents/route.ts`
- Added `category, display_order` to SELECT
- Added `category, display_order` to mapped response

**File:** `app/api/admin/pbv/full-applications/[id]/route.ts`
- Added `category` to SELECT

---

## Open Questions Decisions

### Question 1 — Spanish/Portuguese phrasing

**Decision:** Used the suggested values from PRD-14 Phase 4.5. Verified against existing conventions in `pbvFullAppTranslations.ts`:
- "Cuentas" matches existing usage (section3_title: "Activos y Cuenta Bancaria")
- "Bienes" matches asset terminology
- "Cuidado Infantil" matches the tone of the document
- "Ciudadanía" matches the citizenship section title

No conflicts found. All translations align with existing phrasing conventions.

### Question 2 — Admin custom doc category

**Decision:** Admin-added custom docs get `category = 'custom'` at creation. The migration handles this by:
- Setting `category = 'custom'` for any `application_documents` rows that don't match a template via the join
- Leaving `application_documents.category` nullable to permit NULL values if needed
- The UI treats both `NULL` and `'custom'` as the "Additional Documents" section

Rationale: Explicit `'custom'` value is clearer than NULL for data analysis and debugging.

### Question 3 — External API consumers

**Verified:** `grep -r "pbv-full-app" --include="*.ts" --include="*.tsx" app/ lib/ components/`

No external consumers (HACH portal, mobile apps) found in the codebase. The new `category` and `display_order` fields are additive and won't break existing clients that ignore unknown fields.

---

## Verification Checklist

| Check | Status |
|-------|--------|
| Migration applies cleanly | ✅ |
| Templates: 5 categories, no NULLs, sum = 34 | ✅ |
| Application docs: 6 categories (including custom), no NULLs | ✅ |
| Re-run migration is idempotent | ✅ (tested via mcp0_apply_migration) |
| Seed file updated with explicit categories | ✅ |
| Intake POST writes category | ✅ |
| Translations added (6 keys × 3 languages) | ✅ |
| Type-check passes | ✅ |
| Admin UI groups by category | ✅ |
| Tenant UI groups by category | ✅ |
| API routes return category | ✅ |
| Custom docs section preserved | ✅ |
| No hardcoded English strings in UI | ✅ |

---

## Rollback Instructions

If reverting Phase 4:

```sql
-- Drop the index
DROP INDEX IF EXISTS idx_application_documents_anchor_category;

-- Drop the category columns
ALTER TABLE public.form_document_templates DROP COLUMN IF EXISTS category;
ALTER TABLE public.application_documents DROP COLUMN IF EXISTS category;
```

---

## Notes for Phase 5 Author

1. **Category is now the canonical grouping key** — don't derive from display_order
2. **Custom docs have `category = 'custom'` or `category IS NULL`** — handle both in any future queries
3. **The index `idx_application_documents_anchor_category`** optimizes tenant and admin grouping queries
4. **Translation keys added:** `category_income`, `category_assets`, `category_medical_childcare`, `category_immigration`, `category_signed_forms`, `category_custom`
5. **Template count is 34, not 31** — the PRD said 31 but the actual seed has 34 (including `no_child_support_affidavit` and conditional docs)

---

## Build Pass Complete

All 5 commits implemented and verified. Phase 4 is ready for merge pending your review.
