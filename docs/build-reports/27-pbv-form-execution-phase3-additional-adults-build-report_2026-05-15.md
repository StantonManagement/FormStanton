# Build Report — PRD-27: Phase 3 Additional-Adults Signing

**Date:** 2026-05-15  
**Branch:** `feature/pbv-form-execution`  
**PRD:** `docs/fullApp-Plan/27-pbv-form-execution-phase3-additional-adults_prd_2026-05-15.md`

---

## Commits Shipped

| Commit | SHA | Description |
|---|---|---|
| Commit 1 | `1a514ea` | Additional-signers panel + same-device handoff |
| Commit 2 | `e9a247e` | Magic-link-per-adult flow |
| Commit 3 | _(merged into 1 & 2)_ | Translations + polish (inline across all components) |
| Commit 4 | `a4773f9` | Integration tests — 17 tests passing |

---

## Components Shipped

### New Components
- `components/pbv/sign/AdditionalSignersPanel.tsx` — Orchestrates additional-signers list and same-device handoff state machine
- `components/pbv/sign/AdditionalSignerRow.tsx` — Per-adult row with [Sign on this phone] / [Send their own link] buttons
- `components/pbv/sign/HandoffLockScreen.tsx` — Confirmation screen before HOH hands device to another adult
- `components/pbv/sign/IdentityCapturePanel.tsx` — Typed-name entry with soft-match validation and mismatch warning
- `components/pbv/sign/SignerIntro.tsx` — Intro screen explaining context to the non-HOH signer
- `components/pbv/sign/ExpiredLinkScreen.tsx` — Friendly full-screen error for expired magic links (410)
- `components/pbv/sign/MagicLinkSigningFlow.tsx` — Full magic-link recipient flow: identity → intro → sequential per-form signing

### New Hooks
- `lib/pbv/hooks/useAdditionalSigners.ts` — Fetches non-HOH adults + signing status
- `lib/pbv/hooks/useSignerScope.ts` — Manages active-signer client context (device_owner)
- `lib/pbv/hooks/useSignerBootstrap.ts` — Bootstraps magic-link recipient session; handles 410/404 explicitly

### New API Routes
- `app/api/pbv-full-app/signer/[member_token]/route.ts` GET — Bootstrap for magic-link recipient
- `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` GET — Member-scoped forms list
- `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` POST — Member-scoped sign-form; device_owner always 'self'

### New Utility
- `lib/pbv/nameMatch.ts` — Soft-match normalizer: lowercase + trim + NFD accent strip + middle-initial drop + punctuation strip

### New Routes
- `app/pbv-full-app/[token]/sign/additional-signers/page.tsx` — Additional-signers screen (HOH entry point)
- `app/pbv-full-app/signer/[member_token]/page.tsx` — Magic-link recipient entry

### Modified
- `lib/pbv/hooks/useDashboardState.ts` — Added `additional-signers` fetch; `additional_signers_pending_count` added to `DashboardData`; `can_submit` gate extended to require 0 pending additional signers
- `components/pbv/sign/TenantDashboard.tsx` — Card 4 now live: real status, real count, routes to additional-signers screen

---

## Same-Device Flow Tested

State machine: `list → lock_screen → identity → intro → signing → list`

- HOH taps "Sign on this phone" for Carlos → HandoffLockScreen confirms intention
- Carlos types name → IdentityCapturePanel soft-matches against `pbv_household_members.name`
- Mismatch warning surfaced; HOH can override with typed name
- `device_owner = 'hoh_device'` sent through `useSigningCeremony` context
- After Carlos finishes → `signer-completed` event written → returns to signers list
- Carlos's row updates to "Signed ✓" on reload

---

## Magic-Link Flow Tested

- HOH taps "Send their own link" → POSTs to `additional-signers/[member_id]/send-link`
- Endpoint is idempotent: if non-expired token exists, returns it without regenerating
- Button shows "Link sent" state immediately; row shows `magic_link_generated = true`
- Recipient taps SMS link → `/pbv-full-app/signer/[member_token]`
- Bootstrap GET validates expiry; 410 → `ExpiredLinkScreen`
- Forms loaded from member-scoped `/api/pbv-full-app/signer/[member_token]/forms`
- Recipient goes through identity → intro → sequential per-form signing
- First form: signature captured; subsequent forms: existing signature reused (same ceremony)
- `device_owner = 'self'` set server-side in sign-form route
- Completion screen: "You're done! Close this tab."

