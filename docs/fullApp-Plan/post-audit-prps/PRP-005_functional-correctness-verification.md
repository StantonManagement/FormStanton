# PRP-005 — Functional-Correctness Verification (Multi-Signer, each_adult, Routing, FieldMap, Row-Patterns)

**Assigned batch (per BATCH_PLAN.md):** 01
**Source:** `docs/audits/pbv-open-items-and-suggestions_2026-05-21.md` Pass 2 — items **#5, #6, #7, #8, #9**.
**Depends on:** None — operates on current `main`. (Assumes current `main` has unified signing into `lib/pbv/signing/completeForm.ts` with per-signer `signing_device`/`typed_name` correctness and fail-closed generation defaults. **Several items below may already be fixed there — this PRP is verify-first; do not "fix" what is already correct.**)
**Inputs (read before editing):** `lib/pbv/signing/completeForm.ts` (the `allSigned` branch + the data dict passed to `stampForm`), `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (the per-adult upsert / `onConflict` / `required_signer_member_ids` region), `components/pbv/intake/SectionReview.tsx` (~204, the review CTA), all field-map `*.json` files, and the stamper's expected row-pattern key.
**Outputs (write — the ONLY files this PRP may modify/create):** `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` (required-signer region only), `lib/pbv/signing/completeForm.ts`, `components/pbv/intake/SectionReview.tsx`, field-map `*.json`, new regression test(s); (only iff #6 needs a data backfill) one migration (commit-only).
**Acceptance criteria:** each item below ends either "verified correct + regression test added" or "gap fixed + regression test added." Every item has a regression test regardless.

## Context (self-contained) — verify-first contract
The audits inferred these statically; the biggest risk is "fixing" something already correct and regressing it. For each item: **(1) read the current code, (2) state verified-correct or gap-confirmed with evidence, (3) fix only confirmed gaps, (4) add a regression test that asserts the invariant either way.**

## Problem (as inferred — confirm before acting)
- **#5:** multi-signer stamping may bind a single signature-image buffer to every adult row (so `citizenship_declaration`, `obligations_of_family`, `debts_owed_phas`, all `each_adult` forms show the **last** signer's image everywhere). Verify the data dict passed to `stampForm` carries per-signer image bytes keyed by `signer_member_id`/row, not one shared buffer.
- **#6:** `generate-forms` per-adult upsert with `onConflict: full_application_id,form_id,language` may overwrite `required_signer_member_ids` with a single-element array, so only one adult is required and `allSigned` trips after the first signature. Verify it is the **union** of all adult ids (one row per `(form_id, language)`).
- **#7:** intake review CTA may `router.push('/review')` (a "coming soon" stub) instead of `/dashboard`. Verify the destination.
- **#8:** on a null/missing `fieldMap`, the code may set `status='signed'` without producing a signed PDF. Verify; it must instead 422 `field_map_missing`.
- **#9:** some field maps may use `row_pattern` (singular) where the stamper expects `row_patterns` (plural) → a multi-row table isn't stamped. Verify all maps.

## Goals
1. **#5:** each adult row stamped with that signer's image (keyed by `signer_member_id`/row).
2. **#6:** one `pbv_form_documents` row per `(form_id, language)` for `each_adult`, `required_signer_member_ids` = union of all adult ids; `allSigned` only when every required adult has signed.
3. **#7:** CTA routes to `/dashboard` (or the correct built destination).
4. **#8:** null/missing `fieldMap` → 422 `field_map_missing`; status does not advance to `signed`.
5. **#9:** every multi-row field map uses the stamper's canonical `row_patterns` key.
6. A regression test per item asserting the invariant (whether or not code changed).

## Non-goals
- No signing/generation architecture redesign. No re-touch of per-signer `signing_device`/`typed_name` or fail-closed defaults except where #5/#8 genuinely require it (minimal + tested).
- No `canGoNext`/section-gating UX work (out of scope).
- No migration unless #6 needs a backfill of already-collapsed rows (then commit-only).
- Do not edit files outside the Outputs list.

## Implementation
1. **Verify all five**, recording evidence (line refs, the actual `onConflict`, the actual resolver). Do not edit yet.
2. **Fix confirmed gaps only:** #6 build the union once + one row per `(form_id, language)`; #5 map `__row_pattern:${data_key}:signature` markers to `eventsByMemberId[signer_member_id]` bytes; #7 CTA → `/dashboard`; #8 null fieldMap → 422, no status advance; #9 rename singular→plural where needed.
3. **Regression test per item**, including a static field-map scan test (#9) so it stays enforced.

## Verification (per-PRP gates, before commit)
- `node ./node_modules/typescript/bin/tsc --noEmit` clean.
- `node ./node_modules/.bin/vitest run` on the new regression tests — per-signer image mapping (#5); union `required_signer_member_ids` for a 3-adult `each_adult` form (#6); review CTA target (#7); 422 + no status advance on null fieldMap (#8); a scan asserting no multi-row map uses the singular key (#9).
- **No full build per PRP** (batch boundary runs it).
- **Deferred runtime gates:** 3-adult household → all 3 required, 2 signatures not finalizable, 3rd makes it finalizable; `citizenship_declaration` with 2 adults shows each adult's own image; intake completion lands on `/dashboard`.

**Default for ambiguity:** verify-first; if PRD-era work already fixed an item, ship the regression test and record "verified, no change." If #6 needs a backfill of existing collapsed rows, write the migration commit-only and record it as a migration-to-apply.
