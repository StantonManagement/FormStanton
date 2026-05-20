# Cursor/Windsurf Prompt — PRD-27: Phase 3 Additional-Adults Signing

## Context

Non-HOH adults need to sign certain forms (per_person_scope = each_adult). Two paths: same-device (HOH hands phone over) and magic-link-per-adult (each adult signs on their own device). Identity verification: typed name + signature + IP + timestamp + user agent + device-owner flag.

This pass reuses PRD-26's signing components, wrapped in a SignerScope.

## Required reading before you start

1. `docs/fullApp-Plan/27-pbv-form-execution-phase3-additional-adults_prd_2026-05-15.md` — this PRD
2. `docs/fullApp-Plan/26-pbv-form-execution-phase2-review-and-sign-ui_prd_2026-05-15.md` — the components you're wrapping
3. `docs/build-reports/26-pbv-form-execution-phase2-review-and-sign-build-report_2026-05-15.md` — final shape
4. `docs/fullApp-Plan/24-pbv-form-execution-data-model-and-api_prd_2026-05-15.md` — § additional-signers API
5. `lib/generateToken.ts` — token generation
6. `lib/sendPortalLink.ts` (if it exists) — SMS pattern

## Closed decisions (do not relitigate)

- Two flows: same-device + magic-link-per-adult
- Same-device handoff is a client-state switch — no auth swap
- `device_owner` flag captured per signature event
- Identity verification: typed name + signature + IP + timestamp + user agent (decision-log default)
- Typed name is soft-matched, mismatch warns but doesn't block
- 30-day expiration on magic_link_token
- Reuse PRD-26's FormsStack + FormReviewSignModal under SignerScope
- Twilio is stubbed; integration point left clean

## Decisions still open — pick during build

- **Soft-match algorithm.** Default: lowercase + trim + ignore middle initials + ignore Latin accent marks. Document the exact normalizer.
- **Magic-link expired error UX** — full-screen friendly message + instructions. Compose during build, mark consent text tentative.

## Build this pass

### Commit 1 — Additional-signers panel + same-device

- `AdditionalSignersPanel.tsx`, `AdditionalSignerRow.tsx`
- `HandoffLockScreen.tsx` — "You're handing the phone to Carlos" confirm
- `SignerScopeProvider.tsx` + `useSignerScope.ts` hook
- `SignerIntro.tsx`
- `IdentityCapturePanel.tsx`
- Wire PRD-26 FormsStack and modal under SignerScope
- Route: `[token]/sign/handoff/[member_id]/page.tsx`
- Commit: `feat(pbv-sign): additional-signers panel + same-device handoff`

### Commit 2 — Magic-link-per-adult

- AdditionalSignerRow "Send their own link" handler → calls PRD-24's send-link endpoint
- Member-token routes:
  - `app/pbv-full-app/signer/[member_token]/page.tsx`
  - `app/pbv-full-app/signer/[member_token]/sign/[form_document_id]/page.tsx`
- API routes:
  - `app/api/pbv-full-app/signer/[member_token]/route.ts` GET (bootstrap)
  - `app/api/pbv-full-app/signer/[member_token]/forms/route.ts` GET
  - `app/api/pbv-full-app/signer/[member_token]/sign-form/route.ts` POST
- Expired magic-link friendly error
- Commit: `feat(pbv-sign): magic-link-per-adult flow`

### Commit 3 — Translations + polish

- All new screens in EN/ES/PT
- Soft-match warning text
- Mobile pass
- Commit: `feat(pbv-sign): additional-signer translations`

### Commit 4 — Integration tests

- Maria same-device handoff to Carlos
- Maria magic-link to Diego
- Identity mismatch warning
- Magic-link expired error
- Commit: `test(pbv-sign): additional-signer integration coverage`

## Verification

After each commit:
- Components render
- API calls fire correctly with member context

After all commits:
- All integration tests pass
- `npm run build` clean
- Dashboard reflects state changes from any sign path
- `device_owner` correctly set on each event

## Anti-patterns — do NOT

- Do not require non-HOH adults to be added as full Supabase auth users
- Do not let HOH sign on behalf of any non-HOH adult
- Do not implement Twilio (stub)
- Do not change PRD-24 API shapes
- Do not duplicate signing components — wrap with SignerScope
- Do not store member_token in localStorage
- Do not allow magic-link recipient to edit the application
- Do not skip soft-match name validation

## Build report

`docs/build-reports/27-pbv-form-execution-phase3-additional-adults-build-report_2026-05-15.md`:

1. Components shipped
2. Same-device flow tested
3. Magic-link flow tested
4. Identity verification observations (soft-match accuracy in test)
5. Translation coverage
6. Open questions
7. Recommendations for PRD-28 (summary doc) and PRD-30 (E2E)

## When you're done

- All 4 commits
- Build report committed
- Clean build, all tests pass
- Surface to Alex; wait for sign-off before PRD-28
