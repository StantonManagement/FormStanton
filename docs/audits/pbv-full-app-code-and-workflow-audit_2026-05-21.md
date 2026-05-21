# PBV Full-App — Code & Workflow Audit

**Date:** 2026-05-21
**Reviewed branch:** `feat/pbv-full-finalization` (after PRDs 55–61 + 55b)
**Scope:** the tenant-facing PBV full-application lane:
- `app/pbv-full-app/[token]/**` (tenant UI)
- `app/pbv-full-app/signer/[member_token]/**` (additional-signer UI)
- `app/api/t/[token]/pbv-full-app/**` (tenant API)
- `app/api/pbv-full-app/signer/[member_token]/**` (signer API)
- `lib/pbv/**` (form-generation, signing, summary-doc, conditional-rules, tenantEndpoint, finalizeValidation)
- `supabase/migrations/**` touching `pbv_*`

This audit is the deliberate next-pass after the autonomous batch. Each finding has a **concrete fix**, not just a diagnosis. Items are grouped by severity. Where a fix touches multiple files, the order is given.

---

## Summary

| Severity | Count | Items |
|---|---|---|
| BLOCKER (tenant-visible failure or data-integrity loss) | 0 | — |
| Data-integrity (silent wrongness, audit-log defects, drift) | 8 | #1–#8 |
| Polish (developer ergonomics, defense-in-depth) | 6 | #9–#14 |

No tenant-blocking defect was found. The closeout batch landed cleanly. The data-integrity items below are real but quiet — most surface only under concurrent or repeated operations.

---

## Data-integrity findings

### #1 — HOH `sign-form` route duplicates `completeForm.ts` instead of using it

