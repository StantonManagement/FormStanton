# Build Report — PRD-28: Summary Doc Generation Pipeline

**Date:** 2026-05-15  
**Branch:** `feature/pbv-form-execution`  
**PRD:** `docs/fullApp-Plan/28-pbv-form-execution-summary-doc_prd_2026-05-15.md`

---

## Commits Shipped

| Commit | SHA | Description |
|---|---|---|
| Commit 1 | `39988f2` | EN+ES+PT content scaffolds (tentative ES/PT) |
| Commit 2 | `12ece2c` | pdf-lib summary doc generator |
| Commit 3 | `e58e271` | Wire into form generation pipeline + summary-pdf serve route |
| Commit 4 | `9a50469` | Generator coverage (22 tests) |

---

## Content Shipped

### `lib/pbv/summary-doc/content.ts`

All 3 languages (`en`, `es`, `pt`). All 15 keys defined per `SummaryContent` interface.

| Key | EN | ES (tentative) | PT (tentative) |
|---|---|---|---|
| doc_title | ✓ | ✓ | ✓ |
| section_what_applying_for_body | ✓ | ✓ | ✓ |
| section_package_title | ✓ | ✓ | ✓ |
| section_uploads_title | ✓ | ✓ | ✓ |
| section_language_note_body | ✓ (function) | ✓ (function) | ✓ (function) |
| section_contact_body | ✓ (function) | ✓ (function) | ✓ (function) |
| section_acknowledgement_body | ✓ | ✓ | ✓ |
| signature_line_label | ✓ | ✓ | ✓ |
| ... (all 15 keys) | ✓ | ✓ | ✓ |

Tentative marker count:
- `// CONTENT: tentative` occurrences: **2** (es block, pt block) in `content.ts`
- `// CONTENT: tentative` occurrences: **6** (es+pt × form_descriptions+upload_descriptions) in `descriptions.ts`

**Total tentative markers: 8** — all grep-searchable with `// CONTENT: tentative`.

### `lib/pbv/summary-doc/descriptions.ts`

- **13 federal form descriptions** (one per form in inventory)
- **16 upload category descriptions**
- Total: 29 descriptions × 3 languages = **87 strings**
- EN authored by Cascade from field inventory headers
- ES/PT: machine-aided draft, all marked tentative

---

## Generator Design (`lib/pbv/summary-doc/generate-summary.ts`)

**Layout approach:** Programmatic pdf-lib, US Letter (612×792pt), single page.

**Sections rendered:**
1. Letterhead — "STANTON MANAGEMENT" in brand navy + address line + horizontal rule
2. Document title (uppercase) + For: {HOH name} + {address} + date
3. What You Are Applying For (wrapped paragraph)
4. What's in Your Application Package (per-form bullets)
5. Documents You Will Need to Upload (itemized if ≤8; collapsed if >8)
6. Language Note (language-adaptive function — explains PT→ES submission language split)
7. How HACH Will Contact You
8. Your Acknowledgement
9. Signature line + Date line
10. Footer: Template version + "Confidential"

**Upload collapse decision resolved:** ≤8 uploads itemized; >8 → single collapsed bullet (per PRD-28 open decision default).

**Logo decision resolved:** Logo at `public/Stanton-logo.PNG` exists but is PNG binary — embedding in pdf-lib requires `embedPng()` which needs raw bytes. To avoid filesystem reads in the generator (per PRD-22 stamper pattern), the letterhead uses a clean text-based approach. Logo embedding is a future polish item.

**Letterhead colors:** Deep institutional navy (rgb 0.11, 0.22, 0.38) consistent with design system.

**Fonts:** `StandardFonts.HelveticaBold` + `StandardFonts.Helvetica` — no external font dependencies.

---

## Idempotency Verification

Same inputs + same `generatedAt` date → same byte length (verified in tests).

Note: pdf-lib does not guarantee strict byte identity (internal UUID in cross-reference table may vary). Byte length equality is verified; logical content equivalence is guaranteed by deterministic inputs. The `upsert` in `generate-forms` uses `onConflict: 'full_application_id'` which replaces the row on re-generation.

