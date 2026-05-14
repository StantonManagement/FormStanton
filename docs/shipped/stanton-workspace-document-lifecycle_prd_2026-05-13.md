# Stanton Workspace — Document Lifecycle — PRD

**Status:** Draft — ready for review
**Date:** 2026-05-13
**Depends on:** `unified-review-surface` and `review-workspace-schema` (both merged)
**Blocks:** `per-document-assignment`, `workforce-dashboards`, `post-approval-execution` (the remaining three PRDs in the end-to-end application lifecycle initiative)

---

## Problem Statement

The Stanton review surface at `app/admin/pbv/full-applications/[id]/page.tsx` presents itself as a workspace but is incomplete in three places that make the day-to-day workflow expensive for an overworked property manager:

1. **No staff upload path.** The system assumes every document arrives via the tenant magic link. In practice, tenants walk in with paper, email PDFs directly to the PM, hand documents to a family member, or fail to use the portal at all. HACH also sometimes sends documents (intake checklists, internal verifications) that the PM needs to attach to the file. Today the only workaround is a paper shadow file or a tech-support ticket — both bad outcomes.

2. **No explicit Send-to-HACH handoff.** `pbv_full_applications.hach_review_status` exists with values `pending_hach`, `under_hach_review`, `approved_by_hach`, `rejected_by_hach`. No code path in the Stanton flow sets it. The HACH queue filters on this column, which means today applications appear in HACH's queue either by manual DB intervention or seed data. There is no button, no confirmation, no audit of who routed the packet or when, and no preconditions enforced.

3. **No canonical event timeline.** `pbv_access_log` records security/access events (HHA generation, exports, SSN reveals) but is not a workflow timeline. Reviewer dashboards, manager rollups, packet history views, and a future "what happened with this app this week" surface all need an authoritative events feed. None exists.

This PRD addresses all three. It also adds re-categorization for misfiled documents (fat-finger fix) and document versioning that preserves prior versions (because users who are bad with computers often re-upload, and we should never lose data). After this PRD, the workspace pane lives up to the name: documents arrive (by any path), get reviewed, and get routed to HACH as a tracked, role-gated, lockable event.

---

## Goals

1. **Staff document upload** on behalf of tenants or HACH, with provenance attribution (uploader, source, optional note) and the same review lifecycle as tenant uploads.
2. **Document versioning** that preserves prior revisions — never delete, even when a newer file is uploaded.
3. **Document re-categorization** for misfiled docs. If the target slot already has an active doc, both stay; resolution is per-row.
4. **Send-to-HACH** as an explicit, role-gated action with a pre-flight gate, override path, and confirmation modal showing packet contents.
5. **Hard lock** on the packet after submit — Stanton cannot modify docs or statuses until the packet is explicitly reopened.
6. **HACH packet revision visibility** — when Stanton re-submits after a reopen, HACH sees a small badge noting the revision.
7. **`application_events` table** as the canonical workflow timeline. Every action of consequence writes here. Downstream PRDs (assignment, dashboards, execution) read from this.

---

## Users & Roles

| Role | Upload | Re-categorize | Approve / Reject / Waive | Send-to-HACH | Reopen Packet |
|---|---|---|---|---|---|
| Any Stanton admin user | Yes | Yes | Yes (existing) | — | — |
| Stanton role with `pbv-full-applications:send_to_hach` permission (Tess, management) | Yes | Yes | Yes | Yes | Yes |
| HACH reviewer / admin | — | — | — | — | — |
| Tenant | Via portal only | — | — | — | — |

Permission `pbv-full-applications:send_to_hach` is new. Assignment to specific users is a DB-side configuration step at deploy time (existing pattern, same as `pbv-full-applications:read_ssn`).

---

## Core Features

### 1. Staff document upload

Each document row in `StantonReviewSurface` gets an **Upload** button alongside the existing View / Approve / Reject / Waive controls. Click opens a modal:

