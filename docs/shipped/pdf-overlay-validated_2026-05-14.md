# PDF Overlay Architecture — Validated

**Date:** May 14, 2026
**Author:** Alex
**Status:** Architectural decision locked
**Audience:** Future-Alex, Dan, future Cascade sessions
**Reads with:** `form-execution-plan_2026-05-14.md`

---

## What This Is

Short memo capturing what we tried, what we learned, and what's now load-bearing for the rest of the build. Written so I can hand this to Dan or refer back to it in three months and not re-derive the reasoning.

---

## What We Tried First

The initial approach was HTML+CSS rendering. Each HUD/HACH form would be transcribed into HTML, styled with CSS to match the original, printed to PDF on submission. Reasonable on paper. We had the stack (Next.js, React). AI could do the transcription. CSS print rules handle pagination.

This is in the abandoned PRD at `docs/form-html-rendering-pilot_prd_2026-05-14.md` (v1 and v2). First-pass output revealed it's not going to work.

## Why It Didn't Work

Three failure modes, listed in order of severity:

**Typography drift.** Federal forms use specific fonts (Times-style serif), specific emphasis conventions (bold, not underline, for titles), specific list markers (`1. 2. 3.` numbered, not bullets), specific quote glyphs (curly), specific italics for letterhead. Our HTML output diverged on every one of these. Each individual difference is small. The cumulative effect is "this isn't the form HACH knows." A reviewer scanning for familiar field positions notices.

**Silent transcription errors.** AI transcribing legal text from a PDF will "correct" things it perceives as errors. HACH's source has "I certify that I have received the following documents the Housing Authority of the City of Hartford" — yes, missing "from." AI helpfully inserts "from the." Similar substitutions: "What You Should Know" instead of "Things You Should Know." "Is it Worth It?" instead of "Is Fraud Worth It?" Each one a small AI hallucination, each one changes what the tenant is signing.

**Recreate-the-form treadmill.** Roughly 80% of every form is fixed content — legal text, letterhead, boilerplate, footers. Recreating that 80% in HTML is the work, and it never stops. Every new form means another round of transcription, layout, typography tuning, page-break verification. For 14 forms × 2 languages = 28 templates, this is weeks of labor producing something that's always *almost* right.

## What We Pivoted To

PDF overlay. Keep HACH's source PDF as the canvas. Stamp only the variable data (tenant's typed values, signature image, date, checkbox marks) at known coordinates. The output PDF is the source PDF with annotations on top. The 80% of content we don't need to touch never gets touched.

This is how every PDF e-signature tool works (DocuSeal, DocuSign, Adobe Sign). We're not inventing — we're adopting the standard approach.

## What The Pilot Proved

One form (Family Certification of Briefing Documents Received, English page), three fillable fields (HOH printed name, signature image, date), three coordinate iterations, ~30 minutes of Cascade autonomous time, output PDF visually verified by Alex.

The output has Maria Garcia-Rodriguez on the printed name line, a cursive signature image on the signature line, "2026-05-14" on the date line. The HACH letterhead, the eight numbered documents, the obligations bullets, the bold footer warning, the italic address lines, the "Rev 3/28/2025" — all of it unchanged from the source, because we didn't touch the source.

Pilot output: `docs/templates/briefing-cert-en-filled.pdf`
Commits: `887b656` → `da9e9b0` → `db3bf49` → `c4ffac0`

## The Playbook That Emerged

Cascade improvised a useful toolchain during the pilot. Worth documenting because it generalizes:

1. **Extract source coordinates with pdfminer.six (Python).** For any blank form, run `extract_text.py` (already in `scripts/`) with a modification to dump label text + bounding boxes. Output: every text element on the page with its `(x, y, x1, y1)` coordinates.

2. **Derive field positions from label positions.** For a labeled signature line like "Head of Household Printed Name" at `y=179.5`, the actual fill underline is ~12–14pt above the label. The tenant's typed value sits at the underline baseline. This holds across HUD forms because they share layout conventions.

3. **Stamp with pdf-lib (Node).** For text fields, `page.drawText()` at coordinates with specified font size. For images (signatures), `page.drawImage()` at coordinates with width/height. Output is a new PDF, source PDF unmodified.

4. **Verify by re-extracting with pdfminer.** Run the same extraction on the *filled* PDF and confirm stamped values appear where expected relative to their labels. This is analytical verification — confirms math is right, doesn't confirm the underline is where we assumed.

5. **Visual verification (still TODO).** The pilot used Alex's eyes for final check. For scaling, install `pymupdf` so Cascade can render PDF to PNG programmatically and verify visually.

This playbook applies to every form in the packet. The hard part is per-form coordinate identification, which is bounded labor — not an open-ended typography fight.

## What This Architecture Buys Us

- **Perfect fidelity** on the static 80% of every form. Zero CSS tuning. Zero transcription risk.
- **$0/year ongoing cost.** No DocuSeal. No hosted infrastructure. pdf-lib is MIT-licensed, runs in our existing Next.js + Node stack.
- **Full control of the tenant UX.** The fill experience is our HTML; the *output* is the federal PDF. Best of both worlds.
- **Audit trail in our database.** Signature events, timestamps, IPs, identity captures. We own this, not a SaaS vendor.
- **Bilingual / trilingual for free.** Different language source PDF = same overlay code. Portuguese-via-Spanish (see plan doc) costs us nothing extra.

## What's Still Uncertain

A few things the pilot didn't test:

- **Complex form types.** Briefing Cert is the simplest form in the packet. The Citizenship Declaration has a multi-row table where each row has its own signature column. The Obligations of Family has a multi-field signature block (name, date, phone, address). The intake form is multi-page. These haven't been piloted. [Inference] The architecture handles them — DocuSeal handles them — but per-form coordinate maps will be more involved.

- **Checkboxes.** pdf-lib draws text and images. Toggling a checkbox means drawing an "X" or a filled square at a coordinate. Workable, but the visual fidelity needs to match what reviewers expect.

- **Visual verification at scale.** Analytical verification (coordinates land where math says) is not the same as visual verification (text sits on the actual underline). For the pilot, Alex's eyes closed the gap. For 28 field maps, we need pymupdf.

- **HACH formal acceptance.** [Unverified] HACH has not been asked whether they accept stamped-PDF output instead of traditionally-filled paper. The output is the federal form with data on it — there's no obvious reason for rejection — but we should confirm before production.

- **Edge cases on the source PDF.** Some federal forms in the packet have unusual coordinate spaces (one page came in at 612×790pt instead of standard 612×792pt). Each form needs to be checked once.

## What This Means For The Build

The architectural risk is closed. The remaining risk is execution risk — labor to produce 28 field maps, content to write the summary documents, coordination to confirm HACH acceptance. None of it requires new architecture.

The build PRD (`docs/05-pbv-form-execution_prd_2026-05-14.md`) assumes this architecture. The handoff doc (`docs/project-knowledge/pdf-overlay-build-handoff_2026-05-14.md`) lists the specific next-session work packets. The decision log (`docs/project-knowledge/dan-hach-decision-log_2026-05-14.md`) lists what needs Dan's input.

Six weeks ago this was an unsolved problem. It is now a solved problem with a path forward.
