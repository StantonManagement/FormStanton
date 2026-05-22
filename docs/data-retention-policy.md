# PBV Data Retention Policy

**Status:** v1.0 draft — pending HACH / program sign-off on the retention period.
**Last updated:** 2026-05-21 (PRP-019 G5).

## Scope
This policy covers the personally-identifiable information collected by the
PBV (Project-Based Voucher) full-application flow:

- `pbv_full_applications` rows: head-of-household name, phone, email,
  mailing address, intake_data / intake_snapshot blobs.
- `pbv_household_members` rows: per-member name, DOB, SSN-last-four,
  contact details.
- Signature artifacts:
  - `pbv_signature_events.signature_image_path` (Storage references).
  - `pbv_form_documents.signed_pdf_path` and `unsigned_pdf_path`.
  - The actual objects under the `pbv-signatures` and `pbv-forms`
    Storage buckets.
- Document uploads under the `form-submissions` bucket
  (`pbv-documents/{appId}/...`).
- Audit-event metadata in `application_events` and
  `pbv_signature_events` (retained even after PII anonymization).

## Retention period — **TBD (confirm with HACH / program)**
HUD record-retention requirements vary by program. Common bars:

- HACH compliance program: **per HACH agreement** — historically PHAs
  retain Section 8 records for 3 years after the household exits the
  program OR per Federal Records Retention Schedule.
- Application denials: **3 years** from denial date (24 CFR 5.508
  equivalent).
- Audit-event tables: kept **indefinitely** for tamper-evident review,
  even when associated PII is anonymized.

**Action item:** Alex to confirm the exact retention period with HACH /
program counsel and update this document. Until confirmed the engineering
default is "retain indefinitely until the anonymization endpoint is run
manually by an admin."

## Deletion approach

### Layer 1: PII anonymization (in-place row scrub)
`DELETE /api/admin/pbv/full-applications/[id]/data` (PRP-019 / G3):
- RBAC-gated (`pbv_full_applications:delete`).
- Replaces `head_of_household_name`, member `name`, and signature image
  paths with the sentinel `[ANONYMIZED]`.
- Nulls out `phone`, `email`, `mailing_address`, member `dob`,
  member `ssn_last_four`, member contact, and the `intake_data` /
  `intake_snapshot` JSON blobs.
- Preserves `application_events` and `pbv_signature_events` rows so the
  ceremony / processing trail is still inspectable.
- Records the action as a `pbv_application_data_anonymized` event.
- Idempotent — re-runs are no-ops.

### Layer 2: Storage-object lifecycle (cron, pending build)
The PII row scrub tombstones the signature/PDF paths but **does not**
delete the underlying Storage objects. The objects are still readable
by `service_role` via the original path until a Storage-lifecycle job
runs.

**Action item:** wire a Supabase Edge Function or Vercel cron to:
1. Query `pbv_signature_events.signature_image_path = '[ANONYMIZED]'`
   and `pbv_form_documents.signed_pdf_path` belonging to anonymized
   applications.
2. Delete the corresponding objects from the `pbv-signatures` /
   `pbv-forms` / `form-submissions` buckets.
3. Run on a low-traffic window (3:00 AM ET, weekly).

Documented as a v1.1 follow-up — not part of PRP-019 itself.

### Layer 3: Application/member hard delete (out of scope)
Hard-deleting `pbv_full_applications` rows breaks audit-event foreign
keys (`application_events.application_id`). The PII-anonymize-but-keep
approach above is the canonical right-to-delete handling. If a HACH
audit ever requires a full hard delete, the audit-event rows must be
moved to a `deleted_applications_audit` table first.

## Tenant-facing right-to-delete UX (out of scope)
The audit flagged this as G3. The current implementation is admin-only.
A tenant-facing self-serve UI is a v1.1 deliverable; the API endpoint
already exists and can be wrapped.

## Audit-event tamper-evidence (G4)
The audit-event tables are append-only at the schema level
(`service_role` writes only; no RLS for tenant access). A full
tamper-evident hash chain (`event_hash = sha256(prev_hash || canonical_payload)`)
is a **known v1.1 gap** with the design captured below:

1. Add `event_hash text` and `prev_event_hash text` columns to
   `application_events` and `pbv_signature_events`.
2. On insert, compute `event_hash = sha256(prev_event_hash || canonical_json(payload))`.
   `prev_event_hash` is the last `event_hash` for the same
   `application_id`, in `occurred_at ASC` order.
3. At finalize time, the `finalize_pbv_application` RPC re-walks the
   chain and verifies each link; mismatch → `tampered_event_chain`
   error.
4. Backfill on existing rows is a one-time job: compute hashes in
   `occurred_at ASC` order per application.

**Why deferred:** the chain implementation touches every event-write site
(`writePbvApplicationEvent`, `completeFormSigning`, etc.) and requires a
new finalize-time verifier. Per PRP-019's scope call, the safer path is
to document + design now and ship in v1.1 once the team can give it
exclusive attention.

## Open questions
- Retention period per HACH / program counsel.
- Whether application_events should also be subject to the right-to-delete
  (current default: NO — they're audit, not personal data).
- Whether the Storage-lifecycle cron should run during the anonymize
  call itself, or stay decoupled for safety. (Current decoupled design
  protects against accidental mis-routes.)

## Related
- `docs/audits/pbv-angle-2-audit_2026-05-21.md` G3, G4, G5.
- `docs/build-reports/PRP-019_data-lifecycle-and-audit-tamper-evidence_build-report_2026-05-21.md`.
