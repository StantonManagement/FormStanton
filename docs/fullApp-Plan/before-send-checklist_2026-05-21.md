# Before you can send applications to tenants — plain checklist

_2026-05-21. Honest read of what's actually left. Not more building — a merge, a deploy, and a quick check._

## Already done (stop worrying about these)

- **All the database changes are live on prod** — the full 2026-05-21 migration batch was applied (per Windsurf). The constraint-drift cleanup is closed.
- **The entire tenant application flow is built and committed** — intake → documents → signing → review → submit, in English and Spanish, plus the recent hardening (PRDs 55–73). None of it is half-finished.

## The one real gate: get the code live

The whole flow is on the `feat/pbv-tenant-polish` branch — **27 commits ahead of `main`**. Production builds from `main`, so until this merges, tenants can't reach the flow.

1. **Confirm what branch your Vercel "Production" deploys from.** If it's `main` (most likely), the flow isn't live yet. _(One-minute check in the Vercel dashboard → Settings → Git.)_
2. **Open the PR and merge the branch into `main`.** This is the decision that's been parked on you — nothing technical is blocking it. (One PR for the whole chain is simplest; a stacked split is optional.)
3. **Let it deploy.** Vercel auto-builds `main`. The migrations are already applied, so the order is correct (database first, code second).

## Quick checks before you actually hit send

4. **One test tenant, all the way through** — on the deployed site (or a Vercel preview), have a test application go intake → upload docs → sign → submit, once in **English** and once in **Spanish**. Confirm it completes. _(This is the click-through we set up but haven't run.)_
5. **If any tenants are already mid-application,** send a quick heads-up first — they'll see a new required "Government Photo ID" upload slot (added in PRD-65).

## Not blockers — don't let these hold you up

- **Portuguese form names** are held for native review. English and Spanish work fully; Portuguese just shows the English name until that's reviewed. You can launch EN/ES without it.
- The CI **"E2E Tenant Flow"** red check is intentionally not the merge bar (your earlier call). Verification is the manual click-through above.
- A small wording fix in the decision log. Cosmetic.

## Honest timing

This is a merge + deploy + smoke test, not new work. If the PR review is light and the click-through passes, it's plausibly same-day to a couple of days. I can't promise a number — I can't see your review/QA process or confirm the deploy branch from here.

**Shortest path to sending: confirm the Vercel production branch → merge to `main` → run the EN/ES click-through → send.**
