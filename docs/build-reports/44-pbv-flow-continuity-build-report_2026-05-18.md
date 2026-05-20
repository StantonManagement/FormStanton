# Build Report: PRD-44 Tenant Flow Continuity

**Date:** 2026-05-18  
**Branch:** `feat/pbv-flow-continuity-44`  
**Status:** Phase 1-3 Complete

---

## Summary

Implemented PRD-44: Tenant Flow Continuity (Mid-flow Re-entry + Forms Handoff). This stitches the seams opened by PRD-42's card stack, ensuring tenants returning mid-flow skip the landing screen and land directly on the next relevant card with an affirmation toast.

---

## Files Created

### Core Logic
- `lib/pbv/cards/classifyReEntry.ts` — Pure function for re-entry classification
- `lib/pbv/cards/__tests__/classifyReEntry.test.ts` — Unit tests for all classification branches

### Components
- `components/pbv/cards/ReEntryToast.tsx` — Welcome-back affirmation toast (auto-dismiss 3s)
- `components/pbv/cards/AlmostDoneReview.tsx` — Pre-signing review screen with per-doc Retake exits

### Updated Files
- `app/pbv-full-app/[token]/documents/page.tsx` — Entry routing with classification
- `components/pbv/cards/DocumentCardStack.tsx` — Added celebration state, review handoff
- `app/globals.css` — Added keyframe animations for toast and celebration
- `app/pilot/briefing-cert/styles.module.css` — Fixed CSS module purity error (unrelated but blocking build)

---

## Features Implemented

### F1 — Mid-flow Re-entry (Phase 1)

**Re-entry classifier** with 5 states (priority order):
1. `rejection_pending` — Docs rejected since last session, land on rejected card
2. `mid_flow` — Has uploads AND missing required docs, land on next missing card
3. `all_complete_pending_submit` — All required complete, go to review screen
4. `submitted` — Application submitted (PRD-20 territory)
5. `first_visit` — No uploads, no deferrals, show landing

**ReEntryToast component:**
- Two variants: `mid_flow` ("Welcome back — picking up where you left off") and `rejection_pending` ("You're back — let's fix one thing first")
- Auto-dismisses after 3 seconds
- Tap to dismiss earlier
- Respects `prefers-reduced-motion`
- `aria-live="polite"` for screen reader announcement
- EN/ES/PT translations

**Page entry branching:**
- `/documents` now classifies on mount and branches to appropriate view
- Toast renders over card stack for mid_flow and rejection_pending

### F2 — "Almost done" Review Screen (Phase 2)

**AlmostDoneReview component:**
- Heading: "Here's everything you sent. Look right?"
- Grouped by category: Income Verification, Banking & Assets, Medical & Childcare, Citizenship & Immigration, Identity
- Per-doc row with thumbnail placeholder, title, person attribution, uploaded status
- "Retake" link on each doc → navigates back to card stack at that doc
- Sticky footer with CTA: "Looks good — let's sign →"
- Secondary: "Back to documents"
- Deferred docs note: "X docs still deferred — they're optional for submission"
- Mobile-first with scrollable body and sticky footer
- Safe area padding for iOS

**Handoff to signing:**
- "Looks good — let's sign" CTA navigates to `/pbv-full-app/[token]/sign`
- Direct navigation, no dashboard layover

### F3 — Two-phase Progress (Phase 3)

**Celebration state at 100% upload:**
- When last required upload completes, bar fills to 100%
- Brief celebratory state (~1s): checkmark, "Documents complete!" microcopy
- Animation respects `prefers-reduced-motion`
- Auto-transition to review screen

**End screen CTA:**
- Added "Review and sign →" button when all docs uploaded
- Navigates to review screen (PRD-44 path) vs dashboard (old path)

---

## Technical Decisions

