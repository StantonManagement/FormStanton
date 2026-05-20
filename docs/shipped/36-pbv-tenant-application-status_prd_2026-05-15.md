# PRD-36 — Tenant-Facing Application Status

**Date:** 2026-05-15
**Author:** Claude (audit follow-up)
**Branch:** `feat/pbv-tenant-application-status-36`
**Status:** Shipped 2026-05-16. All decisions in the "Decisions resolved" section ratified. Re-apply-after-denied deferred as separate PRD.
**Depends on:** PRD-33 (bug fixes), PRD-34 (snapshot pattern) — both should land first

---

## Problem Statement

After a tenant submits their PBV application, the dashboard at `/pbv-full-app/[token]/dashboard` shows four task cards (summary signed, forms signed, documents uploaded, additional signers). When all four are complete and the tenant hits "Submit my application," they get success feedback once — and then any subsequent visit to the link shows the same dashboard with everything checked off, with no indication of:

- Whether the office has received the submission
- Whether the office is reviewing it
- Whether action is needed from the tenant (rejected document, missing field, etc.)
- What the next step is and roughly when to expect it
- Who to contact

Today the tenant is left in the dark between submission and final approval/denial. For a population that often has limited bandwidth, irregular office hours, and high anxiety about housing, this is a gap.

---

## Users & Roles

- **Tenant** — primary user. Wants reassurance and actionable next steps post-submission.
- **Office staff** — does not need a new tool, but their status updates (in normalized tables / case management) should drive what the tenant sees.
- **Property manager** — same.

---

## Closed decisions

- **No new staff UI in this PRD.** Status comes from existing fields in the data model (`pbv_full_applications.intake_status`, `application_documents.status`, `signing_status`, plus a new `application_review_status` field). If staff need a new "set status" UI, that's a separate PRD.
- **No notifications in this PRD.** Email/SMS notifications are PRD-05 (`05-pbv-04-tenant-notifications-prd_2026-05-14.md`). This PRD is in-app status only.
- **Read-only.** The tenant cannot take action on this status page (other than the existing "fix this rejected document" flow, which is unchanged).

---

## Decisions resolved (Alex confirmed 2026-05-15)

- **Status taxonomy**: confirmed as listed below.
  - `submitted` — application sent, office has not started review
  - `under_review` — office is reviewing
  - `action_required` — at least one document rejected, or info missing
  - `approved` — office approved, awaiting next step (lease signing, move-in)
  - `denied` — application denied with reason
  - `archived` — closed, no further action
- **`application_review_status` source**: new column on `pbv_full_applications`. Explicit > derived.
- **Action surfacing**: count of `application_documents.status = 'rejected'` drives the action-required content.
- **SLA copy**: `"Office reviews typically within 2 weeks of submission."` (en). Translate accordingly for es/pt.
- **Office contact (hardcoded V1)**: `info@stantoncap.com` / `(860) 993-3401`. Used for `denied` and `action_required` banners.
- **Banner persistence**: dashboard only.

---

## Core Features

### F1: New `application_review_status` column

- Add to `pbv_full_applications`:
  - `application_review_status TEXT NULL` (one of the taxonomy values above)
  - `application_review_status_at TIMESTAMPTZ NULL`
  - `application_review_status_note TEXT NULL` (staff-visible reason for denial, internal note)
- Default: when `intake_status = 'complete'` AND `application_review_status IS NULL`, treat as `submitted`. Backfill complete applications.

### F2: Status data flows through bootstrap

- File: `app/api/t/[token]/pbv-full-app/route.ts`
- Add `application_review_status`, `application_review_status_at`, and a count of rejected documents to the response.
- File: `lib/pbv/hooks/useDashboardState.ts` — surface these fields in `DashboardData`.

### F3: New `ApplicationStatusBanner` component

- File: `components/pbv/sign/ApplicationStatusBanner.tsx`
- Renders a status banner at the top of the dashboard when `intake_status = 'complete'` AND `application_review_status` is set.
- Per status:
  - `submitted` — green banner, "Your application has been submitted. Office reviews typically within 5 business days."
  - `under_review` — blue banner, "Your application is under review."
  - `action_required` — yellow banner, "Action needed. See below for documents that need replacement." Plus a link to the documents page filtered by rejected.
  - `approved` — green banner, "Your application is approved. The office will contact you about next steps."
  - `denied` — red banner with the reason from `application_review_status_note`. Includes office contact.
  - `archived` — grey banner.
- Translations for en, es, pt.
- Mounted in `components/pbv/sign/TenantDashboard.tsx` above the task cards.

### F4: Action-required surfacing

- When `application_review_status = 'action_required'`, the dashboard's documents card should change its label to "Replace rejected documents (N)" with a count.
- Clicking through goes to the documents page (PRD-33 F3) with a query param that scrolls to / filters rejected documents.

### F5: Office contact info

- For V1, single contact applies to all buildings: `info@stantoncap.com` / `(860) 993-3401`.
- Implement as `lib/pbv/officeContacts.ts` exporting a default contact (and a Record-by-building shape so per-building overrides can be added later without refactor).
- Surface in the banner for `denied` and `action_required` statuses.
- Future PRD: move to a `properties` table or per-building config when overrides become needed.

---

## Data Model

```sql
ALTER TABLE pbv_full_applications
  ADD COLUMN application_review_status      TEXT         NULL,
  ADD COLUMN application_review_status_at   TIMESTAMPTZ  NULL,
  ADD COLUMN application_review_status_note TEXT         NULL;

-- Backfill: every completed application starts as 'submitted'
UPDATE pbv_full_applications
   SET application_review_status = 'submitted',
       application_review_status_at = COALESCE(submitted_at, NOW())
 WHERE intake_status = 'complete'
   AND application_review_status IS NULL;
```

Status transitions are managed by office staff (existing admin UI or direct SQL for V1; a proper "set status" UI is a follow-up PRD).

---

## Integration Points

- Bootstrap GET — adds new fields
- `useDashboardState` — surfaces them
- `TenantDashboard` — mounts the banner
- `application_documents.status = 'rejected'` — drives `action_required` content
- Future: notifications (PRD-05), staff status-setting UI (new PRD)

---

## Open Questions

See "Decisions still open." Plus:
1. Should the status banner persist across navigation, or only on the dashboard? Recommendation: dashboard only. Other pages have their own context.
2. If `denied`, can the tenant re-apply? Out of scope for this PRD; product decision needed.

---

## Implementation Phases

**Phase 1 — Schema + read path (target: half day)**
- F1: column + backfill
- F2: bootstrap + hook
- Smoke test: an admin-set status appears in the bootstrap response

**Phase 2 — UI + content (target: half day)**
- F3: ApplicationStatusBanner component with all 6 status variants
- F4: documents card label / link variant
- F5: office contact hardcoded
- Translations

**Phase 3 — Polish (target: quarter day)**
- Visual QA on each status
- Mobile viewport check
- Accessibility (banner role, color contrast)

---

## Acceptance — what "done" looks like

- A submitted application shows a "submitted" banner on the dashboard with no further action.
- An admin (via SQL or future UI) can flip status to `under_review`, `action_required`, `approved`, or `denied`, and the tenant sees the change on next reload.
- `action_required` surfaces specifically which documents need replacement and links to them.
- `denied` shows the office contact info.
- All status banners render in en, es, pt.
