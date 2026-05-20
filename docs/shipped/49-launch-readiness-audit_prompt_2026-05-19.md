# Windsurf Audit Prompt — PBV Full-App Launch Readiness

This is an **investigation prompt, not a build prompt**. No code changes. No commits. No PRs. The deliverable is a single audit document at the end. Read this entire prompt before running any commands.

**Context:** Alex wants to launch the PBV full app so real applicants can complete the tenant flow end-to-end. Before opening the gate to 77 applicants, we need a clear picture of:
1. What's actually on `main` right now (the prod branch).
2. What's on each in-flight branch (and whether anything is contaminated by mixing scopes).
3. What absolutely must land before launch vs. what can wait.
4. Whether the experimental PRD-48 Scanic pilot accidentally rode along with a hardening branch (most pressing single risk).

A previous status report claimed:
- `fix/pbv-upload-load-failed` is 9 commits ahead of main, "contains PBV full app tenant flow + pilot artifacts"
- `dev` is "behind main"
- `dev-HACH` is 6 commits behind origin
- `feat/pbv-scanner-mobile-polish-46` is ahead 1
- `feat/pbv-scanner-multipage-review-47` is "merged/ready"

Verify each of these claims against actual git state. Treat the prior report as a hypothesis, not ground truth.

---

## Shell protocol

Same as build prompts: explicit timeouts, single retry on hang, never `npm run dev`, never invent alternatives like `yarn`/`pnpm`. For git commands, no timeout concerns — they're fast.

---

## Step-by-step

### Step 0 — Fetch + clean working state

```sh
git fetch --all --prune
git status                  # confirm nothing dirty before the audit
git log --oneline -5 main   # current main tip
git log --oneline -5 dev    # current dev tip
git log --oneline -5 origin/main
git log --oneline -5 origin/dev
git log --oneline -5 origin/dev-HACH
```

Capture the tip commit of each. Note any divergence between local and origin.

### Step 1 — Branch inventory

For each branch listed below, run `git log --oneline main..<branch>` (commits on the branch not on main) and `git log --oneline <branch>..main` (commits on main not on the branch). Capture both lists.

- `fix/pbv-upload-load-failed`
- `dev`
- `dev-HACH`
- `feat/pbv-scanner-mobile-polish-46`
- `feat/pbv-scanner-multipage-review-47`
- `feat/pbv-scanner-scanic-pilot-48` (may or may not exist yet)

For each: confirm whether the prior report's claim matches reality.

### Step 2 — The contamination check (highest priority)

Determine whether **PRD-48 Scanic code** has leaked into any non-pilot branch. PRD-48 introduces:
- A `scanic` entry in `package.json` `dependencies`
- A `DetectorAdapter` interface in `edgeDetectionLoop.ts`
- A `createScanicAdapter` / `createJscanifyAdapter` factory pair
- A `getDetectorChoice` / `ensureDetectorLoaded` helper
- Any reference to `?scanner=scanic` or `NEXT_PUBLIC_SCANNER_DETECTOR`

For each branch in the inventory, run:

```sh
git checkout <branch>
grep -r "scanic" --include="*.ts" --include="*.tsx" --include="package.json" .
grep -r "DetectorAdapter" --include="*.ts" --include="*.tsx" .
grep -r "NEXT_PUBLIC_SCANNER_DETECTOR" --include="*.ts" --include="*.tsx" .
```

Branches expected to contain Scanic refs: `feat/pbv-scanner-scanic-pilot-48` only (if it exists).

Branches that **should NOT** contain Scanic refs:
- `main`
- `dev`
- `dev-HACH`
- `fix/pbv-upload-load-failed`
- `feat/pbv-scanner-mobile-polish-46`
- `feat/pbv-scanner-multipage-review-47`

If Scanic refs appear in any "should NOT" branch → **this is the headline finding.** Document which commits introduced them, whether they came from a merge or a direct edit, and what removal looks like.

### Step 3 — Categorize the 9 commits on `fix/pbv-upload-load-failed`

```sh
git checkout fix/pbv-upload-load-failed
git log --oneline main..HEAD
```

For each of the 9 commits:
- Subject line
- Files touched (`git show --stat <sha>`)
- Tag with one of: `hardening` (upload reliability, error handling, timeouts), `feature` (new tenant-facing functionality), `docs` (PRDs / build reports / build prompts, no runtime code), `pilot` (PRD-48 Scanic — should not be here), `other`.

Output a short table in the audit doc.

The branch claims to contain "PBV full app tenant flow + pilot artifacts." If `pilot` shows up against any commit's runtime code, flag it. If `pilot` shows up only against docs (PRDs and prompts in `docs/fullApp-Plan/`), that's harmless — note it as "docs-only, no contamination."

### Step 4 — What's actually deployed to prod?

```sh
git checkout main
git log --oneline -20
```

For the last 20 commits on `main`, identify which scanner-related PRDs have landed:
- PRD-45 (live camera scanner) — look for `LivePreviewStage.tsx`, `edgeDetectionLoop.ts`, `stabilityTracker.ts` existence and content.
- PRD-46 (mobile polish, capture guidance) — look for `inlineTip`, `howToTitle` in `translations.ts`, `max-h-[50vh] object-contain` in `DocumentScanner.tsx`.
- PRD-47 (multi-page review, stuck banner, debug gate) — look for `reviewTitle`, `stuckHint` in `translations.ts`, `isStuck` state in `LivePreviewStage.tsx`, `process.env.NODE_ENV !== 'production'` in `DebugErrorOverlay.tsx`.

