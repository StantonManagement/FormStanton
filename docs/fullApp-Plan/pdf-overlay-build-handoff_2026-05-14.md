# PDF Overlay Build — Session Handoff

**Date:** May 14, 2026
**Author:** Alex (consolidation after pilot session)
**Status:** Active build — pilot validated, system architecture locked, next-session work packets defined
**Branch:** to be created from `dev` → `feature/pbv-form-execution`
**Last pilot commit:** `c4ffac0` (pilot: briefing-cert-en filled output)

---

## 1. Situation

Stanton Management runs Project-Based Voucher (PBV) conversions for existing tenants — Section 8 awarded directly via Stanton's contract with the Housing Authority of the City of Hartford (HACH), bypassing the 15-year public waitlist.

The full PBV application requires tenants to submit a 33-document package: 14 forms (federal HUD + HACH-specific) plus supporting documentation. Historically this required 1+ hour in-person staff meetings per household and had high abandonment rates due to missing documents, language barriers, and form complexity.

We just solved the form execution piece. The architecture is **PDF overlay**: tenant fills a unified intake in their language, the system stamps their data onto HACH's source PDFs at known coordinates, the output is the federal form with the tenant's data on it. Pilot validated May 14, single form, three iterations, output approved.

The next build is the system that uses this architecture at scale: Phase 1 sectioned intake, Phase 2 review-and-sign, Phase 3 additional-adults signing, all across English, Spanish, and Portuguese.

Strategic context: `form-execution-plan_2026-05-14.md`. Build spec: `05-pbv-form-execution_prd_2026-05-14.md`.

---

## 2. Architecture Overview

**Stack:**
- Next.js App Router (existing)
- Supabase (Postgres + Storage, existing)
- pdf-lib (existing, validated in pilot) — stamp data onto PDFs
- pdfminer.six (Python, existing) — extract source PDF coordinates
- pymupdf (Python, **to install**) — visual verification of stamped output
- react-signature-canvas (existing) — signature capture
- Twilio (in progress) — magic links + SMS resume notifications
- Resend (existing) — email fallback

**Three tenant surfaces:**
- `/pbv/{token}` — tenant portal, magic-link gated, Phase 1/2/3 flow
- `/admin/pbv/{application_id}` — Stanton staff view, supports staff-assisted mode
- `/hach/...` — HACH reviewer portal (separate build, exists, gets a small language-flag UI addition here)

**Key tables to be created:**
- `pbv_applications` — top-level container, status, resume token, language preferences
- `pbv_household_members` — one row per person, citizenship, disability, student flags, signer scope
- `pbv_form_documents` — one row per form per application, stamped PDF path, status
- `pbv_signature_events` — one row per signer per document, audit trail
- `pbv_summary_documents` — Stanton-authored summary doc signed by HOH

Schema details in PRD §4.

**Key modules / scripts:**
- `scripts/stamp-form.mjs` (existing, validated) — CLI: stamps data onto a source PDF using a field map
- `scripts/extract_text.py` (existing) — pdfminer-based coordinate extraction
- `scripts/render-stamped.mjs` (**to build**) — pymupdf-based PDF-to-PNG visual verification
- `scripts/field-maps/{form_id}-{language}.json` (existing for briefing-cert-en, **27 more to produce**)

---

## 3. Build Progress By Component

### Component: PDF-overlay pilot (`form-pdf-overlay-pilot_prd_2026-05-14.md`)
- **Status:** Complete
- **Phases complete:** All 5 (setup, field map, stamping script, run + iterate, report)
- **Key commits:** `887b656`, `da9e9b0`, `db3bf49`, `c4ffac0`
- **What works:** Stamping mechanism end-to-end. Pdfminer coordinate extraction. Iteration loop with re-extraction verification.
- **What doesn't:** Visual verification was Alex-eyeball-based, not programmatic. pymupdf install gap remains.
- **Output:** `docs/templates/briefing-cert-en-filled.pdf`

### Component: System PRD (`05-pbv-form-execution_prd_2026-05-14.md`)
- **Status:** Complete, written, awaiting build
- **What's in it:** Three-phase tenant flow, full data model, form generation pipeline, save-and-resume, staff-assisted mode, summary doc handling, implementation phases A–I

### Component: Remaining field maps (Phase B in PRD)
- **Status:** Not started
- **Scope:** 13 forms × 2 languages = 26 maps (briefing-cert-en already done, briefing-cert-es needed)
- **Method:** Use the pilot's pdfminer playbook documented in `scripts/field-maps/briefing-cert-en.NOTES.md`
- **Estimated time:** 30–60 min per form for simple forms; 1–2 hours for complex forms (Citizenship Declaration table, Obligations of Family, intake form)

