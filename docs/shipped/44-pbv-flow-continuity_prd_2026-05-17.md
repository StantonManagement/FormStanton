# PRD-44 — Tenant Flow Continuity: Mid-flow Re-entry + Forms Handoff

**Date:** 2026-05-17
**Author:** Claude (from `prd-44-brief_flow-continuity.md`)
**Branch:** `feat/pbv-flow-continuity-44`
**Status:** Draft — ships **after** PRD-42. Stitches the seams PRD-42 opens. Coordinates with PRD-20 (already-submitted re-entry).
**Source brief:** `local:uploads/prd-44-brief_flow-continuity.md`

---

## Problem Statement

PRD-42's card stack opens two seams that need stitching, or PRD-42's wins leak:

1. **Mid-flow re-entry.** Tenant comes back days later with some docs uploaded, some deferred, some rejected. Without intervention, they hit the landing screen again or a generic dashboard. Both lose context and waste 3 taps before they're useful. Worse, the "Welcome back" affirmation is missing — the page treats them like a first-timer.

2. **Forms handoff.** Once all required uploads are done, the tenant still has ~12 forms to sign (items 1–13 in the application). Today the flow bounces them through a dashboard. That's a hard transition where tenants drop off. Card stack just earned the tenant's momentum — the handoff should preserve it, not break it.

This is the "make the seams invisible" PRD. Cheap-ish relative to PRD-42, but without it PRD-42's bet on linearization leaks back to the friction it replaced.

---

## Users & Roles

- **Tenants returning to /documents mid-flow** — primary beneficiary. Card stack picks up where they left off without ceremony.
- **Tenants who finish uploads** — primary beneficiary. Continuous experience from uploads → signing without a dashboard interruption.
- **Stanton staff** — secondary. Fewer "I uploaded everything but the page sent me to a dashboard, am I done?" support calls.
- **No admin UI changes in this PRD.**

---

## Closed decisions

- **Landing screen shows only on true first visit.** Zero docs uploaded AND zero deferred AND no docs rejected since last session. Any other state → skip landing.
- **"Picking up where you left off" toast is brief and dismissible.** ~3s auto-dismiss. Doesn't block the card it appears over.
- **The review screen is mandatory between uploads done and signing.** Not skippable in v1. Confidence-building, gives Retake exits, signals "almost done" momentum. May add a "Skip review" link in v2 once we have analytics on whether tenants want it.
- **The handoff is direct.** From review screen, the "Looks good — let's sign" CTA navigates straight into the existing `MagicLinkSigningFlow` component. No dashboard layover.
- **Progress bar transitions at upload completion.** Bar fills to 100% on the last upload, holds for a beat (e.g., 1s of celebration), then resets to a NEW progress bar for the signing phase. Two distinct phases, two distinct bars.
- **Rejection re-entry is owned by PRD-42 F10.** PRD-44 just confirms continuity — when a tenant returns with rejected docs, they land on the rejected card via PRD-42's logic, and the re-entry toast adapts ("You're back — let's fix one thing first").
- **PRD-20 coordination:** PRD-20 owns the "already submitted" re-entry path; PRD-44 owns "partially complete" re-entry. Same render entry point, different content. Recommend merging or shared infrastructure decided during build.

---

## Decisions resolved

### Review screen is mandatory in v1

**Decision:** Every tenant transitions through the review screen between uploads-complete and signing.

**Rationale:** Tenant confidence is the headline win. Forcing a moment to see "here's what I sent" before signing reduces "did I upload the right thing?" anxiety. A v2 "skip review" link is feasible once we have data on tenants who'd benefit, but ship with mandatory first.

### Progress bar resets between phases

**Decision:** Upload progress bar fills to 100% on last upload, holds briefly with a celebratory state, then resets to a new bar for signing.

**Rationale:** One bar across both phases lies — a tenant who just uploaded 13 docs and now has 12 signatures has not done "almost everything." Two bars are honest about phase shifts and give a fresh sense of progress at signing.

### PRD-20 merge decision deferred to build

**Decision:** PRD-44 implements partial re-entry. Cowork verifies during build whether PRD-20's already-submitted logic is far enough along to share a render entrypoint. If yes, merge. If no, ship PRD-44 with its own entrypoint and PRD-20 consolidates later.

**Rationale:** Don't block PRD-44 on PRD-20 status. Build the smaller pattern first, refactor if PRD-20 is ready when this lands.

---

## Core Features

### F1 — Mid-flow re-entry into card stack

**Goal:** Tenant returning to `/documents` skips the landing screen and lands on the next missing card with a brief affirmation toast.