Document for each: "on main" / "on dev only" / "on a feature branch only" / "not anywhere yet."

This determines what a real applicant landing on the production URL today actually sees.

### Step 5 — `dev` vs `main` divergence

The prior report claimed dev is "behind main." Verify:

```sh
git log --oneline dev..main    # commits on main not on dev
git log --oneline main..dev    # commits on dev not on main
```

If `main..dev` is non-empty, dev is ahead in some commits. If `dev..main` is non-empty, dev is missing some main commits. Both can be true at once (divergence).

Document the actual state. If anything substantive is on main that dev doesn't have, flag it — that's the "behind" case the prior report flagged.

### Step 6 — `dev-HACH` print renderer assessment

```sh
git checkout dev-HACH
git log --oneline origin/dev-HACH..HEAD     # local ahead of origin
git log --oneline HEAD..origin/dev-HACH     # what's pending pull
git diff main..HEAD -- 'components/**/print*' 'app/**/print*' 'lib/**/pdf*'
```

The prior report says "6 commits behind origin" with "Print renderer signature/table/letterhead fixes waiting." Confirm. List the 6 pending commits with subjects. Note any commits Alex would want to know about (anything touching the HACH handoff path — China Wall posture per project memory).

### Step 7 — End-to-end tenant flow sanity check (static)

Without deploying, statically verify the tenant entry path:

```sh
git checkout fix/pbv-upload-load-failed   # likely most-current launch candidate
```

- Find the tenant entry route: `find app -name 'page.tsx' | xargs grep -l 'tenant_lookup\|pbv-full-app'`
- Confirm `app/pbv-full-app/[token]/page.tsx` exists.
- Read it. Note: does it depend on any env vars, Supabase tables, or external services that might not be configured in prod?
- Check `lib/supabase/` for the project ID. Memory says the project is `lieeeqqvshobnqofcdac` — confirm.
- Check the tenant_lookup table existence assumption — look in `supabase/migrations/` for the table creation.

This isn't a substitute for a live walkthrough; it's a smoke test that the route exists and the dependencies look plumbed.

### Step 8 — Open questions worth flagging

While walking the code, capture any of:
- Hardcoded URLs / API endpoints that might point to staging instead of prod.
- TODO / FIXME comments in tenant-facing code paths.
- `console.log` calls left in production code that would leak data.
- Translations gaps — non-English strings hardcoded in English in tenant-facing components.
- Auth assumptions — does the tenant route require authentication, or is the token enough? If token-only, how is the token validated?

Don't try to fix any of these. Just list them.

---

## Deliverable

Write a single audit document to: `docs/audits/49-pbv-launch-readiness-audit_2026-05-19.md`

Create the `docs/audits/` directory if it doesn't exist.

The document should have these sections, in this order:

1. **Headline findings** — 3-5 bullets, most important first. Lead with the contamination check result (Scanic-in-wrong-branch yes/no).
2. **Branch inventory table** — branch / commits-ahead / commits-behind / claim-from-prior-report / actual-state / contamination-status.
3. **`fix/pbv-upload-load-failed` commit breakdown** — the 9-commit table from Step 3.
4. **What's on `main` today** — which scanner PRDs have landed, what a real applicant sees right now.
5. **`dev` ↔ `main` divergence** — what's stranded where.
6. **`dev-HACH` pending commits** — list, with subjects.
7. **End-to-end smoke check** — does the tenant entry route exist and look plumbed?
8. **Pre-launch issues observed** — the list from Step 8.
9. **Recommended merge order** — your honest call on what should land before launch and in what order. Be specific: "Merge X to Y; then Z to Y; hold W as Draft." Justify with the findings above, not with generic best practices.
10. **What I couldn't determine without a deploy** — anything that needs a live preview URL + a test token to verify.

---

## What "done" looks like

1. Audit document written to `docs/audits/49-pbv-launch-readiness-audit_2026-05-19.md`.
2. No code changes. No commits. No PRs. The working tree should be clean and on whatever branch you started on (probably `fix/pbv-upload-load-failed`).
3. Post a 5-bullet summary in chat with the headline findings and the recommended merge order. Link to the audit doc.

---

## What NOT to do

- **Do not commit anything.** Read-only audit.
- **Do not modify code "while you're in there."** If you see a one-line bug, note it in Section 8. Don't fix it.
- **Do not run `npm install`, `npm run build`, or `npm run dev`.** This is a git + grep + read audit. Build/install steps wait for the actual merge-and-deploy plan.
- **Do not skip the contamination check.** Section 2 of the deliverable is the highest-value finding; if Scanic code is in a hardening branch, that's the single most actionable thing to surface.
- **Do not trust the prior status report's claims.** Verify each one. Several may be inaccurate.
- **Do not recommend "merge everything to main."** A real recommendation has merge order, splits where contamination exists, and a list of what stays Draft.
- **Do not deploy or trigger any external systems.** If you find env-var configuration issues, just list them.
- **Do not write the audit before doing the investigation.** Each section should be backed by a command you actually ran and output you actually saw.

---

## Reporting back

When done, post in chat:
- Link to the audit doc.
- Headline finding #1 (contamination yes/no).
- One-sentence recommendation on what to merge next.
- Anything that needs Alex's input before the next merge.
- Anything you couldn't determine without a deploy.
