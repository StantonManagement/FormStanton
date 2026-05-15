# Build Report — PRD-20: Already-Submitted Re-Entry

**Date:** 2026-05-14  
**Status:** Complete  
**Build:** Passed (`npm run build` exit code 0)

---

## Open Decisions — Resolutions

| # | Decision | Resolution |
|---|----------|------------|
| **1** | GET response shape | **Added** `documents[]` with `id, doc_type, label, person_slot, person_name, status, category, display_order` and `signatures[]` with `id, document_id, signer_name, signed_at, document_label`. Also added `head_of_household_name` to root response. |
| **2** | Category grouping | **USE CATEGORIES** — PRD-14 shipped 2026-05-14. Documents grouped by category in fixed order: income → assets → medical_childcare → immigration → signed_forms → custom. |
| **3** | Office contact source | **HARDCODED** — `(860) 993-3401` matches existing pattern across all translation files (`pbvFullAppTranslations.ts`, `pbvFormTranslations.ts`, etc.). |

---

## Commits

### Commit 1 — Translations

**File:** `lib/pbvFullAppTranslations.ts`

Added 8 new keys × 3 languages:

| Key | English | Spanish | Portuguese |
|-----|---------|---------|------------|
| `already_submitted_title` | "Application Submitted" | "Solicitud Enviada" | "Solicitação Enviada" |
| `already_submitted_subtitle` | "Your PBV application is in review..." | "Su solicitud PBV está en revisión..." | "Sua solicitação PBV está em revisão..." |
| `already_submitted_timestamp_label` | "Submitted on" | "Enviada el" | "Enviada em" |
| `already_submitted_docs_heading` | "Documents you submitted" | "Documentos que envió" | "Documentos que você enviou" |
| `already_submitted_signatures_heading` | "Signatures captured" | "Firmas capturadas" | "Assinaturas capturadas" |
| `already_submitted_contact_heading` | "Need to make a change?" | "¿Necesita hacer un cambio?" | "Precisa fazer uma alteração?" |
| `already_submitted_contact_body` | "Contact the office at (860) 993-3401." | "Comuníquese con la oficina al (860) 993-3401." | "Entre em contato com o escritório pelo (860) 993-3401." |
| `already_submitted_print_btn` | "Print this page" | "Imprimir esta página" | "Imprimir esta página" |

**Verification:** TypeScript interface updated, all language objects include new keys.

---

### Commit 2 — Data Availability

**File:** `app/api/t/[token]/pbv-full-app/route.ts`

**Changes:**
1. Added `head_of_household_name` to initial application SELECT
2. Added document list query when `intake_submitted`:
   - From `application_documents` with `anchor_type='pbv_full_application'`
   - Ordered by `display_order, person_slot`
   - Includes `category` for grouping
3. Added signatures query when `intake_submitted`:
   - From `pbv_signature_audit_log`
   - Joins to `application_documents` for `document_label`
   - Ordered by `signed_at`
4. Added to response: `head_of_household_name`, `documents`, `signatures`

---

### Commit 3 — Render Block

**File:** `app/pbv-full-app/[token]/page.tsx`

**Changes:**
1. Added state declarations for:
   - `headOfHouseholdName`
   - `submittedAt`
   - `documents[]`
   - `signatures[]`
2. Updated load effect to capture new data when `submitted_at` detected
3. Replaced placeholder render (lines 795-811) with full implementation:
   - Sticky header: title, timestamp (localized), HoH name + unit
   - Document list: grouped by category with status indicators (✓ approved, ⊘ waived, ◯ submitted, ✗ rejected)
   - Signature list: grouped by signer name with document + date
   - Contact card: blue background (gray-200 borders when printing)
   - Print button: `window.print()` with `print:hidden`

**Print stylesheet** via Tailwind utilities:
- `print:py-0 print:px-0 print:bg-white` on main
- `print:border-none print:p-0` on cards
- `print:hidden` on print button
- `print:text-black` on headings
- `print:text-gray-600` on muted text

---

## Verification Results

| Step | Result |
|------|--------|
| `npm run build` | ✅ Exit code 0, TypeScript clean |
| Translations | ✅ All 24 new strings (8 keys × 3 languages) present |
| API expansion | ✅ Additive only, no breaking changes |
| Render | ✅ Read-only, no mutation affordances |
| Print styles | ✅ `print:` utilities applied throughout |

---

## Screenshots (Manual Verification Required)

Before merge, verify:
1. **English render** at finalized app URL — all sections populated
2. **Spanish render** — language toggle works, strings localized
3. **Portuguese render** — language toggle works, strings localized
4. **Mobile (375px)** — no horizontal scroll, readable
5. **Print preview** — no nav chrome, all content visible, clean layout

---

## Anti-Patterns Verified

| Anti-Pattern | Status |
|--------------|--------|
| No edit/replace affordances | ✅ Confirmed |
| No server PDF generation | ✅ Browser print only |
| No extra fetches | ✅ Data from single GET |
| No page-state routing changes | ✅ PRD-15 untouched |
| No mutation guard changes | ✅ PRD-15 untouched |

---

## Build Notes

- Middleware deprecation warning surfaced to stderr (expected, non-fatal)
- Build completed: `Compiled successfully in 32.2s` → `Running TypeScript` → `Collecting page data` → `Generating static pages` → route table
- No errors, no warnings in TypeScript phase