**Files (verify):**
- Modify: `app/pbv-full-app/[token]/documents/page.tsx` — entry routing logic
- Modify: `components/pbv/cards/DocumentCardStack.tsx` (PRD-42) — accept an `initialCardIndex` or `skipLanding` prop
- New: `components/pbv/cards/ReEntryToast.tsx` — the welcome-back affirmation

**Re-entry classification (priority order — first match wins):**

1. **Rejected docs since last session present** → land on rejected card (via PRD-42 F10), show toast: "You're back — let's fix one thing first."
2. **Any uploads OR deferrals present, application not yet submitted** → land on next missing card, show toast: "Welcome back — picking up where you left off."
3. **All required complete, submit not yet fired** → route directly to review screen (F2).
4. **Application submitted** → PRD-20 territory (already-submitted re-entry).
5. **Otherwise (true first visit)** → landing screen (PRD-42 F1).

**Implementation:**
- On page load, fetch application state (uploads count, deferrals count, rejection flags, submit status).
- Branch per the table above.
- ReEntryToast renders at top of the card-stack viewport, auto-dismisses after ~3s, can be tapped to dismiss earlier.
- Toast does NOT block the card — tenant can immediately tap Take Photo / Upload File underneath.

**Acceptance:**
- Maria uploads 3 docs in session 1, closes tab.
- Session 2: opens link. Skips landing. Lands on next missing card (#4). Toast appears: "Welcome back — picking up where you left off." Dismisses after 3s.
- Staff rejects Maria's paystub between sessions. Session 3: opens link. Lands on paystub card with rejection banner. Toast: "You're back — let's fix one thing first."
- Maria with all required uploaded, never submitted, returns. Lands on review screen (F2). No toast.
- Maria with submitted application returns. PRD-20 logic kicks in.
- Maria with zero uploads + zero deferrals returns (e.g., abandoned right after intake). Lands on landing screen as if first visit. No toast.

### F2 — "Almost done" review screen

**Goal:** After last required upload, tenant sees a tight review of everything they sent, with per-doc Retake exits, before transitioning to signing.

**Files:**
- New: `components/pbv/cards/AlmostDoneReview.tsx`
- Modify: `components/pbv/cards/DocumentCardStack.tsx` — wire end-of-stack transition to review instead of end screen for "all complete" case

**Review screen layout:**
- Heading: "Here's everything you sent. Look right?"
- Body: thumbnail grid OR list of uploaded docs, grouped by category from PRD-40 trigger config.
- Per-doc row:
  - Thumbnail (first page)
  - Doc title (plain language from `docContent.ts`)
  - "Retake" link — navigates back to the card for that doc, re-renders in retake mode.
- Sticky footer:
  - Primary CTA: "Looks good — let's sign →"
  - Secondary link: "Back to documents" — returns to card stack (e.g., sidesheet view)
- Mobile-first. Scrollable if doc count exceeds one viewport. Sticky footer always visible.

**Behavior:**
- "Looks good — let's sign" navigates to `MagicLinkSigningFlow` (handoff target — confirm path during build).
- "Retake" navigates to that card in the card stack with a state flag `mode: 'retake'`. After successful re-upload, return to review screen automatically.

**Acceptance:**
- Upload last required doc. Auto-advance into review screen.
- See all uploaded docs grouped by category. Each has a Retake link.
- Tap Retake on paystubs. Card stack opens to paystub card in retake mode. Re-upload. Return to review screen.
- Tap "Looks good — let's sign". Navigation lands inside MagicLinkSigningFlow.

### F3 — Two-phase progress: upload bar → signing bar

**Goal:** Progress feedback honestly reflects which phase the tenant is in.

**Files:**
- Modify: `components/pbv/cards/DocumentCardStack.tsx` — upload phase progress bar (already exists per PRD-42)
- Modify: `components/pbv/cards/AlmostDoneReview.tsx` — render full-bar celebratory state, transition to next phase
- Modify: `MagicLinkSigningFlow` (or its container) — render a new progress bar for signing phase. Read signing state from existing signing flow.

**Visual sequence:**
1. Tenant is uploading. Progress bar shows "X of Y docs."
2. Last upload completes. Bar fills to 100%. Brief celebratory state (~1s). Could be a subtle animation, color shift, checkmark.
3. Transition to review screen. Progress bar still 100% for upload phase. Below or adjacent: a NEW bar starting at 0% for signing phase ("X of Y signatures").
4. Tenant signs. Signing bar fills as signing progresses.
5. Both bars full → submission state.

**Implementation:**
- Two separate progress bar components or one component with two modes. Choice during build.
- Source of truth for signing progress: whatever `MagicLinkSigningFlow` already tracks. Don't duplicate state.

**Acceptance:**
- Upload last doc. Bar fills. Brief celebration. Review screen has the full bar.
- Tap "Looks good — let's sign". Signing flow loads with a fresh 0% bar for signatures.
- Sign one form. Signing bar increments. Upload bar still 100%.

---

## Out of scope

- Redesigning the signing UX itself. F2 hands off to whatever signing flow exists today. The signing-card pattern is a separate future PRD.
- Staff-side rejection workflow improvements.
- Cross-application re-entry (tenant has multiple applications).
- "Skip review" link on the review screen — deferred to v2 once analytics show whether tenants want it.
- Reminder cadence changes — PRD-43 owns reminders.
- Animations beyond reduced-motion-friendly defaults.

---

## Open questions for Cowork to verify before build

1. **PRD-20 status.** Is it ready, in flight, or paper? Decision: merge re-entry entry points OR ship PRD-44 standalone. Confirm before building F1.
2. **`MagicLinkSigningFlow` handoff target.** What is the canonical entrypoint? URL or component-mount? Some pre-conditions (existing tokens, signing-readiness gating per `signatures_complete` / etc.)? Read `components/pbv/sign/` directory before building F2's CTA target.
3. **Review screen scope: required docs only, or all uploaded?** Brief implies all uploaded (including any optional docs the tenant chose to send). Confirm — if review shows ONLY required, optional uploads are invisible at review, which is honest but may confuse tenants who uploaded extras.
4. **Progress bar visual treatment.** Single bar reset vs. two bars stacked. Mock during PRD-44 review with Alex. Recommend two stacked bars for v1 honesty.
5. **Toast accessibility.** ReEntryToast should be screen-reader-announceable. Confirm `aria-live` choice (polite vs. assertive).
6. **What happens if tenant defers a doc during F1 re-entry classification?** A returning tenant with all uploads complete + some deferred docs lands on the review screen per the F1 table. But the review screen only shows uploaded — does it warn about deferred ones? Recommend: yes, with a small "X docs still deferred — they're optional" footer if any deferred remain. Discuss with Alex.
7. **Submit fires from where?** Review screen → signing → submission. Is "submit application" its own step after all signatures, or does the last signature trigger submission? Read existing flow.

---

## Acceptance summary (end-to-end test)

Use chrome-devtools-mcp:

1. **Mid-session re-entry (uploads + deferrals).** Maria uploads 3 docs, defers 2, closes tab. Reopens link. Skips landing. Lands on card 6 (next missing). Toast appears: "Welcome back — picking up where you left off." Dismisses after 3s. Card 6 is functional underneath.

2. **Rejection re-entry.** Staff rejects card 2 between sessions. Maria reopens. Lands on card 2 with rejection banner. Toast: "You're back — let's fix one thing first." Re-upload returns to flow.

3. **All-complete re-entry (no submit yet).** Maria uploaded everything, closed before signing. Reopens. Lands directly on review screen. No toast.

4. **Submitted re-entry.** Maria submitted. PRD-20 logic kicks in (verified separately).

5. **First-visit re-entry.** Maria has zero state (test by creating fresh tenant). Reopens. Landing screen shows.

6. **Review screen — all docs visible.** Open review after last upload. See all uploaded docs grouped by category. Retake link on each.

7. **Retake from review.** Tap Retake on a doc. Navigate to that card in retake mode. Re-upload. Auto-return to review screen.

8. **Handoff to signing.** Tap "Looks good — let's sign". Navigation lands in `MagicLinkSigningFlow`. No dashboard layover.

9. **Two-phase progress.** Upload progress bar fills to 100% on last upload. Brief celebration state. Review screen shows the full bar. Signing flow has a fresh 0% bar.

10. **Sign one form.** Signing bar increments. Upload bar still 100%.

11. **Mobile viewport throughout.** No horizontal scroll. Toast doesn't block underlying card. Review screen scrolls cleanly. Sticky CTA always visible.

All 11 pass → PRD-44 ships.

---

## Carved out

- PRD-20 already-submitted re-entry — coordinate, don't subsume.
- Signing UX redesign — separate future PRD if appropriate.
- Cross-application support.
- Submit-button placement and behavior — read existing flow, don't redesign.

---

## Build prompt

Paired implementation prompt: `docs/fullApp-Plan/prompts/44-pbv-flow-continuity_prompt_2026-05-17.md`
