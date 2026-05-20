# PRD-54 — PBV Summary-Sign Infinite Loop + Broken `/sign` Route

**Date:** 2026-05-20
**Author:** Alex / Cowork session
**Branch:** `fix/pbv-summary-sign-loop-54`
**Status:** Draft — ready for build
**Severity:** P0 — launch blocker
**Depends on:** none (independent hotfix). Touches the tenant full-app signing flow last changed by PRD-14 / PRD-15 / PRD-19.
**Blocks:** Go-live of the PBV full application. A tenant who has finished document upload cannot reach or complete the summary/forms signing steps, so **no application can be submitted end-to-end.**

---

## Problem Statement

A live end-to-end test of the tenant PBV full-app flow on 2026-05-20 (`https://form-stanton.vercel.app/pbv-full-app/<token>`, unit 222-224 Maple Ave 2N) surfaced two connected, launch-blocking defects in the **document → signing** transition, plus a likely server-side cause behind the second.

Document upload itself works: all 11 required forms + 1 optional were uploaded and persisted, and the dashboard correctly flipped to `11 of 11 — 100% — Complete ✓`. The flow breaks immediately after, in two places:

1. **The "let's sign" CTA leads to a 404.** On the document review screen ("Here's everything you sent. Look right?"), the primary CTA **"Looks good — let's sign →"** navigates to `/pbv-full-app/<token>/sign`. No `sign/page.tsx` exists — only `sign/summary`, `sign/forms`, `sign/additional-signers`. The tenant hits a hard **404** at the very end of document upload.

2. **The summary page never loads and floods the API.** Reaching `/sign/summary` (via dashboard "Review and sign your summary → Start") sticks on "Preparing your application summary…" indefinitely. It fires `POST /api/t/<token>/pbv-full-app/generate-forms` continuously — 100+ calls in seconds — and the load makes that endpoint intermittently return **503**. Console shows `[SummarySignPage] generate-forms failed: TypeError: Failed to fetch`. The summary never renders, so the tenant can never sign it. Because the summary step gates "Review and sign required forms" (shown **Locked**) and the final **"Submit my application"** button (disabled), the entire submission is blocked.

Net effect: a tenant who uploaded everything cannot sign or submit, and the retry loop self-DoSes `generate-forms` (cost + 503s that can spill onto other tenants on the same deployment).

---

## Root cause (confirmed in code 2026-05-20)

### Bug A — broken `/sign` route (verified)

`app/pbv-full-app/[token]/documents/page.tsx:121-123`:

```ts
const handleProceedToSign = useCallback(() => {
  window.location.href = `/pbv-full-app/${token}/sign`;   // ← no such route → 404
}, [token]);
```

There is no `app/pbv-full-app/[token]/sign/page.tsx`. The valid children are `sign/summary`, `sign/forms`, `sign/additional-signers`. The CTA itself lives in `components/pbv/cards/AlmostDoneReview.tsx:83` (`"Looks good — let's sign →"`) and calls this handler. Target should be `/pbv-full-app/${token}/sign/summary`.

### Bug B — client re-trigger loop (verified)

`app/pbv-full-app/[token]/sign/summary/page.tsx`:

- `maybeGenerateForms` is a `useCallback` with deps `[state, token, router, reload]` (line 87). Its early return only stops work when `data.forms.length > 0` (line 51).
- `useEffect(() => { maybeGenerateForms(); }, [maybeGenerateForms])` (lines 89-91).
- On success it calls `await reload()` (line 81). `reload` is `useDashboardState.load` (`lib/pbv/hooks/useDashboardState.ts:59`), which sets `state` to `loading` then `ready` on every call — a **new `state` object each time**.

The cycle: `ready (forms=[])` → effect runs → `POST generate-forms` (200) → `await reload()` → `state` churns `loading → ready (forms=[])` → `maybeGenerateForms` identity changes → effect re-fires → `forms` still empty → `POST` again → … forever. It terminates **only** if `/forms` returns ≥1 form after a generate call. There is no one-shot guard, and the failure branch (`setGenState('error')`) is only reached on a thrown fetch — the dominant path is HTTP 200 with `forms` still empty, which loops.

### Bug C — generation persists zero forms in production *(strong hypothesis — must verify before relying on it)*

`/api/t/[token]/pbv-full-app/forms` (`forms/route.ts`) returns **all** `pbv_form_documents` rows for the application with no status filter. So `forms.length === 0` on the client means `generate-forms` wrote **zero rows**.

`generate-forms/route.ts` skips a template (no row written) when `getSourcePdf(formId, language)` (line 112) or `loadFieldMap(formId, language)` (line 124) returns `null`. `loadFieldMap` (lines 337-351) does:

