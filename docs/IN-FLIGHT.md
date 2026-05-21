# In-Flight Work — Rolling Tracker

**Updated:** 2026-05-20
**Source of truth for:** what's actively being built, what's queued, what's blocked, what just shipped, and what's waiting on Alex.

This file is the cross-session view. The chat-level back-and-forth is too fast to keep mental track of; this is the answer to "where are we, exactly?" at any point. Updated by Claude as decisions land. Memory's `state_pbv_current.md` points here.

---

## In flight (active build)

### ★ PBV Full-App Finalization (vNext) — the lane
- **Master plan:** `docs/fullApp-Plan/pbv-full-finalization-roadmap_2026-05-20.md`. Picks one lane — tenant self-serve full-app from SMS link → submitted signed packet — and sequences everything left into child PRDs **55–61**.
- **Definition of done (locked 2026-05-20):** real applicant completes + submits a correct signed packet, on their own phone, in **EN/ES/PT**, no call to Stanton, no tenant-safety defects, with the advanced scanner + a low-contrast "can't lock on" hint. **Finish line = tenant submit only** (staff/HACH side OUT of lane). Conditional pet/vehicle/self-employment forms IN; VAWA/RA/healthcare-release stay source-pending.
- **Child PRDs:** 55 forms-completeness, 56 signing+submit e2e, 57 intake integrity/safety, 58 documents clarity+gating+banner, 59 trilingual e2e, 60 scanner verify+contrast hint, 61 closeout gate. **All 7 PRDs + prompts written** in `docs/fullApp-Plan/` (+ `prompts/`).
- **Batch run:** designed for ONE Cascade (Opus 4.7 adaptive) running prompts 55→61 back-to-back. Rules in `docs/fullApp-Plan/BATCH-RUN-PROTOCOL.md`: one cumulative branch `feat/pbv-full-finalization`, one commit per PRD, **default-and-log to `OPEN-DECISIONS.md` (never stop to ask)**, write-but-don't-apply prod migrations, static gates inline + deploy/device gates deferred to a post-run verification pass.
- **Status (2026-05-20):** batch ready to run. After Cascade finishes → mandatory runtime verification pass (Chrome walk on the deploy, like PRD-54) + Alex resolves `OPEN-DECISIONS.md`.
- **Findings baked into the PRDs (grounded in current code, correcting the stale 05-17 journey):** signing writes `pbv_signature_events` but finalize validates `application_documents` and download reads `pbv_signature_audit_log` — three unsynced stores (PRD-56 F1, P1). Magic-link additional-signer `sign-form` is a stub (PRD-56 F2). Dashboard "Application Submitted" banner keyed on `intake_status==='complete'`, not real submission (PRD-58). `categorizeDoc()` substring matcher mis-files docs (`eiv_guide_receipt`→"guide"→IDENTITY) (PRD-58). Protected-status intake defaults are **already neutral** — PRD-57 reframes to confirm+lock+regression-test. Pets/vehicle inputs **not captured** in intake-schema, so PRD-55 pet/vehicle conditional forms can't trigger (PRD-57 adds them). 68 untranslated `TODO:` ES/PT strings in `docTypeHelp.ts` (PRD-59).