- File picker (multi-file disallowed in v1 — one upload per click)
- **Source** dropdown (required): `In Person`, `Email`, `Phone / Text`, `Mail / Fax`, `From HACH`, `Prior File`, `Other`
- **Note** textarea (optional, free text — e.g., "tenant brought in person 5/13; original on file")
- Category is pre-filled from the row context. A category picker is exposed for users who land in the modal via a generic "Upload document" button (not v1).

On submit:
- File uploaded to the `form-submissions` storage bucket, same path convention as tenant uploads.
- A new `form_submission_documents` row is created (or a new revision of an existing row — see §2).
- `uploaded_by_user_id`, `uploader_role = 'staff'`, `upload_source`, `upload_note` populated.
- `application_events` row written with `event_type = 'doc_uploaded'`.
- Status follows the same lifecycle as a tenant upload — defaults to `'submitted'`, awaiting review. A staff upload is *not* auto-approved. The uploader and the reviewer must be different people, or at minimum the same person performing two distinct actions, for the audit to remain meaningful.

### 2. Document versioning

The `form_submission_documents` table already has a `revision` column. This PRD formalizes the behavior:

- Each upload to a logical slot — defined as `(form_submission_id, doc_type, person_slot)` — creates a new row with `revision = max(prior) + 1`.
- The **active version** is the highest `revision` for that slot.
- Prior revisions are preserved forever. No `DELETE`. No overwrite of `storage_path`.
- A `doc_superseded` event is written when a new revision lands, identifying the prior revision.
- UI: the document row shows the active version. A "Show prior versions (N)" expander reveals older revisions inline, each with its file name, upload date, uploader, and the action taken on it (e.g., "Rejected — illegible — by James on 5/10").

### 3. Re-categorize

A new row action — "Move to category…" — opens a small picker letting the user pick a different `doc_type` and/or `person_slot`. On submit:

- The document row's `doc_type` and `person_slot` columns are updated.
- A `doc_recategorized` event is written with both the old and new categorization in `metadata`.
- If the target slot already contains active docs, both remain. The UI in the target slot shows them as siblings under the same slot label. Each is independently approve-able / reject-able / waive-able. The slot is considered "fulfilled" if at least one of its active docs is approved or waived.

This preserves the "never delete" rule even in the conflict case.

### 4. Tenant portal visibility

The tenant magic link at `/pbv-full-app/[token]` shows all documents in the tenant's file, including staff- and HACH-uploaded ones. Documents not uploaded by the tenant carry a label:

- `uploader_role = 'staff'` → "Uploaded by Stanton on your behalf"
- `uploader_role = 'hach'` → "Provided by HACH"

Slots that contain a staff- or HACH-uploaded doc show as "Received" in the tenant's view. The tenant is not prompted to re-upload. If the tenant *does* upload a fresh version later, it lands as a higher revision (existing versioning rule applies) and goes to Stanton's review queue.

### 5. Send-to-HACH action

A new **Send to HACH** button is added to the Actions section of `app/admin/pbv/full-applications/[id]/page.tsx`, alongside the existing Generate HHA Application and Download HACH Package buttons.

**Visibility:** the button is rendered only for users who hold `pbv-full-applications:send_to_hach`. For users without the permission, the button is hidden and a small note reads "Send to HACH requires elevated permissions — contact a reviewer."

**Pre-flight gate (soft):**
- All `required` documents have status `approved` or `waived`.
- `stanton_review_status = 'approved'`.
- `hha_application_file` is non-null (HHA has been generated).
- **If the application has an Application Lead** (see PRD II — `per-document-assignment_prd_2026-05-13.md`), every tier-1-reviewed document (`status IN approved/rejected/waived`) must have `owner_review_status = 'confirmed'`. Apps without a Lead skip this check.

If any precondition fails, the button is still clickable, but the confirmation modal opens in **override mode** showing each failed check with a checkbox the user must tick to acknowledge, plus a required **Override reason** text field. Overrides write `override_reason` and `override_failed_checks` into the `submitted_to_hach` event metadata.

