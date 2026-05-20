# Windsurf Build Prompt — PRD-54: PBV Summary-Sign Loop + Broken `/sign` Route

Build from `docs/fullApp-Plan/54-pbv-summary-sign-loop-and-route-fix_prd_2026-05-20.md`. Read it first.

This is a **P0 launch blocker**. A tenant who has uploaded all documents cannot sign or submit: the "let's sign" CTA 404s, and the `/sign/summary` page sticks on "Preparing your application summary…" while firing `generate-forms` in an infinite loop (100+ POSTs, intermittent 503s). Confirmed live 2026-05-20.

---

## Branch and base

- Branch off `main` as `fix/pbv-summary-sign-loop-54`.
- If `git status` / `git log` error out, fix the git config first and report it before proceeding.

## Shell protocol

See `docs/SHELL-PROTOCOL.md`. Key points:
- Type-check with `node ./node_modules/typescript/bin/tsc --noEmit`, NOT `npx tsc` (npx hangs on Windows).
- No migrations in this PRD — do not create or run any.

---

## The three bugs (see PRD for full detail)

- **A — `/sign` 404:** `documents/page.tsx:122` navigates to `/pbv-full-app/${token}/sign`; no such route exists.
- **B — client loop:** `sign/summary/page.tsx` re-fires `generate-forms` because `reload()` churns `state`, `maybeGenerateForms` (dep on `state`) changes identity, the effect re-runs, and `forms.length` is still 0. No one-shot guard.
- **C — zero forms in prod (HYPOTHESIS, verify):** `generate-forms` skips every template because `loadFieldMap` reads `scripts/field-maps/*.json` via a dynamic `fs` path that Next.js likely doesn't trace into the Vercel function bundle. So `/forms` stays empty and B loops.

---

## Files to modify

| File | Change |
|---|---|
| `app/pbv-full-app/[token]/documents/page.tsx` | `handleProceedToSign` → `/pbv-full-app/${token}/sign/summary` |
| `app/pbv-full-app/[token]/sign/summary/page.tsx` | one-shot guard, de-churn the effect, deterministic terminal state |
| `next.config.js` | `outputFileTracingIncludes` for field maps / source PDFs — **only if Gate 0 confirms the bundling cause** |
| `app/api/t/[token]/pbv-full-app/generate-forms/route.ts` | **only if Gate 0 points here** (asset loading, empty-result signal, or concurrency guard) |

## Files NOT to touch

- The signing state machine, signature capture, and the `sign/forms` + `sign/additional-signers` pages (beyond routing into them).
- Document upload, the dashboard, dashboard gating logic.
- Summary document content / templates.
- No DB schema, no migrations.

---

## Step-by-step

### Step 0 — Confirm the root cause of Bug C (do this first)

On a deployed preview, hit `/sign/summary` once (or call `generate-forms` directly) and capture:
- the response body: `total_generated`, `skipped[]`, `summary.error`;
- server logs for `[generate-forms] Field map missing` / `Source PDF missing`.

If `skipped` lists every form with missing field-map/source-PDF → bundling cause confirmed → do Step 3 via `next.config.js`. If the cause is different (no `generation_enabled` templates, conditional rules skip everything, Storage/upsert error), fix per the actual finding and record it. **Do not assume — verify.**

### Step 1 — Fix the `/sign` route (Bug A)

`documents/page.tsx`, `handleProceedToSign`: target `/pbv-full-app/${token}/sign/summary`. Type-check. This is the highest-value single change — confirm it compiles before continuing.

### Step 2 — Stop the loop + terminal state (Bug B) — ship regardless of Step 3

In `sign/summary/page.tsx`:
1. Add a `useRef(false)` one-shot guard. Set it true immediately before the `fetch`; check it at the top of `maybeGenerateForms` (after the `status !== 'ready'` and `forms.length > 0` early returns). A re-run after `reload()` must not POST again.
2. De-churn the effect so it doesn't re-fire on every `state` object change — drive it off the `loading → ready` transition, combined with the ref guard. Keep the `forms.length > 0` early return.
3. After the single attempt + `reload()`, branch deterministically:
   - `forms.length > 0` → render `SummaryDocReviewSign`.
   - `forms.length === 0` → terminal UI: plain-language message ("We couldn't prepare your forms — please try again, or contact the office"), a **Try again** button (resets the ref, re-attempts once), and a **Back to dashboard** link. No auto-retry.
4. The thrown-fetch error branch must also be terminal (no auto-retry).

Acceptance: with `generate-forms` returning 200 + zero forms, the page issues **exactly one** POST and lands on the terminal state.

### Step 3 — Make generation persist forms in prod (Bug C) — only after Gate 0

If bundling confirmed: add `outputFileTracingIncludes` in `next.config.js` for the `generate-forms` route pointing at `./scripts/field-maps/**` (and the source-PDF dir). Alternative: load field maps via static JSON `import` instead of a dynamic `fs` path, or relocate assets to a traced path. Confirm the files resolve at runtime in a Vercel preview, not just locally.

Acceptance: a fresh `/sign/summary` load triggers one `generate-forms`, `/forms` then returns rows, the summary renders, and the loop never starts.

### Step 4 — (Recommended) endpoint hardening

Add an in-flight/idempotency guard to `generate-forms` so concurrent duplicate calls for one application don't double-write Storage or race the upsert.

### Step 5 — Type-check + build + build report

`node ./node_modules/typescript/bin/tsc --noEmit` then `npm run build`, both clean. Build report at `docs/build-reports/54-pbv-summary-sign-loop-and-route-fix_build-report_2026-05-20.md`.

---

## Verification gates (per PRD-54)

- **Gate 0:** Bug C root cause confirmed + documented in the build report.
- **Gate 1:** "Looks good — let's sign →" lands on `/sign/summary` (200, not 404).
- **Gate 2:** network panel shows exactly **one** `POST generate-forms` per `/sign/summary` load; no 503s from this page.
- **Gate 3:** zero-forms case shows the terminal state (Try again + Back to dashboard) and does not loop.
- **Gate 4:** real load renders the summary PDF; tenant can sign; forms step unlocks; submit becomes enabled.
- **Gate 5:** type-check + build clean.

Verify on a deployed preview — this bug is runtime/prod-specific; local-only checks are insufficient.

---

## What "done" looks like

1. Branch pushed, PR opened against `main` (Ready for Review).
2. Type-check + build clean.
3. CTA reaches `/sign/summary` (no 404).
4. `/sign/summary` makes one generate-forms call, never loops, and shows a terminal state when forms can't be produced.
5. With the Bug C fix, the summary renders and the tenant can sign through to an enabled submit.
6. Build report documents the confirmed Bug C cause and the exact fix applied.

## What NOT to do

- Do not leave any path that can re-POST `generate-forms` on a render/state change.
- Do not skip Gate 0 — confirm Bug C's cause before applying the Phase 3 fix.
- Do not apply the `next.config.js` change blind if logs point elsewhere.
- Do not use `npx tsc`. Do not add migrations. Do not touch signing/signature internals.
- Do not expand scope silently — if a file outside the list needs changing, stop and ask.

## Reporting back

- Branch + SHA, PR URL, build report URL.
- Gate 0 finding: the actual Bug C root cause + the fix applied.
- Per-gate pass/fail (with the network-panel evidence for Gate 2).
- Any answers to PRD-54 open questions O1-O3 that came up.
