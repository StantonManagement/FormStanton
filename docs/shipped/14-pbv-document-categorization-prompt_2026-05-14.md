# Cursor Prompt — PRD-14 Phase 4: Document Categorization

**PRD:** `docs/14-pbv-tenant-flow-go-live-fixes_prd_2026-05-14.md` (read end-to-end; Phase 4 is the scope of this build pass)
**Build report (you create this):** `docs/build-reports/14-document-categorization-build-report_2026-05-14.md`
**Scope:** PRD-14 Phase 4 only — do NOT touch Phases 1, 2, 3, 5, 6, 7, 8, or 9 in this pass. They are separate PRs.

---

## Context

Both the tenant-facing `TenantDocumentUpload` (flat list of 35 items) and the admin-facing `StantonReviewSurface` (currently grouped by raw `doc_type` slug — produces 34 single-row sections with machine-readable names) render the PBV full application's document checklist badly because the data has no `category` field.

The templates seed migration (`supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`) groups the 31 templates into five logical buckets via SQL comments and `display_order` ranges, but those groupings live nowhere in the data. This build pass makes those groupings real, backfills existing data, and updates both UI surfaces to render localized category sections.

The PRD is the source of truth. This prompt directs implementation.

---

## Required reading before you start

1. **`docs/14-pbv-tenant-flow-go-live-fixes_prd_2026-05-14.md`** — entire document. Phase 4 is binding scope; the "Decisions log" entries on categorization are binding decisions.
2. **`docs/verification-methodology_2026-05-13.md`** — test standards. Mandatory.
3. **`supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`** — current templates seed. Comments at lines 25, 110, 158, 187, 207 document the intended categories. The `display_order` values encode the groupings: <110 income, 110-199 assets, 200-299 medical_childcare, 300-399 immigration, ≥400 signed_forms.
4. **`app/api/t/[token]/pbv-full-app/route.ts`** — intake POST handler. Lines ~435-505 read templates and insert `application_documents` rows. You add `category: template.category` to the insert payload.
5. **`app/api/t/[token]/pbv-full-app/documents/route.ts`** (or whichever endpoint currently serves tenant docs — confirm before editing) AND `app/api/admin/pbv/full-applications/[id]/route.ts` — documents API. You add `category` to the response payload.
6. **`components/review/StantonReviewSurface.tsx`** lines 384-393 — current grouping by `doc_type`. You replace with grouping by `category`.
7. **`components/pbv/TenantDocumentUpload.tsx`** line 259 — current flat render. You replace with category-grouped render.
8. **`lib/pbvFullAppTranslations.ts`** — translation conventions. Match the existing tone before adding the 6 × 3 new keys.
9. **The live DB state** — Richie Rich has 35 docs already. Backfill must not corrupt them.

---

## Closed decisions (do not relitigate)

Per PRD-14 "Key decisions" and "Decisions log":

1. **`category` is a real column on both tables.** Not derived at read time. Not a join through a separate categories table.
2. **Five fixed category keys** plus one `custom` bucket: `income`, `assets`, `medical_childcare`, `immigration`, `signed_forms`, `custom`. No additions in this PR.
3. **Range-based backfill is one-time.** After Phase 4 ships, the templates seed file is the source of truth for `category` on new templates. Range-based inference is not a runtime fallback.
4. **`form_document_templates.category` is `NOT NULL` after backfill.** `application_documents.category` stays nullable to permit admin-added custom docs (`category='custom'` or `NULL`).
5. **Within each category, sort by `(display_order, person_slot)`.** No additional sort columns.
6. **Tenant and admin surfaces both group by category.** No "flat for tenant, grouped for admin" split.
7. **Default render is expanded.** Collapsible is OK for tenant if it improves mobile UX, but no collapsed-by-default sections.

---

## Decisions still open — confirm before coding the affected phase

1. **Spanish/Portuguese category labels.** Phase 4.5 of the PRD lists suggested values, but I haven't confirmed them against the existing translation conventions in `pbvFullAppTranslations.ts`. **Read the existing es/pt translations first.** If there's an established phrasing for "Citizenship", "Banking", "Assets", or "Medical" in that file, match it. If you change any of the suggested labels, post the diff in chat for sign-off before committing.

2. **`application_documents.category` for admin-added custom docs.** Two options: (a) admin docs get `category='custom'` at creation, (b) admin docs get `NULL` and the UI treats `NULL` as `custom`. Pick one, document the choice in the build report, apply consistently across the migration, intake POST, and admin custom-doc creation path. If unclear which path admins currently use to add custom docs, post the location in chat before deciding.

3. **API response — backward compat.** If any external consumer (HACH portal, mobile?) reads the documents endpoint, the new `category` field is additive and should not break them. Confirm by grep before assuming.

---

## Build this pass

Five units. Each is a separate commit in the same PR. Do not merge units across commits.

### Commit 1 — Migration + backfill

Create `supabase/migrations/20260514205000_pbv_document_categories.sql`:

```sql
-- PRD-14 Phase 4: add category column to form_document_templates and application_documents
-- and backfill from the existing display_order ranges in the PBV templates seed.

ALTER TABLE public.form_document_templates ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.application_documents   ADD COLUMN IF NOT EXISTS category TEXT;

-- Backfill templates (form_id-scoped — does not touch templates for other forms)
UPDATE public.form_document_templates SET category = CASE
  WHEN display_order <  110 THEN 'income'
  WHEN display_order <  200 THEN 'assets'
  WHEN display_order <  300 THEN 'medical_childcare'
  WHEN display_order <  400 THEN 'immigration'
  ELSE                            'signed_forms'
END
WHERE form_id = 'pbv-full-application' AND category IS NULL;

-- Backfill application_documents by joining to its template
UPDATE public.application_documents ad
SET category = t.category
FROM public.form_document_templates t
WHERE ad.anchor_type = 'pbv_full_application'
  AND ad.category IS NULL
  AND t.form_id   = 'pbv-full-application'
  AND t.doc_type  = ad.doc_type;

-- Lock the templates column. Application docs stay nullable for custom admin-added docs.
ALTER TABLE public.form_document_templates ALTER COLUMN category SET NOT NULL;

-- Optional: index for grouping query patterns (tenant + admin both group by category)
CREATE INDEX IF NOT EXISTS idx_application_documents_anchor_category
  ON public.application_documents (anchor_type, anchor_id, category, display_order, person_slot);
```

