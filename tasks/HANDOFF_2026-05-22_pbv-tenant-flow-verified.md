# HANDOFF — PBV Full-App Tenant Flow: end-to-end fix + verification

**Date:** 2026-05-22
**Branch:** `feat/pbv-post-audit-remediation`
**Scope:** Getting a real tenant from invite → intake → submit → sign summary → sign every federal form → upload evidence → **finalize**, verified by a live browser walkthrough against the local dev server.

---

## UPDATE — 2026-05-22 (later same day, post-handoff)

**eiv finalize is RESOLVED and VERIFIED GREEN on a fresh application.** After the `eiv_guide_receipt` scope DML + a green gate, a brand-new app (`Verify Walk Tester`, token `800-verify-test-ave-unit-vr-1-4GNBHi5qKTrK92tK`) was driven end-to-end via chrome-devtools: intake → submit → sign summary → sign all 11 forms incl. eiv → upload 2 docs → **finalize = HTTP 200, no `missing`.** eiv now propagates via the live `completeForm.ts` HOH branch — proven on the real code path, not a data patch. (The original DML alone did NOT green the *existing* `Final Walk Tester` app — that one signed eiv pre-fix and the template DML isn't retroactive; it needs the migration's section-2a backfill re-run, or just abandon it.)

**Two new issues found during the walk were fixed directly (gate re-run pending):**
- `lib/pbv/tenantEndpoint.ts` — generate-forms (and all tenant routes) returned an opaque empty-body 500 on a thrown handler; wrapped the handler call in try/catch with structured logging + `{code:'server_error'}` body.
- `app/api/t/[token]/pbv-full-app/forms/[form_document_id]/preview/route.ts` — was returning JSON `{url}` which the sign-form iframe rendered as raw text; now serves PDF bytes like `summary-pdf`. Verified live (`200 application/pdf %PDF-1.7`).