### Component: Data model & API (Phase C in PRD)
- **Status:** Not started
- **Dependencies:** None — can start immediately

### Component: Phase 1 / 2 / 3 UI (Phases D, E, F in PRD)
- **Status:** Not started
- **Dependencies:** Data model + API in place

### Component: Summary document content (Phase G)
- **Status:** Not started, **author = Alex + Dan, not Cascade**
- **Dependencies:** Dan availability for joint drafting session
- **Translation:** Once English locked, commission PT and ES from professional translator

---

## 4. Critical State — Safe vs Not-Safe to Touch

### Safe to touch / extend
- `scripts/stamp-form.mjs` — well-tested in pilot, extend for image stamping / checkbox stamping as needed
- `scripts/extract_text.py` — pdfminer wrapper, extend to dump labels with coordinates for any source PDF
- `scripts/field-maps/briefing-cert-en.json` — reference implementation
- Schema migrations directory — none exist yet for PBV tables, all greenfield

### Do not touch without explicit approval
- `docs/templates/Full Application Package (5-28-2025 bilingual).pdf` — source of truth, read-only
- `docs/templates/briefing-cert-en.pdf` — extracted pilot source, read-only
- `docs/templates/briefing-cert-en-filled.pdf` — pilot output artifact, do not regenerate without Alex
- Any existing route under `/admin/*` not related to PBV — out of scope
- HACH reviewer portal (`/hach/*`) — exists separately, only the language-flag UI addition is in scope here

### Migrations applied: none (PBV tables are all new)

### Schema changes proposed but not applied
- All five tables in PRD §4 are pending build

### Feature flags / env vars
- None currently for PBV. Add as needed during build.

---

## 5. Open Decisions Awaiting Human Input

Full detail in `dan-hach-decision-log_2026-05-14.md`. Summary:

| # | Decision | Owner | Blocks | Default if forced |
|---|---|---|---|---|
| 1 | HACH acceptance of stamped-PDF output | Dan → HACH | Production launch | Proceed; rebuild fallback exists |
| 2 | HACH acceptance of PT-UI / ES-output flow | Dan → HACH | Production launch for PT tenants | Proceed; commission PT translations if rejected |
| 3 | Bulk-sign vs per-form-sign requirement | Dan → HACH | Sign UX build | Default to bulk-sign with per-form flag fallback |
| 4 | Identity verification standard for non-HOH signers | Dan | Non-blocking | Typed name + signature + IP + timestamp |
| 5 | Summary document content | Alex + Dan | Phase G build | Build pipeline; populate later |
| 6 | HACH review of summary doc | Alex | Non-blocking | Share when drafted |
| 7 | Magic-link-per-adult expiration | Alex | Non-blocking | 30 days |

---

## 6. Active Risks

Ranked by severity × likelihood.

**1. HACH rejects stamped-PDF output format.** Severity: high (rebuild cost). Likelihood: low. Mitigation: confirm via Dan early. Fallback paths exist (AcroForm fields, DocuSeal adoption).

**2. Summary document content takes longer than estimated.** Severity: medium (delays launch, not architecture). Likelihood: medium. Drafting tone-correct multilingual legal-adjacent content is slow. Mitigation: start drafting immediately, parallel to engineering.

**3. Complex forms reveal coordinate-mapping is harder than pilot suggested.** Severity: medium. Likelihood: medium. Citizenship Declaration table and Obligations of Family multi-field signature blocks haven't been piloted. Mitigation: pilot a hard form (recommended: Citizenship Declaration) before scaling to all 26.

**4. pdfminer coordinate extraction fails on some source PDFs.** Severity: medium. Likelihood: low. Some PDFs have compressed text streams; pilot worked because we have Python+pdfminer available. Some forms may have non-extractable text and require visual coordinate-picking.

**5. Visual fidelity issue invisible to analytical verification.** Severity: medium. Likelihood: low after pymupdf adoption. Pilot's analytical verification confirms math is right but doesn't catch "underline is 5pt above where I assumed." pymupdf renders PDF to PNG for true visual verification.

**6. Tenant signature-on-HOH-device disputed later.** Severity: low (audit trail is robust). Likelihood: low. Each signature event captures typed name, IP, timestamp, user agent, device-owner flag. Mitigation: identity verification standard (Decision 4) addresses if Dan wants stronger.