```ts
const path = join(process.cwd(), 'scripts', 'field-maps', `${slug}-${language}.json`);
if (!existsSync(path)) return null;
```

[Inference] On Vercel, a **dynamically-constructed `fs` path** like this is not statically analyzable, so Next.js output file tracing does not include `scripts/field-maps/**` in the serverless function bundle. In production `existsSync` returns `false`, **every** template is skipped, `generated` is `[]`, no `pbv_form_documents` rows are written, `/forms` stays empty, and Bug B loops. `next.config.js` has no `outputFileTracingIncludes` entry for these assets (grep: none). This also matches the "works in dev, breaks live" symptom.

[Unverified] The same risk applies to whatever backing store `getSourcePdf` reads from (`lib/pbv/form-generation/source-pdfs`) if it also reads bundled files via `fs`. Confirm during the build.

**This is a hypothesis, not a confirmed fact.** It must be verified (see Verification, Gate 0) before the Phase 3 fix is treated as correct. LLM/code behavior is not guaranteed; confirm against the deployed runtime.

---

## Current state

| Surface | Path | Notes |
|---|---|---|
| Broken CTA target | `app/pbv-full-app/[token]/documents/page.tsx:122` | `window.location.href = /pbv-full-app/${token}/sign` → 404 |
| CTA component | `components/pbv/cards/AlmostDoneReview.tsx:83` | "Looks good — let's sign →" → `handleProceedToSign` |
| Looping page | `app/pbv-full-app/[token]/sign/summary/page.tsx:45-91` | `maybeGenerateForms` + `useEffect`; no one-shot guard |
| State hook | `lib/pbv/hooks/useDashboardState.ts:59-153` | `load`/`reload` resets `state` each call → callback identity churn |
| Forms read API | `app/api/t/[token]/pbv-full-app/forms/route.ts` | Returns all rows, no filter — empty ⇒ zero rows persisted |
| Generation API | `app/api/t/[token]/pbv-full-app/generate-forms/route.ts:112,124,337-351` | Skips template when source PDF / field map not found; returns 200 even when `generated` is empty |
| Field-map assets | `scripts/field-maps/*.json` | Read via dynamic `fs` path; likely not traced into the Vercel bundle |
| Build config | `next.config.js` | No `outputFileTracingIncludes` for field maps / source PDFs |
| Valid sign routes | `app/pbv-full-app/[token]/sign/{summary,forms,additional-signers}/page.tsx` | No bare `sign/page.tsx` |

---

## Goals

1. The "Looks good — let's sign →" CTA lands the tenant on a working summary page (`/sign/summary`), not a 404.
2. `/sign/summary` attempts form generation **at most once** per mount. It never enters a repeated-request loop, regardless of what `generate-forms` returns.
3. When forms genuinely cannot be produced, the tenant sees a clear terminal state (retry + return to dashboard + how to reach the office), not an infinite spinner.
4. `generate-forms` actually persists form rows in production, so `/forms` is non-empty, the summary renders, and the tenant can sign and proceed to submit.
5. The `generate-forms` endpoint is no longer subjected to runaway client traffic.

## Non-goals

- No change to the signing state machine, signature capture, or the forms/additional-signers signing pages beyond routing into them.
- No change to document upload (it works) or the dashboard gating logic.
- No redesign of the summary document content or templates.
- No new DB schema. (No migration in this PRD.)

---

## Implementation phases

### Phase 1 — Fix the `/sign` route (Bug A) — 1 line, highest value

In `documents/page.tsx`, change `handleProceedToSign` to navigate to `/pbv-full-app/${token}/sign/summary`. Type-check, confirm the CTA on the review screen lands on the summary page.

### Phase 2 — Stop the loop + add a terminal state (Bug B) — safety-critical

This is required **independently of Phase 3**: it removes the self-DoS and the infinite spinner even if generation legitimately yields zero forms.

In `sign/summary/page.tsx`:

- Add a one-shot guard so the POST runs at most once per mount, e.g. a `useRef(false)` flag set before the `fetch`, checked at the top of `maybeGenerateForms` after the `status !== 'ready'` / `forms.length > 0` early returns. Re-running the effect after `reload()` must not issue another POST.
- Reduce effect churn: the effect should not re-fire on every `state` object change. Drive it off stable inputs (e.g. trigger only on the `loading → ready` transition) combined with the ref guard. Do not remove the `forms.length > 0` early return.
- After the single attempt + `reload()`, branch deterministically:
  - `forms.length > 0` → render `SummaryDocReviewSign` (normal path).
  - `forms.length === 0` → **terminal** UI: a plain-language message ("We couldn't prepare your forms — please try again, or contact the office"), a manual **Try again** button (resets the ref and re-attempts once), and a **Back to dashboard** link. No automatic re-attempt.
