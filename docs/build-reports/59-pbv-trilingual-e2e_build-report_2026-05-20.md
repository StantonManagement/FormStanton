# PRD-59 Build Report: Trilingual EN/ES/PT End-to-End

**Date:** 2026-05-20  
**Commit:** (to be determined)  
**Branch:** feat/pbv-full-finalization  

---

## Summary

Completed trilingual (EN/ES/PT) end-to-end pass over PRD-55/56/57/58 surfaces. All 68 "TODO:" placeholders in `docTypeHelp.ts` replaced with real Spanish/Portuguese translations. Language routing locked by unit tests. Coverage tests added as fail-loud drift guard.

---

## Phase Status

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | ✅ COMPLETE | Read surfaces across all PRDs |
| 1 | ✅ COMPLETE | `docTypeHelp.ts` 68 TODOs filled |
| 2 | ✅ COMPLETE | `docContent.ts` header comment corrected |
| 3 | ✅ COMPLETE | Language routing tests (13 tests) |
| 4 | ✅ COMPLETE | Translation coverage tests (7 tests) |
| 5 | ✅ COMPLETE | ES assets confirmed resolvable (existing PRD-55 verification) |
| 6 | ✅ COMPLETE | Static gates pass |

---

## Files Changed

| File | Change |
|------|--------|
| `lib/pbv/docTypeHelp.ts` | All 68 ES/PT TODOs replaced with translations; header comment updated |
| `lib/pbv/cards/docContent.ts` | Header comment corrected (no stale TODO) |
| `lib/pbv/__tests__/language-routing.test.ts` | **NEW** 13 routing unit tests |
| `lib/pbv/__tests__/translation-coverage.test.ts` | **NEW** 7 coverage drift-guard tests |

---

## Static Gates

| Gate | Status | Notes |
|------|--------|-------|
| S1: tsc --noEmit | ✅ PASS | Clean |
| S2: npm run build | ✅ PASS | Clean (2.2min TS, 5.4s page data) |
| S3: Language routing tests | ✅ PASS | 13/13 green |
| S4: Translation coverage tests | ✅ PASS | 7/7 green |
| S5: Zero TODO: in docTypeHelp | ✅ PASS | grep shows 0 matches |
| S6: Coverage matrix | ✅ PASS | 34 doc types × 3 languages = 102 entries, all filled |

---

## Coverage Matrix

### docTypeHelp.ts (34 doc types)
| Category | Count | EN | ES | PT |
|----------|-------|----|----|----|
| Income | 10 | ✅ | ✅ | ✅ |
| Assets | 5 | ✅ | ✅ | ✅ |
| Medical/Childcare | 3 | ✅ | ✅ | ✅ |
| Immigration | 2 | ✅ | ✅ | ✅ |
| Signed Forms | 14 | ✅ | ✅ | ✅ |
| **Total** | **34** | **34** | **34** | **34** |

### docContent.ts (34 doc types)
| Field | EN | ES | PT |
|-------|----|----|----|
| title | ✅ 34 | ✅ 34 | ✅ 34 |
| description | ✅ 34 | ✅ 34 | ✅ 34 |
| fallback | ✅ 34 | ✅ 34 | ✅ 34 |

---

## Language Routing (Confirmed)

| Tenant Lang | Form Output | Summary Doc | UI |
|-------------|-------------|-------------|-----|
| EN | EN | EN | EN |
| ES | ES | ES | ES |
| PT | ES (no PT assets) | PT | PT |

**Submission language override:** For form output only; summary stays in `preferred_language`.

---

## ES Asset Resolution

Confirmed by existing PRD-55 reconciliation:
- `getSourcePdf(formId, 'es')` resolves for all enabled templates
- `*-es.json` field maps present
- No `-pt` asset requests in codebase (PT → ES by design)

---

## OPEN-DECISIONS.md Updates

Added:
- **O1:** Real EN/ES/PT summary + consent prose is authored by Alex + Dan + a translator, not this build. Built against current `// CONTENT: tentative` / `// CONSENT: tentative` drafts.
- **O2:** Tentative summary/consent acceptable to ship behind.

---

## Deferred Runtime Gates

- **Gate 7:** SMS-link → submit walked in EN, ES, PT on a deploy — UI in `preferred_language`, ES stamped forms for `es`/`pt`, summary in own language incl. `pt`.
- **Gate 8:** ES stamped-form fidelity (pymupdf visual check on a deploy).

---

## New Test Files

```
lib/pbv/__tests__/language-routing.test.ts    (13 tests)
lib/pbv/__tests__/translation-coverage.test.ts  (7 tests)
```

---

## Next Steps

Proceed to **PRD-60** prompt.
