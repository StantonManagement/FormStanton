# Tenant Link → Form Fill — End-to-End Audit

**Date:** 2026-05-15
**Auditor:** Cascade (self-audit)
**Question:** When a tenant receives an `/pbv-full-app/[token]` link, can they actually complete the full application (intake → review → sign summary → sign each form → submit)?
**Method:** Trace every navigation hop, every API call, every DB write across the new PRD-25/26/27/28/29 flow against the actual code on disk.

---

## TL;DR

A tenant **can** start intake, save every section, sign the summary, sign federal forms, and finalize — but there are **three live defects that will be hit in normal usage**:

1. **Submitting the intake review dumps the tenant on a "coming soon" stub instead of the dashboard.** They have no in-product way to reach `/dashboard` and must re-paste the original link.
2. **Resume always restarts at Section 1.** `_resume_section` is read everywhere and written nowhere.
3. **Multi-adult signed PDFs contain only the LAST signer's signature.** Earlier signers' signature images are never re-fetched at stamp time. Affects citizenship_declaration, obligations_of_family, debts_owed_phas, and all `each_adult` forms.

A fourth defect — `generate-forms` upserts a single row per `(application, form_id, language)` while iterating across each adult — leaves `required_signer_member_ids` set to only the last adult's id, which silently makes multi-adult forms count as "complete" after one signature.

Everything else from the previous audit (`pbv-prds-22-30-error-audit_2026-05-15.md`) is verified fixed: bootstrap returns the dispatcher fields, summary-pdf uses `tenant_access_token`, intake section slugs match the UI, magic-link signers have a real `signature/capture` endpoint, idempotency is enforced server-side via `withIdempotency`.

---

## Flow Map (what should happen vs. what does)

| Hop | URL | Trigger | Backing API | Result |
|---|---|---|---|---|
| 1 | `/pbv-full-app/[token]` | tenant clicks link | `GET /api/t/[token]/pbv-full-app` | dispatcher routes by `intake_status` / `signing_status` ✅ |
| 2 | `/pbv-full-app/[token]/intake` | dispatcher (`intake_status='not_started'`) | bootstrap GET | landing screen renders ✅ |
| 3 | `/pbv-full-app/[token]/intake/household` | "Start" button | `POST .../intake/household` (debounced) | section saves, server merges into `intake_data` ✅ |
| 4 | `…/intake/contact` … `…/intake/review` | Next button | per-section POST | works for all 11 canonical slugs ✅ |
| 5 | (still) `…/intake/review` → `/pbv-full-app/[token]/review` | "Submit my answers" | `POST .../intake/complete` | **lands on stub page** ❌ (see D1) |
| 6 | `/pbv-full-app/[token]/dashboard` | only reachable by re-visiting root link | bootstrap GET → dispatcher | dashboard renders ✅ |
| 7 | `/pbv-full-app/[token]/sign/summary` | dashboard card 1 | `POST .../generate-forms` (auto) → `GET .../summary-pdf` | summary stamped + served ✅ |
| 8 | `…/sign/summary` "Sign" | tenant signs | `POST .../signature/capture` → `POST .../sign-summary` | `signing_status='summary_signed'` ✅ |
| 9 | `/pbv-full-app/[token]/sign/forms` | dashboard card 2 | iterates per `pbv_form_documents` | renders the stack ✅ |
| 10 | per-form Sign | tenant signs | `POST .../sign-form` | event recorded; stamp only when `allSigned` |
| 11 | additional adults | dashboard card 4 | `POST .../additional-signers/[member_id]/send-link` | token stored; **SMS not sent** ⚠ (see D5) |
| 12 | magic-link signer | `/pbv-full-app/signer/[member_token]` | `POST signer/.../signature/capture` → `POST signer/.../sign-form` | works ✅ — H3 fixed |
| 13 | "Submit my application" | dashboard | `POST .../finalize` → `validateReadyToFinalize` | `submitted_at` set ✅ |

---

## Severity Legend

| Severity | Meaning |
|---|---|
| **Critical** | Tenant cannot complete the flow without external intervention, or a signed federal document is wrong on disk |
| **High** | Major UX friction; recoverable by re-visiting the link or by staff help |
| **Medium** | Works for the happy path; fails on a real-world variant |
| **Low** | Cleanup / inconsistency |

---

## Critical Defects

### D1. Submitting intake review drops the tenant on a "coming soon" stub

**Evidence:**
- `@f:\Cursor Apps\FormsStanton\components\pbv\intake\SectionReview.tsx:204-212` posts `intake/complete` then `router.push(\`/pbv-full-app/${token}/review\`)`.
- `@f:\Cursor Apps\FormsStanton\app\pbv-full-app\[token]\review\page.tsx:17-29` renders only "Your answers have been received. The review and signing step is coming soon." No links, no auto-redirect, no dashboard CTA.
- The intake-complete → dashboard routing only fires in the **root** page dispatcher (`@f:\Cursor Apps\FormsStanton\app\pbv-full-app\[token]\page.tsx:495-501`). It does not fire on `/review`.

