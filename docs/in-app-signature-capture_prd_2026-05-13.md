# In-App Signature Capture — PRD

**Status:** Draft — ready for review
**Date:** 2026-05-13
**Depends on:** `post-approval-execution` (PRD IV — the signing packet model and storage path; this PRD activates the placeholder "Sign in-app" buttons that PRD IV ships)
**Blocks:** none

---

## Problem Statement

PRD IV ships a wet-sign tracking layer — signers upload signed PDFs, the system records who and when. This works but is friction-heavy: the tenant has to print, sign, scan or photograph, and upload. The PM has to chase tenants for signed copies. HACH and Stanton swap paper.

Stanton wants in-app electronic signature capture for tenant- and staff-required signatures. The signature tool must meet the legal floor for enforceable electronic signatures (ESIGN Act / UETA in the US), be owned by Stanton (no third-party e-sign provider integration), be mobile-friendly, and be trilingual (matching Stanton's existing intake language support).

This PRD adds the capture system. It writes to the same `packet_signatures` table that PRD IV created and emits the same `signature_received` event PRD IV already handles — the integration point is the placeholder buttons PRD IV left disabled. When PRD V ships, those buttons activate and the wet-sign path remains as a fallback.

---

## Goals

1. Capture electronic signatures that meet ESIGN Act / UETA standards: signer intent, disclosed consent, association with the document, immutable record retention, audit trail (timestamps, IP, user agent, identity verification), document integrity (hashing), and copy delivered to signer.
2. Tenant flow via magic link and staff flow via existing admin session — both produce the same legal artifact.
3. Mobile-friendly UX, especially on the tenant side.
4. Trilingual (English, Spanish, Haitian Creole — matching intake).
5. Drop in to PRD IV without changes to PRD IV's data model — write to `packet_signatures.signed_pdf_path` with `signature_method='in_app'`.
6. Every capture writes a row to `signature_capture_audit` — the legal evidence record.

---

## Users & Roles

| Role | Sign in-app | View own audit trail | Admin: view any audit record |
|---|---|---|---|
| Tenant | Yes (for tenant-required signatures) | Yes (via magic link) | — |
| Stanton admin | Yes (for stanton-required signatures) | Yes (own) | Yes (with `pbv-full-applications:view_signature_audit` permission) |
| HACH | — (HACH signs HAP via their own internal system; Stanton uploads HACH-signed copies the wet-sign way) | — | — |

HACH e-sign integration is explicitly out of scope. In v1 the HAP contract remains a wet-sign workflow because HACH's side is paper / their own portal. PRD IV's HAP flow handles this.

---

## Core Features

### 1. The capture flow

A single canonical flow shared by tenant and staff (with auth differences only):

**Step 1 — Entry.** Signer clicks "Sign in-app" on a signature row in PRD IV's signing surface (tenant magic link OR staff admin). Lands on `/signing/[signatureId]` (or tenant-portal equivalent).

**Step 2 — Disclosure & consent.** A page in the signer's preferred language:
- Plain text disclosure: "You are about to sign this document electronically. By doing so, you agree that your electronic signature has the same legal effect as a handwritten signature. You may request a paper copy instead by [link / phone / email]."
- Checkbox: "I agree to sign electronically."
- Submit button (disabled until checkbox is checked).
- On submit, persists `consent_recorded_at`, `consent_text_version`, IP, user agent.

**Step 3 — Identity verification.**
- Tenant: magic-link token validation + DOB confirmation field (must match `pbv_household_members.date_of_birth` for the head of household).
- Staff: existing admin session (no extra step).
- Failed identity → blocking error, audit row written with `identity_verification_failed`.

**Step 4 — Document presentation.**
- PDF rendered in browser via PDF.js or equivalent.
- Pagination scrollbar required — the signer MUST scroll past every page before the next button enables. Scroll depth tracked client-side, confirmed server-side via a `pages_viewed` count.
- "I have reviewed this document" checkbox at the bottom.

**Step 5 — Signature capture.**
- Two fields, both required:
  - **Type your full legal name** (text input)
  - **Draw your signature** (HTML5 canvas, touch/mouse, with "Clear" button)
- Captured as: typed name text + canvas data URL.
- Date input pre-filled to today, editable only by signer (not staff).

**Step 6 — Final confirm.**
- Summary page: document name, signer name (typed), date, signature image preview.
- "Apply signature" button — terminal action.

**Step 7 — Server-side application.**
- Original PDF hashed (SHA256).
- Signature stamp applied: signer name + signature image + date overlaid on the last page (or a signature page if the template specifies).
- Signed PDF hashed (SHA256).
- Stored at the same path PRD IV uses (`{application_id}/{signature_id}/{revision}_signed_in_app.pdf`).
- `packet_signatures.signed_pdf_path` updated; `signature_method='in_app'`; `signed_at=NOW()`; `signed_pdf_uploaded_by_role=tenant|stanton`.
- `signature_capture_audit` row written.
- `signature_received` event written (matches PRD IV's pattern).

**Step 8 — Delivery.**
- Signed PDF emailed to signer (tenant: to their on-file email; staff: to their admin email).
- Confirmation page: "Your signature has been recorded. A copy has been emailed to you. You may also download it now."
- Download link to the signed PDF.

### 2. Audit record

The `signature_capture_audit` table is the legal evidence record. Every field is mandatory or explicitly nullable. The row is written atomically with the signature application. Once written, it is immutable (no UPDATE, no DELETE).

Fields captured per the data model below. Key audit elements:
- Signer identity (user ID for staff, magic-link token + DOB-verification status for tenant)
- Consent (text version, timestamp, IP, user agent)
- Document integrity (original SHA256 hash, signed SHA256 hash)
- Signature method (typed name, drawn signature, both)
- Time stamps for every step (consent, identity, document review, signature)
- Delivery (method, timestamp)

### 3. Trilingual support

The capture flow renders in the signer's preferred language for the application (existing intake-language field on `pbv_full_applications` or `pbv_household_members`). All three:
- English (default)
- Spanish
- Haitian Creole

Translation surface for the consent disclosure, identity verification copy, document review prompt, signature page, confirmation, and email body. Stored as translation tables, not hardcoded strings, so they can be updated for compliance phrasing without a code change.

### 4. Mobile-friendly

The capture flow is the primary mobile use case. Tenant signs on their phone, not at a desktop.
- Single-column layout, large tap targets.
- Canvas signature input works with touch.
- PDF viewer mobile-optimized (pinch-zoom, swipe-paginate).
- File saving via mobile share sheet or download.

### 5. Backwards compatibility

When PRD V ships, PRD IV's "Sign in-app" placeholder buttons activate. The signing surface from PRD IV does not need code changes — the buttons were always there, just disabled. PRD V's activation is a feature-flag flip OR a check on whether PRD V's API endpoint exists, whichever Cascade decides.

The wet-sign upload path remains alongside. A signer may choose to upload an externally-prepared signed PDF instead of using the in-app flow, on any signature row. Both paths write to the same `signed_pdf_path` with different `signature_method` values.

---

## Data Model

### Migration: `20260513XXXXXX_in_app_signature_capture.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. signature_capture_audit — immutable legal evidence record
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.signature_capture_audit (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_signature_id         UUID        NOT NULL UNIQUE
                              REFERENCES public.packet_signatures(id) ON DELETE RESTRICT,
  -- Signer identity (one of staff or tenant is populated)
  signer_user_id              UUID        REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  signer_tenant_token         TEXT,
  signer_display_name         TEXT        NOT NULL,
  signer_role                 TEXT        NOT NULL CHECK (signer_role IN ('tenant', 'stanton')),
  -- Consent
  consent_recorded_at         TIMESTAMPTZ NOT NULL,
  consent_text_version        TEXT        NOT NULL,  -- e.g., 'esign-disclosure-en-v1'
  consent_language            TEXT        NOT NULL CHECK (consent_language IN ('en', 'es', 'ht')),
  -- Identity verification
  identity_method             TEXT        NOT NULL CHECK (identity_method IN ('magic_link_plus_dob', 'admin_session')),
  identity_verified_at        TIMESTAMPTZ NOT NULL,
  -- Document review
  document_reviewed_at        TIMESTAMPTZ NOT NULL,
  pages_viewed                INTEGER     NOT NULL,
  -- Capture
  signature_method            TEXT        NOT NULL CHECK (signature_method IN ('typed', 'drawn', 'typed_and_drawn')),
  signed_at                   TIMESTAMPTZ NOT NULL,
  -- Network metadata
  ip_address                  INET        NOT NULL,
  user_agent                  TEXT        NOT NULL,
  -- Document integrity
  original_document_hash      TEXT        NOT NULL,  -- SHA256
  signed_document_hash        TEXT        NOT NULL,  -- SHA256
  -- Delivery
  delivered_to_signer_at      TIMESTAMPTZ,
  delivery_method             TEXT        CHECK (delivery_method IS NULL OR delivery_method IN ('email', 'portal_download', 'both')),
  delivery_address            TEXT,  -- email if applicable
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One of signer_user_id or signer_tenant_token must be present
  CONSTRAINT signer_identity_present CHECK (signer_user_id IS NOT NULL OR signer_tenant_token IS NOT NULL)
);

-- Immutability: revoke UPDATE/DELETE at the table level. RLS service_role read-only.
ALTER TABLE public.signature_capture_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role read on signature_capture_audit"
  ON public.signature_capture_audit FOR SELECT TO service_role USING (TRUE);
CREATE POLICY "service_role insert on signature_capture_audit"
  ON public.signature_capture_audit FOR INSERT TO service_role WITH CHECK (TRUE);
-- No UPDATE or DELETE policy.

CREATE INDEX idx_sig_audit_packet_signature ON public.signature_capture_audit (packet_signature_id);
CREATE INDEX idx_sig_audit_signer_user      ON public.signature_capture_audit (signer_user_id) WHERE signer_user_id IS NOT NULL;
CREATE INDEX idx_sig_audit_signer_token     ON public.signature_capture_audit (signer_tenant_token) WHERE signer_tenant_token IS NOT NULL;
CREATE INDEX idx_sig_audit_signed_at        ON public.signature_capture_audit (signed_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. consent_text_versions — versioned consent disclosure text
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.consent_text_versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_key   TEXT        NOT NULL UNIQUE,  -- 'esign-disclosure-v1'
  language      TEXT        NOT NULL CHECK (language IN ('en', 'es', 'ht')),
  body          TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT FALSE,  -- only one active per language at a time
  effective_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (version_key, language)
);

-- Seed: v1 disclosure in three languages.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. permission seed
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'view_signature_audit')
ON CONFLICT DO NOTHING;
```

---

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/signing/[signatureId]/consent` | GET | `isAuthenticated` | Returns active consent text in the application's preferred language. |
| `/api/admin/signing/[signatureId]/consent` | POST | `isAuthenticated` | Records consent. Body: `{ accepted: true }`. Writes consent fields to a session-scoped capture state record. |
| `/api/admin/signing/[signatureId]/identity` | POST | `isAuthenticated` | Records identity verification (staff session). |
| `/api/admin/signing/[signatureId]/document-reviewed` | POST | `isAuthenticated` | Records that document was reviewed. Body: `{ pages_viewed: int }`. |
| `/api/admin/signing/[signatureId]/apply` | POST | `isAuthenticated` | Final apply. Body: `{ typed_name, signature_image_data_url, date }`. Server hashes original PDF, applies stamp, hashes signed PDF, writes audit row, updates `packet_signatures`, writes event, queues delivery. |
| `/api/tenant/signing/[token]/[signatureId]/consent` | GET, POST | tenant token | Tenant counterparts. |
| `/api/tenant/signing/[token]/[signatureId]/identity` | POST | tenant token | Tenant identity verify (token + DOB). |
| `/api/tenant/signing/[token]/[signatureId]/document-reviewed` | POST | tenant token | Tenant document review. |
| `/api/tenant/signing/[token]/[signatureId]/apply` | POST | tenant token | Tenant final apply. |
| `/api/admin/signing/[signatureId]/audit` | GET | `isAuthenticated` + `view_signature_audit` | Returns the audit record for a signature. |

The capture state between steps is held server-side in a transient table (or session record) so the apply step has all the prior captures available atomically. Implementation detail: `signature_capture_in_progress` table with TTL, OR Redis-style ephemeral storage if available, OR a JSONB blob column on `packet_signatures` cleared on apply. Cascade chooses.

---

## PDF stamping

Signature application uses a server-side PDF library (Cascade picks — `pdf-lib` is a likely candidate; mobile compatibility doesn't apply server-side, but bundle size and license matter). Stamp content:
- Signer name (typed)
- Signature image (rasterized from canvas data URL)
- Date
- A small text block: "Electronically signed by [name] on [date] under the [SIGNATURE_VERSION] disclosure terms. Audit ID: [audit row UUID]"

The audit ID on the stamp ties the signed PDF back to the audit row, so anyone validating the document can look up the full audit trail.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `packet_signatures` (PRD IV) | Write | Update `signed_pdf_path`, `signed_at`, `signature_method`, `signed_pdf_uploaded_by_role` |
| `application_events` | Write | `signature_received` event (matches PRD IV's pattern) |
| `signature_capture_audit` | Write | New evidence record |
| `consent_text_versions` | Read | Active consent text by language |
| Supabase storage `signing-packets` | Write | Signed PDF (same bucket as PRD IV) |
| Email service | Send | Delivery of signed PDF copy |
| `pbv_full_applications`, `pbv_household_members` | Read | Preferred language, DOB for identity verification |
| `lib/auth` | Read | Session + permission |

---

## Files Touched (Inferred — Cascade Confirms)

**NEW:**
- `supabase/migrations/20260513XXXXXX_in_app_signature_capture.sql`
- `lib/signing/capture/consent.ts` — consent text resolution
- `lib/signing/capture/identity.ts` — identity verification helpers (DOB match for tenants)
- `lib/signing/capture/pdf-stamp.ts` — server-side PDF stamping
- `lib/signing/capture/hash.ts` — SHA256 helper
- `lib/signing/capture/delivery.ts` — email + portal delivery
- `lib/signing/capture/audit.ts` — audit row writer
- `app/api/admin/signing/[signatureId]/{consent,identity,document-reviewed,apply,audit}/route.ts`
- `app/api/tenant/signing/[token]/[signatureId]/{consent,identity,document-reviewed,apply}/route.ts`
- `app/signing/[signatureId]/page.tsx` (staff)
- `app/signing/[signatureId]/Consent.tsx`
- `app/signing/[signatureId]/IdentityCheck.tsx`
- `app/signing/[signatureId]/DocumentReview.tsx`
- `app/signing/[signatureId]/SignaturePad.tsx`
- `app/signing/[signatureId]/FinalConfirm.tsx`
- `app/signing/[signatureId]/Confirmation.tsx`
- `app/tenant-signing/[token]/[signatureId]/...` (tenant mirror)
- `components/signing/SignatureCanvas.tsx`
- `components/signing/PdfReader.tsx`
- `__tests__/in-app-signature-capture.test.ts`
- `__tests__/in-app-signature-capture-tenant.test.ts`

**MODIFIED:**
- `components/signing/SignatureRow.tsx` (from PRD IV) — activate the "Sign in-app" button when PRD V's API is detected as deployed.
- Tenant-portal signing tab (from PRD IV) — same activation.
- `lib/events/application-events.ts` — no new event types (reuses `signature_received` from PRD IV).

---

## Implementation Phases

### Phase 1 — Audit infrastructure + tenant capture

- Migration (audit + consent tables + permission seed + consent text seeded in three languages)
- Server-side PDF stamping helper
- SHA256 helper, delivery helper, audit writer
- Tenant-side capture flow end-to-end (consent → identity → review → signature → apply → delivery)
- Activation of PRD IV's tenant-side "Sign in-app" button

### Phase 2 — Staff capture

- Staff-side capture flow (similar but uses admin session for identity)
- Activation of PRD IV's staff-side "Sign in-app" button
- Audit viewing endpoint for admins with `view_signature_audit`

### Phase 3 (out of scope for v1, sketched)

- Enhanced ID verification: KBA (knowledge-based authentication via lookup questions), document upload (ID + selfie), third-party identity verification integration.
- Multi-signer concurrent sessions (e.g., spouse co-signs).
- Notary-witnessed flow for documents that require it.

---

## Out of Scope

- HACH e-sign on their side. HAP signing remains wet-sign with HACH-side uploads.
- Notary integration.
- Biometric capture (fingerprint, face).
- Hardware tokens.
- Third-party identity verification services in v1 (DOB-match is the floor).
- Lease-document auto-generation. The document being signed is uploaded by Stanton (or carried from intake).
- Multi-signer flows where two people sign the same document.
- Power of attorney / attorney-in-fact signing.
- Bulk signing of multiple documents in one session.
- Saved signatures (signer re-uses prior signature).

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Tenant doesn't have email on file | Delivery falls back to portal-download with a banner "Add an email to receive copies of signed documents." Application can still progress. |
| Tenant DOB doesn't match — locked out | Three attempts, then 24-hour lockout. Staff can manually verify identity in-person and mark the signature as completed via the wet-sign path. |
| Signed PDF tampered with later | Audit row stores SHA256 of the signed PDF. Anyone verifying can re-hash and compare. |
| Audit row missing for a signed PDF | Apply step writes audit row in the same transaction as the `packet_signatures` update. If audit write fails, transaction rolls back; no `signed_pdf_path` is set. |
| Browser session expires mid-flow | Server-side capture state has a TTL (30 minutes from consent). Signer can restart but must re-consent. |
| Signer's browser crashes after apply but before delivery | Apply step is the commit point — signature is recorded. Delivery is retried via a background job (out of v1 scope; v1: best-effort send with manual download fallback). |
| Multi-page document, signer skims | Server enforces `pages_viewed` count via the client telemetry. If a signer reports `pages_viewed: 1` for a 12-page document, apply step rejects. |
| Trilingual translation drift | Consent text is versioned by `consent_text_versions.version_key`. Audit row records the exact version used. Updates to text bump the version, never edit in place. |
| Document being signed changes between consent and apply | Original-PDF hash captured at consent step. If it changes by apply step (race condition), apply rejects. |
| Mobile signature pad UX poor | Canvas with touch events; "Clear" button; signature must be at least 10 strokes to count as a signature (rejected if essentially blank). |
| Tenant uses a friend's phone, friend types tenant's name | Outside the threat model for v1. ESIGN minimum bar is met; enhanced ID verification is Phase 3. |
| Tenant doesn't speak English well and consent disclosure is dense | Trilingual support addresses this for the three languages. Beyond that, plain-language drafting and a "Read this in another language" link with the three options. |
| Stanton needs to revoke a signature | No support in v1 — audit row is immutable. If a document is re-issued, a new signature row is added (existing PRD IV pattern). The original audit row stands as a record of what happened. |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. PDF stamping library — `pdf-lib`, `pdfkit`, server-side `pdfjs`, other? | Cascade | `pdf-lib` — small, MIT, works server-side, well-maintained. Confirm at build time. |
| 2. Email delivery — what service is currently wired? | Alex | Use the existing email service in Stanton's stack. Identify in build report. |
| 3. Should the audit record include geo-IP lookup beyond raw IP? | Alex | No — raw IP is sufficient; geo lookup is privacy noise. |
| 4. Should tenants be able to "preview" what they're signing without going through identity verification? | Alex | Yes — a separate "View document" affordance that doesn't trigger the capture flow. |
| 5. Should consent text changes invalidate in-progress sessions? | Alex | Yes — server checks the active consent version on apply. If different from what the signer consented to, apply rejects with "Disclosure has been updated; please re-consent." |

---

## Acceptance Criteria

**Phase 1 — Tenant capture:**
- [ ] Migration applies cleanly; audit + consent tables exist; consent text seeded in three languages; permission seeded.
- [ ] Schema verification documented in build report via MCP.
- [ ] Tenant capture flow: consent → identity (DOB match) → document review → signature pad → final confirm → apply. Every step persists state server-side.
- [ ] DOB mismatch lockout after 3 attempts.
- [ ] Apply: server hashes original PDF, stamps it, hashes signed PDF, writes audit row + updates `packet_signatures` + writes event in a single transaction.
- [ ] Signed PDF delivered via email (or portal-download fallback).
- [ ] Audit row is immutable — UPDATE/DELETE policies refuse changes.
- [ ] PRD IV's tenant-side "Sign in-app" button is now ACTIVE (no longer disabled, no tooltip).
- [ ] Trilingual: consent + UI render in English / Spanish / Haitian Creole based on application language.
- [ ] Mobile-friendly: capture flow usable on a phone (manual smoke test).
- [ ] Tampering test: modify the signed PDF after the fact, re-hash it, compare to `signed_document_hash` — confirms tampering detection works.

**Phase 2 — Staff capture:**
- [ ] Staff capture flow mirrors tenant; uses admin session for identity verification.
- [ ] PRD IV's staff-side "Sign in-app" button is now ACTIVE.
- [ ] Audit-view endpoint for users with `view_signature_audit` returns the full audit record.
- [ ] No regression to wet-sign-upload paths from PRD IV — both signature_methods coexist.

**End-to-end:**
- [ ] A tenant signs the lease in-app, the staff signs the countersigned copy in-app, the audit trail shows both events with hashes, the signed PDF in storage matches the recorded hash. The PRD IV signing surface reflects both rows as `signed` with `signature_method='in_app'`.