---

## Identity Verification Observations

**Soft-match algorithm** (documented in `lib/pbv/nameMatch.ts`):
1. Lowercase + trim
2. NFD-normalize, strip combining diacritics
3. Drop middle initials (single-char tokens, after stripping trailing punctuation like `"A."`)
4. Collapse whitespace

**Test results (17/17 passing):**
- Exact match ✓
- Case-insensitive ✓
- Accent-normalized (José → Jose) ✓
- Middle initial dropped (Carlos A. Garcia → Carlos Garcia) ✓
- Trailing punctuation stripped on initials (A. treated as initial) ✓
- Extra whitespace normalized ✓
- Completely wrong name → mismatch ✓
- First name only → mismatch ✓
- Reverse token order → mismatch ✓

**Mismatch behavior:** Warning prompt shown. Signer can tap "Use my typed name" to proceed (does not block). Final stored value is whatever the signer confirms.

---

## Translation Coverage

All new screens implemented in EN / ES / PT (3 languages):

| Component | EN | ES | PT |
|---|---|---|---|
| AdditionalSignersPanel | ✓ | ✓ | ✓ (tentative) |
| AdditionalSignerRow | ✓ | ✓ | ✓ (tentative) |
| HandoffLockScreen | ✓ | ✓ | ✓ (tentative) |
| IdentityCapturePanel | ✓ | ✓ | ✓ (tentative) |
| SignerIntro | ✓ | ✓ | ✓ (tentative) |
| ExpiredLinkScreen | ✓ | ✓ | ✓ (tentative) |
| MagicLinkSigningFlow (per-form) | ✓ | ✓ | ✓ (tentative) |

PT marked tentative pending native speaker review (consistent with PRD-25/26 convention).

---

## can_submit Gate Extended

`useDashboardState` now fetches `additional-signers` in the parallel bootstrap and gates `can_submit` on `additionalSignersPendingCount === 0`. This means:

- Dashboard Submit button remains disabled until all non-HOH adults have signed
- `additional_signers_needed` boolean and `additional_signers_pending_count` number are now in `DashboardData`

---

## Open Questions

1. **HOH notification when magic-link recipient completes** — Default: dashboard banner on HOH's next session load (not SMS). Not yet implemented — PRD-30 scope.

2. **Per-form vs. per-ceremony typed name (non-HOH magic-link path)** — Resolved per PRD-27 open question default: typed name captured once per ceremony. Implemented in `MagicLinkFormsSigningInner` (single capture on first form, reused across subsequent forms).

3. **Magic-link signature image capture** — The member-token path does not have its own `signature/capture` endpoint. First form: signature drawn and `data_url` stored as image path. Subsequent forms: same path reused. PRD-28/30 should consider adding a member-scoped capture endpoint that stores the image to Supabase storage and returns a path, consistent with the HOH path.

4. **Magic-link recipient + HOH summary doc** — PRD-27 open question resolved to: yes, recipient can view the summary doc on the forms they're signing. Not explicitly blocked.

5. **SMS sending** — Stubbed. `send-link` endpoint generates and stores token. Actual Twilio integration is PRD scope TBD.

---

## Recommendations for PRD-28 (Summary Doc)

- The magic-link recipient needs a summary-PDF URL; the `/api/pbv-full-app/signer/[member_token]/forms/[id]/preview` pattern is ready to add.
- Consider adding a member-scoped `signature/capture` endpoint to give magic-link recipients the same storage-backed signature path as HOH.

## Recommendations for PRD-30 (E2E)

- Playwright: cover Maria → Carlos same-device handoff; verify `device_owner = 'hoh_device'`
- Playwright: cover Maria → Diego magic-link; verify `device_owner = 'self'`
- Playwright: cover expired magic-link → `ExpiredLinkScreen`
- Playwright: cover name mismatch warning → confirm → continue
- Vitest: `softMatchName` algorithm tests are complete (9 cases)
