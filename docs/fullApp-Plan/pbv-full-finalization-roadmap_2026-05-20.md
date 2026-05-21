# PBV Full-App — Finalization Roadmap (vNext)

**Date:** 2026-05-20
**Author:** Alex + Claude (Cowork)
**Status:** Master plan — awaiting breakdown sign-off, then child PRDs go to Windsurf
**Reads with:** `NORTH_STAR.md`, `docs/fullApp-Plan/form-execution-plan_2026-05-14.md`, `docs/IN-FLIGHT.md`

---

## Why this document exists

The tenant PBV full-app has had a lot of good work land in pieces (PRDs 22–54) but kept slipping on "can a real applicant actually get from the SMS link to a submitted, signed packet without calling Stanton?" The answer has been *no* for various reasons at various times. PRD-54 just cleared the last hard server-side blocker (forms now generate; signing transition works).

This roadmap picks **one lane** — the tenant self-serve full-app, end to end — and sequences everything still standing between "signing works" and "done," as a small set of dependency-ordered child PRDs. No shortcuts: each gap gets a real fix, not a flag-it-for-later. The only things deferred are work that is genuinely *out of this lane* (staff/HACH side) or *externally blocked* (source PDFs Stanton doesn't have yet).

---

## Definition of Done (the lane)

**A real applicant can go from the SMS link to a complete, correct, submitted, signed packet — on their own phone, in their own language — without calling Stanton, and without hitting a tenant-safety defect.**

Concretely, "done" means all of these are true on production:

1. Intake can be completed by a real tenant without confusing or unsafe defaults, in EN/ES/PT.
2. The documents step asks only for what the tenant's answers imply, in plain language they understand.
3. Every required form generates with the tenant's data correctly stamped (no silent skips of forms that should exist).
4. The tenant signs once, that signature applies to every form they're the required signer for, and additional adults can sign (same device or their own link).
5. The application can be submitted, is locked after submission, and the tenant can download their copy.
6. All of the above works end-to-end in **English, Spanish, and Portuguese**.
7. The document scanner reliably captures pages on real phones, and tells the tenant *why* when it can't lock onto a page.

### Scope decisions (locked 2026-05-20)

| Dial | Decision |
|---|---|
| **Finish line** | **Tenant submit only.** Staff/admin-view correctness and HACH-handoff polish are out of this lane. |
| **Scanner** | Keep + finish the **advanced edge-detection scanner** (already on main). Add a transparent on-screen hint when it can't lock onto the document (low-contrast / lighting guidance). Scanic (PRD-52) stays a separate track. |
| **Languages** | **Full EN / ES / PT** verified end-to-end. |
| **Conditional forms** | pet / vehicle / self-employment forms (source PDFs exist) are **in**. VAWA, Reasonable Accommodation, healthcare-provider release stay **source-pending / feature-flagged off** — blocked on external PDFs + Dan policy, not a shortcut. |

### Explicitly OUT of this lane (deferred, not dropped)

- Staff/admin list-view accuracy (e.g. "Invited" vs "Intake Submitted" column), HACH reviewer portal, HACH handoff/print posture.
- Scheduling, pipeline dashboard, post-approval signing (North Star Stages 6–7).
- `tenant_lookup` retroactive migration (infra hygiene; non-blocking for the tenant flow — tracked in IN-FLIGHT).
- Scanic detector swap (PRD-52) unless device-matrix verification proves the current detector too heavy/unreliable.

---

## Current state (verified 2026-05-20)

### Working on production now (verified live via Chrome DevTools)

- `generate-forms` produces all 9 core forms with `main_application` included (PRD-54 Bug C fix). `total_generated: 9`.
- `/sign/summary` renders the summary PDF and is signable.
- `/sign/forms` shows a proper "sign your summary first" gate + CTA — the old silent-redirect (defect #11) is resolved.
- Dashboard shows the status banner, coherent doc counts ("11 of 11" + optional), and correct task gating (summary → forms locked → submit disabled until complete).
- The 05-17 hard blockers — generate-forms 500 (#12), upload 500 (#13), silent /sign/forms redirect (#11) — are resolved.

### Open gaps feeding this roadmap

| # | Gap | Evidence | Status |
|---|---|---|---|
| G1 | `briefing_cert` never generates — form_id (`briefing_cert`) ≠ source-pdf registry key (`briefing_docs_certification`) | Live generate-forms `skipped` + `source-pdfs.ts` | Confirmed; intended-behavior [Unverified] |
| G2 | Dashboard banner says "Application Submitted / received" while summary unsigned + Submit disabled | Live dashboard snapshot | Observed; root cause [Inference]: keyed on `intake_submitted` |
| G3 | Documents page: opaque federal names + wrong categorization (No Child Support Affidavit + EIV Guide under "IDENTITY"; grab-bag "OTHER DOCUMENTS") | Live documents snapshot | Observed |
| G4 | Documents required-set not gated by intake responses (05-17: 31 required incl. SSI/TANF/Immigration not declared) | Tenant journey 05-17; live shows tailored 11 → may be improved | [Unverified] — verify gating rules |
| G5 | Intake tenant-safety: "No" pre-selected on DV / felony / homeless / RA; required fields unmarked; raw enums + unformatted phone on review; annual income not auto-computed; single asset field | Tenant journey 05-17 | [Unverified] current — no PRD known to have addressed |
| G6 | Per-form signing → signed-PDF storage → audit events → multi-signer → submission lock not verified end-to-end | Gated behind signing summary (not walked on prod) | [Unverified] |
| G7 | ES / PT tenant flow never walked end-to-end | Tenant journey 05-17 ("EN-only walked") | [Unverified] |
| G8 | Scanner: advanced detector present on main but device-matrix gates deferred; no contrast/can't-lock guidance | PRD-47/52 deferred gates; main tree | Partially built |

---

## The child PRDs (sequenced)

Seven PRDs. Each is a standalone Windsurf build with its own verification gates. Numbering continues the repo sequence (55–61). Naming follows convention: `<NN>-pbv-<slug>_prd_2026-05-20.md` + matching `prompts/`.

### PRD-55 — Form-generation completeness & template alignment
**Problem:** Forms can silently skip when a template's `form_id` doesn't line up with its source-PDF registry key or field-map slug (G1). We need a guarantee that every form that *should* generate *does*, and the skip-set is *exactly* the externally-blocked ones.
**Scope:** Confirm intended behavior for `briefing_cert` (stamped PDF vs HTML pilot) and align the key if it should generate; audit all enabled templates for `form_id` ↔ source-pdf key ↔ field-map slug alignment; verify conditional forms (pet / vehicle / self-employment, child-support vs no-child-support mutual exclusion) generate for triggering households; confirm source-pending forms are correctly flagged off.
**Verification:** for representative household profiles, `generate-forms` returns the exactly-correct form set; `skipped` contains only intended source-pending/conditional entries.
**Depends on:** nothing (foundational).

### PRD-56 — Signing & submission end-to-end correctness
**Problem:** The sign → submit chain past the summary is unverified on prod (G6). This is the legal moment; it has to be airtight.
**Scope:** per-form signature capture (draw once, tap-confirm per form), signed-PDF storage, one `pbv_signature_events` row per form (timestamp / IP / document hash); additional-adults / multi-signer (`each_adult` scope) on same device + member-token fallback; submission lock + finalize (idempotent, no double-submit, no post-submit edits); "Download my application copy" yields the correct final packet.
**Verification:** full sign → submit on a multi-adult household; signed PDFs correct; audit trail complete; re-submit blocked.
**Depends on:** PRD-55.

### PRD-57 — Intake integrity & tenant-safety
**Problem:** Intake has unsafe defaults and data-quality traps (G5) that can harm tenants (DV/RA survivors miss protected status) and feed downstream form errors.
**Scope:** neutral defaults on DV / felony / homeless / reasonable-accommodation (nothing pre-selected on protected-status questions); required-field markers + consistent validation; stabilize the fluctuating section count; auto-compute annual income from monthly (kill the redundant field behind the historical "annual = 0" bug); asset-value clarity; review page shows human-readable values (e.g. "Black / African American", formatted phone) and a single Submit button.
**Verification:** intake walk confirms no pre-selected protected-status answers, required fields marked, review page legible, annual income derived.
**Depends on:** nothing (parallel-safe); improves data quality consumed by 55/56.

### PRD-58 — Documents step: clarity + intake-gating + banner fix
**Problem:** The documents step is confusing and possibly over-asking (G3, G4), and the dashboard tells un-submitted tenants they're submitted (G2).
**Scope:** plain-language document names + one-line "what this is" per doc; correct categorization (fix mis-filed items, replace the grab-bag bucket); intake-driven gating so only declared income/asset/household docs are required; fix the dashboard banner to key on *actual* submission, not `intake_submitted`; doc-count coherence across dashboard + documents page.
**Verification:** a tenant who declared only wages + checking is asked only for matching docs; banner reflects true state; names are plain-language; counts match.
**Depends on:** light dependency on PRD-57 (intake answers drive gating).

### PRD-59 — Trilingual EN / ES / PT end-to-end
**Problem:** Only English has been walked (G7); the value prop is fundamentally trilingual.
**Scope:** verify + fix PT/ES UI across intake, dashboard, documents, signing; ES form output correctness (es source PDFs + field maps stamp correctly); language routing per spec (`preferred_language` pt → es output, etc.); summary doc wired in all three languages. **Dependency flag:** real EN/ES/PT *summary content* is authored by Alex + Dan (+ translator), not Claude — pipeline builds against placeholder until content lands.
**Verification:** full SMS-link → submit walk in each of EN, ES, PT.
**Depends on:** PRD-55/56/57/58 stable (this verifies them in three languages).

### PRD-60 — Scanner: device-matrix verification + low-contrast guidance
**Problem:** The advanced edge-detection scanner is on main but its real-device gates were deferred, and there's no feedback when it can't find the page (G8) — Alex's explicit ask.
**Scope:** close the deferred device-matrix gates (iOS Safari + Android Chrome detection, multi-page review, 5-min memory, cold-load timing); **add a transparent on-screen hint when the scanner can't lock onto the document** — e.g. "Can't find the page edges — try more light, or place the page on a darker surface" — wired into the existing stuck/quality detection, in all three languages. Decide Scanic (PRD-52) in/out based on detector performance (default out for v1).
**Verification:** real-device walk on iOS + Android; contrast hint fires on a low-contrast page and clears when a quad locks.
**Depends on:** nothing (parallel track); verify on the same deploy as the rest.

### PRD-61 — End-to-end finalization gate (closeout)
**Problem:** "Done" needs a single acceptance walk that proves the whole lane, not piecemeal checks.
**Scope:** representative households (single adult; multi-adult; with pet/vehicle/self-employment) × EN/ES/PT, SMS link → submit, on a deploy with test tokens; the "real applicant self-serves to submit, no call to Stanton, no tenant-safety defect" acceptance checklist; residual defects either fixed or explicitly logged as out-of-lane.
**Depends on:** PRD-55–60.

---

## Sequencing & parallelism

```
PRD-55 ──► PRD-56 ──────────────┐
PRD-57 ──► PRD-58 ──────────────┤
PRD-60 (parallel track) ────────┼──► PRD-59 (trilingual) ──► PRD-61 (closeout)
                                 │
```

- **Start in parallel:** PRD-55 (forms), PRD-57 (intake), PRD-60 (scanner) — independent surfaces.
- **Then:** PRD-56 (after 55), PRD-58 (after 57).
- **Near the end:** PRD-59 verifies everything in all three languages (so it runs once the EN surfaces are stable).
- **Last:** PRD-61 is the acceptance gate.

Run each in Windsurf per the standard flow (one PRD → build report → verify against gates → next). PRD-55/57/60 can be in flight concurrently if you're moving fast.

## Known dependencies / things only Alex+Dan can unblock

- **Summary doc content** in EN/ES/PT (authoring + translation) — gates PRD-59's content, not its plumbing.
- **`briefing_cert` intended path** (stamped PDF vs HTML pilot) — one decision unblocks PRD-55's first item.
- **Source-pending forms** (VAWA, RA, healthcare release) + 3 HACH policy clarifications — remain out of lane until external PDFs/decisions land.

---

## Open questions before child PRDs are written

1. Does this 7-PRD breakdown and sequence match how you want to attack it, or should any of these be split further / merged?
2. `briefing_cert`: should it generate as a stamped PDF (then PRD-55 fixes the key), or is it intentionally handled by the HTML-rendering pilot (then it stays skipped and we document why)?