### PRD-54 — PBV signing flow: summary-loop + `/sign` 404 + zero-forms (✅ ALL THREE BUGS SHIPPED + VERIFIED LIVE 2026-05-20)
- **Discovered 2026-05-20** in a live end-to-end test of the tenant full-app. Three bugs in the document → signing transition. Doc upload itself works.
- **Bug A (404):** `app/pbv-full-app/[token]/documents/page.tsx:122` CTA pointed at `/sign` (no such route). → **Shipped + verified live.**
- **Bug B (infinite loop):** `sign/summary/page.tsx` re-fired `generate-forms` forever (100+ POSTs, intermittent 503s) because `reload()` churned `state`. Fix = `useRef` one-shot guard + terminal state. → **Shipped + verified live** (exactly one POST, no loop, on two apps). Deploy `dpl_CW82PZcWGofHmaMcGn4dVuxFGFix`.
- **Bug C (zero forms) — SHIPPED + VERIFIED LIVE 2026-05-20:** root cause was source PDFs read from `docs/templates/` via `fs`, but `.vercelignore` strips `docs/` from the deploy; the earlier tracing fix only covered `scripts/field-maps/**`. Fix `1dc4477` copied 20 source PDFs to `assets/pbv-source-pdfs/`, repointed `lib/pbv/form-generation/source-pdfs.ts`, and added `./assets/pbv-source-pdfs/**` to `outputFileTracingIncludes` in `next.config.js`.
  - **Live verification (Chrome DevTools, prod, token `222-224-maple-ave-unit-2n-…`):** `POST generate-forms` → 200, `total_generated: 9`, `main_application/en` now **generated** (was previously skipped). `/sign/summary` renders the summary PDF, the read-and-understood checkbox + "Sign summary" button are present → flow is signable. Exactly **one** generate-forms POST (Bug B holding, no loop). The runtime behavior itself confirms the deploy carried `1dc4477` (old build would still skip `main_application`).
  - **Skipped (6, all expected source-pending/conditional):** `criminal_background_release`, `eiv_guide_receipt`, `reasonable_accommodation`, `insurance_settlement`, `cd_trust_bond` — plus `briefing_cert/en` (see Launch bugs note below — separate pre-existing form_id key mismatch, NOT a Bug C regression).
- **How to verify on deploy:** open `/sign/summary` for a test token, read the `generate-forms` response. PASS = `total_generated > 0` and `skipped` contains **only** conditional/source-pending forms (`criminal_background_release`, `eiv_guide_receipt`, `reasonable_accommodation`, `insurance_settlement`, `cd_trust_bond`, pet/vehicle/self-employment) — **not** `main_application/en`. Then `/sign/summary` should render and be signable; "Review and sign required forms" unlocks.
- **Test tokens (prod):** `222-224-maple-ave-unit-2n-fa62844782fa4266b5cc1697bfbf734c` (11/11 docs uploaded), `110-martin-unit-1-f39817020e324160b5dae3b5f4c48633` (1/13 docs).
- **Docs:** PRD `docs/fullApp-Plan/54-pbv-summary-sign-loop-and-route-fix_prd_2026-05-20.md` + `prompts/54-...prompt_2026-05-20.md`; build report `docs/build-reports/54-...build-report_2026-05-20.md`.

### PRD-52 — Ship Scanic, remove jscanify + OpenCV.js
- **Branch:** `feat/pbv-scanner-scanic-ship-52` @ `394a50b`
- **Path used:** Path B (self-hosted UMD via `/public/scanic/` + postinstall sync). Path A (webpack experiments) was tried and abandoned.
- **Static gates passing:** `tsc --noEmit` clean, `npm run build` clean in 50s, jscanify removed, OpenCV.js removed.
- **Deferred gates:** 4 (low-contrast detection), 5 (cellular cold-load timing), 7 (iOS Safari + Android Chrome matrix), 8 (PRD-47/51 composability), 9 (no jscanify residue grep), 10 (5-min memory leak), 11 (rollback rehearsal).
- **Next:** Alex deploys to Vercel preview; Claude walks deferred gates with browser tools + test token; merge if clean.
- **Correction (2026-05-20):** Scanic appears **already merged to `main`** — `package.json` has `"scanic": "^1.0.8"` + a `postinstall: node scripts/sync-scanic.mjs`, and the advanced detector components are on main. So PRD-52 effectively shipped; the deferred device-matrix gates (low-contrast, iOS/Android matrix, cold-load, 5-min memory) are now owned by **PRD-60** (scanner verify + contrast hint). Treat Scanic as IN for v1.

### PRD-51 — Combined Approve & Send Invitation (one-click admin flow)
- **Branch:** `feat/pbv-preapp-combined-approve-send-51` — 2 commits ahead of `main`
- **Built but has a blocking bug — superseded by PRD-53.** F1–F4 chain button (`35bbc06`) + F0 phone data path (`a6f78ae`) landed on the branch, but:
  - **Critical bug (found 2026-05-20):** the entire phone + invite section is wrapped in `{qualified && (...)}` at `preapps/page.tsx:1071`, so it's INVISIBLE for over-income preapps — exactly what Alex was testing. Root cause: a bad closed-decision in PRD-51 ("hide button if not likely_qualifies"). This is why "I still can't enter a phone number" kept happening.
  - **Not merged to `main`** — `git cat-file` confirms the phone migration is absent from main. The merge Alex believed happened did not land (see git config issue below).