**7. Save-and-resume token leaked / forwarded.** Severity: low-medium. Likelihood: low. Tokens are opaque, 30-day expiration. Mitigation: token expiration is enforced; staff can revoke.

**8. Twilio SMS delivery failure for resume notifications.** Severity: low. Likelihood: low. Resend email fallback exists.

**9. AI hallucination in summary document content if Cascade drafts.** Severity: high. Likelihood: high if Cascade drafts. Mitigation: **content is human-authored, not Cascade-generated.** Explicit rule.

**10. Coordinate drift between source PDF versions.** Severity: low. Likelihood: low. HACH source PDFs are versioned (e.g., "Rev 3/28/2025"). If HACH updates a form, field map needs re-derivation. Mitigation: each field map records source PDF hash.

---

## 7. Next Session Starting Points

Three recommended next-session work packets, sized for ~1–2 hours of Cascade autonomous work each.

### Packet A — Toolchain hardening (~1 hour)
- Install pymupdf in Python environment (`pip install pymupdf`)
- Write `scripts/render-stamped.mjs` (or `.py`) that takes a PDF path and outputs PNGs per page
- Verify by re-rendering `docs/templates/briefing-cert-en-filled.pdf` to PNG and confirming visually
- Update `scripts/field-maps/briefing-cert-en.NOTES.md` to reflect pymupdf addition
- Commit: "tooling: add pymupdf visual verification"
- **Why this first:** every subsequent form mapping benefits from automated visual verification. Closes the manual-eyeball-required loop.

### Packet B — Spanish version of briefing cert (~1 hour)
- Extract page 38 from full source packet to `docs/templates/briefing-cert-es.pdf`
- Apply pdfminer playbook to derive coordinates for the Spanish version (likely similar but not identical to English)
- Write `scripts/field-maps/briefing-cert-es.json`
- Stamp with same Maria Garcia-Rodriguez sample data
- Render output to PNG via Packet A toolchain, save for Alex review
- Commit: "field-map: briefing-cert-es"
- **Why this second:** validates bilingual coordinate-mapping. Confirms whether ES needs its own field map or can share with EN.

### Packet C — Hard-form pilot: Citizenship Declaration (~1.5–2 hours)
- Extract pages 19–20 from full source packet (EN + ES Citizenship Declaration)
- This form has a TABLE with per-row signature columns — fundamentally different from briefing-cert structure
- Apply pdfminer playbook; document how table-cell coordinates are handled in NOTES
- Stamp with sample data: 3 household members, each with name + DOB + status checkbox + signature
- Render output via Packet A toolchain
- Commit: "pilot: citizenship-declaration table-style stamping"
- **Why third:** validates the architecture against the worst structural case in the packet. If this works, the remaining 12 forms are mechanical labor.

---

## 8. Things NOT To Do In Next Sessions

Repeating the guardrails from prior sessions plus additions from this build:

- **No real SMS or email** (Twilio/Resend execution) — keep stubs
- **No tenant-facing route changes outside `/pbv/*`** — don't refactor unrelated UI
- **No modifications to existing HACH reviewer portal** (`/hach/*`) beyond the additive language-flag UI
- **No modifications to existing Stanton admin compliance matrix** beyond additive
- **No status auto-advance logic** without explicit approval
- **No Cascade-generated content for the summary document** — Alex + Dan author the actual text
- **No new npm dependencies** outside what's already in package.json + pdf-lib + pymupdf (Python)
- **No modifications to source PDFs in `docs/templates/`** — always extract to a new file, never edit the source packet
- **No SSN exposure** — store encrypted, log access
- **No skipping audit trail capture** on signature events — every signature event needs typed name + signature + IP + timestamp + document hash, no exceptions
- **No assuming HACH's preferences** on Decisions 1–3 — proceed on defaults but flag clearly that HACH confirmation is pending

---

## 9. File Index

### Documentation
```
docs/
  NORTH_STAR.md                                       # strategic frame
  form-html-rendering-pilot_prd_2026-05-14.md         # abandoned approach (reference)
  form-pdf-overlay-pilot_prd_2026-05-14.md            # completed pilot PRD
  05-pbv-form-execution_prd_2026-05-14.md             # ACTIVE build spec
  04-post-approval-execution_prd_2026-05-13.md        # Stage 6 PRD (reuses this architecture)

docs/project-knowledge/
  form-execution-plan_2026-05-14.md                   # strategic plan
  pdf-overlay-validated_2026-05-14.md                 # status memo
  dan-hach-decision-log_2026-05-14.md                 # decisions awaiting humans
  pdf-overlay-build-handoff_2026-05-14.md             # THIS FILE
```

