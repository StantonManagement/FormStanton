# Build Report — PRD-54: PBV Summary-Sign Loop + Route Fix

**Date:** 2026-05-20  
**Branch:** `fix/pbv-summary-sign-loop-54`  
**Status:** ✅ Complete  

---

## Summary

Fixed three connected P0 launch-blocking bugs in the PBV full-app signing flow:

1. **Bug A** — `/sign` 404: CTA navigated to non-existent route
2. **Bug B** — Client infinite loop: `generate-forms` re-fired continuously
3. **Bug C** — Field maps not bundled: Dynamic `fs` paths excluded from Vercel bundle

---

## Changes Made

### Phase 1 — Fix `/sign` route (Bug A)

**File:** `app/pbv-full-app/[token]/documents/page.tsx:122`

```ts
// Before
window.location.href = `/pbv-full-app/${token}/sign`;

// After
window.location.href = `/pbv-full-app/${token}/sign/summary`;
```

### Phase 2 — Stop the loop + terminal state (Bug B)

**File:** `app/pbv-full-app/[token]/sign/summary/page.tsx`

Changes:
- Added `useRef` one-shot guard (`generationAttemptedRef`) to prevent multiple POSTs per mount
- De-churned effect: now drives off `state.status === 'ready'` transition instead of full `state` object
- Added `genState: 'empty'` terminal state for zero-forms case
- Updated terminal UI with clear messaging + "Try again" (resets guard) + "Back to dashboard" buttons
- Fixed thrown-error branch to also be terminal (no auto-retry)

Key code:
```ts
// One-shot guard
const generationAttemptedRef = useRef(false);

// Set before fetch
generationAttemptedRef.current = true;

// Check at top of function
if (generationAttemptedRef.current) return;

// De-churned effect
useEffect(() => {
  if (state.status === 'ready') {
    maybeGenerateForms();
  }
}, [state.status, maybeGenerateForms]);
```

### Phase 3 — Fix bundling (Bug C)

**File:** `next.config.js`

Added `outputFileTracingIncludes` for the `generate-forms` route:

```js
outputFileTracingIncludes: {
  '/api/t/[token]/pbv-full-app/generate-forms': ['./scripts/field-maps/**'],
},
```

This ensures the field map JSON files are included in the Vercel serverless function bundle, so `loadFieldMap()` can resolve them at runtime.

### Additional Fix — Pre-existing import errors

**Files:**
- `app/api/forms/pbv-preapp/route.ts:3`
- `app/api/t/[token]/pbv-preapp/route.ts:4`

Fixed imports of `buildingToZipcode` from `@/lib/buildings` (incorrect) to `@/lib/buildingZipcodes` (correct). These were blocking the build.

---

## Verification

| Gate | Status | Notes |
|------|--------|-------|
| Type-check | ✅ Pass | `node ./node_modules/typescript/bin/tsc --noEmit` |
| Build | ✅ Pass | `npm run build` — 208 static pages, all API routes compiled |
| Gate 1 (route fix) | ⚠️ Pending | Needs deployed preview verification |
| Gate 2 (single POST) | ⚠️ Pending | Needs deployed preview network panel check |
| Gate 3 (terminal state) | ⚠️ Pending | Needs runtime verification with zero-forms scenario |
| Gate 4 (happy path) | ⚠️ Pending | Needs full end-to-end test on deployed preview |

---

## Bug C Root Cause Confirmation

**Hypothesis:** `loadFieldMap()` uses dynamic `fs` path construction that Next.js cannot statically analyze, so `scripts/field-maps/**` is not included in the Vercel bundle.

**Verification Status:** ⚠️ Pending deployment

To confirm on deployed preview:
1. Hit `/sign/summary` with a fresh application
2. Check `generate-forms` response body for `skipped[]` array
3. If every template shows `Field map missing` or `Source PDF missing`, hypothesis confirmed
4. Server logs should show: `[generate-forms] Field map missing for ${formId}/${language}`

The `outputFileTracingIncludes` fix should resolve this if bundling is confirmed as the cause.

---

## Remaining Work

Runtime verification required on deployed preview:

1. **Gate 1:** CTA lands on `/sign/summary` (200, not 404)
2. **Gate 2:** Network panel shows exactly **one** `POST generate-forms`
3. **Gate 3:** Zero-forms scenario shows terminal state with Try again + Back to dashboard
4. **Gate 4:** Happy path: summary renders → tenant can sign → forms unlock → submit enabled

---

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| `app/pbv-full-app/[token]/documents/page.tsx` | 122 | Route fix |
| `app/pbv-full-app/[token]/sign/summary/page.tsx` | 10-195 | Loop guard + terminal state |
| `next.config.js` | 8-11 | Bundling fix |
| `app/api/forms/pbv-preapp/route.ts` | 3-4 | Import fix |
| `app/api/t/[token]/pbv-preapp/route.ts` | 4 | Import fix |

---

## What NOT Changed (per PRD)

- No migrations
- No changes to signing state machine or signature capture
- No changes to forms/additional-signers pages beyond routing
- No changes to document upload or dashboard gating
- No schema changes
