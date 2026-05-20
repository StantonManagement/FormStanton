# Form PDF-Overlay Pilot — PRD

**Date:** May 14, 2026 (rev. 2)
**Author:** Alex
**Status:** Pilot — architecture pivot from HTML rendering to PDF overlay
**Supersedes:** `form-html-rendering-pilot_prd_2026-05-14.md` (v1, v2)
**Suggested branch:** `pilot/pdf-overlay`

---

## 1. What Changed

Earlier versions of this PRD specified rendering forms as HTML+CSS, then printing to PDF. First-pass output revealed that approach has structural problems we'd spend weeks fighting:

- Typography drift (serif vs sans, bold vs underline, smart quotes, italic letterhead)
- Transcription errors AI introduces silently (correcting HACH's typos, paraphrasing legal text)
- Recreating complex bordered sections (HUD-52675 acknowledgment table, Citizenship Declaration table, Obligations of Family bullet structure)
- Logo recreation
- Page-break tuning per form per language

The fundamental issue: ~80% of every form is static legal text + letterhead + boilerplate. We were going to spend ~80% of our labor recreating the part of the form that never changes, then tune typography to match a federal artifact we'd never get exactly right.

**The pivot: keep the source PDF as canvas. Overlay only what's variable.**

Variable content = tenant's typed values, signature image, date, checkbox states. Maybe 5–30 positioned elements per form. Everything else is the original PDF, untouched, perfect fidelity by definition.

This is how DocuSeal works under the hood. It's how every PDF e-signature tool works. We're adopting the architecture, not the product.

## 2. Problem

Tenants need to fill and sign 14 HACH/HUD forms digitally. Output must be accepted by HACH reviewers who go by field position on familiar federal forms, not by document provenance. The output PDF must look like HACH's PDF — because it *is* HACH's PDF, with values stamped on.

## 3. Architecture

```
Source PDF (HACH's authoritative form, untouched)
        +
Field coordinates (per form, defined once)
        +
Tenant input (values + signature PNG)
        ↓
   pdf-lib stamps values at coordinates
        ↓
Output PDF (HACH's form with tenant's data on it)
```

Three artifacts per form, generated once:
1. **Source PDF** (already exists) — the blank form
2. **Field map** (JSON) — coordinates of every fillable position
3. **Stamp script logic** — takes field values + field map + source PDF, produces filled PDF

Tenant-facing UI is HTML/React (interactive, mobile, bilingual chrome) but does **not** render the form itself. It captures values into structured state, shows a preview of where they'll land on the PDF, then submits. Server-side, pdf-lib stamps the actual PDF.

## 4. Pilot Goal

Validate the architecture with one form. Specifically: prove that pdf-lib can stamp typed text + a signature image + a date onto the source PDF at the right coordinates, and the output is visually correct.

This pilot does NOT build:
- The tenant-facing fill UI (downstream)
- Coordinate-mapping for the other 13 forms (downstream)
- Real signature capture (uses a sample PNG)
- Bilingual switching (English page only for pilot — Spanish overlay tested in next pilot)
- Persistence, auth, anything else

This is a fidelity test of the stamping mechanism. If pdf-lib stamps correctly with manually-defined coordinates, the rest of the system is mechanical labor. If it doesn't, we need to know now.

## 5. Source Materials

**Source packet:**
`F:\Cursor Apps\FormsStanton\docs\templates\Full Application Package (5-28-2025 bilingual).pdf`

**Pilot extraction:**
Extract page 37 (English Family Certification of Briefing Documents Received) to:
`F:\Cursor Apps\FormsStanton\docs\templates\briefing-cert-en.pdf`

Single-page extraction (not pages 37–38). Spanish version is a separate pilot once English works.

**Sample signature image:**
Generate a simple sample signature PNG and save to:
`F:\Cursor Apps\FormsStanton\docs\templates\sample-signature.png`

Black handwriting-style "Maria Garcia-Rodriguez" on transparent background, approximately 300×80px. Can be generated with HTML canvas, Pillow, or any tool. This is a placeholder asset for the pilot, not a real signature capture.

## 6. Deliverables

### 6.1 Field map

`scripts/field-maps/briefing-cert-en.json`

```json
{
  "form_id": "briefing-cert-en",
  "source_pdf": "docs/templates/briefing-cert-en.pdf",
  "page_size": "letter",
  "fields": [
    {
      "name": "hoh_printed_name",
      "type": "text",
      "page": 1,
      "x": 0,
      "y": 0,
      "width": 240,
      "font_size": 11,
      "label": "Head of Household Printed Name"
    },
    {
      "name": "signature",
      "type": "image",
      "page": 1,
      "x": 0,
      "y": 0,
      "width": 240,
      "height": 50,
      "label": "Head of Household Signature"
    },
    {
      "name": "signature_date",
      "type": "text",
      "page": 1,
      "x": 0,
      "y": 0,
      "width": 100,
      "font_size": 11,
      "label": "Date"
    }
  ]
}
```

Coordinates (`x`, `y`) start at `0,0` and must be determined during the pilot. PDF coordinate space is bottom-left origin, points (1pt = 1/72 inch).

### 6.2 Stamping script

`scripts/stamp-form.mjs`

A Node script that:
- Takes three CLI args: `--form briefing-cert-en --data sample-data.json --out filled.pdf`
- Loads the field map JSON
- Loads the source PDF
- Loads the data file (values keyed by field name)
- For each field: stamps text via `page.drawText()` or image via `page.drawImage()`
- Saves output PDF

Uses pdf-lib only. No other dependencies.

### 6.3 Sample data

`scripts/sample-data/briefing-cert-en.json`

```json
{
  "hoh_printed_name": "Maria Garcia-Rodriguez",
  "signature": "docs/templates/sample-signature.png",
  "signature_date": "2026-05-14"
}
```

### 6.4 Output

`docs/templates/briefing-cert-en-filled.pdf`

The source PDF with sample data stamped on. This is what Alex visually compares against the source PDF page to validate the pilot.

### 6.5 Coordinate determination notes

`scripts/field-maps/briefing-cert-en.NOTES.md`

A markdown file documenting how the coordinates were determined: which method (visual inspection, pdf-lib measurement, manual ruler, etc.), what tooling was used, any quirks discovered. This becomes the playbook for mapping the other 13 forms.

## 7. Success Criteria

Pilot **passes** if:

1. Output PDF contains the source PDF page entirely unmodified except for the stamped values
2. "Maria Garcia-Rodriguez" lands on the Head of Household Printed Name line — not above it, not below it, not overlapping the label
3. Sample signature PNG lands on the Signature line at appropriate size — not crushed, not oversized, not overlapping date
4. "2026-05-14" lands on the Date line
5. Output PDF opens cleanly in standard PDF readers (Acrobat, Preview, Chrome)
6. Total Cascade autonomous time under 30 minutes

Pilot **fails** if:
- Values land in wrong positions and require >3 iterations of coordinate tuning to fix
- pdf-lib produces corrupted output
- Source PDF content is modified (text shifted, boxes redrawn, anything beyond pure overlay)

## 8. Decision Gate

| Outcome | Next step |
|---|---|
| **Pass** | Write follow-on PRD: coordinate-map remaining 13 forms × 2 languages = 28 field maps. AI handles coordinate identification; Alex spot-checks. Estimated 30–60 min per form. |
| **Pass with caveats** | Note what was hard (e.g., finding coordinates without trial-and-error). Decide whether to build a visual coordinate-picker tool first. |
| **Fail** | Pivot to DocuSeal (~$800/year) or investigate why pdf-lib failed — pdf-lib is industry-standard so failure would be surprising. |

## 9. Rules for Cascade

1. **No HTML, no CSS, no React in this pilot.** Pure Node script + pdf-lib + JSON config. The tenant UI is a separate downstream deliverable.

2. **No new npm dependencies beyond pdf-lib.** If anything else seems needed, stop and ask.

3. **Coordinates are the work.** The script is mechanical — pdf-lib's API is straightforward. The hard part is finding the right `x, y` for each field. Document the method in `.NOTES.md` for reuse.

4. **Do not modify the source PDF.** The pilot proves overlay works without touching the source. If pdf-lib for some reason rewrites the source content during stamping, that's a failure mode worth knowing.

5. **Sample signature can be crude.** A black text-rendering of the name as a PNG is fine. The pilot tests image placement, not signature quality.

6. **Iterate on coordinates up to 5 attempts max.** If you can't land the values on their lines within 5 tries, stop and report. Means we need a visual coordinate picker, not more tries.

7. **Output a single artifact for review.** `briefing-cert-en-filled.pdf` is the deliverable Alex evaluates. The script, JSON, and notes are how you got there.

---

## 10. Cascade Prompt (paste this into Windsurf)

```
Read docs/form-pdf-overlay-pilot_prd_2026-05-14.md and execute it.

Work in phases. Commit after each. If you get stuck, stop and ask before guessing.

PHASE 1 — SETUP (commit when done)
- Install pdf-lib: npm install pdf-lib
- Extract page 37 from "docs/templates/Full Application Package (5-28-2025 bilingual).pdf"
  to "docs/templates/briefing-cert-en.pdf" (single page only)
- Confirm extract is 1 page, English version of Family Certification of Briefing Documents Received
- Generate "docs/templates/sample-signature.png" — black text "Maria Garcia-Rodriguez" 
  in a handwriting-style font on transparent background, ~300x80px
- Commit: "pilot: setup pdf-overlay pilot artifacts"

PHASE 2 — FIELD MAP (commit when done)
- Determine x,y coordinates for the three fillable positions on briefing-cert-en.pdf:
  - Head of Household Printed Name line
  - Signature line  
  - Date line
- Method options (pick one, document in NOTES):
  a) Render PDF to PNG, identify pixel coords visually, convert to PDF point space
  b) Use pdf-lib to enumerate text positions and infer field positions from labels
  c) Manual measurement against known PDF dimensions (letter = 612x792 pt)
- Write coordinates to "scripts/field-maps/briefing-cert-en.json" per PRD section 6.1
- Write methodology notes to "scripts/field-maps/briefing-cert-en.NOTES.md"
- Commit: "pilot: define briefing-cert field map"

PHASE 3 — STAMPING SCRIPT (commit when done)
- Write "scripts/stamp-form.mjs" per PRD section 6.2
- Accept CLI args: --form, --data, --out
- Load field map, source PDF, data file
- For text fields: page.drawText() at coordinates with specified font size
- For image fields: page.drawImage() at coordinates with specified width/height
- Save output to --out path
- Commit: "pilot: build stamp-form script"

PHASE 4 — RUN AND ITERATE (up to 5 coord adjustments)
- Write "scripts/sample-data/briefing-cert-en.json" per PRD section 6.3
- Run: node scripts/stamp-form.mjs --form briefing-cert-en --data scripts/sample-data/briefing-cert-en.json --out docs/templates/briefing-cert-en-filled.pdf
- Open the output PDF and inspect visually (use a headless screenshot tool if needed)
- If values aren't landing on their lines, adjust coordinates in the field map and re-run
- Max 5 iterations. If still wrong after 5, stop and report.
- Commit final state: "pilot: briefing-cert-en filled output"

PHASE 5 — REPORT
Reply with:
- Confirmation of each phase committed (paste commit hashes)
- Path to briefing-cert-en-filled.pdf
- Number of coordinate iterations needed
- Method used for coordinate determination
- Anything you couldn't execute and why
- Estimated time spent

RULES
- No new dependencies except pdf-lib
- No HTML, CSS, React, or framework code
- No Supabase, no auth, no API routes  
- Do not modify the source PDF — only read it
- If anything in this prompt conflicts with the PRD, the PRD wins

PRD path: docs/form-pdf-overlay-pilot_prd_2026-05-14.md
```

## 11. Open Questions (not blocking pilot)

- [ ] Once English works, does the Spanish page on the same form need its own field map, or can we reuse coordinates? — Likely needs its own; same form structure but different page in source PDF.
- [ ] For multi-signer forms (Citizenship Declaration table with 8 rows), is the field map a flat list or nested? — Defer until we hit that form.
- [ ] How do we handle checkbox fields? pdf-lib can draw text/images but doesn't natively toggle checkboxes. Strategies: draw an "X" at the checkbox coordinate, draw a filled square overlay, or use AcroForm fields if the source PDF has them. — Defer until we hit a checkbox-heavy form.
- [ ] Where does the tenant-facing fill UI live and how does it know about field maps? — Separate downstream design.
