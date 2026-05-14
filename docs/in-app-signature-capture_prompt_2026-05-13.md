# Windsurf Prompt — In-App Signature Capture

**PRD:** `docs/in-app-signature-capture_prd_2026-05-13.md` (read end-to-end)
**Build report:** `docs/build-reports/in-app-signature-capture_build-report_2026-05-13.md`
**Depends on:** `post-approval-execution` (PRD IV) fully merged with both phases. Specifically: `packet_signatures` table exists with `signature_method` enum including `'in_app'`; the "Sign in-app" placeholder buttons are present in the UI; storage bucket `signing-packets` exists.
**Blocks:** none

---

## Execution mode

**Use the goal skill.** Two phases (tenant capture, then staff capture). Execute end-to-end without asking Alex to confirm between phases. **Stop only if:** a verification gate fails, a Hard NO is hit, a Required-reading file is missing, or PDF library / email service choices can't be resolved from the existing codebase (in which case ask).

---

## Schema verification — use Supabase MCP

Before and after migration, use `mcp__supabase__list_tables` and `mcp__supabase__execute_sql` to verify schema state directly from the live DB. Document findings in the build report. If MCP is unavailable, fall back to migration-file inspection and note it.

Specifically verify:
- Before: `packet_signatures` exists with `signature_method` enum including `'in_app'` (PRD IV's contract). If not, STOP — PRD IV isn't fully deployed.
- After: `signature_capture_audit` and `consent_text_versions` tables exist with correct columns and indexes.
- After: 3 rows in `consent_text_versions` (en, es, ht) with `is_active=true`.

---

## Context

You are building the legally-enforceable electronic signature capture system that activates the placeholder "Sign in-app" buttons PRD IV left disabled. Tenant and staff signers go through the same canonical flow (consent → identity → document review → signature → apply → delivery). Each capture writes an immutable `signature_capture_audit` row with timestamps, IP, user agent, hashes, and identity-verification metadata — the legal evidence record.

v1 is wet-sign-fallback-compatible: the upload-signed-PDF path from PRD IV remains alongside this capture flow on every signature row. A signer chooses.

---

## Required reading before you start

1. **`docs/in-app-signature-capture_prd_2026-05-13.md`** — every section, including Risks.
2. **`docs/post-approval-execution_prd_2026-05-13.md`** — the PRD IV contract you're integrating with. Specifically the `packet_signatures` schema, `signed_pdf_path` storage convention, and the placeholder button locations in `SignatureRow.tsx`.
3. **`lib/events/application-events.ts`** — `signature_received` event you'll emit.
4. **`components/signing/SignatureRow.tsx`** (from PRD IV) — the file that holds the placeholder button you'll activate.
5. **`app/pbv-full-app/[token]/...`** — tenant magic-link flow; identify the existing language-selection mechanism.
6. **`lib/auth.ts`** — admin session.
7. **Existing email service** — grep the codebase for the email sender used elsewhere (likely a Resend / Postmark / SendGrid integration; find and reuse rather than introduce a new one).
8. **`lib/hach/payload-filter.ts`** — confirm no audit fields leak to HACH.

---

## Build

### Phase 1 — Tenant capture + audit infrastructure

**Step 1 — Schema verification (pre-migration)**

Run the MCP checks. Confirm `packet_signatures` is present and includes `signature_method` enum with `'in_app'`. If absent, STOP — PRD IV not complete.

**Step 2 — Migration**

Create `supabase/migrations/20260513XXXXXX_in_app_signature_capture.sql` per the PRD's data model:
- `signature_capture_audit` with immutability via RLS (SELECT + INSERT only, no UPDATE/DELETE policies).
- `consent_text_versions` with the version-by-language uniqueness.
- Permission seed: `pbv-full-applications:view_signature_audit`.
- Consent text seed in three languages, version `esign-disclosure-v1`, all active.

Apply via `mcp__supabase__apply_migration`. Verify post-state via MCP.

**Step 3 — Helpers**

Create under `lib/signing/capture/`:
- `consent.ts` — `loadActiveConsent(language)` returns the active consent text.
- `identity.ts` — DOB-match for tenants, session-resolve for staff. Includes lockout tracking (3 attempts, 24h).
- `hash.ts` — SHA256 helper for PDFs.
- `pdf-stamp.ts` — server-side stamping using `pdf-lib` (or alternative if you find a better fit; document the choice).
- `delivery.ts` — email-or-portal-download dispatcher.
- `audit.ts` — `writeAuditRow(tx, params)` requires a transaction (matching the events helper pattern).
- `capture-state.ts` — server-side state machine: holds consent + identity + review + capture between steps. Implementation: small `signature_capture_in_progress` table with 30-minute TTL, OR session storage if available. Cascade picks; document choice.

**Step 4 — Tenant API**

Create routes under `app/api/tenant/signing/[token]/[signatureId]/`:
- `consent/route.ts` — GET active consent text in application's language; POST records consent + IP + user agent + version.
- `identity/route.ts` — POST receives DOB; validates against the household HoH DOB; tracks attempts; returns success or lockout.
- `document-reviewed/route.ts` — POST records review with `pages_viewed`.
- `apply/route.ts` — the commit endpoint. Body: `{ typed_name, signature_image_data_url, date }`. Atomically:
  - Re-validate token + active consent version + identity verified + review recorded.
  - Hash original PDF, apply stamp, hash signed PDF.
  - Upload signed PDF to `signing-packets` bucket at the PRD IV path convention.
  - Update `packet_signatures.signed_pdf_path`, `signed_at`, `signature_method='in_app'`, `signed_pdf_uploaded_by_role='tenant'`.
  - Insert `signature_capture_audit` row.
  - Write `signature_received` event with `signature_method='in_app'` in metadata.
  - Trigger delivery (email if tenant has one, else portal-only).
  - All in one transaction.

**Step 5 — Tenant UI**

Create pages under `app/tenant-signing/[token]/[signatureId]/`:
- `page.tsx` — orchestrator that walks the signer through steps based on capture state.
- `Consent.tsx` — disclosure + checkbox.
- `IdentityCheck.tsx` — DOB input + attempts tracking.
- `DocumentReview.tsx` — PDF reader with page-view tracking.
- `SignaturePad.tsx` — typed name + canvas signature.
- `FinalConfirm.tsx` — summary + apply button.
- `Confirmation.tsx` — success state with download.

Build shared components under `components/signing/`:
- `SignatureCanvas.tsx` — touch-friendly HTML5 canvas, Clear button, minimum 10-stroke validation.
- `PdfReader.tsx` — PDF.js-based viewer with page-view telemetry.

**Step 6 — Activate the tenant-side "Sign in-app" button (PRD IV)**

Modify `components/signing/SignatureRow.tsx` (from PRD IV):
- The button currently renders disabled with "Coming soon" tooltip.
- Add detection: when this PRD's API endpoint exists OR a feature flag `IN_APP_SIGNATURE_ENABLED` is set, the button activates and links to `/tenant-signing/[token]/[signatureId]` (for tenant context) or staff equivalent.
- The placeholder button does NOT disappear — it stays in the UI, just becomes active.

**Step 7 — Phase 1 tests**

Create `__tests__/in-app-signature-capture-tenant.test.ts`:
1. Migration applies; tables and seeds exist.
2. Tenant consent flow records consent fields correctly.
3. Tenant identity: correct DOB succeeds; 3 wrong DOBs trigger 24h lockout.
4. Document review records `pages_viewed`; if too few, apply rejects.
5. Apply atomically: PDF hashed, stamped, hashed again, audit row written, packet_signatures updated, event written, delivery queued.
6. Audit row is immutable — direct UPDATE/DELETE attempts fail.
7. Tampering detection: modify the stored signed PDF, re-hash, compare to `signed_document_hash` — they differ.
8. PRD IV's tenant-side "Sign in-app" button activates.
9. Trilingual: render consent in es and ht based on application's preferred language.
10. Wet-sign upload path on the same signature row still works — both paths coexist.

**Step 8 — Phase 1 verification gates**

- `npm run build` — zero.
- `npm test` — green.
- Schema verification via MCP in build report.
- Manual end-to-end:
  - Open a tenant magic link for a HACH-approved application.
  - Click "Sign in-app" on a tenant-required row.
  - Walk through consent → DOB → document review → signature pad → confirm → apply.
  - Verify confirmation page renders, signed PDF downloadable, email received (or portal-fallback message).
  - Verify staff signing surface shows the row as `signed` with `signature_method='in_app'` and "Uploaded by tenant" attribution.
  - Capture screenshots.

If gates pass, auto-proceed to Phase 2.

---

### Phase 2 — Staff capture + audit viewing

**Step 9 — Staff API + UI**

Mirror tenant flow under `app/api/admin/signing/[signatureId]/` and `app/signing/[signatureId]/`:
- Identity step uses admin session (no DOB check); `identity_method='admin_session'`.
- Rest of flow identical.

**Step 10 — Activate staff-side "Sign in-app" button**

Same modification to `SignatureRow.tsx` as in Step 6, for the staff context.

**Step 11 — Audit-view endpoint + admin view**

Create `app/api/admin/signing/[signatureId]/audit/route.ts`:
- GET. Auth: `isAuthenticated` + `pbv-full-applications:view_signature_audit`.
- Returns the audit row for that signature.

Add a small "View audit trail" link on each signed signature row in PRD IV's signing surface, visible only to users with the permission. Opens a modal showing the audit details (signer name, identity method, consent version, timestamps, IP, hashes).

**Step 12 — Phase 2 tests**

Create `__tests__/in-app-signature-capture-staff.test.ts`:
1. Staff capture flow end-to-end.
2. Staff-side "Sign in-app" button activates.
3. Audit-view endpoint returns the audit record for users with permission; 403 for users without.
4. Audit row for staff has `signer_role='stanton'`, `identity_method='admin_session'`.

**Step 13 — Phase 2 verification gates**

- `npm run build` — zero.
- `npm test` — green.
- Manual end-to-end: as a staff member, walk through the capture flow for a stanton-required signature. View the audit trail afterward.

If gates pass, build complete.

---

## Tech constraints

- Next.js App Router, React 18+, TS strict, Vitest, no new deps **except** the PDF library (Cascade documents the choice — likely `pdf-lib` MIT).
- Server-side PDF stamping; do NOT do canvas rasterization on client and trust it. Client provides the signature image data URL; server rasterizes and stamps.
- SHA256 via Node's `crypto` module — no new dep.
- Use the existing email service. Identify in the build report.
- Mobile-first CSS on the tenant flow.

---

## Hard NOs

- **Do NOT integrate a third-party e-sign provider.** This whole PRD is about owning the capture in-house.
- **Do NOT integrate a third-party identity verification service** in v1. DOB-match for tenants, admin session for staff. Enhanced ID verification is Phase 3, out of scope.
- **Do NOT make the audit row mutable.** No UPDATE policy, no DELETE policy, no admin-level "edit signature record" UI.
- **Do NOT trust client-side hashing.** Server hashes both original and signed PDFs.
- **Do NOT skip the page-view telemetry check on document review.** If `pages_viewed` < `pdf_page_count`, apply rejects.
- **Do NOT hardcode the consent disclosure text.** Read from `consent_text_versions` table by language.
- **Do NOT remove the wet-sign upload path from PRD IV.** Both methods coexist on every signature row.
- **Do NOT activate the "Sign in-app" buttons before this PRD's API is deployed.** Activation is conditional.
- **Do NOT allow tenants to sign rows that aren't tenant-party.**
- **Do NOT skip the migration file commit.** Versioned in `supabase/migrations/`.
- **Do NOT skip the build report.**
- **Do NOT skip writing tests.**
- **Do NOT add TODOs or placeholders.**

---

## Build report requirements

Create `docs/build-reports/in-app-signature-capture_build-report_2026-05-13.md` with:

1. PRD reference + execution mode confirmation
2. Pre-migration MCP schema state
3. Post-migration MCP schema verification (column-level for `signature_capture_audit` and `consent_text_versions`)
4. PDF library choice and rationale
5. Email service identification — which service the codebase uses, how delivery integrates
6. Capture-state implementation choice (TTL table vs session) with rationale
7. Phase 1 acceptance criteria — checkboxes with notes
8. Phase 2 acceptance criteria — checkboxes with notes
9. Files created — list
10. Files modified — list (specifically including `components/signing/SignatureRow.tsx` from PRD IV with the activation note)
11. Save-path registry for every mutation
12. Test output — full Vitest paste
13. Manual walkthrough log — tenant and staff captures with screenshots in `docs/build-reports/screenshots/in-app-signature-capture-2026-05-13/`
14. **Tampering test result** — explicit verification that modifying the stored signed PDF causes the hash check to fail
15. **Immutability test** — explicit verification that audit row UPDATE/DELETE are rejected
16. **Trilingual verification** — screenshots of the consent flow in each of en/es/ht
17. HACH wall verification — no audit data leaks
18. Deviations from PRD with reasoning
19. Pre-existing issues observed
20. Final pass/fail summary

---

## When you finish

Reply in chat with:
- Confirmation Phase 1 and Phase 2 completed
- Pass/fail on each verification gate (Steps 8 + 13)
- Build report path
- PDF library and email service identified
- Anything that blocked you
- Specifically: did the tampering detection test pass (modifying signed PDF causes hash mismatch)?
- Specifically: did the audit immutability test pass (UPDATE/DELETE rejected by RLS)?
- Specifically: did PRD IV's "Sign in-app" buttons activate on both tenant and staff surfaces?
- Specifically: did the wet-sign upload path still work on the same signature rows (coexistence)?

If any verification item fails, do not declare complete.
