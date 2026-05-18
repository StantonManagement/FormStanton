# PRD-18 — PBV Tenant Multi-Signer Correctness

**Status:** Draft — needs implementation
**Date:** 2026-05-14
**Classification:** Correctness / observability
**Sequence:** Spawned from PRD-14 Phase 6.
**Depends on:** PRD-15 (finalize endpoint must exist; canvas refs fix already lands there).
**Blocks:** Nothing.

---

## Problem Statement

The PBV tenant flow supports multi-adult households where each adult must sign their own set of forms. The current code:

1. **Has no per-signer event log.** When signer 1 finishes and hands off to signer 2, no `application_events` row records that transition. Admins reviewing the flow can't tell when each signer completed without inferring from signature timestamps.
2. **Finalize signature-count validation is unverified for multi-adult households.** PRD-15's finalize endpoint validates "all required signatures saved" via the existing `next_step === 'complete'` logic. That logic was [Inference] designed for the single-signer happy path. Whether it correctly counts across multiple adult signers needs explicit testing.
3. **No signature-review preview before finalize.** A tenant who signs sloppily — illegible scrawl, wrong line, hit save by accident — has no path to re-sign before the application locks. After PRD-15 finalize, the application is irreversibly submitted.

The canvas refs handoff bug (line 658) is fixed in PRD-15, so this PRD doesn't repeat it.

---

## Evidence baseline (verified 2026-05-14)

| Finding | Method | Status |
|---|---|---|
| Multi-signer flow exists with `signerStep: 'handoff' | 'signing' | 'done'` | Read `app/pbv-full-app/[token]/page.tsx:113` | Verified |
| `handleAdvanceSigner` at line ~657 transitions signers | Read | Verified — does not write any event row |
| Finalize validates "next_step === 'complete'" | PRD-15 Phase 2.1 references this | Indirect — needs reading post-PRD-15 |
| No signature-preview UI exists | Grep for "preview" in signing render block | [Unverified] — confirm in build phase |

---

## Key decisions

### 1. `application_events` row per signer completion

Each time `signerStep` transitions from `signing` → `done` (whether the last signer or not), write an event row with type `tenant_signer_completed` and payload `{ signer_id, slot, name }`. This is observability, not correctness — but it's cheap and unblocks admin troubleshooting.

### 2. Finalize validation must explicitly count per-signer signatures

The finalize endpoint's validation helper (from PRD-15 Phase 2.1) is updated to iterate over each adult member and confirm every required signature for that member is saved. Returned `missing.signatures` payload includes the signer name and missing form list.

### 3. Signature review preview is a step, not a modal

After all signers complete, before the finalize POST, the tenant lands on a review screen showing thumbnails of each saved signature with the doc label and a "re-sign" button. Submit confirms and triggers finalize.

### 4. Re-sign is per-doc, not per-signer

Clicking "re-sign" on a single doc returns the tenant to the signing canvas for that specific doc only — not the entire signer's flow. Less friction.

---

## Scope

### What this PRD does

1. Adds an `application_events` row write in `handleAdvanceSigner` for each signer's completion.
2. Updates the finalize validation helper (from PRD-15) to enumerate per-adult required signatures and report missing ones with signer context.
3. Adds a "review your signatures" page state between `signing/done` and finalize.
4. Implements per-doc re-sign that returns the tenant to the canvas for that doc, then back to review.
5. Adds 2-adult E2E coverage to the test plan (delegated to PRD-21 for execution; this PRD just ensures the surface is testable).

### What this PRD does NOT do

- Add a "decline to sign" or "designate alternate" flow.
- Implement signature image capture quality detection (e.g., reject blank canvases).
- Build a multi-device handoff (e.g., signer 2 on a different phone). All signers share the same browser session.

---

## Affected files

### Modified API routes / helpers

| File | Change |
|---|---|
| `lib/pbv/finalizeValidation.ts` (from PRD-15) | Update `validateReadyToFinalize` to walk per-adult required signatures; return `missing.signatures` as `Array<{ signer_name, doc_label, doc_id }>`. |
| `app/api/t/[token]/pbv-full-app/signatures/route.ts` | Confirm response includes per-signer breakdown. If not, add it. |

