# PRD-42 — PBV Tenant Document Upload: Card Stack Redesign

**Date:** 2026-05-17
**Author:** Claude (from `prd-42-brief_card-stack-redesign.md`)
**Branch:** `feat/pbv-tenant-document-card-stack-42`
**Status:** Draft — ready for build. Ships **after** PRD-40 and PRD-41. Coordinates with PRD-43 for deferred-doc reminders. PRD-44 stitches the seams this PRD opens.
**Source brief:** `local:uploads/prd-42-brief_card-stack-redesign.md`
**Supersedes:** Whatever PRD-22 was (prior attempt — not recovered, fresh start).

---

## Problem Statement

The current `/documents` page is a wall of 31 rows that breaks on mobile and forces tenants to find each doc themselves. The 2026-05-17 tenant walkthrough confirmed:

- Tenant doesn't know which doc to upload next — every row competes equally for attention.
- Mobile rendering pushes Upload buttons below the fold per row.
- Document names are bureaucratic ("HUD-9886-A Authorization for Release of Information") with no inline plain-language explanation.
- Status indicators (Missing, Submitted, Person 1, Rev 1) are dev-facing labels.
- There is no concept of "what's next" — it's a directory, not a flow.

Maria — the canonical test case (single mom, on phone, 5-minute mobile bursts across multiple days, low confidence with English bureaucratic language) — has no chance of finishing the current page without staff intervention.

Replace the directory with a **linear one-doc-per-screen card stack**. Headline bet: linearization beats density. The "See all" sidesheet stays one tap away for organized tenants (Tenant 2 in the cohort) who want random-access browsing.

---

## Users & Roles

- **Tenants completing their PBV application** — primary beneficiary. Card stack is mobile-first, browser-rendered, no install.
- **Stanton staff** — secondary. Card stack emits structured analytics events that staff can use to triage stalled tenants. Admin upload UI is NOT replaced — staff still see the directory view on their side.
- **No admin UI changes in this PRD** beyond a small visibility enhancement: deferred docs need to be distinguishable in the admin list (covered in F8).

---

## Closed decisions

- **The card stack replaces the tenant `/documents` page entirely.** Staff admin views unchanged.
- **One doc per card, one viewport, no scroll.** If help text needs more space, it expands inline. Buttons never go below the fold.
- **Camera capture and file upload are equally weighted.** Both buttons same size, same prominence, side-by-side or stacked depending on viewport.
- **"I'll get this later" is first-class.** Realistic for ~60% of cards on session one. Moves card to end of queue, persists state, triggers PRD-43 F2 reminder cadence.
- **"Doesn't apply" is rare.** Intake should pre-filter via PRD-40 F4 doc gating. When offered (e.g., "additional paystubs after the first"), it deactivates the row server-side via the existing trigger system.
- **Progress is shown but not weaponized.** Small bar in card-stack header. No red banners. No "21 remaining" guilt.
- **End screen is praise + clear next step + tenant in control.** No anxiety language.
- **Multi-file per doc uses single-PDF bundling, not sibling rows.** Schema is one-row-per-file (verified 2026-05-17). The existing `DocumentScanner` already supports multi-page → single PDF via pdf-lib. "Add another paystub" extends the same PDF before the tenant taps Next.
- **`DocumentScanner` is the primary action on every card.** The current page treats Scan as co-equal with Upload; that's wrong. Scan handles the mobile-first path; Upload is the secondary affordance.
- **Sidesheet is navigation-only.** No upload from the sidesheet. Single upload path = card. Less complexity, fewer states.
- **Per-person naming throughout.** Cards, sidesheet, end screen. No `'Person 1'` literals. Server change: add `person_name` to documents GET response sourced from `intake.household.members[]`.
- **Analytics events ship with this PRD.** Without `DOCUMENT_CARD_VIEWED` / `_SKIPPED` / `_DEFERRED` / `_HELP_OPENED`, we ship blind. Folded into F7 as a hard requirement, not optional.
- **Sign-flow handoff is owned by PRD-44.** PRD-42 ends at "all uploads done → review screen." PRD-44 takes over from review through signing.

---

## Decisions resolved (from brief + Alex 2026-05-17)

### F2 of PRD-41 (drag-drop zone) is descoped

**Decision:** PRD-41 ships without F2. The day saved redirects into accelerating PRD-42.

