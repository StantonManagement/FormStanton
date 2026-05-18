# Cursor Prompt — PRD-17: Rejection Loop Completeness

**PRD:** `docs/17-pbv-rejection-loop-completeness_prd_2026-05-14.md`
**Build report:** `docs/build-reports/17-rejection-loop-build-report_2026-05-14.md`
**Depends on:** PRD-14 must be merged (categorization gives docs the context for category-aware rejection if needed). Parallel-safe with PRD-15, 16.

---

## Context

Tenants see blank UI for rejected docs when `rejection_reason` is null or empty, and see English text when reasons are typed by admins regardless of tenant language. Build a hybrid template + free-text system with three-level fallback, localized at the template layer.

---

## Required reading

1. `docs/17-pbv-rejection-loop-completeness_prd_2026-05-14.md` — entire document.
2. `components/pbv/TenantDocumentUpload.tsx:300-304` — current render.
3. The admin reject endpoint(s) — find via grep on `'reject'` in `app/api/admin/`.
4. `lib/pbvFullAppTranslations.ts` — translation conventions to match.
5. `supabase/migrations/20260423220000_pbv_full_app_document_templates.sql` — for the 31 doc_type values that drive template seeding.

---

## Closed decisions

1. Hybrid: template key (preferred) + free-text (override).
2. Per-doc-type + generic templates.
3. en/es/pt at the template layer via three columns. No fourth language.
4. Three-level fallback in `resolveRejectionReason`: key → free-text → localized generic.
5. No historical backfill.
6. No admin UI for template management (SQL edits only for now).

---

## Open decisions

1. **Admin reject endpoint path(s).** Grep. Post the location(s) before Commit 3.
2. **Bulk reject endpoints.** Grep for any. If they exist, they need the same update.
3. **Admin UI surface for the new dropdown.** Locate the existing reject UI before scoping the dropdown work. If it's a modal/dialog: add the dropdown inside. If it's inline: add a select element. If the work expands beyond ~30 lines, post in chat first.

---

## Build this pass

### Commit 1 — Schema + seed

Create `supabase/migrations/20260514220000_pbv_rejection_reason_templates.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.pbv_rejection_reason_templates (
  key TEXT PRIMARY KEY,
  doc_type TEXT NULL,
  reason_en TEXT NOT NULL,
  reason_es TEXT NOT NULL,
  reason_pt TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed: ~10-15 generic rows (doc_type NULL) covering: illegible, expired, wrong_person,
-- missing_pages, watermark_obscured, wrong_date_range, partial_scan, blurry, cropped, etc.
-- Plus 3-6 rows per major doc_type (paystubs, bank_statement_*, ssi_award_letter, etc.)
-- covering doc-specific issues (e.g. paystubs:wrong_period, bank_statement:missing_balance).
INSERT INTO public.pbv_rejection_reason_templates (key, doc_type, reason_en, reason_es, reason_pt) VALUES
  ('generic:illegible', NULL,
    'The document is too blurry or hard to read. Please upload a clearer photo or scan.',
    'El documento está borroso o es difícil de leer. Por favor suba una foto o escaneo más claro.',
    'O documento está embaçado ou difícil de ler. Por favor envie uma foto ou digitalização mais nítida.'),
  ('generic:expired', NULL,
    'This document is expired. Please upload a current version.',
    'Este documento está vencido. Por favor suba una versión actual.',
    'Este documento está expirado. Por favor envie uma versão atualizada.'),
  -- ... continue for the full seed set
  ;

ALTER TABLE public.application_documents
  ADD COLUMN IF NOT EXISTS rejection_reason_key TEXT
    REFERENCES public.pbv_rejection_reason_templates(key);
```

**Verify Spanish/Portuguese against existing translation conventions in `pbvFullAppTranslations.ts` before committing.** Post the full seed set in chat for sign-off if you change any phrasing.

**Done when:** Table exists, seed populated, FK on `application_documents` works (invalid key on insert → error).

### Commit 2 — Helper + tests

Create `lib/rejectionReasons.ts`:

```ts
export type Language = 'en' | 'es' | 'pt';

interface Template {
  key: string;
  doc_type: string | null;
  reason_en: string;
  reason_es: string;
  reason_pt: string;
}

const GENERIC_FALLBACK: Record<Language, string> = {
  en: 'Please contact the office for details on why this document was rejected.',
  es: 'Por favor contacte la oficina para detalles sobre por qué este documento fue rechazado.',
  pt: 'Por favor entre em contato com o escritório para detalhes sobre por que este documento foi rejeitado.',
};

export function resolveRejectionReason(args: {
  key: string | null | undefined;
  freeText: string | null | undefined;
  language: Language;
  template?: Template; // optional pre-fetched template
}): string {
  if (args.template) {
    return args.template[`reason_${args.language}` as const];
  }
  if (args.freeText?.trim()) return args.freeText.trim();
  return GENERIC_FALLBACK[args.language];
}
```

