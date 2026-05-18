# PRD-20 — PBV Tenant Already-Submitted Re-Entry

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** UX / read-only confirmation
**Sequence:** Spawned from PRD-14 Phase 8.
**Depends on:** PRD-15 (`submitted_at` column and load handler routing must exist).
**Blocks:** Nothing.

---

## Problem Statement

After PRD-15 lands, a tenant who returns to their token URL after submission is routed to `pageState === 'already_submitted'`. The existing render block at `app/pbv-full-app/[token]/page.tsx:690-707` is a placeholder — generic text, no useful information, no action paths. This is interim UX, but tenants do come back. They want to confirm what they submitted, when, and what to do if something needs to change.

This PRD replaces the placeholder with a real read-only confirmation: the submission timestamp, the full document checklist with statuses, the signature list with signer names, a localized contact-the-office CTA, and no mutation affordances.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| `pageState === 'already_submitted'` render block exists | Read `app/pbv-full-app/[token]/page.tsx:690-707` | Verified |
| Current render is a placeholder with no real data | Read | Verified |
| PRD-15 wires the load handler to route here when `submitted_at IS NOT NULL` | PRD-15 Phase 3.1 | Verified |
| Server-side mutation guards exist (PRD-15) | PRD-15 Phase 4 | Verified |

---

## Key decisions

### 1. The screen is read-only. Period.

No edit buttons. No "request a change" buttons. No file replace. The CTA is "contact the office." Mutation is gated server-side (PRD-15) and there should be no client paths that even appear to mutate.

### 2. Show what was submitted, in full

Tenants come back to verify. Show every document with its final status (approved / submitted / waived). Show every signature with the signer name and the doc it was signed for. Show the timestamp. Show the head-of-household name and unit address for context.

### 3. Localized in all three languages

Like the rest of the tenant flow. No exceptions.

### 4. Mobile-first layout

Tenants will check this from a phone. Sticky header with submission timestamp. Scrollable doc list. Contact-office card at the bottom.

### 5. Print-friendly

[Inference] Some tenants will want a printable receipt. Add a `@media print` stylesheet that renders the page cleanly without nav/header chrome. Optional but cheap.

---

## Scope

### What this PRD does

1. Replaces the `pageState === 'already_submitted'` render block with a real read-only confirmation screen.
2. Fetches and renders: `submitted_at`, head-of-household name, building/unit, full document list with statuses, full signature list with signer attribution.
3. Localized in en/es/pt.
4. Mobile-first layout. Print stylesheet.
5. Adds a "View as PDF" / "Print this page" action (browser native print — no PDF generation in this PR).
6. Adds localized contact-office card with phone, email, hours (sourced from existing config or a new env var).

### What this PRD does NOT do

- Add a server-generated PDF download (could be a future PRD).
- Add a "request changes" flow.
- Add edit affordances.
- Modify the load handler (PRD-15 owns that).
- Modify mutation guards (PRD-15 owns those).

---

## Affected files

### Modified client files

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` lines 690-707 | Replace the placeholder block with a real render. Pull data from the existing GET response (`detail` state from the load handler). Render: header (submission timestamp + HoH name + unit), document checklist grouped by category (reuse the category logic from PRD-14), signature list, contact-office card. Add a print button using `window.print()`. |
| `lib/pbvFullAppTranslations.ts` | Add translation keys: `already_submitted_title`, `already_submitted_subtitle`, `already_submitted_timestamp_label`, `already_submitted_docs_heading`, `already_submitted_signatures_heading`, `already_submitted_contact_heading`, `already_submitted_contact_body`, `already_submitted_print_btn`. |
| Print stylesheet (inline or new file) | `@media print` rules: hide nav/footer, expand collapsed sections, dark text on white background, no shadows or borders that don't print well. |

### Possibly modified

| File | Change |
|---|---|
| GET response for `/api/t/[token]/pbv-full-app` | If the current response doesn't include the full document list and signature list, add them. The already_submitted render should not need additional fetches. |
| Office-contact config | If hardcoded somewhere, leave it. If env-vars-driven (`OFFICE_PHONE`, `OFFICE_EMAIL`, `OFFICE_HOURS_*`), surface in the API response or pass directly. Choose the simpler path. |

---

## Phases

### Phase 1 — Data availability check

| # | Step | Verify |
|---|---|---|
| 1.1 | Confirm the GET response includes everything the screen needs: submitted_at, HoH name, unit address, document list with statuses, signature list with signer names. | Read the GET handler. If anything is missing, add it. |
| 1.2 | Confirm the document list includes `category` post-PRD-14. If PRD-14 hasn't shipped, this PRD waits or renders ungrouped (decision in build phase). | Pass. |

### Phase 2 — Translations

| # | Step | Verify |
|---|---|---|
| 2.1 | Add all translation keys with en/es/pt values. Match existing conventions. | Type-check passes. |

### Phase 3 — Render block

| # | Step | Verify |
|---|---|---|
| 3.1 | Build the new render JSX. Sticky header with timestamp + HoH + unit. Grouped doc list (using PRD-14 category if available, otherwise flat). Signature list grouped by signer. Contact-office card. | Manual: render in browser at a known-finalized app URL. |
| 3.2 | Add print button + `@media print` stylesheet. Test browser print preview. | Print preview is clean and readable. |
| 3.3 | Verify in all three languages. | Pass. |
| 3.4 | Verify mobile layout at 375px wide. No horizontal scroll, all content readable. | Pass. |

### Phase 4 — Verification

| # | Step | Verify |
|---|---|---|
| 4.1 | Finalize a test app, reload, see the new screen. | Pass. |
| 4.2 | All doc statuses visible. All signatures attributed. Timestamp localized. | Pass. |
| 4.3 | Print preview matches design. | Pass. |
| 4.4 | No mutation affordances visible. No buttons that trigger writes. | Pass. |
| 4.5 | Server-side: even if the user inspects HTML and crafts a request, mutation endpoints reject (PRD-15 guard). | Pass. |

---

## Rollback

- Pure client-side change in the render block. Revert restores the placeholder.
- New translation keys are additive.

---

## Open questions

1. **[Unverified]** Whether the GET response currently includes the signature list. If not, Phase 1.1 expands the response payload.
2. **[Speculation]** Whether to ship a server-rendered PDF download in this PR. Recommendation: no. Browser print works for the use case and adds no server cost.
3. **[Unverified]** Where office-contact info lives. If it's in environment vars, surface it. If it's hardcoded, leave it for a future config PRD.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Real read-only render, not a deferred placeholder | Tenants come back. Generic text doesn't help. The data is already available; the work is just rendering it. |
| 2026-05-14 | Print stylesheet, no server PDF | Browser native print is free and works on mobile. Server PDF is a future concern. |
| 2026-05-14 | No "request changes" path | That conversation belongs to the office, not the form. Clear CTA: phone/email. |