**Rationale:** PRD-41 F2 introduces a drag-drop affordance on the directory-style page. PRD-42 replaces the directory entirely. F2 would have a ~2-week lifespan before card stack obsoletes it.

**Implication:** PRD-41 build report must note F2 is descoped. If F2 is partially built when this decision arrives, leave it dark behind a feature flag and remove in PRD-42's first commit.

### Multi-file UX uses single-PDF bundling

**Decision:** When a doc type accepts multiple files (e.g., 4 paystubs), the scanner accumulates pages into ONE PDF. "Add another paystub" extends the in-progress PDF before submission. No sibling rows.

**Rationale:** Schema verification 2026-05-17 confirmed unique constraint on `(anchor_type, anchor_id, doc_type, person_slot, revision)`. Sibling rows are not possible without a schema change. The existing `DocumentScanner.review_pages` stage already supports the bundling pattern.

**Implication:** PRD-42 doesn't introduce a schema migration for multi-file. The card UI surfaces "Add another page / paystub" while in scanner mode, before the final Submit.

### Card stack does not handle sign flow

**Decision:** Last upload → review screen → handoff to PRD-44. PRD-42 does not modify the signing flow.

**Rationale:** Clean PRD boundaries. Signing is its own card-stack-able experience that PRD-44 (or a later PRD) addresses with the same primitives PRD-42 builds.

### Analytics events are non-negotiable

**Decision:** PRD-42 does not ship without `DOCUMENT_CARD_VIEWED`, `DOCUMENT_CARD_COMPLETED`, `DOCUMENT_CARD_SKIPPED`, `DOCUMENT_CARD_DEFERRED`, `DOCUMENT_HELP_OPENED`, `DOCUMENT_SCANNER_OPENED`, `DOCUMENT_SCANNER_RETAKE`, `DOCUMENT_UPLOAD_SUCCESS`, `DOCUMENT_UPLOAD_FAILED` events.

**Rationale:** The redesign's whole bet is per-card progression. Without telemetry, we can't measure whether the bet is paying off.

**Implication:** Extends `application_events` schema (new event types) + new POST endpoint for client-emitted events. Folded into F7.

---

## Core Features

### F1 — Landing screen

**Goal:** Tenant lands on `/documents` and sees a calm, welcoming screen with the right count.

**Files (verify before editing):**
- `app/pbv-full-app/[token]/documents/page.tsx` — page entry
- `components/pbv/TenantDocumentUpload.tsx` — current implementation, to be replaced
- New: `components/pbv/cards/DocumentCardStackLanding.tsx`

**Implementation:**
- On page load, check application state:
  - Zero docs uploaded AND zero deferred → show landing.
  - Otherwise → skip to next missing card (PRD-44 F1 territory; for PRD-42 alone, ship landing every time; PRD-44 adds the mid-flow re-entry skip).
- Landing content:
  - "Hi {{first_name}}. We need {{count}} things from you. We'll go one at a time."
  - Count = PRD-40 F4 gated required count for this tenant.
  - Help microcopy: "Don't have something yet? Tap 'I'll get this later' and we'll come back to it."
  - Primary CTA: "Let's start →"
  - Secondary link: "See full list" → opens sidesheet (F6).
- EN/ES/PT per `preferred_language`.

**Acceptance:**
- Maria (wage-earner, Checking, citizen, no kids) lands on /documents. Sees "Hi Maria. We need 13 things from you" (or whatever the gated count is post-PRD-40). Landing is one viewport, no scroll on iPhone SE viewport.
- "Let's start" navigates to first missing card.

### F2 — The card (one doc per screen)

**Goal:** Each required doc is presented as a single full-viewport card with the doc title, plain-language description, and two equally-weighted upload paths.

**Files:**
- New: `components/pbv/cards/DocumentCard.tsx`
- New: `components/pbv/cards/DocumentCardStack.tsx` — orchestrates card sequence + state
- Reuse: `components/DocumentScanner/DocumentScanner.tsx` — embedded in card on tap

