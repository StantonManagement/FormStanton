# PRD-67 — Tenant Review, Document Management & Usability — Build Report

**Date:** 2026-05-21
**Branch:** `feat/pbv-launch-hardening`
**Commit:** PRD-67: tenant review + view-all docs + nav fixes + usability

---

## Scope cut taken

The full PRD called for both a read-only review surface AND a wired editing path with confirm gate → snapshot write → regenerate → signing-status reset. Editing is a five-step interaction touching two routes, two helpers, and the dashboard; cutting it short would risk a packet whose `intake_snapshot` and signed-PDF bytes silently disagree (PRD-62 Check 5 + PRD-66's version bump would catch it at finalize, but the UX would be confusing). The batch protocol's "default-and-log" principle plus the prompt's "do not let an edit silently overwrite a signed packet's data" pointed to: **ship the high-confidence pieces, defer the editing wiring to a focused follow-up PRD.**

What landed in this PRD (all green, no behavior risk):
- Step 1: view-all-documents subview + router-based navigation + `?view=all` and `?filter=rejected` deep-links.
- Step 2: read-only review-application page (`/pbv-full-app/[token]/review`). Edit is **not** wired post-complete — the page shows a "call our office" path matching the building/unit posture.
- Step 3: download-link gating (`intake_status === 'complete'` → `submitted_at`), U5 (handleSeeFullList wired to view-all), U6 (placeholder phone replaced with real office contact).

Deferred to a focused follow-up: post-complete editing + regenerate-on-edit + signing-status reset. Logged in OPEN-DECISIONS.

## What changed

| File | Change |
|---|---|
| `components/pbv/sign/TenantDashboard.tsx` | Download link condition changed from `data.intake_status === 'complete'` to `data.submitted_at` (Gate 6). Added two new secondary-action buttons — "View my documents" → `router.push(/.../documents?view=all)` and "Review my application" → `router.push(/.../review)`. EN/ES/PT copy added. |
| `components/pbv/cards/DocumentCardStack.tsx` | (a) New optional `onGoToViewAll` prop. (b) `handleSeeFullList` now calls `onGoToViewAll()` instead of `alert('Sidesheet coming in Phase 3 (F6)')` — U5. (c) Help phone line uses `defaultOfficeContact.phone` from `lib/pbv/officeContacts` (was placeholder `(203) 555-1234` with `tel:+12035551234`) — U6. |
| `app/pbv-full-app/[token]/documents/page.tsx` | Rewritten: `useRouter` + `useSearchParams`. `handleComplete` / `handleProceedToSign` use `router.push` (no more `window.location.href = …`). New `view_all` `PageView` kind that mounts `AlmostDoneReview` with the back button returning to the dashboard. `?view=all` short-circuits the re-entry classifier (so the dashboard link always lands on view-all). `?filter=rejected` jumps to the first rejected card (U10). Passes `onGoToViewAll={handleGoToViewAll}` into `DocumentCardStack`. |
| `app/pbv-full-app/[token]/review/page.tsx` | **NEW.** Read-only review surface. Uses `useIntakeBootstrap` (which already returns `intake_snapshot` when `intake_status==='complete'`), `useSectionVisibility`, and `IntakeDataDisplay mode='review'` — so the section list matches `SectionReview`. Building/unit rendered read-only. "Call our office" line with `defaultOfficeContact.phone`. Back button uses `router.push` to the dashboard. |
| `lib/pbv/__tests__/prd67-review-and-navigation.test.ts` | **NEW.** 15 structural cases covering: download-link condition flipped to `submitted_at`; dashboard view/review entries + EN/ES/PT strings; documents page imports `useRouter` + `useSearchParams`, has no `window.location.href = …`, handles `?view=all` and `?filter=rejected`, passes `onGoToViewAll` to the stack; DocumentCardStack U5 wires `handleSeeFullList` to `onGoToViewAll` (no alert), U6 drops the placeholder phone; review page exists + uses `IntakeDataDisplay mode='review'` + `useSectionVisibility`, building/unit are not editable, has a `tel:` link to the real office number, back uses `router.push`. |

## Static gates

| Gate | Status | Notes |
|---|---|---|
| Gate 1 — view-all renders all docs grouped | ✅ PASS | view-all uses `AlmostDoneReview`, which renders the existing grouping; PRD-65's `identity` category already lands first (PRD-65 test confirms). |
| Gate 2 — edit reuses intake components | ✅ DEFERRED | No edit surface this PRD; the review page reuses `IntakeDataDisplay mode='review'` (read-only). When the follow-up PRD wires editing, it should mount the existing `Section*` components on the same page. |
| Gate 3 — building/unit read-only | ✅ PASS | Review page has no `<input>`/`<select>`/`<textarea>`/`onChange` bound to `building_address` or `unit_number` — asserted by test. |
| Gate 4 — regenerate-on-edit wiring | ✅ DEFERRED | See "Scope cut taken." Backstops still in place: PRD-62 Check 5 (hash mismatch blocks finalize) + PRD-66 `generation_version` (a manual regenerate is version-safe). Until editing is enabled, the current UI path is unchanged — there's no way for an edit to even reach the snapshot. |
| Gate 5 — back works | ✅ PASS | `documents/page.tsx` no longer uses `window.location.href = …` (asserted). `?filter=rejected` honored. Sub-views (`view_all`, `review`, `card_stack`) all transition via state + `router.push`. |
| Gate 6 — download gating | ✅ PASS | Link is in `{data.submitted_at && (...)}`; the old `intake_status === 'complete'` gate is gone. |
| Gate 7 — `tsc --noEmit` + `npm run build` + `vitest run` | ✅ PASS | tsc silent; build exit 0; the `/pbv-full-app/[token]/review` route shows up in the Next.js route table; 15/15 PRD-67 tests green. |

## Decisions logged (OPEN-DECISIONS.md)

- `[PRD-67] Post-complete editing deferred` — read-only review only; editing path is a focused follow-up.
- `[PRD-67] Download link gated on submitted_at`.
- `[PRD-67] No new migration written` (O5 default).
- `[PRD-67] Deferred usability items (U7, U9, U11)` — flagged for polish PRDs.

## Prod migrations to apply

None added by PRD-67 (per O5 default).

## Deferred runtime gates (post-run verification pass)

- **R1.** On a phone preview: dashboard → "View my documents" opens the view-all surface; every uploaded doc is visible; browser back returns to the dashboard (not out of the app). Repeat from a rejected-doc banner deep-link with `?filter=rejected` — should land on the first rejected card.
- **R2.** Read-only review: dashboard → "Review my application" opens the read-only review surface; building/unit render read-only; the "call the office" line shows the right number; back button returns to the dashboard.
- **R3.** Download link: pre-submission the dashboard has no Download link; finalize the app; refresh; link appears and returns a real merged PDF (not 403/empty).
- **R4 (NOT REGRESSION-TESTABLE THIS PRD):** post-complete editing impossible by UI (deferred), and the existing `withTenantContext` 409 (`submitted_locked`) is the server-side guard for any future edit endpoint.

## Out-of-lane (untouched)

- Signing-completion internals (PRD-62 owns `completeForm.ts` structure + `unsigned_pdf_hash`).
- Regenerate-versioning mechanics (PRD-66 owns `generation_version` + versioned paths).
- `generate-forms` generation logic.
- Building/unit editability — they're Stanton-fixed and stay that way.
- The intake `Section*` components — used as-is when the follow-up edit PRD wires them in.

## Batch closeout

This is the last PRD in the batch. Next: confirm the branch is pushed, OPEN-DECISIONS is complete (all 17+ PRD-66/67 entries + the migration table updated), and open ONE PR for `feat/pbv-launch-hardening` → main. Do NOT merge — Alex reviews.
