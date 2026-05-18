# Prompt — PRD-42: PBV Tenant Document Card Stack

**Date:** 2026-05-17
**Pairs with:** `docs/fullApp-Plan/42-pbv-tenant-document-card-stack_prd_2026-05-17.md`
**Target branch:** `feat/pbv-tenant-document-card-stack-42`

---

## Status: ready to build after PRD-40 and PRD-41 land

PRD-42 depends on:
- **PRD-40 F4** (doc gating by intake) — without it, the landing screen says "We need 31 things" instead of "We need 13 things." Cards built off the gated count.
- **PRD-40 F8** (Review page humanize utility) — reused for plain-language doc titles on cards.
- **PRD-41 F1** (hash dedup) — fires per card after each upload.
- **PRD-41 F3** (per-doc help content) — source of truth for card descriptions, if it shipped before PRD-42.
- **PRD-41 F4** (progress bar) — mirrored in card-stack header.
- **PRD-43 defer endpoint** — called from "I'll get this later." If PRD-43 hasn't landed, PRD-42 ships its own stub endpoint and PRD-43 takes over later.

Build coordinates with PRD-43 (shipping ahead) and prepares for PRD-44 (stitches the seams this PRD opens).

---

## Read first

1. The PRD: `docs/fullApp-Plan/42-pbv-tenant-document-card-stack_prd_2026-05-17.md`
2. The brief: `local:uploads/prd-42-brief_card-stack-redesign.md` (Alex's design sketches)
3. The tenant journey audit: `tasks/TENANT_JOURNEY_2026-05-17.md` (why the current page is broken)
4. The existing scanner: `components/DocumentScanner/DocumentScanner.tsx` — the primary upload primitive
5. The page being replaced: `components/pbv/TenantDocumentUpload.tsx` + `app/pbv-full-app/[token]/documents/page.tsx`
6. The schema: `supabase/migrations/20260514120000_application_documents.sql` (already verified — one row per file, unique on `anchor + doc_type + person_slot + revision`)
7. Application events: `lib/events/application-events.ts`
8. PRD-40 (decisions for doc gating, banner, review humanize): `docs/fullApp-Plan/40-pbv-trust-safety-polish_prd_2026-05-17.md`
9. PRD-41 (hash dedup, help content, progress bar): `docs/fullApp-Plan/41-pbv-tenant-upload-ux_prd_2026-05-17.md`
10. PRD-43 (defer endpoint, reminder scheduling): `docs/fullApp-Plan/43-pbv-outbound-comms_prd_2026-05-17.md`

---

## Before you touch code — seven verifications

These come from the PRD's open questions. Some require Alex input; most are codebase reads.

1. **`docTypeHelp` source.** Does PRD-41's content live at `lib/pbv/docTypeHelp.ts` or in a DB table? If PRD-41 shipped, import. If PRD-41 is mid-build, coordinate with that build to align on the canonical location for PRD-42's `docContent.ts`.
2. **PRD-43 defer endpoint.** Does `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts` exist post-PRD-43? If yes, call it. If no, PRD-42 ships its own stub.
3. **`intake.household.members[]` reliability.** Run a query on existing applications: `SELECT id, intake_data->'household'->'members' FROM pbv_full_applications WHERE intake_status='complete'`. Confirm names are populated for HoH and any added adults. Flag edge cases.
4. **Cron/feature-flag infrastructure.** If we need to flag-gate the new card stack vs. the old directory during transition, what mechanism does the project use? Search for `featureFlag`, `LaunchDarkly`, env-based flags.
5. **PRD-40 ApplicationStatusBanner ship status.** If PRD-40 F5 is shipped, the landing screen coordinates with it. If not yet, ship PRD-42 with banner-aware landing logic.
6. **PRD-41 F2 descope confirmation.** Read PRD-41's build report. If F2 (drag-drop) was descoped per PRD-42 decision, good. If it shipped anyway, PRD-42's first commit removes it.
7. **Sign-flow handoff target.** Where does the dashboard route tenants when all uploads are done today? Verify; PRD-42's end screen needs that destination as a temporary fallback before PRD-44 ships.

Report findings before starting Phase 1.

---

## What you're building

A linear card stack that replaces the directory-style `/documents` page entirely. 10 features across 5 phases. ~8-12 days. Phase 1 alone is a viable internal demo.

---

## Order of operations

**Phase 1 → 2 → 3 → 4 → 5 in order.** Don't interleave — each phase produces a working commit and a checkpoint.

---

## Phase 1 — Foundation (F1, F2, F3)

### Step 1 — F1 Landing screen with hardcoded sequence

**Files:**
- New: `components/pbv/cards/DocumentCardStack.tsx` — orchestrator. Holds card sequence state.
- New: `components/pbv/cards/DocumentCardStackLanding.tsx` — landing.
- New: `lib/pbv/cards/docContent.ts` — per-doc-type content registry: `{ title, description, fallback }` × EN/ES/PT.
- Modify: `app/pbv-full-app/[token]/documents/page.tsx` — mounts the card stack, feature-flagged (Step 0 below).

**Step 0 — Feature flag.** Before touching anything, set up a flag (env var, config flag, whatever the project uses per verification 4). Default OFF. PRD-42 builds entirely behind the flag. Old directory page remains live for production traffic.

**Landing implementation:**
- On mount, read application state. If zero uploads + zero deferred → show landing.
- Content:
  - "Hi {{first_name}}." — pulled from `intake.household.members[0].first_name`, fallback to `application.head_of_household_name` split on space.
  - "We need {{count}} things from you. We'll go one at a time." — count from PRD-40 F4 gated doc list.
  - Helper: "Don't have something yet? Tap 'I'll get this later' and we'll come back to it."
  - Primary CTA: "Let's start →"
  - Secondary link: "See full list"
- EN/ES/PT per `preferred_language`.
- One viewport at 375x667 (iPhone SE). No scroll on landing.

**Verify:** Open at /documents with feature flag on for a test tenant. Landing renders. Count matches PRD-40 gated count. Tap "Let's start" → navigates to first card route or mounts first card component.

### Step 2 — F2 The card

**Files:**
- New: `components/pbv/cards/DocumentCard.tsx` — single card render.

**Card layout (canonical mobile, in this order top-down):**
1. Header: back button, "X of N" counter, slim progress bar (mirrors PRD-41 F4)
2. Doc title (plain language from `docContent.ts`)
3. Person attribution if per-person ("For Maria" / "For Tomás")
4. Help text inline (description + fallback from registry)
5. Primary action: **📷 Take photo** — opens DocumentScanner in camera mode
6. Secondary action: **📎 Upload file** — file picker
7. Tertiary: "I'll get this later" link
8. Tertiary: "Doesn't apply to me" link (only if doc type permits deactivation per PRD-40 trigger config)

**Sizing rules:**
- All elements visible in 375x667 viewport without scroll.
- Tap targets ≥ 44x44px.
- Primary + secondary buttons same width. Stacked vertically on narrow viewports, side-by-side on tablet+.
- Help text capped at ~3 lines on mobile; truncate with "Read more" if longer.

**DocumentScanner integration:**
- Mount in camera mode on Take Photo tap.
- onComplete callback: receives `File` + `ScannerMetadata`. PRD-42's card layer handles the upload POST.
- Pass `multiPage: true` for doc types that accept multiples (paystubs, bank statements).
- `acceptedFormats: ['pdf', 'jpeg']` default; per-doc override possible.

**File upload integration:**
- Native `<input type="file" accept="image/*,application/pdf">` for Upload File button.
- Reuse same POST upload endpoint that the scanner uses (no separate path).

**Verify:**
- Card renders with all elements visible on 375x667.
- Tap Take Photo → DocumentScanner opens.
- Tap Upload File → OS file picker opens.
- Plain title shows, not bureaucratic.

### Step 3 — F3 Post-upload state

**Files:**
- Continue in `DocumentCard.tsx`. Track local card state: `entry | uploading | uploaded | error`.

**Behavior:**
- On successful upload, card enters `uploaded` state. Action buttons replaced with:
  - "✓ {{Doc name}} uploaded" affirmation
  - Thumbnail of uploaded file (first page if PDF — use pdf-lib to render thumbnail, OR show generic file icon if rendering is heavy)
  - For multi-file doc types: "Add another {{doc name}}" link. Reopens scanner in append mode (DocumentScanner supports adding pages to in-progress capture).
  - "Retake" link. Discards current and reopens scanner.
  - Primary CTA: "Next →"
- Auto-advance:
  - Single-file docs: after 1.5s on the success state, auto-advance.
  - Multi-file docs: do NOT auto-advance. Wait for explicit Next tap.
  - Cancelable: if tenant interacts with anything during the 1.5s, cancel auto-advance.

**Verify:**
- Upload single paystub. See success state. After 1.5s, advance.
- Upload first paystub of a multi-file. See "Add another paystub." Tap. Scanner reopens in append mode. Add page 2. Confirm. PDF has 2 pages. Tap Next. Advances.
- Retake at any point before Next. Old file discarded. Scanner reopens for fresh capture.

**Phase 1 acceptance + check-in.** Show Alex the working card stack with 3 mocked cards before moving to Phase 2.

---

## Phase 2 — Real data (F8)

### Step 4 — F8 Per-person naming on documents GET

**Files:**
- Modify: `app/api/t/[token]/pbv-full-app/documents/route.ts` (or wherever the documents endpoint is — verify path)
- Modify: shared TypeScript types for the documents response — add `person_name: string | null`.

**Implementation:**
- Read `intake.household.members[]` from the application's intake state.
- Build a map: `person_slot → member.first_name` (fallback to `member.full_name`, then to `"Adult N"` / `"Child N"`).
- For each doc row in the response, attach `person_name`.

**Verify:**
- Maria-only application: docs return `person_name: "Maria"` on per-person docs.
- Maria + Tomás application: docs split by `person_slot`. Tomás's paystubs return `person_name: "Tomás"`.
- Edge case: member with no name on file. Returns fallback like "Adult 2" + flag in response.

### Step 5 — Wire per-person naming into cards

**Files:**
- `components/pbv/cards/DocumentCard.tsx` — render `person_name` if present
- `components/pbv/cards/DocumentCardStack.tsx` — group cards by person if helpful for ordering (e.g., all of Maria's docs first, then Tomás's)
- `lib/pbv/cards/docContent.ts` — title format string accepts `{{person_name}}` interpolation

**Verify:**
- Card titles read "Your paystubs" (for HoH) or "Tomás's paystubs" (for additional adults).
- Sidesheet (Step 8 below) groups by person.

### Step 6 — Admin visibility for deferred docs

**Files:**
- Modify: whatever admin component renders the application list (likely `app/admin/pbv/full-applications/page.tsx` or similar)
- Modify: documents-summary endpoint that powers the list

**Implementation:**
- Surface deferred count alongside missing / uploaded counts.
- Optional: filter for "applications with deferred docs."

**Verify:**
- Maria has 3 deferred. Admin list shows "3 deferred, 5 uploaded, 5 still missing" in her row.

**Phase 2 acceptance + check-in.** Cards now reflect real applications. Demo to Alex.

---

## Phase 3 — Tenant control (F4, F5, F6)

### Step 7 — F4 Defer action

**Files:**
- Modify: `components/pbv/cards/DocumentCard.tsx` — wire "I'll get this later" tap to defer endpoint
- New OR coordinate-with-PRD-43: `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/defer/route.ts`

**Implementation:**
- On tap: POST to defer endpoint. Optimistically advance card. On failure, revert + show toast.
- Server: mark doc row deferred (column or status — coordinate with PRD-43). Set application `next_reminder_scheduled_at = NOW() + INTERVAL '3 days'` if not already nearer.
- Card stack state: deferred card moves to end of queue. Re-rendered after all non-deferred missing cards.
- Emit analytics event `DOCUMENT_CARD_DEFERRED` (Step 11 below).

**Verify:**
- Tap defer on card 3. Card 3 animates out, card 4 in.
- Walk to end of queue. Card 3 reappears with a "deferred — try again?" affordance.
- Server: doc row has deferred state. Application's reminder schedule set.

### Step 8 — F5 Deactivate "Doesn't apply to me"

**Files:**
- Modify: `components/pbv/cards/DocumentCard.tsx` — render Doesn't Apply link only when allowed
- New OR coordinate: `app/api/t/[token]/pbv-full-app/documents/[doc_row_id]/deactivate/route.ts`
- Read: PRD-40 trigger config for "deactivate permitted" flag per doc type

**Implementation:**
- Confirm modal before POST.
- POST sets doc status to `'no_longer_required'` (per PRD-40 closed decision adding this enum value).
- Card stack removes deactivated card from queue.

**Verify:**
- For a deactivate-permitted doc type, show the link. For one that isn't, hide it.
- Tap + confirm. Card removed from queue. Sidesheet shows it as "(n/a)".

### Step 9 — F6 Sidesheet

**Files:**
- New: `components/pbv/cards/DocumentCardStackSidesheet.tsx`

**Implementation:**
- Trigger from landing's "See full list" link AND from a small icon in card-stack header.
- Lists all docs grouped by status: Uploaded / Deferred / Still needed / Doesn't apply.
- Per-person sub-grouping where helpful.
- Tap row → close sidesheet, navigate card stack to that doc.
- No upload affordances. Navigation only.

**Verify:**
- Open sidesheet. See all docs grouped. Tap any → sidesheet closes, card stack lands on that card.
- No upload buttons in sidesheet.

**Phase 3 acceptance + check-in.**

---

## Phase 4 — Telemetry (F7)

### Step 10 — Application events schema additions

**Files:**
- Modify: `lib/events/application-events.ts` — add new `ApplicationEventType` entries (full list in PRD F7).
- New migration if `application_events` schema needs new columns. Probably unnecessary if `payload` is already JSONB.

**Verify:**
- TypeScript compiles. New event types are referable.

### Step 11 — Client telemetry hook + endpoint

**Files:**
- New: `app/api/t/[token]/pbv-full-app/events/route.ts` — POST accepts batch
- New: `lib/cards/useCardAnalytics.ts` — React hook
- Modify: `DocumentCard.tsx`, `DocumentCardStack.tsx`, `DocumentScanner.tsx` integration — call the hook at the right moments

**Implementation:**
- Hook batches up to 50 events client-side, flushes on card-advance / page-hide / manual flush / 30s idle.
- POST endpoint validates payload schema, writes to `application_events`, returns 204.
- On failure, hook queues + retries with exponential backoff. Never blocks UX.
- Events to emit per Section F7 in PRD.

**Verify:**
- Walk 3 cards. DevTools network panel shows batched POST with all expected event types.
- Force endpoint 500. UX unaffected. Events queued and retried.

**Phase 4 acceptance + check-in.**

---

## Phase 5 — End-to-end (F9, F10)

### Step 12 — F9 End screen

**Files:**
- New: `components/pbv/cards/DocumentCardStackEnd.tsx`

**Two end states:**
- **All required complete:** praise + "Next: review and submit" CTA. CTA target = PRD-44 review screen if PRD-44 is live; else `/dashboard`.
- **Some deferred:** praise + still-needed list + reminder note ("We'll text you in 3 days") + tap-to-call phone link to (860) 993-3401.

**Verify:**
- Upload all required → praise screen. CTA active.
- Defer some → praise + list + reminder note. Phone link works on mobile.

### Step 13 — F10 Rejection re-entry

**Files:**
- Modify: `DocumentCardStack.tsx` — on mount, query for rejected docs; if any, sort to front of queue
- Modify: `DocumentCard.tsx` — if doc was rejected since last visit, render rejection-reason banner from PRD-17 surface

**Implementation:**
- Use `pbv_rejection_reason_templates` content (already shipped) for the reason rendering.
- Re-upload flow is identical to first-upload. Server marks revision increment.

**Verify:**
- Staff rejects a doc with a reason. Tenant reopens link. Rejected card is first. Banner shows reason. Re-upload returns it to submitted.

**Phase 5 acceptance + check-in. Then full end-to-end run from PRD.**

---

## What to deliver

- Branch `feat/pbv-tenant-document-card-stack-42`
- 5 phase commits (or PRs, whichever you prefer)
- Feature flag for card stack vs. directory. Card stack OFF by default at first commit; flip ON when Phase 5 acceptance passes.
- Migration if `application_events` needs new columns (probably not — JSONB payload is flexible)
- Unit tests for: `docContent` content registry, deferral state machine, card queue ordering with rejection re-entry, analytics hook batching
- Mobile snapshot tests for: 375x667 (iPhone SE), 412x915 (Pixel 5) at landing, card, post-upload, sidesheet, end screen
- Build report at `docs/build-reports/42-pbv-tenant-document-card-stack-build-report_<ship-date>.md` covering:
  - Pre-build verification answers (especially the docTypeHelp / defer-endpoint coordination)
  - Each phase: what was changed, what file paths verified
  - Decisions diverged from PRD with rationale
  - The migration plan for in-flight applications (feature-flag rollout strategy)
  - Telemetry sample: 24h of card-stack analytics events vs. directory baseline if available
- PRD-42 status updated from "Draft" to "Shipped"
- Coordinate with PRD-44 to confirm the end-screen CTA target

---

## Gotchas

- **Don't reimplement DocumentScanner.** It's a substantial, working primitive. Embed it. If it has a bug that affects card stack, fix it in DocumentScanner directly, not by rebuilding.
- **One row per file. No sibling rows.** Multi-file = bundled PDF. The scanner already does this. Don't try to make the schema do something it doesn't.
- **Auto-advance is a small UX gamble.** 1.5s might feel rushed or feel right. Make the timing a const at the top of DocumentCardStack so Alex can tune it after a tenant walkthrough.
- **Feature flag is non-negotiable.** Production tenants are mid-flow on the directory page. Don't break them. Old page stays live behind the flag for at least one release cycle.
- **DocumentScanner state machine has stages.** Don't accidentally double-mount it. Use a single instance per card with explicit lifecycle.
- **Defer endpoint coordination with PRD-43.** Build the endpoint in whichever PRD ships first. The other one references it. Don't duplicate.
- **Server-side analytics is the source of truth.** Client batching is for performance; the server writes the authoritative event row. Don't trust client-side counts in admin views.
- **iOS Safari quirks with file inputs.** The file picker on iOS Safari can be finicky with `accept` attribute and `capture` attribute. Test specifically on iPhone Safari before declaring victory.
- **Reduce motion.** Respect `prefers-reduced-motion` on auto-advance animations and card transitions.

---

## When something is ambiguous

Stop and ask. Specifically:
- If the `docTypeHelp` source from PRD-41 is in a different shape than expected (DB table vs. TS module), coordinate before authoring `docContent.ts`. Don't create a third source of truth.
- If PRD-44 isn't ready when PRD-42's end screen needs a CTA target, ship to `/dashboard` and flag the followup. Don't block.
- If the feature flag infrastructure doesn't exist, decide with Alex whether to build it (small) or ship without (risky for production traffic).
- If `intake.household.members[]` has structural gaps (e.g., missing first_name fields), surface immediately. Per-person naming is a closed decision; ship-blocker if the data isn't there.
- If admin visibility for deferred docs (F8) requires a non-trivial admin page refactor, scope it as a follow-up rather than block PRD-42 on it. The minimum is a count in the existing row.
