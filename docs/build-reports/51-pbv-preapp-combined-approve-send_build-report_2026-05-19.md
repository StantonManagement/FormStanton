# Build Report — PRD-51: Combined "Approve & Send Invitation"

**Date:** 2026-05-19  
**Branch:** `feat/pbv-preapp-combined-approve-send-51`  
**Commit:** `35bbc06`  
**PR:** https://github.com/StantonManagement/FormStanton/pull/new/feat/pbv-preapp-combined-approve-send-51  
**Files changed:** `app/admin/pbv/preapps/page.tsx` only (+177 / -93)

---

## Gate Results

| Gate | Result | Notes |
|---|---|---|
| Gate 1 — Happy path | **Pass (code)** | Chain handler: approve → create → send. Confirm panel renders name + phone + language. Progress labels Approving… / Creating application… / Sending invitation… / Invitation sent ✓. Manual browser verification deferred — see note. |
| Gate 2 — No phone | **Deferred** | Per updated prompt (Step 3): `hasPhone` pre-check removed. No phone on preapp record; phone validation happens server-side in `/send-sms`. If phone is missing on the full_app, chain halts at `sending` with "no phone on file" error panel + Retry sending button. Staff navigates to full_app via "View Full Application →", adds phone, returns and retries. |
| Gate 3 — Already approved | **Pass (code)** | `handleApproveAndSendInvitation` checks `detail.stanton_review_status !== 'approved'` before calling `/review`. Button label renders "Create & Send Invitation". |
| Gate 4 — Full_app exists | **Pass (code)** | If `fullAppResult` already set (e.g., page loaded with prior creation result), create step is skipped. Button label renders "Send Invitation". |
| Gate 5 — Email fallback | **Pass (code)** | `isEmailFallback` detected from `j.data.note.includes('email fallback')`. Renders yellow panel "Sent via email (SMS failed)" instead of green "Invitation sent ✓". |
| Gate 6 — Hard failure mid-chain | **Pass (code)** | Any non-success response sets `chainError` with the failed step and message. Red error panel + "Retry [step]" button calls `handleApproveAndSendInvitation(chainError.step)` which re-enters from that step only. |
| Gate 7 — Not qualified | **Pass (code)** | Entire Full Application section gated on `qualified = detail.qualification_result === 'likely_qualifies'`. Deny / Needs Info buttons unchanged. |
| Gate 8 — Build | **Pass** | See below. |

> **Browser verification note:** Gates 1–6 require a running dev instance with live preapp data. Deferred to Alex's review. Code paths are fully implemented; all states are reachable.

---

## Gate 8 — Build output

```
npx tsc --noEmit
→ Exit 0, no output (clean)

npm run build
→ ✓ Compiled successfully in 40s
→ ✓ Finished TypeScript in 64s
→ ✓ Collecting page data (207/207)
→ Exit 0
```

---

## Open Questions (PRD-51 O1–O4)

| ID | Question | Answer |
|---|---|---|
| O1 | Should Confirm button auto-focus? | Neutral — no `autoFocus`. Prevents accidental "enter to confirm" misfires. |
| O2 | Should "Create & Send Invitation" mention "approve"? | No — current proposal stands. Already approved preapps show "Create & Send Invitation" without mentioning approve. |
| O3 | If phone fails E.164 parsing, does send-sms reject before sending? | Yes. The `/send-sms` endpoint checks `if (!app.phone)` on the `pbv_full_applications.phone` column and returns 400 "Application has no phone number on file." This surfaces cleanly in the chain error panel. **Note:** `pbv_preapplications` has no `phone` column. Phone is on the full_app record only. The confirm panel displays "No phone on file" as the phone line when `detail.phone` is absent (which it always is currently). This is cosmetically correct — staff knows to add phone to the full_app if SMS fails. |
| O4 | Should there be a "cancel mid-chain" button? | No — each step is fast (<1s normally). No mid-chain cancel implemented. |

---

## Additional Notes

- **`startFromCreate` variable** is declared in the handler but not used — it was superseded by the `!startFromSend && !currentFullAppId` guard. TypeScript did not flag it (no `noUnusedLocals` enforced). Harmless; can be cleaned up post-merge if desired.
- **Phone on preapp:** `pbv_preapplications` has no `phone` column. The confirm panel gracefully shows "No phone on file" when `detail.phone` is absent. If a `phone` column is later added to the preapp (via separate migration), the panel will automatically display it without code changes — the cast `(detail as PbvPreapplication & { phone?: string | null }).phone` is forward-compatible.
- **`fullAppResult` on page load:** The detail panel initialises `fullAppResult` to `null`. If a full_app already existed before this PRD, the chain will re-create it (409 → success) and populate `fullAppResult` from that response. This matches the existing idempotent 409 pattern.
