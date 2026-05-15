# Form HTML Rendering Pilot — PRD

**Date:** May 14, 2026
**Author:** Alex
**Status:** Pilot — single form, decision-gate before broader build
**Suggested branch:** `pilot/form-html-rendering`

---

## 1. Problem

The PBV intake flow needs to deliver 14 HACH/HUD forms to tenants for digital fill + signature, with output that HACH reviewers will accept. Three paths exist: pure HTML+CSS print rendering, HTML overlay on original PDF backgrounds, or adopting DocuSeal (~$800/year, new infrastructure).

The HTML+CSS path dominates on cost, control, stack-fit, and hostile-tenancy UX — **IF** AI-generated HTML output meets HACH's position-matching bar when printed or PDF-exported. We don't know if it does. This pilot answers that question with one form before we commit labor to the remaining thirteen.

## 2. Goal

Produce a single form rendered as HTML + CSS such that:

1. Print output (browser print-to-PDF) is visually close enough to the original PDF that a reviewer scanning for field positions would accept it as the same instrument.
2. The form is bilingual (EN/ES) with language toggle.
3. Fillable fields capture data into structured state.
4. Output is verifiable side-by-side against the source PDF in **both empty and filled states.**

This is a **fidelity test**, not a feature build. No Supabase integration, no auth, no real signature capture in the pilot — those come later if the fidelity test passes.

## 3. Source Materials

**Full source packet (reference only, do not transcribe from this directly):**
`F:\Cursor Apps\FormsStanton\docs\templates\Full Application Package (5-28-2025 bilingual).pdf`

**Pilot extraction step (do this first):**

Extract **only pages 37–38** from the source packet to a new file:
`F:\Cursor Apps\FormsStanton\docs\templates\briefing-cert-source.pdf`

These two pages contain the Family Certification of Briefing Documents Received form (page 37 EN, page 38 ES). The pilot works exclusively from this 2-page extract.

Why this matters: the full packet is 40 pages and contains 13 other forms. Working from the extract avoids accidentally pulling text from the wrong form and makes the verification step (diff HTML against source) tractable.

**Transcription rule:** All text content must be transcribed verbatim from `briefing-cert-source.pdf`. No paraphrasing, no AI-rewording of legal text. Both EN and ES versions must be captured from their respective pages.

## 4. Form to Pilot

**Family Certification of Briefing Documents Received** (pages 37–38 of source packet).

**Why this form:**
- Short (single page each language)
- Self-contained — no conditional logic, no multi-signer complexity
- Both EN and ES versions present in source
- Mix of fixed text + fillable fields (HOH name, signature, date)
- Tests the core layout patterns (HACH letterhead, numbered list, signature block, footer with legal warning) that recur in 8+ other forms in the packet

If this form's HTML rendering passes the fidelity bar, the patterns reuse across most of the remaining 13. If it doesn't, we know early.

## 5. Deliverables

### 5.1 Working artifact — the form itself

A single Next.js page at `app/pilot/briefing-cert/page.tsx` that:

- Renders the Family Certification of Briefing Documents Received form
- Has a language toggle (EN / ES) — switches the entire form in place
- Has fillable text fields for: Head of Household Printed Name, Date
- Has a signature placeholder area (visible labeled box — no real signature capture in pilot)
- Includes the HACH letterhead area (logo placeholder + address block)
- Includes the footer legal warning text (Section 1001 of Title 18)
- Has a "Print / Save as PDF" button that triggers `window.print()`
- Has a "Load sample data" button that pre-fills the form with the sample data defined in 5.2
- Applies print-specific CSS (`@media print`) that:
  - Sets page size to US Letter
  - Hides UI chrome (language toggle, print button, sample-data button) on print
  - Preserves layout, fonts, spacing in print output

### 5.2 Sample data for filled-state testing

The "Load sample data" button populates these values:

| Field | Sample value |
|---|---|
| Head of Household Printed Name | Maria Garcia-Rodriguez |
| Signature (text representation in placeholder) | Maria Garcia-Rodriguez |
| Date | 2026-05-14 |

