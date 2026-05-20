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

See `docs/SHELL-PROTOCOL.md`. PRD-specific deviations:
- One migration in this PRD (F0 phone column) — create the `.sql` file, do NOT execute it. Supabase migrations are applied on deploy, not by build agents.

**Critical:** for type-checking, use `node ./node_modules/typescript/bin/tsc --noEmit`, NOT `node ./node_modules/typescript/bin/tsc --noEmit`. The npx layer hangs on Windows due to binary-resolution + AV overhead. This protocol applies to all PRDs going forward.

---

## Files to modify

| File | Change |
|---|---|
| `supabase/migrations/<timestamp>_pbv_preapp_phone.sql` | F0 — new migration adding `pbv_preapplications.phone` column (nullable). |
| `types/compliance.ts` | F0 — add `phone: string | null` to `PbvPreapplication`. |
| `app/api/admin/pbv/preapps/[id]/route.ts` (or wherever preapp edits happen) | F0 — accept `phone` on the PATCH path. If no edit route exists, add one. |
| `app/api/admin/pbv/full-applications/route.ts` | F0 — accept and store `phone` on insert (column already exists on `pbv_full_applications`). |
| `app/admin/pbv/preapps/page.tsx` | F0 — editable phone field in the detail panel (inline edit, Save/Cancel, format via `lib/phoneParser.ts`). F1 — `handleApproveAndSendInvitation` chain handler. F2 — replace existing Create + Send buttons with one combined button. F3 — inline confirm panel showing phone + language. Inline phone-entry shown if phone missing when user clicks the combined button. F4 — preserve magic-link display + Copy Link + View Full Application link. |
| `lib/phoneParser.ts` | Reuse — do not modify. |

**Files NOT to touch:** `lib/notifications/**`, `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts`, `app/api/admin/pbv/preapps/[id]/review/route.ts`, any tenant-facing surface, any HACH-facing surface.

---

## Files NOT to touch (revised)

- `app/api/admin/pbv/preapps/[id]/review/route.ts` — review action only; phone editing is a separate concern (see F0).
- `app/api/admin/pbv/full-applications/[id]/send-sms/route.ts`
- `lib/notifications/**`
- `lib/phoneParser.ts` (use as-is; don't modify)
- Any translation file (admin is English-only)
- Any tenant-facing or HACH-facing component
- The public preapp form (`app/pbv-preapp/page.tsx`) — phone is NOT collected on the tenant-facing form.

**Files now in scope (revised from prior version):** the create-full-app endpoint (`app/api/admin/pbv/full-applications/route.ts`) and the preapp PATCH route are in scope because F0 needs phone propagation end-to-end. The previous version of this prompt incorrectly listed both as off-limits.

If you find a fix you think is needed elsewhere, stop and ask.

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

### Step 0.5 — Phone on preapp (F0)

Before any UI work, ship the data path. Order:

1. **Migration:** create `supabase/migrations/<timestamp>_pbv_preapp_phone.sql`:
   ```sql
   ALTER TABLE pbv_preapplications ADD COLUMN phone TEXT;
   COMMENT ON COLUMN pbv_preapplications.phone IS 'Tenant phone for SMS invitations and pre-invite outreach. Captured manually by staff.';
   ```
   Use the next available timestamp consistent with existing migration naming.

2. **Type:** add `phone: string | null` to `PbvPreapplication` in `types/compliance.ts`.

3. **PATCH endpoint:** find the existing preapp edit route (search for `PATCH` handlers under `app/api/admin/pbv/preapps/`). If one exists, add `phone` to its accepted fields. If not, create `app/api/admin/pbv/preapps/[id]/route.ts` with a minimal PATCH that accepts `{ phone }`, validates via `lib/phoneParser.ts`, updates the row, audit-logs per existing pattern.

4. **Create-full-app endpoint** (`app/api/admin/pbv/full-applications/route.ts`): accept `phone` in the request body, store it on the inserted `pbv_full_applications.phone` column. Backward-compatible — `phone` is optional in the request.

5. **Admin preapp detail page (`app/admin/pbv/preapps/page.tsx`):** add an editable phone field in the existing "Head of Household" / contact section. Pattern:
   - Display: formatted via `lib/phoneParser.ts`. "Not set" when null.
   - Edit: pencil icon or "Edit" link → input + Save/Cancel buttons.
   - Save: PATCH to the route from step 3. Optimistic update of local `detail.phone`.

Type-check after F0 is complete: `node ./node_modules/typescript/bin/tsc --noEmit`.

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
- chainStep === 'idle' && qualified && !approved → "Approve & Send Invitation"  (primary)
- chainStep === 'idle' && qualified && approved && !fullAppResult → "Create & Send Invitation"  (primary)
- chainStep === 'idle' && qualified && fullAppResult && !smsSent → "Send Invitation"  (primary)
- !qualified → button hidden entirely
- chainStep === 'confirming' → confirm panel from Step 2
- chainStep === 'approving' → button shows "Approving..." disabled
- chainStep === 'creating' → button shows "Creating application..." disabled
- chainStep === 'sending' → button shows "Sending invitation..." disabled
- chainStep === 'done' → non-interactive green panel "Invitation sent ✓" (or "Sent via email (SMS failed)" for email-fallback)
- chainStep === 'error' → red error panel showing the failed step + message + "Retry [step]" button that re-runs from that step only
```

**`hasPhone` pre-check is back, now that F0 puts phone on the preapp.** Compute `hasPhone = !!detail.phone`. When the user clicks the combined button (chain in `idle`):
- If `hasPhone`: proceed to the confirm panel (Step 2) as normal.
- If `!hasPhone`: show an inline phone input above the confirm panel with a Save button. After save (PATCH preapp + update local `detail.phone`), automatically proceed to the confirm panel showing the now-populated phone.

No page navigation. The user never leaves the preapp detail. The previous "send-sms fails, navigate to full_app to add phone" workflow is now obsolete — this PR replaces it.

In the combined handler (F1), when calling create-full-app, pass `phone: detail.phone` so the value propagates to `pbv_full_applications.phone`. The send-sms step then sees a phone on the full_app and proceeds normally.

Keep visible regardless of `chainStep`:
- The magic-link display block (~line 888) once `fullAppResult` exists.
- The Copy Link button.
- The "View Full Application →" link.

### Step 4 — Preserve guardrails

Detect `qualified` and `hasPhone` from `detail` (the existing object). Use whatever the file currently uses to decide whether to show the existing Approve button — reuse the same logic. Do not invent new gating.

For "already approved" detection, use `detail.stanton_review_status === 'approved'`. After a successful chain run that performed the approval step, mutate local state so subsequent renders reflect this. Either update `detail` via the existing setter or rely on a `localApproved` boolean — match the file's existing pattern.

### Step 5 — Type check

`node ./node_modules/typescript/bin/tsc --noEmit`. Must pass.

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
- **Gate 8** (build): paste of `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` output.

### Step 8 — Build report

Write `docs/build-reports/51-pbv-preapp-combined-approve-send_build-report_2026-05-19.md` with all gates documented and any open question from PRD-51 (O1-O4) answered based on what you observed.

---

## What "done" looks like

1. Branch `feat/pbv-preapp-combined-approve-send-51` pushed to origin.
2. `node ./node_modules/typescript/bin/tsc --noEmit` clean.
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