**Card layout (all in one viewport, no scroll):**
- Header: back button, "X of N" counter, slim progress bar
- Doc title (plain language — "Your paystubs", not "Paystubs (last 4 weekly or 2 bi-weekly per employed person)")
- Help text inline (2-3 sentences, plain language): what it is, where to find it, fallback if they don't have it
- Person attribution if the doc is per-person ("For Maria" / "For Tomás, age 17")
- Primary action button: **📷 Take photo** (opens `DocumentScanner` in camera mode)
- Secondary action button: **📎 Upload file** (opens file picker)
- Tertiary affordances:
  - "I'll get this later" link (F4)
  - "Doesn't apply to me" link (F5) — only present for doc types where the trigger system supports deactivation

**Content source:**
- Doc title: short plain-language label, sourced from a new content registry `lib/pbv/cards/docContent.ts` keyed by `doc_type`. Maps to `{ title: { en, es, pt }, description: { en, es, pt }, fallback: { en, es, pt } }`.
- If PRD-41's `docTypeHelp` exists, consolidate into this same registry. Otherwise PRD-42 owns the source of truth and PRD-43 reuses it.

**Acceptance:**
- Open first card. Layout is one viewport on 375x667 (iPhone SE) and 412x915 (Pixel 5). No scroll. Both buttons reachable with thumb.
- Plain-language title shows. Help text shows. Camera and Upload buttons equally weighted.
- Tap "Take photo" → DocumentScanner mounts in camera mode.
- Tap "Upload file" → file picker opens.
- Tap "I'll get this later" → defer flow (F4) fires.

### F3 — Post-upload state + multi-file bundling

**Goal:** After successful upload, tenant sees confirmation, can add another page/paystub, retake, or advance.

**Behavior:**
- On successful upload via either path, card replaces action buttons with:
  - "✓ Paystub uploaded" affirmation
  - Thumbnail of uploaded file (first page if PDF)
  - "Add another paystub" — re-opens DocumentScanner in append mode, adds page to in-progress PDF, re-submits as revision (handled per existing scanner state machine)
  - "Retake" — discards current upload, returns to camera mode
  - Primary CTA: "Next →" advances to next card

**Auto-advance:**
- After upload, wait ~1.5s on the success state (gives tenant a moment to see the affirmation) then auto-advance UNLESS the doc type allows multiples.
- If multi-file (paystubs, bank statements with multiple pages), do NOT auto-advance. Tenant taps Next explicitly when done bundling.
- Auto-advance can be disabled via a `prefers-reduced-motion`-style respect signal or by user preference (deferred to future polish — not in PRD-42).

**Retake before advance:**
- Tenant can tap "Retake" any time before "Next". Old file is discarded (or marked as superseded revision, depending on whether replace fires a fresh upload or a swap).
- If they've already advanced, they go back via Back button and the card shows the previously-uploaded state with a "Replace" option.

**Acceptance:**
- Upload one paystub. See success state. "Add another paystub" available. Tap it → scanner reopens in append mode. Add page 2. Tap done in scanner → single PDF now has 2 pages.
- Tap Next → advances to next card. Server has one row with revision=1 and a single PDF storage_path.
- Go back to paystub card. See "Replace" option. Tap → scanner opens, fresh capture replaces the bundle.

### F4 — "I'll get this later" deferral

**Goal:** Card can be deferred without dropping out of the flow.

**Behavior:**
- Tap "I'll get this later" → card animates out, next missing card animates in.
- Deferred card persists state — moves to end of queue.
- Server: POST to `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts` (this endpoint is owned by PRD-43; PRD-42 calls it).
- Emits analytics event `DOCUMENT_CARD_DEFERRED`.
- If PRD-43 has shipped, this also schedules a reminder per the cadence in PRD-43 F2.
- If PRD-43 hasn't shipped yet, the defer endpoint records state but doesn't yet trigger reminders. Defer UX still works.

**Acceptance:**
- Tap "I'll get this later" on card 3. Card 3 moves to end of queue. Card 4 appears.
- Walk to end of queue. Card 3 reappears as a "still needed" card with a deferral indicator.
- Server: doc row has deferred flag/state. Application's next_reminder_scheduled_at is set if PRD-43 is live.

### F5 — "Doesn't apply to me" deactivation

**Goal:** When a doc was triggered by intake but the tenant says it doesn't apply, deactivate the row server-side.