**Done when:**
- Migration applies cleanly on a fresh DB and on a DB that already has the data.
- `select category, count(*) from form_document_templates where form_id='pbv-full-application' group by category` returns 5 rows, no NULLs, summing to 31.
- For Richie Rich (`anchor_type='pbv_full_application'`, anchor_id = his app), `select category, count(*) from application_documents where anchor_id='<richie>' group by category` returns 5 rows summing to 35, no NULLs.
- Re-running the migration is a no-op. Idempotent.
- Inverse rollback documented in the build report: `ALTER TABLE ... DROP COLUMN category` for both tables. (Don't ship the inverse migration unless asked — document it in case.)

### Commit 2 — Templates seed update + intake POST

- Update `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql`: add `category` to the column list and a literal value to every VALUES row. This is documentation/source-of-truth alignment, NOT an actual data change (the rows already have categories from Commit 1's UPDATE). Future fresh DBs need the seed to ship categories directly.
  - Add `category` to the `ON CONFLICT ... DO UPDATE SET` clause as well.
- Update `app/api/t/[token]/pbv-full-app/route.ts` intake POST handler around lines 463-498: add `category: template.category` to both `docRows.push(...)` calls (submission-level path and per-person path).
- Update the templates `SELECT *` at line ~437 — confirm `*` picks up the new column. If the route uses an explicit column list anywhere, add `category`.

**Done when:**
- Submit a fresh test intake (new app, fresh token); query the resulting `application_documents` rows; every row has a non-null `category`.
- Submit intake on a DB where the templates `category` column is NOT NULL with data; no errors. Submit on a fresh DB after Commit 2's seed change runs; no errors.
- Grep confirms intake POST writes `category` on every code path that inserts into `application_documents`.

### Commit 3 — Translations

Add to `lib/pbvFullAppTranslations.ts` under each of `en`, `es`, `pt`:

- `category_income`
- `category_assets`
- `category_medical_childcare`
- `category_immigration`
- `category_signed_forms`
- `category_custom`

**Suggested values** (verify against existing translation conventions in the file — match the tone of nearby strings):

| key | en | es | pt |
|---|---|---|---|
| `category_income` | Income Verification | Verificación de Ingresos | Verificação de Renda |
| `category_assets` | Banking & Assets | Cuentas y Bienes | Contas e Bens |
| `category_medical_childcare` | Medical & Childcare | Médico y Cuidado Infantil | Médico e Creche |
| `category_immigration` | Citizenship & Immigration | Ciudadanía e Inmigración | Cidadania e Imigração |
| `category_signed_forms` | Signed Forms | Formularios Firmados | Formulários Assinados |
| `category_custom` | Additional Documents | Documentos Adicionales | Documentos Adicionais |

If any es/pt strings clash with existing conventions, change them and post the diff in chat for sign-off before committing.

**Done when:**
- Type-check passes (`PbvFullAppStrings` interface updated to include the new keys).
- Manual: language toggle on a render that displays a category header shows the correct string for each of en/es/pt.
- No console warnings about missing translation keys.

### Commit 4 — Admin UI grouping (`StantonReviewSurface`)

Replace `components/review/StantonReviewSurface.tsx` lines 384-393:

- Group `documents.filter((d) => d.doc_type !== 'custom')` by the `category` field (not `doc_type`).
- Render in fixed category order: `income`, `assets`, `medical_childcare`, `immigration`, `signed_forms`. Skip empty categories.
- Within each category, sort by `(display_order, person_slot)`.
- Resolve each category header via the translations from Commit 3. Note: `StantonReviewSurface` may not currently know about language. If so, pull the user's language from the existing language context / prop. If there's no admin language toggle, default to English and document the gap in the build report.
- Keep the `doc_type === 'custom'` carve-out: render as its own "Additional Documents" section after the five fixed categories.
- `SelectableHeader` and the existing checkbox/select-all behavior continue to work per-category.

**Done when:**
- Admin review page for Richie Rich shows ≤6 sections (5 fixed + custom if any), not 34.
- Section headers are the localized strings, not raw slugs.
- Section ordering is deterministic: income → assets → medical_childcare → immigration → signed_forms → custom.
- Selecting all docs in a category still works.
- No regressions in non-PBV review pages (if this surface is reused for non-PBV anchors).

### Commit 5 — Tenant UI grouping (`TenantDocumentUpload`)

Replace `components/pbv/TenantDocumentUpload.tsx` around line 259:

- Group the `documents` state by `category`.
- Render in the same fixed category order as Commit 4.
- Within each category, sort by `(display_order, person_slot)`.
- Each category gets a section header (localized via existing `t` strings — Commit 3 added them). Default expanded. Collapsible is OK if it helps mobile UX; do not collapse by default.
- The progress counter at the top (`uploadedCount of totalCount`) stays accurate across all sections.
- The existing per-doc render (status badge, upload button, rejection-reason render) is unchanged inside each section.
- Handle the `category IS NULL` case explicitly: render as `custom` section if any null-category docs exist. Don't crash.

**Done when:**
- Tenant view on Richie Rich's token renders 5 sections in each of en/es/pt.
- Mobile narrow viewport (375px wide) lays out correctly: section headers don't truncate, upload buttons remain reachable, no horizontal scroll.
- The progress counter still matches the total.
- Existing rejected-doc rendering still shows below the doc within its category.
- Existing person_slot label ("Person 2") still appears where applicable.

---

## Verification

Per `docs/verification-methodology_2026-05-13.md`. Specifics for this build:

1. **DB snapshot before/after.** Take a row count of `application_documents` per category for at least 3 existing applications including Richie Rich. Backfill should not change the total per app, just populate `category`.
2. **Fresh-DB test.** Drop into a fresh DB, run all migrations including Commit 1 and Commit 2's seed update. Submit a test intake. Confirm `application_documents` rows have correct categories.
3. **Idempotency.** Re-run Commit 1's migration. No-op.
4. **Rollback drill.** Document the DROP COLUMN inverse in the build report. Confirm it works on a throwaway DB.
5. **Grep audit.** After Commit 4 and 5, grep for `doc_type` in JSX/TSX should find only per-doc identifiers, not category headers. Grep for hardcoded English category strings ("Income Verification", "Banking & Assets", etc.) returns no hits outside the translations file.
6. **Build passes.** `npm run build` and `npm run lint` clean. Type-check clean.
7. **Visual diff.** Screenshot the admin review page and the tenant docs page before and after, in all three languages. Attach to the build report.

---

## Anti-patterns — do NOT

- Do not derive category from `display_order` at runtime anywhere outside Commit 1's migration. After backfill, `category` is the source of truth. Future templates with `display_order=350` could legitimately be in any category — only the explicit column tells you.
- Do not add categorization to non-PBV form_ids. The migration is `form_id = 'pbv-full-application'`-scoped. Other forms (move_out_inspection, etc.) are out of scope for this PR.
- Do not relitigate the closed decisions. If you find a reason one is wrong, stop and post in chat.
- Do not widen scope into Phase 5 (rejection templates), Phase 6 (multi-signer), or any other PRD-14 phase. Each is its own PR.
- Do not refactor `StantonReviewSurface` or `TenantDocumentUpload` beyond the grouping change. Layout polish, accessibility passes, mobile rewrites — separate PRs.
- Do not add a `category` enum constraint at the DB level. Five values is small but admin custom docs need flexibility; leave it as plain TEXT.
- Do not skip the build report. The next PR (Phase 5) needs your verification baseline.

---

## Build report (you write this)

Create `docs/build-reports/14-document-categorization-build-report_2026-05-14.md` covering:

- Migration applied: yes/no, when, against which DB(s)
- Pre/post category counts for templates and at least 3 sample applications (including Richie Rich)
- Open question 1 (es/pt phrasing) — final decision, source if you changed any
- Open question 2 (admin custom doc category) — decision and rationale
- Open question 3 (external API consumers) — grep results
- Any deviations from this prompt, with rationale
- Screenshots: admin and tenant docs pages in en/es/pt, before and after
- Anything you'd flag for the Phase 5 author to be aware of

---

## When you're done

Post in chat:
1. PR link
2. Build report path
3. Any open questions Alex needs to weigh in on before merge
4. Confirmation that the verification checklist above is fully green

Do not merge without Alex's sign-off.