Sample chosen deliberately to test real failure modes: hyphenated name with two parts to check field width, signature line that needs to accommodate a long name, date field width.

**Why this matters:** an empty form rendered next to an empty source PDF is a weak fidelity test. Filled output is the production case. It surfaces problems an empty form hides — text overflow, signature collision with date field, line breaks in the wrong place, date field too narrow, etc.

### 5.3 Verification page

A second route at `app/pilot/briefing-cert/verify/page.tsx` that:

- Shows the extracted source PDF (`briefing-cert-source.pdf`) embedded side-by-side with the HTML rendering
- Lets the reviewer toggle between EN and ES on the HTML side, with the corresponding PDF page shown alongside
- Lets the reviewer toggle between "empty" and "filled with sample data" state
- Surfaces a checklist:
  - [ ] HACH letterhead visible and positioned correctly
  - [ ] All 8 numbered briefing documents listed correctly
  - [ ] Family obligations bullet list matches source
  - [ ] Signature block has correct labels and positions
  - [ ] Footer legal warning text matches verbatim
  - [ ] Spanish version matches source page 38
  - [ ] Print output (PDF) renders without layout breaks — empty version
  - [ ] Print output (PDF) renders without layout breaks — filled version
  - [ ] Sample-filled HOH name fits within field width without overflow
  - [ ] Sample-filled signature doesn't collide with date field
  - [ ] Date stamp "Rev 3/28/2025" present in footer

### 5.4 Text verification artifact

A `app/pilot/briefing-cert/source-text.md` file containing:

- The full EN text of the form, copied verbatim from `briefing-cert-source.pdf` page 1 (= source packet page 37)
- The full ES text of the form, copied verbatim from `briefing-cert-source.pdf` page 2 (= source packet page 38)
- Markers showing where each piece of text appears in the HTML (e.g., `<!-- source: page 1, paragraph 3 -->`)

This is the diff target. Anyone (Alex, Dan, a future Cascade session) can verify the HTML text matches the source by comparing against this file. If text in the HTML drifts from this file, that's a bug.

## 6. Non-Goals (Explicit)

The pilot does **NOT** include:

- Real signature capture (react-signature-canvas integration) — placeholder box only
- Supabase persistence
- Audit trail
- Authentication / token-gated access
- Magic link integration
- Pre-fill from intake data (sample-data button is hard-coded values, not API pull)
- Field validation
- The other 13 forms
- Portuguese translation (deferred per prior decision)
- Mobile optimization beyond "doesn't break"
- Working from the full 40-page source packet — extract pages 37–38 first, work from extract

These are real and necessary for production. They're not what's being tested. Adding them dilutes the fidelity signal.

## 7. Success Criteria

The pilot **passes** if all of these are true:

1. **Empty-form fidelity:** Print output of the empty HTML form, placed next to the source PDF page, is judged by Alex as "close enough that a HACH reviewer scanning for field positions would accept it" — single human judgment, no committee.
2. **Filled-form fidelity:** Print output of the sample-filled HTML form holds up to the same test. No overflow, no collisions, no awkward wrapping.
3. **Text accuracy:** Text content matches the source verbatim (verified via the `source-text.md` diff target).
4. **Bilingual:** Language toggle works — both EN and ES render correctly, both print correctly.
5. **Print fidelity:** Print CSS produces a single-page PDF per language per state (empty/filled) with no awkward page breaks, no cut-off content.
6. **Effort signal:** Total Cascade autonomous time to produce the pilot is under 2 hours of session work. (If it takes longer, that's a signal about scaling to 14 forms.)

The pilot **fails** if:

- Layout drifts materially from source (signature line on wrong page, table cells misaligned, etc.)
- Filled-form rendering reveals problems (overflow, collisions, wrapping) that empty form hides
- Print output requires manual fiddling to look acceptable
- Text accuracy can't be verified mechanically against source

A **fail** doesn't kill the HTML approach — it tells us we need HTML-over-PDF (use original as background) or DocuSeal instead. The pilot's purpose is to make that decision data-driven.

## 8. Decision Gate

After the pilot ships, Alex reviews and makes one of three calls:

| Outcome | Next step |
|---|---|
| **Pass** | Write follow-on PRD: "Render remaining 13 forms" using same patterns. Estimated 1–2 hours Cascade time per form. |
| **Pass with caveats** | Note what needed manual tuning. Decide whether the per-form tuning labor is acceptable across 13 more, or whether HTML-over-PDF is now the right call. |
| **Fail** | Pivot to HTML-over-PDF path. Write new PRD for coordinate-mapping approach using the source PDF as background. DocuSeal becomes fallback. |

## 9. Constraints / Rules for Cascade

1. **Extract pages 37–38 first.** Before writing any HTML, extract those two pages from the source packet to `briefing-cert-source.pdf`. Work from the extract. Do not transcribe text from the full 40-page packet directly — risk of pulling content from wrong form.

2. **Do not paraphrase legal text.** Every word of the form text must come from the source PDF verbatim. If you can't read a passage clearly, flag it — don't guess.

3. **No new dependencies.** The pilot uses existing Next.js + React + Tailwind (if installed) only. No new PDF libraries (other than what's used for the one-time page extraction), no print libraries, no signature libraries. Pure CSS print.

4. **No backend.** No API routes, no Supabase calls, no auth. Pure client-side rendering.

5. **Source-text.md is the contract.** If the HTML doesn't match source-text.md exactly, the pilot is incomplete. This is the verification mechanism — don't skip it.

6. **Spanish text accuracy matters.** Don't translate from English. Copy the Spanish from the source PDF directly. The two language versions on adjacent PDF pages are HACH's authoritative bilingual text.

7. **HACH letterhead:** Use a placeholder div with the HACH text address block. Don't try to recreate the logo as SVG. A `<div class="hach-logo-placeholder">HACH</div>` is fine for the pilot — fidelity test is about layout, not branding assets.

8. **Print CSS is the test.** The screen rendering matters less than what comes out of `window.print()`. Test print output explicitly — both empty and filled with sample data — and tune until both match source.

9. **Test both states.** Don't ship the pilot with only the empty-form fidelity checked. The sample-data button + filled-state verification is mandatory, not optional.

## 10. File Manifest (expected)

```
docs/templates/
  Full Application Package (5-28-2025 bilingual).pdf    # Existing, untouched
  briefing-cert-source.pdf                              # NEW — extract of pages 37–38

app/pilot/briefing-cert/
  page.tsx                    # The form: language toggle, sample-data button, print button
  source-text.md              # Verbatim text from briefing-cert-source.pdf (EN + ES)
  styles.module.css           # Form-specific CSS, including @media print rules
  verify/
    page.tsx                  # Side-by-side comparison view, empty/filled toggle

docs/
  form-html-rendering-pilot_prd_2026-05-14.md           # This file
```

## 11. Open Questions (not blocking pilot)

- [ ] Does HACH require the original PDF as output, or will they accept HTML-rendered PDFs? — Needs Alex to ask HACH contact. Not blocking pilot, but blocks production rollout.
- [ ] If HACH is fine with HTML-rendered output, do they need specific metadata in the PDF (form ID, OMB number, version date) preserved? — Defer until after pilot decision.
- [ ] Print font: source PDF uses Times-style serif. Browser default print font may differ. Acceptable, or do we need to embed a specific font? — Decide during pilot.
- [ ] Date format: sample uses ISO `2026-05-14`. Does HACH expect `5/14/2026` or `May 14, 2026`? — Doesn't block pilot (any format tests overflow), but resolve before production.

## 12. Glossary

- **HACH** — Housing Authority of the City of Hartford
- **HCV** — Housing Choice Voucher
- **PBV** — Project-Based Voucher
- **HOH** — Head of Household
- **Fidelity test** — Whether the rendered output matches the source closely enough for HACH reviewer acceptance
- **Position-matching** — Reviewer expectation that data fields land in the same screen/page positions across submissions, regardless of language
- **Empty state** — Form rendered with no fillable fields populated (structural fidelity check)
- **Filled state** — Form rendered with sample data populated (in-use fidelity check)