**Behavior:**
- Show "Doesn't apply to me" link only on doc types where the PRD-40 trigger config permits it. (Most won't — Citizenship Declaration always applies. Paystubs apply if Wages was checked. The link only renders for genuinely-removable docs like "additional paystubs slot if there are more than 4 weeks.")
- Tap → confirm modal ("Are you sure? You can change this back from 'See full list'.") → POST to a deactivate endpoint that flips the row to `status='no_longer_required'` (per PRD-40 decision to extend `ad_status_check` enum).
- Card animates out, next card in.

**Acceptance:**
- Rare in initial Maria walkthrough; verify on a doc type where it actually appears.
- Tapping "Doesn't apply" + confirming sets the row's status. Sidesheet shows the doc as "(n/a)" instead of "still needed."

### F6 — Sidesheet ("See all") — escape hatch

**Goal:** Organized tenants can browse the full list and jump to any card. Random access without leaving the card stack.

**Files:**
- New: `components/pbv/cards/DocumentCardStackSidesheet.tsx`

**Behavior:**
- Trigger: "See full list" link on landing, plus a small icon/affordance in the card-stack header.
- Content: scrollable list of all docs, grouped by status:
  - `✓ Uploaded` (with revision count if multi-file)
  - `⏱ Deferred`
  - `Still needed`
  - `— Doesn't apply (n/a)`
- Per-person grouping where appropriate (PRD-42 owns surfacing real names — see F8).
- Tap any item → closes sidesheet, navigates card stack to that card.
- Closes via X button or background tap.

**Constraints:**
- Sidesheet does NOT include direct upload affordances. One upload path = card. The sidesheet only navigates.
- Reasoning: locked decision. Two upload paths means two states to manage, two analytics flows, more bugs.

**Acceptance:**
- Open sidesheet. See all docs grouped by status with per-person names. Tap a deferred doc. Sidesheet closes. Card stack lands on that card.
- Verify no upload buttons in the sidesheet.

### F7 — Analytics events + telemetry endpoint

**Goal:** Every meaningful tenant action emits a structured event so we can measure whether linearization beats density.

**Events to emit (client-side, POSTed to a new endpoint):**
- `DOCUMENT_CARD_VIEWED` — fires when a card mounts. Payload: `doc_type`, `card_index`, `total_cards`, `application_id`.
- `DOCUMENT_CARD_COMPLETED` — fires when tenant successfully uploads and advances. Payload: `doc_type`, `upload_method` ('scanner' | 'file_upload'), `revision`, `time_on_card_ms`.
- `DOCUMENT_CARD_DEFERRED` — fires on "I'll get this later". Payload: `doc_type`, `card_index`, `time_on_card_ms`.
- `DOCUMENT_CARD_SKIPPED` — fires when tenant navigates away from a card without action (e.g., closes tab, browses sidesheet). Best-effort via `beforeunload` or `pagehide`.
- `DOCUMENT_CARD_DEACTIVATED` — fires on "Doesn't apply". Payload: `doc_type`.
- `DOCUMENT_HELP_OPENED` — if help text has any expandable affordance, fires when expanded.
- `DOCUMENT_SCANNER_OPENED` — fires when DocumentScanner mounts.
- `DOCUMENT_SCANNER_RETAKE` — fires when tenant retakes capture before final submission.
- `DOCUMENT_UPLOAD_SUCCESS` / `DOCUMENT_UPLOAD_FAILED` — already emitted server-side likely; if not, add.

**Files:**
- New: `app/api/t/[token]/pbv-full-app/events/route.ts` — POST accepts a batch of client events, validates schema, writes to `application_events`.
- Modify: `lib/events/application-events.ts` — add new `ApplicationEventType` entries for each of the above.
- New: `lib/cards/useCardAnalytics.ts` — React hook called by `DocumentCard` and friends. Batches events client-side, debounces network, retries on failure.

**Implementation notes:**
- Schema: `application_events` already exists per PRD-41 review. Confirm columns support `event_type`, `payload JSONB`, `created_at`, `application_id`, `anchor_id`. Add columns if needed.
- Batch on client to avoid one request per event. Flush on card-advance, on page-hide, on manual flush. Max 50 events per batch.
- Don't block UX on telemetry failure. If the endpoint 500s, queue + retry; don't show errors to tenant.

**Acceptance:**
- Walk through 3 cards. Network panel shows batched POST to events endpoint with all expected event types.
- Force a 500 on the events endpoint. Tenant UX unaffected. Events queued in memory + retried on next flush.
- Server-side: `application_events` table has rows for each event.

### F8 — Per-person naming + admin visibility for deferred docs

**Goal:** Throughout the card stack, sidesheet, and end screen, real names from `intake.household.members[]` replace `'Person N'` literals. Admin list gets a small enhancement to surface deferred docs.

**Files:**
- Modify: `app/api/t/[token]/pbv-full-app/documents/route.ts` (or wherever the documents GET is) — augment response with `person_name` per row, sourced from intake household members data.
- Modify: Whatever admin list component renders the application detail page — add a column or pill to show "N docs deferred" alongside missing/uploaded counts.

**Implementation:**
- Server reads `intake.household.members[]` from the application's bridged data. Maps `person_slot` to the corresponding member's display name (first name preferred).
- If a member doesn't have a name on file (edge case), fall back to "Adult 2" / "Child 1" with a flag.
- Admin: deferred docs already exist as a status post-PRD-43 defer endpoint. Surface them in the list view (count + filter).

**Acceptance:**
- Card for paystubs reads "For Maria" not "Person 1". Card for spouse's paystubs reads "For Tomás".
- Sidesheet groups by person name.
- Admin list for Maria's row shows "3 deferred, 5 uploaded, 5 still missing" or equivalent.

### F9 — End screen

**Goal:** When all required docs are uploaded OR remaining are deferred, surface a praise screen and clear next step.

**Behavior:**
- Two end states:
  - **All required uploaded:** "Great work, Maria. You uploaded all your documents. Next: review and submit." CTA hands off to PRD-44 F2 (review + signing handoff). For PRD-42 alone, CTA goes to `/dashboard` until PRD-44 lands.
  - **Some required deferred:** "Great work, Maria. You uploaded N documents. Still needed: [list]. We'll text you in 3 days. Your link works anytime until you're done." Primary CTA: "Got it, done." Secondary: phone number for help.
- Phone number rendered as tap-to-call on mobile.

**Files:**
- New: `components/pbv/cards/DocumentCardStackEnd.tsx`

**Acceptance:**
- All required uploaded → praise screen renders, CTA available.
- Defer 3 of 13, upload the rest → praise + "still needed (3)" list + reminder note + tap-to-call.

### F10 — Rejection re-entry path

**Goal:** When a tenant returns and a doc was rejected by staff since their last visit, that card jumps to front of queue with a rejection-reason banner.

**Behavior:**
- On `/documents` page load, query for any docs with `status='rejected'` since the tenant's last session.
- If any, those cards move to the front of the queue. First card the tenant sees is the most recent rejection.
- Rejection-reason banner at top of card: "This one needs a redo. [Reason from staff]. Try again."
- The re-upload flow is identical to first-upload from the tenant's POV. Server marks it as `revision=N+1`, status transitions through 'submitted'.

**Dependencies:**
- Rejection reason rendering is already in PRD-17 scope. Reuse that surface.
- Rejection-reason content is staff-authored via `pbv_rejection_reason_templates` table (already shipped).

**Acceptance:**
- Admin rejects Maria's paystub with reason "Image too blurry." Maria opens link. Paystub card is first, banner reads "This one needs a redo. Image too blurry. Try again."
- Upload replacement. Status returns to 'submitted'. Revision increments.

---

## Phasing

**Phase 1 — Foundation:** F1 landing, F2 card, F3 post-upload state. Establishes the visual + interaction primitives. Single mock card stack with hardcoded sequence — proves the architecture.

**Phase 2 — Real data:** F8 per-person naming + admin visibility. Server-side surface changes. Card stack now reads real applications.

**Phase 3 — Tenant control:** F4 defer, F5 deactivate, F6 sidesheet. Tenant has all the agency they need.

**Phase 4 — Telemetry:** F7 analytics events. Required before broader rollout.

**Phase 5 — End-to-end + edges:** F9 end screen, F10 rejection re-entry. Stitches the flow.

Total target: 8-12 days if no surprises. Phase 1 alone is a viable demo for Alex stakeholder reviews.

---

## Out of scope

- Pre-app carry-forward (already deferred in PRD-41).
- OCR auto-classify (already deferred in PRD-41).
- Pre-flight SMS → PRD-43.
- Mid-flow re-entry polish (the "Welcome back, picking up where you left off" toast) → PRD-44 F1.
- Forms handoff → PRD-44 F2.
- Cross-application card stack (one tenant, multiple applications).
- Staff-side card stack UX. Admin keeps directory view.
- Migration of existing in-flight applications. Tenants who started on the old directory page can either complete on the old page (kept behind a feature flag for one release cycle) or be auto-migrated. Pick during build.

---

## Open questions for Cowork to verify

1. **`docTypeHelp` content source coordination with PRD-41 and PRD-43.** If PRD-41 ships a `lib/pbv/docTypeHelp.ts`, PRD-42's `lib/pbv/cards/docContent.ts` should consolidate with or import from it. If PRD-43 already created an inline mapping, decide which file is canonical. Avoid three independent content tables.
2. **`intake.household.members[]` reliability for per-person naming.** Audit caught edge cases where intake state can be sparse (e.g., reset script artifacts). Confirm the bridge always populates real names for at least the head of household and any "Add adult" entries.
3. **Auto-advance vs. manual advance default.** PRD-42 specs auto-advance ~1.5s after upload for single-file docs, manual for multi-file. Test with Alex's instinct on whether the 1.5s delay is right or feels rushed.
4. **Migration plan for in-flight applications.** Tenants mid-flow when PRD-42 ships. Either flip everyone to the new card stack or keep the old page available behind a flag for backward compat. Recommend feature-flag the directory page for one release cycle.
5. **Browser support for camera capture.** `DocumentScanner` uses opencv.js + jscanify. Confirm acceptable performance on low-end Android. If sluggish, the file-upload path needs to be at least as discoverable as the camera path (currently equal-weight per locked decision).
6. **Sign-flow handoff target.** PRD-42 ends at the end screen. The CTA target is "dashboard" today and "PRD-44 review screen" when PRD-44 lands. Verify the dashboard handles this state cleanly during the gap.
7. **Server-side state for "deferred" status.** Coordinate with PRD-43. The defer endpoint and reminder-scheduling column should be designed once, used by both PRDs.

---

## Acceptance summary (end-to-end test)

Use chrome-devtools-mcp on iPhone SE (375x667) and Pixel 5 (412x915) viewports:

1. Provision fresh Maria-type tenant. Complete intake (PRD-40 gating applied). Land on /documents.
2. Landing screen renders. "Hi Maria. We need 13 things from you." One viewport. Tap "Let's start."
3. Card 1: Paystubs. One viewport. Plain title, plain description, person name "For Maria". Camera + Upload buttons present, equally weighted.
4. Tap "Take photo." DocumentScanner mounts. Scan one page. Confirm. Card shows "✓ Paystub uploaded" + thumbnail.
5. Tap "Add another paystub." Scanner re-opens in append mode. Scan page 2. Confirm. PDF now has 2 pages.
6. Tap Next. Advances to card 2.
7. Card 5: tap "I'll get this later." Card animates out, next card in. Sidesheet shows that card as deferred.
8. Card 7: tap "Doesn't apply." Confirm modal. Sidesheet shows that card as (n/a).
9. Continue through cards. Each one: title, description, name, two buttons, one viewport, no scroll.
10. Last required card → end screen. Praise. Deferred list if any. CTA visible.
11. Admin rejects card 1's upload. Tenant reopens link. Card 1 first with banner. Re-upload. Status returns to submitted.
12. Open sidesheet at any point. See all docs grouped by status. Tap any → navigate to card.
13. Open browser devtools network panel. Confirm batched events POSTing to /api/t/.../events with all expected event types.
14. Mobile viewport throughout. No horizontal scroll, no buttons below fold, no overlap of interactive regions, tap targets ≥44px.

All 14 pass → PRD-42 ships.

---

## Carved out (do NOT include in PRD-42)

- Pre-flight SMS (PRD-43).
- Mid-flow re-entry skip-to-next-missing (PRD-44 F1).
- Review screen + signing handoff (PRD-44 F2).
- Cross-application support.
- Admin card-stack-style upload UX. Admin keeps directory.
- OCR auto-suggest slot from filename. Deferred.

---

## Build prompt

Paired implementation prompt: `docs/fullApp-Plan/prompts/42-pbv-tenant-document-card-stack_prompt_2026-05-17.md`
