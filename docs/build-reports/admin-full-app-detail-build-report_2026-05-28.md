# Build Report — Admin Full-Application Detail (Messaging + Form Preview)

**Date:** 2026-05-28
**Status:** Awaiting verification (`npm run build` and smoke test still pending)
**Build:** [Unverified] — not yet run from PowerShell on Windows. Cannot run from the Linux session sandbox (no `node_modules` in mount).
**Workstream:** Parallel to the PBV form-execution sprint (PRD-22→32). Code is uncommitted; keep these commits separate from the PRD-31 hotfix history.

---

## Goal

Make the admin PBV full-application detail page a comprehensive substitute for an in-person meeting: intake responses, uploaded documents/forms, signatures, and two-way SMS communication all in one place.

---

## What Shipped

| Stream | What | Primary Files |
|---|---|---|
| **1. Migration drift fix** | Re-applied missing migrations: `pbv_preflight_checklist` template, `docs_upload_reminder_v2`, `get_tenant_notifications` function. | `supabase/migrations/2025…` (pre-existing, applied manually) |
| **2. Admin form preview** | New admin endpoint streams unsigned/signed form PDFs; admin page UI block lists generated forms with preview links. | `app/api/admin/pbv/full-applications/[id]/forms/[form_document_id]/preview/route.ts`, `app/admin/pbv/full-applications/[id]/page.tsx` |
| **3a. Messages table** | New `pbv_application_messages` table with service-role-only RLS + `updated_at` trigger. | `supabase/migrations/20260528000000_pbv_application_messages.sql` |
| **3b. Staff SMS template** | Seeded `staff_message` passthrough template in EN/ES/PT. | `supabase/migrations/20260528000100_staff_message_template.sql` |
| **3c. Messages API** | `GET/POST` on `/api/admin/pbv/full-applications/[id]/messages`. GET returns thread; POST sends SMS via Twilio and logs an outbound message. | `app/api/admin/pbv/full-applications/[id]/messages/route.ts` |
| **3d. Inbound webhook** | Twilio inbound webhook resolves sender phone → PBV application and logs tenant replies as **inbound** messages in the thread. Falls back to `tenant_inbound_messages` on phone-lookup miss. | `app/api/webhooks/twilio/inbound/route.ts` |
| **3e. Request changes** | Bulk reject endpoint logs an outbound system message into the thread. `BulkActionBar` has a **Request changes…** dialog; single-document reject also logs to the thread. | `components/review/BulkActionBar.tsx`, `components/review/StantonReviewSurface.tsx`, `app/api/admin/applications/[anchor_type]/[anchor_id]/documents/bulk-reject/route.ts` |
| **3f. Messages UI** | New hook + panel: `useApplicationMessages` (polls every 15s) and `ApplicantMessagesPanel` (chat-style UI, composer, opt-out banner). | `lib/pbv/hooks/useApplicationMessages.ts`, `components/admin/ApplicantMessagesPanel.tsx` |
| **3g. Page wire-up** | `ApplicantMessagesPanel` imported and rendered on the detail page, immediately after the SMS Notifications section (line 735). | `app/admin/pbv/full-applications/[id]/page.tsx` |

---

## Architecture Decisions

- **Messages table is service-role-only RLS.** Browser Supabase client cannot read it. The UI fetches through the admin REST endpoint (`/api/admin/pbv/full-applications/[id]/messages`) with 15-second polling instead of realtime subscriptions. Tradeoff: simpler RLS + auth; up to 15s latency on new inbound replies.
- **Inbound SMS replies link to applications by phone-number lookup** on `pbv_full_applications` (lead member). Unknown numbers fall through to the existing `tenant_inbound_messages` path.
- **"Request changes"** is a bulk reject with `send_notification: true`. The rejection reason becomes the staff note in the SMS and is logged as a system-authored message in the thread. One UX surface, two backend effects.
- **Form preview** mirrors the tenant preview route but uses admin session auth instead of a tenant token.
- **Panel placement** — the original handoff said "right-hand column," but the page is a single `max-w-5xl mx-auto space-y-6` stack. Panel placed as its own `<section>` directly below the SMS Notifications section so it sits adjacent to `NotificationTimeline`. Revisit if you want a true two-column layout.

