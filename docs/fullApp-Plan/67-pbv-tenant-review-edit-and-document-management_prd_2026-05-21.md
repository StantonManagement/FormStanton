# PRD-67 — Tenant Review/Edit, Document Management & Usability Hardening

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-launch-hardening` (the post-finalization batch — created by PRD-62, off `feat/pbv-full-finalization` or `main`)
**Status:** Draft — ready for build
**Severity:** P1 — launch-lane usability + data-integrity (a tenant who cannot see their uploads, cannot correct a wrong answer, and a broken back button are real abandonment/accuracy risks; editing intake after generation must not desync the signed packet from the data)
**Depends on:** PRD-62 (signing unification + `unsigned_pdf_hash` Check 5), PRD-66 (regenerate-lock + `generation_version`). PRD-67 builds the **tenant-facing edit affordance** that deliberately triggers PRD-66's version-safe regenerate and PRD-62's hash-mismatch enforcement. Runs **after** 62/63/64/65/66 on the same branch.
**Source:** Direct field feedback from Alex after using the deployed app (2026-05-21).

---

## Problem Statement

After walking the deployed PBV full-app, four gaps surfaced — three are missing affordances, one is a broken control:

1. **No "all my documents" screen.** The documents page (`app/pbv-full-app/[token]/documents/page.tsx`) is a one-way upload *flow* (`card_stack` → `review` → `submitted`) driven by `classifyReEntry`. A tenant who wants to simply *see everything they've uploaded* — with status, and the ability to re-open one — has no persistent list. The data already exists: the documents GET (`documents/route.ts:147-160,206`) returns a `file_url` (300s signed URL) per uploaded doc; nothing surfaces it as a browsable list. [Confirmed]

2. **No review/edit of the application after intake.** Intake answers are editable only *during* the linear intake flow via `SectionReview` Edit links (`SectionReview.tsx:82-89` → `onNavigateTo`). Once the tenant reaches the dashboard there is **no entry point back into their answers** — the dashboard (`TenantDashboard.tsx`) has four signing/upload cards and no "review/edit my application." [Confirmed]

3. **Back button broken on documents; navigation janky generally.** The documents page navigates via `window.location.href` (`documents/page.tsx:118,122`) — a full document load that discards SPA history — and switches sub-screens via internal `pageView` state (`:44,126-167`) that the browser back button cannot reach. So browser-back from `review`/`submitted` doesn't return to the card stack; it leaves the flow entirely. [Confirmed]

4. **Download-copy link offered for incomplete apps.** The dashboard renders "Download my application copy" whenever `intake_status === 'complete'` (`TenantDashboard.tsx:275-291`), but the endpoint returns **403 JSON** unless `intake_status === 'complete'` *and* (effectively) a signed packet exists (`print/download/route.ts:117-123`) — and for an app that's complete-but-not-finalized it merges an empty/partial packet. The link is shown/enabled before the copy is meaningful, so a tenant can click into a 403 or an empty PDF. [Confirmed]

These ride on a **sharp data interaction.** `intake/complete` (`intake/complete/route.ts:113-124`) writes the answers into the **immutable `intake_snapshot`** and sets `intake_data = '{}'`. `generate-forms` reads `intake_snapshot` (`generate-forms/route.ts:59`). So an "edit my application" surface that writes the existing `intake_data` path (`intake/[section]/route.ts`) would write to an empty field that generation no longer reads — the edit would be invisible to the packet. Editing after generation/signing must therefore: write the corrected snapshot, **invalidate + regenerate** the affected forms (PRD-66 version bump), and **reset signing** so the tenant re-signs (PRD-62 Check 5 already blocks finalize on a stale hash). Editing is only legal **before** submission — `withTenantContext` returns 409 `submitted_locked` once `submitted_at` is set (`tenantEndpoint.ts:42-47`). [Confirmed]

---

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) | Fix shape |
|---|---|---|---|
| A | No view-all-documents list; flow is upload-only | `documents/page.tsx:26-31` (`PageView`), `:139-168` (`classifyReEntry` drives view) | add a `view_all` screen listing every doc with status + signed `file_url`; reachable from dashboard, before & after submission |
| B | No edit entry after intake | `TenantDashboard.tsx:222-272` (4 cards, no review/edit) | add a "Review & edit my application" entry → review surface reusing intake section components |
| C | `intake_data` empty post-complete; edits would target the wrong field | `intake/complete/route.ts:121` (`intake_data:'{}'`), `generate-forms/route.ts:59` (reads `intake_snapshot`) | post-complete edits write `intake_snapshot` (via a dedicated edit endpoint), then regenerate |
| D | Broken browser-back; full-page nav | `documents/page.tsx:118,122` (`window.location.href`), `:44,126-167` (internal `pageView` state) | replace with `router.push`; reflect sub-views in URL (`?view=`) or add explicit back affordances so back is never a dead-end |
| E | Edit after generation can desync signed packet | `generate-forms/route.ts` (regen), `completeForm.ts:283-308` (`signing_status`), PRD-66 `generation_version`, PRD-62 Check 5 | edit → confirm "you'll need to re-sign" → regenerate (version bump) → clear collected signatures for changed forms → `signing_status` recomputed |
| F | Download link shown for not-yet-downloadable apps | `TenantDashboard.tsx:275-291`, `print/download/route.ts:117-123` (403) | gate link on a true "ready to download" signal (finalized / signed packet present), not just `intake_status==='complete'` |
| G | Building & unit must stay read-only | building/unit live on `pbv_full_applications`, not in `components/pbv/intake/*` (managed by `intake/page.tsx:135-157` + `unit/route.ts`) | the edit surface never exposes building/unit as editable; show them read-only with the existing "call the office" line |

`signing_status` enum is `('not_started','summary_signed','in_progress','complete')` (`useIntakeBootstrap.ts:17`). The intake section components (`SectionHousehold` … `SectionHouseholdExpenses`) are pure controlled components taking `{ language, intakeData, onChange }` (`intake/[section]/page.tsx:211-233`) — reusable as-is in an edit surface. [Confirmed]

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Documents flow | `documents/page.tsx` | `card_stack`/`review`/`submitted` only; no view-all; full-page nav |
| Documents GET | `documents/route.ts:147-208` | already returns `file_url` (300s signed), `status`, `category`, `current_revision`, `rejection_reason_display` per doc — the data a view-all needs |
| Almost-done review | `components/pbv/cards/AlmostDoneReview.tsx` | groups uploaded docs by category w/ Retake — a near-twin of the desired view-all; can be generalized rather than duplicated |
| Dashboard | `components/pbv/sign/TenantDashboard.tsx` | 4 task cards; download link `:275-291`; no review/edit or view-docs entry |
| Intake sections | `components/pbv/intake/*`, dispatched `intake/[section]/page.tsx:211-233` | controlled `{language,intakeData,onChange}` components; reusable |
| Intake review surface | `components/pbv/intake/SectionReview.tsx` | per-section blocks w/ Edit → `onNavigateTo`; the pattern to reuse |
| Section save | `intake/[section]/route.ts:52-77` | merges into `intake_data`; sets `in_progress`; blocked once `submitted_at` (via `withTenantContext`) |
| Intake complete | `intake/complete/route.ts:113-124` | writes `intake_snapshot`, **sets `intake_data='{}'`** — the post-complete edit hazard |
| generate-forms | `generate-forms/route.ts:36,59` | gated on `intake_status==='complete'`; reads `intake_snapshot`; PRD-66 adds `generation_version` + versioned path |
| Tenant lock | `lib/pbv/tenantEndpoint.ts:42-47` | 409 `submitted_locked` once `submitted_at` set — edit must be pre-submission |
| Signing reset | `lib/pbv/signing/completeForm.ts:283-308` | `updateApplicationSigningStatus` recomputes `signing_status` from form-doc statuses |
| Download | `print/download/route.ts:117-123` | 403 unless `intake_status==='complete'`; merges only `status='signed'` form docs (`:28-32`) |
| Navigation | `documents/page.tsx:118,122`; sign pages use `router.push`/`Link` (`sign/forms/page.tsx:54`) | mixed: documents uses `window.location.href`, rest uses the router |

---

## Goals

1. A persistent **View my documents** screen, reachable from the dashboard, listing every document with status; uploaded docs are viewable (signed `file_url`); each can be re-opened to retake/replace **before** submission, view-only/download **after** submission.
2. A **Review & edit my application** surface, reachable from the dashboard, showing every intake answer grouped by section, each section editable by **reusing the existing intake section components** — **except building & unit, which are read-only.**
3. Editing an answer **after** forms were generated/signed: corrects the canonical snapshot, **regenerates** the affected forms (PRD-66 version bump), and **resets signing** for changed forms so the tenant re-signs — gated behind an explicit "this will require you to review and sign again" confirmation. No silent desync of the signed packet from the data.
4. The browser **back button works** across the tenant flow, and there are consistent back/breadcrumb affordances; no full-page `window.location.href` navigation inside the documents flow.
5. The **Download my application copy** link only appears/enables when the copy is actually downloadable (finalized / signed packet present), never on an incomplete app.
6. A **Usability findings** inventory of the tenant flow, with in-scope fixes implemented and deferred items flagged.

## Non-goals

- **No** full router rearchitecture of the documents flow if a targeted fix (router.push + URL-reflected sub-view + explicit back) restores browser-back. The internal `pageView` machine may stay; it just must not break back.
- **No** change to the signing-completion internals (PRD-62), the regenerate-versioning mechanics (PRD-66), or `generate-forms` generation logic beyond invoking regenerate + clearing the changed forms' collected signers on edit.
- **No** office-side admin UI, no edit *after* submission (post-submission is read-only with a "contact the office" path), and **no** building/unit editing by the tenant (Stanton-fixed).
- No new conditional intake fields (PRD-57 surface); the edit surface exposes exactly the sections that already exist.

---

## Implementation phases

### Phase 1 — View-all-documents screen + navigation/back fix

- **View-all screen.** Add a `view_all` view to the documents page (or a sibling route `documents/all`; default: a `view_all` `PageView` reachable directly so it has a stable URL — see nav fix). It lists **every** document from the documents GET grouped by category (reuse/generalize `AlmostDoneReview`'s categorization — `AlmostDoneReview.tsx:120-203` — rather than writing a parallel grouper), showing per doc: plain-language title (`getDocTitle`), status badge (missing/submitted/approved/rejected/waived), `rejection_reason_display` when rejected, revision, and a thumbnail/open link from `file_url`.
  - **Before submission:** each uploaded doc has **View** (open `file_url`) + **Retake/Replace** (re-enter the card stack at that doc — reuse `handleRetakeFromReview` / `findCardIndexById`, `documents/page.tsx:129-132`); missing docs have **Upload**.
  - **After submission (`submitted_at` set):** **View/Download only** — no Retake/Replace. The card-stack upload path is already blocked server-side by `withTenantContext`; the UI must not offer it.
- **Dashboard entry.** Add a "View my documents" affordance to `TenantDashboard.tsx` (a link/secondary card) → `router.push(/pbv-full-app/${token}/documents?view=all)`. Available before and after submission.
- **Navigation/back fix (finding D).** In `documents/page.tsx`:
  - Replace `window.location.href` (`:118,122`) with `useRouter().push(...)` so dashboard/summary handoffs keep SPA history.
  - Reflect the sub-view in the URL via a `?view=` search param (e.g. `cards|review|all|submitted`) read with `useSearchParams`, so browser **back** moves between sub-views and never dead-ends mid-flow. [Inference] If reflecting every sub-view in the URL is more than a targeted fix, the minimum bar is: every non-initial sub-view (`review`, `view_all`) has an explicit on-screen Back affordance that returns to the prior view (the `AlmostDoneReview` header back at `:303-315` is the pattern), **and** browser-back from the documents page returns to the dashboard rather than leaving the app.
  - Keep `window.location.reload()` in the error fallback (`:193`) — that's an intentional retry, not navigation.

### Phase 2 — Review & edit application (with regenerate-on-edit)

- **Edit surface.** Add a route `app/pbv-full-app/[token]/review/page.tsx` (or a dashboard-launched view) rendering, per visible section, a read-only summary block with an **Edit** button — mirroring `SectionReview.tsx:74-93` / `DisplayBlockWrapper`. Editing a section opens the **existing** section component (`SectionHousehold` … `SectionHouseholdExpenses`) in an edit context. **Building & unit are rendered read-only** (the existing `intake/page.tsx:188-219` "Your Unit" card + "call the office" line), never as an editable field (finding G).
  - The data source for the surface is the canonical snapshot when intake is complete (`intake_snapshot`), else `intake_data`. Surface the bootstrap so it exposes whichever is canonical. [Inference — bootstrap currently returns `intake_data`; confirm it returns the snapshot post-complete, else extend it. Default-and-log.]
- **The post-complete edit endpoint (finding C).** Saving an edit when `intake_status === 'complete'` must write the corrected section into **`intake_snapshot`** (not the emptied `intake_data`), because `generate-forms` reads the snapshot (`generate-forms/route.ts:59`). Add a dedicated edit-save path (e.g. `PATCH intake/[section]` behavior, or a new `intake/edit` endpoint) that:
  - is wrapped in `withTenantContext` (so it 409s if `submitted_at` is set — editing is **pre-submission only**),
  - merges the section into `intake_snapshot` (and keeps `intake_data` consistent / re-bridges household members via the same `bridgeIntakeToDatabase` path if member-shape fields changed — `intake/complete/route.ts:150-314`). [Inference: a member-shape edit (add/remove person, income) changes `pbv_household_members`, which `generate-forms` reads; the edit must re-bridge so regeneration sees the new household. Default: re-run the bridge for member-affecting sections; log to OPEN-DECISIONS.]
- **THE KEY INTERACTION — edit → regenerate → re-sign (finding E).** When the tenant confirms an edit to a section that feeds already-generated/signed forms:
  1. **Confirm gate.** Show "This change means you'll need to review and sign your forms again." with confirm/cancel. No silent edit of signed data.
  2. **Persist** the corrected snapshot (above).
  3. **Regenerate** the affected forms by calling the existing `generate-forms` (it's idempotent and re-stamps from the snapshot). Per PRD-66, a regenerate while signatures exist **bumps `generation_version`** and writes a new versioned unsigned path + new `unsigned_pdf_hash`; it does **not** silently overwrite the bytes a signer committed to.
  4. **Reset signing for changed forms.** Clear `collected_signer_member_ids` (set `[]`) and set `status='generated'` on the regenerated form docs, and clear the summary signature if the summary content changed, then call `updateApplicationSigningStatus` (`completeForm.ts:283-308`) so `signing_status` drops from `complete`/`in_progress` back to reflect the unsigned forms. The dashboard cards (`useDashboardState.ts:87-118`) recompute `forms_signed`/`can_submit` automatically.
  5. **Enforcement backstop.** Even without an explicit reset, PRD-62 Check 5 + PRD-66's version bump cause finalize to **block** with a "hash mismatch — please re-sign" message (the regenerated bytes have a new `unsigned_pdf_hash` that no longer matches the old `document_hash`). The explicit reset is the UX; Check 5 is the guardrail. [Inference]
  - **Scope of "affected forms":** default to **regenerate all enabled forms + clear all collected signatures** on any post-generation intake edit (simplest correct behavior — generation is idempotent and cheap relative to the integrity risk). A per-field "which forms does this section touch" map is a future optimization, **not** built here; log to OPEN-DECISIONS. [Inference]
- **After submission.** The review surface is **read-only** with a "To make changes, contact the office at (860) 527-3813" path. The edit endpoint's 409 `submitted_locked` is the server backstop; the UI must not present editable fields once `submitted_at` is set.

### Phase 3 — Usability fixes + download-link gating

- **Download link gating (finding F).** In `TenantDashboard.tsx`, change the link condition (`:275`) from `intake_status === 'complete'` to a true downloadable signal — e.g. `data.submitted_at` (finalized) **or** a derived "signed packet exists" (`forms_total>0 && forms_signed>=forms_total && summary_signed`), matching what `print/download` will actually return. When not yet downloadable, either hide the link or render it disabled with the existing `download_copy_sub` explaining it's available after submission. Default: gate on `submitted_at` (the unambiguous "your copy is ready" point); log to OPEN-DECISIONS. [Inference]
- **Implement the in-scope usability fixes** from the findings table below.
- **Document deferred items** in the build report with a recommended owner/PRD.

---

## Usability findings (tenant flow inventory)

Inventoried across `documents/page.tsx`, `dashboard/page.tsx`, `TenantDashboard.tsx`, `intake/*`, `sign/*`, `AlmostDoneReview.tsx`, `DocumentCardStack.tsx`.

| # | Finding | Where | Severity | In scope? | Fix |
|---|---|---|---|---|---|
| U1 | Broken browser-back / full-page nav in documents | `documents/page.tsx:118,122` | High | **Yes (P1)** | router.push + URL-reflected sub-view / explicit back (Phase 1) |
| U2 | No way to see all uploaded documents | `documents/page.tsx` flow | High | **Yes (P1)** | view-all screen (Phase 1) |
| U3 | No edit entry after intake | `TenantDashboard.tsx` | High | **Yes (P2)** | review/edit surface (Phase 2) |
| U4 | Download link offered on incomplete/unfinalized app → 403/empty PDF | `TenantDashboard.tsx:275`, `print/download/route.ts:117` | Med | **Yes (P3)** | gate on downloadable signal (Phase 3) |
| U5 | `handleSeeFullList` is a stub `alert('Sidesheet coming in Phase 3')` | `DocumentCardStack.tsx:231-238` | Med | **Yes (P3)** | wire to the new view-all screen instead of alert |
| U6 | Hardcoded help phone mismatch — `(203) 555-1234` in card stack vs `(860) 527-3813` everywhere else | `DocumentCardStack.tsx:555` vs `intake/page.tsx:30` | Med | **Yes (P3)** | replace placeholder with the real office number (or `getOfficeContact`) |
| U7 | No progress indicator on the dashboard hub (intake has one; hub doesn't beyond per-card text) | `TenantDashboard.tsx` | Low | Deferred | overall "X of Y steps" — flag for follow-up |
| U8 | `submitted` view dead-ends to dashboard only; no "view my submitted application/documents" | `documents/page.tsx:203-227` | Med | **Yes (P1, via U2)** | submitted state links to view-all (read-only) |
| U9 | PT strings marked tentative across the flow | `intake/page.tsx:92`, `TenantDashboard.tsx:103` | Low | Deferred | covered by PRD-59 prose-authoring flag |
| U10 | Intake `?filter=rejected` deep-link from dashboard banner (`TenantDashboard.tsx:209,262`) isn't consumed by `documents/page.tsx` | `documents/page.tsx` (no `searchParams` read) | Med | **Yes (P1)** | when wiring `useSearchParams` for the back fix, also honor `filter=rejected` to open rejected docs |
| U11 | No confirmation when leaving the upload flow with missing docs (silent) | `DocumentCardStack.tsx:512-527` | Low | Deferred | the end-screen already lists "still needed"; acceptable for launch |

In-scope: U1, U2, U3, U4, U5, U6, U8, U10. Deferred (flag in build report): U7, U9, U11.

---

## Verification / test plan

Static gates run in-session; runtime/device gates need a deployed preview + a phone walk.

### Static (must pass before commit)
- **Gate 1 (view-all):** a unit/component test renders the view-all screen from a documents-GET fixture covering missing/submitted/approved/rejected and asserts every doc appears with its status; uploaded docs expose a View action; after submission, no Retake/Replace action renders.
- **Gate 2 (edit reuses intake components):** a test asserts the review/edit surface renders the existing `Section*` components (e.g. mounts `SectionHousehold`), not a parallel form.
- **Gate 3 (building/unit read-only):** a test asserts building & unit are rendered read-only in the edit surface and there is no editable input bound to them.
- **Gate 4 (regenerate-on-edit):** a test of the edit-save path asserts that, when `intake_status==='complete'` and a section is edited, the handler (a) writes `intake_snapshot` (not `intake_data`), (b) invokes regenerate, and (c) clears the changed forms' `collected_signer_member_ids` / resets `signing_status` — and that the confirm gate fires before any of it.
- **Gate 5 (back works):** a test asserts the documents page uses `router.push` (no `window.location.href` for nav) and that sub-views are reachable/leavable via the router (URL param or explicit back), with `filter=rejected` honored.
- **Gate 6 (download gating):** a test asserts the download link is absent/disabled when not downloadable and present when `submitted_at` (or the signed-packet signal) is set.
- **Gate 7:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean; `vitest run` green.

### Deferred to the post-run verification pass (list in build report; do NOT block)
- **Gate R1:** on a deployed preview + phone, walk to the dashboard, open View my documents, confirm every uploaded doc opens; tap browser back and confirm it returns to the dashboard (not out of the app).
- **Gate R2:** on a complete-but-not-finalized app, edit an intake answer, confirm the re-sign warning, confirm forms regenerate and the signing cards reset to unsigned, and that finalize is blocked until re-signed.
- **Gate R3:** confirm the download link is hidden until finalize; after finalize it returns a real merged PDF (not 403/empty).
- **Gate R4:** confirm editing after `submitted_at` is set is impossible (UI read-only + endpoint 409).

---

## Open questions

- **O1:** Post-complete edit-save target — write `intake_snapshot` directly via a dedicated edit endpoint, vs. moving the snapshot back to `intake_data`, re-running `intake/complete`, and regenerating. Default: dedicated edit endpoint writing the snapshot + explicit regenerate/reset (fewer moving parts than round-tripping the whole completion). Log to OPEN-DECISIONS; confirm post-run. [Inference]
- **O2:** "Affected forms" granularity — regenerate-all + clear-all-signatures on any post-generation edit (default, taken) vs a per-section→forms impact map. Default chosen for correctness/simplicity. Log to OPEN-DECISIONS. [Inference]
- **O3:** Whether a member-shape edit (add/remove person, income source) must re-run `bridgeIntakeToDatabase` before regenerate. Default: yes, re-bridge for member-affecting sections (else regeneration reads stale `pbv_household_members`). Log to OPEN-DECISIONS. [Inference]
- **O4:** Download-link gate signal — `submitted_at` vs derived "signed packet exists." Default: `submitted_at`. Log to OPEN-DECISIONS. [Inference]
- **O5:** Whether a column is needed to mark "edited after generation" for office visibility. Default: **not built** — the `generation_version` bump (PRD-66) + `signing_status` reset already record that a regenerate happened; an explicit `intake_edited_after_generation_at` is optional. If a migration is added, it is **write-not-apply** + listed in OPEN-DECISIONS. [Inference]

## Decisions

- **D1:** Editing is **pre-submission only** — enforced by `withTenantContext` 409 `submitted_locked`. Post-submission review is read-only with a "contact the office" path. (Per `tenantEndpoint.ts:42-47`.)
- **D2:** Post-complete edits write the canonical `intake_snapshot` (not the emptied `intake_data`), because `generate-forms` reads the snapshot. (Per `intake/complete/route.ts:121`, `generate-forms/route.ts:59`.)
- **D3:** Edit → confirm "review & sign again" → regenerate (PRD-66 version-safe) → clear changed forms' collected signatures + recompute `signing_status`. PRD-62 Check 5 is the enforcement backstop. **No silent desync** of the signed packet from the data.
- **D4:** Reuse the existing intake `Section*` components in the edit surface; do not build parallel UI. Generalize `AlmostDoneReview`'s categorization for the view-all rather than duplicating it.
- **D5:** Building & unit are tenant-read-only (Stanton-fixed); the edit surface never exposes them as editable.
- **D6:** Targeted nav fix (router.push + URL-reflected sub-view / explicit back) over a full router rearchitecture — the bar is "browser back works and never dead-ends."
- **D7:** Download link gated on `submitted_at` (the unambiguous "copy ready" point), not `intake_status==='complete'`.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `app/pbv-full-app/[token]/documents/page.tsx` | 1 | add `view_all` sub-view; `router.push` instead of `window.location.href`; `useSearchParams` (`view=`, `filter=rejected`) so back works |
| `components/pbv/cards/AlmostDoneReview.tsx` (or a new `DocumentList` extracted from it) | 1 | generalize categorization/grouping for a persistent view-all (view-only after submission) |
| `components/pbv/sign/TenantDashboard.tsx` | 1, 3 | add "View my documents" + "Review & edit my application" entries; gate the download link on `submitted_at` |
| `components/pbv/cards/DocumentCardStack.tsx` | 3 | wire `handleSeeFullList` to the view-all screen (replace the `alert` stub); fix the placeholder help phone (U6) |
| `app/pbv-full-app/[token]/review/page.tsx` (new) | 2 | review/edit surface reusing `Section*` components; building/unit read-only |
| `app/api/t/[token]/pbv-full-app/intake/[section]/route.ts` (or new `intake/edit` endpoint) | 2 | post-complete edit writes `intake_snapshot`; re-bridge for member-affecting sections; under `withTenantContext` (409 once submitted) |
| edit-triggered regenerate/reset (in the edit endpoint or a small `lib/pbv/regenerateAfterEdit.ts`) | 2 | call `generate-forms`; clear changed forms' `collected_signer_member_ids`/`status='generated'`; `updateApplicationSigningStatus` |
| `supabase/migrations/<ts>_prd67_intake_edited_after_generation.sql` (only if O5 resolves "yes") | 2 | `intake_edited_after_generation_at` column — **commit only, list in OPEN-DECISIONS, do not apply** |
| tests (new) | 1–3 | view-all renders all docs + view-only-after-submission; edit reuses `Section*`; building/unit read-only; edit→regenerate→signature-reset + confirm gate; back uses router + honors `filter=rejected`; download-link gating |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
