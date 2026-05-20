# Prompt — PRD-44: Tenant Flow Continuity (Mid-flow Re-entry + Forms Handoff)

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/44-pbv-flow-continuity_prd_2026-05-17.md`
**Target branch:** `feat/pbv-flow-continuity-44`

---

## Status: ready to build after PRD-42 ships

PRD-44 stitches the seams PRD-42 opens. It depends on:
- **PRD-42** — card stack must exist to re-enter into. Hard blocker.
- **PRD-20** — handles already-submitted re-entry. Coordinate during build (merge entrypoints if PRD-20 is ready; ship standalone if not).
- Existing `MagicLinkSigningFlow` component — handoff target for F2.

If PRD-44 builds in parallel with PRD-42's later phases, that's fine — just confirm the integration points are solid before merging.

---

## Read first

1. The PRD: `docs/fullApp-Plan/44-pbv-flow-continuity_prd_2026-05-17.md`
2. The brief: `local:uploads/prd-44-brief_flow-continuity.md`
3. PRD-42 (the card stack we're stitching): `docs/fullApp-Plan/42-pbv-tenant-document-card-stack_prd_2026-05-17.md`
4. PRD-20 status (whatever exists today — confirm with Alex)
5. The signing flow: `components/pbv/sign/MagicLinkSigningFlow.tsx` (or whatever it's actually named — verify)
6. The dashboard the current flow bounces tenants through: `components/pbv/sign/TenantDashboard.tsx`
7. The tenant audit (mentions silent redirects, dashboard handoff issues): `tasks/TENANT_JOURNEY_2026-05-17.md`

---

## Before you touch code — four verifications

1. **PRD-20 status.** Ask Alex: is PRD-20 (already-submitted re-entry) ready, in flight, or paper? Two paths:
   - Ready → merge re-entry classification with PRD-20's entrypoint. One render path for "first visit / mid-flow / all complete / submitted / rejected."
   - Not ready → ship PRD-44 standalone. PRD-20 consolidates later.

2. **`MagicLinkSigningFlow` handoff target.** Read the existing signing flow's entry path. Is it a route URL (`/sign/forms`), a component mount, or both? What are the pre-conditions (e.g., `signatures_complete: false` AND `intake_status: 'complete'`)? F2's CTA navigates here — needs to be precise.

3. **Submit-button location.** Where does "submit application" actually fire today? Is it the last signature, an explicit button on the dashboard, or another step? F3 progress bar logic depends on knowing what "done with signing" means.

4. **Optional uploads on review screen.** PRD-44 brief says review shows all uploaded. Confirm with Alex: should review-screen include optional uploads (e.g., the Insurance Settlement letter the tenant chose to send) or only required? Affects scope of the review screen render.

Report findings before starting Phase 1.

---

## What you're building

3 features. Estimated 3-5 days. F1 is the largest piece (re-entry classification + toast). F2 is medium (review screen). F3 is small (progress bar phasing).

---

## Order of operations

**Phase 1 → 2 → 3 in order.** Each phase ships independently as a working commit.

---

## Phase 1 — F1 Mid-flow re-entry

### Step 1 — Re-entry classifier

**Files:**
- Modify: `app/pbv-full-app/[token]/documents/page.tsx` — entry routing logic
- New: `lib/pbv/cards/classifyReEntry.ts` — pure function returning a classification

**Classifier shape:**
```ts
export type ReEntryState =
  | { kind: 'first_visit' }
  | { kind: 'mid_flow' }
  | { kind: 'rejection_pending'; rejectedDocId: string }
  | { kind: 'all_complete_pending_submit' }
  | { kind: 'submitted' };