**Impact:** A first-time tenant who finishes intake reads "coming soon" and stops. The only way to continue is to re-open the SMS link in a new tab (which hits the root and dispatches to `/dashboard`).

**Fix:** Replace `router.push(\`…/review\`)` with `router.push(\`…/dashboard\`)` in `SectionReview.tsx`. Or delete the `/review` stub and have the dispatcher own routing. (One-line fix; the dashboard is fully built.)

---

### D2. Multi-signer forms keep only the last signer's signature in the stamped PDF

**Evidence:**
- `@f:\Cursor Apps\FormsStanton\app\api\t\[token]\pbv-full-app\sign-form\route.ts:200-249`: when `allSigned` is true, the route stamps using `sigImageBytes` — and `sigImageBytes` is the **currently submitting** signer's image. Earlier signers' `signature_image_path` rows in `pbv_signature_events` are never read back.
- The H1-style row_pattern markers added at lines 333-342 emit a single `__row_pattern:${data_key}:signature` per pattern, resolved by `imageResolver` to the same `sigImageBytes` (line 226-229).

**Impact:** `citizenship_declaration`, `obligations_of_family`, `debts_owed_phas`, `hud_9886a`, `hach_release`, `eiv_guide_receipt`, `criminal_background_release`, `hud_92006`, and `main_application` (each per-row adult) end up with only the LAST signer's image in every adult-row signature slot. HACH will receive a federally invalid packet.

**Fix:** In the `if (allSigned)` branch, query `pbv_signature_events` for every row with this `form_document_id`, download each member's `signature_image_path` from storage, and build a multi-image `data` dictionary keyed by `signer_member_id` (or by row index resolved through `signer_member_id → slot → row_index`). The `imageResolver` then needs to map row-specific markers to per-signer bytes rather than a single buffer.

---

### D3. `generate-forms` upsert collapses every adult into a single row

**Evidence:**
- `@f:\Cursor Apps\FormsStanton\app\api\t\[token]\pbv-full-app\generate-forms\route.ts:101-187`: for `each_adult`/`individual` templates, `getSignerSlots()` returns N adult slots (line 298-302). The body of the loop upserts into `pbv_form_documents` with `onConflict: 'full_application_id,form_id,language'`.
- Each iteration overwrites `required_signer_member_ids` with a single-element array (line 146, 308-320 — `getRequiredSignerIds` returns `[member.id]` for the slot of the current iteration).

**Impact:** After generation, only **one** adult is listed as required on each per-adult form. The first adult who signs trips `allSigned = true` (`sign-form/route.ts:200`), the stamper fires, the form is marked `signed`, and the other adults are never prompted — yet the federal form intends every adult to sign.

This compounds D2: not only is the wrong number of signatures stamped, the system never even asks the other adults.

**Fix:** Either (a) hoist `requiredSignerIds` to the union of all adult ids and break the inner loop after the first iteration, or (b) merge `required_signer_member_ids` on conflict instead of overwriting. The simpler fix is (a) — for `each_adult`/`individual`, build the required-ids array once from `members.filter(adults).map(m=>m.id)` and only emit one row per `(form_id, language)`.

---

## High Defects

### D4. Resume always lands at Section 1 — `_resume_section` is never written

**Evidence:**
- Read sites: `@f:\Cursor Apps\FormsStanton\app\pbv-full-app\[token]\page.tsx:491` and `@f:\Cursor Apps\FormsStanton\app\pbv-full-app\[token]\intake\page.tsx:89-90` — both fall back to `'household'`.
- Schema declares it: `@f:\Cursor Apps\FormsStanton\lib\pbv\intake-schema.ts:202`.
- **No writer anywhere.** `useSectionAutoSave` (`@f:\Cursor Apps\FormsStanton\lib\pbv\hooks\useSectionAutoSave.ts:59-62`) only posts the active section's payload; nothing in `intake/[section]/route.ts` adds `_resume_section` to the merged `intake_data`.

**Impact:** A tenant who closes the tab after Section 7 (criminal_history) re-opens the link and is routed to `/intake/household`. They have to click Next through every saved section to get back.

**Fix:** In `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts`, set `mergedIntakeData._resume_section = section` and `mergedIntakeData._last_saved_at = new Date().toISOString()` before the update. One-line additive change.

---

### D5. Magic-link send-link doesn't actually send

**Evidence:**
- `@f:\Cursor Apps\FormsStanton\app\api\t\[token]\pbv-full-app\additional-signers\[member_id]\send-link\route.ts:10-11`: "SMS sending is out of scope for PRD-24; this endpoint only stores the token."
- No caller in the UI dispatches a separate SMS — the dashboard button just hits this endpoint.

**Impact:** HOH clicks "Send their own link" → token is generated server-side, nothing is delivered to the adult. The adult never gets a link, the form is blocked until HOH does same-device handoff or staff intervenes.