---

## Files Changed

```
components/review/BulkActionBar.tsx
components/review/StantonReviewSurface.tsx
components/admin/ApplicantMessagesPanel.tsx          (new)
lib/pbv/hooks/useApplicationMessages.ts              (new)
lib/notifications/types.ts
app/api/admin/pbv/full-applications/[id]/route.ts
app/api/admin/pbv/full-applications/[id]/forms/[form_document_id]/preview/route.ts   (new)
app/api/admin/pbv/full-applications/[id]/messages/route.ts                            (new)
app/api/admin/applications/[anchor_type]/[anchor_id]/documents/bulk-reject/route.ts
app/api/webhooks/twilio/inbound/route.ts
app/admin/pbv/full-applications/[id]/page.tsx
supabase/migrations/20260528000000_pbv_application_messages.sql   (new)
supabase/migrations/20260528000100_staff_message_template.sql     (new)
```

---

## Verification

### Build

- [ ] `npm run build` from PowerShell on Windows — exit code 0
- Known IDE noise to ignore (per handoff): `Cannot find module 'react'`, `JSX element implicitly has type 'any'`. These are ambient TS declaration issues in the IDE's TS server, not real build errors.
- Pre-existing `unknown` typing in `StantonReviewSurface.tsx:288` (`handleBulkAssign` / `Array.from(selectedDocIds)`) is not caused by these changes.

### Migrations

- [ ] `npx supabase migration list --project-ref lieeeqqvshobnqofcdac` shows `20260528000000_pbv_application_messages` and `20260528000100_staff_message_template` as applied.

### End-to-end smoke test

| Step | Expected |
|---|---|
| Open an admin PBV full-application detail page | Page loads with summary, tenant responses, generated forms, documents, Stanton review, actions, household members, SMS notifications, **Messages** |
| Generated Forms block → click **Preview filled** / **Preview signed** | PDF opens in a new tab |
| Documents tab → select 1+ docs → **Request changes** → type note → submit | Docs reject, toast appears, system message with the note appears in the Messages panel |
| Messages composer → type a free-form message → **Send SMS** | Outbound message appears in the panel with "Sent" status; SMS arrives on the tenant phone |
| Tenant replies via SMS from the phone on file | Inbound message appears in the panel within ~15 seconds |

---

## Known Issues / Environment Notes

- **`.git/config` is corrupted** in the working copy — file is truncated at line 17 (`[l`). `git log` and most git commands error with `bad config line 18`. Repair before committing this work. [Inference] One line was cut off; a backup or a fresh clone will show what's missing.
- **IDE lint noise** in the editor (hundreds of `Cannot find module 'react'` / implicit-any JSX errors) is an ambient type-declaration issue, not a real build failure. Do not chase.
- **PBV form-execution stream (PRD-22→32) work is also uncommitted.** Two streams in the working tree at the same time — commit this stream as its own atomic series so the histories stay separable.

---

## Follow-ups

- [ ] Decide whether the panel needs a two-column layout (handoff's original wording) or whether the single-column placement is fine.
- [ ] Consider Supabase Realtime instead of 15s polling once the surface is validated. Tradeoff: more moving parts, harder RLS story. Defer until polling proves insufficient.
- [ ] Backfill: thread items for previously-rejected docs are not in `pbv_application_messages` because the table is new. Decide whether to one-shot backfill from `application_documents.rejection_reason` history or leave the thread starting from 2026-05-28.
- [ ] Document the inbound-phone-lookup edge cases (shared phone numbers, lead member with no phone on file, ported numbers) in a short note in `docs/`.
