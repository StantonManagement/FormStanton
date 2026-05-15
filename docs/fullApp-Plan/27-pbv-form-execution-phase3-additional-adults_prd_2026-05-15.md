# PRD-27 — PBV Form Execution: Phase 3 Additional-Adults Signing

**Date:** 2026-05-15
**Branch:** `feature/pbv-form-execution`
**Reads with:** `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md`
**Depends on:** PRD-24 (API) + PRD-26 (signing UI) complete

---

## Problem Statement

Several federal forms require signatures from every adult in the household (per inventory `per_person_scope = each_adult`): Citizenship Declaration (in scope, per-row), Obligations of Family (multi-signer block), HUD-9886A, HACH release, EIV guide receipt, criminal background release, debts owed PHAs, HUD-92006. The HOH cannot sign on behalf of other adults — each must sign for themselves.

Two flows must work:

1. **Same-device** — HOH hands their phone to the next adult at the kitchen table. Default for in-house households.
2. **Magic-link-per-adult** — each non-HOH adult gets their own SMS link to sign on their own device. For dispersed households.

Identity verification per non-HOH signer: typed full name + drawn signature + IP + timestamp + user agent + `device_owner` flag (`self` vs `hoh_device`).

## Tenant journey

```
HOH lands on dashboard after their signing complete
  ↓
"Other adults need to sign" card shows: 2 of 2 adults still need to sign
  ↓
Tap card → "Additional signers" screen
  ↓
Per non-HOH adult: row with status + 2 action buttons:
  [Sign on this phone now]  [Send them their own link]
  ↓
PATH A — Same-device:
  HOH taps "Sign on this phone now" for Carlos
  ↓
  Screen handoff: "Please hand the phone to Carlos."
  ↓
  Carlos's screen (locked to his subset of forms):
    - Short Portuguese/Spanish/English intro: "You are signing as an adult household member of Maria's PBV application."
    - Carlos types his full name (required, must match member record within reasonable normalization)
    - Carlos reviews each form, taps per-form to sign (same hybrid as PRD-26)
    - One signature image captured for Carlos; reused across his forms
  ↓
  Back to additional-signers screen. 1 of 2 remaining.
  ↓
  Repeat for Diego.
  ↓
PATH B — Magic-link-per-adult:
  HOH taps "Send them their own link" for Carlos
  ↓
  Carlos's phone receives an SMS with his personal magic_link_token
  ↓
  Carlos taps link → opens to a tenant-token gated by his member_id
  ↓
  Same review-and-sign UX, scoped to his forms
  ↓
  HOH sees Carlos's row update to "Signed" once Carlos completes
  ↓
Dashboard updates: "Other adults need to sign" card complete when all required adults have signed all their required forms.
```

## Key decisions

### 1. Reuse PRD-26's signing machinery

The forms-stack + per-form-sign-modal + signature-pad-gate components from PRD-26 work for non-HOH adults too. Wrap them in a `SignerScope` provider that limits the form list to forms where the active signer is in `required_signer_member_ids`.

### 2. Same-device handoff = client-side state switch

No new auth, no session swap. The HOH is the authenticated identity at the token level; the active signer is a client state. The `sign-form` API takes `signer_member_id` explicitly, so the API records who signed.