**Confirmation modal** shows:
- Applicant name + unit
- Count of documents in the packet by status (approved / waived / submitted-but-unreviewed if any — these are flagged)
- Total household income (claimed vs. documented)
- HHA filename if present
- Date and reviewer name from the most recent Stanton review
- Override checklist if applicable
- Two buttons: **Cancel** and **Confirm — Send to HACH**

**On confirm:**
- `submitted_to_hach_at = NOW()`
- `submitted_to_hach_by = current user`
- `hach_packet_revision = hach_packet_revision + 1` (starts at 0; first submit takes it to 1)
- `packet_locked = TRUE`
- `hach_review_status = 'pending_hach'`
- `application_events` row written: `event_type = 'submitted_to_hach'` (or `'hach_packet_revised'` if revision > 1), with the override info in metadata if applicable.
- A `shared_workspace_messages` system-authored entry is posted to the workspace channel: "Stanton submitted this packet to HACH on [date]. Revision N." This makes the handoff visible inside the workspace conversation, not just in the audit log.

### 6. Packet lock and reopen

After Send-to-HACH:
- `packet_locked = TRUE`
- All Stanton write actions on docs and review state are blocked at the API layer:
  - Document upload (staff)
  - Approve / Reject / Waive
  - Re-categorize
  - Mutations to `stanton_review_status` and income editor
  - Generate HHA (the packet HHA is now locked)
- All read actions remain permitted. Workspace messaging (both Stanton-private and Shared with HACH channels) remains permitted — that's how the parties talk during HACH review.

To modify after submit, the user must explicitly **Reopen Packet** (same permission as Send-to-HACH).

**Reopen confirmation modal:**
- Warning text: "Reopening pauses HACH review and requires re-submission. HACH will see this packet as reopened by Stanton until you re-submit."
- Required **Reason** text field.
- Buttons: Cancel / Confirm Reopen.

