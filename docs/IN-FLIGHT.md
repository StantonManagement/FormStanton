# In-Flight Work — Rolling Tracker

**Updated:** 2026-05-20
**Source of truth for:** what's actively being built, what's queued, what's blocked, what just shipped, and what's waiting on Alex.

This file is the cross-session view. The chat-level back-and-forth is too fast to keep mental track of; this is the answer to "where are we, exactly?" at any point. Updated by Claude as decisions land. Memory's `state_pbv_current.md` points here.

---

## In flight (active build)

### PRD-52 — Ship Scanic, remove jscanify + OpenCV.js
- **Branch:** `feat/pbv-scanner-scanic-ship-52` @ `394a50b`
- **Path used:** Path B (self-hosted UMD via `/public/scanic/` + postinstall sync). Path A (webpack experiments) was tried and abandoned.
- **Static gates passing:** `tsc --noEmit` clean, `npm run build` clean in 50s, jscanify removed, OpenCV.js removed.
- **Deferred gates:** 4 (low-contrast detection), 5 (cellular cold-load timing), 7 (iOS Safari + Android Chrome matrix), 8 (PRD-47/51 composability), 9 (no jscanify residue grep), 10 (5-min memory leak), 11 (rollback rehearsal).
- **Next:** Alex deploys to Vercel preview; Claude walks deferred gates with browser tools + test token; merge if clean.

### PRD-51 — Combined Approve & Send Invitation (one-click admin flow)
- **Branch:** `feat/pbv-preapp-combined-approve-send-51` — 2 commits ahead of `main`
- **Feature complete on the branch as of 2026-05-20.** Both pieces landed:
  - `35bbc06` — F1–F4: combined Approve & Send Invitation chain button (replaces 3-click flow)
  - `a6f78ae` — F0: phone data path (migration + types + PATCH endpoint + create-full-app propagation + editable phone in preapp UI with `hasPhone` gate)
- **Migration `20260519000000_pbv_preapp_phone.sql`** applied to Supabase live.
- **Static gates:** `tsc --noEmit` clean, `npm run build` clean.
- **Blocked on:** Vercel preview off this branch to walk the flow end-to-end (same blocker as PRD-52 — deploy both previews in one session). After verification: merge to `main`.

---

## Queued (scoped, not started)

### admin-01 — Shared admin DataTable component (new feature group)
- **PRD drafted:** `docs/admin-Plan/admin-01-datatable-shared-component-prd_2026-05-20.md`
- **First PRD under the new `admin` feature group** — feature-local numbering, parallel folder to `fullApp-Plan/`.
- **Scope:** TanStack Table-based `<DataTable>` for 11 Stanton admin list pages. Sort, global search, per-column filters, column show/hide+reorder, row selection with bulk actions, namespaced URL-state, CSV export.
- **Decisions locked:** TanStack Table engine, HACH out of scope (→ `admin-02` follow-on), URL contract standardized (Pipeline links break, acknowledged), client-side default with manual mode for audit logs.
- **Phases:** 1) Build component + tests, 2) Pre-apps retrofit (proof), 3) Pipeline (URL-state migration test), 4) Form Submissions (highest complexity), 5) remaining 7 pages, 6) cleanup.
- **Phase 1 prompt:** `docs/admin-Plan/prompts/admin-01-datatable-shared-component-prompt_2026-05-20.md` — running in Windsurf (component + tests + demo page + a11y, no retrofits).
- **Retrofit sweep prompt:** `docs/admin-Plan/prompts/admin-01-datatable-shared-component-retrofit-sweep-prompt_2026-05-20.md` — queued, kicks off once Phase 1 PR merges to `main`. Migrates all 11 admin tables (pre-apps, pipeline, full-apps, form-submissions, audit-log, reimbursements, users, properties, projects, appfolio-queue, tow-list × 3 instances) in a single branch with phase-aligned commits, removes demo page, runs Lighthouse comparison. Pipeline URL break explicitly handled in PR + build report.
- **Next:** Wait for Phase 1 PR to merge, then hand the retrofit sweep prompt to Windsurf on a fresh branch off `main`.