**Still needs Alex (native, can't run from sandbox):** (1) re-run `tsc --noEmit` + `npm run build` after those two edits; (2) iOS-Safari real-device check of the PDF iframes (PDF.js is ruled out per `SummaryDocReviewSign.tsx`; fallback if needed = "open in new tab" link); (3) delete `_qa_test_docs/qa_test_id.png`; (4) commit.

---

## TL;DR status

The tenant flow now works end-to-end **except one residual blocker at finalize** (`eiv_guide_receipt`, see Outstanding #1). Everything upstream is fixed and verified live on a fresh application (`Final Walk Tester`, token `700-final-test-ave-unit-ft-2-96ixhAz2C0PbrT5Z`): intake navigation, submit, summary signing, signing all 11 federal forms as a real gated step, evidence upload, conditional doc suppression, and PDF previews now render.

**Two things still need doing:** (1) the one-row `eiv_guide_receipt` scope fix (DML), and (2) a fresh `tsc --noEmit` + `npm run build` because `middleware.ts` and `lib/pbv/finalizeValidation.ts` changed after the last green run.

---

## Bugs fixed this session (all verified live unless noted)

1. **Intake trapped at Section 1.** Every "Next" bounced back to `/intake/household`. Cause: PRP-015's deep-link guard treats `resume_section` as "furthest reached," but the section autosave set it to the *current* section, so each forward step landed one index past the pointer → bounce. Fix: `resume_section` is now a forward-only high-water mark.
   - `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` — autosave never lowers `resume_section`.
   - `app/api/t/[token]/pbv-full-app/intake/progress/route.ts` — **NEW** endpoint, advances the pointer forward, monotonic, behind `withTenantContext`.
   - `app/pbv-full-app/[token]/intake/[section]/page.tsx` — `navigateTo` POSTs `progress` before routing forward.

2. **Summary signing 500.** `pbv_signature_events.form_document_id` was `NOT NULL`, but summary signatures insert `NULL`. Hidden by a no-try/catch opaque 500.
   - Migration `supabase/migrations/20260522120000_pbv_signature_events_nullable_form_document_id.sql` — **APPLIED** to `lieeeqqvshobnqofcdac` via Supabase MCP.
   - `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` — added try/catch (logs the real error instead of empty 500).

3. **Finalize blocked by suppressed docs.** `validateReadyToFinalize` counted `no_longer_required` (conditionally-suppressed) docs as blocking-missing, so any application with conditional suppression could never finalize.
   - `lib/pbv/finalizeValidation.ts` — added `no_longer_required` to `isCompleteStatus`. **(changed after last green build — needs gate re-run)**

4. **"Tenant signs each form" was a no-op.** All generated forms had `required_signer_member_ids = []`, so the sign-forms step auto-completed and the `signed_forms` `application_documents` never got marked → finalize blocked. **Root cause (Windsurf):** `pbv_form_templates.per_person_scope` was a **boolean** column, so every text scope comparison (`'each_adult'`, etc.) fell through to default → empty signers.
   - Windsurf: altered `per_person_scope` to `TEXT`, re-seeded scope values, added migration `supabase/migrations/20260522130000_pbv_sign_form_application_docs_alignment.sql`, and added the dual-write in `lib/pbv/signing/completeForm.ts` (`syncApplicationDocumentsForSignedForm` + `formIdToDocTypes`).
   - Result: forms now require the HOH signer; signing marks the matching `signed_forms` doc `submitted`. **10 of 11 forms propagate correctly.**

5. **Summary + form PDFs render blank.** The "review and sign" iframe showed a broken-document placeholder. Cause: `middleware.ts` set `X-Frame-Options: DENY` on every `/api/t/*` response; the tenant pages embed these PDFs in same-origin iframes and `DENY` blocks all framing.
   - `middleware.ts` — framed PDF endpoints (`…/pbv-full-app/summary-pdf` and `…/pbv-full-app/forms/[id]/preview`) now send `X-Frame-Options: SAMEORIGIN`; rest of tenant surface stays `DENY`. **(changed after last green build — needs gate re-run.)** Verified: summary PDF now renders full content; same fix covers the per-form preview iframes.

---

## Outstanding

1. **`eiv_guide_receipt` — sole remaining finalize blocker.** All 11 forms sign (form_document `signed`, 1/1) and 10 propagate, but `eiv_guide_receipt`'s `application_documents` row stays `missing`. Cause: scope mismatch between the two template tables. `form_document_templates` has eiv as `hoh_only` / `submission` → its doc row is seeded at `person_slot = 0` (grouped with `obligations_of_family`, `briefing_docs_certification`, `hud_92006`, which all work). But `pbv_form_templates.per_person_scope` for eiv was re-seeded to a **per-person** value, so `syncApplicationDocumentsForSignedForm` takes the per-person branch and filters `person_slot = signerSlot (1)` — never matching the slot-0 row.
   - **Fix (one row, DML — apply via Supabase MCP):**
     ```sql
     UPDATE public.pbv_form_templates
        SET per_person_scope = 'head_of_household_only'
      WHERE form_id = 'eiv_guide_receipt';
     ```
   - Optional hardening: make the per-person branch in `syncApplicationDocumentsForSignedForm` also cover submission/slot-0 rows so a future scope mismatch can't silently strand a form.
   - After applying, re-run finalize on token `700-final-test-ave-unit-ft-2-96ixhAz2C0PbrT5Z` (already signed + docs uploaded) — it should go green in one step.

2. **CSP follow-up (latent).** The CSP is currently **report-only** with `frame-ancestors 'none'`, so it doesn't block today. When PRP-001's CSP flips to enforced, `'none'` will re-break the PDF iframes. Set `frame-ancestors 'self'` for the PDF-preview routes when enforcing. (CSP is set outside `middleware.ts` — check `next.config.js`.)

3. **Gate re-run required before commit.** Last green `tsc --noEmit` + `npm run build` predates the `lib/pbv/finalizeValidation.ts` and `middleware.ts` edits. Re-run both (per `docs/SHELL-PROTOCOL.md`: `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc`).

---

## Files changed this session (for the commit)

Cowork (this session):
- `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`
- `app/api/t/[token]/pbv-full-app/intake/progress/route.ts` *(new)*
- `app/pbv-full-app/[token]/intake/[section]/page.tsx`
- `app/api/t/[token]/pbv-full-app/sign-summary/route.ts`
- `lib/pbv/finalizeValidation.ts`
- `middleware.ts`
- `supabase/migrations/20260522120000_pbv_signature_events_nullable_form_document_id.sql` *(new, applied)*
- `docs/fullApp-Plan/post-audit-prps/PRP-023_intake-resume-pointer-and-summary-signature-fixes.md` *(new — reference write-up; superseded in part by Windsurf's work)*

Windsurf:
- `lib/pbv/signing/completeForm.ts` (dual-write `syncApplicationDocumentsForSignedForm` + `formIdToDocTypes`)
- `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (signer assignment / scope)
- `supabase/migrations/20260522130000_pbv_sign_form_application_docs_alignment.sql` *(new, applied)*
- DB: `pbv_form_templates.per_person_scope` boolean→TEXT + re-seed *(applied)*

---

## How to re-verify (manual walkthrough)

1. Admin (`/admin`, super-admin login) → **PBV Full Applications** → **+ New Invitation**. Open the magic link on `localhost:3000` (the link shows the prod domain `form-stanton.vercel.app` — swap the host for `localhost:3000`; the `/pbv-full-app/<token>` path is what matters).
2. **Intake:** set an **adult DOB** for the HOH (e.g. 1988 → ~37) so they qualify for each_adult/individual scopes. Walk all 7 always-on sections → **Submit**.
3. **Sign summary** (typed signature works).
4. **Sign forms** (`/sign/forms`): the first form via "Sign all my forms" uses the signature-pad/typed ceremony; subsequent per-form dialogs are **name + confirm-checkbox + "Sign this form"** (they reuse the captured signature).
5. **Documents** (`/documents`): only genuine evidence docs (ID, paystubs) should appear as upload cards — federal forms must NOT.
6. **Finalize**: `POST /api/t/<token>/pbv-full-app/finalize` (or the dashboard Submit). Expect `missing` to be empty once eiv is fixed.

---

## Housekeeping

- Test image left in the repo (sandbox couldn't delete): `_qa_test_docs/qa_test_id.png` — **not gitignored**, please remove before commit.
- Two part-way test applications in the DB: `QA Walk Tester` (`500 QA Test Blvd` / token `500-qa-test-blvd-unit-qa-1-NNDf7lJbVEXvOiu2`) and `Final Walk Tester` (`700 Final Test Ave` / token `700-final-test-ave-unit-ft-2-96ixhAz2C0PbrT5Z`).
- Merge to `main` deploys prod (`form-stanton.vercel.app`) for real HACH tenants — hold until #1, #2(decision), and #3 are resolved.