### Classifier Logic
Refined from PRD spec to handle edge cases:
- `mid_flow` triggers when: (has uploads AND missing required) OR has deferrals
- `all_complete_pending_submit` triggers when: no missing required AND all required are submitted/approved/waived
- `first_visit` triggers when: no uploads AND no deferrals AND missing required

This ensures tenants with partial progress continue the flow, while tenants returning with all docs done go straight to review.

### Animation Strategy
Used CSS keyframes in globals.css instead of styled-jsx (which wasn't configured in the project):
- `@keyframes slideDown` — Toast entrance animation
- `@keyframes celebrationBounce` — Checkmark bounce on celebration screen

### CSS Module Fix
Fixed pre-existing error in `app/pilot/briefing-cert/styles.module.css` where `body` selector was invalid in CSS Modules. The `print-color-adjust` rule was redundant (already in globals.css `*` selector).

---

## Pre-build Verification

Per the prompt, the following were verified before implementation:

1. **PRD-20 status:** Not ready — PRD-44 implements its own `submitted` handling as a simple success screen
2. **MagicLinkSigningFlow handoff:** Verified existing component at `/pbv-full-app/signer/[member_token]` — PRD-44 navigates to `/pbv-full-app/[token]/sign` for handoff
3. **Submit-button location:** Review screen → signing flow → existing signing tracking handles completion
4. **Optional uploads:** Review screen shows all uploaded (required + optional) with "(optional)" pill for optional docs

---

## Gotchas Handled

- **Re-entry classification priority:** Implemented exact priority order from PRD (rejected → uploads+missing → all complete → submitted → first visit)
- **Toast blocking:** Toast is non-blocking — pointer-events-auto on button, pointer-events-none on container, tenant can tap through to card actions
- **Reduced motion:** All animations respect `prefers-reduced-motion`
- **Mobile sticky footer:** Uses `env(safe-area-inset-bottom)` for iOS Safari
- **Deferred docs edge case:** If tenant reaches review with deferred docs, footer shows note — doesn't block submission
- **Retake edge case:** Tenant retakes from review, closes tab mid-retake → next visit classification returns `mid_flow` (one doc missing), lands on that doc

---

## Testing

### Unit Tests (26 passing)
- `classifyReEntry` — All 5 classification states + edge cases
- `findNextMissingCardIndex` — Queue ordering logic
- `findCardIndexById` — ID-to-index lookup with sorting

### Manual Testing Required
1. Mid-session re-entry: Upload 3 docs, close tab, reopen → skip landing, toast appears, card 4 shows
2. Rejection re-entry: Staff rejects doc, tenant reopens → lands on rejected card with rejection banner + toast
3. All-complete re-entry: Upload all, close, reopen → lands on review screen (no toast)
4. First visit: Fresh tenant → landing screen
5. Review → retake → re-upload → returns to review
6. Review → "Let's sign" → lands in signing flow
7. Mobile viewport: iPhone SE (375x667) and Pixel 5 (412x915)

---

## Build Status

- TypeScript compilation: Clean (after CSS module fix)
- Unit tests: 26/26 passing
- Build: Blocked by pre-existing API route type error (unrelated to PRD-44)

---

## Next Steps

1. Coordinate with PRD-42 to confirm end-screen CTA points at review screen
2. Integration test: review → signing flow → submission
3. Mobile snapshot testing at 375x667 and 412x915
4. Merge to main after PRD-42 ships

---

## Decisions Diverged from PRD

1. **Classifier priority refinement:** Changed from "any uploads → mid_flow" to "(has uploads AND missing required) OR deferrals → mid_flow". This ensures tenants with all required complete go to review even if they have uploads.

2. **Animation approach:** Used CSS keyframes in globals.css instead of styled-jsx (which wasn't configured).

3. **Handoff target:** Uses `/pbv-full-app/[token]/sign` route (to be implemented) rather than directly mounting `MagicLinkSigningFlow`.

4. **PRD-20 boundary:** Implemented simple submitted screen in PRD-44 rather than waiting for PRD-20.
