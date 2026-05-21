# PRD-62 — PBV Signing Unification & Audit-Trail Integrity

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (new post-finalization batch — see prompt)
**Status:** Draft — ready for build
**Severity:** P1 — data-integrity (silent audit-log wrongness: per-signer device attribution, the typed-name attestation, and an unverified `document_hash` invariant)
**Depends on:** PRDs 55–61 + 55b — shipped on `feat/pbv-full-finalization`. Builds directly on `lib/pbv/signing/completeForm.ts` (PRD-56 F2) and the two sign-form routes.
**Source:** `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md` — this PRD implements audit findings **#1, #2, #3, #6, #8, #12** (audit's PR-A + PR-B). It does **not** touch #4, #5, #7, #9–#14.

---

## Problem Statement

PRD-56 F2 introduced `completeFormSigning` so the HOH path and the member-token path share one signing implementation. That promise is half-kept: the **member-token** route (`app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:91-101`) calls `completeFormSigning`, but the **HOH** route (`app/api/t/[token]/pbv-full-app/sign-form/route.ts:63-350`) reimplements the entire flow inline. The two have already drifted, and the drift is the source of three quiet audit-log defects:

- **#2 — per-signer device lost.** The HOH route writes `pbv_household_members.signing_device` inside its `if (allSigned)` block (`sign-form/route.ts:296-299`). For a multi-signer form (e.g. `hud_9886a`, every adult), only the LAST signer's device is recorded; earlier signers' device attribution is overwritten/never written. `completeForm.ts:263-266` writes it unconditionally — so the bug is HOH-route-only.
- **#3 — typed-name attestation discarded.** `completeForm.ts:142` inserts `typed_name: member.name` (the DB-stored name) with the comment `// Will be updated by caller if they have typed_name`. No caller updates it. `CompleteFormOptions` (`completeForm.ts:17-27`) doesn't even accept a typed name, so the member-token signer's audit row records the DB name instead of what they typed. The HOH inline path writes the typed value correctly — the two paths produce **different audit truth** for the same workflow.
- **#6 — `document_hash` never verified.** Each `pbv_signature_events` row records a `document_hash` = `sha256(unsigned stamped PDF bytes the signer saw)`. `validateReadyToFinalize` (`finalizeValidation.ts:38-136`) checks `collected ⊇ required`, summary signed, and documents submitted — it **never** compares any signature's `document_hash` to the form's current bytes. The whole F1/F8 "I signed bytes with hash X" invariant has no enforcement point.

Two more findings are the same root cause or its tail:

- **#1 + #8 — duplicate / dead signing code.** `loadFieldMapForSigning` and `buildSignatureFieldData` exist in both `sign-form/route.ts` (as `buildSignatureFieldDataF5`) and `completeForm.ts`. The route also keeps a `@deprecated` `buildSignatureFieldData` (`sign-form/route.ts:407-436`) that nothing calls — dead code shaped like live code. A future signing fix lands in only one copy.
- **#12 — fake `Request`.** The member-token route casts a hand-built object to `Request` (`signer/[member_token]/sign-form/route.ts:80-89`) only so `completeFormSigning` can read three headers. Brittle: if the shared fn ever reads another `Request` property it breaks at runtime, not compile time.

This PRD collapses both routes onto one implementation and closes the `document_hash` gap with a cached-hash check at finalize.

---

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) | Fix shape |
|---|---|---|---|
| #1 | HOH route reimplements signing inline instead of calling `completeFormSigning` | `app/api/t/[token]/pbv-full-app/sign-form/route.ts:80-350` vs `lib/pbv/signing/completeForm.ts:42-278` | route delegates to `completeFormSigning` |
| #8 | Two `buildSignatureFieldData` (route's `…F5` + completeForm's) + a `@deprecated` dead copy | `sign-form/route.ts:372-405`, `:407-436`; `completeForm.ts:325-356` | one impl in `completeForm.ts`; delete route-local + dead copies |
| #2 | `signing_device` written only inside `if (allSigned)` (HOH route) | `sign-form/route.ts:296-299` | unconditional per-signer write (already in `completeForm.ts:263-266`) — fixed by #1 |
| #3 | `typed_name` insert uses `member.name`, not the signer's typed value | `completeForm.ts:142` | add `typedName` to `CompleteFormOptions`; insert `options.typedName`; both callers pass it |
| #12 | Member-token route builds a fake `Request` to pass headers | `signer/[member_token]/sign-form/route.ts:80-89` | `CompleteFormOptions` takes `ipAddress` / `userAgent` directly; drop `request: Request` |
| #6 | `validateReadyToFinalize` never checks `document_hash` against current bytes | `finalizeValidation.ts:38-136` | new Check 5: compare each event's `document_hash` to cached `pbv_form_documents.unsigned_pdf_hash` (migration adds the column; set at generate-forms upload) |