export function classifyReEntry(state: ApplicationState): ReEntryState;
```

**Priority order (first match wins, per the PRD's classification table):**
1. Any docs with `status='rejected'` since last session → `rejection_pending`
2. Any uploads OR deferrals present AND application not submitted → `mid_flow`
3. All required complete + submit not fired → `all_complete_pending_submit`
4. Application submitted → `submitted` (PRD-20)
5. Otherwise → `first_visit`

**Implementation:**
- Pure function. Easy to unit test.
- Reads `application_documents` status counts, application's submit timestamp, last-session metadata if available (e.g., a `last_visited_at` column or `application_events` query).

**Verify:** Unit-test each branch with mock state. No actual page rendering yet.

### Step 2 — Page entry branch logic

**Files:**
- `app/pbv-full-app/[token]/documents/page.tsx` — call classifier, branch render
- If PRD-20 is ready: merge with PRD-20's entrypoint (one component handles all kinds)
- Otherwise: PRD-44's documents page handles all but `submitted`; submitted falls through to existing PRD-20-or-equivalent path

**Implementation:**
- On mount, call classifier with fetched application state.
- Branch:
  - `first_visit` → render landing screen (PRD-42 F1)
  - `mid_flow` → mount `DocumentCardStack` with `initialCardIndex` set to next missing card
  - `rejection_pending` → mount `DocumentCardStack` with `initialCardIndex` set to the rejected card; mount banner via PRD-42 F10
  - `all_complete_pending_submit` → mount review screen (F2 in this PRD)
  - `submitted` → existing PRD-20 path
- Render the ReEntryToast (Step 3) over the card stack for `mid_flow` and `rejection_pending`.

**Verify:**
- Maria with 3 uploads, 2 deferrals, no rejections, not submitted → lands on card 6.
- Maria with same state + 1 rejected since last session → lands on rejected card.
- Maria with all required complete, not submitted → lands on review screen.
- Maria with 0 state → lands on landing screen.

### Step 3 — ReEntryToast component

**Files:**
- New: `components/pbv/cards/ReEntryToast.tsx`

**Implementation:**
- Renders at top of viewport over card stack.
- Auto-dismisses after 3 seconds.
- Tap to dismiss earlier.
- Two copy variants:
  - `mid_flow`: "Welcome back — picking up where you left off."
  - `rejection_pending`: "You're back — let's fix one thing first."
- `aria-live="polite"` for screen reader announcement.
- Respects `prefers-reduced-motion` (no slide-in animation if reduced).
- EN/ES/PT per `preferred_language`.

**Verify:**
- Toast renders, auto-dismisses after 3s, tap dismisses earlier.
- Doesn't block the card underneath (tenant can tap Take Photo through it if needed).
- Screen reader announces "Welcome back" on mount.

**Phase 1 acceptance + check-in.** Walk all 5 classification branches in browser. Show Alex.

---

## Phase 2 — F2 Review screen

### Step 4 — AlmostDoneReview component

**Files:**
- New: `components/pbv/cards/AlmostDoneReview.tsx`

**Layout:**
- Heading: "Here's everything you sent. Look right?"
- Body: list of uploaded docs, grouped by category from PRD-40 trigger config:
  - Income Verification
  - Banking & Assets
  - Medical & Childcare
  - Citizenship & Immigration
  - Identity (if applicable)
  - (Signed Forms are NOT shown here — they're rendered after handoff)
- Per-doc row:
  - Thumbnail (first page rendered via pdf-lib or generic file icon)
  - Doc title (plain language from PRD-42's `docContent.ts`)
  - "Retake" link
- Sticky footer:
  - Primary CTA: "Looks good — let's sign →"
  - Secondary link: "Back to documents" (returns to card stack sidesheet view OR last card)
- Mobile-first. Scrollable body if doc count > one viewport. Sticky footer always visible.

**Optional uploads:**
- Per pre-build verification 4, render optional uploads if Alex confirmed. Render in their categories with a small "(optional)" pill.

**Deferred docs note:**
- If any docs remain deferred when reaching this screen, render a small footer above the CTA: "{{count}} docs still deferred — they're optional for submission. Tap to review." (Coordinate with PRD-43 on whether deferred docs block submission or are truly optional at this stage.)

**Implementation:**
- Thumbnail rendering: pdf-lib renders first page to a small canvas → dataURL. Cache per-doc; don't re-render on every mount. If pdf-lib is too heavy on mobile, ship with generic file icons in v1.
- Retake link: navigates to `DocumentCardStack` with `initialCardIndex` set to that doc AND `mode: 'retake'` flag. After successful re-upload, navigate back to review (use router push/back or a state-machine signal).

**Verify:**
- Reach review screen after last upload. All required uploads visible, grouped by category.
- Each has a Retake link. Tap → card stack opens to that doc in retake mode.
- Re-upload → returns to review screen.
- Sticky footer visible throughout scroll.
- On Pixel 5 viewport, render is clean. On iPhone SE viewport, render is clean.

### Step 5 — Handoff to signing

**Files:**
- `AlmostDoneReview.tsx` — wire CTA to `MagicLinkSigningFlow`

**Implementation:**
- "Looks good — let's sign →" CTA target depends on pre-build verification 2. Most likely a route navigation to `/sign/forms` or `/sign/summary`. Confirm and wire.
- No intermediate dashboard layover. The CTA goes directly.
- If the signing flow requires a precondition that isn't met (e.g., summary not yet signed), the navigation should land on the correct first signing step, NOT bounce back to the dashboard.

**Verify:**
- Tap CTA. Navigation lands inside the signing flow (not the dashboard).
- Pre-conditions met → first signing step shows.
- Pre-condition gap → land on whichever signing step IS the first valid one (e.g., summary signing first, then forms).

**Phase 2 acceptance + check-in.**

---

## Phase 3 — F3 Two-phase progress

### Step 6 — Upload bar celebratory state

**Files:**
- Modify: `components/pbv/cards/DocumentCardStack.tsx` (PRD-42 owns the upload bar) — add a brief celebratory state when bar reaches 100%

**Implementation:**
- When last required upload completes, bar fills to 100% over ~500ms animation (respecting reduced-motion).
- Hold at 100% with a subtle celebratory visual cue: checkmark, slight color shift to green, brief "Documents complete!" microcopy.
- Hold for ~1s, then transition to review screen.

**Verify:**
- Complete last upload. Bar animates to 100%. Celebration state visible. Auto-transition to review after 1s.

### Step 7 — Signing bar in review and signing flow

**Files:**
- Modify: `AlmostDoneReview.tsx` — render upload bar at 100% (read-only) and a new signing bar at 0%
- Modify: `MagicLinkSigningFlow` (or its container) — render the signing bar, read state from existing signing tracking

**Implementation:**
- Two distinct bars OR one bar with two visible segments. Choice during build. Stacked vertically is the recommendation for mobile (no horizontal squish).
- Upload bar: 100% filled, labeled "Documents — done"
- Signing bar: 0% on review screen, fills as signing progresses in subsequent screens. Labeled "Signatures — X of Y"
- Source of truth for signing progress: whatever the existing signing flow tracks. Don't duplicate state.

**Verify:**
- Review screen: upload bar 100%, signing bar 0%.
- Sign one form. Signing bar increments. Upload bar still 100%.
- Sign all. Both bars 100%.

**Phase 3 acceptance + check-in.**

---

## What to deliver

- Branch `feat/pbv-flow-continuity-44`
- 3 phase commits
- Unit tests for `classifyReEntry` (every branch + edge cases)
- Integration test for review screen → retake → re-upload → return to review
- Mobile snapshot tests for: review screen at 375x667 and 412x915
- Build report at `docs/build-reports/44-pbv-flow-continuity-build-report_<ship-date>.md` covering:
  - Pre-build verification answers (especially PRD-20 merge decision)
  - Phase-by-phase changes
  - Decisions diverged from PRD with rationale
  - Signing handoff path as actually verified (which route, which preconditions)
  - Whether thumbnails were rendered via pdf-lib or generic icons
- PRD-44 status updated from "Draft" to "Shipped"
- Coordinate with PRD-42 to confirm the end-screen CTA points at the right destination (review screen, not dashboard, post-PRD-44)

---

## Gotchas

- **Re-entry classification is the load-bearing logic.** Get the priority order right or tenants land in the wrong place. Write the unit tests FIRST.
- **Toast must not block the card.** It's an affirmation, not a modal. Test with the card's primary action reachable through the toast.
- **`prefers-reduced-motion` everywhere.** Toast animation, bar transitions, celebratory state — all respect the preference.
- **Don't reimplement signing tracking.** F3 reads signing state from wherever the existing flow stores it. If it's not exposed, expose it via a hook — but don't duplicate.
- **Retake re-entry edge case.** Tenant retakes a doc from review, then closes the tab in the middle of the retake. Next visit: classification returns `mid_flow` (one doc is now missing again). Lands back in card stack on that doc. Then completes → returns to review. Make sure this path works.
- **Deferred-doc messaging coordination.** If tenant reaches "all required complete" with some deferred remaining, the review screen messaging should match what PRD-43 says about deferred-doc reminders. Don't contradict.
- **Mobile sticky footer + iOS Safari.** iOS Safari has quirks with `position: sticky` and the viewport bottom (URL bar). Test specifically; may need `position: fixed` with safe-area-inset padding.
- **PRD-20 boundary.** Don't accidentally take over `submitted` handling. That's PRD-20's job. If PRD-20 isn't ready, fall through to whatever exists today (likely dashboard).

---

## When something is ambiguous

Stop and ask. Specifically:
- If PRD-20 is mid-build, decide with Alex whether to merge entrypoints now or defer.
- If `MagicLinkSigningFlow` doesn't have a clean entry point (e.g., it's tangled with dashboard logic), surface immediately — F2 handoff target needs decoupling.
- If pdf-lib client-side rendering is too slow on mobile, fall back to generic icons in v1 and note in build report.
- If signing-progress state isn't exposed cleanly, expose it via a hook before duplicating — but coordinate with whoever owns the signing flow.
- If "submit application" fires somewhere unexpected (e.g., not the last signature), reflect actual behavior in F3's "both bars 100%" final state.