**Where:** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:63-350](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L63) versus [lib/pbv/signing/completeForm.ts:42-278](lib/pbv/signing/completeForm.ts#L42).

**What's wrong:** PRD-56 F2 introduced `completeFormSigning` so the HOH and member-token paths share one implementation. The **member-token** route ([app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:91-101](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L91)) calls `completeFormSigning`. The **HOH** route does not — it reimplements the whole flow inline (download unsigned PDF → hash → insert event → update collected → stamp if all signed → upload). The two implementations have already drifted (see #2 and #3 below).

**Why it matters:** Future signing-flow fixes have to be applied in two places. PRD-56's "shared completion logic" claim is false for the HOH path.

**Fix:** Move the HOH route to call `completeFormSigning`. The wrinkles to handle:
- Pass `typed_name` through (add to `CompleteFormOptions`; see #3).
- Pass `assisted_by_staff_user_id` resolved from `X-Assisted-By` (HOH route does this; member-token route hard-codes null).
- The `loadFieldMapForSigning` + `buildSignatureFieldData` helpers exist in *both* files — delete the route-local versions after the move.

---

### #2 — `pbv_household_members.signing_device` only gets set when all signers complete (HOH route)

**Where:** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:296-299](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L296), inside the `if (allSigned)` block.

**What's wrong:** The update is gated on `allSigned=true`. For a multi-signer form (e.g. `hud_9886a` requires every adult), the FIRST signer's `signing_device` is never recorded — only the LAST signer's. The member-token route writes it unconditionally ([completeForm.ts:263](lib/pbv/signing/completeForm.ts#L263)), so the bug is HOH-route-only and a direct symptom of #1.

**Why it matters:** Per-signer device attribution is wrong in `pbv_household_members.signing_device` for any multi-signer form signed via the HOH route. Audit replay can't tell whether a signer used hoh_device vs self for that form. PRD-30's package-integrity spec doesn't catch this because `signing_device` is a single column per member and gets overwritten by whichever form's `allSigned` block ran last.

**Fix:** Same as #1 — collapsing to `completeForm.ts` resolves it. If you can't do #1 immediately, move the `pbv_household_members` update outside the `if (allSigned)` block in [sign-form/route.ts:296](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L296) (place it right after the signature_events insert at line 203, before the collected-signers update).

---

### #3 — `completeFormSigning` discards the signer's `typed_name`

**Where:** [lib/pbv/signing/completeForm.ts:142](lib/pbv/signing/completeForm.ts#L142): `typed_name: member.name, // Will be updated by caller if they have typed_name`.

**What's wrong:** The whole point of `typed_name` is the **signer-typed identity confirmation** at sign-time — it's the auditable assertion "I, the person clicking submit, typed my name as X." `completeFormSigning` ignores the caller's typed value and writes `member.name` from the DB. The comment "will be updated by caller" is aspirational — no caller updates it. The interface `CompleteFormOptions` ([completeForm.ts:17-27](lib/pbv/signing/completeForm.ts#L17)) does not even accept `typed_name`.

**Why it matters:** Member-token signers (additional adults) have an audit row that records the DB-stored name instead of what they typed. If the household member's recorded name is wrong (typo at intake, name change, mismatched accent stripping), the audit row records the wrong attestation. HOH signing (route-local code) writes the typed value correctly, so the two paths produce **different audit truth** for the same workflow.

**Fix:**
1. Add `typedName: string` to `CompleteFormOptions` in [completeForm.ts:17](lib/pbv/signing/completeForm.ts#L17).
2. Use it at the insert site ([completeForm.ts:142](lib/pbv/signing/completeForm.ts#L142)): `typed_name: options.typedName`.
3. Update the member-token caller to pass `body.typed_name` ([signer/[member_token]/sign-form/route.ts:92-100](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L92)).
4. Remove the lying comment.

---

### #4 — `X-Assisted-By` header is trusted with only an existence check

**Where:** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:69-78](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L69).

**What's wrong:** The route reads `X-Assisted-By` from the request, looks up the value in `admin_users`, and if any row exists, writes that staff user's ID into `pbv_signature_events.assisted_by_staff_user_id`. There is no check that the named staff user is **actually assisting this tenant right now** (no session, no impersonation token, no recent staff login event tied to this application). Any client that can hit the tenant API can spoof the header with any admin user ID — the audit log will record "Staff user X assisted this signature" when the staff user did nothing.

**Why it matters:** Audit-log forgery. Staff-assisted ceremonies are a HACH compliance signal — the audit needs to be tamper-evident. A bad actor (or a buggy client that caches a stale header) can attribute signatures to staff who weren't involved. The header originates from `tenantFetch` when a staff session is active, but the route doesn't re-verify that session.

**Fix:**
1. Verify `X-Assisted-By` against the **current request's session**, not just `admin_users` existence. Resolve the staff session from the request cookie or an impersonation token in another header, and confirm `session.userId === X-Assisted-By`.
2. If you can't add a session check, require an HMAC-signed `X-Assisted-By-Proof` header that the staff-portal generates with a server-side secret when starting an assisted session.
3. As a stopgap, log a structured warning when `X-Assisted-By` is present without an active staff session and reject with 401 — better to fail loudly than to forge audit rows silently.

---

### #5 — `generate-forms` overwrites the unsigned PDF used by in-flight signers

**Where:** [app/api/t/[token]/pbv-full-app/generate-forms/route.ts:143-149](app/api/t/[token]/pbv-full-app/generate-forms/route.ts#L143) (`upsert: true`) and [app/api/t/[token]/pbv-full-app/sign-form/route.ts:161-172](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L161) (downloads `unsigned_pdf_path` then computes `document_hash`).

**What's wrong:** generate-forms uploads the regenerated unsigned PDF over the existing one. There is no guard preventing regeneration mid-signing. If a tenant's intake changes and they re-trigger generate-forms while one of multiple signers is mid-ceremony, the second signer's `document_hash` (computed on the new bytes after upload) will not match the first signer's `document_hash` for the same form. Worse: a signer's flow is "download unsigned → hash it → sign → server stamps onto unsigned bytes" — if generate-forms runs *between* the signer's hash and the server's stamp, the stamped PDF is based on the new bytes but the signature_event records the hash of the old bytes.

**Why it matters:** The `document_hash` invariant (per PRD-56 F1: "I signed bytes with hash X") becomes a lie. Replay-verification later will fail. In practice this is rare — generate-forms is gated behind `intake_status='complete'`, and intake usually doesn't change after that — but `intake_status` can move back to `in_progress` if the tenant edits intake; nothing stops generate-forms from running twice.

**Fix:**
1. Cheapest: have generate-forms check `pbv_full_applications.signing_status` and refuse if it equals `in_progress` or `complete`. Return 409 `signing_in_progress` so the UI can offer "discard signatures and regenerate" deliberately.
2. Better: stop using `upsert: true` for unsigned PDFs once any signature event exists. Version the path: `pbv/${appId}/forms/${formId}-${language}-v${generationVersion}.pdf` and write `generation_version` onto `pbv_form_documents`. Signature events carry the version they signed; finalize validates version match.
3. Belt-and-suspenders: validateReadyToFinalize re-hashes each form's `unsigned_pdf_path` and compares to every signature_event's `document_hash` for that form. Mismatch → block finalize (see #6).

---

### #6 — `finalize` doesn't verify the signed `document_hash` matches the current unsigned bytes

**Where:** [lib/pbv/finalizeValidation.ts:38-136](lib/pbv/finalizeValidation.ts#L38). The validator checks `collected ⊇ required`, summary signed, documents submitted. It never compares each signature event's `document_hash` to the current PDF.

**What's wrong:** Combined with #5, this means a tenant can submit a packet where the audit log claims signature events on hash A but the stored PDF has hash B. The submit succeeds; the lie is preserved.

**Why it matters:** This is the closing gap in the audit-trail invariant: the document_hash is meaningless if no one ever checks it. PRD-56's whole F1/F8 promise depends on this check existing somewhere.

**Fix:** Add a Check 5 in `validateReadyToFinalize`:
```ts
// Check 5: every signature_event.document_hash matches the form's stored unsigned PDF
for (const formDoc of (formDocs ?? [])) {
  if (!formDoc.unsigned_pdf_path) continue;
  const { data: pdfBlob } = await supabaseAdmin.storage
    .from('pbv-forms').download(formDoc.unsigned_pdf_path);
  if (!pdfBlob) continue;
  const currentHash = createHash('sha256')
    .update(Buffer.from(await pdfBlob.arrayBuffer())).digest('hex');
  const { data: events } = await supabaseAdmin
    .from('pbv_signature_events')
    .select('document_hash, signer_member_id')
    .eq('form_document_id', formDoc.id);
  for (const e of events ?? []) {
    if (e.document_hash !== currentHash) {
      result.missing.signatures.push({
        signer_name: memberMap.get(e.signer_member_id)?.name ?? 'Unknown',
        doc_label: `${formDoc.form_id} (signature/document hash mismatch — please re-sign)`,
        doc_id: formDoc.id,
      });
    }
  }
}
```
Heavy at finalize-time (downloads every signed PDF once). Cache the per-form hash on `pbv_form_documents.unsigned_pdf_hash` instead, set when generate-forms uploads, and compare in-DB.

---

### #7 — `shouldGenerateForm` fails open on unknown conditional rules

**Where:** [lib/pbv/conditional-rules.ts:115-118](lib/pbv/conditional-rules.ts#L115).

```ts
default:
  console.warn(`[conditional-rules] Unknown conditional_rule: "${conditionalRule}" — defaulting to true`);
  return true;
```

**What's wrong:** A typo in `pbv_form_templates.conditional_rule` (or a new rule string introduced without code change) causes the form to **always generate** — silently. The warn goes to server logs no one is watching.

**Why it matters:** This was probably written defensively ("if the rule is missing, don't lose the form"). But the opposite is the safer default: a form that's gated on an unknown rule is more dangerous when generated than when skipped, because it may stamp wrong data on a form that should never have applied (e.g. a `child_support_affidavit` generated for a household without child support). The PRD-55 lane explicitly went after silent skips — silent over-generation is the inverse failure of the same shape.

**Fix:**
1. Switch the default to `return false` and log an **error** (not warn).
2. Add `generate-forms` to surface this in the response: include `unknown_conditional_rule` in the `skipped[]` reasons (`reason` enum at [generate-forms/route.ts:89](app/api/t/[token]/pbv-full-app/generate-forms/route.ts#L89)).
3. Optional: a static check that asserts every distinct `conditional_rule` value in `pbv_form_templates` is handled in the switch. PRD-55's completeness guard can be extended to do this.

---

### #8 — Two `buildSignatureFieldData` implementations, only one current

**Where:** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:372-405](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L372) (`buildSignatureFieldDataF5`, current) and [lib/pbv/signing/completeForm.ts:325-356](lib/pbv/signing/completeForm.ts#L325) (`buildSignatureFieldData`, also current — but slightly different).

**What's wrong:** Both implementations construct the per-signer signature marker map for `stampForm`. They look identical at first glance but: the HOH-route version emits a top-level flat-field marker `result[sigField.name] = '__sig__:${requiredSignerIds[0]}'` ([sign-form:385](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L385)) — only the FIRST required signer's signature is used for the flat field. The completeForm.ts version is the same line ([completeForm.ts:337](lib/pbv/signing/completeForm.ts#L337)).

The actual drift is in #1 — both files **also** import and run the same logic, so signature stamping is consistent today, but the duplication means a future fix to one path silently doesn't apply to the other. Additionally, the HOH route still keeps a `@deprecated`-marked second implementation ([sign-form:407-436](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L407)) that nothing calls — dead code shaped like live code.

**Why it matters:** Code review on a fix to "how multi-signer flat fields work" will only land in one of the two files unless the reviewer remembers to check the other.

**Fix:** Same as #1 — collapse to one implementation in `completeForm.ts` and delete the route-local + deprecated copies.

---

## Polish findings

### #9 — `lib/idempotency.ts` lookup is scoped by `(key, endpoint)` only, not `application_id`

**Where:** [lib/idempotency.ts:17-22](lib/idempotency.ts#L17). The query filters `key` + `endpoint` but the table has `application_id` for accountability — it's written but never read in WHERE.

**What's wrong:** Defense-in-depth: if tenant A's Idempotency-Key value is ever guessable, reusable, or known to tenant B, tenant B can replay tenant A's cached response by hitting the same endpoint with the same header. In practice the keys are UUIDs generated by the client, so this is a low-probability issue. But the column is right there — using it costs nothing.

**Why it matters:** It's a one-line hardening that closes a class of cross-tenant replay attacks before they exist.

**Fix:** Add `.eq('application_id', applicationId)` to the existing-row query at [lib/idempotency.ts:19-22](lib/idempotency.ts#L19). No migration needed.

---

### #10 — `finalize` writes the application event in a non-atomic try/catch

**Where:** [app/api/t/[token]/pbv-full-app/finalize/route.ts:49-69](app/api/t/[token]/pbv-full-app/finalize/route.ts#L49). The `submitted_at` update succeeds (line 49-52), then the event write is wrapped in `try/catch` (line 59-69) that only logs on error.

**What's wrong:** If `writePbvApplicationEvent` fails, the application is submitted but `application_events` has no record of the submission. The audit timeline ends mid-flight. Replay from events to reconstruct state will miss the submission.

**Why it matters:** The audit timeline is the source of truth for "what happened, when." Letting a submission slip through silently breaks that contract.

**Fix:** Either
- Move the event write **before** the `submitted_at` update; if it fails, return 500 and the app stays unsubmitted, OR
- Write `submitted_at` and the event in a single SQL function (`finalize_pbv_application(p_app_id UUID)`) that performs both inside a transaction.

Prefer the SQL function — it also closes any race between the `submitted_at` write and the event timestamp.

---

### #11 — `signed_pdf_path` uses `upsert: true` so re-signing overwrites the prior signed PDF

**Where:** [app/api/t/[token]/pbv-full-app/sign-form/route.ts:282-289](app/api/t/[token]/pbv-full-app/sign-form/route.ts#L282) and [lib/pbv/signing/completeForm.ts:238-245](lib/pbv/signing/completeForm.ts#L238).

**What's wrong:** Path is `pbv/${appId}/forms/${form_id}-${language}-signed.pdf` — no version, no ceremony, no timestamp. If a signing ceremony is restarted (e.g. via #5's regeneration), the new signed PDF overwrites the old. The signature_events audit trail shows two ceremonies; storage shows only one PDF.

**Why it matters:** Audit-trail incompleteness. The events log says "signed twice" but only one artifact remains.

**Fix:** Suffix the signed-PDF path with `ceremony_id` (or the form's `generation_version` from #5's fix): `pbv/${appId}/forms/${form_id}-${language}-${ceremonyId}-signed.pdf`. Update `pbv_form_documents.signed_pdf_path` to point at the latest; the older paths remain in storage for audit lookup. Use `upsert: false` so concurrent same-path uploads fail loudly instead of clobbering.

---

### #12 — Member-token route builds a fake `Request` to call `completeFormSigning`

**Where:** [app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:80-89](app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts#L80).

```ts
const mockRequest = {
  headers: { get: (name: string) => { … } },
} as Request;
```

**What's wrong:** The interface `CompleteFormOptions` accepts a `Request` ([completeForm.ts:26](lib/pbv/signing/completeForm.ts#L26)) only to read `x-forwarded-for`, `x-real-ip`, `user-agent`. Passing a mock object cast to `Request` is a code smell that hides this minimal need.

**Why it matters:** Brittle. If `completeFormSigning` ever reads more request properties (cookies, URL, body), the mock breaks at runtime, not at compile time.

**Fix:** Change the interface to accept the three header values directly: `ipAddress: string | null; userAgent: string | null;` (drop the third — `x-real-ip` is fallback, callers compute the choice). Both routes pass them explicitly. Delete the mock.

---

### #13 — `tryLoadPdf` empty catch swallows real load errors

**Where:** [lib/pbv/form-generation/source-pdfs.ts:30-36](lib/pbv/form-generation/source-pdfs.ts#L30).

```ts
function tryLoadPdf(fileName: string): Buffer | null {
  try { return loadPdf(fileName); }
  catch { return null; }
}
```

**What's wrong:** Catches any error — missing file, permission denied, EMFILE, whatever — and returns null. The generate-forms loop then logs "Source PDF missing" and skips the form. A real operational issue (a corrupt volume mount, an FS permission flip) is indistinguishable from "this form isn't sourced."

**Why it matters:** Silent operational failure. Nothing alerts on it.

**Fix:** Inspect the error in the catch. If it's `ENOENT`, return null (the existing path is intentional — some PDFs aren't shipped). For any other error, log it as **error** (not just warn) with the form/file context, and still return null so the request doesn't blow up — but at least the operator sees the signal.

---

### #14 — `resolveFieldData` falls through to single-signature default for unknown form_ids

**Where:** [lib/pbv/form-generation/field-mapping.ts:330-331](lib/pbv/form-generation/field-mapping.ts#L330).

**What's wrong:** Unknown `formId` → `resolveSingleSignature(...)`. Combined with #7's fail-open behavior, a typo'd or newly-introduced template row gets a form that:
1. Generates unconditionally (#7).
2. Is stamped with a generic name+date resolver that doesn't know the form's actual fields.

**Why it matters:** Silently-wrong output: the form generates, the field map matches some-but-not-all field names, the PDF is a half-stamped mess that nobody validated.

**Fix:** Throw or push to `skipped[]` with reason `resolver_missing` instead of returning the default. The completeness guard (`form-generation-completeness.test.ts`) already asserts every required form_id is handled — extend it to also assert there's no fall-through case for unknown ids (today the test calls `resolveFieldData` and doesn't throw, which the default makes too easy to pass).

---

## Recommended fix order

If you want to land one PR per natural group:

1. **PR-A: Audit-trail integrity** — #2, #3, #6 (with the cached-hash variant). Touches `completeForm.ts`, both sign-form routes, and `finalizeValidation.ts`. Migration adds `pbv_form_documents.unsigned_pdf_hash`.
2. **PR-B: Sign-form unification** — #1, #8 (subsumes #2 if PR-A didn't already), #12. Pure refactor, no schema. Delete the deprecated and dead duplicates.
3. **PR-C: Fail-closed defaults** — #7, #14. Two small switches + a completeness-test extension.
4. **PR-D: Lock-against-regenerate** — #5 (paired with #11 for path versioning). Migration adds `pbv_form_documents.generation_version`. Touches generate-forms + the two sign-form routes + finalize.
5. **PR-E: Hardening** — #4 (`X-Assisted-By` proof), #9 (idempotency key scoping), #10 (atomic finalize event), #13 (real errors in source-pdfs). Small independent fixes — could be one PR or split.

PR-A and PR-B are the highest value: they close the audit-trail gap. PR-C is cheap and reduces the failure modes for future template churn. PR-D is the largest but addresses the most concerning interaction (regenerate during signing).

---

## What was checked but is NOT a defect

- **`required_signer_member_ids` nullability:** the column is `NOT NULL DEFAULT '{}'` ([20260515010000_pbv_form_documents.sql:20](supabase/migrations/20260515010000_pbv_form_documents.sql#L20)). The `?? []` in sign-form is belt-and-suspenders, not a hole.
- **`briefing_cert` rename:** the PRD-55 migration explicitly UPDATEs both `pbv_form_templates` and `pbv_form_documents` from the old key to the new ([20260520000000_prd55_form_generation_alignment.sql:19-26](supabase/migrations/20260520000000_prd55_form_generation_alignment.sql#L19)). Some seed migrations still reference the old name in INSERT seeds — those are historical and idempotent because the UPDATE already ran. No defect.
- **`eiv_guide_receipt` enablement:** PRD-55b's migration sets `generation_enabled=TRUE` + `source_pdf_status='sourced'`. Source PDFs are copied to `assets/pbv-source-pdfs/`. SOURCE_PDFS entry + resolver added. Consistent end-to-end (migration pending application, listed in `OPEN-DECISIONS.md`).
- **`finalize` lock check:** `withTenantContext` returns 409 when `submitted_at` is set before the handler ever runs ([tenantEndpoint.ts:42-47](lib/pbv/tenantEndpoint.ts#L42)). The finalize handler's idempotent-replay path covers re-finalize after submit. Acceptance suite (PRD-61) verifies this.
- **EN/ES/PT placeholder prose:** Alex's 2026-05-21 resolution — ship best-effort, native review post-launch. Not in scope.