Decision: should the helper fetch templates itself or accept a pre-fetched template? Pre-fetched is cleaner — the API includes the template join in the docs response so the client doesn't need a second fetch. Update the documents API accordingly (Commit 3).

Add unit tests covering all four input shapes × three languages.

**Done when:** Tests pass. Helper exports the function with the documented signature.

### Commit 3 — API: include template in docs response + admin reject update

- Tenant docs API: when a doc has `rejection_reason_key`, include the joined template row (or just `reason_<language>` for the current language) in the response.
- Admin reject endpoint(s) (location per open decision 1): accept `rejection_reason_key` parameter. Validate against the templates table. Write to `application_documents.rejection_reason_key`. Continue to accept `rejection_reason` for free-text override.

**Done when:**
- Tenant docs API response includes the localized reason for any doc with a key set.
- Admin can reject with `{ rejection_reason_key: 'generic:illegible' }` — succeeds, tenant sees localized text.
- Admin can reject with `{ rejection_reason: 'custom note' }` — succeeds, tenant sees free-text.
- Admin rejects with both — both stored; render prefers the template key per fallback order.
- Invalid key → 400 with explicit message.

### Commit 4 — Tenant render update

Update `components/pbv/TenantDocumentUpload.tsx:300-304`:

```tsx
{doc.status === 'rejected' && (
  <p className="text-xs text-red-600 mt-2 ml-4">
    {resolveRejectionReason({
      key: doc.rejection_reason_key,
      freeText: doc.rejection_reason,
      language,
      template: doc.rejection_reason_template, // pre-fetched from API
    })}
  </p>
)}
```

Note: the conditional changes from `doc.status === 'rejected' && doc.rejection_reason` to just `doc.status === 'rejected'` — the helper guarantees a string return value.

**Done when:**
- Rejected docs always show non-empty text (no more blank UI).
- Language toggle updates the rendered reason without a reload.

### Commit 5 — Admin UI dropdown

Per open decision 3, add a template dropdown to the existing admin reject UI. Filter by current doc's `doc_type`, with all generic templates always shown. Add a "Custom reason" option that reveals the free-text input.

**Done when:** Admin can reject in three modes: template-only, custom-only, or both. Each correctly persists to the DB and renders correctly on the tenant side.

---

## Build verification (Windows/PowerShell) — read this before running `npm run build`

PRD-16 lost time to PowerShell behavior. Don't repeat the same trap:

- **Do NOT pipe `npm run build` through `Select-Object -First N` or `-Last N`.** It truncates output before "Compiled successfully" appears, making clean builds look broken or hung. Run `npm run build` directly. If you need to capture output, use `Tee-Object`: `npm run build 2>&1 | Tee-Object build.log`.
- **Do NOT trust PowerShell's implicit exit code for npm commands.** Next.js writes the middleware-to-proxy deprecation warning to stderr, which PowerShell sometimes surfaces as exit code 1 even on a fully successful build. Use `$LASTEXITCODE` for the real node exit code, or inspect output directly.
- **A successful build looks like:** `✓ Compiled successfully in Xs` → `Running TypeScript ...` → `Collecting page data ...` → `Generating static pages ...` → route table prints. Any of the last three steps failing is a real problem. The middleware deprecation warning is NOT.
- If you delete a route file, **clear `.next/` before re-building** (`Remove-Item -Recurse -Force .next`). The cached type validator references the deleted file and causes spurious failures.

---

## Verification

1. **Round-trip en/es/pt:** template-keyed rejection renders in all three languages.
2. **Fallback chain:** key-only / free-text-only / both / neither — each renders the expected output.
3. **Historical rejections:** existing rejected docs (free-text only) still render correctly.
4. **Empty rejection:** a rejected doc with neither key nor free-text shows the localized generic, not blank.
5. **Build / lint / type-check** clean.

---

## Anti-patterns — do NOT

- Do not backfill historical rejections.
- Do not add a fourth language. Schema is rigid on en/es/pt.
- Do not build a template-management admin UI.
- Do not break the free-text path. It remains the override.
- Do not widen scope into bulk-reject UI redesign. If bulk reject endpoints exist, update their API but leave their UI alone unless ≤30 lines.

---

## Build report

Cover: seed contents (or link to migration), language sign-off, admin endpoint paths found, dropdown UI location, round-trip screenshots in all three languages.

Post PR + build report + open items in chat. Don't merge without sign-off.
