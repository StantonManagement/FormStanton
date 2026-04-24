# Rejection-to-Tenant Notification Loop — PRD

**Status:** Draft — ready for build
**Depends on:** `hach-reviewer-portal` (the reject action exists as a stub), Twilio integration (in progress per project knowledge)
**Blocks:** Nothing — this closes the loop but isn't a prerequisite for other features

---

## Problem Statement

Today, when HACH rejects a document, the full notification chain is: HACH emails Stanton → Stanton calls/texts tenant → tenant uploads somewhere → Stanton collects → Stanton re-packages → Stanton emails HACH → HACH reviews again. Each handoff is a point where things get lost, delayed, or fall through the cracks.

When `hach-reviewer-portal` ships, the reject button will mark a document rejected with a structured reason — but no one downstream will know. This PRD closes the loop: the moment a HACH reviewer rejects a document, the tenant gets an SMS in their preferred language telling them exactly what to fix, Stanton gets a dashboard alert, and when the tenant re-uploads via their existing magic link, the document moves right back into the reviewer's queue.

The goal: replace a multi-day email chain with a self-driving loop that completes when the document is fixed.

---

## Users & Roles

| Role | What they do in the loop |
|---|---|
| HACH Reviewer | Clicks reject, picks structured reason, submits |
| Tenant | Gets SMS, opens magic link, re-uploads the requested document |
| Stanton Staff | Sees rejection surface on their dashboard; steps in if tenant doesn't respond in 48h |

---

## Core Features

### 1. Structured rejection reason taxonomy

Controlled vocabulary with templated messaging per language. Each reason has:
- `code` — machine-readable identifier
- `label` — human-readable (shown in reviewer UI)
- `template_en`, `template_es`, `template_pt` — SMS template with `{tenant}`, `{doc}`, `{doc_short}`, `{custom}` interpolation slots

Initial vocabulary:

| Code | Label | Template (EN) |
|---|---|---|
| `stale` | Document expired or older than 60 days | Hi {tenant}, the {doc} you uploaded is older than 60 days. Please upload your most recent {doc_short}. |
| `illegible` | Illegible / blurry | Hi {tenant}, the {doc} is too blurry to read. Please re-upload a clear photo or scan. |
| `wrong_member` | Wrong household member | Hi {tenant}, the {doc} is for the wrong person. Please upload the document for the correct household member. |
| `missing_pages` | Missing pages | Hi {tenant}, the {doc} is missing pages. Please upload the complete document. |
| `wrong_doc` | Not the document requested | Hi {tenant}, this isn't the {doc} we need. Please review and upload the correct document. |
| `insufficient` | Insufficient — needs more data | Hi {tenant}, we need additional {doc_short} to complete review. Please upload more recent records. |
| `other` | Other | Hi {tenant}, please re-submit your {doc}. Reason: {custom} |

Admin UI (Stanton super admin only) allows editing templates per language without code changes.

### 2. Reject dialog enhancement

The reject dialog in `hach-reviewer-portal` already captures reason code and text. This PRD extends it:
- Displays a live SMS preview showing exactly what the tenant will receive, interpolated with their name, the specific doc label, and the language they'll receive it in
- Preview updates as the reviewer types custom text (for `other`)
- Submit button label changes to "Reject & Notify Tenant"

### 3. Tenant notification send

On rejection submission:
1. Document marked rejected (existing behavior from `hach-reviewer-portal`)
2. Lookup tenant's preferred language from `pbv_full_applications` (or linked `tenant_profiles`)
3. Pick template in that language, interpolate variables
4. Send SMS via Twilio
5. If SMS fails or tenant has no phone, fallback to email via Resend
6. Log send in `tenant_notifications` with delivery status
7. Create row in Stanton dashboard notification queue

All of this happens in a single server action — reviewer sees "Rejected · Tenant notified by SMS" toast within a second.

### 4. Tenant resubmission flow

- Tenant clicks link in SMS → lands on existing `/t/[token]` magic link page (already built)
- Portal shows the specific document task that needs a new upload, highlighted at top
- Upload creates a new version of the document (not a new document)
- Document status flips back to `pending`
- Application moves back into HACH reviewer's "Awaiting Your Response" queue group
- "New upload" badge appears on queue item

### 5. Delivery tracking

Twilio webhooks update `tenant_notifications.delivery_status`:
- `queued` → `sent` → `delivered` or `failed`
- `undelivered` triggers automatic fallback to email

### 6. 48-hour SLA nudge

- If a document has been in `rejected` state for >48h with no resubmission from the tenant:
- Stanton's dashboard surfaces it as "Tenant not responding — needs chase"
- Daily digest email to assigned Stanton staff at 9am
- Staff can mark "Chased" with a note; resets the SLA clock

