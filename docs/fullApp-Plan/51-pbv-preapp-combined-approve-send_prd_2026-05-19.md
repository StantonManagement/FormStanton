# PRD-51 — Combined "Approve & Send Invitation" Button on Preapp Detail

**Date:** 2026-05-19
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-preapp-combined-approve-send-51`
**Status:** Draft — ready for build
**Depends on:** `main` post-launch-merge (`7200a25` or later). Both `dev` and `main` carry the same state per PRD-50.
**Blocks:** Nothing in flight.

---

## Problem Statement

Today, sending a tenant their full-application invitation is a three-click sequence on the preapp detail page (`app/admin/pbv/preapps/page.tsx`):

1. Staff clicks **Approve** in the review section.
2. Staff clicks **Create Full Application Invitation**. Backend creates a `pbv_full_applications` row, returns the magic link.
3. Staff clicks **Send SMS Invitation**. Backend calls Twilio.

Each click is meaningful in isolation, but for the happy path — qualified preapp with a phone number on file — the three steps are clerical. Tess/Kristine are about to do this 77 times this cycle. The three-click sequence also introduces three places where staff can get distracted, walk away, and leave an applicant in a half-complete state (approved but not invited; full_app created but no SMS sent).

This PRD collapses the happy-path approve→create→send into one button with a single confirmation gate that shows the phone number and language being used. The two existing component buttons go away.

Deny and Needs-Info paths are unchanged — they stay separate because they're different actions with different downstream effects.

---

## Current state (confirmed 2026-05-19 against `main` @ `7200a25`)

| Surface | Path | Notes |
|---|---|---|
| Preapp detail page (admin) | `app/admin/pbv/preapps/page.tsx` | ~960 lines. The detail panel contains the three buttons described above plus Deny / Needs Info. |
| Review endpoint | `app/api/admin/pbv/preapps/[id]/review/route.ts` | `POST` with `{ action: 'approved' \| 'denied' \| 'needs_info', notes?, reviewer? }`. Updates `stanton_review_status` on the preapp. |
| Create full-app endpoint | `app/api/admin/pbv/full-applications/route.ts` | `POST` with `{ building_address, unit_number, head_of_household_name, bedroom_count?, language, preapp_id }`. Creates `pbv_full_applications` row with `tenant_access_token`. Returns 409 if one already exists for this preapp — handler treats 409 as success (idempotent). |
| Send-SMS endpoint | `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts` | `POST` with `{ notification_type: 'magic_link_initial' }`. Returns `sent` / `blocked` / `email_fallback` / failed. Phone validation already inline. |
| Existing button: Create | preapps/page.tsx ~line 864 | "Create Full Application Invitation" — to be replaced. |
| Existing button: Send SMS | preapps/page.tsx ~line 902 | "Send SMS Invitation" — to be replaced. |
| Existing button: Approve | (in the review section, not yet read in this PRD) | Part of the standard review Approve/Deny/Needs-Info trio. Approve becomes the trigger for the combined action; Deny and Needs-Info stay as-is. |
| Magic-link display | preapps/page.tsx ~line 888 | The full_app's magic link is displayed with a Copy button after creation. Keep — useful fallback for SMS failure. |

---

## Goals

1. **One click + one confirm** to take a qualified preapp from "submitted" to "invitation sent." No three-button sequence.
2. **Phone number and language visible in the confirm dialog.** Staff sees exactly what's about to happen.
3. **Progress states with per-step messaging.** Staff knows whether the failure happened at approval, creation, or SMS — and what to do next.
4. **Idempotent against partial completion.** If staff approved earlier but didn't create the full_app, the button picks up from there. Same for create-without-send.
5. **No regression** to Deny / Needs Info flows or to the existing send-sms endpoint behavior.

## Non-Goals

- **No server-side wrapper endpoint.** The combined action lives in client-side handler code that chains the three existing endpoints. Auditing already happens at each endpoint.
- **No changes to the send-sms endpoint.** It already handles phone validation, language, blocked states, email fallback.
- **No changes to the SMS message body.** Templates live in `lib/notifications/*`.
- **No changes to Deny / Needs Info buttons.**
- **No new analytics events.** Each endpoint already audits.
- **No batch/bulk version.** This is a per-preapp action. Bulk could come later if Tess/Kristine ask.
- **No "create-only without SMS" alternative button.** Removed by replacement. If staff needs to create without sending (testing / edge cases), they can hit the API directly or we add a CLI script later.

---

## Users & Roles

| Role | What changes |
|---|---|
| Staff (Tess, Kristine, Alex) reviewing a qualified preapp | One button, one confirm. SMS goes out in the applicant's preferred language. ~3 seconds end to end on the happy path. |
| Staff reviewing a non-qualified preapp | Approve action is disabled or hidden (existing behavior — verify). The combined button is also disabled/hidden. Deny / Needs Info stay accessible. |
| Staff reviewing a preapp without a phone number | Combined button is disabled, with a visible reason ("no phone on file — add a phone number first"). Approve via the existing review path still works. |
| Staff reviewing a preapp where SMS was already sent | Sees "Invitation sent ✓" non-interactive state. The full-app link + Copy Link + "View Full Application" link stay visible. |
| Tenant | No change to what they receive. Same SMS, same link, same destination. |

---

## Closed Decisions

1. **Confirmation dialog shows phone + language.** Single native `confirm()` is acceptable for MVP — text like *"Send invitation to (860) 555-0199 in English? This will create a full application and text them the link."* — but prefer a small inline confirmation panel inside the detail page (Cancel / Confirm buttons) since `confirm()` is harder to style consistently. Either is acceptable; the bar is that the phone number is visible to staff before the SMS fires.

2. **Client-side chain, not a server wrapper.** Existing endpoints stay unchanged. Handler in `page.tsx` calls them in sequence, sets per-step UI state, displays errors per step with retry-from-here options.

3. **Replace both old buttons.** "Create Full Application Invitation" and "Send SMS Invitation" go away. Magic-link display + Copy Link stays. "View Full Application →" link stays.

4. **Idempotent against partial completion.**
   - If `stanton_review_status` is already `approved` and no full_app exists → button label becomes **"Create & Send Invitation"** and skips the review call.
   - If full_app exists and SMS not yet sent → button label becomes **"Send Invitation"** and skips the review + create calls.
   - If all three are done → non-interactive "Invitation sent ✓" with timestamp.

5. **Guardrails:**
   - Button hidden if `qualification_result !== 'likely_qualifies'` (matches existing Approve button gating — verify).
   - Button disabled with reason if no phone on file.
   - Button disabled if a step is in-flight.

6. **Per-step progress text.** "Approving... → Creating application... → Sending invitation... → Sent ✓" — each transition rendered, so staff understands what's happening if any step pauses.

7. **Errors halt the chain at the failure point.** No automatic retry. UI shows the error, the step that failed, and a button to retry from that step. Earlier steps stay completed (e.g., if SMS fails, the full_app is not deleted).

8. **SMS-failure email fallback is treated as success.** The send-sms endpoint already does this — if Twilio fails, the unified notification primitive sends via email and returns `email_fallback: true`. UI should show "Sent via email (SMS failed)" rather than treating it as an error.

9. **No new translations.** Admin UI is English-only; the SMS itself is multilingual via the existing notification templates.

---

## Detailed Changes

### F1 — Add combined handler

**File:** `app/admin/pbv/preapps/page.tsx`

Add a new handler near the existing `handleCreateFullApp` / `handleSendSms`:

```ts
type ChainStep = 'idle' | 'confirming' | 'approving' | 'creating' | 'sending' | 'done' | 'error';

const [chainStep, setChainStep] = useState<ChainStep>('idle');
const [chainError, setChainError] = useState<{ step: ChainStep; message: string } | null>(null);

const handleApproveAndSendInvitation = async () => {
  setChainError(null);

  // Skip approve step if already approved
  if (detail.stanton_review_status !== 'approved') {
    setChainStep('approving');
    const r = await fetch(`/api/admin/pbv/preapps/${detail.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approved' }),
    });
    const j = await r.json();
    if (!j.success) {
      setChainError({ step: 'approving', message: j.message || 'Failed to approve preapp' });
      setChainStep('error');
      return;
    }
    // Mutate local detail.stanton_review_status to 'approved' so next render reflects state
  }

  // Skip create step if full_app already exists
  let fullAppId = fullAppResult?.id ?? null;
  if (!fullAppId) {
    setChainStep('creating');
    const r = await fetch('/api/admin/pbv/full-applications', { /* same body as handleCreateFullApp */ });
    const j = await r.json();
    if (!j.success && r.status !== 409) {
      setChainError({ step: 'creating', message: j.message || 'Failed to create full application' });
      setChainStep('error');
      return;
    }
    fullAppId = j.data?.id;
    setFullAppResult({ id: fullAppId!, magic_link: j.data?.magic_link ?? '' });
  }

  // SMS
  setChainStep('sending');
  const r = await fetch(`/api/admin/pbv/full-applications/${fullAppId}/send-sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_type: 'magic_link_initial' }),
  });
  const j = await r.json();
  if (!j.success) {
    setChainError({ step: 'sending', message: j.message || 'Failed to send invitation' });
    setChainStep('error');
    return;
  }
  setSmsSent(true);
  setChainStep('done');
};
```

This is illustrative — the build agent will tighten it (proper types, error narrowing, no `any`).

### F2 — Replace the two existing buttons

Remove the existing **Create Full Application Invitation** button (preapps/page.tsx ~line 864) and **Send SMS Invitation** button (~line 902). In their place, render a single combined button whose label depends on the chain progress:

| State | Label | Style |
|---|---|---|
| Idle, no phone | "Send Invitation" disabled with red helper text "No phone on file" | grey/disabled |
| Idle, not qualified | (hidden) | — |
| Idle, qualified, not yet approved | "Approve & Send Invitation" | primary |
| Idle, already approved, no full_app | "Create & Send Invitation" | primary |
| Idle, full_app exists, no SMS | "Send Invitation" | primary |
| In-progress | "Approving..." / "Creating application..." / "Sending invitation..." | primary disabled |
| Done | "Invitation sent ✓" + timestamp | non-interactive green panel |
| Error | error panel + "Retry" button scoped to the failed step | red |

### F3 — Confirmation step before the chain runs

When staff clicks the combined button while `chainStep === 'idle'`, render an inline confirmation panel (Cancel / Confirm) showing:

- Recipient name (`detail.hoh_name`)
- Phone number formatted (e.g., `(860) 555-0199`)
- Language in plain English ("English", "Spanish", "Portuguese")
- One-line "This will: approve the preapp, create the full application, and text the link."

`Confirm` calls `handleApproveAndSendInvitation`. `Cancel` returns to idle.

Keep this inline, not a modal — modals are heavier than needed for one step. The existing patterns in the file already use inline confirmation (the delete-application confirm at ~line 929 is a good reference).

### F4 — Magic link display + Copy Link + View Full Application

Keep all three. They're independent of the button consolidation and provide a manual fallback if SMS fails.

---

## Architecture Rules

1. **No server-side endpoint changes.** Three existing endpoints stay as they are.
2. **No new dependencies.**
3. **No `localStorage` / `sessionStorage`.** All state in React.
4. **No new translations.** Admin UI is English-only.
5. **Phone number formatting via existing `lib/phoneParser.ts`.** Don't reformat inline.
6. **No `any` types.** Narrow each fetch response.
7. **Errors halt the chain.** No automatic retries. Staff decides.
8. **Email-fallback counts as success.** Display "Sent via email (SMS failed)" — don't surface a red error.

---

## Verification Gates

### Gate 1 — Happy path, qualified preapp with phone

- Open `/admin/pbv/preapps`, click into a qualified preapp with a phone on file.
- Click "Approve & Send Invitation."
- Confirm panel shows recipient + phone + language.
- Click Confirm.
- Watch progress: Approving... → Creating application... → Sending invitation... → Sent ✓.
- Verify a real SMS arrives (or a test SMS in dev mode), and `pbv_full_applications` has a new row with `tenant_access_token`.

### Gate 2 — No phone on file

- Find or create a preapp with `phone IS NULL`.
- Button is disabled, with helper text indicating why.
- Approve via the existing review path still works.

### Gate 3 — Already approved (idempotent)

- Open a preapp where `stanton_review_status = 'approved'` and no full_app exists.
- Button reads "Create & Send Invitation." First step (approval) is skipped.
- Verify in network tab: no call to `/review`, calls to `/full-applications` and `/send-sms` fire.

### Gate 4 — Full_app exists, SMS not sent

- Open a preapp where the full_app exists but `smsSent` is false (e.g., a preapp processed before this PRD landed).
- Button reads "Send Invitation."
- Only `/send-sms` fires.

### Gate 5 — SMS failure path → email fallback

- Configure (or mock) Twilio to return an error in dev. The unified send primitive should fall back to email.
- Verify the UI shows "Sent via email (SMS failed)" rather than a red error.

### Gate 6 — Hard failure mid-chain

- Force a 500 from `/send-sms` (mock or break the endpoint locally).
- Verify the chain stops at `sending`, the error panel shows the step + message, and a "Retry sending" button appears.
- Click Retry — only `/send-sms` fires; earlier steps not re-attempted.

### Gate 7 — Not qualified preapp

- Open a preapp where `qualification_result !== 'likely_qualifies'`.
- Combined button is hidden. Deny / Needs Info still visible.

### Gate 8 — Build + types

- `npx tsc --noEmit` clean.
- `npm run build` clean.

---

## Out of Scope (do not touch)

- `app/api/admin/pbv/preapps/[id]/review/route.ts`
- `app/api/admin/pbv/full-applications/route.ts`
- `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts`
- `lib/notifications/**`
- Translations files
- SMS template content
- Deny / Needs Info button code paths
- Any tenant-facing page
- Any HACH-facing surface

---

## Phasing

**Single phase.** All changes in `app/admin/pbv/preapps/page.tsx`. Estimated Windsurf time: 2-4 hours including verification gates.

---

## Open Questions

| ID | Question | Owner | Blocker? |
|---|---|---|---|
| O1 | Should the confirmation panel auto-focus the Confirm button, or stay neutral? | Build agent — default to neutral. Auto-focus risks "enter to confirm" misfires. | No |
| O2 | Should the button text mention "approve" if the preapp is already approved (idempotency)? Currently "Create & Send Invitation" omits it. | Alex | No — current proposal stands. |
| O3 | If a preapp has a phone but it fails E.164 parsing, does the send-sms endpoint reject before sending? | Build agent — verify in the existing send-sms code path and document. | No |
| O4 | Should there be a "cancel mid-chain" button? Today: no, each step is fast (<1s normally). Revisit if real usage shows slow steps. | Alex | No |