---

## Pipeline Integration

**`generate-forms` route extended:**
- After all federal forms generated, step 5 runs `generateSummaryPdf()`
- Loads upload requirements from `pbv_document_requirements` for this application
- Saves to `pbv-forms` bucket at path: `pbv/{application_id}/summary-{lang}-unsigned.pdf`
- Upserts `pbv_summary_documents` row with `template_version: '1.0.0'`
- Summary failure is **non-fatal**: federal forms still returned; `summary.error` field in response for observability

**`summary-pdf` serve route created:**
- `GET /api/t/[token]/pbv-full-app/summary-pdf`
- Returns raw `application/pdf` bytes (bypasses `withTenantContext` JSON wrapping)
- Auth: `access_token` column lookup on `pbv_full_applications`
- 404 if not generated yet (code: `not_generated`)
- PRD-26's summary page already calls this exact URL: `/api/t/${token}/pbv-full-app/summary-pdf` ✓

---

## PRD-26 Integration

The summary review-and-sign page at `app/pbv-full-app/[token]/sign/summary/page.tsx` passes:
```
summaryPdfUrl={`/api/t/${token}/pbv-full-app/summary-pdf`}
```
to `SummaryDocReviewSign`. The `summary-pdf` route returns PDF bytes inline. No PRD-26 UI changes required. ✓

---

## Test Results

| Suite | Tests | Status |
|---|---|---|
| `content.test.ts` | 14 | ✓ All pass |
| `generate-summary.test.ts` | 8 | ✓ All pass |
| **Total** | **22** | **22/22 passing** |

Coverage:
- All 3 languages have all required content keys
- `section_language_note_body` and `section_contact_body` callable and return non-empty strings
- Generator produces valid `%PDF` header in all 3 languages
- Buffer ≥1500 bytes for content-bearing pages
- Idempotency: same inputs → same byte length
- Upload collapse (>8) — does not throw
- Empty forms list — does not throw
- `SUMMARY_TEMPLATE_VERSION` equals `'1.0.0'`

---

## Open Questions for Alex + Dan

1. **Logo embedding** — Text-based letterhead is clean and production-appropriate. If you want the actual Stanton logo, I need to add `embedPng()` with a filesystem read in the generator. Flag when ready to add.

2. **Language note for EN speakers** — The EN language note is minimal ("Your federal forms are in English"). Dan may want a warmer or more explanatory note here.

3. **HACH application reference number** — PRD-28 open question resolved as "include if available, omit if not." The current generator omits it because there's no HACH ID field in the application at generation time. When HACH assigns a reference number, add it to the letterhead row.

4. **Children's names in summary salutation** — PRD-28 open question resolved as "only HOH name." Implemented as-is.

5. **Content versioning workflow** — `template_version = '1.0.0'`. When Dan + translator finalize ES/PT, bump to `'1.1.0'`. The audit trail in `pbv_summary_documents.template_version` proves exactly what content each tenant signed.

---

## Translation Handoff Process (ES/PT)

1. Run `grep -r "// CONTENT: tentative"` to get all 8 strings requiring review
2. Files to send to translator:
   - `lib/pbv/summary-doc/content.ts` — section bodies (ES + PT blocks)
   - `lib/pbv/summary-doc/descriptions.ts` — per-form + per-upload descriptions (ES + PT blocks)
3. Translator returns corrections → remove `// CONTENT: tentative` marker after approval
4. Bump `SUMMARY_TEMPLATE_VERSION` to `'1.1.0'`
5. Re-run `generate-forms` for any existing applications to regenerate summaries with updated content

---

## Items Not in Scope (per PRD-28)

- Professional translation (Alex + translator, post-launch)
- HACH-facing summary display in reviewer portal (PRD-29/30)
- Schema changes (none needed)
- Signed summary PDF path update (handled by `sign-summary` route in PRD-24)
