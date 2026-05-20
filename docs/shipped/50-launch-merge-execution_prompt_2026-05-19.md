# Windsurf Merge Execution — Launch Sequence

Two-step merge to get `main` ready for the PBV full-app launch. **Order matters.** Do not reorder.

**Context:** Per audit `docs/audits/49-pbv-launch-readiness-audit_2026-05-19.md` and Alex's review of `c09d237`, `dev-HACH` is launch-critical (print path fixes that affect both tenant download and HACH handoff) and must merge before `fix/pbv-upload-load-failed`. Otherwise there's a window where the scanner work is on `main` but print output is still broken.

---

## Shell protocol

- Git commands are fast; no timeout concerns.
- `npm run build` ~300s timeout, single retry on hang.
- `npx tsc --noEmit` first, then `npm run build`.
- Do not `npm run dev`. Do not invoke `yarn` / `pnpm`.
- If a merge produces unresolved conflicts you cannot mechanically resolve, **stop and report.** Do not guess.

---

## Step 0 — Pre-flight

```sh
git fetch --all --prune
git status
```

Working tree must be clean. If dirty, stash or stop. Confirm:

```sh
git log --oneline -1 origin/main
git log --oneline -1 origin/dev-HACH
git log --oneline -1 origin/fix/pbv-upload-load-failed
```

Capture all three SHAs in the merge report.

---

## Step 1 — `dev-HACH` → `main`

```sh
git checkout main
git pull origin main
git merge origin/dev-HACH --no-ff -m "Merge dev-HACH: print renderer fixes for launch"
```

**Why `--no-ff`:** preserves a merge commit so the HACH-print landing is visible in `git log` as a discrete event. Helps if we ever need to revert.

**If conflicts:**
- Likely conflict files: `app/forms/[id]/print/route.ts`, `lib/formUtils.ts`, `components/review/HachReviewSurface.tsx`. These are HACH-branch territory, so `main` shouldn't have competing edits — clean merge expected.
- If you do hit conflicts, **stop**. List the conflicting files and which side has the more recent change. Do not pick a side. Report and wait.

After merge succeeds:
```sh
npx tsc --noEmit
npm run build
```

Both must pass. If build fails, do not push. Report what failed.

If both pass:
```sh
git push origin main
```

**Tag the launch checkpoint:**
```sh
git tag -a launch-prep-hach-2026-05-19 -m "After dev-HACH merge"
git push origin launch-prep-hach-2026-05-19
```

This gives us a clean rollback target if Step 2 goes sideways.

---

## Step 2 — `fix/pbv-upload-load-failed` → `main`

```sh
git checkout main
git pull origin main   # should be a no-op; just confirms we have the Step 1 merge locally
git merge origin/fix/pbv-upload-load-failed --no-ff -m "Merge fix/pbv-upload-load-failed: PBV full-app tenant flow + PRD-45/46/47 scanner work"
```

This is 84 commits. Conflicts are more likely here because:
- Both branches may have touched `lib/formUtils.ts` (the BOM issue Alex flagged in c09d237 is in this file).
- Both branches may have touched `translations.ts` (PRD-46/47 added scanner strings; HACH branch may have added form strings).
- `components/review/HachReviewSurface.tsx` only changed in HACH branch — unlikely conflict.

**If conflicts:**
- For `translations.ts`: merge both sets of strings additively. Each branch adds keys; they shouldn't collide unless the same key was added in both. If they do collide, stop and report.
- For `lib/formUtils.ts`: HACH branch is the authority on print formatting. If `fix/pbv-upload-load-failed` has competing changes here, stop and report.
- For any other conflict you can't mechanically resolve: stop and report. Do not guess.
- **Strip the UTF-8 BOM** from `lib/formUtils.ts` line 1 while you're in there. The file currently starts with `﻿/**`; should start with just `/**`. Trivial fix.

After merge succeeds:
```sh
npx tsc --noEmit
npm run build
```

Build success is non-negotiable. If it fails:
- Revert the merge: `git reset --hard launch-prep-hach-2026-05-19`
- Report what failed in the build output.
- Do not push the broken merge.

If both pass:
```sh
git push origin main
git tag -a launch-prep-full-2026-05-19 -m "After fix/pbv-upload-load-failed merge — ready for Vercel deploy"
git push origin launch-prep-full-2026-05-19
```

---

## Step 3 — Sync `dev` with `main` (housekeeping)

Per the audit, `dev` is missing recent main commits and is effectively abandoned for this cycle. Fast-forward `dev` to match `main` so future work isn't started from stale state.

```sh
git checkout dev
git pull origin dev
git merge origin/main --ff-only || git merge origin/main --no-ff -m "Sync dev with main post-launch-prep"
git push origin dev
```

If a fast-forward isn't possible (dev has divergent commits not on main), use `--no-ff`. If even that conflicts, stop and report — that means dev has something on it that wasn't audited.

---

## Step 4 — Merge report

Write `docs/build-reports/50-launch-merge-execution_report_2026-05-19.md` with:

1. **Pre-merge SHAs** of `main`, `dev-HACH`, `fix/pbv-upload-load-failed`.
2. **Step 1 outcome:** clean merge / conflicts (with files listed) / build pass.
3. **Step 2 outcome:** clean merge / conflicts (with files listed and resolution per side) / build pass.
4. **Final `main` SHA** after both merges.
5. **Tags pushed:** both.
6. **`dev` sync outcome.**
7. **Anything you punted on or that needs Alex's attention.**

---

## What NOT to do

- **Do not squash either merge.** History matters for a 84-commit branch — squashing destroys it. Use `--no-ff`.
- **Do not rebase `fix/pbv-upload-load-failed` onto `main`.** Use merge commits. Rebasing 84 commits invites cascade conflicts.
- **Do not delete the source branches** after merging. Keep them around for at least 30 days as a safety net. Alex can prune later.
- **Do not reorder the steps.** `dev-HACH` first. Always.
- **Do not push a failing build.** If `npm run build` fails after either merge, revert and report.
- **Do not resolve unfamiliar conflicts by guessing.** Stop and report.
- **Do not deploy to Vercel.** That's Alex's step. Your job ends at `git push origin main` + tags.
- **Do not modify any files other than the BOM strip in `lib/formUtils.ts`** during the merge process. No drive-by fixes.

---

## Reporting back

When done, post in chat:
- Final SHA on `main`.
- Both tag names pushed.
- Any conflicts you handled and how.
- Link to the merge report.
- Confirmation that `npx tsc --noEmit` and `npm run build` both passed on the final `main`.

If you stopped at any point: post which step, what blocked you, and what files / output you saw. Don't try to push partial state.
