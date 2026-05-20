# Windsurf Build Prompt — PRD-51: Combined "Approve & Send Invitation"

You are building from `docs/fullApp-Plan/51-pbv-preapp-combined-approve-send_prd_2026-05-19.md`. Read the PRD before doing anything.

This is a small, contained UI change — one file modified, no API changes, no migrations, no new deps. Estimated 2-4 hours including verification.

---

## Branch and base

- Base off `dev` (which is at the same SHA as `main` post-launch-merge per PRD-50).
- Branch: `feat/pbv-preapp-combined-approve-send-51`
- Final merge target: `main` (post-launch posture — `dev` is currently parallel to `main`).
- Confirm `git rev-parse HEAD` is at `7200a25` or later.

---

## Shell protocol

Standard rules:
- `npx tsc --noEmit` ~60s, `npm run build` ~300s, single retry on hang, no `npm run dev` from agent.
- No installs in this PRD — no new deps.
- Burned 2 retries and stuck? Stop. Report.

---

## Files to modify

| File | Change |
|---|---|
| `app/admin/pbv/preapps/page.tsx` | F1 — add `handleApproveAndSendInvitation` chain handler + per-step UI state. F2 — replace existing "Create Full Application Invitation" and "Send SMS Invitation" buttons with one combined button. F3 — inline confirm panel showing phone + language. F4 — preserve magic-link display + Copy Link + View Full Application link. |

That's the entire change surface. No other files.

---

## Files NOT to touch