- Keep the existing thrown-error branch, but it must also be terminal (no auto-retry).

Acceptance: with `generate-forms` returning 200 + zero forms, the page issues exactly **one** POST and lands on the terminal state. Confirm via the network panel.

### Phase 3 — Make generation persist forms in production (Bug C) — verify first

1. **Confirm the cause (Gate 0 below).** Capture the `generate-forms` response body (`total_generated`, `skipped[]`, `summary.error`) and server logs in the deployed environment. If `skipped` lists every form with "Field map missing" / "Source PDF missing", the bundling hypothesis is confirmed.
2. **If confirmed (asset not in the serverless bundle):** make the field maps and source PDFs available to the `generate-forms` function. Preferred: add `outputFileTracingIncludes` in `next.config.js` for the route, pointing at `./scripts/field-maps/**` (and the source-PDF directory). Alternative: move the assets under a path that import-based tracing already picks up, or load field maps via static `import`/JSON module instead of a dynamic `fs` path. Whichever approach, confirm the files resolve at runtime in a Vercel deploy, not just locally.
3. **If the cause is different** (e.g. no templates have `generation_enabled = TRUE`, or all conditional rules skip, or a Storage/upsert error): fix per the actual finding and record it. Note: `generate-forms` currently returns 200 with `total_generated: 0`; consider surfacing the empty/skip outcome explicitly so the client terminal state can distinguish "nothing to generate" from "generation failed."

Acceptance: a fresh `/sign/summary` load triggers one `generate-forms` call, `/forms` then returns the expected rows, the summary renders, and the loop never starts because the `forms.length > 0` early return trips on the first reload.

### Phase 4 — (Recommended, secondary) endpoint hardening

Add an in-flight/idempotency guard to `generate-forms` so concurrent duplicate invocations for the same application don't double-write Storage or race on the upsert. Defense-in-depth; the loop fix is the primary mitigation for the 503s.

---

## Verification / test plan

Run against a deployed preview (the bug is prod/runtime-specific — local-only verification is insufficient).

- **Gate 0 (root-cause confirmation):** capture `generate-forms` response (`total_generated`, `skipped`) + server logs; record whether the bundling hypothesis held. Document the actual cause in the build report.
- **Gate 1 (Bug A):** from the document review screen, "Looks good — let's sign →" lands on `/sign/summary` (HTTP 200, not 404).
- **Gate 2 (Bug B):** on `/sign/summary`, the network panel shows **exactly one** `POST generate-forms` per load. No repeated calls, no 503s from this page.
- **Gate 3 (terminal state):** simulate zero-forms (e.g. before the Phase 3 fix, or via a forced empty response) — the page shows the terminal message + Try again + Back to dashboard, and does not loop.
- **Gate 4 (happy path):** after Phase 3, a real `/sign/summary` load renders the summary PDF; the tenant can sign it; "Review and sign required forms" unlocks; the full path through forms signing reaches an enabled "Submit my application".
- **Gate 5:** `node ./node_modules/typescript/bin/tsc --noEmit` and `npm run build` both clean (see `docs/SHELL-PROTOCOL.md`).

---

## Open questions

- **O1:** Are the 11 items in this application's required set intentionally all office-provided sign forms ("We'll provide this form for you to sign"), with no applicant-supplied ID/income uploads in the required set? Confirm this matches HACH's intake expectation.
- **O2:** When no templates are applicable for an application, what should the tenant see — skip the summary/forms steps entirely, or a "nothing to sign, proceed to submit" state? (Affects Phase 2 terminal copy and Phase 3 empty-result handling.)
- **O3:** Should `generate-forms` move to a server-triggered step (e.g. at intake-complete) rather than being driven from the client summary page at all? Larger refactor; out of scope here, but it would remove this class of client-loop risk.

## Decisions

- **D1:** Phase 2 (loop guard + terminal state) ships even if Phase 3's root cause is still under investigation — it is the safety-critical mitigation for the self-DoS and the stuck spinner. (No "Phase 2 later" — both land together.)
- **D2:** No migration; no schema change.

---

## Files expected to change

| File | Phase | Change |
|---|---|---|
| `app/pbv-full-app/[token]/documents/page.tsx` | 1 | `handleProceedToSign` → `/sign/summary` |
| `app/pbv-full-app/[token]/sign/summary/page.tsx` | 2 | one-shot guard, de-churn effect, terminal state |
| `next.config.js` | 3 | `outputFileTracingIncludes` for field maps / source PDFs *(if Gate 0 confirms)* |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | 3/4 | only if Gate 0 points here (asset loading / empty-result signal / concurrency guard) |

If anything outside this list needs changing, stop and report rather than expanding scope.
