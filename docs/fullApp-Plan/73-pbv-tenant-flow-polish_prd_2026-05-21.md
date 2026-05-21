# PRD-73 — Tenant-Flow Polish (Hub Progress Indicator + Leave-With-Missing Confirmation)

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** part of the tenant-polish batch (see batch-run prompt) — one branch off `main` after the 55–70 launch merge.
**Status:** Draft — ready for build
**Severity:** P3 — UX polish. Neither item is a launch blocker; both reduce tenant confusion/abandonment. Purely presentational — no data-model change.
**Depends on:** PRD-67 (shipped the dashboard hub + read-only review). These are PRD-67's explicitly deferred usability items.
**Source:** PRD-67 deferred usability items (`OPEN-DECISIONS.md:368-372`, U7 + U11). Grounded against current code 2026-05-21.

---

## Problem statement

**U7 — no hub progress indicator.** The tenant dashboard shows four task cards each with its own status, but nothing tells the tenant how far through the *whole* application they are. The only progress UI anywhere is the per-stack `DocumentProgressBar` (documents only).

**U11 — no leave-with-missing confirmation.** A tenant can navigate away from the documents/dashboard flow with required items still missing and get no warning. A `beforeunload` guard exists, but only on the linear intake page (`[token]/page.tsx`), not on the hub or the documents page.

## Root cause / findings (confirmed in code 2026-05-21)

| # | Finding | Where (confirmed) |
|---|---|---|
| 1 | Hub renders 4 task cards; per-card status derived inline | `components/pbv/sign/TenantDashboard.tsx:230-280`; statuses at `:145`, `:147-153`, `:158-163`, `:276` |
| 2 | `CardStatus = 'locked'\|'pending'\|'in_progress'\|'complete'` | `components/pbv/sign/DashboardCard.tsx:12` |
| 3 | No aggregate/global progress exists; only per-stack doc bar | `components/pbv/sign/DocumentProgressBar.tsx:40` |
| 4 | All data for a hub indicator is already client-side | `lib/pbv/hooks/useDashboardState.ts:25-51` (`summary_signed`, `forms_signed`/`forms_total`, `upload_complete`/`upload_total`, `additional_signers_pending_count`, `can_submit`, `intake_status`, `signing_status`, `submitted_at`) |
| 5 | `beforeunload` guard pattern to mirror | `app/pbv-full-app/[token]/page.tsx:556-567` (active while `pageState` ∈ form/signatures/signature_review) |
| 6 | In-flow trilingual `confirm()` pattern to mirror | `components/pbv/cards/DocumentCard.tsx:281` |
| 7 | Trilingual copy convention in these components: inline `Record<lang, …>` at module top | `TenantDashboard.tsx:52-136`, `DocumentCardStack.tsx:75-104` |

## Goals

1. **U7:** the dashboard shows a hub-level progress indicator (e.g. "Step X of 4 complete" + a bar) derived from the four existing card statuses. Purely presentational; no new fetch.
2. **U11:** attempting to leave the documents/dashboard flow with required items still missing prompts a trilingual confirmation before the tenant goes.

## Non-goals

- **No** data-model change, no new endpoint, no new fetch — both items consume existing `DashboardData` and existing document state.
- **No** change to defer ("I'll get this later", `DocumentCard.tsx:473-482`) or re-entry classification (`classifyReEntry.ts`).
- **No** progress UI on sub-screens beyond the hub; **no** new modal/dialog library — mirror the existing `beforeunload` + `confirm()` patterns.

## Implementation

1. **U7 (hub progress).** In `TenantDashboard.tsx`, compute `completed` from the four already-derived `cardNStatus` values (count `=== 'complete'`), `total = 4` (exclude any `locked` card from the denominator if a task is N/A for this household — e.g. no additional signers). Render a small indicator near the top (reuse `DocumentProgressBar`'s visual style or a simple labeled bar). Trilingual copy via the inline `Record<lang,…>` pattern (`:52-136`). If the derivation is non-trivial, extract a pure `computeHubProgress(data)` helper for unit testing.
2. **U11 (leave-with-missing).** On the documents page (`app/pbv-full-app/[token]/documents/page.tsx`) add a `beforeunload` listener mirroring `[token]/page.tsx:556-567`, active while required documents are still missing (derive from existing doc state / `can_submit === false`). Optionally also intercept the in-app dashboard "exit" with a `confirm()` mirroring `DocumentCard.tsx:281`. Trilingual copy, best-effort PT flagged tentative.

## Verification / test plan

**Static (must pass before commit):**
- `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean (never `npx tsc`).
- vitest: if `computeHubProgress` is extracted, unit-test it (all-complete → 4/4; mixed → correct count; locked task excluded from denominator). Component-level tests optional.

**Deferred (manual Chrome walk — NOT Playwright; list in build report, do not block):**
- **R1:** hub shows the correct N/total as cards complete, in EN/ES/PT.
- **R2:** leaving the documents page with a required doc missing prompts the confirmation; leaving when nothing is missing does not.

## Open questions

- **O1 (progress granularity):** 4 top-level tasks (default — matches the cards, simple, accurate) vs. weighting by forms/doc counts. Default: 4 tasks.
- **O2 (U11 reach):** `beforeunload` only (default) vs. also intercepting in-app `router.push` back/exit with `confirm()`. Default: `beforeunload` guard; in-app `confirm()` optional, log.
- **O3 (where U11 applies):** documents page (default) and the dashboard; not the read-only review surface.

## Decisions

- **D1:** Derive U7 progress from existing card statuses — no new data, no new fetch.
- **D2:** Mirror the existing `beforeunload` (`page.tsx:556`) and `confirm()` (`DocumentCard.tsx:281`) patterns; do not introduce a modal library.

## Files expected to change

| File | Change |
|---|---|
| `components/pbv/sign/TenantDashboard.tsx` | U7 indicator + trilingual copy; optional `computeHubProgress` helper |
| `app/pbv-full-app/[token]/documents/page.tsx` | U11 `beforeunload` guard (mirror intake page) |
| tests (new, if helper extracted) | `computeHubProgress` unit test |

If anything outside this list needs changing, take the safe default and log it to OPEN-DECISIONS rather than expanding scope.