- **Resolution:** fold into PRD-53. Do not merge PRD-51 standalone.

### PRD-53 — Preapp contact capture + income edit & qualification override
- **Branch:** `feat/pbv-preapp-contact-and-override-53` (builds on the PRD-51 branch)
- **Fixes the PRD-51 gate bug** (ungate the invite section) + adds: inline income edit with re-qualification, "Override & Send" for over-income applicants (typed reason, audited), and phone (required) + email (optional) on the PUBLIC preapp form.
- **Status:** PRD + prompt written 2026-05-20. Awaiting Windsurf.
- **PRD:** `docs/fullApp-Plan/53-pbv-preapp-contact-capture-and-override_prd_2026-05-19.md`

### ⚠ Infrastructure blockers (address in PRD-53)
- **`.git/config` line 23** — earlier sessions saw `fatal: bad config line 23` and assumed corruption. **Correction (2026-05-20):** Claude Code found git working fine in both PowerShell and bash; line 23 is a harmless tab-only/trailing line and the `fatal` did not reproduce. **Not actually a blocker.** (So the PRD-51 "migration never reached main" issue is *not* explained by git config — verify branch/merge state directly instead.)
- **Migrations must be applied to prod Supabase** (`lieeeqqvshobnqofcdac`) — phone (PRD-51) + email + override columns (PRD-53). Merging `.sql` files doesn't add columns to the running DB. (Note: a prior tracker entry claimed the phone migration was "applied to Supabase live" — verify against the actual prod schema; the code is NOT on main regardless.)

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

### Next 16 Turbopack vs webpack config (post-launch, deliberate)
- Local `next dev` won't start on Next 16: Turbopack is now the default and conflicts with the `webpack()` block in `next.config.js` (OpenCV `fs`/`path`/`crypto` fallbacks).
- **For now: ignore.** Use `next dev --webpack` if dev is needed. Do NOT add `turbopack: {}` and do NOT fold this into any hotfix commit.
- **Real risk to settle deliberately:** if `next build` ever inherits the Turbopack default, the webpack OpenCV config gets silently ignored → could break the production bundle. Confirm the build script pins webpack, then plan the migration as its own task.

### Launch bugs (consolidated PRD to be written)
- `components/pbv/cards/DocumentCardStack.tsx:237` — `alert('Sidesheet coming in Phase 3 (F6)')` on "See full list" button. Leaks dev jargon to applicants.
- `components/pbv/cards/DocumentCard.tsx:279` — deactivate confirm references "See full list" in en/es/pt — false promise depending on bug above.
- **`briefing_cert` form never generates — form_id key mismatch (found 2026-05-20 during PRD-54 live verify).** [Inference] `generate-forms` requests form_id `briefing_cert`, but `lib/pbv/form-generation/source-pdfs.ts` registers the PDF under key `briefing_docs_certification`, so `getSourcePdf('briefing_cert','en')` returns null → form skips at the source-PDF check (line 116) before reaching its (present) field map. The asset files exist and are correctly named (`assets/pbv-source-pdfs/briefing-cert-en.pdf`, `scripts/field-maps/briefing-cert-en.json`); only the registry KEY is wrong. **[Unverified] whether `briefing_cert` is meant to be a stamped PDF at all** — there's an HTML-rendering pilot at `app/pilot/briefing-cert/source-text.md`, so the skip *might* be intentional. Confirm intended path against the `pbv_form_templates` row + form-html-rendering-pilot PRD before changing the key. If it should generate: align the `source-pdfs.ts` key to the template form_id (`briefing_cert`).
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
| 2026-05-20 | PRD-54 **all three bugs** — `/sign` 404 (A), summary-page `generate-forms` infinite loop (B), zero-forms source-PDF tracing (C). Bug C `1dc4477` pushed + verified live: `total_generated: 9`, `main_application` generates, summary signable, one POST. **Launch blocker cleared.** | `fix/pbv-summary-sign-loop-54` + `1dc4477` on `main` |
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