### Launch bugs (consolidated PRD to be written)
- `components/pbv/cards/DocumentCardStack.tsx:237` — `alert('Sidesheet coming in Phase 3 (F6)')` on "See full list" button. Leaks dev jargon to applicants.
- `components/pbv/cards/DocumentCard.tsx:279` — deactivate confirm references "See full list" in en/es/pt — false promise depending on bug above.
- **Plan:** accumulate more findings during applicant walkthroughs, ship one consolidated PR.
- **Trigger to write the PRD:** when Alex finishes walking the deployed flow or starts seeing real applicant feedback, whichever comes first.

### tenant_lookup migration retrofit
- Table exists in prod Supabase (`lieeeqqvshobnqofcdac`) but no `CREATE TABLE` migration is checked into version control.
- **Scope:** dump current production table definition, write a retroactive migration, check in.
- **Priority:** non-blocking for launch, but should land before any new environment is spun up (staging, recovery, new dev DB).
- **Trigger:** when Alex has 30 min to do the schema dump.

---

## Blocked / waiting on Alex

- **Two Vercel preview deploys** (do both in one session):
  - `feat/pbv-scanner-scanic-ship-52` — walk PRD-52 deferred gates with test token `preview-test-unit-1a-29c78370aade49d5ae0335cadcba8cbb`.
  - `feat/pbv-preapp-combined-approve-send-51` — walk the phone-edit + combined Approve & Send flow end-to-end against a real preapp; verify SMS fires.
- **`dev` branch cleanup confirmation.** Windsurf was told to reset `dev` back to `main` after moving the accidental PRD-48 work to the feature branch. Has not been explicitly confirmed.

---

## Recently shipped (last ~2 weeks)

| When | What | Tag / Branch |
|---|---|---|
| 2026-05-19 | Docs cleanup pass — PRDs 38/39/41/43/44/46/47 + briefs + audit/merge prompts moved to `shipped/`. PRD-48 archived (superseded by 52). Log in `tasks/docs-cleanup_2026-05-15.md`. | — |
| 2026-05-19 | Launch merge — main at `7200a25` carrying PRD-45/46/47 scanner work + PBV upload hardening | `launch-prep-full-2026-05-19` |
| 2026-05-19 | dev-HACH print fixes (`c09d237`) — letterhead, tables, signatures, page breaks | `launch-prep-hach-2026-05-19` |
| 2026-05-19 | PRD-49 audit complete — established correct branch state pre-merge | `docs/audit/49-pbv-launch-readiness-audit_2026-05-19.md` |
| 2026-05-19 | PRD-48 (Scanic pilot) — superseded by PRD-52, abstraction salvaged | — |
| 2026-05-17 | PRD-42 (document card stack redesign) | — |
| 2026-05-15 | PRDs 22-30 form execution work | — |
| 2026-05-14 | PRDs 01/1.5/02 — application_documents polymorphic substrate, packet intake decoupling from form_submissions | — |

---

## Open questions waiting on Alex

| # | Question | Why it's blocking |
|---|---|---|
| 1 | When can you deploy `feat/pbv-scanner-scanic-ship-52` to a Vercel preview? | Blocks PRD-52 verification + merge. |
| 2 | Confirm dev was reset to main after PRD-48 work was relocated. | If not, stale pilot code on dev will confuse the next branch. |
| 3 | After PRD-51 ships, when do you want to walk the deployed full flow with a real test token? | Triggers launch-bugs PRD scoping. |

---

## How to use this file

- **Claude updates it** every time a decision lands, a branch ships, or a question gets answered. Memory state file points here for cross-session continuity.
- **Alex skims it** at the start of a session to remember where things stand without rereading old chats.
- **Sections are scannable, not exhaustive.** If a section gets too long, that's a signal to either ship something or move it to "blocked" with a clear next step.
- **No status colors, no emoji clutter, no Jira mimicry.** Just plain markdown. The point is "where are we?" — not "how do we manage process?"
