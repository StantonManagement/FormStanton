# PRD-43 Brief — Tenant Outbound Comms: Pre-flight Checklist + Deferred-Doc Reminders

**For:** Cowork session to turn into full PRD
**Date:** 2026-05-17
**Status:** Brief — not a PRD

---

## Problem

Two gaps in the tenant comms flow:

1. **No pre-flight prep.** Tenants open the magic link with no idea what they'll need. The page is the first time they learn "you need 4 paystubs and a bank statement." For a tenant in 5-minute mobile bursts, that means session 1 is wasted figuring out the list.
2. **No follow-up on deferred docs.** If a tenant taps "I'll get this later" (PRD-42) or simply abandons mid-flow, nothing nudges them back. Application sits stale until staff manually chases.

Two SMS flows close both gaps. Lower technical risk than PRD-42 and may move the needle just as much for tenants like the single-mom test case.

---

## Example pre-flight SMS

```
Hi Maria — to finish your housing application,
gather these:

✓ Last 4 paystubs from your job
✓ Your bank statement (most recent)
✓ Photo ID for you and any adults
✓ Birth certificates for everyone in the unit
✓ SSI award letter (the one Social Security mailed you)
✓ Your child's school schedule

When you have them, tap your link:
form-stanton.vercel.app/t/abc123
```

Plain-text, no jargon, conditional on intake answers. EN/ES/PT off `preferred_language`.

---

## In scope

### F1 — Pre-flight checklist SMS

- Sent immediately after intake completes (`intake/complete` endpoint).
- Content conditional on filtered doc list from `GET /api/t/[token]/pbv-full-app/documents`. Skip cards the tenant doesn't need.
- Plain-text bulleted format. One short line per doc — same content source as PRD-41's `docTypeHelp`, stripped to one-liner.
- EN/ES/PT keyed off `preferred_language`.
- Magic link at the bottom.
- Idempotent — won't double-send if `intake/complete` replays.

### F2 — Deferred-doc reminders

- Triggered by:
  - "I'll get this later" tap in PRD-42 card flow, OR
  - Docs sitting at `missing` past a time threshold (default 3 days since intake).
- Cadence: 3 days, 7 days, then weekly. Configurable per project.
- Content: short recap of what's still needed + count + link. Do NOT list every doc each time — link drops them back into the card stack.

### F3 — Anti-spam guardrails

- Cap N reminders per tenant per week (default: 2).
- Pause if tenant uploaded anything in the last 24h — they're already engaged.
- Stop entirely on `application_submitted`.
- Quiet hours: no sends 9pm–9am tenant local time. Default tenant TZ to America/New_York; flag if a `tenant_timezone` column is needed.

---

## Dependencies

- **[Unverified per project knowledge dated March 2026]** Twilio infra is "in progress — nearly done." Cowork verifies current state before scoping.
- PRD-42 needed for the "I'll get this later" trigger. Without it, F2 fires only on time threshold.
- Existing event log (`application_events`) — emit `REMINDER_SENT` for audit.

---

## Out of scope

- Email versions (separate channel, different cadence rules).
- Voice / IVR.
- Staff-initiated manual nudges (UI for staff to send a one-off SMS).
- Reminder copy A/B testing infrastructure.

---

## Open questions for Cowork to verify

1. **Template storage:** DB table (matching `pbv_document_label_translations` pattern) or content file? Recommend DB for staff editability without deploys.
2. **Reminder copy:** full remaining doc list each send, or just count + link? Recommend count + link — keeps SMS short and avoids re-stating jargon.
3. **Unification:** are deferred-doc reminders and general "you haven't completed this" reminders one system or two? Recommend one — same anti-spam, same audit trail.
4. **[Unverified]** Twilio account status, sender ID configuration, A2P 10DLC registration state. Confirm before scoping send-volume assumptions.
5. **Tenant TZ:** is timezone reliably known per tenant, or do we need a heuristic from building address?
