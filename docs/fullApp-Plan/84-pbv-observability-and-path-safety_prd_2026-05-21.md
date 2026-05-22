# PRD-84 — PBV Observability & Path-Safety

**Date:** 2026-05-21
**Author:** Alex / Cowork session
**Branch:** `feat/pbv-adjacent-errors-hardening`
**Status:** Draft — ready for build
**Severity:** P3. Both are MEDIUM monitor-class items: A8 (silent analytics loss on fire-and-forget event writes) and A9 (a path-strip that can silently produce a broken signed URL).
**Source:** `docs/audits/pbv-adjacent-errors-deep-check_2026-05-21.md` — findings **A8** and **A9**. Grouped as "robustness/observability"; two independent files, no overlap with any other PRD.
**Scope guard:** `app/api/t/[token]/pbv-full-app/events/route.ts` and `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts` only. No other files. No dependency on other PRDs.

---

## Problem Statement

**A8 — `events` route is fire-and-forget without client feedback (per audit, [events/route.ts:151-157](app/api/t/[token]/pbv-full-app/events/route.ts#L151)).** Event writes use `Promise.allSettled` **without `await`**. The client gets a 200 with accepted/rejected counts but no signal of whether the events actually persisted. Analytics data loss is silent.

**A9 — `signature-thumbnails` path-strip can silently produce a wrong path (per audit, [signature-thumbnails/route.ts:41](app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts#L41)).** The route uses `.replace('pbv-applications/', '')` to strip the bucket prefix before `createSignedUrl`. If a path does not start with exactly `pbv-applications/`, the replace silently no-ops and the signed-URL call uses the full path, which may not exist in the bucket → a broken or empty thumbnail with no clear error.

---

## Root cause / findings (audit-reported; confirm in code before editing)

- **A8**: the write promise is never awaited and its result never surfaced, so the response cannot reflect persistence. Two reasonable postures: **await** the writes (adds ~50–100ms but makes the count truthful), or keep them async and return a `persistence_initiated` field so the client knows the write was *started*, not *confirmed*. The audit's suggested fix is the latter (cheap, non-blocking). [Inference] for analytics events, "initiated" feedback is usually sufficient and avoids adding latency to the tenant's request path; confirm the route isn't relied on for anything stronger than analytics before choosing.
- **A9**: `String.replace` with a literal only strips a leading occurrence if present and silently does nothing otherwise. The robust form guards with `.startsWith()` before stripping (or `path.slice(prefix.length)`), and the route already has a partial `safePaths` notion to build on. The fix makes the strip explicit and the prefix mismatch observable instead of silently passing a bad path to `createSignedUrl`.

---

## Current state

| Item | Where | Notes |
|---|---|---|
| Unawaited fire-and-forget writes | `events/route.ts:151-157` | `Promise.allSettled(...)` not awaited |
| Response counts | `events/route.ts:159-166` | accepted/rejected, no persistence signal |
| Naive prefix strip | `signature-thumbnails/route.ts:41` | `.replace('pbv-applications/','')` — silent no-op on mismatch |
| Partial guard | `signature-thumbnails/route.ts:35-46` | `safePaths` filter exists to build on |

---

## Goals

1. **A8:** The `events` response tells the client whether persistence was at least **initiated**. Default: keep the writes async (no added latency) and add a `persistence_initiated` count to the response data. If the route turns out to need confirmed persistence, await instead and make the counts reflect actual results — confirm the route's role first and log the choice.
2. **A9:** The bucket-prefix strip only happens when the path actually starts with the prefix; a non-matching path is handled explicitly (skip with a logged warning, or pass through deliberately) rather than silently producing a wrong signed URL. Use `.startsWith()` + `.slice(prefix.length)` and build on the existing `safePaths` filter.
3. No change to the accepted/rejected validation logic (A8) or to which paths are eligible for signing (A9) beyond making the strip safe.

## Non-goals

- No change to the event schema, predicates, or what counts as accepted/rejected.
- No change to the signing TTL or which buckets are used.
- No new dependency, no migration. (Do **not** apply any migration to prod — none expected.)
- No edits to any file outside the two named.

---

## Implementation phases

### Phase 1 — A8: surface persistence status in the `events` response
Default (async, non-blocking) — add an initiated count at `events/route.ts:159-166`:

```ts
return NextResponse.json({
  success: true,
  data: {
    accepted: results.filter((r) => r.status === 'accepted').length,
    rejected: results.filter((r) => r.status === 'rejected').length,
    persistence_initiated: processedEvents.length, // A8: client knows the write was started
    results,
  },
});
```

Confirm `processedEvents` (or the equivalent variable) is the right count of writes dispatched. If the route is depended on for confirmed persistence (not just analytics), instead `await` the `Promise.allSettled` and report actual settled results — log which posture you took and why.

### Phase 2 — A9: guard the prefix strip in `signature-thumbnails`
At `signature-thumbnails/route.ts:35-46`, make the strip explicit:

```ts
const prefix = 'pbv-applications/';
const safePaths = paths.filter((p) => p.startsWith(prefix)); // existing guard, build on it

const urlMap: Record<string, string> = {};
await Promise.all(
  safePaths.map(async (storagePath) => {
    const pathInBucket = storagePath.startsWith(prefix)
      ? storagePath.slice(prefix.length)
      : storagePath; // explicit: mismatch passes through deliberately, not via a silent no-op replace
    const { data, error } = await supabaseAdmin.storage
      .from('pbv-applications')
      .createSignedUrl(pathInBucket, SIGNED_URL_TTL_SECONDS);
    if (error || !data) {
      // log the mismatch/failure rather than emitting a broken URL silently
      return;
    }
    urlMap[storagePath] = data.signedUrl;
  })
);
```

Confirm the real bucket name, the `safePaths`/`prefix` variables, and `SIGNED_URL_TTL_SECONDS` in code before wiring. Keep the eligibility filter behavior; only the strip and the mismatch handling change.

---

## Verification / test plan

**Static gates (in-session, before commit):**
- **Gate 1 (A8):** unit test — the `events` response includes `persistence_initiated` (or, if the await posture is taken, the counts reflect settled results); accepted/rejected counts unchanged for valid input.
- **Gate 2 (A9 normal):** unit test — a path with the `pbv-applications/` prefix is stripped correctly and a signed URL is produced.
- **Gate 3 (A9 mismatch):** unit test — a path without the prefix does not silently produce a wrong signed URL (it is skipped/logged or passed through deliberately per the chosen handling), and no broken URL is emitted as if valid.
- **Gate 4:** `node ./node_modules/typescript/bin/tsc --noEmit` + `npm run build` clean; new tests green (`npx vitest run`). **No Playwright/e2e.**

**Deferred to the post-run verification pass (list in build report, do NOT block):**
- **Gate R1:** on a preview deploy, post a batch of events and confirm the response carries the persistence signal; load a signature thumbnail with a known-good path and confirm the image renders.

---

## Open questions

- **O1 (A8):** Is the `events` route analytics-only, or is anything downstream depending on confirmed persistence? Default: async + `persistence_initiated`. If confirmed persistence is needed, `await` and report settled results. Log the posture.
- **O2 (A9):** When a path lacks the prefix, skip-with-log or pass-through? Default: handle a `createSignedUrl` error/empty result by logging and omitting that entry (no broken URL surfaced as valid).

## Decisions

- **D1 (A8):** Surface persistence status; default to non-blocking `persistence_initiated` unless confirmed persistence is required.
- **D2 (A9):** `.startsWith()`-guarded strip; a prefix mismatch never silently yields a wrong signed URL.

---

## Files expected to change

| File | Finding | Change |
|---|---|---|
| `app/api/t/[token]/pbv-full-app/events/route.ts` | A8 | add persistence signal to the response (or await + settled counts) |
| `app/api/t/[token]/pbv-full-app/signature-thumbnails/route.ts` | A9 | `.startsWith()`-guarded prefix strip; observable mismatch handling |
| new test(s) | A8, A9 | Gates 1–3 |

If anything outside this list needs changing, default-and-log per `BATCH-RUN-PROTOCOL.md`.
