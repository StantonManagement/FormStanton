# Tenant Journey Audit — 2026-05-17

**Tester:** Claude (Cowork)
**Persona:** Maria Test Tenant
**Token:** `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633`
**Reset by:** Windsurf (just before this session)
**Lens:** Would Maria reach final submission without calling Stanton for help?

---

## TL;DR — Verdict

**No. Maria cannot complete the application.**

Two server-side 500s gate the entire post-intake flow:

- **#12 generate-forms** still 500s — Maria cannot sign her summary. She sees "Failed to generate forms" with a Try again button that also 500s.
- **#13 upload** still 500s — Maria cannot upload any documents. Verified with both chrome-devtools `upload_file` and a programmatic FormData fetch with a real 76-byte PDF. Server returns `{"code":"upload_failed"}` regardless of payload.

Intake itself works end-to-end. Maria can fill the 7 sections, submit, and reach the dashboard. After that, every meaningful next step fails.

**Both 500s have empty/generic response bodies.** The real stack traces are in the dev-server terminal — please paste them so they can be diagnosed.

---

## What Maria actually experienced

### Magic link landing → dashboard (wrong)

Clicking the magic link routed her straight to `/dashboard`, **not** to `/intake`, even though her `intake_status` was `not_started`.

Root cause: the reset cleared `intake_status` and `intake_data` but **did not clear** `intake_submitted`, `signatures_complete`, `next_step`, or `resume_section`. The landing logic reads `intake_submitted=true` and skips intake.

This won't reproduce for a brand-new tenant tomorrow (those fields will be false by default), so it's a **reset-script defect**, not a landing-logic defect. Worth having Windsurf reset those fields too if we want clean repeat testing.

I forced `/intake` directly. From there the flow worked.

### Intake (7 sections) — **passable, with friction**

Clean intake page. Building/unit confirmation, time estimate, 3-step overview, language switcher (EN/ES/PT), autosave, "Pick up later" button. Strong baseline UX.

Section-by-section observations:

1. **About Your Household** — clean. SSN (last 4) field is optional with no `*` marker; most HUD forms require it.
2. **Contact Information** — no `*` markers on any field, but Next stays disabled until cell phone + email are filled. Required fields are not visually marked. Defect.
3. **Income** — Wages/Salary shows a monthly field AND a separate "Estimated annual income ($)" field that does **not auto-compute from monthly**. Maria has to do 2500 × 12 herself or leave it blank. This is the surface that feeds the historical "annual = 0" issue (#2). Even though the bridge fix is in PRD-39 F2, the UX still asks a redundant question that introduces error.
4. **Assets** — only one "Estimated total asset value" field regardless of how many asset types are checked. A user with Checking + Savings + Stocks has to roll their own total.
5. **Childcare & Disability** — clean, optional, fine.
6. **Criminal History** — radio "No" **pre-selected by default** on a felony question. Should be neutral default — pre-selecting "No" on a serious legal question is risky.
7. **Special Circumstances (DV, homeless, RA)** — same pre-selection pattern. "No" defaulted on the domestic-violence question. A DV survivor could click Next and miss her chance to claim protected status. **Serious defect for tenant safety.**

**Section indicator fluctuates.** Started as "Section 1 of 7", became "1 of 9" once I started typing, then settled at "4 of 7" / "7 of 7" by the end. Total step count varies as data changes. From Maria's perspective: she's losing or gaining sections without explanation.

### Review page — multiple raw-enum and copy issues

- Race displayed as `"black"` instead of "Black / African American"
- Ethnicity as `"not_hispanic"` instead of "Not Hispanic / Latino"
- Marital as `"single"`
- Income type as `"employment"`
- Cell phone shown as `"8605557777"` (no formatting)

**Defect #7 confirmed:** TWO "Submit my answers" buttons — one enabled (in main content), one disabled (in footer). Tenant doesn't know which to click. Same as handoff.

**Defect #5 may be fixed:** No Zero Income Declaration section visible on the review page for Maria (wage earner). Worth confirming end-to-end but at least on review side it's correctly hidden.

### Dashboard after intake submit — no reassurance

**Defect #3 confirmed.** No ApplicationStatusBanner. Maria gets no "we got your submission" / "here's what's next" reassurance. She sees a task list with no emotional acknowledgment that anything just happened.

**Defect #6 confirmed.** Dashboard says "0 of 22 uploaded", docs page says "0 of 31 uploaded". Nine-doc discrepancy. Tenant doesn't know which number is real.

### Sign Summary → /sign/summary — **Defect #12 firing**

Console: `[SummarySignPage] generate-forms failed: Error: Failed to generate forms`
Network: `POST /api/t/.../generate-forms 500` (twice — auto-retry), both with empty response bodies.
UI: "Failed to generate forms" + Try again button. Try again also 500s.

Maria has no path forward. She'd close the tab and call Stanton.

### Sign Forms → /sign/forms — **Defect #11 cascading into #12**

Direct nav to `/sign/forms` silently redirects to `/sign/summary` (no message explaining why). Then `/sign/summary` 500s. Two defects, no recovery.

### Documents → /documents — page renders, **uploads fail**

Page loads fine and shows 31 documents grouped into 5 categories.

**Documents not gated by intake responses.** Maria said Wages only + Checking only, but the docs page **requires**:
- SSI Award Letter
- Social Security Award Letter
- Child Support Order
- TANF/Public Assistance Award Letter
- Unemployment/Workers Comp Award Letter
- Self-Employment Contract
- Pension/Railroad Retirement Letter
- Savings Account Statement (she said Checking only)
- Immigration Documents

…all marked "Required." Maria would panic.

**Opaque form names** as predicted by the handoff: HUD-9886-A, HUD-52675, HUD-92006, EIV Guide Receipt, HACH Authorization. No plain-language explanation.

**Defect #13 confirmed and bypass-tested.** Tried uploading via the in-page button (`upload_file` returned 500). Suspected tooling artifact, so re-ran via `evaluate_script` with a real 76-byte PDF as FormData. Same result: `500 {"success":false,"message":"Upload failed. Please try again.","code":"upload_failed"}`. Server is genuinely failing.

### Admin view — **Defect #4 confirmed**

`/admin/pbv/full-applications` shows Maria's row as "Invited — May 15, 2026 — —" (no intake submission date) even though `intake_submitted: true` in the API. Compare to Richie Rich row, which correctly shows "Intake Submitted — May 14, 2026 May 14, 2026". Bridge is updating the application record but not the admin list view's status/intake column.

---

## Defect rollup

| # | Status | Severity | Description |
|---|---|---|---|
| **12** generate-forms 500 | **OPEN — still firing** | **BLOCKER** | Empty 500 body. Need dev-server stack trace. |
| **13** upload 500 | **OPEN — still firing** | **BLOCKER** | Verified with real FormData. Need dev-server stack trace. |
| #11 silent /sign/forms redirect | **OPEN — confirmed** | High | Bounces to /sign/summary with no message. Cascades into #12. |
| #3 missing ApplicationStatusBanner | **OPEN — confirmed** | High | No post-submit reassurance. |
| #4 admin "Invited" not "Intake Submitted" | **OPEN — confirmed** | High | Maria's row shows Invited and — — for intake column. |
| #6 doc count mismatch 22 vs 31 | **OPEN — confirmed** | Med | Tenant confusion. |
| #7 two Submit buttons on Review | **OPEN — confirmed** | Med | One enabled, one disabled. |
| Section indicator fluctuates | **NEW** | Med | "1 of 7" → "1 of 9" → "4 of 7" depending on input. |
| Required fields not marked with `*` | **NEW** | High | Section 2 contact form. Possibly more. |
| Pre-selected "No" on DV / felony / homeless / RA | **NEW** | **High** | Tenant-safety defect. Survivors / accommodation-needers could miss. |
| Annual income not auto-computed from monthly | **NEW** | Med | Surface feeding historical #2. |
| Documents not gated by intake responses | **NEW** | High | Maria asked for SSI, TANF, Immigration, etc. she doesn't have. |
| Opaque HUD form names | (from handoff) | Med | HUD-9886-A, EIV Guide, etc. — no plain-language. |
| Raw enums on Review page | **NEW** | Med | "black" / "not_hispanic" / "single" / "employment". |
| Cell phone unformatted on Review | **NEW** | Low | "8605557777" |
| One asset-value field for multiple asset types | **NEW** | Low | UX assumption issue. |
| Reset script leaves stale flags | **NEW (dev)** | Med | intake_submitted / signatures_complete / next_step / resume_section not cleared. |
| #5 Zero Income Declaration leaking | Possibly fixed | — | Not visible on review for wage earner. Worth verifying admin side. |
| #1, #8, #9 from handoff | Pre-resolved | — | Already verified in prior walkthrough. |
| #2, #10 | Not retested | — | Gated by #12/#13. |

---

## Recommendation for tomorrow

**Do not give a tenant the application link until #12 and #13 are fixed.** Even with everything else, those two block all post-intake progress. A real applicant would hit a wall, get no error context, and call Stanton (or worse, give up).

If we must demo: walk a tenant through intake-only and stop at the "submitted" dashboard. Set expectation that signing/upload are still in dev.

Practical next steps in priority order:

1. **Paste the dev-server stack traces for #12 and #13.** Both 500s have empty bodies; the actual errors are in the terminal log. Without those, fixes are guesswork.
2. **Fix the reset script** to also clear `intake_submitted`, `signatures_complete`, `next_step`, `resume_section`. Otherwise repeat testing keeps hitting the dirty-state routing issue.
3. **Gate the documents page by intake responses.** Only require docs that match declared income/assets.
4. **Audit pre-selected defaults** on DV / homeless / felony / RA — neutral default required for tenant safety.

---

## What I did NOT verify

- Defect #10 print view (gated by #13 — no docs to print).
- Defect #2 admin annual income column (Maria's row is post-reset and stale; would need a fresh end-to-end submission).
- /sign/additional-signers UX (Maria is single-household — flow correctly says "All adults have signed").
- HACH portal data gap (no creds provided).
- Multi-language tenant flow (EN-only walked; ES / PT not tested).
