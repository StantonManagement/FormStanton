# Windsurf Build Prompt — PRD-62: Signing Unification & Audit-Trail Integrity

**Batch run:** read `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md` first — it governs decision-handling (default-and-log, never stop to ask), prod-migration safety (write + commit + list, do not apply), and static-vs-deferred gates.

Build from `docs/fullApp-Plan/62-pbv-signing-unification-and-audit-integrity_prd_2026-05-21.md`. Read it next.

This implements audit findings **#1, #2, #3, #6, #8, #12** from `docs/audits/pbv-full-app-code-and-workflow-audit_2026-05-21.md`. The HOH sign-form route reimplements signing inline and has drifted from `completeFormSigning`; the drift loses per-signer device attribution (#2) and the typed-name attestation (#3); the `document_hash` invariant is never enforced (#6). This PRD collapses both routes onto one implementation and adds a cached-hash finalize check. Mostly a refactor + one migration.

---

## Branch / commit (NEW post-finalization batch — NOT the 55–61 branch)

- This is a fresh batch. Branch **`feat/pbv-launch-hardening`**. Base it on `feat/pbv-full-finalization` **if that branch has not yet merged to `main`**; if `feat/pbv-full-finalization` has already merged, branch off `main` instead. **Check first** (`git branch -a`, `git log --oneline main..feat/pbv-full-finalization`) and log the base you chose to OPEN-DECISIONS.
- **One commit** when done: `PRD-62: signing unification + audit-trail integrity`. **Push after commit.**
- Do not open/merge a PR in-session unless the batch protocol for this new batch says otherwise — follow `BATCH-RUN-PROTOCOL.md`.

## Shell + DB

- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, never `npx tsc` (hangs on Windows). See `docs/SHELL-PROTOCOL.md`.
- This PRD adds a column (`pbv_form_documents.unsigned_pdf_hash`). **Write + commit the migration; do NOT apply it to prod (`lieeeqqvshobnqofcdac`).** Add it to "Prod migrations to apply" in `docs/fullApp-Plan/OPEN-DECISIONS.md`.
- Never run destructive SQL.

---

## What's confirmed in code (line refs verified 2026-05-21)