- `app/api/admin/pbv/preapps/[id]/review/route.ts`
- `app/api/admin/pbv/full-applications/route.ts`
- `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts`
- `lib/notifications/**`
- `lib/phoneParser.ts` (use as-is; don't modify)
- Any translation file
- Any tenant-facing or HACH-facing component
- Any migration

If you find a fix you think is needed in any of these, stop and ask.

---

## Step-by-step

### Step 0 — Read

1. Read PRD-51 in full: `docs/fullApp-Plan/51-pbv-preapp-combined-approve-send_prd_2026-05-19.md`.
2. Read `app/admin/pbv/preapps/page.tsx` in full. Particularly:
   - The existing `handleCreateFullApp` (~line 602) and `handleSendSms` (~line 634) handlers.
   - The existing review buttons (Approve / Deny / Needs Info — search for `stanton_review_status` mutations).
   - The existing "Create Full Application Invitation" button (~line 864).
   - The existing "Send SMS Invitation" button (~line 902).
   - The inline confirm pattern used by the Delete-application section (~line 929) — match this pattern for the new confirm panel.
3. Verify how the page detects: (a) qualified vs not, (b) presence/absence of phone on `detail`, (c) whether a full_app already exists for this preapp. The existing code already gates these; reuse the same conditions.

### Step 1 — Add chain state + handler

In the detail-panel component (the same component that already owns `creatingFullApp`, `sendingSms`, `fullAppResult`, `smsSent`):

Add new state:
```ts
type ChainStep = 'idle' | 'confirming' | 'approving' | 'creating' | 'sending' | 'done' | 'error';
const [chainStep, setChainStep] = useState<ChainStep>('idle');
const [chainError, setChainError] = useState<{ step: ChainStep; message: string } | null>(null);
```

Add `handleApproveAndSendInvitation` per PRD §F1. Concretely:

- If `detail.stanton_review_status !== 'approved'`: call `/api/admin/pbv/preapps/${detail.id}/review` with `{ action: 'approved' }`. On failure: set `chainError` with `step: 'approving'`, set `chainStep: 'error'`, return.
- If `fullAppResult?.id` is falsy: call `/api/admin/pbv/full-applications` with the same body as existing `handleCreateFullApp`. Treat 409 as success (existing pattern). Store result in `fullAppResult`.
- Call `/api/admin/pbv/full-applications/${fullAppId}/send-sms` with `{ notification_type: 'magic_link_initial' }`.

Each step before its fetch: `setChainStep('approving' | 'creating' | 'sending')`. After all succeed: `setChainStep('done')`, `setSmsSent(true)`.

**Email-fallback handling:** the send-sms response may return `{ success: true, data: { email_sent: true, note: 'SMS failed, sent via email fallback' } }`. Treat as success. Surface a different "Sent via email (SMS failed)" panel instead of "Invitation sent ✓".

### Step 2 — Add the inline confirm panel

When the user clicks the combined button (in `idle` state), set `chainStep('confirming')`. While `chainStep === 'confirming'`, render an inline panel (not a modal) showing:

- Recipient name (`detail.hoh_name`)
- Phone formatted via `lib/phoneParser.ts` (use existing formatter; if it returns null/empty, show the raw value with `(unformatted)` next to it — don't crash)
- Language in plain English: map `detail.language` `'en' | 'es' | 'pt'` → `'English' | 'Spanish' | 'Portuguese'`
- One-line description: "This will: approve the preapp, create the full application, and text them the link." (If the preapp is already approved, drop "approve the preapp" from the list.)
- **Cancel** button → `setChainStep('idle')`
- **Confirm** button → call `handleApproveAndSendInvitation()`

Match the visual pattern of the existing delete-application confirm (~line 929 — red-tinted panel with Cancel/Confirm). Use neutral colors here (not red) since this is a positive action.

Do NOT use the native `confirm()` dialog. Inline panel only.

### Step 3 — Replace the two existing buttons

Remove:
- The "Create Full Application Invitation" button block (~line 864).
- The "Send SMS Invitation" button (~line 902) and its done-state replacement (~line 911).

Render in their place a single combined button whose label and disabled state come from the table in PRD §F2:

```
- chainStep === 'idle' && qualified && hasPhone && !approved → "Approve & Send Invitation"  (primary)
- chainStep === 'idle' && qualified && hasPhone && approved && !fullAppResult → "Create & Send Invitation"  (primary)
- chainStep === 'idle' && qualified && hasPhone && fullAppResult && !smsSent → "Send Invitation"  (primary)
- chainStep === 'idle' && qualified && !hasPhone → "Send Invitation" disabled, with helper text "No phone number on file"
- !qualified → button hidden entirely
- chainStep === 'confirming' → confirm panel from Step 2
- chainStep === 'approving' → button shows "Approving..." disabled
- chainStep === 'creating' → button shows "Creating application..." disabled
- chainStep === 'sending' → button shows "Sending invitation..." disabled
- chainStep === 'done' → non-interactive green panel "Invitation sent ✓" (or "Sent via email (SMS failed)" for email-fallback)
- chainStep === 'error' → red error panel showing the failed step + message + "Retry [step]" button that re-runs from that step only
```

Keep visible regardless of `chainStep`:
- The magic-link display block (~line 888) once `fullAppResult` exists.
- The Copy Link button.
- The "View Full Application →" link.

### Step 4 — Preserve guardrails

Detect `qualified` and `hasPhone` from `detail` (the existing object). Use whatever the file currently uses to decide whether to show the existing Approve button — reuse the same logic. Do not invent new gating.

For "already approved" detection, use `detail.stanton_review_status === 'approved'`. After a successful chain run that performed the approval step, mutate local state so subsequent renders reflect this. Either update `detail` via the existing setter or rely on a `localApproved` boolean — match the file's existing pattern.

### Step 5 — Type check

`npx tsc --noEmit`. Must pass.

### Step 6 — Build

`npm run build`. Must pass. Honor the shell protocol.

### Step 7 — Verification gates

Per PRD-51 Gates 1-8. Document each in the build report:

- **Gate 1** (happy path): screenshot of confirm panel showing phone + language, screenshot mid-chain showing progress, screenshot of done state, and a network-tab capture showing all three POST calls.
- **Gate 2** (no phone): screenshot of disabled button + helper text.
- **Gate 3** (already approved): network tab showing only 2 calls (no `/review`).
- **Gate 4** (full_app exists): network tab showing only 1 call (`/send-sms`).
- **Gate 5** (email fallback): UI screenshot of "Sent via email (SMS failed)" — if you can't reach a state where Twilio fails in dev, document the code path and unit-test the rendering logic instead.
- **Gate 6** (hard failure mid-chain): mock or temporarily break `/send-sms`, screenshot the error panel + retry button.
- **Gate 7** (not qualified): screenshot showing no combined button, Deny / Needs Info visible.
- **Gate 8** (build): paste of `npx tsc --noEmit` and `npm run build` output.

### Step 8 — Build report

Write `docs/build-reports/51-pbv-preapp-combined-approve-send_build-report_2026-05-19.md` with all gates documented and any open question from PRD-51 (O1-O4) answered based on what you observed.

---

## What "done" looks like

1. Branch `feat/pbv-preapp-combined-approve-send-51` pushed to origin.
2. `npx tsc --noEmit` clean.
3. `npm run build` clean.
4. PR opened against `main` with PRD link in description. (Not Draft — this one is ready to merge after Alex's review.)
5. Build report at `docs/build-reports/51-pbv-preapp-combined-approve-send_build-report_2026-05-19.md`.

---

## What NOT to do

- **Do not modify any API endpoint.** All three exist and are correct.
- **Do not introduce a server-side wrapper endpoint.** Client-side chain only.
- **Do not use native `confirm()` dialog.** Inline panel only.
- **Do not delete the magic-link display, Copy Link, or View Full Application link.** They stay.
- **Do not change the SMS template, notification triggers, or `lib/notifications/**`.**
- **Do not change Deny / Needs Info buttons.**
- **Do not add `any` types.** Narrow each fetch response.
- **Do not add new translations.** Admin UI stays English.
- **Do not paraphrase the PRD's button-label table.** Use the exact labels.
- **Do not silently expand scope.** This PRD is a UI change in one file. If you find a server-side bug while in the code, log it in the build report's "open questions" but do not fix it here.

---

## Reporting back

When done, post in chat:
- Branch + commit SHA at HEAD.
- PR URL.
- Build report URL.
- Result of each verification gate (1-8): pass / fail / deferred-because.
- Answers to PRD-51 open questions O1-O4 based on what you observed.
- Anything you punted on with reason.