**Fix:** Either (a) hook this endpoint to Twilio (or whatever provider Stanton uses for the existing pre-app SMS), or (b) make the button copy explicit ("Copy link to clipboard") and surface the URL in the UI for HOH to relay manually.

---

## Medium Defects

### D6. `useSectionVisibility` derives visibility from local state, server doesn't

`@f:\Cursor Apps\FormsStanton\lib\pbv\hooks\useSectionVisibility.ts` decides whether `zero_income_decl` / `medical` / `household_expenses` are visible from `intakeData`. The server's `intake/complete` validator uses `ALWAYS_SECTIONS` (`@f:\Cursor Apps\FormsStanton\app\api\t\[token]\pbv-full-app\intake\complete\route.ts:16`) which does NOT include the conditionals, so the validation is correct. However, if a tenant fills in zero-income-decl and later edits income to be non-zero, the section becomes hidden but the saved data remains in `intake_data`. Stale data is then carried into the summary doc and signed forms.

**Fix:** When a section becomes hidden, delete its key from `intake_data` (either on the client when navigation skips it, or in `intake/complete` by stripping all non-visible sections).

### D7. `canGoNext` only enforces the *current* section, not earlier ones

`@f:\Cursor Apps\FormsStanton\app\pbv-full-app\[token]\intake\[section]\page.tsx:146` gates the Next button on `isSectionComplete(currentSlug, intakeData)`. If a tenant deep-links to `/intake/income` without filling `/intake/household`, the page renders and Next becomes available as soon as `income` is filled — they skip the household entirely. `intake/complete` will then 422 with `missing_sections: ['household']` but the user has no breadcrumb showing why.

**Fix:** Either redirect to the first incomplete section when entering `/intake/[section]` deep, or expose the missing-sections error in the Review page with edit links.

### D8. Stale duplicate `pbv_signature_events` not possible, but the *summary* sign has no event row

Already documented in the prior audit (L4). Confirmed unchanged: `app/api/t/[token]/pbv-full-app/sign-summary/route.ts` writes `pbv_summary_documents.signed_at` but does not insert into `pbv_signature_events`. HACH packet won't show the HOH summary signature in the same audit trail as the federal forms.

---

## Low Defects

### D9. PT translations marked tentative across intake landing, dashboard, and form signing copy

Multiple files include `// PT: tentative — review`. Not a runtime bug.

### D10. `_last_saved_at` is also declared in the schema but never written

Same shape as D4. Same fix.

### D11. `signing_device` updated on every sign-form call

Already re-classified as not-a-bug in the previous audit (M1).

---

## Verified Fixed Since Last Audit

| Prior ID | Description | Status |
|---|---|---|
| C1 | `summary-pdf` queried wrong column | Fixed — uses `tenant_access_token` (`summary-pdf/route.ts:29`) |
| C2 | Magic-link sign-form inserted into non-existent `full_application_id` | Fixed — removed from insert (`signer/.../sign-form/route.ts:84-97`) |
| C3 | `intake/[section]` ALLOWED_SECTIONS legacy slugs | Fixed — uses `SECTION_SLUGS` (`intake/[section]/route.ts:20`) |
| C4 | `intake/complete` validates wrong keys | Fixed — uses `ALWAYS_SECTIONS` (`intake/complete/route.ts:16`) |
| H3 | Magic-link sent raw data URL as path | Fixed — `signer/.../signature/capture` exists; `MagicLinkSigningFlow.tsx:92-135` two-step capture-then-sign |
| H4 | Bootstrap missing dispatcher fields | Fixed — `intake_status`, `signing_status`, `submission_language`, `hoh_member_id` all returned (`pbv-full-app/route.ts:32-58`) |
| M2 | Client claimed idempotency, server ignored it | Fixed — `intake/[section]/route.ts:35` wraps with `withIdempotency` |
| H1 | row_pattern signatures not stamped | Partially fixed — emitter writes row_pattern markers (`sign-form/route.ts:333-342`) but the resolver still uses a single buffer; cannot place per-adult images. See D2. |

---

## Fix Priority

1. **D1** — one-line `router.push` change; unblocks the entire post-intake flow.
2. **D3** — one-loop refactor in `generate-forms`; without this, multi-adult forms are never actually presented to the other adults.
3. **D2** — design + implementation of per-signer image resolution in `sign-form`. Required for legally valid federal forms.
4. **D4** — one-line addition in `intake/[section]/route.ts`; massive UX win.
5. **D5** — connect SMS provider; otherwise additional-adult flow requires manual relay.
6. **D6, D7, D8, D9, D10** — polish.

---

## Out of Scope for This Audit

- Lobby/staff-assisted variants (PRD-29) — covered in prior audit
- Document upload flow (TenantDocumentUpload) — not a forms-fill path
- Legacy `intake_status = null` applications — they bypass the new dispatcher entirely; the legacy `/pbv-full-app/[token]` form path (`page.tsx:507-530`) is unchanged