- HOH route reimplements signing inline: `app/api/t/[token]/pbv-full-app/sign-form/route.ts:80-350`. Route-local helpers at `:355-366` (`loadFieldMapForSigning`), `:372-405` (`buildSignatureFieldDataF5`), and a `@deprecated` dead copy at `:407-436`.
- Member-token route already calls `completeFormSigning` with a mock `Request`: `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts:80-101`.
- Shared fn: `lib/pbv/signing/completeForm.ts:42-278`. `CompleteFormOptions` at `:17-27` takes `request: Request`; insert at `:135-151` uses `typed_name: member.name` (`:142`); reads IP/UA from `request` at `:131-133`; writes `signing_device` unconditionally at `:263-266` (already correct for #2).
- Finalize validator: `lib/pbv/finalizeValidation.ts:38-136`. Check 3 loads `formDocs` at `:78-82`. No hash check exists.
- generate-forms unsigned upload: `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:143-149`; upsert at `:166-189`; `sha256Hex` helper at `lib/pbv/form-generation/source-pdfs.ts:119`.
- `source_pdf_hash` already exists but is the **source template** hash, not the stamped unsigned bytes — `unsigned_pdf_hash` is new and distinct.

---

## Step-by-step

### Step 0 — Confirm the refs
Open the five files above and confirm the line refs still hold. If anything has drifted, note `[Unverified]` in the build report and proceed against the real code.

### Step 1 — Extend `CompleteFormOptions` (#3, #12)
In `lib/pbv/signing/completeForm.ts`:
- Add `typedName: string;` to `CompleteFormOptions`. Replace `request: Request;` with `ipAddress: string | null;` and `userAgent: string | null;`.
- At the insert, write `typed_name: options.typedName` (drop `member.name` and the "Will be updated by caller" comment). Use the passed `ipAddress` / `userAgent`; delete the `request.headers.get(...)` reads at `:131-133`.
- Leave the unconditional `signing_device` write (`:263-266`) — that's what #2 needs.

### Step 2 — HOH route delegates (#1, #2, #8)
In `app/api/t/[token]/pbv-full-app/sign-form/route.ts`:
- **Keep** the route-specific preamble that the shared fn doesn't cover: body parse/validate, `X-Assisted-By` resolution (`:69-78`), the **summary-doc-signed gate** (`:100-116`, HOH-only), and the `withTenantContext` + custom idempotency-key wrapper.
- **Replace** the inline block (`:80-349`, "Load form document" → final return) with a call to `completeFormSigning({ formDocId: form_document_id, appId: app.id, signerMemberId: signer_member_id, deviceOwner: device_owner, signatureImagePath: signature_image_path, ceremonyId: ceremony_id, consentTextVersion: consent_text_version, typedName: typed_name, assistedByStaffUserId, ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? null, userAgent: request.headers.get('user-agent') ?? null })`. Map the result to the route's existing response shape `{ success, data: { form_document_id, signer_member_id, all_signed, status, signed_pdf_path } }`. Map `result.success === false` to 404 when the error mentions "not found", else 422 (mirror the member-token route).
- **Delete** `loadFieldMapForSigning`, `buildSignatureFieldDataF5`, and the `@deprecated buildSignatureFieldData`. Remove now-unused imports (`stampForm`, `createHash`, `FieldMap`) so `tsc` stays clean.
- Confirm the member-token route does **not** apply the summary gate (intentional — leave it).

### Step 3 — Member-token caller (#3, #12)
In `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts`:
- Delete the `mockRequest` (`:80-89`). Pass `typedName: typed_name`, `ipAddress`, `userAgent` directly to `completeFormSigning` (it already computes `ipAddress` / `userAgent` at `:76-77`). Keep `assistedByStaffUserId: null`.

### Step 4 — `document_hash` verification (#6, cached-hash variant)
- **Migration** `supabase/migrations/<UTC-ts>_prd62_unsigned_pdf_hash.sql` (mirror the header/comment style of `20260521000000_prd55b_form_sourcing_corrections.sql`): `ALTER TABLE public.pbv_form_documents ADD COLUMN IF NOT EXISTS unsigned_pdf_hash TEXT;` + a `COMMENT ON COLUMN` noting it's `sha256` of the stamped unsigned bytes the signer hashes (distinct from `source_pdf_hash`). **Commit only; list in OPEN-DECISIONS; do not apply.**
- **generate-forms** (`generate-forms/route.ts`): at the unsigned upload, compute `sha256Hex(stampedPdf)` (import already-present helper from `source-pdfs.ts`) and add `unsigned_pdf_hash: <that>` to the `pbv_form_documents` upsert (`:166-189`).
- **finalizeValidation** (`finalizeValidation.ts`): add `unsigned_pdf_hash` to the Check 3 `select`. Add **Check 5** after Check 4: for each non-skipped `formDoc` with a non-null `unsigned_pdf_hash`, query `pbv_signature_events` (`document_hash, signer_member_id`) for that `form_document_id`; for any event where `document_hash !== formDoc.unsigned_pdf_hash`, push `{ signer_name: memberMap.get(e.signer_member_id)?.name ?? 'Unknown', doc_label: \`${formDoc.form_id} (signature/document hash mismatch — please re-sign)\`, doc_id: formDoc.id }` into `result.missing.signatures`. **If `unsigned_pdf_hash` is null, skip that form** (no block — legacy/pre-migration rows). Do **not** download PDFs — cached-hash only.

### Step 5 — Static gates + build report + commit + push
- Write the tests in the PRD's "Files expected to change" (typed_name; per-signer signing_device on first tap; finalize hash mismatch + match; HOH route calls `completeFormSigning` + no route-local helpers remain). The existing `finalizeValidation.test.ts` mock is a sequential-response queue — update its queued responses for the new `unsigned_pdf_hash` select and the added `pbv_signature_events` query so existing cases stay green.
- `node ./node_modules/typescript/bin/tsc --noEmit`, then `npm run build`, then `vitest run` — all clean/green.
- Build report at `docs/build-reports/62-pbv-signing-unification-and-audit-integrity_build-report_2026-05-21.md`.
- Commit `PRD-62: signing unification + audit-trail integrity`. Push. Then proceed to the PRD-63 prompt.

---

## Files to modify

| File | Change |
|---|---|
| `lib/pbv/signing/completeForm.ts` | `CompleteFormOptions`: +`typedName`, +`ipAddress`/`userAgent`, −`request`; insert `options.typedName`; drop the lying comment |
| `app/api/t/[token]/pbv-full-app/sign-form/route.ts` | delegate to `completeFormSigning`; keep preamble + summary gate + idempotency; delete route-local helpers + `@deprecated` copy + unused imports |
| `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` | delete mock `Request`; pass `typedName` + `ipAddress`/`userAgent` |
| `lib/pbv/finalizeValidation.ts` | +`unsigned_pdf_hash` in Check 3 select; +Check 5 (cached-hash mismatch → block) |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | compute + write `unsigned_pdf_hash` at the unsigned upsert |
| `supabase/migrations/<ts>_prd62_unsigned_pdf_hash.sql` | add the column — **commit only, list in OPEN-DECISIONS, do not apply** |
| `lib/pbv/__tests__/completeForm.test.ts` (new) | typed_name + per-signer signing_device |
| `lib/pbv/__tests__/finalizeValidation.test.ts` | hash mismatch/match; update existing cases for new select + query order |
| `app/api/t/[token]/pbv-full-app/__tests__/sign-form-unification.test.ts` (new) | HOH route calls shared fn; no route-local helpers |

## Files NOT to touch

- `X-Assisted-By` validation semantics (#4), regenerate-lock (#5), conditional/resolver fail-closed (#7, #14), idempotency scoping (#9), atomic finalize event (#10), signed-PDF versioning (#11), `tryLoadPdf` (#13) — separate PRDs.
- `stampForm`, summary doc, intake, documents, generation logic (the only generate-forms edit is writing `unsigned_pdf_hash`).

---

## Verification gates (per PRD-62)

**Static (must pass in-session before commit):**
- **Gate 1:** HOH route calls `completeFormSigning`; `buildSignatureFieldDataF5` + `@deprecated` copy gone.
- **Gate 2:** inserted `typed_name === options.typedName` (not `member.name`).
- **Gate 3:** first signer's `signing_device` written on the first tap (update fires when `allSigned === false`).
- **Gate 4:** finalize returns `ready:false` + "hash mismatch" entry when `document_hash !== unsigned_pdf_hash`; `ready:true` when they match.
- **Gate 5:** `tsc --noEmit` + `npm run build` clean; `vitest run` green.

**Deferred to the post-run pass (list in build report, do NOT block):**
- **R1:** multi-signer form via HOH path records distinct `signing_device` per signer (needs deploy + signing walk).
- **R2:** member-token `typed_name` equals the typed value, not the DB name (needs deploy).
- **R3:** after migration + generate-forms + sign, finalize succeeds; mutate stored bytes/hash → finalize blocks with re-sign message (needs deploy + applied migration).

---

## What "done" looks like

1. `PRD-62: …` commit on `feat/pbv-launch-hardening`, pushed; migration committed + listed in OPEN-DECISIONS (not applied).
2. Both sign-form routes complete through `completeFormSigning`; route-local + dead helpers deleted.
3. `typed_name` + per-signer `signing_device` correct for both paths.
4. Finalize blocks on cached-hash mismatch; passes when hashes match or hash is absent (legacy).
5. Static gates green; build report written with deferred R1–R3 listed.

## What NOT to do

- **Do not stop to ask** — default-and-log per the batch protocol (e.g. the branch-base choice, the legacy null-hash skip).
- Do not apply the migration to prod. No destructive SQL.
- Do not use `npx tsc`. Do not "fix" `.git/config`.
- Do not download PDFs at finalize — cached-hash only.
- Do not pull in any of the out-of-scope audit findings (#4, #5, #7, #9–#11, #13, #14).

## Reporting back (in the build report)

- Branch base chosen + why; commit SHA; pushed yes/no; migration path (listed in OPEN-DECISIONS).
- Confirmation that both routes share `completeFormSigning` and the dead/duplicate code is gone.
- Static gate results; any `[Unverified]` line-ref drift found in Step 0.
- Decisions logged to OPEN-DECISIONS (branch base, legacy null-hash skip, any others).
- Deferred runtime gates R1–R3 for the post-run pass. Then proceed to the PRD-63 prompt.
