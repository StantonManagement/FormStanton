# PRD-42 Brief — PBV Tenant Document Upload: Card Stack Redesign

**For:** Cowork session to turn into full PRD
**Date:** 2026-05-17
**Status:** Brief — not a PRD

---

## Problem

The current `/documents` page is a wall of 31 rows that breaks on mobile and forces tenants to find each doc themselves. Test case: single mom on phone, 5-minute bursts across multiple days, doesn't know what most of the doc names mean.

Replace with a linear one-doc-per-screen card stack flow optimized for hostile-tenancy, low-confidence mobile users. Headline bet: linearization beats density. Same interface serves the organized tenant (Tenant 2 in test cohort) because the "See all" sidesheet is always one tap away.

---

## Design — ASCII sketches

### Landing screen

```
┌──────────────────────────────┐
│  ← Stanton Management        │
│                              │
│  Let's get your documents.   │
│                              │
│  Hi Maria. We need 12 things │
│  from you. We'll go one at   │
│  a time.                     │
│                              │
│  Don't have something yet?   │
│  Tap "I'll get this later"   │
│  and we'll come back to it.  │
│                              │
│  ┌────────────────────────┐  │
│  │      Let's start →     │  │
│  └────────────────────────┘  │
│                              │
│  See full list               │
└──────────────────────────────┘
```

### The card (one per screen)

```
┌──────────────────────────────┐
│  ← Back        1 of 12       │
│  ▓▓░░░░░░░░░░░░░░░░░         │
│                              │
│  Your paystubs               │
│                              │
│  The last 4 weekly OR last   │
│  2 bi-weekly paystubs from   │
│  your job.                   │
│                              │
│  Don't have them? Ask your   │
│  employer or check your      │
│  payroll app.                │
│                              │
│  ┌────────────────────────┐  │
│  │   📷  Take photo       │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │   📎  Upload file      │  │
│  └────────────────────────┘  │
│                              │
│  I'll get this later         │
│  Doesn't apply to me         │
└──────────────────────────────┘
```

### After upload (auto-advances ~1.5s)

```
┌──────────────────────────────┐
│  ← Back        1 of 12       │
│  ▓▓░░░░░░░░░░░░░░░░░         │
│                              │
│  ✓ Paystub uploaded          │
│                              │
│  ┌────────────────────────┐  │
│  │                        │  │
│  │    [photo thumbnail]   │  │
│  │                        │  │
│  └────────────────────────┘  │
│                              │
│  Add another paystub         │
│  Retake                      │
│                              │
│  ┌────────────────────────┐  │
│  │       Next →           │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

### End screen (deferred items)

```
┌──────────────────────────────┐
│  Great work, Maria.          │
│                              │
│  You uploaded 9 documents.   │
│                              │
│  Still needed (3):           │
│  • Bank statement            │
│  • SSI award letter          │
│  • School schedule           │
│                              │
│  We'll text you in 3 days.   │
│  Your link works anytime     │
│  until you're done.          │
│                              │
│  ┌────────────────────────┐  │
│  │     Got it, done       │  │
│  └────────────────────────┘  │
│                              │
│  Need help? (860) 993-3401   │
└──────────────────────────────┘
```

### Sidesheet — "See all" (escape hatch)

```
┌──────────────────────────────┐
│  ✕  Everything we need       │
│                              │
│  ✓ Paystubs                  │
│  ✓ Photo ID                  │
│  ✓ Social Security card      │
│  ✓ Birth cert — Maria        │
│  ✓ Birth cert — child        │
│  ✓ Lease                     │
│  ⏱ Bank statement            │
│  ⏱ SSI award letter          │
│  — Pension letter (n/a)      │
│  — Workers comp (n/a)        │
│  ⏱ School schedule           │
│                              │
│  Tap any item to jump there  │
└──────────────────────────────┘
```

---

## Design principles

- **No scrolling on a card.** Everything fits one viewport. If a doc needs longer help, it expands inline on tap — buttons never go below the fold.
- **Camera and file equally weighted.** Mobile-first. Same prominence.
- **"I'll get this later" is first-class.** Realistic answer for ~60% of cards on session one.
- **Progress bar is small, motivating, not anxiety-inducing.** No red banners.
- **End screen is praise + clear next step + tenant in control.** No "21 remaining" guilt.

---

## In scope

- Replace `TenantDocumentUpload.tsx` list view with the card stack above.
- Landing → cards → end screen → submit, full takeover.
- "I'll get this later" moves card to end of queue, persists state, triggers reminder (PRD-43).
- "Doesn't apply" deactivates the row server-side via existing trigger system.
- Camera capture with multi-page scan support for paystub bundles. PDF on save.
- Wrong-file undo before tapping Next (retake/replace inline).
- Sidesheet "See all" — secondary, never primary. Tap to jump to a card.
- Inline help text per card (not collapsed expander). Content source = PRD-41 `docTypeHelp`.
- Progress bar in card-stack header mirrors dashboard bar (PRD-41 F4).
- Per-person naming throughout. Server change: add `person_name` to documents GET response, sourced from `intake.household.members[]`. Replace `'Person N'` literals.
- Client analytics events: `DOCUMENT_CARD_VIEWED`, `DOCUMENT_CARD_SKIPPED`, `DOCUMENT_CARD_DEFERRED`, `DOCUMENT_HELP_OPENED`. New POST endpoint, extends `application_events` schema. Without this we ship blind.
- Rejection re-entry: rejected docs jump to front of queue with reason banner. Builds on PRD-17.

---

## Dependencies

- PRD-41 should land first (hash dedup, help content, progress bar). Composes cleanly.
- PRD-17 (rejection reason rendering) — re-entry path uses it.
- PRD-18 (multi-signer) — overlaps on per-person naming. Pull that piece forward into PRD-42 if PRD-18 is far off.

---

## Out of scope

- Pre-flight SMS → PRD-43
- Mid-flow re-entry polish + forms handoff → PRD-44
- Pre-app carry-forward (already deferred in PRD-41)
- OCR auto-classify (already deferred in PRD-41)

---

## Conflict to resolve with PRD-41

PRD-42 supersedes PRD-41's F2 (drag-drop zone) — the card IS the slot once PRD-42 lands. Options:

1. **Descope F2 from PRD-41** and redirect that day to accelerate PRD-42. Recommended.
2. Keep F2 as a power-user escape hatch from the card stack. Adds complexity.
3. Accept F2 as a ~2-week throwaway.

Pick before PRD-42 starts.

---

## Open questions for Cowork to verify

1. **[Unverified]** Does `application_documents` support multiple files per row, or does the card create sibling rows for multi-file docs (e.g., 4 paystubs)? Read schema before scoping multi-file UX.
2. Does the "See all" sidesheet allow direct upload, or only navigation back to a card? Recommend navigation only — keeps one upload path.
3. Where does the card stack hand off after submit — directly into signing flow, or dashboard? Recommend direct handoff via PRD-44.
4. **[Unverified]** Is `intake.household.members[]` reliably populated before tenant hits `/documents`, or are there edge cases (e.g., single-adult household)?