### Modified client files

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/page.tsx` `handleAdvanceSigner` | After successful advance, POST an event log via a new lightweight endpoint OR (cleaner) have the signatures save endpoint write the event row server-side based on detecting "last sig for this signer." Decision in build phase. |
| `app/pbv-full-app/[token]/page.tsx` `signerStep === 'done'` last-signer block | Replace the existing "All Complete!" → finalize transition with a `setPageState('signature_review')` transition. |
| `app/pbv-full-app/[token]/page.tsx` | Add new `pageState === 'signature_review'` render: list of all saved signatures with thumbnails, doc labels, signer names, and per-doc "re-sign" buttons. "Confirm and Submit" button triggers finalize. |
| `app/pbv-full-app/[token]/page.tsx` `PageState` type | Add `'signature_review'` variant. |
| `lib/pbvFullAppTranslations.ts` | Add translation keys for the review screen: `sig_review_title`, `sig_review_subtitle`, `sig_review_resign_btn`, `sig_review_confirm_btn`, `sig_review_signer_label`. |

### New API endpoint (only if event write isn't done server-side)

| Route | Method | Purpose |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/signer-completed/route.ts` (optional) | POST | Writes `application_events` row when a signer finishes. Only build if Commit 1 decides client-driven event logging is better than server-inferred. |

---

## Phases

### Phase 1 — Per-signer event logging

| # | Step | Verify |
|---|---|---|
| 1.1 | Decide: server-inferred (signatures POST detects last-sig-for-signer and writes event) vs client-driven (new endpoint, client POSTs explicitly). Document in build report. | Decision recorded. |
| 1.2 | Implement chosen approach. Event type `tenant_signer_completed` with payload `{ signer_id, slot, name, completed_at }`. | DB row appears in `application_events` after each signer's final sig save. |

### Phase 2 — Validation helper update

| # | Step | Verify |
|---|---|---|
| 2.1 | Update `lib/pbv/finalizeValidation.ts` to enumerate per-adult required signatures. | Unit test: 2-adult app with signer 1 done but signer 2 missing one sig → `missing.signatures: [{ signer_name: 'Signer 2', doc_label: 'HUD-9886-A', ... }]`. |
| 2.2 | Update finalize endpoint response to include the new shape. Client error renderer reads it and surfaces specific missing items. | Manual test: incomplete app → finalize → error UI names the missing signer + doc. |

### Phase 3 — Signature review screen

| # | Step | Verify |
|---|---|---|
| 3.1 | Add `'signature_review'` to `PageState` type. Wire the transition from last-signer-done. | Last signer finishes → lands on review screen, not docs_ready. |
| 3.2 | Build the review screen render: list every signature, show thumbnail (load from storage or render from the stored signature blob), doc label, signer name. | Visual: all signatures visible, mobile layout works. |
| 3.3 | Each row has a "re-sign" button that takes the tenant back to a single-doc signing surface for that doc. After resign, returns to review. | Manual: re-sign one doc → canvas appears for just that doc → save → back to review with updated signature. |
| 3.4 | "Confirm and Submit" button triggers the finalize POST. On success: `setPageState('confirmed')`. | Pass. |

### Phase 4 — Translations

| # | Step | Verify |
|---|---|---|
| 4.1 | Add the new translation keys in `pbvFullAppTranslations.ts` for en/es/pt. | Manual: review screen renders correctly in all three languages. |

### Phase 5 — Verification

| # | Step | Verify |
|---|---|---|
| 5.1 | 2-adult E2E manual: each signer signs, advances, hands off; last signer reaches review; re-sign one doc; confirm submit; lands on `confirmed`. | Pass. |
| 5.2 | DB inspection: each signer has a `tenant_signer_completed` event row. Finalize has its own `application_submitted` event row (from PRD-15). | Pass. |
| 5.3 | Validation test: 2-adult app where signer 2 hasn't completed → finalize → 422 with clear signer-attributed missing list. | Pass. |

---

## Rollback

- Event log writes are additive and can be removed without data impact.
- Validation helper change can be reverted; old single-signer logic still computes correctly.
- Signature review screen reverts to the prior straight-to-finalize transition.

---

## Open questions

1. **[Inference]** Whether signature blobs are stored as canvas dataURLs in `application_documents` or as separate files in storage. The review screen needs to display them as thumbnails — implementation differs by storage strategy. Read the signatures POST endpoint and the data model before building Phase 3.2.
2. **[Speculation]** Server-inferred vs client-driven event logging. Server-inferred is cleaner (no extra endpoint) but requires the signatures POST to know whether this is the signer's last sig — which means walking the required-sig list per signer on every save. Client-driven is simpler.

---

## Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-14 | Event log per signer, not per-individual-signature | Per-signature is too noisy. Per-signer is enough for admin observability. |
| 2026-05-14 | Review screen as a page state, not a modal | Mobile-first; modals are awkward on small screens. A page state is also resumable on reload. |
| 2026-05-14 | Per-doc re-sign | Per-signer re-sign would force the tenant to redo all signatures for that adult. Per-doc is the minimum friction path. |