**On confirm:**
- `packet_locked = FALSE`
- `hach_review_status` is set to `NULL` (so it leaves HACH's active queue and reappears only after re-submission).
- `submitted_to_hach_at`, `submitted_to_hach_by`, and `hach_packet_revision` are **not** reset — they preserve the most recent submission's metadata. The event history is authoritative for full timeline reconstruction.
- `application_events` row written: `event_type = 'packet_reopened'`, with `reason` in metadata.
- A `shared_workspace_messages` system-authored entry is posted: "Stanton reopened this packet on [date]. Reason: [reason]."

Re-submission after reopen runs the same Send-to-HACH flow, incrementing `hach_packet_revision`.

### 7. `application_events` — the substrate

A new table that becomes the canonical workflow timeline.

Event types emitted in this PRD:
- `doc_uploaded` — metadata: `uploader_role`, `upload_source`, `revision`
- `doc_approved`, `doc_rejected`, `doc_waived` — existing actions, now also write here (in addition to the existing `document_review_actions` table, which remains as the per-action detail record)
- `doc_recategorized` — metadata: `from_doc_type`, `from_person_slot`, `to_doc_type`, `to_person_slot`
- `doc_superseded` — metadata: `superseded_by_revision`
- `submitted_to_hach` — metadata: `hach_packet_revision`, `override_reason?`, `override_failed_checks?`
- `hach_packet_revised` — same metadata, emitted for revisions ≥ 2
- `packet_reopened` — metadata: `reason`

Forward-compatibility: future PRDs add their own event types (`doc_assigned`, `hach_approved`, `lease_signed`, `hap_executed`, etc.) without schema migration.

`pbv_access_log` stays as the narrower security/access audit (HHA generation, exports, SSN reveals). It is not deprecated. The two tables serve different questions and should not be merged.

---

## Data Model

### Migration: `20260513XXXXXX_document_lifecycle.sql`

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. form_submission_documents — provenance fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.form_submission_documents
  ADD COLUMN IF NOT EXISTS uploaded_by_user_id UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploader_role TEXT NOT NULL DEFAULT 'tenant'
    CHECK (uploader_role IN ('tenant', 'staff', 'hach')),
  ADD COLUMN IF NOT EXISTS upload_source TEXT
    CHECK (
      upload_source IS NULL
      OR upload_source IN (
        'portal', 'in_person', 'email', 'phone_text',
        'mail_fax', 'from_hach', 'prior_file', 'other'
      )
    ),
  ADD COLUMN IF NOT EXISTS upload_note TEXT;

-- Existing tenant rows: backfill upload_source = 'portal' where uploader_role = 'tenant'
UPDATE public.form_submission_documents
   SET upload_source = 'portal'
 WHERE uploader_role = 'tenant'
   AND upload_source IS NULL
   AND storage_path IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsd_uploader
  ON public.form_submission_documents (uploaded_by_user_id, created_at DESC)
  WHERE uploaded_by_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fsd_uploader_role
  ON public.form_submission_documents (uploader_role);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. pbv_full_applications — handoff audit columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.pbv_full_applications
  ADD COLUMN IF NOT EXISTS submitted_to_hach_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS submitted_to_hach_by UUID
    REFERENCES public.admin_users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hach_packet_revision INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packet_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pbv_full_apps_submitted_to_hach
  ON public.pbv_full_applications (submitted_to_hach_at DESC NULLS LAST);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. application_events — canonical workflow timeline
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.application_events (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id    UUID        NOT NULL REFERENCES public.pbv_full_applications(id) ON DELETE CASCADE,
  event_type        TEXT        NOT NULL,
  actor_user_id     UUID        REFERENCES public.admin_users(id) ON DELETE SET NULL,
  actor_display     TEXT,
  actor_role        TEXT        CHECK (actor_role IN ('tenant', 'stanton', 'hach', 'system')),
  document_id       UUID        REFERENCES public.form_submission_documents(id) ON DELETE SET NULL,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_application_events_app
  ON public.application_events (application_id, created_at DESC);

CREATE INDEX idx_application_events_type
  ON public.application_events (event_type, created_at DESC);

CREATE INDEX idx_application_events_doc
  ON public.application_events (document_id, created_at DESC)
  WHERE document_id IS NOT NULL;

CREATE INDEX idx_application_events_actor
  ON public.application_events (actor_user_id, created_at DESC)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE public.application_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role full access on application_events"
  ON public.application_events
  FOR ALL TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. permission seed
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.permissions (resource, action)
VALUES ('pbv-full-applications', 'send_to_hach')
ON CONFLICT DO NOTHING;
```

Role assignment (`pbv-full-applications:send_to_hach`) is configured per-deployment in the DB; the migration does not assign it to any role automatically.

---

## API Routes

### NEW — Document operations

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/submissions/[submissionId]/documents/upload` | POST | `isAuthenticated` | Multipart form upload by staff. Body: `file`, `doc_type`, `person_slot`, `source`, `note?`. Creates a new `form_submission_documents` row with `uploader_role='staff'`, increments revision if slot already has docs. Writes `doc_uploaded` event. Blocked if `packet_locked = TRUE`. |
| `/api/admin/submissions/[submissionId]/documents/[documentId]/categorize` | PATCH | `isAuthenticated` | Body: `{ doc_type, person_slot }`. Mutates the doc row. Writes `doc_recategorized` event. Blocked if `packet_locked = TRUE`. |

### NEW — Handoff operations

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/admin/pbv/full-applications/[id]/send-to-hach` | POST | `isAuthenticated` + `pbv-full-applications:send_to_hach` | Body: `{ override_reason?, override_failed_checks? }`. Runs pre-flight, sets handoff columns, increments revision, locks packet, flips `hach_review_status`, writes `submitted_to_hach` event, posts shared workspace message. |
| `/api/admin/pbv/full-applications/[id]/reopen` | POST | same | Body: `{ reason }`. Sets `packet_locked=FALSE`, `hach_review_status=NULL`, writes `packet_reopened` event, posts shared workspace message. |
| `/api/admin/pbv/full-applications/[id]/preflight` | GET | `isAuthenticated` | Returns the pre-flight check state for the confirmation modal. Body: `{ checks: [{ name, passed, detail }], packet_summary: { doc_counts, hha_present, income_total } }`. |

### MODIFIED — Existing per-doc review endpoints

`approve`, `reject`, `waive` endpoints (under `/api/admin/submissions/...`) gain:
- A check on `packet_locked` for the parent application; reject with 423 Locked if true.
- A write to `application_events` alongside the existing `document_review_actions` insert.

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `form_submission_documents` | Read/Write | All document state |
| `pbv_full_applications` | Read/Write | Handoff columns, packet lock |
| `application_events` | Write | All events emitted in this PRD |
| `pbv_access_log` | Write | Unchanged — security/access events continue here |
| `shared_workspace_messages` | Write | System-authored handoff messages (`author_user_id = NULL`, `author_display = 'System'`, `author_party_org = 'stanton'`) |
| `lib/auth` | Read | New permission check `pbv-full-applications:send_to_hach` |
| `lib/hach/payload-filter` | — | HACH responses on the HACH portal include new revision badge; confirm `hach_packet_revision` is in the allowlist |

---

## Files Touched (Inferred — Cascade Confirms)

**NEW:**
- `supabase/migrations/20260513XXXXXX_document_lifecycle.sql`
- `app/api/admin/submissions/[submissionId]/documents/upload/route.ts`
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/categorize/route.ts`
- `app/api/admin/pbv/full-applications/[id]/send-to-hach/route.ts`
- `app/api/admin/pbv/full-applications/[id]/reopen/route.ts`
- `app/api/admin/pbv/full-applications/[id]/preflight/route.ts`
- `lib/events/application-events.ts` — typed helpers for writing events
- `components/review/UploadDialog.tsx` — staff upload modal
- `components/review/RecategorizeDialog.tsx` — category picker modal
- `components/review/SendToHachDialog.tsx` — confirmation modal
- `components/review/ReopenPacketDialog.tsx` — reopen confirmation
- `components/review/PriorVersionsExpander.tsx` — "Show prior versions" UI
- `components/review/PacketLockBanner.tsx` — top-of-page lock indicator
- `__tests__/document-lifecycle.test.ts` — staff upload, re-categorize, version preservation, lock enforcement
- `__tests__/send-to-hach.test.ts` — permission, pre-flight, override, reopen, revision increment

**MODIFIED:**
- `app/admin/pbv/full-applications/[id]/page.tsx` — adds Send-to-HACH and Reopen buttons, lock banner, override modal wiring
- `components/review/StantonReviewSurface.tsx` — adds per-row Upload and Re-categorize buttons, prior-versions expander, lock-aware disabled states
- `components/review/DocumentRow.tsx` — provenance badge ("Maria K. · In Person · 5/13"), prior-versions count badge
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/approve/route.ts` — lock check, events write
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/reject/route.ts` — lock check, events write
- `app/api/admin/submissions/[submissionId]/documents/[documentId]/waive/route.ts` — lock check, events write
- `app/api/admin/pbv/full-applications/[id]/hha/route.ts` — lock check
- `app/pbv-full-app/[token]/...` (tenant portal) — display provenance labels, suppress upload prompts on slots with non-tenant docs
- `app/api/hach/applications/[id]/route.ts` — surface `hach_packet_revision` to HACH UI
- `app/api/hach/applications/route.ts` — same
- `components/review/HachReviewSurface.tsx` — small "Revision N" badge near header
- `lib/hach/payload-filter.ts` — add `hach_packet_revision` and `submitted_to_hach_at` to the HACH-visible allowlist (the rest of the new columns stay Stanton-private)

---

## Implementation Phases

### Phase 1 — Documents

Concrete deliverables:
- Migration (provenance fields + `application_events` table + permission seed; **omits** the handoff columns and `packet_locked` — those land in Phase 2 to keep the migration small and reversible).
- Staff upload API + UI.
- Re-categorize API + UI.
- Prior-versions expander in the review surface.
- Provenance badge on each document row.
- Tenant-portal labels for non-tenant-uploaded docs and "Received" slot state.
- Event writes on upload, approve, reject, waive, recategorize, supersede.

Phase 1 is independently useful and shippable. After Phase 1 lands:
- PMs can upload on behalf of tenants.
- The `application_events` feed starts populating, giving Phase 2 and the downstream PRDs a working substrate.
- Send-to-HACH still doesn't exist; HACH's queue behavior is unchanged from today.

### Phase 2 — Handoff

Concrete deliverables:
- Migration adding the handoff columns and `packet_locked` to `pbv_full_applications`.
- Send-to-HACH API + button + confirmation modal + override path.
- Reopen API + button + confirmation modal.
- Pre-flight API.
- Lock banner at the top of the application page when `packet_locked = TRUE`.
- Lock enforcement on every Stanton write path (uploads, approve/reject/waive, categorize, HHA gen, stanton_review_status PATCH).
- System-authored shared workspace messages on submit and reopen.
- HACH UI revision badge.
- `pbv-full-applications:send_to_hach` permission wired into the route + button visibility.

Phase 2 is meaningless without Phase 1's substrate (the events feed, the provenance model).

---

## Out of Scope

- Per-document reviewer assignment (next PRD: `per-document-assignment`).
- Workforce dashboards — "My Work" / "Team Rollup" (PRD after that).
- Post-approval signing flow — lease, HAP contract, addenda execution (final PRD).
- E-sign integration of any kind.
- HACH-direct upload portal (HACH continues to route documents through Stanton staff for v1).
- Real-time notifications (SMS / email) on handoff or reopen — Phase 2 of dashboards.
- Diff / "what changed" view between packet revisions — Phase 3.
- Bulk re-categorize (move several docs in one operation).
- Tenant-side ability to see prior versions of their own uploads (the prior-versions expander is Stanton-only in v1; tenants see only the active version of each slot).

---

## Risks and Edge Cases

| Risk | Mitigation |
|---|---|
| Staff uploads from a session whose `admin_users` row is later deleted | `uploaded_by_user_id` FK uses `ON DELETE SET NULL`. `uploader_role` and provenance survive. The display badge falls back to "Unknown staff." |
| Two staff click Send-to-HACH simultaneously | Send-to-HACH endpoint takes a row-level lock on the application; second request reads the now-locked state and returns 409. |
| Tenant uploads to a slot during the lock window | Tenant portal upload routes also check `packet_locked`; if locked, the upload is rejected and the tenant is shown "This packet is currently in HACH review. If you have a new document, contact the Stanton office." |
| Override used as the default path | Override fields (`override_reason`, `override_failed_checks`) are stored on the event. Dashboards (downstream PRD) can flag applications submitted via override for management review. |
| `packet_locked = TRUE` but `hach_review_status = NULL` (mid-reopen-pre-resubmit state) | Reopen sets `hach_review_status = NULL` *and* `packet_locked = FALSE` atomically. The race window is the duration of the transaction, which is acceptable. |
| Event-writing helper called outside a transaction with the state change | All event writes happen in the same transaction as the state mutation. Helpers in `lib/events/application-events.ts` require an active transaction parameter. |
| Re-categorize creates orphaned slot state (e.g., moving the only doc out of a required slot) | The slot's `required` flag is computed at intake time and doesn't move with a doc. The newly-empty slot reappears in the "missing" state on the review surface. Stanton can chase the tenant or upload from staff side. |
| Versioning index growth | Indexes on `application_events` are by `application_id`, which scopes growth per application. Across many applications the table grows linearly; partitioning is out of scope for v1 (postmortem trigger: if event volume exceeds ~5M rows, partition by created_at month). |
| `application_events` writes silently fail | All event writes are within the same transaction as the state change. If the event insert fails, the entire mutation rolls back. No "ghost actions" with no audit trail. |
| HACH sees revision badge but doesn't understand it | Small badge with hover tooltip: "Stanton has submitted this packet N times. The current version was submitted on [date]." |

---

## Open Questions

| Question | Owner | Default for v1 |
|---|---|---|
| 1. Should the "From HACH" upload source require explicit attribution to a specific HACH person (free text)? | Alex | No — the `upload_note` field handles this. Phase 2 of HACH integration could add a structured "from_hach_user" field. |
| 2. Should the lock also prevent workspace messaging in the Stanton-private channel? | Alex | No — Stanton-private is for internal deliberation and should remain open even during HACH review. |
| 3. Should the system post the workspace message on submit using a real system user (with `actor_user_id = NULL`) or attributed to the submitter? | Alex | System user (`NULL`, display "System"). The event row carries the submitter's identity; the workspace message is the institutional record. |
| 4. After reopen, should the existing approvals on documents auto-revert to "submitted"? | Alex | No — approvals stand. Reopen exists so Stanton can add or modify specific items, not to redo the whole packet. If a doc needs to be re-reviewed, the user explicitly unsets it (existing per-doc reject flow). |
| 5. Should `application_events` be partitioned by month from day one? | Alex | No — single table. Partitioning is a future operation if volume warrants. |

---

## Acceptance Criteria

**Phase 1:**
- [ ] Migration applies cleanly; `form_submission_documents` has provenance fields; `application_events` exists with indexes and RLS.
- [ ] Tenant uploads continue to work; new rows have `uploader_role='tenant'`, `upload_source='portal'`.
- [ ] Staff can upload via the per-row Upload button; resulting row has correct provenance, increments revision if slot is non-empty, writes a `doc_uploaded` event.
- [ ] Re-categorize moves a doc to a new slot; both originals remain in target slot if conflict; `doc_recategorized` event written.
- [ ] Prior versions are visible via expander on document rows; status of each prior revision is shown.
- [ ] No document is ever deleted by any UI action.
- [ ] Tenant portal displays provenance labels and "Received" status for non-tenant-uploaded docs.
- [ ] Approve / reject / waive write to both `document_review_actions` (existing) and `application_events` (new).
- [ ] Test suite passes including: upload preserves prior version, re-categorize doesn't delete, conflict leaves siblings, all events written.

**Phase 2:**
- [ ] Migration applies cleanly; handoff columns and `packet_locked` exist on `pbv_full_applications`; `pbv-full-applications:send_to_hach` permission exists.
- [ ] Users without the permission do not see the Send-to-HACH button.
- [ ] Pre-flight endpoint returns accurate gate state.
- [ ] Confirmation modal displays packet summary; override mode appears when pre-flight fails; override requires reason.
- [ ] Send-to-HACH sets all handoff columns atomically with the event write; flips `hach_review_status` to `pending_hach`; posts shared workspace message.
- [ ] After submit, all Stanton write actions on the packet return 423 Locked. Reads succeed.
- [ ] Reopen sets `packet_locked=FALSE`, `hach_review_status=NULL`; writes event; posts workspace message; preserves submitted-to-hach audit columns.
- [ ] Re-submission after reopen increments `hach_packet_revision`.
- [ ] HACH UI displays the revision badge.
- [ ] Test suite passes including: permission enforcement, lock enforcement on each write path, override capture, revision increment, race-condition handling on concurrent submits.

**Both phases combined:**
- [ ] No existing workflow regresses (tenant upload, magic link, intake, existing review actions all continue to function).
- [ ] `pbv_access_log` continues to record export and HHA generation events (not migrated to `application_events`).
- [ ] Manual walkthrough confirms an overworked PM can: receive a paper document, upload it on behalf of the tenant with one note, see it in review, approve it, and route the completed packet to HACH — all from one page, with one tracked event trail.