### 7. Delivery status visibility

- Reviewer packet view shows, per rejected doc: "Notified {tenant} via SMS on {timestamp} — delivered" or "SMS failed, email sent"
- Stanton dashboard shows the same data
- Prevents the "did they even get the message?" loop

---

## Data Model

```sql
-- Controlled vocabulary, admin-editable
CREATE TABLE rejection_reason_templates (
  code text primary key,
  label text not null,
  template_en text not null,
  template_es text not null,
  template_pt text not null,
  sort_order int default 100,
  is_active boolean default true,
  updated_at timestamptz default now(),
  updated_by uuid references admin_users(id)
);

-- Seed with initial 7 reasons from the table above.

-- Notification ledger
CREATE TABLE tenant_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references pbv_full_applications(id) on delete cascade,
  document_id uuid references form_submission_documents(id) on delete set null,
  triggered_by text not null,           -- e.g. 'document_rejected'
  channel text not null,                -- 'sms' | 'email'
  recipient text not null,              -- phone or email
  language text not null,
  message text not null,                -- final interpolated text
  provider_message_id text,             -- Twilio SID or Resend ID
  delivery_status text default 'queued', -- queued / sent / delivered / failed / undelivered
  error_detail text,
  sent_at timestamptz default now(),
  delivered_at timestamptz,
  UNIQUE(provider_message_id)
);

CREATE INDEX tn_app_idx ON tenant_notifications(application_id, sent_at desc);
CREATE INDEX tn_doc_idx ON tenant_notifications(document_id, sent_at desc);

-- Extend document_review_actions from hach-reviewer-portal
ALTER TABLE document_review_actions
  ADD COLUMN notification_id uuid references tenant_notifications(id);
```

---

## Integration Points

| System | Direction | Purpose |
|---|---|---|
| `hach-reviewer-portal` | Extends | Reject dialog now triggers notification |
| Twilio | Write | SMS send |
| Twilio | Read (webhook) | Delivery status updates |
| Resend | Write | Email fallback |
| Existing `/t/[token]` magic link | Integration point | Tenant lands here to resubmit |
| `stanton-pipeline-dashboard` | Writes to its surface | SLA breaches appear on Stanton side |

---

## Implementation Phases

### Phase 1 — Template system
- Create `rejection_reason_templates` table
- Seed with 7 initial reasons × 3 languages
- Admin UI at `/admin/settings/rejection-templates` for editing
- Helper `renderTemplate(code, lang, vars)` in `lib/rejection-templates.ts`

### Phase 2 — Notification ledger + send
- Create `tenant_notifications` table
- `sendTenantRejectionNotice(documentId, reasonCode, customText)` in `lib/notifications.ts`
- Twilio integration (assumes Twilio client already configured)
- Resend fallback

### Phase 3 — Reject dialog enhancement
- Live SMS preview in dialog (interpolates tenant name + doc label + language)
- Submit path now calls notification send
- Toast shows channel used

### Phase 4 — Magic link resubmission surface
- `/t/[token]` highlights any documents currently in `rejected` state at the top
- Show the rejection reason inline in tenant's language
- Upload new version → status flips to pending, application returns to HACH queue

### Phase 5 — Twilio webhook handler
- `/api/webhooks/twilio` receives delivery status updates
- Updates `tenant_notifications.delivery_status`
- Triggers email fallback on `undelivered`

### Phase 6 — 48-hour SLA
- Cron job or scheduled edge function
- Finds documents rejected >48h ago with no new upload
- Flags on Stanton dashboard (integrates with `stanton-pipeline-dashboard`)
- Daily digest email at 9am to assigned Stanton staff

---

## Out of Scope

- In-app notifications for HACH reviewers when tenants resubmit (v2 — they'll see it in their queue "Awaiting Your Response" group)
- Two-way SMS (tenant replying to the SMS) — v2
- Multi-document rejection in a single action — v2 (for now, each rejection is a single SMS)
- Voice call fallback for elderly tenants without SMS — out of scope (use in-person appointment scheduling instead)

---

## Open Questions

| Question | Owner |
|---|---|
| What phone number does SMS come from — Stanton's Twilio number or a dedicated PBV number? | Alex |
| SMS character limits: if interpolated message exceeds 160 chars, split into segments or shorten template? | Alex / design |
| When a tenant has no phone on file, do we skip SMS and go straight to email? Or flag the application for manual handling? | Alex / Dan |
| Should we notify the tenant when a previously rejected doc is approved on resubmission? ("✓ Your paystubs have been accepted.") | Dan |
| Legal: is an SMS from Stanton to a tenant about PBV compliance considered protected under any federal privacy rule? | Dan |
