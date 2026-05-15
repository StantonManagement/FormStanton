# Packet Page Map — Full Application Package (5-28-2025 bilingual).pdf

**Surveyed:** 2026-05-15
**Total pages:** 40 (interleaved EN/ES throughout most of the packet)
**Method:** pymupdf `page.get_text()` first 200 chars per page + visual inspection for blank pages

---

## Page-by-Page Map

| Packet page | form_id | Language | Notes |
|-------------|---------|----------|-------|
| 1 | `main_application` | EN | Page header: "1 | P a g e — Housing Choice Voucher Program" — Sections I (household roster), signature lines; Adults table + Minors table |
| 2 | `main_application` | ES | "2 | P a g e — Programa de Vales de Elección de Vivienda" |
| 3 | `main_application` | EN | "3 | P a g e" — Section II (Income) |
| 4 | `main_application` | ES | "4 | P a g e" — Section II (Ingresos) |
| 5 | `main_application` | EN | "5 | P a g e" — Q2, Section IV (Assets), Section V (Childcare), Section VI (Medical), Section VII (Criminal history) |
| 6 | `main_application` | ES | "6 | P a g e" — Same as EN page 5 |
| 7 | `main_application` | EN | "7 | P a g e" — Q8 (DV), Q9 (Homeless), Q10 (RA), Section VIII (Household Expenses) |
| 8 | `main_application` | ES | "8 | P a g e" — Same as EN page 7 |
| 9 | `main_application` | EN | "9 | P a g e" — Inspection text + "Notices" acknowledgment + signature blocks (6 total) |
| 10 | `main_application` | ES | "10 | P a g e" — Same as EN page 9 |
| 11 | `hud_9886a` | EN | Cover/preamble — HUD-9886-A (10/23) informational text, no fillable fields |
| 12 | `hud_9886a` | ES | Cover/preamble — Formulario HUD-9886-A ES version |
| 13 | `hud_9886a` | EN | Signature page — HOH, Spouse, and up to 5 Other Family Member signature blocks + HOH SSN field |
| 14 | `hud_9886a` | ES | Signature page (ES) |
| 15 | `hach_release` | EN | HACH authorization release — applicant name, address, 4 signature blocks |
| 16 | `hach_release` | ES | HACH release ES version |
| 17 | `child_support_affidavit` + `no_child_support_affidavit` | EN | **Shared page:** top half = affirmative child support affidavit; bottom half = negative (no child support); separated by `~~~` rule |
| 18 | `child_support_affidavit` + `no_child_support_affidavit` | ES | Same shared-page layout as EN p 17 |
| 19 | `citizenship_declaration` | EN | Member table (9 rows) + HOH certification block |
| 20 | `citizenship_declaration` | ES | Member table (9 rows) + HOH certification block |
| 21 | `citizenship_declaration` | EN | **Informational only** — Eligible Immigration Status Instructions; no fillable fields |
| 22 | `citizenship_declaration` | ES | **Informational only** — same as EN p 21 |
| 23 | `obligations_of_family` | EN | Rules text page + HOH signature block (name, signature, date, phone, address) |
| 24 | `obligations_of_family` | ES | Same as EN p 23 |
| 25 | `eiv_guide_receipt` | EN | EIV "What You Should Know" guide — informational, no fillable fields |
| 26 | `eiv_guide_receipt` | ES | **BLANK** — ES version of guide not in packet (page 26 has no text content) |
| 27 | `eiv_guide_receipt` | EN | End of EIV guide + signature + date fields |
| 28 | `eiv_guide_receipt` | ES | **BLANK** — ES signature page also absent; field-map will use EN form only; flag in NOTES |
| 29 | `debts_owed_phas` | EN | HUD-52675 preamble/informational text (OMB 2577-0266, exp 06/30/2026) |
| 30 | `debts_owed_phas` | ES | HUD-52675 ES preamble (OMB block shows exp 31/08/2016 — older ES version) |
| 31 | `debts_owed_phas` | EN | Signature page — signature + date + printed name block |
| 32 | `debts_owed_phas` | ES | ES signature page |
| 33 | `hud_92006` | EN | HUD-92006 instructions cover page — no fillable fields |
| 34 | `hud_92006` | ES | **BLANK** — p 34 text is empty in packet; inventory note: "ES form layout matches EN" |
| 35 | `hud_92006` | EN | Fillable form — applicant info, additional contact, reason checkboxes, opt-out, signature |
| 36 | `hud_92006` | ES | ES fillable form (confirmed text present: Spanish disclaimer line) |
| 37 | `briefing_docs_certification` | EN | HACH briefing cert — printed name + signature + date (3 fields) |
| 38 | `briefing_docs_certification` | ES | Same; already mapped in PRD-22 |
| 39 | `criminal_background_release` | EN | HACH criminal background auth — full applicant info block + signature + witness |
| 40 | `criminal_background_release` | ES | ES version |

