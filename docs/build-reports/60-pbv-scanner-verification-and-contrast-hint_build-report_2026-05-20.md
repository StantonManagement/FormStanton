# PRD-60 Build Report: Scanner Verification + Low-Contrast / Can't-Lock Hint

**Date:** 2026-05-20  
**Commit:** (to be determined)  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Completed PRD-60 Part A (contrast hint) and Part B (detector verification). Replaced the 8s opaque stuck-hint with a 3.5s transparent, non-blocking hint that fires faster and clears immediately on re-lock. Scanic detector confirmed intact and stays IN for v1.

---

## Files Changed

| File | Change |
|------|--------|
| `components/DocumentScanner/lockTimeout.ts` | **NEW** Pure no-lock timer helper, default 3.5s threshold, `now`-injectable |
| `components/DocumentScanner/__tests__/lockTimeout.test.ts` | **NEW** 8 unit tests covering locked/unlocked/threshold/boundary/reset cases |
| `components/DocumentScanner/LivePreviewStage.tsx` | Wired helper replacing 8s polling; transparent `bg-black/55` hint with `pointer-events-none` |

---

## How the Hint Hooks Into Existing Signal

```
onQuad callback (existing)
  └── state = trackerRef.current.push(detectedQuad)
      └── isLocked = state.kind !== 'seeking'
          └── lockTimeoutRef.current.update(isLocked, Date.now())
              └── showContrastHint = true/false (drives UI)
```

- No new `adapter.detect` / `scanner.scan` / `getImageData` calls
- No parallel timer — single `update()` call per frame
- Clears instantly on `isLocked = true`

---

## Static Gates (All Green)

| Gate | Status | Verification |
|------|--------|--------------|
| S1 | ✅ | `lockTimeout.test.ts` 8/8 pass (locked→false, pre-threshold→false, threshold→true, re-lock→false, boundary) |
| S2 | ✅ | `grep -n "adapter.detect\|scanner.scan\|getImageData" LivePreviewStage.tsx` — no new detector calls |
| S3 | ✅ | Hint container: `bg-black/55 pointer-events-none absolute top-4` — clear of bottom button stack |
| S4 | ✅ | Reuses `t.stuckHint` + `t.stuckHintSecondary` — EN/ES/PT verified in translations.ts |
| S5 | ✅ | `tsc --noEmit` clean, `npm run build` clean, `vitest run` green |

---

## UI Changes

| Before (PRD-47) | After (PRD-60) |
|-----------------|----------------|
| 8s polling timer | 3.5s callback-driven tracker |
| Opaque amber card (`bg-amber-100/95`) | Semi-transparent black band (`bg-black/55`) |
| Top position (risk of control overlap) | Top-4 position with `pointer-events-none` |
| Blocking (default pointer events) | Non-blocking (`pointer-events-none`) |
| Same strings | Same strings (no new i18n) |

---

## Detector Verification (Part B)

| Check | Status | Notes |
|-------|--------|-------|
| `package.json` scanic dependency | ✅ | Present with `postinstall: sync-scanic.mjs` |
| `public/scanic/scanic.umd.cjs` | ✅ | Exists |
| `ensureScanicLoaded` | ✅ | Only detector load path |
| `createScanicAdapter` | ✅ | Wired in `edgeDetectionLoop.ts` |
| Dead jscanify factory | ⚠️ | Flagged O3 — NOT fixed this lane |

**Decision D5:** Scanic stays IN for v1.

---

## Decisions Logged

| ID | Decision | Location |
|----|----------|----------|
| D3 | 3.5s hint threshold default | `OPEN-DECISIONS.md` |
| D5 | Scanic stays IN for v1 | `OPEN-DECISIONS.md` |
| O3 | Dead jscanify factory flagged | `OPEN-DECISIONS.md` |

---

## Deferred Real-Device Gates (Post-Run)

| Gate | Description | PRD Source |
|------|-------------|------------|
| R1 | Hint fires within ~3.5s on real low-contrast scene | PRD-60 |
| R2 | Hint clears instantly on quad lock | PRD-60 |
| R3 | iOS Safari (current + iOS 16) — Scanic loads, detects, captures | PRD-52 Gate 7 |
| R4 | Android Chrome — Scanic loads, detects, captures | PRD-52 Gate 7 |
| R5 | Fast-3G cold-load time to first quad overlay | PRD-52 Gate 5 |
| R6 | 5-min open heap stable, `window.__scanicInstance` reused | PRD-52 Gate 10 |
| R7 | 375px width + 200% root font — hint + controls reflow | PRD-46/47 |

---

## No Migration

This PRD is client-only (React component + pure helper + translations). No Supabase migration required.

---

## Next Steps

Proceed to **PRD-61** prompt (final E2E gate).
