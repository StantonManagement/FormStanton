# Build Report — PRD-22: Toolchain + ES Briefing-Cert + Citizenship Declaration Pilot

**Date:** 2026-05-15
**Branch:** `dev`
**Status:** Complete — all 3 commits merged, 4 pilot PNGs produced and verified

---

## 1. What Shipped

### Commit 1 — `tooling: add pymupdf visual verification (render-stamped)`

| File | Action |
|------|--------|
| `scripts/render-stamped.py` | New — CLI render tool, Python + pymupdf |
| `scripts/field-maps/briefing-cert-en.NOTES.md` | Updated — Visual Verification section added |
| `.gitignore` | Updated — `scripts/output/render/*.png` ignored; 4 pilot PNGs excepted |
| `scripts/output/render/briefing-cert-en-filled-page1.png` | New — smoke test render of existing pilot output |

**pymupdf version installed:** 1.27.2.3

### Commit 2 — `field-map: briefing-cert-es (Spanish version of pilot form, extracted via pymupdf)`

| File | Action |
|------|--------|
| `scripts/sample-data/maria-household.json` | New — canonical sample household (5 members: HOH + spouse + adult son + 2 minors) |
| `docs/templates/briefing-cert-es.pdf` | New — page 38 extracted from source packet via pymupdf |
| `scripts/field-maps/briefing-cert-es.json` | New — ES field map (3 fields) |
| `scripts/field-maps/briefing-cert-es.NOTES.md` | New — coordinate comparison, iteration log, visual verification |
| `docs/templates/briefing-cert-es-filled.pdf` | New — stamped ES pilot output |
| `scripts/output/render/briefing-cert-es-filled-page1.png` | New — visual verification PNG |

### Commit 3 — `pilot: citizenship-declaration table-style stamping (en + es)`

| File | Action |
|------|--------|
| `scripts/stamp-form.mjs` | Updated — `row_pattern` block support added (additive, existing field maps unaffected) |
| `docs/templates/citizenship-declaration-en.pdf` | New — page 19 extracted from source packet |
| `docs/templates/citizenship-declaration-es.pdf` | New — page 20 extracted from source packet |
| `scripts/field-maps/citizenship-declaration-en.json` | New — EN field map (Pattern B + HOH cert fields) |
| `scripts/field-maps/citizenship-declaration-en.NOTES.md` | New — table structure, column x positions, row pitch, pattern decision, iteration log |
| `scripts/field-maps/citizenship-declaration-es.json` | New — ES field map |
| `scripts/field-maps/citizenship-declaration-es.NOTES.md` | New — coordinate comparison ES vs EN, iteration log |
| `scripts/sample-data/citizenship-declaration-en.json` | New — stamp data (5 members + HOH cert) |
| `scripts/sample-data/citizenship-declaration-es.json` | New — stamp data (5 members + HOH cert) |
| `docs/templates/citizenship-declaration-en-filled.pdf` | New — stamped EN pilot output |
| `docs/templates/citizenship-declaration-es-filled.pdf` | New — stamped ES pilot output |
| `scripts/output/render/citizenship-declaration-en-filled-page1.png` | New — visual verification PNG |
| `scripts/output/render/citizenship-declaration-es-filled-page1.png` | New — visual verification PNG |

---

## 2. Deviations from PRD-22

### Citizenship Declaration scope: ALL members, not adults-only

PRD-22 Key decisions §4 stated "Two minor children (no Citizenship Declaration rows; that form is
adults-only per HACH practice — confirm if inventory says otherwise)."

**Finding:** The inventory says otherwise. `pbv-field-inventory.md` § citizenship_declaration
`per_person_scope = individual`, with note "table repeats per household member; 9 rows shown."
Form instructions state: "Complete this declaration for all members of the household. Adults
responsible for children 17 and younger must sign on their behalf."

**Decision taken:** Include all 5 members. HOH signs for the 2 minors in the signature column.
This matches HACH practice and federal HCV rules — all household members must declare status.
The PRD's parenthetical "(confirm if inventory says otherwise)" explicitly invited this correction.

### ES page size: 792pt, not 790pt

The EN citizenship declaration and both briefing certs are 612×790pt. The ES citizenship
declaration page (page 20 of source packet) is 612×792pt — standard letter height. This
required a separate `page_dimensions` entry in the ES field map.

### briefing-cert-en.NOTES.md already referenced `extract-text-coords.py` not `extract_text.py`

PRD-22 refers to `scripts/extract_text.py` (with coordinate-dump mode). The actual script in use
is `scripts/extract-text-coords.py` (purpose-built pdfminer wrapper with bounding boxes). The
notes reflect the actual tool name. `extract_text.py` also exists but is not the coordinate-dump
tool.

### stamp-form.mjs extended with `row_pattern` block (Commit 3 scope)

As anticipated in PRD-22 Phase 3 option "if Pattern B, extend stamp-form.mjs." The extension is
additive — existing `briefing-cert-en.json` and `briefing-cert-es.json` still work unchanged
because they have no `row_pattern` block.

### Sample data files per-form, not a single maria-household.json for stamping

`scripts/sample-data/maria-household.json` is the canonical household reference. Separate
per-form data files (`citizenship-declaration-en.json`, `citizenship-declaration-es.json`) contain
the flat stamping data expected by `stamp-form.mjs`. This is intentional: the canonical JSON uses
a rich nested structure (member objects with `is_adult`, `relationship`, etc.) while the stamp
data files use the minimal keys the field map's `member_key` references need.

---

## 3. Decisions Resolved During Build

### Table pattern: Pattern B (Templated Rows)

