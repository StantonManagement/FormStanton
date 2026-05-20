# Launch Merge Execution Report
**Date:** 2026-05-19  
**Executor:** Cascade  
**Prompt:** `docs/fullApp-Plan/prompts/50-launch-merge-execution_prompt_2026-05-19.md`

---

## 1. Pre-Merge SHAs

| Branch | SHA | Commit Subject |
|--------|-----|----------------|
| `origin/main` | `a05e1a7` | fix(lookup): auto-create submission from tenant_lookup when no submission row exists |
| `origin/dev-HACH` | `1940afe` | feat(forms-library): auto-discover new form routes; add finance + uncategorized departments |
| `origin/fix/pbv-upload-load-failed` | `c95aa1e` | fix(pbv-upload): harden tenant document upload — tenantFetch + maxDuration + reduced PDF size |

---

## 2. Step 1: dev-HACH → main

### Outcome
**Already up to date** — `dev-HACH` had previously been merged into `main`. No new commits to merge.

### Commands Executed
```bash
git checkout main
git pull origin main
git merge origin/dev-HACH --no-ff -m "Merge dev-HACH: print renderer fixes for launch"
# Result: Already up to date
```

### Verification
- **Type check:** `npx tsc --noEmit` ✅ PASSED
- **Build:** `npm run build` ✅ PASSED (183 routes)

### Tag Pushed
```
launch-prep-hach-2026-05-19
```

---

## 3. Step 2: fix/pbv-upload-load-failed → main

### Outcome
**Successful merge** — 336 files changed, 84 commits integrated.

### Commands Executed
```bash
git checkout main
git pull origin main
git merge origin/fix/pbv-upload-load-failed --no-ff -m "Merge fix/pbv-upload-load-failed: PBV full-app tenant flow + PRD-45/46/47 scanner work"
```

### Notable Changes Included
- **PBV full-app tenant flow:** Entry, dashboard, documents, intake, signing, print routes
- **PRD-45:** Live camera scanner with edge detection (`LivePreviewStage.tsx`, `edgeDetectionLoop.ts`)
- **PRD-46:** Mobile polish, capture guidance (`inlineTip`, `howToTitle` translations)
- **PRD-47:** Multi-page review, stuck feedback, debug overlay (`reviewTitle`, `stuckHint`, `DebugErrorOverlay.tsx`)
- **Upload hardening:** `tenantFetch`, `maxDuration`, reduced PDF size
- **Supabase migrations:** 19 new migrations for PBV tables (form_documents, signature_events, summary_documents, etc.)
- **E2E tests:** Full test suite for PBV tenant flow

### Files Modified During Merge
```
 app/pbv-full-app/[token]/documents/page.tsx       |  23 +-
 components/DocumentScanner/DocumentScanner.tsx     | 313 ++++++++++++++-------
 components/DocumentScanner/LivePreviewStage.tsx    | 260 +++++++++++------
 components/DocumentScanner/edgeDetectionLoop.ts    |  71 ++++-
 components/DocumentScanner/translations.ts         |  79 ++++++
 components/pbv/DebugErrorOverlay.tsx               | 271 ++++++++++++++++++
 ... (330 additional files)
```

### Post-Merge Fix
**Stripped UTF-8 BOM from `lib/formUtils.ts`**
- **Issue:** File started with BOM (0xEF 0xBB 0xBF) per Alex's flag
- **Fix:** Removed first 3 bytes using byte-level file operation
- **Verification:** First byte now 0x2F (`/`) instead of 0xEF

### Verification
- **Type check:** `npx tsc --noEmit` ✅ PASSED (after .next cache clear)
- **Build:** `npm run build` ✅ PASSED (207 routes)

### Tag Pushed
```
launch-prep-full-2026-05-19
```

---

## 4. Step 3: Sync dev with main

### Outcome
**Fast-forward merge** — dev now tracks main exactly.

### Commands Executed
```bash
git checkout dev
git pull origin dev
git merge origin/main --ff-only
# Result: Fast-forward
```

### Verification
- **Push:** `git push origin dev` ✅ SUCCESS

---

## 5. Final State

### Main Branch
| Property | Value |
|----------|-------|
| **Final SHA** | `7200a25` |
| **Commit Subject** | Merge fix/pbv-upload-load-failed: PBV full-app tenant flow + PRD-45/46/47 scanner work |
| **Tags** | `launch-prep-hach-2026-05-19`, `launch-prep-full-2026-05-19` |
| **Type Check** | ✅ PASSED |
| **Build** | ✅ PASSED (207 routes) |
| **Status** | Ready for Vercel deploy |

### Branch Alignment
```
main         7200a25 [launch-prep-full-2026-05-19]
dev          7200a25 [launch-prep-full-2026-05-19]  (synced)
dev-HACH     1940afe  (no change - already on main)
fix/pbv...   c95aa1e  (merged, preserved)
```

---

## 6. Conflicts Encountered

**None.** Both merges were clean:
- Step 1 (dev-HACH): Already up to date
- Step 2 (fix/pbv-upload-load-failed): No merge conflicts
- Step 3 (dev sync): Fast-forward

---

## 7. Items Punted / Needing Attention

### None Blocking
All steps completed successfully with no unresolved issues.

### Post-Deploy Verification Recommended
Per the audit (`docs/audits/49-pbv-launch-readiness-audit_2026-05-19.md`), after Vercel deploy:
1. Test tenant entry with token: `preview-test-unit-1a-29c78370aade49d5ae0335cadcba8cbb`
2. Verify live scanner edge detection on iOS Safari
3. Test 10-page PDF upload on cellular
4. Confirm `?debug=1` error overlay gating works
5. Validate Supabase RLS policies in production

---

## 8. Commands Summary

```bash
# Pre-flight
git fetch --all --prune
git log --oneline -1 origin/main       # a05e1a7
git log --oneline -1 origin/dev-HACH   # 1940afe
git log --oneline -1 origin/fix/pbv-upload-load-failed  # c95aa1e

# Step 1
git checkout main
git pull origin main
git merge origin/dev-HACH --no-ff -m "Merge dev-HACH: print renderer fixes for launch"
npx tsc --noEmit          # PASSED
npm run build             # PASSED (183 routes)
git push origin main
git tag -a launch-prep-hach-2026-05-19 -m "After dev-HACH merge"
git push origin launch-prep-hach-2026-05-19

# Step 2
git checkout main
git pull origin main
git merge origin/fix/pbv-upload-load-failed --no-ff -m "Merge fix/pbv-upload-load-failed: PBV full-app tenant flow + PRD-45/46/47 scanner work"
# Fix: Strip BOM from lib/formUtils.ts
npx tsc --noEmit          # PASSED
npm run build             # PASSED (207 routes)
git push origin main
git tag -a launch-prep-full-2026-05-19 -m "After fix/pbv-upload-load-failed merge — ready for Vercel deploy"
git push origin launch-prep-full-2026-05-19

# Step 3
git checkout dev
git pull origin dev
git merge origin/main --ff-only
git push origin dev
```

---

**Report Complete — Ready for Vercel Deploy**