Audit safeguards:
- `device_owner = 'hoh_device'` on every signature event where active signer ≠ HOH
- HOH session must explicitly initiate the handoff (tap "Sign on this phone now")
- Typed name on each form must match the member record (case-insensitive trim, allow middle-initial drop)
- IP + user agent + ceremony_id captured (will match HOH's if same session)

### 3. Magic-link-per-adult uses a per-member token

`pbv_household_members.magic_link_token` (added in PRD-24). When HOH taps "Send them their own link":

- API generates token (`lib/generateToken.ts`), sets `magic_link_expires_at = now() + 30 days`
- Sends SMS via Twilio (stub for now; integration point clean per existing convention)
- HOH dashboard updates to show "Link sent" + timestamp

When the recipient taps the SMS link:
- A new tenant-facing route `/pbv-full-app/signer/[member_token]/...` handles auth via the member token
- Drops the recipient straight into their scoped forms-stack + sign flow
- `device_owner = 'self'` on their signature events

### 4. Identity verification standard

The decision-log default applies: typed full name + signature + IP + timestamp + user agent + device-owner flag. No phone OTP, no photo ID. Adjust later if HACH/Dan want stronger.

Typed name validation:
- Required field, min 2 chars, must include first + last name
- Soft-match against `pbv_household_members.name` (case-insensitive, accent-normalized)
- Mismatch → warning prompt: "This name doesn't match our records (Carlos Garcia-Rodriguez). Continue?" + [Use my typed name] [Edit]
- Final value stored in `pbv_signature_events.typed_name`

### 5. Signing-status transitions

The application's `signing_status` reaches `complete` only when:
- Summary signed
- All `pbv_form_documents` where the HOH is a required signer have HOH's signature event
- All `pbv_form_documents` where additional adults are required signers have those signatures

Server-side check in the existing finalize endpoint (extended in PRD-24).

### 6. UX rules for additional signers

- Cannot see HOH's intake answers as raw data (avoid privacy issues if the spouse hasn't seen full income detail)
- Can review the actual stamped PDFs (their data is on them, can't hide that)
- Cannot edit the application; only sign
- Can see what they're being asked to sign with a Portuguese/Spanish/English intro

### 7. Same-device "lock screen" before handoff

When HOH initiates same-device handoff: a confirmation screen "You're handing the phone to Carlos. He'll sign on his own behalf." → tap "Hand to Carlos" → screen wipes HOH's context, shows Carlos's intro. No way to back-button to HOH's dashboard without restarting (prevents accidental over-signing).

To return to HOH dashboard: Carlos completes (or cancels), then taps "Back to Maria" / "Cancel". Cancellation just returns without saving anything.

## Scope

### What this PRD does

- Additional-signers screen with per-adult rows
- Same-device handoff flow
- Magic-link-per-adult flow (generation, SMS stub, recipient route)
- Per-adult scoped sign experience (reusing PRD-26 components)
- Member token route + auth
- Identity verification (typed name + soft-match)
- Three languages

### What this PRD does NOT do

- Does not modify the API surface (PRD-24)
- Does not implement HOH signing (PRD-26)
- Does not implement Twilio sending (stub the SMS, use Resend if available)
- Does not implement staff-assisted mode (PRD-29)
- Does not author summary doc content (PRD-28)

## Affected files

### New routes
- `app/pbv-full-app/[token]/sign/additional-signers/page.tsx`
- `app/pbv-full-app/[token]/sign/handoff/[member_id]/page.tsx` — same-device flow per adult
- `app/pbv-full-app/signer/[member_token]/page.tsx` — magic-link-per-adult entry
- `app/pbv-full-app/signer/[member_token]/sign/[form_document_id]/page.tsx`

### New components
- `components/pbv/sign/AdditionalSignersPanel.tsx`
- `components/pbv/sign/AdditionalSignerRow.tsx`
- `components/pbv/sign/HandoffLockScreen.tsx`
- `components/pbv/sign/SignerScopeProvider.tsx` (context provider for active signer)
- `components/pbv/sign/SignerIntro.tsx` (the "You are signing as..." panel)
- `components/pbv/sign/IdentityCapturePanel.tsx` (typed name + soft-match warning)

### New hooks
- `lib/pbv/hooks/useAdditionalSigners.ts`
- `lib/pbv/hooks/useSignerScope.ts`

### New API routes
- (Most exist from PRD-24.) Adds: `/api/pbv-full-app/signer/[member_token]/route.ts` GET — bootstrap for the magic-link-per-adult entry
- `/api/pbv-full-app/signer/[member_token]/forms/route.ts` GET — list of forms this member needs to sign
- `/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` POST — analog of PRD-24's sign-form, scoped to member

(These routes exist outside the `/api/t/[token]` prefix because the auth is via member_token, not the application token.)

### Modified
- `lib/pbvFullAppTranslations.ts` — additional signer copy in 3 langs
- `app/pbv-full-app/[token]/dashboard/page.tsx` — additional-signers card now actionable

### Tests
- Component tests
- Hook tests
- Integration test: HOH initiates same-device flow for Carlos, Carlos signs his 4 forms, Carlos's row updates
- Integration test: HOH sends link to Diego, Diego enters via magic link, signs his forms, dashboard updates

## Phases

### Phase 1 — Additional-signers panel + same-device handoff

- AdditionalSignersPanel + AdditionalSignerRow
- HandoffLockScreen
- SignerScopeProvider + useSignerScope hook
- Wire to PRD-26's FormsStack + FormReviewSignModal under the SignerScope
- IdentityCapturePanel for typed name capture
- Commit: `feat(pbv-sign): additional-signers panel + same-device handoff`

### Phase 2 — Magic-link-per-adult send + recipient flow

- "Send them their own link" handler in AdditionalSignerRow
- Backend send-link call (PRD-24 endpoint)
- Recipient route `/pbv-full-app/signer/[member_token]`
- Member-scoped bootstrap endpoint
- Member-scoped sign-form endpoint
- SignerIntro for the magic-link recipient
- Commit: `feat(pbv-sign): magic-link-per-adult flow`

### Phase 3 — Translations + polish

- Three-language copy for all new screens
- Soft-match name validation in 3 langs
- Mobile UX pass
- Commit: `feat(pbv-sign): additional-signer translations + polish`

### Phase 4 — Integration tests

- Same-device Maria → Carlos handoff happy path
- Magic-link Maria → Diego happy path
- Identity mismatch warning path
- Commit: `test(pbv-sign): additional-signer integration coverage`

### Phase 5 — Build report

`docs/build-reports/27-pbv-form-execution-phase3-additional-adults-build-report_2026-05-15.md`.

## Out of scope

- Twilio integration (stub)
- Staff-assisted mode (PRD-29)
- Photo-ID or OTP identity verification (decision log default holds)
- Form set computation (PRD-24)

## Acceptance criteria

- HOH can same-device-handoff each non-HOH adult; each adult signs their forms; dashboard reflects completion
- HOH can send magic links to non-HOH adults; recipients can sign via their links; dashboard reflects completion
- `device_owner` flag is correctly set on every `pbv_signature_events` row
- Typed name soft-match warns on mismatch; does not block
- Magic link expires 30 days after generation; expired link → friendly error screen + "Ask your household for a new link" instructions
- Recipient cannot edit application; cannot see other adults' data unless on the actual stamped PDFs they're signing
- Three languages live for all copy
- Tests pass; `npm run build` clean

## Open questions

- Whether HOH should be notified (SMS or dashboard banner) when a non-HOH adult completes via magic link. Default: dashboard banner on next HOH session; no SMS to avoid notification spam.
- Whether a non-HOH adult should re-enter typed name per form or once per ceremony. Default: once per ceremony (matches HOH UX).
- Whether to allow a non-HOH adult on magic link to view the HOH's summary doc. Default: yes — the same summary doc is the consent artifact for the whole household.
