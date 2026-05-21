# Build Report — PRD-73: Hub Progress Indicator + Leave-With-Missing Confirmation

**Date:** 2026-05-21
**Branch:** `feat/pbv-tenant-polish` (branched off `feat/pbv-launch-hardening` — that branch is not yet merged to `main`, per the batch-run prompt fallback)
**Commit:** `11a771a` (pushed to `origin/feat/pbv-tenant-polish`)
**Status:** ✅ Static gates green. UI/runtime verification deferred to the manual Chrome walk.

---

## Premise — confirmed in code 2026-05-21

PRD-73 findings re-verified before changes:

- Hub renders 4 task cards with statuses derived inline at [TenantDashboard.tsx:145, :147-153, :158-163, :276](components/pbv/sign/TenantDashboard.tsx).
- `CardStatus = 'locked' | 'pending' | 'in_progress' | 'complete'` from [DashboardCard.tsx:12](components/pbv/sign/DashboardCard.tsx).
- All hub data is already client-side via [useDashboardState.ts:25-51](lib/pbv/hooks/useDashboardState.ts) — no new fetch needed.
- `beforeunload` pattern at [app/pbv-full-app/[token]/page.tsx:556-567](app/pbv-full-app/[token]/page.tsx) — mirror exactly.

Premise stands. Built.

---

## What changed

| File | Change |
|---|---|
| [lib/pbv/computeHubProgress.ts](lib/pbv/computeHubProgress.ts) (new) | Pure helper: `computeHubProgress(statuses: CardStatus[]): { completed, total, percentage }`. Locked cards drop out of both numerator and denominator; complete cards add to the numerator; pending/in_progress count toward the denominator only. Percentage rounded 0–100, divide-by-zero safe. |
| [lib/pbv/__tests__/computeHubProgress.test.ts](lib/pbv/__tests__/computeHubProgress.test.ts) (new) | 9 vitest cases — all-complete (4/4), all-pending (0/4), mixed (1/4), locked-excluded (1/3), multi-locked (2/2), all-locked (0/0 no NaN), in_progress doesn't count, rounding 3/4=75%, rounding 2/3=67%. |
| [components/pbv/sign/TenantDashboard.tsx](components/pbv/sign/TenantDashboard.tsx) | Added `hub_progress(completed, total) => string` to `CopyMap` for EN/ES/PT. Extracted `card4Status: CardStatus` as a const (was inline in JSX) so all four can feed the helper. Calls `computeHubProgress` and renders a label + percentage + colored bar between the subtitle and the application-status banner, mirroring `DocumentProgressBar`'s visual style (color: gray @ 0%, amber @ 1–99%, green @ 100%). `role="progressbar"` + `aria-*` for screen readers. Always rendered (a green 4/4 bar on a submitted application is a useful confirmation). |
| [app/pbv-full-app/[token]/documents/page.tsx](app/pbv-full-app/[token]/documents/page.tsx) | `useEffect` mirroring the intake-page `beforeunload` pattern. Active when any required doc has status `'missing'` or `'rejected'` (= still needs upload). Inactive once the application is submitted. Modern browsers ignore the message string, so this is binary on/off — no copy to translate. Cleanup on unmount removes the listener. |

**No** copy was changed for the existing card subtitles. **No** new fetch. **No** schema or endpoint change.

---

## Static gates — all green ✅

| Gate | Result | Notes |
|---|---|---|
| `node ./node_modules/typescript/bin/tsc --noEmit` | ✅ clean | No errors. |
| `npm run build` | ✅ clean | "Compiled successfully in 56s"; 208/208 static pages generated. Pre-existing env warnings (`RESEND_API_KEY`, `ANTHROPIC_API_KEY`) unchanged. |
| `vitest run lib/pbv/__tests__/computeHubProgress.test.ts` | ✅ 9/9 pass | New test file. |
| `vitest run lib/pbv/__tests__/signer-forms-mapping.test.ts` | ✅ 13/13 pass | Re-verified PRD-72 didn't regress; full batch suite green. |

---

## Decisions taken

| # | Decision | Source |
|---|---|---|
| D1 | Derive U7 progress from the four existing `cardNStatus` values — no new data, no new fetch. | PRD-73 D1 |
| D2 | Mirror the existing `beforeunload` pattern (`[token]/page.tsx:556`); no modal library. | PRD-73 D2 |
| O1 | Four top-level tasks (not weighted by forms/doc counts). Matches the cards 1:1, simple and accurate. | PRD-73 O1 default |
| O2 | `beforeunload` only — no in-app `router.push` intercept with `confirm()`. Keeps the surface area minimal; the in-app intercept is the optional "nice to have" the PRD flagged. | PRD-73 O2 default (logged in OPEN-DECISIONS) |
| O3 | U11 applies to the documents page (default). Not extended to the dashboard surface in this PRD — once the tenant is on the dashboard, all docs are either uploaded or they've made an explicit choice to leave, and there is no in-app navigation away that loses data (only `router.push` to other in-app surfaces). | PRD-73 O3 default |
| Helper-extraction call | Extracted `computeHubProgress` to its own file rather than inlining — exclusion-of-locked logic deserves unit coverage and a clean test boundary. | PRD-73 implementation note "If the derivation is non-trivial, extract a pure helper for unit testing." |

No defaults diverged from the PRD's listed defaults. Nothing was hard-stopped.

---

## Deferred gates (manual Chrome walk — NOT Playwright)

| # | Gate | What to walk |
|---|---|---|
| R1 | Hub shows the correct N/total as cards complete, in EN/ES/PT. | Open the dashboard for an in-progress application. Confirm "Step 0 of N complete" with the gray bar initially; after signing summary, "Step 1 of N" with amber; after all four, "Step 4 of 4" with green. Repeat with `preferred_language='es'` and `'pt'` and verify localized strings. |
| R2 | Leaving the documents page with a required doc missing prompts the native browser dialog; leaving when nothing is missing does not. | Open `/pbv-full-app/[token]/documents` for an app with at least one missing required doc. Try `Ctrl+L` → new URL → Enter, OR close the tab — browser dialog should appear. Upload the doc; repeat — no dialog. Re-test on `?view=all` and `?filter=rejected` subviews (guard activates regardless of subview). |

Per the batch-run prompt: do not run, add, or modify Playwright/e2e. The `E2E Tenant Flow` red check stays red and is not the merge bar.

---

## Prod migrations to apply

None — PRD-73 is code-only.

---

## Cross-PRD flags

- **PRD-72 closes PRD-68 O3** (PT display-name parity). After PRD-72's backfill migration is applied, R1 above will also correctly show PT in the hub_progress copy and the underlying card3 subtitle for documents (DocumentProgressBar already supports PT). No additional plumbing needed.
- **PRD-73 does not affect PRD-72's routes** — the hub progress derives only from local card statuses, not from any API response. Order-independent.

---

## Files expected vs files changed

PRD says:
- `components/pbv/sign/TenantDashboard.tsx` — ✅
- `app/pbv-full-app/[token]/documents/page.tsx` — ✅
- tests (new, if helper extracted) — ✅

Plus the helper file itself (`lib/pbv/computeHubProgress.ts`), which the PRD implicitly authorizes ("If the derivation is non-trivial, extract a pure `computeHubProgress(data)` helper for unit testing"). No scope expansion.