**Choice: Pattern B.** Rationale: The table has 9 structurally identical rows with a constant
row pitch of ~18.2pt. Pattern B expresses this as `row_start_y - i * row_pitch`, requiring one
column definition set instead of 54 explicit field entries (9 rows × 6 fields each). Pattern B
also generalizes directly to `debts_owed_phas` (each-adult signatures), the main application
household roster, and any other repeating table. The extensibility benefit over Pattern A is
immediate and proven across both EN and ES forms in this pilot.

### Render script language: Python

**Choice: Python.** pymupdf is a Python library; calling it from Python directly (one process,
no subprocess overhead) is simpler and more reliable than spawning a `python` subprocess from
Node. The script is ~75 lines with no config files, single-purpose CLI, consistent with the PRD
target of ~50 lines.

### Citizenship Declaration scope: All members (including minors)

As documented in §2 above. The inventory is unambiguous. Including minors is correct per form
instructions and federal HCV policy.

### scripts/output/render/ gitignore policy

`scripts/output/render/*.png` is gitignored. The 4 pilot reference PNGs are excepted with
`!scripts/output/render/{name}.png` entries in `.gitignore`. The extract directory
(`scripts/output/extract/`) is fully gitignored.

---

## 4. Visual Verification Findings

### briefing-cert-en (re-render of existing pilot)

PASS on first render. Name on underline, signature in signature box, date on date line. No
adjustment needed.

### briefing-cert-es

PASS on first stamp attempt. The ES form labels are ~8–10pt higher on the page than EN (Spanish
text is more verbose, compressing the body and pushing the signature block up). Label y-offsets
applied correctly using the same +14pt logic: name at y=202, signature at y=192/h=30, date at
y=163. No iteration needed.

### citizenship-declaration-en

**4 iterations** on the HOH certification signature:
- y=133: too low, overlapped body paragraph text above box
- y=138: still overlapping
- y=148: 1pt above box top (box top pm_y=147), too high
- y=132, h=12: sits inside HOH cert box, overlays the label as expected for a filled form. PASS.

The member table rows were correct on the first attempt. The pattern B row_pattern placed all 5
members correctly with accurate checkbox selection (status 1 vs status 2).

### citizenship-declaration-es

PASS on first attempt. Coordinate deltas from EN applied correctly (row_start_y=352 vs 347,
HOH cert y=125 vs 132). The ES page height of 792pt vs EN's 790pt caused no observable offset
because the extra 2pt is in the top margin where there are no fillable fields.

---

## 5. Time Spent per Commit

| Commit | Estimated time |
|--------|---------------|
| Commit 1 — Toolchain | ~20 min |
| Commit 2 — briefing-cert-es | ~25 min |
| Commit 3 — Citizenship Declaration | ~60 min (table coordinate measurement + Pattern B implementation + 4-iteration HOH cert calibration) |
| Build report | ~20 min |
| **Total** | **~125 min** |

---

## 6. Open Questions for Alex

1. **Minors on Citizenship Declaration** — confirmed all 5 members included (HOH signs for
   minors). Do you want to verify this matches HACH's actual intake practice before PRD-23?
   The form language is unambiguous but HACH staff may have a different workflow.

2. **HOH signature on Citizenship Declaration overlays the label** — the signature image sits
   on top of the "Head of Household Signature" printed text (same behavior as the briefing cert).
   Is this acceptable for HACH reviewers, or should we add blank whitespace behind the signature
   image to mask the underlying label text?

3. **ES citizenship declaration page height 792pt vs EN 790pt** — this is a minor inconsistency
   in the source packet. Not a problem for the overlay approach, but worth flagging for HACH in
   case they re-issue the packet.

4. **Sample signature image** — `docs/templates/sample-signature.png` is used for all members
   in the pilot. In production, each member will have their own captured signature. The stamp
   architecture handles this correctly (per-row `signature` key in the data array). No code
   change needed.

5. **Per-form data files vs maria-household.json** — the current approach uses per-form stamp
   data files. For PRD-24+, the runtime system will need to hydrate these from the database
   application record. The `maria-household.json` structure (with `members[]`, `adults[]`,
   `hoh.*`) is the proposed canonical shape for that hydration. Confirm before PRD-24 schema work.

---

## 7. Recommendations for PRD-23

### Easy forms (single-page, few fields, HOH-only)

- **briefing_docs_certification** (EN page 37) — already piloted, trivial
- **obligations_of_family** (EN page 23) — 5 fields, HOH-only, single signature block
- **eiv_guide_receipt** (EN page 27) — 2 fields (signature + date), HOH-only
- **hud_92006** (EN page 35) — ~8 fields, single page, no table

### Medium complexity (each-adult, 1 signature block per adult)

- **debts_owed_phas** (EN page 31) — 3 fields × each adult. Can reuse Pattern B row_pattern
  with a simpler 3-column structure. Good second table-style test.
- **hud_9886a** — multi-page, multiple adults sign. Architecture handles it but coordinate
  measurement will take longer.

### Hard forms (multi-page or complex layout)

- **main_application** — multi-page (pages 1–14), multi-section, household roster table,
  income table. Will need the most coordinate work. Recommend piloting one section at a time.
- **hud_1140_oig** — OMB form, multiple pages, dense layout. Lower risk since it's acknowledge-
  only, but layout is complex.

### Source-pending (blocked)

- **vawa**, **reasonable_accommodation**, **healthcare_provider_release**,
  **childcare_expense_verification**, **zero_income_statement** — awaiting source PDFs.
  Zero_income_statement is on HACH's website per inventory note.

### Pattern B reuse

All table-style forms in PRD-23 should default to Pattern B. The `row_pattern` block in
`stamp-form.mjs` is production-ready. Only the column definitions and row_start_y need
measurement per form.
