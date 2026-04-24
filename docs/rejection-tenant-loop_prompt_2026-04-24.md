# Windsurf Prompt — Rejection-to-Tenant Notification Loop

**PRD:** `rejection-tenant-loop_prd_2026-04-24.md` (read it first)

**Required dependencies already built:** `hach-reviewer-portal` (reject dialog exists as stub that logs the rejection without notifying anyone), Twilio client configured in environment

---

## Context

The HACH reviewer portal has a working reject action — it logs the rejection with a structured reason code. But nothing happens downstream. Tenant doesn't know. Stanton doesn't know. The doc sits in rejected state and the review process stalls until someone manually emails someone.

This build closes the loop: rejection triggers an SMS to the tenant in their preferred language, tenant uses their existing magic link to re-upload, doc flips back to pending, reviewer sees it in their queue.

---

## Build this pass

Phases 1, 2, 3, and 4 from the PRD. Phases 5 (Twilio webhook for delivery status) and 6 (48-hour SLA nudges) are the next pass — they require the Twilio bulk-send infrastructure to be fully live first.

### Specific scope

1. **Migration** for `rejection_reason_templates` and `tenant_notifications` tables per PRD schema. Seed `rejection_reason_templates` with the 7 initial reasons × 3 languages (EN/ES/PT) from the PRD.

2. **Template helper** at `lib/rejection-templates.ts`:
   ```ts
   export async function renderTemplate(
     code: string,
     lang: 'en' | 'es' | 'pt',
     vars: { tenant: string; doc: string; doc_short: string; custom?: string }
   ): Promise<string>
   ```
   - Fetches template from DB (cache for 60s)
   - Interpolates `{tenant}`, `{doc}`, `{doc_short}`, `{custom}` placeholders
   - Strips any unused placeholders gracefully

3. **Notification send** at `lib/notifications.ts`:
   ```ts
   export async function sendTenantRejectionNotice(params: {
     documentId: string;
     reasonCode: string;
     customText?: string;
     triggeredBy: string; // reviewer user id
   }): Promise<{ notificationId: string; channel: 'sms' | 'email'; status: string }>
   ```
   - Looks up application, tenant name, phone, email, preferred language from `pbv_full_applications` + linked profile
   - Looks up document label from `form_submission_documents`
   - Renders template
   - Sends via Twilio SMS primarily; falls back to Resend email if no phone or SMS fails synchronously
   - Inserts `tenant_notifications` row
   - Returns result for UI display

4. **Extend reject dialog** in HACH reviewer portal:
   - Add live SMS preview panel in dialog body
   - Preview shows the exact interpolated text the tenant will receive, labeled with the tenant's language (e.g., "Tenant will receive (SMS, Spanish):")
   - Preview updates reactively as the reviewer types custom text (for `other` reason)
   - On submit, show toast with actual channel used: "✗ Rejected · Tenant notified via SMS" or "✗ Rejected · SMS failed, email sent"

5. **Extend reject API handler** at `/api/hach/documents/[id]/reject`:
   - After logging rejection, call `sendTenantRejectionNotice()`
   - Link `document_review_actions.notification_id` to the created notification row
   - Return notification result in response so UI can show the right toast

6. **Admin UI for rejection templates** at `/admin/settings/rejection-templates`:
   - List all 7 reasons with their three language templates
   - Edit inline (save per reason)
   - Preview with sample data (tenant="Maria", doc="Paystubs (4 weekly)", custom="sample")
   - Permission-gated to super admin

7. **Magic link page enhancement** at `/t/[token]/page.tsx` (or wherever the existing tenant portal lives):
   - At the top of the tenant's task list, render a "Documents to resubmit" section if any linked docs are in `rejected` status
   - Show the rejection reason inline in the tenant's language (pulled from the template for display consistency)
   - "Upload new version" button → uploads as a new version of the document (increments version number, does not create new doc)
   - On upload success, doc status flips to `pending`, section disappears (or moves to "✓ Resubmitted — awaiting review")

---

## Tech constraints

- Twilio Node SDK (assume already installed and configured with env vars `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
- Resend for email fallback (already in project)
- Server actions for the notification send (must not block UI — but wait for synchronous Twilio response to know if fallback is needed)
- TypeScript strict
- Interpolation must handle missing variables gracefully (no `undefined` appearing in a tenant SMS)

---

## Acceptance criteria

- [ ] Migration runs, `rejection_reason_templates` has 7 rows × 3 languages
- [ ] In the reject dialog, changing the reason dropdown updates the preview text live
- [ ] Typing in the custom text field for `other` reason updates the preview live
- [ ] Preview shows correct tenant name pulled from the application
- [ ] Preview shows the language label matching the tenant's `preferred_language`
- [ ] Submitting rejection with a real Twilio account sends an actual SMS to a test phone number
- [ ] `tenant_notifications` row is created with provider_message_id populated
- [ ] `document_review_actions.notification_id` is populated and links back
- [ ] If the application has no phone on file, falls back to email via Resend and the UI toast reflects this
- [ ] Template admin UI allows editing a template, saving, and the change is reflected in the next rejection
- [ ] On the `/t/[token]` page, a rejected document shows in a highlighted "Documents to resubmit" section with the rejection reason in the tenant's language
- [ ] Uploading a new version via the tenant portal flips the doc back to `pending` and it reappears in the HACH reviewer's queue

---

## Do NOT in this pass

- Build the Twilio webhook handler for delivery status (Phase 5 — needs full Twilio infra)
- Build the 48-hour SLA cron (Phase 6 — depends on `stanton-pipeline-dashboard`)
- Send approval notifications when a resubmission is approved (open question in PRD, not yet decided)
- Build two-way SMS (tenant replying)
- Build bulk rejection across multiple docs — one rejection = one SMS