---

## Summary Table for PRD-23

| # | form_id | EN packet page(s) | ES packet page(s) | Extracted PDF pages | Complexity |
|---|---------|-------------------|-------------------|---------------------|------------|
| 1 | `main_application` | 1, 3, 5, 7, 9 | 2, 4, 6, 8, 10 | 5-page PDFs (each) | High |
| 2 | `hud_9886a` | 11, 13 | 12, 14 | 2-page PDFs | Medium |
| 3 | `hach_release` | 15 | 16 | 1-page PDFs | Medium |
| 4 | `child_support_affidavit` | 17 (top half) | 18 (top half) | 1-page PDFs | Low |
| 5 | `no_child_support_affidavit` | 17 (bottom half) | 18 (bottom half) | 1-page PDFs (same PDF as child_support, different field offsets) | Low |
| 6 | `obligations_of_family` | 23 | 24 | 1-page PDFs | Medium |
| 7 | `eiv_guide_receipt` | 25, 27 | 26, 28 | 2-page PDFs | Low — **ES pages blank in packet; EN used for both** |
| 8 | `debts_owed_phas` | 29, 31 | 30, 32 | 2-page PDFs | Low |
| 9 | `hud_92006` | 33, 35 | 34, 36 | 2-page PDFs — **p 34 blank; ES fillable at p 36** | Medium |
| 10 | `criminal_background_release` | 39 | 40 | 1-page PDFs | Low |
| — | `briefing_docs_certification` | 37 | 38 | **Completed in PRD-22** | — |
| — | `citizenship_declaration` | 19 | 20 | **Completed in PRD-22** | — |

---

## Anomalies and Flags

### eiv_guide_receipt — ES pages blank
Packet pages 26 and 28 (the ES EIV guide and ES signature page) contain no text. The guide is an EN-only HUD publication. **Decision for PRD-23:** extract EN page 27 only for the ES form as well — the signed receipt is HOH-only and the guide text is for reference. Document in form NOTES.

### hud_92006 — OMB expiration date
EN form (p 35) shows OMB Control # 2502-0581, exp 02/28/2019. This is an expired OMB number. Flagged for HACH review. The form is still in active use in the HACH packet as of 5-28-2025. Field map proceeds against the current form; PRD-24 should note this for HACH re-issuance check.

### hud_92006 — ES page 34 blank
Packet page 34 is blank. ES fillable form is at page 36. This means `hud-92006-es.pdf` extracts pages 35+36 (cover instruction from EN + ES fillable), or just page 36 alone (ES fillable only). **Decision:** extract page 36 only for the ES form (the cover page at 33/34 is informational; the fillable at 36 contains all tenant fields).

### debts_owed_phas — ES OMB expiration discrepancy
EN OMB block shows exp 06/30/2026; ES block shows exp 31/08/2016. The ES version appears to be an older form revision. Both are in the active HACH packet. Flag for HACH review. Field maps proceed against both; coordinate differences (if any) accounted for by separate ES map.

### child_support_affidavit + no_child_support_affidavit — shared page
Both forms share packet page 17 (EN) and 18 (ES). Extraction strategy: extract both forms to separate PDFs using the same source page but provide separate field maps with Y-offsets targeting the top vs bottom half of the page.

### hud_9886a — page 13 is signature page for both EN (p 11/13) and ES (p 12/14)
EN cover at p 11 mirrors ES cover at p 12. EN signature page at p 13 mirrors ES signature page at p 14. Confirmation: `page.get_text()` for pages 11 and 13 both begin with the same HUD-9886-A header — this is the bilingual packet's EN presentation of a 2-page form with EN cover + EN sig page. ES is pp 12+14.

---

## Extraction Commands (reference)

```python
import fitz
doc = fitz.open('docs/templates/Full Application Package (5-28-2025 bilingual).pdf')

# main_application-en.pdf — pages 1,3,5,7,9 (0-indexed: 0,2,4,6,8)
out = fitz.open()
for p in [0, 2, 4, 6, 8]:
    out.insert_pdf(doc, from_page=p, to_page=p)
out.save('docs/templates/main-application-en.pdf')

# main_application-es.pdf — pages 2,4,6,8,10 (0-indexed: 1,3,5,7,9)
# ...and so on per form
```