`source_pdf_hash` already exists (`pbv_form_documents`, migration `20260515010000`) but it is the hash of the **source template PDF**, not the stamped unsigned bytes the signer hashes. So `unsigned_pdf_hash` is genuinely new and distinct. [Confirmed]

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Shared signing fn | `lib/pbv/signing/completeForm.ts:42-278` | already correct on `signing_device` (`:263`) + IP/UA (`:131-133`); discards `typed_name` (`:142`); takes a `Request` (`:26`) |
| Member-token caller | `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:91-101` | calls `completeFormSigning`; builds mock `Request`; passes `assistedByStaffUserId: null` |
| HOH caller | `app/api/t/[token]/pbv-full-app/sign-form/route.ts:63-350` | inline reimplementation; resolves `X-Assisted-By` (`:69-78`); writes typed value + device-in-`allSigned` |
| `document_hash` source | both routes / `completeForm.ts:129` | `sha256(unsigned stamped PDF downloaded from `pbv-forms`)` |
| Finalize validator | `lib/pbv/finalizeValidation.ts:38-136` | Checks 1–4; no hash check |
| generate-forms upload | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:143-149` | uploads `…-unsigned.pdf` (`upsert:true`); computes `source_pdf_hash` from the **source** PDF (`:163`), not the stamped bytes |
| Finalize test mock | `lib/pbv/__tests__/finalizeValidation.test.ts:32-50` | sequential-response queue — adding a query to the validator shifts the queue; existing tests must be updated in lock-step |

---

## Goals

1. Both sign-form routes complete a signature through **one** implementation (`completeFormSigning`). The HOH route no longer reimplements the flow.
2. `pbv_household_members.signing_device` is written per signer, on each signer's tap — not only on the last signer of a multi-signer form.
3. `pbv_signature_events.typed_name` records the value the signer typed (`options.typedName`), for both paths.
4. The route-local `loadFieldMapForSigning` / `buildSignatureFieldDataF5` and the `@deprecated buildSignatureFieldData` are deleted; only `completeForm.ts` holds the helpers.
5. `CompleteFormOptions` takes `typedName`, `assistedByStaffUserId`, and `ipAddress` / `userAgent` directly; the member-token route's mock `Request` is gone.
6. `validateReadyToFinalize` blocks finalize when any signature event's `document_hash` doesn't match the form's current stamped unsigned bytes, surfaced as a re-sign message — using the cached `unsigned_pdf_hash` (no per-finalize PDF download).

## Non-goals

- **No** `X-Assisted-By` session/HMAC hardening (#4), regenerate-lock (#5), fail-closed conditional/resolver defaults (#7, #14), idempotency scoping (#9), atomic finalize event (#10), signed-PDF versioning (#11), or `tryLoadPdf` error inspection (#13). Those are separate PRDs in the same batch.
- No change to `generate-forms` generation logic, summary doc, intake, documents, or `stampForm`. The only generate-forms edit is writing `unsigned_pdf_hash` at the existing upload site.
- No change to the `X-Assisted-By` existence-check semantics (still resolved against `admin_users` as today); we only thread the resolved id into the shared fn.

---

## Implementation phases

### Phase 1 — Extend `CompleteFormOptions` (audit #3, #12)
- In `lib/pbv/signing/completeForm.ts:17-27`, add to `CompleteFormOptions`: `typedName: string;`, keep `assistedByStaffUserId?: string | null;`, and **replace** `request: Request;` with `ipAddress: string | null;` and `userAgent: string | null;`.
- At the insert (`completeForm.ts:142`): `typed_name: options.typedName` and remove the "Will be updated by caller" comment. Use the passed `ipAddress` / `userAgent` at `:144-145` instead of reading from `request` (delete the `request.headers.get(...)` lines at `:131-133`).
- `signing_device` is already written unconditionally (`:263-266`) — leave it; this is what #2 needs.

### Phase 2 — Move the HOH route onto `completeFormSigning` (audit #1, #2, #8)
- In `app/api/t/[token]/pbv-full-app/sign-form/route.ts`, keep the route-specific preamble that has no equivalent in the shared fn: body validation (`:39-58`), `X-Assisted-By` resolution (`:69-78`), the **summary-doc-signed gate** (`:100-116`, HOH-only — the member-token route deliberately omits it), and the `withTenantContext` + custom idempotency key wrapper (`:61-63`, `:350`).
- Replace the inline block (`:80-349`, from "Load form document" through the final return) with a call to `completeFormSigning({ formDocId, appId: app.id, signerMemberId, deviceOwner: device_owner, signatureImagePath, ceremonyId, consentTextVersion, typedName: typed_name, assistedByStaffUserId, ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null, userAgent: request.headers.get('user-agent') ?? null })`, mapping the result to the route's existing response shape (`{ success, data: { form_document_id, signer_member_id, all_signed, status, signed_pdf_path } }`).
- Delete the route-local `loadFieldMapForSigning` (`:355-366`), `buildSignatureFieldDataF5` (`:372-405`), and the `@deprecated buildSignatureFieldData` (`:407-436`). [Inference] The route may no longer need the `stampForm` / `createHash` / `FieldMap` imports — remove any that go unused so `tsc` stays clean.
- The summary-gate stays in the route (it's a HOH precondition, not part of completion). Confirm the member-token route still does **not** apply it.

### Phase 3 — Update the member-token caller (audit #3, #12)
- In `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`, delete the `mockRequest` (`:80-89`). Pass `typedName: typed_name`, `ipAddress`, `userAgent` directly to `completeFormSigning` (it already computes `ipAddress` / `userAgent` at `:76-77`). Keep `assistedByStaffUserId: null` (member-token signers are never staff-assisted). [Confirmed]

### Phase 4 — `document_hash` verification at finalize (audit #6, cached-hash variant)
- **Migration** `supabase/migrations/<ts>_prd62_unsigned_pdf_hash.sql`: `ALTER TABLE public.pbv_form_documents ADD COLUMN IF NOT EXISTS unsigned_pdf_hash TEXT;` with a `COMMENT ON COLUMN` explaining it's `sha256` of the stamped unsigned bytes (distinct from `source_pdf_hash`). **Write + commit only; do NOT apply to prod** — list under "Prod migrations to apply" in `OPEN-DECISIONS.md`.
- **generate-forms** (`generate-forms/route.ts`): at the unsigned upload (`:143-149`), compute `sha256Hex(stampedPdf)` (the helper exists at `lib/pbv/form-generation/source-pdfs.ts:119`) and write it to the upsert as `unsigned_pdf_hash` (`:168-186`). This is the bytes the signer downloads and hashes, so it matches `document_hash` by construction. [Inference]
- **finalizeValidation** (`finalizeValidation.ts`): Check 3 already loads `formDocs`; extend its `select` to include `unsigned_pdf_hash`. Add **Check 5** after Check 4: for each non-skipped form with a non-null `unsigned_pdf_hash`, query its `pbv_signature_events` (`document_hash, signer_member_id`); for any event whose `document_hash !== formDoc.unsigned_pdf_hash`, push a `missing.signatures` entry `{ signer_name, doc_label: \`${form_id} (signature/document hash mismatch — please re-sign)\`, doc_id }`. If `unsigned_pdf_hash` is null (legacy row, pre-migration backfill), **skip the check for that form and do not block** — log nothing user-facing; mismatch only blocks when a cached hash exists to compare against. [Inference]
- The signed-PDF–download fallback from the audit snippet (`finalizeValidation.ts` downloading every PDF) is explicitly **not** used — the cached-hash variant is the chosen path (avoids N downloads at finalize).

---

## Verification / test plan

Static gates run in-session (the cache-and-compare and refactor are unit-testable without a deploy). Runtime gates need a preview + a live signing walk.

### Static (must pass before commit)
- **Gate 1 (unification):** a unit test asserts the HOH `sign-form` route calls `completeFormSigning` (e.g. mock the module, drive the route, assert one call with the mapped options) — and that `buildSignatureFieldDataF5` / the `@deprecated` copy no longer exist (grep-level or import assertion).
- **Gate 2 (typed_name):** a `completeForm.ts` unit test asserts the inserted `pbv_signature_events.typed_name` equals `options.typedName`, not `member.name` (set them to different values).
- **Gate 3 (signing_device per-signer):** a `completeForm.ts` test with a 2-signer form asserts the first signer's `pbv_household_members.signing_device` is written on the first tap (i.e. the update fires when `allSigned === false`).
- **Gate 4 (finalize hash mismatch):** a `finalizeValidation` test where one event's `document_hash` ≠ `formDoc.unsigned_pdf_hash` returns `ready: false` with a `signatures[]` entry containing "hash mismatch"; a matching-hash case stays `ready: true`. Existing `finalizeValidation.test.ts` cases updated for the new `unsigned_pdf_hash` select + the extra `pbv_signature_events` query in the mock queue.
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; `vitest run` green.

### Deferred to the post-run verification pass (list in build report; do NOT block)
- **Gate R1:** on a deployed preview, a multi-signer form (`hud_9886a`) signed via the HOH path records a distinct `signing_device` per signer in `pbv_household_members`.
- **Gate R2:** a member-token signer's `pbv_signature_events.typed_name` equals the value they typed (not the intake DB name) after a live walk.
- **Gate R3:** after applying the migration + a fresh generate-forms + signing, finalize succeeds; then artificially mutate a stored unsigned PDF (or its cached hash) and confirm finalize blocks with the re-sign message.

---

## Open questions

- **O1:** Legacy `pbv_form_documents` rows generated before this migration have `unsigned_pdf_hash = NULL`. Default taken: Check 5 **skips** null-hash forms (no block) rather than back-downloading to verify — so pre-migration packets aren't retroactively blocked. Backfill is optional. Log to OPEN-DECISIONS; confirm post-run. [Inference]
- **O2:** `unsigned_pdf_hash` is written at generate-forms upload time; if a packet was generated before this PRD and re-signed after, the cached hash is absent and the form is not hash-checked. Acceptable for launch (new applications get the hash); flag for the post-run pass.

## Decisions

- **D1:** Cached-hash variant over per-finalize download — Check 5 compares `document_hash` to the in-DB `unsigned_pdf_hash`; no PDF download at finalize. (Per audit #6 closing note.)
- **D2:** `CompleteFormOptions` takes `ipAddress` / `userAgent` directly; the `Request` parameter is removed (audit #12). Both callers compute the IP/UA choice (`x-forwarded-for ?? x-real-ip`).
- **D3:** The HOH summary-doc-signed gate stays in the HOH route, not in `completeFormSigning` — it's a HOH precondition the member-token path intentionally skips.
- **D4:** `typed_name` is the signer's typed value for both paths (audit #3); `member.name` is no longer used at the insert.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `lib/pbv/signing/completeForm.ts` | 1, 4 | add `typedName` + `ipAddress`/`userAgent` to `CompleteFormOptions`; drop `request`; insert `options.typedName`; remove the lying comment |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | 2 | delegate to `completeFormSigning`; keep preamble + summary gate + idempotency wrapper; delete route-local helpers + `@deprecated` copy |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | 3 | delete mock `Request`; pass `typedName` + `ipAddress`/`userAgent` directly |
| `lib/pbv/finalizeValidation.ts` | 4 | add `unsigned_pdf_hash` to Check 3 select; add Check 5 (cached-hash mismatch → block) |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | 4 | compute + write `unsigned_pdf_hash` at the unsigned upload/upsert |
| `supabase/migrations/<ts>_prd62_unsigned_pdf_hash.sql` | 4 | add `pbv_form_documents.unsigned_pdf_hash` — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/pbv/__tests__/completeForm.test.ts` (new) | 1–3 | typed_name + per-signer signing_device tests |
| `lib/pbv/__tests__/finalizeValidation.test.ts` | 4 | hash-mismatch / hash-match cases; update existing cases for the new select + query order |
| `app/api/t/[token]/pbv-full-app/__tests__/sign-form-unification.test.ts` (new) | 2 | assert HOH route calls `completeFormSigning`; no route-local helpers remain |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