### Source PDFs
```
docs/templates/
  Full Application Package (5-28-2025 bilingual).pdf  # source packet (read-only)
  briefing-cert-source.pdf                            # 2-page extract (EN+ES)
  briefing-cert-en.pdf                                # 1-page EN extract (pilot source)
  briefing-cert-en-filled.pdf                         # PILOT OUTPUT, validated
  sample-signature.png                                # sample signature PNG (pilot artifact)
```

### Scripts (existing)
```
scripts/
  stamp-form.mjs                                      # CLI stamper, validated in pilot
  extract_text.py                                     # pdfminer text + coords extraction
  extract-briefing-cert.ts                            # one-off pilot extraction
  read-pdf-text.ts                                    # pdfjs-dist-based (limited utility)
  field-maps/
    briefing-cert-en.json                             # PILOT FIELD MAP
    briefing-cert-en.NOTES.md                         # methodology notes
  sample-data/
    briefing-cert-en.json                             # sample data for pilot
```

### Scripts (to build)
```
scripts/
  render-stamped.mjs (or .py)                         # pymupdf visual verify [Packet A]
  field-maps/
    briefing-cert-es.json                             # [Packet B]
    briefing-cert-es.NOTES.md
    citizenship-declaration-en.json                   # [Packet C]
    citizenship-declaration-es.json
    {form_id}-{language}.json × ~22 more              # remaining forms
```

### Commits on `feature/pdf-overlay-pilot` (current state of work)
- `887b656` — pilot: setup pdf-overlay pilot artifacts
- `da9e9b0` — pilot: define briefing-cert field map
- `db3bf49` — pilot: build stamp-form script
- `c4ffac0` — pilot: briefing-cert-en filled output

---

## 10. Glossary

- **PBV** — Project-Based Voucher. Section 8 awarded to a specific unit, transferable only by HACH approval. Bypasses the open waitlist.
- **HCV** — Housing Choice Voucher. The general voucher program. PBV is a subset.
- **HACH** — Housing Authority of the City of Hartford. Our local PHA partner.
- **PHA** — Public Housing Authority. Generic term for any local housing authority.
- **HUD** — U.S. Department of Housing and Urban Development. Issues federal forms (HUD-9886-A, HUD-52675, HUD-92006, HUD-1140-OIG, HUD-1141-OIG).
- **HAP contract** — Housing Assistance Payment contract. Executed at North Star Stage 7; the terminal event. Landlord, tenant, and HACH all sign; HACH starts paying.
- **HOH** — Head of Household. Primary applicant, must be 18+, signs on behalf of household for some forms.
- **HOTMA** — Housing Opportunity Through Modernization Act of 2016. Drives some recent form changes (HUD-9886-A v. 2024).
- **AMI** — Area Median Income. Drives income eligibility thresholds.
- **EIV** — Enterprise Income Verification. HUD's system for cross-checking tenant-reported income against employer/SSA/IRS data.
- **OMB** — Office of Management and Budget. Issues control numbers on federal forms; some HACH forms cite expired OMB numbers (pending: get updated versions from HACH).
- **RFTA** — Request for Tenancy Approval. Stage 6 form.
- **MSA** — Mutual Separation Agreement. Not currently in scope.
- **Magic link** — opaque URL token that resolves to a specific tenant + application server-side, no login required.
- **Field map** — JSON file mapping field names to PDF coordinates (x, y, page, type, font_size, width, height). One per form per language.
- **Stamping** — placing text or images onto a PDF at known coordinates via pdf-lib, without modifying the source PDF.
- **Preferred language** — the language the tenant interacts with (UI, summary doc). Stored on tenant profile.
- **Submission language** — the language of the federal forms in the package (EN or ES). PT-speakers default to ES because HACH doesn't have PT-translated federal forms.
- **Same-device signing** — multiple household adults sign on one device, typically the HOH's phone, handed across the table.
- **Staff-assisted mode** — staff (Will, typically) fills the intake on the tenant's behalf in the lobby, then hands the device to the tenant for the actual signature ceremony.
- **Foundation review** — HACH's review of a submitted PBV application. Distinct from later inspection/approval steps.
- **Bulk-sign** — single signature ceremony applied to multiple forms.
- **Per-form sign** — separate signature ceremony per form (HACH may require this; pending Decision 3).
