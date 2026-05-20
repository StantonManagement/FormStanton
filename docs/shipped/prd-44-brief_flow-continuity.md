# PRD-44 Brief — Tenant Flow Continuity: Mid-flow Re-entry + Forms Handoff

**For:** Cowork session to turn into full PRD
**Date:** 2026-05-17
**Status:** Brief — not a PRD

---

## Problem

PRD-42's card stack opens two new seams that need stitching:

1. **Mid-flow re-entry.** Tenant comes back days later with some docs uploaded, some deferred, some rejected. Today they'd hit the landing screen again or a generic dashboard. Both lose context and waste 3 taps before they're useful.
2. **Forms handoff.** Once all required uploads are done, the tenant still has 12 forms to sign (items 1–13). Current flow likely bounces them through a dashboard. That's a hard transition where tenants drop off.

This is the "make the seams invisible" PRD. Cheap-ish, but without it, PRD-42's wins leak.

---

## In scope

### F1 — Mid-flow re-entry into card stack

- On `/documents` page load, if any required docs are uploaded AND any required docs are still missing:
  - Skip landing screen.
  - Drop tenant directly into the next missing card.
  - Show a small, fading toast: "Welcome back — picking up where you left off." Auto-dismiss after ~3s.
- If a doc was rejected since last visit, that card jumps to front of queue with rejection-reason banner (already in PRD-42 scope, just confirm continuity here).
- If everything required is uploaded but submit hasn't fired → drop into review screen (F2).
- Landing screen only shows on true first visit (no docs uploaded yet).

### F2 — "Almost done" review + forms handoff

- After all required uploads complete, route directly into a brief review screen:
  - "Here's everything you sent. Look right?"
  - Thumbnail list of uploaded docs, grouped by category.
  - "Retake" link per doc (jumps back to that card).
  - "Looks good — let's sign" CTA.
- CTA hands directly into `MagicLinkSigningFlow` — no dashboard layover.
- Single continuous tenant experience from intake → uploads → signatures → submit.

### F3 — "Almost done" state in header / progress

- When only signed forms remain (all uploads done), header copy and progress bar reflect "documents done, X signatures to go" rather than generic completion percentage.
- Progress bar fully fills at upload completion, then resets/recolors for the signing phase.

---

## Dependencies

- **PRD-42** — card stack must exist to re-enter into. Hard blocker.
- **PRD-20** (already-submitted re-entry) — adjacent case. Decide whether to merge during PRD drafting.
- Existing `MagicLinkSigningFlow.tsx` — handoff target.

---

## Out of scope

- Redesigning the signing UX itself. F2 hands off to whatever signing flow exists.
- Staff-side rejection flow improvements.
- Cross-application re-entry (tenant has multiple applications). Defer.

---

## Open questions for Cowork to verify

1. **Merge with PRD-20?** PRD-20 handles already-submitted re-entry. PRD-44 handles partially-complete re-entry. Same render conditional, different content. Recommend Cowork checks scope overlap and either merges or runs them sequentially with shared infrastructure.
2. **Review screen — necessary or skippable?** Tenants who upload one doc and immediately want to sign may find the review screen frictionful. Counter-argument: it's confidence-building and gives a Retake exit. Recommend keeping but allow "Skip review" link for confident users (tracked via analytics from PRD-42).
3. **[Unverified]** What does the current handoff to signing look like today — explicit submit button? Auto-route? Cowork reads `TenantDashboard.tsx` and `MagicLinkSigningFlow.tsx` before scoping the change.
4. **Progress bar transition** — visual: does the bar reset to 0% for signing phase, or stay at 100% with a second bar below? Visual mock needed during PRD drafting.
